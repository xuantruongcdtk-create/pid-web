"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  BookOpen,
  Eye,
  PlusCircle,
  Share2,
  Sparkles,
  Users,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton";
import { QuizShareModal } from "@/components/teacher/QuizShareModal";

interface TeacherQuizRow {
  id: string;
  title: string;
  subject: string;
  grade: string;
  status: string;
  total_questions: number | null;
  estimated_minutes: number | null;
  share_code: string | null;
  is_public: boolean | null;
  view_count: number | null;
  created_at: string;
}

interface ShareTarget {
  shareCode: string;
  title: string;
  subject: string;
  grade: string;
}

export default function TeacherDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  const quizzesQ = useQuery({
    queryKey: ["teacher-quizzes"],
    queryFn: async (): Promise<TeacherQuizRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select(
          "id, title, subject, grade, status, total_questions, estimated_minutes, share_code, is_public, view_count, created_at",
        )
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeacherQuizRow[];
    },
    staleTime: 30_000,
  });

  const statsQ = useQuery({
    queryKey: ["teacher-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { quizzes: 0, attempts: 0, parents: 0 };

      const { data: qs } = await supabase
        .from("quizzes")
        .select("id")
        .eq("creator_id", user.id);
      const quizIds = (qs ?? []).map((q) => q.id);
      if (quizIds.length === 0) return { quizzes: 0, attempts: 0, parents: 0 };

      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("id, child_id")
        .in("quiz_id", quizIds);
      const attemptsList = attempts ?? [];

      const childIds = Array.from(
        new Set(attemptsList.map((a) => a.child_id).filter(Boolean) as string[]),
      );
      let parentCount = 0;
      if (childIds.length > 0) {
        const { data: children } = await supabase
          .from("children")
          .select("parent_id")
          .in("id", childIds);
        const distinctParents = new Set(
          (children ?? []).map((c) => c.parent_id).filter(Boolean),
        );
        parentCount = distinctParents.size;
      }

      return {
        quizzes: quizIds.length,
        attempts: attemptsList.length,
        parents: parentCount,
      };
    },
    staleTime: 30_000,
  });

  const attemptsByQuizQ = useQuery({
    queryKey: ["teacher-attempts-by-quiz", quizzesQ.data?.map((q) => q.id).join(",")],
    enabled: !!quizzesQ.data && quizzesQ.data.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const ids = (quizzesQ.data ?? []).map((q) => q.id);
      if (ids.length === 0) return {};
      const { data } = await supabase
        .from("quiz_attempts")
        .select("quiz_id")
        .in("quiz_id", ids);
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.quiz_id] = (map[r.quiz_id] ?? 0) + 1;
      return map;
    },
    staleTime: 30_000,
  });

  const quizzes = quizzesQ.data ?? [];
  const stats = statsQ.data ?? { quizzes: 0, attempts: 0, parents: 0 };
  const attemptsByQuiz = attemptsByQuizQ.data ?? {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Cổng Giáo viên
          </h2>
          <p className="text-slate-400 text-sm">
            Tạo đề, chia sẻ với phụ huynh và theo dõi tiến độ làm bài của các con
          </p>
        </div>
        <Link
          href="/teacher/upload"
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-600/10",
          )}
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Tạo quiz mới
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={BookOpen}
          accent="indigo"
          label="Tổng quiz đã tạo"
          value={stats.quizzes}
          hint={stats.quizzes === 0 ? "Chưa tạo quiz nào" : "Tất cả trạng thái"}
        />
        <StatCard
          icon={GraduationCap}
          accent="emerald"
          label="Tổng lượt làm bài"
          value={stats.attempts}
          hint={stats.attempts === 0 ? "Chưa có ai làm" : "Tính từ trước đến nay"}
        />
        <StatCard
          icon={Users}
          accent="purple"
          label="Phụ huynh đã reach"
          value={stats.parents}
          hint={stats.parents === 0 ? "Chia sẻ link để bắt đầu" : "Phụ huynh có con đã làm bài"}
        />
      </div>

      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader>
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Quiz của bạn
          </CardTitle>
          <CardDescription className="text-slate-500">
            Bấm "Chia sẻ" để lấy link công khai gửi cho phụ huynh
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quizzesQ.isLoading ? (
            <DashboardSkeleton />
          ) : quizzes.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Chưa có quiz nào"
              description="Tải lên đề cương / SGK dạng PDF — AI sẽ tự động soạn câu hỏi theo Chương trình GDPT 2018."
              ctaHref="/teacher/upload"
              ctaLabel="Tạo quiz đầu tiên"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-900">
                    <th className="py-2 pr-3">Quiz</th>
                    <th className="py-2 pr-3 hidden sm:table-cell">Trạng thái</th>
                    <th className="py-2 pr-3 hidden md:table-cell">Tạo lúc</th>
                    <th className="py-2 pr-3 text-right">
                      <Eye className="h-3.5 w-3.5 inline-block" />
                    </th>
                    <th className="py-2 pr-3 text-right">
                      <TrendingUp className="h-3.5 w-3.5 inline-block" />
                    </th>
                    <th className="py-2 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((q) => {
                    const attempts = attemptsByQuiz[q.id] ?? 0;
                    return (
                      <tr
                        key={q.id}
                        className="border-b border-slate-900/60 last:border-b-0"
                      >
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-100 line-clamp-1">
                            {q.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-400 border-slate-800"
                            >
                              {q.subject} · Lớp {q.grade}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-slate-400 border-slate-800"
                            >
                              {q.total_questions ?? 0} câu
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 pr-3 hidden sm:table-cell">
                          <Badge
                            className={
                              q.status === "published"
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/60"
                                : q.status === "archived"
                                  ? "bg-slate-950 text-slate-400 border border-slate-900"
                                  : "bg-amber-950/80 text-amber-400 border border-amber-900/60"
                            }
                          >
                            {q.status === "published"
                              ? "Đã xuất bản"
                              : q.status === "archived"
                                ? "Lưu trữ"
                                : "Nháp"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 hidden md:table-cell text-slate-400 text-xs">
                          {format(new Date(q.created_at), "dd/MM/yyyy")}
                        </td>
                        <td className="py-3 pr-3 text-right text-slate-300 font-mono">
                          {q.view_count ?? 0}
                        </td>
                        <td className="py-3 pr-3 text-right text-slate-300 font-mono">
                          {attempts}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/quiz/${q.id}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "text-slate-400 hover:text-white",
                              )}
                            >
                              Xem
                            </Link>
                            {q.share_code ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  setShareTarget({
                                    shareCode: q.share_code!,
                                    title: q.title,
                                    subject: q.subject,
                                    grade: q.grade,
                                  })
                                }
                                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                <Share2 className="h-3 w-3 mr-1.5" /> Chia sẻ
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Chưa có mã
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <QuizShareModal
        open={!!shareTarget}
        onOpenChange={(o) => !o && setShareTarget(null)}
        shareCode={shareTarget?.shareCode ?? ""}
        title={shareTarget?.title ?? ""}
        subject={shareTarget?.subject ?? ""}
        grade={shareTarget?.grade ?? ""}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  accent: "indigo" | "emerald" | "purple";
  label: string;
  value: number;
  hint: string;
}) {
  const iconColor = {
    indigo: "text-indigo-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400",
  }[accent];
  const glowColor = {
    indigo: "bg-indigo-600/20",
    emerald: "bg-emerald-600/20",
    purple: "bg-purple-600/20",
  }[accent];

  return (
    <Card className="bg-slate-900/40 border-slate-900 relative overflow-hidden">
      <div
        className={cn(
          "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none",
          glowColor,
        )}
      />
      <CardContent className="p-5 space-y-2 relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="text-3xl font-extrabold text-slate-100 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </CardContent>
    </Card>
  );
}
