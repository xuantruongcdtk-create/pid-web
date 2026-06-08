import { NextResponse } from "next/server";
import { z } from "zod";
import { generateContent, GEMINI_PRO_MODEL } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  hasGeminiKey,
  mockQuizGeneration,
} from "@/lib/ai/mock";
import { getLimiter } from "@/lib/rate-limit";
import { QUIZ_SYSTEM_PROMPT, buildQuizUserPrompt } from "@/lib/ai/prompts/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COUNT_OPTIONS = [5, 10, 15, 20] as const;

const BodySchema = z.object({
  subject: z.string().min(1).max(80),
  grade: z.string().min(1).max(10),
  count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  sourceText: z.string().min(100, "Cần ít nhất 100 ký tự để soạn đề").max(40_000),
  title: z.string().max(160).optional(),
  /** Allow caller to skip writing into DB (preview-only). */
  persist: z.boolean().optional().default(true),
  /** Skip credits gate (used by teacher unlimited plans). */
  bypassCredits: z.boolean().optional().default(false),
});

const QuestionSchema = z.object({
  order_index: z.number().int().min(1),
  question_text: z.string().min(1),
  question_type: z.literal("multiple_choice").default("multiple_choice"),
  options: z
    .array(z.object({ key: z.string().min(1), text: z.string().min(1) }))
    .min(4)
    .max(4),
  correct_answer: z.string().min(1).max(2),
  explanation: z.string().optional().default(""),
  gdpt_level: z.enum(["nhan_biet", "thong_hieu", "van_dung", "van_dung_cao"]),
  difficulty: z.number().int().min(1).max(5),
});

const GeneratedQuizSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  total_questions: z.number().int().min(1),
  estimated_minutes: z.number().min(1),
  gdpt_level_distribution: z.object({
    nhan_biet: z.number().min(0),
    thong_hieu: z.number().min(0),
    van_dung: z.number().min(0),
    van_dung_cao: z.number().min(0),
  }),
  questions: z.array(QuestionSchema).min(1),
});

function extractJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

const quizLimiter = getLimiter("ai:quiz-generate", "1 h", 10);

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { subject, grade, count, sourceText, title, persist, bypassCredits } = parsed.data;

    const supabase = createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    // --- Rate limit: 10 / hour / user
    const rl = await quizLimiter.limit(`user:${user.id}`);
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: "rate_limited",
          message: "Bạn đã đạt giới hạn 10 yêu cầu / giờ. Vui lòng quay lại sau.",
          reset: rl.reset,
        },
        { status: 429 },
      );
    }

    // --- Credits gate
    let profile: { plan: string | null; credits: number | null } | null = null;
    if (!bypassCredits) {
      const { data } = await supabase
        .from("profiles")
        .select("plan, credits")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
      const isUnlimited = profile?.plan === "teacher_pro" || profile?.plan === "premium";
      if (!isUnlimited && (profile?.credits ?? 0) <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "no_credits",
            message: "Bạn đã hết credits. Nâng cấp gói hoặc mua thêm credit packs.",
            credits: profile?.credits ?? 0,
            plan: profile?.plan ?? "free",
          },
          { status: 402 },
        );
      }
    }

    // --- Mock fallback when no AI key
    if (!hasGeminiKey()) {
      const mock = mockQuizGeneration({ subject, grade, count, sourceSnippet: sourceText.slice(0, 200) });
      const finalTitle = title?.trim() || mock.title;
      let createdQuizId: string | null = null;

      if (persist) {
        const persisted = await persistQuiz(supabase, {
          userId: user.id,
          title: finalTitle,
          subject: mock.subject,
          grade: mock.grade,
          sourceContent: sourceText,
          totalQuestions: mock.total_questions,
          estimatedMinutes: mock.estimated_minutes,
          distribution: mock.gdpt_level_distribution,
          questions: mock.questions,
        });
        createdQuizId = persisted?.quizId ?? null;
        if (persisted?.quizId && !bypassCredits && profile && !["teacher_pro", "premium"].includes(profile.plan ?? "")) {
          await supabase
            .from("profiles")
            .update({ credits: (profile.credits ?? 1) - 1 })
            .eq("id", user.id);
        }
      }

      return NextResponse.json({
        success: true,
        aiConfigured: false,
        message: AI_NOT_CONFIGURED_MESSAGE,
        rateLimit: { remaining: rl.remaining, reset: rl.reset },
        data: { ...mock, title: finalTitle, quiz_id: createdQuizId },
      });
    }

    // --- Real Gemini call (PRO model for GDPT 2018 quality)
    const userPrompt = buildQuizUserPrompt({ subject, grade, count, sourceText });
    const rawText = await generateContent(userPrompt, {
      model: GEMINI_PRO_MODEL,
      system: QUIZ_SYSTEM_PROMPT,
      maxOutputTokens: 4000,
      jsonMode: true,
    });
    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "empty_response" },
        { status: 502 },
      );
    }

    let generated: z.infer<typeof GeneratedQuizSchema>;
    try {
      generated = GeneratedQuizSchema.parse(extractJson(rawText));
    } catch (e: any) {
      console.error("quiz JSON parse failed", e?.message, rawText.slice(0, 400));
      return NextResponse.json(
        {
          success: false,
          error: "ai_parse_failed",
          message: "AI trả về định dạng không hợp lệ. Vui lòng thử lại.",
        },
        { status: 502 },
      );
    }

    // Override echoed-back fields to the user's request values (avoid drift)
    generated.subject = subject;
    generated.grade = grade;
    const finalTitle = title?.trim() || generated.title;

    let createdQuizId: string | null = null;
    if (persist) {
      const persisted = await persistQuiz(supabase, {
        userId: user.id,
        title: finalTitle,
        subject,
        grade,
        sourceContent: sourceText,
        totalQuestions: generated.total_questions,
        estimatedMinutes: generated.estimated_minutes,
        distribution: generated.gdpt_level_distribution,
        questions: generated.questions,
      });
      createdQuizId = persisted?.quizId ?? null;
      if (persisted?.quizId && !bypassCredits && profile && !["teacher_pro", "premium"].includes(profile.plan ?? "")) {
        await supabase
          .from("profiles")
          .update({ credits: (profile.credits ?? 1) - 1 })
          .eq("id", user.id);
      }
    }

    return NextResponse.json({
      success: true,
      aiConfigured: true,
      rateLimit: { remaining: rl.remaining, reset: rl.reset },
      data: { ...generated, title: finalTitle, quiz_id: createdQuizId },
    });
  } catch (error: any) {
    console.error("/api/ai/quiz-generate error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------

async function persistQuiz(
  supabase: ReturnType<typeof createClient>,
  args: {
    userId: string;
    title: string;
    subject: string;
    grade: string;
    sourceContent: string;
    totalQuestions: number;
    estimatedMinutes: number;
    distribution: Record<string, number>;
    questions: Array<z.infer<typeof QuestionSchema>>;
  },
): Promise<{ quizId: string } | null> {
  try {
    const { data: quizRow, error: quizErr } = await supabase
      .from("quizzes")
      .insert({
        creator_id: args.userId,
        title: args.title,
        subject: args.subject,
        grade: args.grade,
        source_type: "ai",
        source_content: args.sourceContent.slice(0, 8000),
        status: "draft",
        gdpt_level_distribution: args.distribution,
        total_questions: args.totalQuestions,
        estimated_minutes: Math.round(args.estimatedMinutes),
      })
      .select("id")
      .single();
    if (quizErr || !quizRow) {
      console.warn("quiz insert failed:", quizErr?.message);
      return null;
    }

    const rows = args.questions.map((q, idx) => ({
      quiz_id: quizRow.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      gdpt_level: q.gdpt_level,
      difficulty: q.difficulty,
      order_index: q.order_index ?? idx + 1,
    }));
    const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
    if (qErr) console.warn("quiz_questions insert failed:", qErr.message);

    return { quizId: quizRow.id };
  } catch (e: any) {
    console.warn("persistQuiz exception:", e?.message);
    return null;
  }
}

export function _supportedCounts() {
  return COUNT_OPTIONS;
}
