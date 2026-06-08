"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const COLOR_SWATCHES = [
  "#0f2554", // navy
  "#1d4ed8", // indigo
  "#7c3aed", // purple
  "#db2777", // pink
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // amber
  "#16a34a", // green
  "#0891b2", // cyan
  "#475569", // slate
];

interface AddChildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, become an "edit" form pre-filled with these values. */
  initial?: {
    id: string;
    full_name: string;
    grade: string;
    school_name?: string | null;
    avatar_color?: string | null;
  };
}

export function AddChildModal({ open, onOpenChange, initial }: AddChildModalProps) {
  const isEdit = !!initial;
  const qc = useQueryClient();

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "6");
  const [schoolName, setSchoolName] = useState(initial?.school_name ?? "");
  const [avatarColor, setAvatarColor] = useState(initial?.avatar_color ?? COLOR_SWATCHES[0]);

  // Reset when re-opening with different initial (or when the modal opens fresh)
  React.useEffect(() => {
    if (open) {
      setFullName(initial?.full_name ?? "");
      setGrade(initial?.grade ?? "6");
      setSchoolName(initial?.school_name ?? "");
      setAvatarColor(initial?.avatar_color ?? COLOR_SWATCHES[0]);
    }
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: async () => {
      const body = {
        full_name: fullName.trim(),
        grade,
        school_name: schoolName.trim() || null,
        avatar_color: avatarColor,
      };
      const url = isEdit ? `/api/children/${initial!.id}` : "/api/children";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? json.error ?? "Lỗi khi lưu hồ sơ con");
      }
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-children"] });
      qc.invalidateQueries({ queryKey: ["my-child-ids"] });
      toast.success(isEdit ? "Đã cập nhật hồ sơ con" : "Đã thêm con mới");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi khi lưu"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-indigo-400" />
            {isEdit ? "Chỉnh sửa hồ sơ con" : "Thêm hồ sơ con"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEdit
              ? "Cập nhật tên, lớp, trường hoặc màu avatar."
              : "Tạo hồ sơ ngắn — bạn có thể bổ sung trường + cấp học sau."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim().length < 2) {
              toast.error("Tên con cần ít nhất 2 ký tự");
              return;
            }
            mut.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="ac-name" className="text-slate-300">
              Họ và tên
            </Label>
            <Input
              id="ac-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
              required
              minLength={2}
              placeholder="Nguyễn Văn B"
              className="bg-slate-950/50 border-slate-800 text-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Lớp</Label>
              <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      Lớp {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac-school" className="text-slate-300">
                Trường (tuỳ chọn)
              </Label>
              <Input
                id="ac-school"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="THCS Lê Quý Đôn"
                className="bg-slate-950/50 border-slate-800 text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Màu avatar</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => {
                const active = avatarColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    aria-label={`Chọn màu ${c}`}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      active ? "border-white scale-110" : "border-slate-700 hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-800 text-slate-300"
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={mut.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
                </>
              ) : isEdit ? (
                "Lưu thay đổi"
              ) : (
                "Thêm con"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
