"use client";

import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVnd, type CreditPackDef } from "@/lib/payment/plans";

interface CreditPackCardProps {
  pack: CreditPackDef;
  loading?: boolean;
  onBuy: (pack: CreditPackDef) => void;
}

export function CreditPackCard({ pack, loading, onBuy }: CreditPackCardProps) {
  const pricePerCredit = Math.round(pack.priceVnd / pack.credits);
  return (
    <Card
      className={cn(
        "relative flex flex-col bg-slate-900/40 border-slate-900",
        pack.popular && "border-emerald-500/40",
        pack.savingsPct >= 30 && "border-amber-500/40",
      )}
    >
      {pack.popular && (
        <Badge className="absolute -top-2 right-3 bg-emerald-600 text-white border-0 text-[10px]">
          Phổ biến
        </Badge>
      )}
      {pack.savingsPct > 0 && (
        <Badge
          className={cn(
            "absolute -top-2 left-3 border-0 text-[10px]",
            pack.savingsPct >= 30 ? "bg-amber-500 text-amber-950" : "bg-indigo-600 text-white",
          )}
        >
          Tiết kiệm {pack.savingsPct}%
        </Badge>
      )}
      <CardHeader className="pb-2 flex flex-row items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
          <Coins className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-100 text-sm">{pack.name}</h4>
          <p className="text-xs text-slate-500">{pack.credits} lượt tạo quiz AI</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        <div className="text-2xl font-extrabold text-slate-100">{formatVnd(pack.priceVnd)}</div>
        <div className="text-[11px] text-slate-500">
          ≈ {formatVnd(pricePerCredit)} / quiz · không hết hạn
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          onClick={() => onBuy(pack)}
          disabled={loading}
          className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold"
        >
          Mua ngay
        </Button>
      </CardFooter>
    </Card>
  );
}
