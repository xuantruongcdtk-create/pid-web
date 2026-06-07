"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Dữ liệu của con có được bảo mật không?",
    a: "Có. Chúng tôi ẩn danh hoá và mã hoá toàn bộ dữ liệu học tập. Không bán dữ liệu cho bên thứ ba, không chia sẻ với quảng cáo. Bạn có thể xoá tài khoản và toàn bộ dữ liệu bất cứ lúc nào.",
  },
  {
    q: "Tôi có thể huỷ gói bất cứ lúc nào không?",
    a: "Có. Huỷ trong trang Cài đặt → Quản lý gói. Bạn vẫn dùng được Premium đến hết kỳ đã thanh toán, sau đó tự động chuyển về Free. Không có phí phạt huỷ.",
  },
  {
    q: "Quiz do AI tạo có chính xác không?",
    a: "Câu hỏi được soạn theo Chương trình GDPT 2018 với phân bố 30/40/20/10 (Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao). Mỗi câu có đáp án + giải thích rõ ràng. Bạn có thể chỉnh sửa từng câu trước khi lưu.",
  },
];

export function PricingFAQ() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-slate-100">Câu hỏi thường gặp</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {FAQS.map(({ q, a }) => (
          <Card key={q} className="bg-slate-900/40 border-slate-900">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2 text-slate-100 font-semibold text-sm">
                <HelpCircle className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <span>{q}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
