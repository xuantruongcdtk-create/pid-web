"use client";

import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, MessageSquare, QrCode, Share2, ExternalLink } from "lucide-react";

interface QuizShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareCode: string;
  title: string;
  subject: string;
  grade: string;
}

export function QuizShareModal({
  open,
  onOpenChange,
  shareCode,
  title,
  subject,
  grade,
}: QuizShareModalProps) {
  const [origin, setOrigin] = useState("");
  const [copiedField, setCopiedField] = useState<"url" | "zalo" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const shareUrl = useMemo(
    () => (shareCode ? `${origin || "https://pid.vn"}/q/${shareCode}` : ""),
    [shareCode, origin],
  );

  const zaloMessage = useMemo(
    () =>
      `Phụ huynh lớp ${grade} ơi, thầy/cô vừa tạo bộ quiz ${subject}.
Làm bài tại: ${shareUrl}
(Miễn phí, không cần đăng ký)`,
    [grade, subject, shareUrl],
  );

  async function copy(text: string, field: "url" | "zalo") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(field === "url" ? "Đã sao chép link" : "Đã sao chép tin nhắn Zalo");
      setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 1800);
    } catch {
      toast.error("Không thể sao chép — vui lòng chọn và copy thủ công");
    }
  }

  function openZalo() {
    // Zalo deep-link share intent (mobile). On desktop falls through to https.
    const text = encodeURIComponent(zaloMessage);
    window.open(`https://zalo.me/share?u=${encodeURIComponent(shareUrl)}&t=${text}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <Share2 className="h-4 w-4 text-emerald-400" /> Chia sẻ quiz
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Gửi link công khai để phụ huynh / học sinh làm bài — không cần đăng ký.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Quiz</div>
            <div className="font-semibold text-slate-100 line-clamp-1">{title}</div>
            <div className="flex gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-800">
                {subject} · Lớp {grade}
              </Badge>
              <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-900/60 text-[10px]">
                Mã: {shareCode}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
            <div className="bg-white p-3 rounded-xl mx-auto">
              <QRCode value={shareUrl} size={140} level="M" />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Quét QR hoặc gửi link
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="bg-slate-950/60 border-slate-800 text-slate-300 text-xs font-mono"
                />
                <Button
                  onClick={() => copy(shareUrl, "url")}
                  size="icon"
                  variant="outline"
                  className="border-slate-800 text-slate-300 hover:bg-slate-900 shrink-0"
                  title="Sao chép link"
                >
                  {copiedField === "url" ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Mở thử trang công khai
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Mẫu tin nhắn Zalo
            </div>
            <pre className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {zaloMessage}
            </pre>
            <div className="flex gap-2">
              <Button
                onClick={() => copy(zaloMessage, "zalo")}
                className="flex-1 bg-slate-100 text-slate-900 hover:bg-white"
              >
                {copiedField === "zalo" ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-emerald-600" /> Đã copy
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" /> Copy tin nhắn Zalo
                  </>
                )}
              </Button>
              <Button
                onClick={openZalo}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Mở Zalo
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
