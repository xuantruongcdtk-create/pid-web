import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherShell } from "@/components/teacher/TeacherShell";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Skip role check in dev when Supabase isn't configured — lets the page
  // render without auth so the UI can still be inspected.
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabase && !user) {
    redirect("/login?next=/teacher");
  }

  let teacherName: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.role !== "teacher" && profile.role !== "admin") {
      redirect("/");
    }
    teacherName = profile?.full_name ?? user.email ?? undefined;
  }

  return <TeacherShell teacherName={teacherName}>{children}</TeacherShell>;
}
