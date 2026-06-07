"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Clock, GraduationCap, Play, Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";

interface QuizRow {
  id: string;
  title: string;
  subject: string;
  grade: string;
  status: string;
  total_questions: number | null;
  estimated_minutes: number | null;
  source_type: string | null;
  is_public: boolean | null;
  created_at: string;
}

const SUBJECT_FILTER = ["all", "Toán", "Văn", "Anh", "Lý", "Hóa", "Sinh", "Sử", "Địa"];

export default function QuizLibraryPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [query, setQuery] = React.useState("");
  const [subjectFilter, setSubjectFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "draft" | "published">("all");

  const quizzesQ = useQuery({
    queryKey: ["quiz-library"],
    queryFn: async (): Promise<QuizRow[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select(
          "id, title, subject, grade, status, total_questions, estimated_minutes, source_type, is_public, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuizRow[];
    },
    staleTime: 30_000,
  });

  const allQuizzes = quizzesQ.data ?? [];
  const filtered = allQuizzes.filter((q) => {
    if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      if (!q.title.toLowerCase().includes(needle) && !q.subject.toLowerCase().includes(needle))
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Thư viện bài tập & Đề thi
          </h2>
          <p className="text-slate-400 text-sm">
            Kho câu hỏi cá nhân hoá do bạn tạo hoặc nhận từ giáo viên
          </p>
        </div>
        <Link
          href="/quiz/create"
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/10",
          )}
        >
          <Plus className="h-4 w-4 mr-2" /> Tạo quiz bằng AI
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-slate-900/20 p-2 rounded-xl border border-slate-900">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề hoặc môn học…"
              className="pl-10 bg-slate-950/40 border-slate-850 text-slate-200 placeholder:text-slate-650 focus-visible:ring-indigo-600"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_FILTER.map((s) => (
            <button
              key={s}
              onClick={() => setSubjectFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-colors",
                subjectFilter === s
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900",
              )}
            >
              {s === "all" ? "Tất cả môn" : s}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList className="bg-slate-950 border border-slate-900 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-900 text-slate-400 data-[state=active]:text-white">
            Tất cả
          </TabsTrigger>
          <TabsTrigger value="draft" className="data-[state=active]:bg-slate-900 text-slate-400 data-[state=active]:text-white">
            Nháp
          </TabsTrigger>
          <TabsTrigger value="published" className="data-[state=active]:bg-slate-900 text-slate-400 data-[state=active]:text-white">
            Đã xuất bản
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Body */}
      {quizzesQ.isLoading ? (
        <DashboardSkeleton />
      ) : allQuizzes.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Thư viện trống"
          description="Tạo bộ đề đầu tiên — chỉ cần một file PDF hoặc đoạn văn bản, AI sẽ soạn câu hỏi theo Chương trình GDPT 2018."
          ctaHref="/quiz/create"
          ctaLabel="Tạo quiz đầu tiên"
        />
      ) : filtered.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-900">
          <CardContent className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-300 font-semibold">
              Không có quiz nào khớp bộ lọc hiện tại.
            </p>
            <p className="text-xs text-slate-500">
              Thử xoá bộ lọc môn / trạng thái hoặc thay đổi từ khoá tìm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-stagger">
          {filtered.map((q) => (
            <Card
              key={q.id}
              className="bg-slate-900/40 border-slate-900 flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    className="bg-indigo-950 text-indigo-400 border border-indigo-900 text-[10px]"
                  >
                    {q.subject} · Lớp {q.grade}
                  </Badge>
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
                </div>
                <CardTitle className="text-slate-200 text-base md:text-lg line-clamp-1">
                  {q.title}
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  Tạo {format(new Date(q.created_at), "dd/MM/yyyy")} · Nguồn{" "}
                  {q.source_type === "ai" ? "AI" : q.source_type === "pdf" ? "PDF" : "Tự soạn"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 text-slate-400 text-xs flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4" />
                  <span>{q.total_questions ?? 0} câu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{q.estimated_minutes ?? 0} phút</span>
                </div>
                {q.is_public && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    <span>Công khai</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-3 border-t border-slate-950 flex justify-end">
                <Link
                  href={`/quiz/${q.id}`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold",
                  )}
                >
                  <Play className="h-3 w-3 mr-1.5 fill-current" /> Làm bài
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
