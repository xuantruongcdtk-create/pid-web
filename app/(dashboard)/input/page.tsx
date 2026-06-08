"use client";

// Opt out of static prerender — calls Supabase client.createClient() at render
// time which throws if env vars aren't set at build time.
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Check,
  Loader2,
  PlusCircle,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useChildStore } from "@/store/useChildStore";

// ----------------------------------------------------------------------------

const SUBJECTS = [
  "Toán",
  "Văn",
  "Anh",
  "Lý",
  "Hóa",
  "Sinh",
  "Sử",
  "Địa",
  "GDCD",
  "Tin",
] as const;

const EXAM_TYPES: Array<{ value: "regular" | "midterm" | "final" | "quiz"; label: string }> = [
  { value: "regular", label: "Thường xuyên" },
  { value: "midterm", label: "Giữa kỳ" },
  { value: "final", label: "Cuối kỳ" },
  { value: "quiz", label: "Bài quiz" },
];

const MOODS = [
  { value: 1, emoji: "😞", label: "Rất tệ" },
  { value: 2, emoji: "😟", label: "Tệ" },
  { value: 3, emoji: "😐", label: "Bình thường" },
  { value: 4, emoji: "🙂", label: "Tốt" },
  { value: 5, emoji: "😄", label: "Rất tốt" },
];

// Row schema is loose: row is included only if it has a score.
const RowSchema = z.object({
  subject: z.string(),
  score: z.string(), // string from input, validated live by zod refine below
});

const FormSchema = z.object({
  child_id: z.string().uuid("Hãy chọn con"),
  exam_date: z.string().min(8, "Hãy chọn ngày"),
  exam_type: z.enum(["regular", "midterm", "final", "quiz"]),
  term: z.enum(["HK1", "HK2"]).optional().nullable(),
  school_year: z.string().optional(),
  notes: z.string().max(500).optional(),
  mood_rating: z.number().int().min(1).max(5).optional().nullable(),
  rows: z
    .array(RowSchema)
    .refine(
      (rows) => rows.some((r) => r.score && r.score.trim().length > 0),
      "Hãy nhập ít nhất 1 điểm",
    )
    .refine(
      (rows) =>
        rows.every((r) => {
          if (!r.score || r.score.trim() === "") return true;
          const n = Number(r.score.replace(",", "."));
          return Number.isFinite(n) && n >= 0 && n <= 10;
        }),
      "Mỗi điểm phải từ 0 đến 10",
    ),
});

type FormValues = z.infer<typeof FormSchema>;

interface ChildRow {
  id: string;
  full_name: string;
  grade: string | null;
  avatar_color: string | null;
}

// ----------------------------------------------------------------------------

export default function InputScoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  const selectedChildId = useChildStore((s) => s.selectedChildId);
  const setSelectedChild = useChildStore((s) => s.setSelectedChild);
  const [analyzing, setAnalyzing] = useState(false);

  const childrenQ = useQuery({
    queryKey: ["children-list"],
    queryFn: async (): Promise<ChildRow[]> => {
      const { data } = await supabase
        .from("children")
        .select("id, full_name, grade, avatar_color")
        .order("created_at", { ascending: true });
      return (data ?? []) as ChildRow[];
    },
    staleTime: 60_000,
  });

  const children = childrenQ.data ?? [];

  // Auto-select first child if none chosen
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChild(children[0].id);
    }
  }, [selectedChildId, children, setSelectedChild]);

  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const schoolYear = (() => {
    const y = today.getFullYear();
    return today.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      child_id: selectedChildId ?? "",
      exam_date: isoToday,
      exam_type: "regular",
      term: today.getMonth() < 1 || today.getMonth() >= 7 ? "HK1" : "HK2",
      school_year: schoolYear,
      notes: "",
      mood_rating: null,
      rows: SUBJECTS.map((s) => ({ subject: s, score: "" })),
    },
  });

  const { register, handleSubmit, control, watch, setValue, formState, reset } = form;
  const fields = useFieldArray({ control, name: "rows" }).fields;
  void fields;

  // Keep child_id in sync with global store
  useEffect(() => {
    if (selectedChildId) setValue("child_id", selectedChildId, { shouldValidate: true });
  }, [selectedChildId, setValue]);

  const rowsWatch = watch("rows");
  const childId = watch("child_id");
  const moodWatch = watch("mood_rating");

  const submitMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const entries = values.rows
        .filter((r) => r.score && r.score.trim() !== "")
        .map((r) => ({
          child_id: values.child_id,
          subject: r.subject,
          score: Number(r.score.replace(",", ".")),
          exam_type: values.exam_type,
          exam_date: values.exam_date,
          term: values.term ?? null,
          school_year: values.school_year ?? null,
          notes: values.notes || null,
          mood_rating: values.mood_rating ?? null,
        }));

      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? json.error ?? "Lỗi khi lưu điểm");
      }
      return { saved: entries.length, childId: values.child_id };
    },
    onSuccess: async ({ saved, childId }) => {
      toast.success(`Đã lưu ${saved} điểm cho con`);
      try {
        confetti({ particleCount: 60, spread: 55, origin: { y: 0.7 } });
      } catch {
        /* ignore — env w/o canvas */
      }
      // Trigger AI analysis async (best-effort)
      setAnalyzing(true);
      void fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId }),
      }).finally(() => setAnalyzing(false));
      qc.invalidateQueries({ queryKey: ["scores"] });
      qc.invalidateQueries({ queryKey: ["weekly-summary"] });
      // Reset score fields but keep child + meta
      reset({
        ...form.getValues(),
        notes: "",
        mood_rating: null,
        rows: SUBJECTS.map((s) => ({ subject: s, score: "" })),
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi khi lưu điểm"),
  });

  const filledCount = rowsWatch.filter((r) => r.score && r.score.trim() !== "").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-indigo-400" />
          Nhập điểm số
        </h2>
        <p className="text-slate-400 text-sm">
          Nhập tất cả môn cùng lúc — AI sẽ phân tích sau khi bạn lưu.
        </p>
      </div>

      {analyzing && (
        <Card className="bg-indigo-950/30 border-indigo-900/60 sticky top-20 z-20">
          <CardContent className="p-3 flex items-center gap-3 text-indigo-200 text-sm">
            <Sparkles className="h-4 w-4 animate-pulse text-indigo-400 shrink-0" />
            <span className="flex-1">
              🤖 AI đang phân tích học tập của con… (thường mất 20–30 giây)
            </span>
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit((v) => submitMut.mutate(v))} className="space-y-4">
        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader className="space-y-1">
            <CardTitle className="text-slate-200 text-base">Thông tin chung</CardTitle>
            <CardDescription className="text-slate-500">
              Chọn con và ngày kiểm tra; điểm từng môn nhập bên dưới
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Con</Label>
              {children.length === 0 ? (
                <p className="text-xs text-amber-400">
                  Bạn chưa có hồ sơ con. Hãy thêm trong{" "}
                  <a href="/settings" className="underline">
                    Cài đặt
                  </a>
                  .
                </p>
              ) : (
                <Select
                  value={childId}
                  onValueChange={(v) => {
                    if (v) {
                      setValue("child_id", v, { shouldValidate: true });
                      setSelectedChild(v);
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Chọn con" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                    {children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} {c.grade ? `· Lớp ${c.grade}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam_date" className="text-slate-300">
                Ngày kiểm tra
              </Label>
              <Input
                id="exam_date"
                type="date"
                {...register("exam_date")}
                className="bg-slate-950/50 border-slate-800 text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Loại bài kiểm tra</Label>
              <Select
                value={watch("exam_type")}
                onValueChange={(v) =>
                  v && setValue("exam_type", v as FormValues["exam_type"])
                }
              >
                <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Học kỳ</Label>
              <Select
                value={watch("term") ?? ""}
                onValueChange={(v) => setValue("term", (v as "HK1" | "HK2") || null)}
              >
                <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-200">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectItem value="HK1">Học kỳ 1</SelectItem>
                  <SelectItem value="HK2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-200 text-base flex items-center justify-between">
              <span>Điểm từng môn</span>
              <Badge variant="outline" className="text-slate-300 border-slate-800">
                Đã nhập: {filledCount}/{SUBJECTS.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-500">
              Chỉ những môn có điểm sẽ được lưu — bỏ trống nếu chưa có
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUBJECTS.map((subject, idx) => (
              <ScoreRow
                key={subject}
                subject={subject}
                value={rowsWatch[idx]?.score ?? ""}
                {...register(`rows.${idx}.score`)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-200 text-base">Tâm trạng & ghi chú</CardTitle>
            <CardDescription className="text-slate-500">
              Giúp AI hiểu ngữ cảnh khi phân tích
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Tâm trạng của con</Label>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((m) => {
                  const active = moodWatch === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setValue("mood_rating", active ? null : m.value)}
                      className={cn(
                        "rounded-xl border py-2 text-center transition-colors",
                        active
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-900",
                      )}
                    >
                      <div className="text-xl">{m.emoji}</div>
                      <div className="text-[10px]">{m.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">
                Ghi chú (tuỳ chọn)
              </Label>
              <Textarea
                id="notes"
                placeholder="Vd: con ốm tuần này, bị áp lực thi…"
                {...register("notes")}
                className="bg-slate-950/50 border-slate-800 text-slate-200 h-20"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-slate-950/30 border-t border-slate-900 flex justify-end p-4">
            <Button
              type="submit"
              disabled={
                submitMut.isPending ||
                !formState.isValid ||
                children.length === 0 ||
                filledCount === 0
              }
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold min-w-32"
            >
              {submitMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Lưu {filledCount} điểm
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Score row — live border-color + check/x icon based on numeric validity
// ----------------------------------------------------------------------------

const ScoreRow = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { subject: string; value?: string }
>(function ScoreRow({ subject, value, ...inputProps }, ref) {
  const trimmed = (value ?? "").trim();
  const isEmpty = trimmed === "";
  const num = Number(trimmed.replace(",", "."));
  const valid = !isEmpty && Number.isFinite(num) && num >= 0 && num <= 10;
  const invalid = !isEmpty && !valid;

  return (
    <div className="flex items-center gap-2">
      <Label className="w-16 shrink-0 text-slate-300 text-sm" htmlFor={`s-${subject}`}>
        {subject}
      </Label>
      <div className="relative flex-1">
        <Input
          id={`s-${subject}`}
          inputMode="decimal"
          placeholder="0 – 10"
          ref={ref}
          aria-invalid={invalid ? "true" : undefined}
          aria-label={`Điểm ${subject}`}
          className={cn(
            "bg-slate-950/50 text-slate-100 pr-9",
            isEmpty && "border-slate-800",
            valid && "border-emerald-500/60 focus-visible:ring-emerald-500",
            invalid && "border-rose-500/60 focus-visible:ring-rose-500",
          )}
          {...inputProps}
        />
        {valid && (
          <Check className="absolute right-2 top-2.5 h-4 w-4 text-emerald-400 pointer-events-none" />
        )}
        {invalid && (
          <X className="absolute right-2 top-2.5 h-4 w-4 text-rose-400 pointer-events-none" />
        )}
      </div>
    </div>
  );
});
