import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { XCircle, ArrowLeft, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asStr(value: SearchParams[string]): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

const REASON_LABEL: Record<string, string> = {
  user_canceled: "Bạn đã huỷ thanh toán",
  invalid_signature: "Chữ ký xác thực không hợp lệ",
  rate_limited: "Có quá nhiều yêu cầu trong thời gian ngắn",
  insufficient_balance: "Tài khoản không đủ số dư",
};

export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = "then" in searchParams ? await searchParams : searchParams;
  const provider = asStr(sp.provider) ?? null;
  const reason = asStr(sp.reason) ?? null;
  const code = asStr(sp.code) ?? null;
  const orderId = asStr(sp.orderId) ?? null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4 animate-fade-in">
      <div className="w-full max-w-md">
        <Card className="bg-slate-900/40 border-rose-900/60">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/15 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-rose-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-100">Thanh toán không thành công</h1>
              <p className="text-sm text-slate-400">
                {reason && REASON_LABEL[reason]
                  ? REASON_LABEL[reason]
                  : "Giao dịch chưa hoàn tất hoặc đã bị huỷ. Không có khoản tiền nào bị trừ."}
              </p>
            </div>

            {(provider || code || orderId) && (
              <div className="bg-slate-950/60 rounded-xl border border-slate-900 p-4 text-left text-xs space-y-2">
                {orderId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-[11px] uppercase tracking-wider">
                      Mã đơn
                    </span>
                    <span className="font-mono text-slate-200 text-[11px]">{orderId}</span>
                  </div>
                )}
                {provider && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-[11px] uppercase tracking-wider">
                      Cổng
                    </span>
                    <span className="text-slate-200">{provider.toUpperCase()}</span>
                  </div>
                )}
                {code && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-[11px] uppercase tracking-wider">
                      Mã lỗi
                    </span>
                    <span className="font-mono text-slate-300 text-[11px]">{code}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Link
                href="/settings"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full bg-indigo-600 hover:bg-indigo-500 text-white",
                )}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Thử lại
              </Link>
              <Link
                href="/coach"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-900",
                )}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Liên hệ hỗ trợ
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
