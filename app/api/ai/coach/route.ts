import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AI_NOT_CONFIGURED_MESSAGE, hasGeminiKey } from "@/lib/ai/mock";
import { generateContentStream, GEMINI_FLASH_MODEL } from "@/lib/ai/gemini";
import { getLimiter } from "@/lib/rate-limit";

// Edge runtime — streams arrive faster.
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const coachLimiter = getLimiter("ai:coach", "1 h", 20);

type ChatMessage = { role: "user" | "assistant"; content: string };

interface ChildContext {
  name?: string;
  grade?: string | null;
  recentScores?: Array<{ subject: string; score: number; exam_date: string }>;
  dna_profile?: Record<string, number> | null;
  burnout_risk?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  peak_study_hours?: string | null;
}

function buildSystemPrompt(child: ChildContext | null) {
  const ctxLines: string[] = [];
  if (child?.name)
    ctxLines.push(`Đang tư vấn cho: ${child.name}${child.grade ? `, lớp ${child.grade}` : ""}.`);
  if (child?.recentScores?.length) {
    const top = child.recentScores
      .slice(0, 8)
      .map((s) => `${s.subject}=${s.score}`)
      .join(", ");
    ctxLines.push(`Điểm gần nhất: ${top}.`);
  }
  if (child?.dna_profile && Object.keys(child.dna_profile).length) {
    ctxLines.push(`Learning DNA: ${JSON.stringify(child.dna_profile)}.`);
  }
  if (child?.burnout_risk) ctxLines.push(`Rủi ro burnout: ${child.burnout_risk}.`);
  if (child?.strengths?.length) ctxLines.push(`Điểm mạnh: ${child.strengths.join(", ")}.`);
  if (child?.weaknesses?.length)
    ctxLines.push(`Điểm cần cải thiện: ${child.weaknesses.join(", ")}.`);
  if (child?.peak_study_hours) ctxLines.push(`Giờ học tốt nhất: ${child.peak_study_hours}.`);

  return `Bạn là AI Coach của Parent Intelligence Dashboard — chuyên gia phân tích học tập cho phụ huynh Việt Nam.
${ctxLines.length > 0 ? ctxLines.join(" ") : "Chưa có dữ liệu con cụ thể — hỏi phụ huynh thêm thông tin nếu cần."}

QUY TẮC TRẢ LỜI:
- Tiếng Việt, ngắn gọn dưới 180 từ.
- Đưa ra 2-3 gợi ý thực tế, cụ thể, có thể làm ngay.
- Phong cách: chuyên nghiệp, ấm áp, đồng cảm.
- Không bịa số liệu; nếu thiếu dữ liệu thì hỏi lại.

SAU MỖI CÂU TRẢ LỜI, thêm DUY NHẤT dòng cuối cùng đúng format (sẽ được parse và ẩn khỏi UI):
<!--SUGGESTIONS:["câu hỏi follow-up ngắn 1","câu hỏi follow-up ngắn 2"]-->`;
}

/**
 * Gemini takes a single `prompt` string (or a multi-turn `Content[]`). We
 * collapse the chat history into one prompt with role markers — this is the
 * simplest shape that lets the system prompt + back-and-forth coexist.
 */
function buildPromptFromHistory(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Phụ huynh" : "AI Coach"}: ${m.content}`)
    .join("\n\n")
    .concat("\n\nAI Coach:");
}

// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const childId: string | undefined = body?.childId;
    const incomingConvId: string | undefined = body?.conversationId;

    if (messages.length === 0) {
      return NextResponse.json({ success: false, error: "messages_required" }, { status: 400 });
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // --- Auth + rate limit
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    if (userId) {
      const rl = await coachLimiter.limit(`user:${userId}`);
      if (!rl.success) {
        return NextResponse.json(
          {
            success: false,
            error: "rate_limited",
            message: "Bạn đã đạt giới hạn 20 tin nhắn / giờ. Quay lại sau ít phút.",
          },
          { status: 429 },
        );
      }
    }

    // --- Build child context
    let childContext: ChildContext | null = null;
    if (childId && userId) {
      try {
        const { data: child } = await supabase
          .from("children")
          .select("full_name, grade, dna_profile, burnout_risk, peak_study_hours, parent_id")
          .eq("id", childId)
          .maybeSingle();
        if (child && child.parent_id === userId) {
          const { data: scores } = await supabase
            .from("score_records")
            .select("subject, score, exam_date")
            .eq("child_id", childId)
            .order("exam_date", { ascending: false })
            .limit(12);
          const { data: summary } = await supabase
            .from("weekly_summaries")
            .select("ai_analysis")
            .eq("child_id", childId)
            .order("week_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          const analysis = (summary?.ai_analysis ?? {}) as {
            strengths?: string[];
            weaknesses?: string[];
          };
          childContext = {
            name: child.full_name,
            grade: child.grade,
            recentScores: (scores ?? []) as ChildContext["recentScores"],
            dna_profile: (child.dna_profile ?? null) as Record<string, number> | null,
            burnout_risk: child.burnout_risk,
            peak_study_hours: child.peak_study_hours,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
          };
        }
      } catch {
        /* best-effort */
      }
    }

    // --- Conversation persistence (best-effort, won't block streaming)
    let convId = incomingConvId ?? null;
    if (userId) {
      try {
        if (!convId) {
          const { data } = await supabase
            .from("coach_conversations")
            .insert({
              parent_id: userId,
              child_id: childId ?? null,
              title: lastUser.slice(0, 80),
            })
            .select("id")
            .single();
          convId = data?.id ?? null;
        }
        if (convId) {
          await supabase
            .from("coach_messages")
            .insert({ conversation_id: convId, role: "user", content: lastUser });
        }
      } catch {
        /* ignore */
      }
    }

    // --- MOCK STREAM when Gemini not configured
    if (!hasGeminiKey()) {
      const mockReply =
        `${AI_NOT_CONFIGURED_MESSAGE}. Đây là câu trả lời mẫu của AI Coach cho: "${lastUser.slice(
          0,
          80,
        )}". ` +
        "Khi bạn cấu hình GOOGLE_AI_API_KEY hợp lệ, AI Coach sẽ phản hồi thực tế dựa trên dữ liệu học tập của con.\n" +
        '<!--SUGGESTIONS:["Cho ví dụ cụ thể với con tôi","Tôi nên ưu tiên môn nào tuần này?"]-->';
      return fakeStream(mockReply, { conversationId: convId, aiConfigured: false, supabase });
    }

    // --- Real Gemini streaming (FLASH model — latency + free tier)
    const stream = await generateContentStream(buildPromptFromHistory(messages), {
      model: GEMINI_FLASH_MODEL,
      system: buildSystemPrompt(childContext),
      maxOutputTokens: 1024,
      onComplete: async (text) => {
        if (convId) {
          try {
            await supabase
              .from("coach_messages")
              .insert({ conversation_id: convId, role: "assistant", content: text });
          } catch {
            /* ignore */
          }
        }
      },
    });

    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Ai-Configured": "true",
    });
    if (convId) headers.set("X-Conversation-Id", convId);
    return new Response(stream, { headers });
  } catch (error: any) {
    console.error("/api/ai/coach error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

// ---- helpers ---------------------------------------------------------------

function fakeStream(
  text: string,
  meta: {
    conversationId: string | null;
    aiConfigured: boolean;
    supabase: ReturnType<typeof createClient>;
  },
) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 12) chunks.push(text.slice(i, i + 12));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 25));
      }
      controller.close();
      if (meta.conversationId) {
        try {
          await meta.supabase
            .from("coach_messages")
            .insert({
              conversation_id: meta.conversationId,
              role: "assistant",
              content: text,
            });
        } catch {
          /* ignore */
        }
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
    "X-Ai-Configured": String(meta.aiConfigured),
  });
  if (meta.conversationId) headers.set("X-Conversation-Id", meta.conversationId);
  return new Response(stream, { headers });
}
