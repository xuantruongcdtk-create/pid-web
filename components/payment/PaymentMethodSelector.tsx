"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, Building2 } from "lucide-react";
import { formatVnd } from "@/lib/payment/plans";

interface PaymentMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  amount: number;
  loading?: "momo" | "vnpay" | null;
  onPay: (provider: "momo" | "vnpay") => void;
}

export function PaymentMethodSelector({
  open,
  onOpenChange,
  title,
  amount,
  loading,
  onPay,
}: PaymentMethodSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{title}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Số tiền cần thanh toán:{" "}
            <span className="text-indigo-400 font-semibold">{formatVnd(amount)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            onClick={() => onPay("momo")}
            disabled={!!loading}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white"
          >
            {loading === "momo" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Wallet className="h-5 w-5" />
            )}
            <span className="font-semibold">MoMo</span>
            <span className="text-[11px] opacity-80">Ví điện tử phổ biến nhất</span>
          </Button>

          <Button
            onClick={() => onPay("vnpay")}
            disabled={!!loading}
            className="h-auto py-4 flex flex-col items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {loading === "vnpay" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
            <span className="font-semibold">VNPAY</span>
            <span className="text-[11px] opacity-80">Thẻ ATM / Internet Banking</span>
          </Button>
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-2">
          Bạn sẽ được chuyển sang trang thanh toán của nhà cung cấp. Giao dịch được mã hoá end-to-end.
        </p>
      </DialogContent>
    </Dialog>
  );
}
