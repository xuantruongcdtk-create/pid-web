import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { CheckCircle2, Sparkles, ArrowRight, Receipt, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { findPlan, findCreditPack, formatVnd, resolvePurchase } from "@/lib/payment/plans";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asStr(value: SearchParams[string]): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = "then" in searchParams ? await searchParams : searchParams;
  const provider = asStr(sp.provider) ?? "momo";
  const orderId = asStr(sp.orderId) ?? null;
  const isMock = asStr(sp.mock) === "1";

  // Look up the transaction for nice display + (if mock) apply the purchase
  let amount: number | null = null;
  let purchaseLabel = "Đơn hàng PID";
  let appliedNote: string | null = null;

  if (orderId) {
    const supabase = createClient();
    const { data: tx } = await supabase
      .from("payment_transactions")
      .select("amount, plan_purchased, status, user_id")
      .eq("provider_transaction_id", orderId)
      .maybeSingle();

    if (tx) {
      amount = tx.amount;
      if (tx.plan_purchased) {
        const plan = findPlan(tx.plan_purchased);
        const pack = findCreditPack(tx.plan_purchased);
        if (plan) purchaseLabel = `Nâng cấp gói ${plan.name}`;
        if (pack) purchaseLabel = pack.name;
      }

      // SANDBOX SHORTCUT: if this came from the mock redirect AND the row is
      // still 'pending', apply it here so the UX stays smooth in dev.
      if (isMock && tx.status === "pending" && tx.user_id && tx.plan_purchased) {
        const resolution = resolvePurchase(tx.plan_purchased);
        if (resolution) {
          await supabase
            .from("payment_transactions")
            .update({ status: "success", metadata: { mock: true } })
            .eq("provider_transaction_id", orderId);

          if (resolution.type === "credits") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("credits")
              .eq("id", tx.user_id)
              .maybeSingle();
            const next = (profile?.credits ?? 0) + resolution.credits;
            await supabase.from("profiles").update({ credits: next }).eq("id", tx.user_id);
            appliedNote = `Đã cộng ${resolution.credits} credits vào tài khoản`;
          } else {
            const { data: profile } = await supabase
              .from("profiles")
              .select("plan_expires_at")
              .eq("id", tx.user_id)
              .maybeSingle();
            const now = new Date();
            const base =
              profile?.plan_expires_at && new Date(profile.plan_expires_at) > now
                ? new Date(profile.plan_expires_at)
                : now;
            const newExpiry = new Date(base);
            newExpiry.setDate(newExpiry.getDate() + resolution.addDays);
            await supabase
              .from("profiles")
              .update({ plan: resolution.plan, plan_expires_at: newExpiry.toISOString() })
              .eq("id", tx.user_id);
            appliedNote = `Đã nâng cấp gói ${resolution.plan} đến ${newExpiry.toLocaleDateString("vi-VN")}`;
          }
        }
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-slate-900/40 border-emerald-900/60 overflow-hidden">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-100">Thanh toán thành công</h1>
              <p className="text-sm text-slate-400">{purchaseLabel}</p>
            </div>

            <div className="bg-slate-950/60 rounded-xl border border-slate-900 p-4 text-left text-xs space-y-2">
              <Row label="Mã đơn hàng" value={orderId ?? "—"} mono />
              <Row label="Cổng thanh toán" value={provider.toUpperCase()} />
              <Row label="Số tiền" value={amount !== null ? formatVnd(amount) : "—"} />
              {isMock && (
                <Row
                  label="Chế độ"
                  value="Sandbox / Mock"
                  badge="border-amber-500/40 text-amber-300"
                />
              )}
            </div>

            {appliedNote && (
              <div className="flex items-start gap-2 text-left text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-xl p-3">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{appliedNote}</span>
              </div>
            )}

            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold",
              )}
            >
              Về Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-900",
              )}
            >
              <Receipt className="h-4 w-4 mr-2" /> Xem hoá đơn
            </Link>
          </CardContent>
        </Card>

        <p className="text-[11px] text-slate-500 text-center flex items-center gap-1 justify-center">
          <ShieldCheck className="h-3 w-3" />
          Giao dịch được xác thực qua chữ ký HMAC end-to-end.
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 text-[11px] uppercase tracking-wider">{label}</span>
      <span
        className={cn(
          "text-slate-200 text-right truncate",
          mono && "font-mono text-[11px]",
          badge && `border rounded-md px-1.5 py-0.5 text-[10px] ${badge}`,
        )}
      >
        {value}
      </span>
    </div>
  );
}
