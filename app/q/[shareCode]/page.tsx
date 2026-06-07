import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  PublicQuizPlayer,
  type PublicQuizData,
  type PublicQuizQuestion,
} from "@/components/quiz/PublicQuizPlayer";

export const dynamic = "force-dynamic";

// Use the service-role client when available so we can read public quizzes
// without the visitor needing a Supabase session. RLS still applies to writes.
function readClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && !serviceKey.startsWith("your_")) {
    return createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  // Fallback to the anon server client (works if quiz is_public = true).
  return createServerClient();
}

const DEMO_QUIZ: PublicQuizData = {
  id: "demo-public",
  share_code: "DEMO",
  title: "Khảo sát hàm số bậc ba (Mẫu công khai)",
  subject: "Toán",
  grade: "11",
  teacher_name: "GV mẫu",
  creator_id: null,
  questions: [
    {
      id: 1,
      question_text: "Cho hàm số y = x³ − 3x² + 2. Mệnh đề nào sau đây đúng?",
      options: [
        { key: "A", text: "Hàm số nghịch biến trên (0; 2)" },
        { key: "B", text: "Hàm số đồng biến trên (0; 2)" },
        { key: "C", text: "Hàm số nghịch biến trên (−∞; 0)" },
        { key: "D", text: "Hàm số nghịch biến trên (2; +∞)" },
      ],
      correct_answer: "A",
      gdpt_level: "thong_hieu",
    },
    {
      id: 2,
      question_text: "Hàm số y = −x³ + 3x − 5 đạt cực đại tại x = ?",
      options: [
        { key: "A", text: "x = −1" },
        { key: "B", text: "x = 1" },
        { key: "C", text: "x = 2" },
        { key: "D", text: "x = 0" },
      ],
      correct_answer: "B",
      gdpt_level: "van_dung",
    },
  ],
};

export default async function PublicSharedQuizPage({
  params,
}: {
  params: Promise<{ shareCode: string }> | { shareCode: string };
}) {
  const { shareCode } = "then" in params ? await params : params;
  const code = shareCode.toUpperCase();

  // Bypass DB entirely for the demo route so the flow is browseable without
  // any database setup.
  if (code === "DEMO" || code === "TEST" || code === "MAU") {
    return <PublicQuizPlayer quiz={DEMO_QUIZ} socialProof={1200} />;
  }

  const supabase = readClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, share_code, title, subject, grade, creator_id, view_count",
    )
    .eq("share_code", code)
    .maybeSingle();

  if (!quiz) {
    return <NotFoundView shareCode={code} />;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, options, correct_answer, gdpt_level, explanation, order_index")
    .eq("quiz_id", quiz.id)
    .order("order_index", { ascending: true });

  if (!questions || questions.length === 0) {
    return <NotFoundView shareCode={code} message="Bộ đề này chưa có câu hỏi nào." />;
  }

  // Increment view_count (best-effort; ignore failure)
  void supabase
    .from("quizzes")
    .update({ view_count: (quiz.view_count ?? 0) + 1 })
    .eq("id", quiz.id);

  // Fetch teacher name (best effort)
  let teacherName: string | null = null;
  if (quiz.creator_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", quiz.creator_id)
      .maybeSingle();
    teacherName = profile?.full_name ?? null;
  }

  // Social proof = premium-user count (rounded to nearest 100, floor 1200)
  let socialProof = 1200;
  try {
    const { count } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .in("plan", ["premium", "teacher_pro"]);
    socialProof = Math.max(1200, Math.floor((count ?? 0) / 100) * 100);
  } catch {
    /* ignore */
  }

  const data: PublicQuizData = {
    id: quiz.id,
    share_code: quiz.share_code,
    title: quiz.title,
    subject: quiz.subject,
    grade: quiz.grade,
    creator_id: quiz.creator_id ?? null,
    teacher_name: teacherName,
    questions: questions.map(
      (q): PublicQuizQuestion => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? (q.options as PublicQuizQuestion["options"]) : [],
        correct_answer: q.correct_answer ?? "",
        gdpt_level: q.gdpt_level,
        explanation: q.explanation,
      }),
    ),
  };

  return <PublicQuizPlayer quiz={data} socialProof={socialProof} />;
}

function NotFoundView({ shareCode, message }: { shareCode: string; message?: string }) {
  return (
    <main className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Không tìm thấy quiz
        </h1>
        <p className="text-sm text-slate-500">
          {message ?? `Mã chia sẻ "${shareCode}" không tồn tại hoặc đã bị xoá.`}
        </p>
        <Link
          href="/"
          className="inline-block text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
        >
          Về trang chủ →
        </Link>
      </div>
    </main>
  );
}
