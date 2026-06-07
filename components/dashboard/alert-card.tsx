"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type AlertType = "warning" | "success" | "info";

const STYLE: Record<AlertType, { wrap: string; icon: string; iconBg: string; Icon: typeof Info }> =
  {
    warning: {
      wrap: "border-amber-900/60 bg-amber-950/30",
      icon: "text-amber-400",
      iconBg: "bg-amber-500/10",
      Icon: AlertTriangle,
    },
    success: {
      wrap: "border-emerald-900/60 bg-emerald-950/30",
      icon: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      Icon: CheckCircle2,
    },
    info: {
      wrap: "border-indigo-900/60 bg-indigo-950/30",
      icon: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
      Icon: Info,
    },
  };

export function AlertCard({
  type,
  title,
  description,
}: {
  type: AlertType;
  title: string;
  description?: string | null;
}) {
  const s = STYLE[type];
  const Icon = s.Icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", s.wrap)}>
      <div className={cn("p-2 rounded-lg shrink-0", s.iconBg)}>
        <Icon className={cn("h-4 w-4", s.icon)} />
      </div>
      <div className="space-y-1 min-w-0">
        <h5 className="text-sm font-semibold text-slate-100">{title}</h5>
        {description && (
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}
