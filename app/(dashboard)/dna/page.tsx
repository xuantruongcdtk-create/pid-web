"use client";

// Opt out of static prerender — calls Supabase client.createClient() at render
// time which throws if env vars aren't set at build time.
export const dynamic = "force-dynamic";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Compass, Eye, Hand, Headphones, Sparkles, BookOpen, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchPrimaryChild, fetchWeeklySummaries } from "@/lib/queries/dashboard";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DashboardSkeleton } from "@/components/dashboard/loading-skeleton";

interface DnaTrait {
  key: "visual" | "auditory" | "kinesthetic" | "reading";
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Eye;
  color: string;
  barColor: string;
  bg: string;
}

const TRAITS: DnaTrait[] = [
  {
    key: "visual",
    label: "Thị giác (Visual)",
    shortLabel: "Visual",
    description: "Tiếp thu tốt qua sơ đồ tư duy, video minh hoạ, hình ảnh & flashcard.",
    icon: Eye,
    color: "text-indigo-400",
    barColor: "bg-gradient-to-r from-indigo-500 to-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    key: "auditory",
    label: "Thính giác (Auditory)",
    shortLabel: "Auditory",
    description: "Hiểu bài nhanh khi nghe giảng, thảo luận hoặc nghe lại bài đọc.",
    icon: Headphones,
    color: "text-purple-400",
    barColor: "bg-gradient-to-r from-purple-500 to-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    key: "kinesthetic",
    label: "Vận động (Kinesthetic)",
    shortLabel: "Kinesthetic",
    description: "Tiến bộ nhanh khi tự làm bài tập, thí nghiệm, vận động.",
    icon: Hand,
    color: "text-emerald-400",
    barColor: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    key: "reading",
    label: "Đọc & Viết (Reading)",
    shortLabel: "Reading",
    description: "Ghi nhớ tốt nhờ ghi chú, đọc sách, viết tóm tắt và liệt kê.",
    icon: BookOpen,
    color: "text-amber-400",
    barColor: "bg-gradient-to-r from-amber-500 to-amber-400",
    bg: "bg-amber-500/10",
  },
];

export default function LearningDnaPage() {
  const supabase = React.useMemo(() => createClient(), []);

  const childQ = useQuery({
    queryKey: ["primary-child"],
    queryFn: () => fetchPrimaryChild(supabase),
    staleTime: 60_000,
  });
  const child = childQ.data ?? null;

  const summariesQ = useQuery({
    queryKey: ["dna-summaries", child?.id],
    queryFn: () => fetchWeeklySummaries(supabase, child!.id, 4),
    enabled: !!child?.id,
  });

  if (childQ.isLoading) return <DashboardSkeleton />;

  if (!child) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <EmptyState
          title="Chưa có hồ sơ học sinh"
          description="Tạo hồ sơ con để PID tổng hợp Learning DNA cá nhân hoá."
          ctaHref="/settings"
          ctaLabel="Tạo hồ sơ con"
        />
      </div>
    );
  }

  if (summariesQ.isLoading) return <DashboardSkeleton />;

  const dna = (child.dna_profile ?? {}) as Partial<Record<DnaTrait["key"], number>>;
  const hasDna = TRAITS.some((t) => typeof dna[t.key] === "number");
  const latestSummary = (summariesQ.data ?? []).at(-1);

  if (!hasDna) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <EmptyState
          icon={Brain}
          title="Learning DNA chưa được xây dựng"
          description={'Sau khi nhập đủ điểm số và bấm "Phân tích ngay" trên Tổng quan, AI sẽ sinh hồ sơ năng lực VARK cho con.'}
          ctaHref="/"
          ctaLabel="Tới Tổng quan"
        />
      </div>
    );
  }

  // Find dominant style
  const traitsWithValues = TRAITS.map((t) => ({ trait: t, value: dna[t.key] ?? 0 }));
  const dominant = [...traitsWithValues].sort((a, b) => b.value - a.value)[0];

  const strengths = latestSummary?.ai_analysis?.strengths ?? [];
  const weaknesses = latestSummary?.ai_analysis?.weaknesses ?? [];
  const recommendations = latestSummary?.ai_analysis?.recommendations ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Header subtitle={`Hồ sơ năng lực của ${child.full_name} — Lớp ${child.grade}`} />

      {/* Dominant style hero */}
      <Card className="bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 border-slate-800/80">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <Badge className={cn("inline-flex border", dominant.trait.bg, dominant.trait.color, "border-current/30")}>
              <Sparkles className="h-3 w-3 mr-1" /> Phong cách chủ đạo
            </Badge>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {dominant.trait.label}
            </h3>
            <p className="text-sm text-slate-400 max-w-xl">{dominant.trait.description}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className={cn("p-5 rounded-2xl", dominant.trait.bg)}>
              <dominant.trait.icon className={cn("h-10 w-10", dominant.trait.color)} />
            </div>
            <div className="text-right">
              <div className={cn("text-4xl font-bold tabular-nums", dominant.trait.color)}>
                {dominant.value}%
              </div>
              <div className="text-xs text-slate-500">độ ưu tiên</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 VARK bars with stagger */}
      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-400" /> Bản đồ phong cách học tập VARK
          </CardTitle>
          <CardDescription className="text-slate-500">
            Mỗi thanh biểu thị mức độ phù hợp của một kênh tiếp thu (0–100)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 animate-fade-in-stagger">
          {TRAITS.map((t) => {
            const value = dna[t.key] ?? 0;
            const Icon = t.icon;
            return (
              <div key={t.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", t.bg)}>
                      <Icon className={cn("h-4 w-4", t.color)} />
                    </div>
                    <div>
                      <div className={cn("font-semibold text-sm", t.color)}>{t.shortLabel}</div>
                      <div className="text-[11px] text-slate-500">{t.label}</div>
                    </div>
                  </div>
                  <span className={cn("text-lg font-bold tabular-nums", t.color)}>{value}%</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-11">{t.description}</p>
                <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden ml-11" style={{ width: "calc(100% - 2.75rem)" }}>
                  <div
                    className={cn("h-full rounded-full animate-progress-grow", t.barColor)}
                    style={{ ["--progress-target" as string]: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Strengths & Weaknesses grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-stagger">
        <Card className="bg-slate-900/40 border-emerald-900/40">
          <CardHeader>
            <CardTitle className="text-emerald-300 flex items-center gap-2 text-base">
              <Target className="h-4 w-4" /> Điểm mạnh
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strengths.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu — chạy phân tích AI để cập nhật.</p>
            ) : (
              <ul className="space-y-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-amber-900/40">
          <CardHeader>
            <CardTitle className="text-amber-300 flex items-center gap-2 text-base">
              <Compass className="h-4 w-4" /> Cần cải thiện
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weaknesses.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu — chạy phân tích AI để cập nhật.</p>
            ) : (
              <ul className="space-y-2">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peak study + recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-indigo-400" /> Khung giờ học hiệu quả
            </CardTitle>
            <CardDescription className="text-slate-500">
              Dựa trên lịch sử điểm cao nhất
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-300">
              {child.peak_study_hours ?? "Chưa xác định"}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {child.peak_study_hours
                ? "Hãy ưu tiên các môn khó vào khung giờ này để tối đa hiệu quả."
                : "Sau vài tuần dữ liệu, AI sẽ gợi ý khung giờ tối ưu."}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 border-slate-800/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-400" /> Khuyến nghị từ AI
            </CardTitle>
            <CardDescription className="text-slate-500">
              Hành động có thể thực hiện trong tuần này
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">
                Chưa có khuyến nghị — chạy &quot;Phân tích ngay&quot; trên Tổng quan để cập nhật.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                {recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Learning DNA</h2>
      <p className="text-slate-400 text-sm">
        {subtitle ?? "Hồ sơ năng lực học tập được tổng hợp từ điểm số và thói quen học hằng ngày"}
      </p>
    </div>
  );
}
