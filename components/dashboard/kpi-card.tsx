"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export interface KpiCardProps {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "purple" | "pink";
  trend?: "up" | "down" | "flat" | null;
}

const TONE: Record<NonNullable<KpiCardProps["tone"]>, { text: string; bg: string }> = {
  indigo: { text: "text-indigo-400", bg: "bg-indigo-500/10" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10" },
  rose: { text: "text-rose-400", bg: "bg-rose-500/10" },
  purple: { text: "text-purple-400", bg: "bg-purple-500/10" },
  pink: { text: "text-pink-400", bg: "bg-pink-500/10" },
};

export function KpiCard({ title, value, hint, icon: Icon, tone = "indigo", trend }: KpiCardProps) {
  const t = TONE[tone];
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-500";
  return (
    <Card className="bg-slate-900/40 border-slate-900 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={cn("p-2 rounded-lg", t.bg)}>
          <Icon className={cn("h-4 w-4", t.text)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-bold text-slate-100">{value}</div>
          {trend && (
            <span className={cn("flex items-center gap-0.5 text-xs", trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
