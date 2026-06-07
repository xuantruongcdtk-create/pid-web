"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, ClipboardList, Loader2, Sparkles } from "lucide-react";

export default function InputScoresPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [subject, setSubject] = useState("toan");
  const [scoreType, setScoreType] = useState("15min");
  const [scoreValue, setScoreValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreValue) return;

    setLoading(true);
    setSuccess(false);

    try {
      // Simulate API call to api/scores
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
      setScoreValue("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-indigo-400" />
          Nhập điểm số định kỳ
        </h2>
        <p className="text-slate-400 text-sm">Ghi nhận điểm các bài kiểm tra lớp học của con để đồng bộ và cập nhật lộ trình AI</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-200 text-base">Thêm đầu điểm mới</CardTitle>
            <CardDescription className="text-slate-500">Điểm số sẽ được sử dụng để phân tích Learning DNA lập tức</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Subject selector */}
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-slate-350">Môn học</Label>
              <Select value={subject} onValueChange={(val) => val && setSubject(val)}>
                <SelectTrigger id="subject" className="bg-slate-950/50 border-slate-800 text-slate-300">
                  <SelectValue placeholder="Chọn môn học" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                  <SelectItem value="toan">Toán học</SelectItem>
                  <SelectItem value="tieng-anh">Tiếng Anh</SelectItem>
                  <SelectItem value="vat-ly">Vật lý</SelectItem>
                  <SelectItem value="hoa-hoc">Hóa học</SelectItem>
                  <SelectItem value="ngu-van">Ngữ văn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Score Type selector */}
            <div className="space-y-2">
              <Label htmlFor="type" className="text-slate-350">Loại kiểm tra</Label>
              <Select value={scoreType} onValueChange={(val) => val && setScoreType(val)}>
                <SelectTrigger id="type" className="bg-slate-950/50 border-slate-800 text-slate-300">
                  <SelectValue placeholder="Chọn đầu điểm" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                  <SelectItem value="15min">Kiểm tra 15 phút (Regular)</SelectItem>
                  <SelectItem value="1period">Kiểm tra 1 tiết (Midterm-like)</SelectItem>
                  <SelectItem value="midterm">Thi giữa kỳ (Midterm Exam)</SelectItem>
                  <SelectItem value="final">Thi cuối kỳ (Final Exam)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Score input value */}
            <div className="space-y-2">
              <Label htmlFor="value" className="text-slate-350">Điểm số (Thang điểm 10)</Label>
              <Input
                id="value"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={scoreValue}
                onChange={(e) => setScoreValue(e.target.value)}
                placeholder="Ví dụ: 8.5 hoặc 9.0"
                className="bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-650 focus-visible:ring-indigo-600"
                required
              />
            </div>

            {success && (
              <div className="p-3 bg-emerald-950/40 text-emerald-400 border border-emerald-900 rounded-xl text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>Điểm số đã được ghi nhận thành công! Gemini AI đang phân tích cập nhật biểu đồ.</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-slate-950/30 border-t border-slate-900 flex justify-end p-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/10 min-w-36 transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Cập nhật điểm số
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
