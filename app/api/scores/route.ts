import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ScoreBody = z.object({
  child_id: z.string().uuid(),
  subject: z.string().min(1).max(50),
  score: z.number().min(0).max(10),
  exam_type: z.enum(["regular", "midterm", "final", "quiz"]).optional(),
  exam_date: z.string().min(8), // ISO date or yyyy-mm-dd
  term: z.enum(["HK1", "HK2"]).optional().nullable(),
  school_year: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  mood_rating: z.number().int().min(1).max(5).optional().nullable(),
});

const BatchBody = z.object({
  entries: z.array(ScoreBody).min(1).max(20),
});

async function assertOwnsChild(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  childId: string,
) {
  const { data } = await supabase
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("parent_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");
  const weeks = Number(url.searchParams.get("weeks") ?? "4");

  let query = supabase
    .from("score_records")
    .select("id, child_id, subject, score, exam_type, exam_date, term, school_year, notes, mood_rating, created_at")
    .order("exam_date", { ascending: false });

  if (childId) {
    if (!(await assertOwnsChild(supabase, user.id, childId))) {
      return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
    }
    query = query.eq("child_id", childId);
  } else {
    // restrict to user's children
    const { data: kids } = await supabase
      .from("children")
      .select("id")
      .eq("parent_id", user.id);
    const ids = (kids ?? []).map((k) => k.id);
    if (ids.length === 0) return NextResponse.json({ success: true, data: [] });
    query = query.in("child_id", ids);
  }

  if (weeks > 0) {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);
    query = query.gte("exam_date", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query.limit(500);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  // Accept both a single record and a batch
  const isBatch = raw && Array.isArray((raw as { entries?: unknown }).entries);
  const parsed = isBatch ? BatchBody.safeParse(raw) : ScoreBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const entries: z.infer<typeof ScoreBody>[] = isBatch
    ? (parsed.data as z.infer<typeof BatchBody>).entries
    : [parsed.data as z.infer<typeof ScoreBody>];

  // Ownership check for every distinct child_id
  const childIds = Array.from(new Set(entries.map((e) => e.child_id)));
  for (const id of childIds) {
    if (!(await assertOwnsChild(supabase, user.id, id))) {
      return NextResponse.json(
        { success: false, error: "forbidden", childId: id },
        { status: 403 },
      );
    }
  }

  const rows = entries.map((e) => ({
    child_id: e.child_id,
    subject: e.subject,
    score: e.score,
    exam_type: e.exam_type ?? "regular",
    exam_date: e.exam_date,
    term: e.term ?? null,
    school_year: e.school_year ?? null,
    notes: e.notes ?? null,
    mood_rating: e.mood_rating ?? null,
  }));

  const { data, error } = await supabase.from("score_records").insert(rows).select();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}
