import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChildBody = z.object({
  full_name: z.string().min(1).max(120),
  grade: z.string().min(1).max(3),
  school_name: z.string().max(200).optional().nullable(),
  school_level: z.enum(["tieu_hoc", "thcs", "thpt"]).optional().nullable(),
  avatar_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

function gradeToSchoolLevel(grade: string): "tieu_hoc" | "thcs" | "thpt" | null {
  const g = parseInt(grade, 10);
  if (Number.isNaN(g)) return null;
  if (g >= 1 && g <= 5) return "tieu_hoc";
  if (g >= 6 && g <= 9) return "thcs";
  if (g >= 10 && g <= 12) return "thpt";
  return null;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });
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
  const parsed = ChildBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const school_level = body.school_level ?? gradeToSchoolLevel(body.grade);
  const { data, error } = await supabase
    .from("children")
    .insert({
      parent_id: user.id,
      full_name: body.full_name,
      grade: body.grade,
      school_name: body.school_name ?? null,
      school_level,
      avatar_color: body.avatar_color ?? "#0f2554",
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}
