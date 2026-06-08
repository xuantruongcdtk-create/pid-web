import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  subject: z.string().min(1).max(50).optional(),
  score: z.number().min(0).max(10).optional(),
  exam_type: z.enum(["regular", "midterm", "final", "quiz"]).optional(),
  exam_date: z.string().optional(),
  term: z.enum(["HK1", "HK2"]).nullable().optional(),
  school_year: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  mood_rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ scoreId: string }> },
) {
  const { scoreId } = await context.params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const parsed = UpdateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // RLS enforces child ownership via children table.
  const { data, error } = await supabase
    .from("score_records")
    .update(parsed.data)
    .eq("id", scoreId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ scoreId: string }> },
) {
  const { scoreId } = await context.params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabase.from("score_records").delete().eq("id", scoreId);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
