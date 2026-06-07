"use client";

import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkle } from "lucide-react";
import type { SubjectTrend } from "@/lib/queries/dashboard";

const TREND_TONE: Record<
  SubjectTrend["trend"],
  { icon: typeof ArrowRight; color: string; label: string }
> = {
  up: { icon: ArrowUpRight, color: "text-emerald-400", label: "Tăng" },
  down: { icon: ArrowDownRight, color: "text-rose-400", label: "Giảm" },
  flat: { icon: ArrowRight, color: "text-slate-400", label: "Ổn định" },
  new: { icon: Sparkle, color: "text-indigo-400", label: "Mới" },
};

export function SubjectRow({ trend }: { trend: SubjectTrend }) {
  const t = TREND_TONE[trend.trend];
  const Icon = t.icon;
  const percent = Math.min(100, Math.max(0, (trend.current / 10) * 100));
  const barColor =
    trend.current >= 8
      ? "bg-emerald-500"
      : trend.current >= 6.5
        ? "bg-indigo-500"
        : trend.current >= 5
          ? "bg-amber-500"
          : "bg-rose-500";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-slate-200 truncate">{trend.subject}</span>
          <span className={cn("flex items-center gap-0.5 text-xs", t.color)}>
            <Icon className="h-3.5 w-3.5" />
            {trend.trend !== "new" && trend.delta !== 0 ? (
              <span className="tabular-nums">
                {trend.delta > 0 ? "+" : ""}
                {trend.delta.toFixed(1)}
              </span>
            ) : (
              <span>{t.label}</span>
            )}
          </span>
        </div>
        <span className="font-semibold text-slate-200 tabular-nums">
          {trend.current.toFixed(1)} <span className="text-xs text-slate-500">/ 10</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden">
        <div
          className={cn("h-full rounded-full animate-progress-grow", barColor)}
          style={{ ["--progress-target" as string]: `${percent}%` }}
        />
      </div>
    </div>
  );
}
