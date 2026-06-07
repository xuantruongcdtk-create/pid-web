import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizPlayer, type QuizPlayerData, type QuizPlayerQuestion } from "@/components/quiz/QuizPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const FALLBACK_QUIZ: QuizPlayerData = {
  id: "demo",
  title: "Khảo sát hàm số bậc ba (mẫu)",
  subject: "Toán học",
  questions: [
    {
      id: 1,
      question_text: "Cho hàm số y = x³ - 3x² + 2. Mệnh đề nào sau đây đúng?",
      options: [
        { key: "A", text: "Hàm số nghịch biến trên (0; 2)" },
        { key: "B", text: "Hàm số đồng biến trên (0; 2)" },
        { key: "C", text: "Hàm số nghịch biến trên (-∞; 0)" },
        { key: "D", text: "Hàm số nghịch biến trên (2; +∞)" },
      ],
      correct_answer: "A",
      explanation:
        "y' = 3x² − 6x; y' = 0 ⇔ x = 0 hoặc x = 2. Trên khoảng (0; 2) thì y' < 0 nên hàm số nghịch biến.",
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
      explanation:
        "y' = −3x² + 3; y' = 0 ⇔ x = ±1. Bảng biến thiên cho thấy y' đổi dấu từ + sang − tại x = 1.",
      gdpt_level: "van_dung",
    },
  ],
};

export default async function QuizTakePage({
  params,
}: {
  params: Promise<{ quizId: string }> | { quizId: string };
}) {
  const { quizId } = "then" in params ? await params : params;

  const supabase = createClient();

  // Fetch quiz + ordered questions
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, subject, status, is_public, creator_id")
    .eq("id", quizId)
    .maybeSingle();

  if (!quiz) {
    // Treat "demo" as fallback so the route works without a real DB row.
    if (quizId === "demo" || quizId === "q1") {
      return <QuizPlayer quiz={FALLBACK_QUIZ} />;
    }
    notFound();
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, options, correct_answer, explanation, gdpt_level, order_index")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Link
          href="/quiz"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-slate-400 hover:text-white",
          )}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại thư viện
        </Link>
        <Card className="bg-slate-900/40 border-slate-900">
          <CardContent className="p-10 text-center space-y-2">
            <h3 className="text-lg font-bold text-slate-100">Bộ đề chưa có câu hỏi</h3>
            <p className="text-sm text-slate-400">
              Vui lòng vào trang chỉnh sửa để thêm câu hỏi cho đề "{quiz.title}".
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data: QuizPlayerData = {
    id: quiz.id,
    title: quiz.title,
    subject: quiz.subject,
    questions: questions.map(
      (q): QuizPlayerQuestion => ({
        id: q.id,
        question_text: q.question_text,
        options: Array.isArray(q.options) ? (q.options as QuizPlayerQuestion["options"]) : [],
        correct_answer: q.correct_answer ?? "",
        explanation: q.explanation,
        gdpt_level: q.gdpt_level,
      }),
    ),
  };

  return <QuizPlayer quiz={data} />;
}
