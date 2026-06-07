"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, BookOpen, LineChart as LineIcon, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPrimaryChild,
  fetchRecentScores,
  fetchWeeklySummaries,
  type ScoreRow,
} from "@/lib/queries/dashboard";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton";

// Stable subject color palette
const SUBJECT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

interface TrendPoint {
  weekLabel: string;
  weekStart: string;
  [subject: string]: number | string;
}

/** Group scores by ISO week-start (Monday) and average per subject within the week. */
function buildTrendData(scores: ScoreRow[]): { points: TrendPoint[]; subjects: string[] } {
  if (scores.length === 0) return { points: [], subjects: [] };
  const byWeek = new Map<string, Map<string, number[]>>();
  for (const s of scores) {
    const d = new Date(s.exam_date);
    const day = d.getDay(); // 0 Sun..6 Sat
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    const key = format(monday, "yyyy-MM-dd");
    if (!byWeek.has(key)) byWeek.set(key, new Map());
    const bucket = byWeek.get(key)!;
    const arr = bucket.get(s.subject) ?? [];
    arr.push(Number(s.score));
    bucket.set(s.subject, arr);
  }
  const subjects = Array.from(new Set(scores.map((s) => s.subject))).sort();
  const points: TrendPoint[] = Array.from(byWeek.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, bucket]) => {
      const row: TrendPoint = {
        weekStart,
        weekLabel: format(new Date(weekStart), "dd/MM"),
      };
      for (const subj of subjects) {
        const arr = bucket.get(subj);
        if (arr && arr.length > 0) {
          row[subj] = Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
        }
      }
      return row;
    });
  return { points, subjects };
}

function buildBarData(scores: ScoreRow[]) {
  const byS = new Map<string, number[]>();
  for (const s of scores) {
    const arr = byS.get(s.subject) ?? [];
    arr.push(Number(s.score));
    byS.set(s.subject, arr);
  }
  return Array.from(byS.entries())
    .map(([subject, arr]) => ({
      subject,
      average: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)),
      count: arr.length,
    }))
    .sort((a, b) => b.average - a.average);
}

export default function AnalyticsPage() {
  const supabase = React.useMemo(() => createClient(), []);

  const childQ = useQuery({
    queryKey: ["primary-child"],
    queryFn: () => fetchPrimaryChild(supabase),
    staleTime: 60_000,
  });
  const child = childQ.data ?? null;

  const scoresQ = useQuery({
    queryKey: ["analytics-scores", child?.id],
    queryFn: () => fetchRecentScores(supabase, child!.id, 60),
    enabled: !!child?.id,
  });

  const summariesQ = useQuery({
    queryKey: ["analytics-summaries", child?.id],
    queryFn: () => fetchWeeklySummaries(supabase, child!.id, 8),
    enabled: !!child?.id,
  });

  if (childQ.isLoading) return <DashboardSkeleton />;

  if (!child) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <EmptyState
          title="Chưa có hồ sơ học sinh"
          description="Cần tạo hồ sơ con trước khi xem phân tích."
          ctaHref="/settings"
          ctaLabel="Tạo hồ sơ con"
        />
      </div>
    );
  }

  if (scoresQ.isLoading || summariesQ.isLoading) return <DashboardSkeleton />;

  const scores = scoresQ.data ?? [];
  const { points, subjects } = buildTrendData(scores);
  const barData = buildBarData(scores);
  const latestSummary = (summariesQ.data ?? []).at(-1);

  if (points.length < 2) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <EmptyState
          icon={LineIcon}
          title="Chưa đủ dữ liệu để hiển thị xu hướng"
          description={`Cần ít nhất 2 tuần dữ liệu điểm số để vẽ biểu đồ. Hiện có ${points.length} tuần.`}
          ctaHref="/input"
          ctaLabel="Nhập thêm điểm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Header />

      {/* AI summary card */}
      {latestSummary?.ai_analysis?.summary && (
        <Card className="bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 border-slate-800/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-slate-200 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" /> Đánh giá định kỳ từ AI
              </CardTitle>
              <CardDescription className="text-slate-500">
                Phân tích tự động dựa trên {scores.length} bản ghi điểm gần nhất
              </CardDescription>
            </div>
            <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/30">
              Tuần {format(new Date(latestSummary.week_start), "dd/MM")}
            </Badge>
          </CardHeader>
          <CardContent className="text-slate-300 text-sm leading-relaxed space-y-2">
            <p>{latestSummary.ai_analysis.summary}</p>
            {latestSummary.ai_analysis.strengths?.length ? (
              <p className="text-xs text-emerald-300">
                <strong className="text-emerald-400">Điểm mạnh:</strong>{" "}
                {latestSummary.ai_analysis.strengths.slice(0, 3).join(" · ")}
              </p>
            ) : null}
            {latestSummary.ai_analysis.weaknesses?.length ? (
              <p className="text-xs text-amber-300">
                <strong className="text-amber-400">Cần cải thiện:</strong>{" "}
                {latestSummary.ai_analysis.weaknesses.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-stagger">
        <Card className="bg-slate-900/40 border-slate-900 p-4">
          <CardHeader className="px-2 pb-6">
            <CardTitle className="text-slate-200 text-base">Xu hướng điểm theo tuần</CardTitle>
            <CardDescription className="text-slate-500">
              {points.length} tuần · {subjects.length} môn
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 w-full pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="weekLabel" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 10]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend wrapperStyle={{ paddingTop: 10 }} />
                {subjects.map((subj, i) => (
                  <Line
                    key={subj}
                    type="monotone"
                    dataKey={subj}
                    name={subj}
                    stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-900 p-4">
          <CardHeader className="px-2 pb-6">
            <CardTitle className="text-slate-200 text-base">So sánh điểm theo môn</CardTitle>
            <CardDescription className="text-slate-500">Trung bình của toàn bộ kỳ</CardDescription>
          </CardHeader>
          <CardContent className="h-80 w-full pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="subject" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 10]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: 8 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Bar dataKey="average" name="Trung bình" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Subject leaderboard */}
      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" /> Bảng xếp hạng môn học
          </CardTitle>
          <CardDescription className="text-slate-500">
            Sắp xếp theo điểm trung bình cao nhất
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {barData.map((row, i) => (
            <div
              key={row.subject}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-6">#{i + 1}</span>
                <span className="text-sm font-medium text-slate-200">{row.subject}</span>
                <Badge variant="outline" className="text-slate-400 border-slate-800 text-[10px] py-0">
                  {row.count} bài
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100 tabular-nums">
                  {row.average.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">/ 10</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
          Phân tích kết quả học tập
        </h2>
        <p className="text-slate-400 text-sm">Theo dõi xu hướng điểm số và so sánh các môn</p>
      </div>
      <Badge className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-default">
        Xuất báo cáo PDF <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
      </Badge>
    </div>
  );
}
