import { NextResponse } from "next/server";
import { z } from "zod";
import { startOfWeek, formatISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { generateContent, GEMINI_PRO_MODEL } from "@/lib/ai/gemini";
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from "@/lib/ai/prompts/analyze";
import { AI_NOT_CONFIGURED_MESSAGE, hasGeminiKey, mockAnalysis } from "@/lib/ai/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  childId: z.string().uuid(),
  periodDays: z.number().int().min(7).max(180).optional().default(28),
  force: z.boolean().optional().default(false),
});

const AnalysisSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).min(0).max(8),
  weaknesses: z.array(z.string()).min(0).max(8),
  recommendations: z.array(z.string()).min(0).max(8),
  burnoutRisk: z.enum(["low", "medium", "high"]),
  alerts: z
    .array(
      z.object({
        type: z.enum(["warning", "success", "info"]),
        title: z.string().min(1),
        description: z.string().optional().default(""),
      }),
    )
    .max(6)
    .default([]),
  dnaUpdate: z
    .object({
      visual: z.number().min(0).max(100),
      auditory: z.number().min(0).max(100),
      kinesthetic: z.number().min(0).max(100),
      reading: z.number().min(0).max(100),
    })
    .nullable()
    .optional(),
});

type Analysis = z.infer<typeof AnalysisSchema>;

function extractJson(raw: string): unknown {
  // Strip markdown fences if model added them despite instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { childId, periodDays, force } = parsed.data;

    const supabase = createClient();

    // --- Auth gate
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // --- Child lookup (RLS ensures it must belong to the user)
    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("id, full_name, grade, dna_profile, parent_id")
      .eq("id", childId)
      .maybeSingle();
    if (childErr) throw childErr;
    if (!child) {
      return NextResponse.json({ success: false, error: "Child not found" }, { status: 404 });
    }

    // --- Cache check: weekly_summary for current week
    const weekStart = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), {
      representation: "date",
    });

    if (!force) {
      const { data: cached } = await supabase
        .from("weekly_summaries")
        .select("ai_analysis, avg_score, mood_avg, week_start, created_at")
        .eq("child_id", childId)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (cached?.ai_analysis) {
        return NextResponse.json({
          success: true,
          cached: true,
          data: cached.ai_analysis,
          weekStart,
        });
      }
    }

    // --- Fetch recent scores
    const since = formatISO(subDays(new Date(), periodDays), { representation: "date" });
    const { data: scores, error: scoresErr } = await supabase
      .from("score_records")
      .select("subject, score, exam_type, exam_date, mood_rating, notes")
      .eq("child_id", childId)
      .gte("exam_date", since)
      .order("exam_date", { ascending: false })
      .limit(60);
    if (scoresErr) throw scoresErr;

    if (!scores || scores.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "no_data",
          message: "Chưa có điểm số nào trong khoảng thời gian được chọn.",
        },
        { status: 422 },
      );
    }

    // --- Mock fallback when Gemini key isn't configured
    if (!hasGeminiKey()) {
      const analysis = mockAnalysis(child.full_name);
      // Still cache + emit alerts so the UI experiences the full flow.
      const avgScore =
        scores.reduce((acc, s) => acc + Number(s.score ?? 0), 0) / Math.max(scores.length, 1);
      const moodScores = scores.filter((s) => typeof s.mood_rating === "number");
      const moodAvg = moodScores.length
        ? moodScores.reduce((acc, s) => acc + Number(s.mood_rating ?? 0), 0) / moodScores.length
        : null;
      await supabase.from("weekly_summaries").upsert(
        {
          child_id: childId,
          week_start: weekStart,
          avg_score: Number(avgScore.toFixed(2)),
          mood_avg: moodAvg !== null ? Number(moodAvg.toFixed(1)) : null,
          ai_analysis: analysis,
        },
        { onConflict: "child_id,week_start" },
      );
      if (analysis.dnaUpdate) {
        await supabase
          .from("children")
          .update({ dna_profile: analysis.dnaUpdate })
          .eq("id", childId);
      }
      return NextResponse.json({
        success: true,
        cached: false,
        aiConfigured: false,
        message: AI_NOT_CONFIGURED_MESSAGE,
        data: analysis,
        weekStart,
      });
    }

    const userPrompt = buildAnalyzeUserPrompt({
      childName: child.full_name,
      grade: child.grade,
      scores,
      previousDnaProfile: (child.dna_profile as Record<string, number> | null) ?? null,
    });

    const rawText = await generateContent(userPrompt, {
      model: GEMINI_PRO_MODEL,
      system: ANALYZE_SYSTEM_PROMPT,
      maxOutputTokens: 1600,
      jsonMode: true,
    });
    if (!rawText) throw new Error("Gemini returned empty content");

    let analysis: Analysis;
    try {
      const parsedJson = extractJson(rawText);
      analysis = AnalysisSchema.parse(parsedJson);
    } catch (e: any) {
      console.error("AI JSON parse failed:", e?.message, "raw:", rawText.slice(0, 400));
      return NextResponse.json(
        { success: false, error: "ai_parse_failed", message: e?.message ?? "Parse error" },
        { status: 502 },
      );
    }

    // --- Aggregate metrics for the cache row
    const avgScore =
      scores.reduce((acc, s) => acc + Number(s.score ?? 0), 0) / Math.max(scores.length, 1);
    const moodScores = scores.filter((s) => typeof s.mood_rating === "number");
    const moodAvg = moodScores.length
      ? moodScores.reduce((acc, s) => acc + Number(s.mood_rating ?? 0), 0) / moodScores.length
      : null;

    // --- Upsert weekly_summary
    const { error: upsertErr } = await supabase.from("weekly_summaries").upsert(
      {
        child_id: childId,
        week_start: weekStart,
        avg_score: Number(avgScore.toFixed(2)),
        mood_avg: moodAvg !== null ? Number(moodAvg.toFixed(1)) : null,
        ai_analysis: analysis,
      },
      { onConflict: "child_id,week_start" },
    );
    if (upsertErr) console.warn("weekly_summaries upsert warning:", upsertErr.message);

    // --- Insert generated alerts (best-effort, ignore failures)
    if (analysis.alerts.length > 0) {
      const rows = analysis.alerts.map((a) => ({
        child_id: childId,
        type: a.type,
        title: a.title,
        description: a.description ?? "",
      }));
      const { error: alertsErr } = await supabase.from("alerts").insert(rows);
      if (alertsErr) console.warn("alerts insert warning:", alertsErr.message);
    }

    // --- Update child DNA profile if Claude provided one
    if (analysis.dnaUpdate) {
      const { error: dnaErr } = await supabase
        .from("children")
        .update({ dna_profile: analysis.dnaUpdate })
        .eq("id", childId);
      if (dnaErr) console.warn("children dna_profile update warning:", dnaErr.message);
    }

    return NextResponse.json({
      success: true,
      cached: false,
      data: analysis,
      weekStart,
      stats: { avgScore: Number(avgScore.toFixed(2)), moodAvg, scoreCount: scores.length },
    });
  } catch (error: any) {
    console.error("/api/ai/analyze error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
