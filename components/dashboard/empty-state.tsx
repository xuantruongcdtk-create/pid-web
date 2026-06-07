"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="bg-slate-900/40 border-slate-900 border-dashed">
      <CardContent className="p-10 flex flex-col items-center text-center gap-4">
        {/* Illustration: stacked gradient blobs */}
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/30 to-purple-500/20 rounded-full blur-2xl" />
          <div className="absolute inset-4 bg-gradient-to-br from-emerald-500/20 to-indigo-500/30 rounded-full blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl">
              <Icon className="h-8 w-8 text-indigo-400" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          <p className="text-sm text-slate-400 max-w-md">{description}</p>
        </div>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/10 mt-2",
            )}
          >
            {ctaLabel}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
