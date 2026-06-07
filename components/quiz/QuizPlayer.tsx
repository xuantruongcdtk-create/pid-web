"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  HelpCircle,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuizPlayerQuestion {
  id: string | number;
  question_text: string;
  options: Array<{ key: string; text: string }>;
  correct_answer: string;
  explanation?: string | null;
  gdpt_level?: string | null;
}

export interface QuizPlayerData {
  id: string;
  title: string;
  subject: string;
  questions: QuizPlayerQuestion[];
}

const AUTOSAVE_INTERVAL_MS = 30_000;
const draftKey = (quizId: string) => `pid:quiz-draft:${quizId}`;

interface Draft {
  quizId: string;
  answers: Record<string, string>;
  currentIdx: number;
  updatedAt: number;
}

export function QuizPlayer({ quiz }: { quiz: QuizPlayerData }) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirtyRef = useRef(false);
  const lastSavedRef = useRef<number | null>(null);

  const total = quiz.questions.length;
  const current = quiz.questions[currentIdx];

  // ---- Restore draft on mount -------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(quiz.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      if (draft.quizId !== quiz.id) return;
      if (Object.keys(draft.answers || {}).length > 0) {
        setAnswers(draft.answers);
        setCurrentIdx(Math.min(draft.currentIdx ?? 0, total - 1));
        toast("Đã khôi phục bài làm dang dở", {
          description: `Cập nhật lần cuối ${new Date(draft.updatedAt).toLocaleString("vi-VN")}`,
        });
      }
    } catch {
      // ignore corrupt drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.id]);

  // ---- Autosave every 30s if dirty --------------------------------------
  const saveDraft = useCallback(() => {
    if (submitted) return;
    if (!dirtyRef.current) return;
    try {
      const draft: Draft = {
        quizId: quiz.id,
        answers,
        currentIdx,
        updatedAt: Date.now(),
      };
      localStorage.setItem(draftKey(quiz.id), JSON.stringify(draft));
      dirtyRef.current = false;
      lastSavedRef.current = Date.now();
    } catch {
      // quota / unavailable — skip silently
    }
  }, [quiz.id, answers, currentIdx, submitted]);

  useEffect(() => {
    const id = setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [saveDraft]);

  // Save on tab hide / page unload
  useEffect(() => {
    const onHide = () => saveDraft();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [saveDraft]);

  // ---- Navigation guard: warn on close/refresh while answering ---------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (submitted) return;
      if (Object.keys(answers).length === 0) return;
      // Most browsers ignore custom strings; setting any string triggers prompt.
      e.preventDefault();
      e.returnValue = "Bài làm chưa nộp — rời trang sẽ mất tiến độ?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitted, answers]);

  // ---- Selection --------------------------------------------------------
  const selectOption = useCallback(
    (key: string) => {
      if (submitted) return;
      const qid = String(current.id);
      setAnswers((prev) => {
        if (prev[qid] === key) return prev;
        dirtyRef.current = true;
        return { ...prev, [qid]: key };
      });
    },
    [submitted, current],
  );

  const goNext = useCallback(() => {
    setCurrentIdx((i) => {
      if (i < total - 1) {
        dirtyRef.current = true;
        return i + 1;
      }
      return i;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIdx((i) => {
      if (i > 0) {
        dirtyRef.current = true;
        return i - 1;
      }
      return i;
    });
  }, []);

  // ---- Keyboard shortcuts: 1/2/3/4 select, Enter advance ---------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submitted) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      const idx = keyMap[e.key];
      if (idx !== undefined) {
        const opt = current.options[idx];
        if (opt) {
          e.preventDefault();
          selectOption(opt.key);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, selectOption, goNext, goPrev, submitted]);

  // ---- Submit -----------------------------------------------------------
  const stats = useMemo(() => {
    let correct = 0;
    for (const q of quiz.questions) {
      if (answers[String(q.id)] === q.correct_answer) correct += 1;
    }
    const pct = total > 0 ? (correct / total) * 100 : 0;
    return { correct, total, percent: pct, score10: (correct / total) * 10 };
  }, [quiz.questions, answers, total]);

  async function handleSubmit() {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json().catch(() => ({}));
      // Always advance UI — server endpoint is best-effort for now.
      void json;
      setSubmitted(true);
      try {
        localStorage.removeItem(draftKey(quiz.id));
      } catch {
        /* ignore */
      }
      toast.success(`Đã chấm bài: ${stats.score10.toFixed(1)} / 10`);
    } catch (e: any) {
      // Still show local result so the student isn't stuck.
      setSubmitted(true);
      toast.warning("Không nộp được lên server, hiển thị kết quả tại chỗ.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- UI ---------------------------------------------------------------

  const selectedKey = answers[String(current.id)] ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center gap-3">
        <Link
          href="/quiz"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-slate-400 hover:text-white",
          )}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại thư viện
        </Link>
        <Badge className="bg-indigo-950 text-indigo-400 border border-indigo-900">
          {quiz.subject}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-slate-900/40 border-slate-900">
            <CardHeader className="pb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>
                  Câu hỏi {currentIdx + 1} / {total}
                </span>
                <span className="truncate ml-3">{quiz.title}</span>
              </div>
              <Progress
                value={((currentIdx + 1) / total) * 100}
                className="h-1 bg-slate-950"
                indicatorClassName="bg-indigo-500"
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-slate-100 font-semibold text-base md:text-lg">
                {current.question_text}
              </p>

              <div className="space-y-3">
                {current.options.map((opt, oIdx) => {
                  const isSelected = selectedKey === opt.key;
                  const isCorrect = opt.key === current.correct_answer;
                  const showCorrect = submitted && isCorrect;
                  const showWrong = submitted && isSelected && !isCorrect;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => selectOption(opt.key)}
                      disabled={submitted}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-center justify-between text-sm",
                        showCorrect && "bg-emerald-950/20 border-emerald-500/50 text-emerald-300",
                        showWrong && "bg-rose-950/20 border-rose-500/50 text-rose-300",
                        !submitted && isSelected &&
                          "bg-indigo-950/40 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-600/5",
                        !submitted && !isSelected &&
                          "bg-slate-950/50 border-slate-850 text-slate-300 hover:border-slate-700 hover:bg-slate-900/40",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "shrink-0 h-7 w-7 rounded-md font-bold text-xs flex items-center justify-center",
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-900 text-slate-400",
                          )}
                        >
                          {opt.key}
                        </span>
                        <span className="truncate">{opt.text}</span>
                      </div>
                      {showCorrect && <Check className="h-4 w-4 text-emerald-400 shrink-0 ml-2" />}
                      {showWrong && <X className="h-4 w-4 text-rose-400 shrink-0 ml-2" />}
                      <span className="hidden sm:inline text-[10px] text-slate-500 font-mono ml-2 shrink-0">
                        phím {oIdx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {submitted && current.explanation && (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-900 space-y-2 text-xs md:text-sm">
                  <h5 className="font-bold text-indigo-400 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4" /> Giải thích
                  </h5>
                  <p className="text-slate-400 leading-relaxed">{current.explanation}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-slate-950 p-4">
              <Button
                variant="outline"
                disabled={currentIdx === 0}
                onClick={goPrev}
                className="border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Câu trước
              </Button>
              {currentIdx === total - 1 ? (
                !submitted ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold min-w-28"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" /> Nộp bài
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push("/quiz")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Về thư viện <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )
              ) : (
                <Button
                  variant="outline"
                  onClick={goNext}
                  className="border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-900"
                >
                  Câu sau (Enter) <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-4">
          {submitted && (
            <Card className="bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 border-slate-850/80">
              <CardContent className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Award className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200 text-base">Kết quả bài làm</h4>
                  <p className="text-xs text-slate-500">Tự động chấm theo đáp án</p>
                </div>
                <div className="text-3xl font-extrabold text-slate-100">
                  {stats.score10.toFixed(1)}{" "}
                  <span className="text-xs text-slate-500">/ 10</span>
                </div>
                <p className="text-xs text-slate-400">
                  Đúng {stats.correct} / {stats.total} câu ({stats.percent.toFixed(0)}%)
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-900/40 border-slate-900">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-slate-300 text-xs uppercase tracking-wider">
                Danh sách câu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-5 sm:grid-cols-4 gap-2">
                {quiz.questions.map((q, idx) => {
                  const qid = String(q.id);
                  const isSelected = currentIdx === idx;
                  const isAnswered = answers[qid] !== undefined;
                  const isCorrect = submitted && answers[qid] === q.correct_answer;
                  const isWrong = submitted && isAnswered && answers[qid] !== q.correct_answer;
                  return (
                    <button
                      key={qid}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={cn(
                        "h-9 w-9 text-xs font-semibold rounded-lg flex items-center justify-center border transition-all duration-300",
                        isCorrect && "bg-emerald-950/20 border-emerald-500/60 text-emerald-400",
                        isWrong && "bg-rose-950/20 border-rose-500/60 text-rose-400",
                        !submitted && isSelected &&
                          "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10",
                        !submitted && !isSelected && isAnswered &&
                          "bg-indigo-950/20 border-indigo-900/60 text-indigo-400",
                        !submitted && !isSelected && !isAnswered &&
                          "bg-slate-950/50 border-slate-850 text-slate-400 hover:bg-slate-900",
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              {!submitted && (
                <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                  Phím tắt: <kbd className="px-1 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px]">1–4</kbd> chọn đáp án ·{" "}
                  <kbd className="px-1 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px]">Enter / →</kbd> câu sau ·{" "}
                  <kbd className="px-1 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px]">←</kbd> câu trước
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
