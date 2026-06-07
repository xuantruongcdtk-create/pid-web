"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ArrowLeft, Share2, QrCode } from "lucide-react";
import Link from "next/link";

export default function ShareQuizPage({ params }: { params: { id: string } }) {
  const [copied, setCopied] = useState(false);
  const shareCode = "TOAN11-01";
  const shareUrl = `http://localhost:3000/q/${shareCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Link
          href="/teacher"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "text-slate-400 hover:text-white"
          )}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại cổng giáo viên
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">Chia sẻ liên kết làm bài</h2>
        <p className="text-slate-400 text-sm">Gửi liên kết này cho phụ huynh hoặc học sinh để làm đề khảo sát trực tuyến</p>
      </div>

      <Card className="bg-slate-900/40 border-slate-900 overflow-hidden relative">
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <div>
              <CardTitle className="text-slate-200 text-base">Khảo sát hàm số bậc ba</CardTitle>
              <CardDescription className="text-slate-505">Môn học: Toán học | Lớp 11A1</CardDescription>
            </div>
            <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-900">Mã: {shareCode}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Share Link input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Liên kết công khai</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="bg-slate-950/60 border-slate-800 text-slate-300 font-mono text-xs focus-visible:ring-0"
              />
              <Button
                onClick={handleCopy}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-emerald-400 font-medium">Đã sao chép liên kết vào bộ nhớ tạm!</p>}
          </div>

          {/* QR Code mockup */}
          <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 bg-white rounded-xl">
              <QrCode className="h-32 w-32 text-slate-950" />
            </div>
            <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
              Phụ huynh có thể quét mã QR này trực tiếp trên điện thoại để truy cập và xem bài tập cần hoàn thành của con.
            </p>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-950/30 border-t border-slate-900 justify-between p-4 flex-wrap gap-2 text-xs text-slate-500">
          <span>Trạng thái: Hoạt động</span>
          <span>Hạn nộp: Không giới hạn</span>
        </CardFooter>
      </Card>
    </div>
  );
}
