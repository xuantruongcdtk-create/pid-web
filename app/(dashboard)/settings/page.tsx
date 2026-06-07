"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Coins,
  Sparkles,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Infinity as InfinityIcon,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CREDIT_PACKS,
  PLANS,
  type CreditPackDef,
  type PlanDef,
  formatVnd,
} from "@/lib/payment/plans";
import { PricingCard } from "@/components/payment/PricingCard";
import { CreditPackCard } from "@/components/payment/CreditPackCard";
import { PricingFAQ } from "@/components/payment/PricingFAQ";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";

interface SubscriptionTarget {
  kind: "plan" | "credits";
  purchaseCode: string;
  title: string;
  amount: number;
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const profileQ = useQuery({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email:id, plan, plan_expires_at, credits, role")
        .eq("id", user.id)
        .maybeSingle();
      return { ...data, authEmail: user.email } as {
        full_name: string | null;
        plan: string | null;
        plan_expires_at: string | null;
        credits: number | null;
        role: string | null;
        authEmail: string | undefined;
      } | null;
    },
    staleTime: 30_000,
  });

  // Social proof: count of premium users
  const proofQ = useQuery({
    queryKey: ["premium-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .in("plan", ["premium", "teacher_pro"]);
      // Round to nearest 100 (and never below 1200 to avoid empty social proof in dev)
      const raw = count ?? 0;
      const floor = Math.max(1200, Math.floor(raw / 100) * 100);
      return floor;
    },
    staleTime: 5 * 60_000,
  });

  const [target, setTarget] = useState<SubscriptionTarget | null>(null);
  const [payLoading, setPayLoading] = useState<"momo" | "vnpay" | null>(null);

  const currentPlan = profileQ.data?.plan ?? "free";
  const credits = profileQ.data?.credits ?? 0;
  const planExpires = profileQ.data?.plan_expires_at
    ? new Date(profileQ.data.plan_expires_at)
    : null;

  function openPlan(plan: PlanDef) {
    if (plan.id === "free" || plan.id === currentPlan) return;
    setTarget({
      kind: "plan",
      purchaseCode: plan.purchaseCode,
      title: `Nâng cấp ${plan.name}`,
      amount: plan.monthlyPriceVnd,
    });
  }

  function openPack(pack: CreditPackDef) {
    setTarget({
      kind: "credits",
      purchaseCode: pack.id,
      title: `Mua ${pack.name}`,
      amount: pack.priceVnd,
    });
  }

  async function pay(provider: "momo" | "vnpay") {
    if (!target) return;
    setPayLoading(provider);
    try {
      const res = await fetch(`/api/payment/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseCode: target.purchaseCode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Không khởi tạo được thanh toán");
      }
      if (json.payUrl) {
        window.location.href = json.payUrl;
      } else {
        toast.warning("Đã tạo đơn nhưng không nhận được URL thanh toán");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Lỗi khi khởi tạo thanh toán");
    } finally {
      setPayLoading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Cài đặt tài khoản</h2>
        <p className="text-slate-400 text-sm">
          Quản lý gói dịch vụ, credits và thông tin tài khoản
        </p>
      </div>

      {/* ----- Subscription status ----- */}
      <Card className="bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 border-slate-800/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Gói hiện tại
            </CardTitle>
            <CardDescription className="text-slate-500">
              {profileQ.data?.full_name ?? "Tài khoản của bạn"}{" "}
              {profileQ.data?.authEmail ? `· ${profileQ.data.authEmail}` : ""}
            </CardDescription>
          </div>
          <Badge
            className={
              currentPlan === "premium"
                ? "bg-indigo-500 text-white border-0"
                : currentPlan === "teacher_pro"
                  ? "bg-purple-500 text-white border-0"
                  : "bg-slate-700 text-slate-200 border-0"
            }
          >
            {currentPlan === "premium"
              ? "Premium"
              : currentPlan === "teacher_pro"
                ? "Teacher Pro"
                : "Free"}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            icon={Coins}
            label="Credits còn lại"
            value={
              currentPlan === "premium" || currentPlan === "teacher_pro"
                ? "Không giới hạn"
                : credits.toString()
            }
            unlimited={currentPlan !== "free"}
          />
          <Stat
            icon={Calendar}
            label="Gia hạn tiếp theo"
            value={
              planExpires
                ? planExpires.toLocaleDateString("vi-VN")
                : currentPlan === "free"
                  ? "—"
                  : "Đang chờ kích hoạt"
            }
          />
          <Stat
            icon={CreditCard}
            label="Phương thức thanh toán"
            value="MoMo · VNPAY (sandbox)"
          />
        </CardContent>
        <Separator className="bg-slate-800" />
        <div className="p-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Hết credits sẽ không thể tạo thêm quiz mới. Nâng cấp Premium hoặc mua credit pack để
            tiếp tục.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-200"
              onClick={() => document.getElementById("credit-packs")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Coins className="h-3.5 w-3.5 mr-1.5" /> Mua quiz credits
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
              onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Nâng cấp Premium
            </Button>
          </div>
        </div>
      </Card>

      {/* ----- Plans ----- */}
      <section id="plans" className="space-y-4 scroll-mt-24">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-100">Các gói dịch vụ</h3>
          <p className="text-sm text-slate-500">Chọn gói phù hợp với nhu cầu đồng hành cùng con</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              loading={false}
              onSelect={openPlan}
              socialProofCount={plan.highlight ? proofQ.data : undefined}
            />
          ))}
        </div>
      </section>

      {/* ----- Credit packs ----- */}
      <section id="credit-packs" className="space-y-4 scroll-mt-24">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-100">Mua quiz credits</h3>
          <p className="text-sm text-slate-500">
            Mua thêm credits để tiếp tục tạo quiz mà không cần nâng cấp gói. Credits không hết hạn.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <CreditPackCard key={pack.id} pack={pack} onBuy={openPack} />
          ))}
        </div>
      </section>

      {/* ----- FAQ ----- */}
      <PricingFAQ />

      {/* ----- Payment selector dialog ----- */}
      <PaymentMethodSelector
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.title ?? ""}
        amount={target?.amount ?? 0}
        loading={payLoading}
        onPay={pay}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  unlimited,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unlimited?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-900">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500 mb-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-slate-100 font-semibold text-base flex items-center gap-2">
        {unlimited && <InfinityIcon className="h-4 w-4 text-indigo-400" />}
        {value}
      </div>
    </div>
  );
}
