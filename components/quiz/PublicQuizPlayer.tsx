"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  GraduationCap,
  Play,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PublicQuizQuestion {
  id: string | number;
  question_text: string;
  options: Array<{ key: string; text: string }>;
  correct_answer: string;
  gdpt_level?: string | null;
  explanation?: string | null;
}

export interface PublicQuizData {
  id: string;
  share_code: string;
  title: string;
  subject: string;
  grade: string;
  questions: PublicQuizQuestion[];
  teacher_name?: string | null;
  /** Referral teacher id, embedded in signup CTA. */
  creator_id?: string | null;
}

interface Props {
  quiz: PublicQuizData;
  socialProof?: number;
}

const PARENT_PROOF_FLOOR = 1200;

export function PublicQuizPlayer({ quiz, socialProof }: Props) {
  const totalProof = Math.max(PARENT_PROOF_FLOOR, socialProof ?? 0);

  // Three phases: gate → playing → result
  const [phase, setPhase] = useState<"gate" | "playing" | "done">("gate");
  const [studentName, setStudentName] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = quiz.questions.length;
  const current = quiz.questions[currentIdx];

  // ---- Keyboard ----------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      const idx = keyMap[e.key];
      if (idx !== undefined) {
        const opt = current?.options[idx];
        if (opt) {
          e.preventDefault();
          setAnswers((prev) => ({ ...prev, [String(current.id)]: opt.key }));
        }
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx((i) => Math.min(total - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, current, total]);

  // ---- Submit & stats ----------------------------------------------------

  const stats = useMemo(() => {
    let correct = 0;
    const byLevel: Record<string, { correct: number; total: number }> = {};
    for (const q of quiz.questions) {
      const lvl = q.gdpt_level ?? "khac";
      byLevel[lvl] ??= { correct: 0, total: 0 };
      byLevel[lvl].total += 1;
      if (answers[String(q.id)] === q.correct_answer) {
        correct += 1;
        byLevel[lvl].correct += 1;
      }
    }
    const score10 = total > 0 ? (correct / total) * 10 : 0;
    return { correct, total, byLevel, score10 };
  }, [quiz.questions, answers, total]);

  async function submit() {
    setPhase("done");
    // Fire-and-forget — public attempt, no auth, no DB write required for now.
    void fetch(`/api/quiz/${quiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, studentName, shareCode: quiz.share_code }),
    }).catch(() => undefined);
  }

  // ---- Render ------------------------------------------------------------

  if (phase === "gate") {
    return (
      <GateView
        quiz={quiz}
        studentName={studentName}
        setStudentName={setStudentName}
        onStart={() => {
          if (!studentName.trim()) return;
          setPhase("playing");
        }}
      />
    );
  }

  if (phase === "done") {
    return (
      <ResultView
        quiz={quiz}
        studentName={studentName}
        stats={stats}
        socialProof={totalProof}
      />
    );
  }

  // playing
  const selectedKey = answers[String(current.id)] ?? null;
  return (
    <main className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
        <PublicHeader teacherName={quiz.teacher_name} />

        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Câu {currentIdx + 1} / {total}
              </span>
              <span className="truncate ml-3">{quiz.title}</span>
            </div>
            <Progress
              value={((currentIdx + 1) / total) * 100}
              className="h-1.5 bg-slate-200 dark:bg-slate-900"
              indicatorClassName="bg-indigo-500"
            />

            <p className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {current.question_text}
            </p>

            <div className="space-y-2">
              {current.options.map((opt, oIdx) => {
                const isSelected = selectedKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [String(current.id)]: opt.key,
                      }))
                    }
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3",
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500/60 text-indigo-900 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 h-7 w-7 rounded-md font-bold text-xs flex items-center justify-center",
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-500",
                      )}
                    >
                      {opt.key}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                    <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
                      phím {oIdx + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Câu trước
              </Button>
              {currentIdx === total - 1 ? (
                <Button
                  onClick={submit}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold min-w-32"
                >
                  Nộp bài <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentIdx((i) => i + 1)}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90"
                >
                  Câu sau (Enter) <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-500">
          Phím tắt: <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-900 rounded">1–4</kbd>{" "}
          chọn đáp án ·{" "}
          <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-900 rounded">Enter</kbd> câu sau
        </p>
      </div>
    </main>
  );
}

// ============================================================================
// Gate (collect student name before starting) — kept minimal to honour the
// "no upsell during quiz" rule.
// ============================================================================

function GateView({
  quiz,
  studentName,
  setStudentName,
  onStart,
}: {
  quiz: PublicQuizData;
  studentName: string;
  setStudentName: (s: string) => void;
  onStart: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 space-y-5">
          <div className="flex justify-center">
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
              Mã đề: {quiz.share_code}
            </Badge>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {quiz.title}
            </h1>
            <p className="text-sm text-slate-500">
              {quiz.subject} · Lớp {quiz.grade}
              {quiz.teacher_name ? ` · ${quiz.teacher_name}` : ""}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Bộ quiz này được giáo viên chia sẻ qua PID. Làm bài miễn phí, không cần đăng ký.
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onStart();
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Họ và tên học sinh"
              required
              minLength={2}
              className="bg-white dark:bg-slate-950/40"
            />
            <Button
              type="submit"
              disabled={studentName.trim().length < 2}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              <Play className="h-4 w-4 mr-2 fill-current" /> Bắt đầu làm bài
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// ============================================================================
// Result — full-screen, count-up score, signup CTA (this is the moment the
// upsell IS allowed — quiz already finished).
// ============================================================================

function ResultView({
  quiz,
  studentName,
  stats,
  socialProof,
}: {
  quiz: PublicQuizData;
  studentName: string;
  stats: {
    correct: number;
    total: number;
    score10: number;
    byLevel: Record<string, { correct: number; total: number }>;
  };
  socialProof: number;
}) {
  const ref = quiz.creator_id ?? "";
  const signupHref = `/register?ref=${encodeURIComponent(ref)}&subject=${encodeURIComponent(
    quiz.subject,
  )}&source=quiz_share`;

  // Count-up animation
  const [displayScore, setDisplayScore] = useState(0);
  const animatedRef = useRef(false);
  useEffect(() => {
    if (animatedRef.current) return;
    animatedRef.current = true;
    const target = stats.score10;
    const durationMs = 1200;
    const start = performance.now();
    let raf = 0;
    function step(t: number) {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stats.score10]);

  const isExcellent = stats.score10 >= 8;
  const isPass = stats.score10 >= 5;

  return (
    <main className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg space-y-5">
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <div className="bg-white dark:bg-slate-900 rounded-full h-28 w-28 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                  {displayScore.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">/ 10</span>
              </div>
            </div>

            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {isExcellent ? "🎉 Xuất sắc!" : isPass ? "✨ Khá tốt!" : "Cần ôn thêm nhé"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {studentName} đã hoàn thành quiz {quiz.subject} lớp {quiz.grade}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              {Object.entries(stats.byLevel).map(([lvl, v]) => {
                const label = LEVEL_LABEL[lvl as keyof typeof LEVEL_LABEL] ?? lvl;
                return (
                  <div
                    key={lvl}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {label}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {v.correct}/{v.total} đúng
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              Đúng <strong className="text-slate-800 dark:text-slate-100">{stats.correct}</strong>{" "}
              / {stats.total} câu
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-900/60">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100">
              Xem phân tích chi tiết + theo dõi tiến bộ của con
            </h2>
            <p className="text-xs text-slate-500">
              Miễn phí · Không cần thẻ tín dụng · Hủy bất cứ lúc nào
            </p>
            <Link
              href={signupHref}
              className="inline-flex items-center justify-center w-full rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-4 shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition-colors"
            >
              <GraduationCap className="h-4 w-4 mr-2" /> Đăng ký PID — Miễn phí
            </Link>
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="ml-1">
                Hơn {socialProof.toLocaleString("vi-VN")} phụ huynh đang dùng PID mỗi tuần
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// ============================================================================

function PublicHeader({ teacherName }: { teacherName?: string | null }) {
  return (
    <header className="flex items-center justify-between py-2">
      <Link href="/" className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <span className="font-extrabold text-lg tracking-tight">PID</span>
      </Link>
      {teacherName && (
        <span className="text-xs text-slate-500">
          Quiz được tạo bởi <strong className="text-slate-700 dark:text-slate-200">{teacherName}</strong>
        </span>
      )}
    </header>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
  khac: "Khác",
};
