import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  answers: z.record(z.string(), z.string()),
  childId: z.string().uuid().optional(),
  shareCode: z.string().optional(),
  studentName: z.string().optional(),
  timeSpentSeconds: z.number().int().nonnegative().optional(),
});

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  try {
    const { quizId } = await context.params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { answers, childId, shareCode, timeSpentSeconds } = parsed.data;

    // We need authoritative correct_answers from the DB regardless of whether
    // the submitter is authenticated (public share path) — use service-role.
    const sb = process.env.SUPABASE_SERVICE_ROLE_KEY ? serviceClient() : createClient();

    const { data: questions, error: qErr } = await sb
      .from("quiz_questions")
      .select("id, correct_answer, gdpt_level")
      .eq("quiz_id", quizId);

    if (qErr) {
      return NextResponse.json({ success: false, error: qErr.message }, { status: 500 });
    }
    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "quiz_has_no_questions" },
        { status: 404 },
      );
    }

    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] && answers[q.id] === q.correct_answer) correct += 1;
    }
    const total = questions.length;
    const scorePct = total > 0 ? Math.round((correct / total) * 10_000) / 100 : 0;

    // Optional: write to quiz_attempts if we have a child_id (and the caller
    // has rights via auth client). Public/anonymous attempts are returned but
    // not persisted in this version.
    let attemptId: string | null = null;
    if (childId) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: row } = await supabase
          .from("quiz_attempts")
          .insert({
            quiz_id: quizId,
            child_id: childId,
            answers,
            score: scorePct,
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpentSeconds ?? null,
          })
          .select("id")
          .single();
        attemptId = row?.id ?? null;
      }
    }

    // Bump view_count when arriving from a public share
    if (shareCode && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      void sb.rpc("noop").then(() => undefined); // placeholder for future analytics
    }

    return NextResponse.json({
      success: true,
      data: {
        quizId,
        attemptId,
        score: scorePct, // 0-100
        score10: Math.round((correct / total) * 100) / 10,
        correctCount: correct,
        totalQuestions: total,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("/api/quiz/[quizId]/submit error:", error);
    return NextResponse.json(
      { success: false, error: "internal", message: error?.message ?? "Unknown" },
      { status: 500 },
    );
  }
}
