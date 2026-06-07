"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVnd, type PlanDef } from "@/lib/payment/plans";

interface PricingCardProps {
  plan: PlanDef;
  currentPlan: string | null;
  loading?: boolean;
  onSelect: (plan: PlanDef) => void;
  /** Optional social-proof number to render below highlighted plan. */
  socialProofCount?: number;
}

export function PricingCard({
  plan,
  currentPlan,
  loading,
  onSelect,
  socialProofCount,
}: PricingCardProps) {
  const isCurrent = currentPlan === plan.id;
  const isFree = plan.monthlyPriceVnd === 0;

  return (
    <div className="relative">
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/30 px-3 py-1">
            <Star className="h-3 w-3 mr-1 fill-current" />
            {plan.badge}
          </Badge>
        </div>
      )}
      <Card
        className={cn(
          "h-full flex flex-col bg-slate-900/40 border-slate-900 transition-all",
          plan.highlight && "border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/10",
        )}
      >
        <CardHeader className="space-y-2">
          <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
            {plan.highlight && <Sparkles className="h-4 w-4 text-indigo-400" />}
            {plan.name}
          </CardTitle>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-100">
              {isFree ? "Miễn phí" : formatVnd(plan.monthlyPriceVnd)}
            </span>
            {!isFree && <span className="text-sm text-slate-500">/ tháng</span>}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-2">
          <ul className="space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-2 border-t border-slate-900 pt-4">
          <Button
            onClick={() => onSelect(plan)}
            disabled={loading || isCurrent || isFree}
            className={cn(
              "w-full font-semibold",
              plan.highlight
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20"
                : isCurrent || isFree
                  ? "bg-slate-800 text-slate-400 cursor-default"
                  : "bg-slate-100 hover:bg-white text-slate-900",
            )}
          >
            {loading
              ? "Đang xử lý…"
              : isCurrent
                ? "Đang dùng gói này"
                : isFree
                  ? "Gói mặc định"
                  : plan.ctaLabel}
          </Button>
          {plan.trialDays && !isCurrent && (
            <p className="text-[11px] text-slate-500 text-center leading-snug">
              Dùng thử miễn phí {plan.trialDays} ngày — không cần thẻ tín dụng. Tự động về Free sau{" "}
              {plan.trialDays} ngày nếu không thanh toán.
            </p>
          )}
          {plan.highlight && (
            <div className="space-y-2 pt-2 border-t border-slate-900">
              <blockquote className="text-[11px] text-slate-400 italic leading-snug">
                "Nhờ PID tôi phát hiện con yếu Đại số từ tuần 3, kịp can thiệp trước kỳ thi. Tuyệt
                vời!" <br />
                <span className="not-italic text-slate-500">
                  — Phụ huynh, Hà Nội <span className="text-amber-400">★★★★★</span>
                </span>
              </blockquote>
              {typeof socialProofCount === "number" && socialProofCount > 0 && (
                <p className="text-[11px] text-indigo-300 font-semibold">
                  Đang có {socialProofCount.toLocaleString("vi-VN")}+ phụ huynh dùng Premium
                </p>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
