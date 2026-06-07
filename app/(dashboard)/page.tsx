"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Loader2,
  PencilLine,
  Smile,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  computeSubjectTrends,
  fetchActiveAlerts,
  fetchPrimaryChild,
  fetchRecentScores,
  fetchWeeklySummaries,
  overallAverage,
  overallMood,
} from "@/lib/queries/dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AlertCard } from "@/components/dashboard/alert-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SubjectRow } from "@/components/dashboard/subject-row";
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton";

const BURNOUT_TONE: Record<"low" | "medium" | "high", { tone: "emerald" | "amber" | "rose"; label: string }> = {
  low: { tone: "emerald", label: "Thấp" },
  medium: { tone: "amber", label: "Trung bình" },
  high: { tone: "rose", label: "Cao" },
};

const MOOD_LABEL = (m: number | null) =>
  m === null
    ? "Chưa có dữ liệu"
    : m >= 4
      ? "Hào hứng"
      : m >= 3
        ? "Ổn định"
        : m >= 2
          ? "Mệt mỏi"
          : "Áp lực";

export default function DashboardOverview() {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  // --- Primary child ----------------------------------------------------
  const childQ = useQuery({
    queryKey: ["primary-child"],
    queryFn: () => fetchPrimaryChild(supabase),
    staleTime: 60_000,
  });
  const child = childQ.data ?? null;

  // --- Scores / summaries / alerts -------------------------------------
  const scoresQ = useQuery({
    queryKey: ["recent-scores", child?.id],
    queryFn: () => fetchRecentScores(supabase, child!.id, 28),
    enabled: !!child?.id,
  });
  const summariesQ = useQuery({
    queryKey: ["weekly-summaries", child?.id],
    queryFn: () => fetchWeeklySummaries(supabase, child!.id, 4),
    enabled: !!child?.id,
  });
  const alertsQ = useQuery({
    queryKey: ["alerts", child?.id],
    queryFn: () => fetchActiveAlerts(supabase, child!.id, 4),
    enabled: !!child?.id,
  });

  // --- Realtime: refetch on weekly_summaries insert/update -------------
  React.useEffect(() => {
    if (!child?.id) return;
    const channel = supabase
      .channel(`weekly-summaries-${child.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_summaries",
          filter: `child_id=eq.${child.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["weekly-summaries", child.id] });
          queryClient.invalidateQueries({ queryKey: ["alerts", child.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, child?.id, queryClient]);

  // --- Trigger AI analyze ----------------------------------------------
  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!child?.id) throw new Error("Chưa có hồ sơ con");
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, periodDays: 28, force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? json.error ?? "Phân tích thất bại");
      }
      return json;
    },
    onSuccess: () => {
      toast.success("AI đã cập nhật báo cáo");
      queryClient.invalidateQueries({ queryKey: ["weekly-summaries", child?.id] });
      queryClient.invalidateQueries({ queryKey: ["alerts", child?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Có lỗi khi gọi AI"),
  });

  // --- Loading / empty branches ----------------------------------------
  if (childQ.isLoading) return <DashboardSkeleton />;

  if (!child) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Tổng quan</h2>
          <p className="text-slate-400 text-sm">Hãy tạo hồ sơ con đầu tiên để bắt đầu.</p>
        </div>
        <EmptyState
          icon={Sparkles}
          title="Chưa có hồ sơ học sinh"
          description="Tạo hồ sơ con đầu tiên để PID có thể theo dõi điểm số, tâm trạng và đề xuất lộ trình học."
          ctaHref="/settings"
          ctaLabel="Tạo hồ sơ con"
        />
      </div>
    );
  }

  const scores = scoresQ.data ?? [];
  const summaries = summariesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const trends = computeSubjectTrends(scores);
  const latest = summaries.at(-1) ?? null;
  const previous = summaries.length >= 2 ? summaries.at(-2) ?? null : null;

  const avg = overallAverage(scores);
  const mood = overallMood(scores);
  const burnout = (latest?.ai_analysis?.burnoutRisk ?? child.burnout_risk ?? "low") as
    | "low"
    | "medium"
    | "high";
  const burnoutMeta = BURNOUT_TONE[burnout];

  const avgDelta =
    latest?.avg_score != null && previous?.avg_score != null
      ? Number((latest.avg_score - previous.avg_score).toFixed(2))
      : null;
  const studyHoursDisplay = latest?.study_hours != null ? `${latest.study_hours} giờ` : "—";

  // --- Empty-data branch ------------------------------------------------
  if (scores.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Hero child={child} onAnalyze={() => analyzeMut.mutate()} analyzing={analyzeMut.isPending} />
        <EmptyState
          icon={PencilLine}
          title={`Chưa có điểm số cho ${child.full_name}`}
          description="Nhập điểm đầu tiên để AI có thể tạo báo cáo phân tích, đề xuất ôn tập và bản đồ Learning DNA."
          ctaHref="/input"
          ctaLabel="Nhập điểm đầu tiên"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero with AI-generated summary */}
      <Hero
        child={child}
        avgDelta={avgDelta}
        summary={latest?.ai_analysis?.summary}
        onAnalyze={() => analyzeMut.mutate()}
        analyzing={analyzeMut.isPending}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-stagger">
        <KpiCard
          title="Điểm trung bình"
          value={avg !== null ? avg.toFixed(2) : "—"}
          hint={avgDelta !== null ? `${avgDelta >= 0 ? "+" : ""}${avgDelta} so với tuần trước` : "Chưa đủ dữ liệu so sánh"}
          icon={TrendingUp}
          tone="emerald"
          trend={avgDelta === null ? null : avgDelta > 0 ? "up" : avgDelta < 0 ? "down" : "flat"}
        />
        <KpiCard
          title="Giờ học tuần này"
          value={studyHoursDisplay}
          hint={latest ? `Tuần bắt đầu ${format(new Date(latest.week_start), "dd/MM")}` : "Chưa có dữ liệu"}
          icon={Activity}
          tone="indigo"
        />
        <KpiCard
          title="Tâm trạng"
          value={mood !== null ? `${mood} / 5` : "—"}
          hint={MOOD_LABEL(mood)}
          icon={Smile}
          tone="purple"
        />
        <KpiCard
          title="Nguy cơ burnout"
          value={burnoutMeta.label}
          hint={`Đánh giá từ ${scores.length} bài kiểm tra gần nhất`}
          icon={BookOpen}
          tone={burnoutMeta.tone}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject trends */}
        <Card className="bg-slate-900/40 border-slate-900 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-200">Điểm theo môn</CardTitle>
              <CardDescription className="text-slate-500">
                Trung bình {trends.length} môn · so với nửa kỳ trước
              </CardDescription>
            </div>
            <Link
              href="/analytics"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-lg flex items-center gap-1",
              )}
            >
              Phân tích chi tiết <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {trends.length === 0 ? (
              <p className="text-sm text-slate-500">Cần ít nhất một bài kiểm tra để hiển thị xu hướng.</p>
            ) : (
              trends.map((t) => <SubjectRow key={t.subject} trend={t} />)
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-200">Cảnh báo & ghi chú</CardTitle>
            <CardDescription className="text-slate-500">AI cập nhật sau mỗi lần phân tích</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có cảnh báo nào. Mọi thứ đang tốt!</p>
            ) : (
              alerts.map((a) => (
                <AlertCard
                  key={a.id}
                  type={a.type}
                  title={a.title}
                  description={a.description}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skeleton while analyze is pending */}
      {analyzeMut.isPending && (
        <Card className="bg-indigo-950/30 border-indigo-900/60">
          <CardContent className="p-4 flex items-center gap-3 text-sm text-indigo-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI đang phân tích lại điểm số của {child.full_name}…
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero({
  child,
  avgDelta,
  summary,
  onAnalyze,
  analyzing,
}: {
  child: { full_name: string; grade: string };
  avgDelta?: number | null;
  summary?: string;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 border border-indigo-900/50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.15),transparent)] pointer-events-none" />
      <div className="space-y-2 relative z-10 text-center md:text-left max-w-2xl">
        <Badge className="bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30 mb-2">
          <Sparkles className="h-3 w-3 mr-1" /> Trợ lý AI sẵn sàng
        </Badge>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Lộ trình học của {child.full_name}{" "}
          <span className="text-slate-400 text-base font-normal">— Lớp {child.grade}</span>
        </h2>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          {summary
            ? summary
            : avgDelta !== null && avgDelta !== undefined
              ? `Điểm trung bình tuần này ${avgDelta >= 0 ? "tăng" : "giảm"} ${Math.abs(avgDelta).toFixed(2)} điểm so với tuần trước.`
              : "Bấm \"Phân tích ngay\" để AI tạo báo cáo từ điểm số gần đây."}
        </p>
      </div>
      <div className="flex gap-3 relative z-10 shrink-0">
        <Button
          onClick={onAnalyze}
          disabled={analyzing}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-650/10 disabled:opacity-70"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang phân tích…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Phân tích ngay
            </>
          )}
        </Button>
        <Link
          href="/coach"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900 hover:text-white",
          )}
        >
          Hỏi AI Coach
        </Link>
      </div>
    </div>
  );
}
