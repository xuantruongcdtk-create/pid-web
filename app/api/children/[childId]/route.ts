import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  full_name: z.string().min(1).max(120).optional(),
  grade: z.string().min(1).max(3).optional(),
  school_name: z.string().max(200).nullable().optional(),
  school_level: z.enum(["tieu_hoc", "thcs", "thpt"]).nullable().optional(),
  avatar_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ childId: string }> },
) {
  const { childId } = await context.params;
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
  const { data, error } = await supabase
    .from("children")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", childId)
    .eq("parent_id", user.id) // belt-and-suspenders next to RLS
    .select()
    .single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ childId: string }> },
) {
  const { childId } = await context.params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const { error } = await supabase
    .from("children")
    .delete()
    .eq("id", childId)
    .eq("parent_id", user.id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
