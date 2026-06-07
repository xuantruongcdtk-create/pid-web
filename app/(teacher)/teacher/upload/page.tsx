"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  FileText,
  FileUp,
  Loader2,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { QuizShareModal } from "@/components/teacher/QuizShareModal";

type Step = 1 | 2 | 3 | 4;

interface GeneratedQuestion {
  order_index: number;
  question_text: string;
  question_type: "multiple_choice";
  options: Array<{ key: string; text: string }>;
  correct_answer: string;
  explanation: string;
  gdpt_level: "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao";
  difficulty: number;
}

const MIN_TEXT_LENGTH = 100;

const SUBJECTS = [
  { value: "Toán", label: "Toán học" },
  { value: "Văn", label: "Ngữ văn" },
  { value: "Anh", label: "Tiếng Anh" },
  { value: "Lý", label: "Vật lý" },
  { value: "Hóa", label: "Hóa học" },
  { value: "Sinh", label: "Sinh học" },
  { value: "Sử", label: "Lịch sử" },
  { value: "Địa", label: "Địa lý" },
];

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];
const COUNTS = [5, 10, 15, 20] as const;

const LEVEL_LABEL: Record<GeneratedQuestion["gdpt_level"], string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Nguồn nội dung" },
  { id: 2, label: "Xem & sửa" },
  { id: 3, label: "Cấu hình" },
  { id: 4, label: "Xuất bản & chia sẻ" },
];

export default function TeacherUploadPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<Step>(1);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");

  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [extractedText, setExtractedText] = useState("");

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Toán");
  const [grade, setGrade] = useState("11");
  const [count, setCount] = useState<5 | 10 | 15 | 20>(10);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const uploadPdfMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/pdf/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Không đọc được PDF");
      return json.data as { text: string; pages: number; filename: string };
    },
    onSuccess: (data) => {
      setExtractedText(data.text);
      setStep(2);
      toast.success(`Đã đọc ${data.pages} trang`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi khi tải PDF"),
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/quiz-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          grade,
          count,
          sourceText: extractedText,
          title: title.trim() || undefined,
          persist: true,
          bypassCredits: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? json.error ?? "Tạo đề thất bại");
      }
      return json as {
        success: true;
        aiConfigured: boolean;
        data: { questions: GeneratedQuestion[]; quiz_id: string | null; title: string };
      };
    },
    onSuccess: (json) => {
      setQuestions(json.data.questions);
      setQuizId(json.data.quiz_id);
      setTitle((t) => t || json.data.title);
      setAiConfigured(json.aiConfigured);
      setStep(4);
      if (!json.aiConfigured) toast.warning("Dùng dữ liệu mẫu (AI chưa cấu hình)");
      else toast.success(`Đã tạo ${json.data.questions.length} câu hỏi`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Lỗi khi tạo đề"),
  });

  function goToStep2() {
    if (inputMode === "pdf") {
      if (!file) return toast.error("Hãy chọn file PDF");
      uploadPdfMut.mutate(file);
    } else {
      if (pastedText.trim().length < MIN_TEXT_LENGTH)
        return toast.error(`Cần ít nhất ${MIN_TEXT_LENGTH} ký tự`);
      setExtractedText(pastedText.trim());
      setStep(2);
    }
  }

  function goToStep3() {
    if (extractedText.trim().length < MIN_TEXT_LENGTH) {
      return toast.error(`Văn bản cần ít nhất ${MIN_TEXT_LENGTH} ký tự`);
    }
    setStep(3);
  }

  async function publishAndShare() {
    if (!quizId) {
      toast.error("Chưa có quiz để xuất bản");
      return;
    }
    setPublishing(true);
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .update({ status: "published", is_public: true })
        .eq("id", quizId)
        .select("share_code")
        .single();
      if (error) throw error;
      setShareCode(data?.share_code ?? null);
      setShareOpen(true);
      toast.success("Đã xuất bản — link công khai sẵn sàng");
    } catch (e: any) {
      toast.error(e?.message ?? "Không xuất bản được");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-emerald-400 animate-pulse" />
          Tạo & chia sẻ quiz cho lớp
        </h2>
        <p className="text-slate-400 text-sm">
          Upload tài liệu (PDF) hoặc dán văn bản → AI soạn theo GDPT 2018 → xuất bản → gửi link Zalo.
        </p>
      </div>

      <StepIndicator step={step} />

      {step === 1 && (
        <Step1
          inputMode={inputMode}
          setInputMode={setInputMode}
          file={file}
          setFile={setFile}
          pastedText={pastedText}
          setPastedText={setPastedText}
          uploading={uploadPdfMut.isPending}
          onNext={goToStep2}
        />
      )}

      {step === 2 && (
        <Step2
          text={extractedText}
          setText={setExtractedText}
          onBack={() => setStep(1)}
          onNext={goToStep3}
        />
      )}

      {step === 3 && (
        <Step3
          title={title}
          setTitle={setTitle}
          subject={subject}
          setSubject={setSubject}
          grade={grade}
          setGrade={setGrade}
          count={count}
          setCount={setCount}
          generating={generateMut.isPending}
          onBack={() => setStep(2)}
          onGenerate={() => generateMut.mutate()}
        />
      )}

      {step === 4 && (
        <Step4
          title={title}
          questions={questions}
          aiConfigured={aiConfigured}
          publishing={publishing}
          quizId={quizId}
          shareCode={shareCode}
          onBack={() => setStep(3)}
          onPublishAndShare={publishAndShare}
          onOpenShare={() => setShareOpen(true)}
          onDone={() => router.push("/teacher")}
        />
      )}

      <QuizShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareCode={shareCode ?? ""}
        title={title}
        subject={subject}
        grade={grade}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {STEPS.map((s) => {
        const done = step > s.id;
        const active = step === s.id;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors",
              active && "bg-emerald-950/40 border-emerald-500/40 text-emerald-200",
              done && "bg-emerald-950/30 border-emerald-700/40 text-emerald-200",
              !active && !done && "bg-slate-900/40 border-slate-900 text-slate-500",
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : active ? (
              <CircleDot className="h-4 w-4 text-emerald-400" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-slate-700 inline-block" />
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-mono text-slate-500">
                Bước {s.id}
              </div>
              <div className="text-xs font-semibold truncate">{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Step1(props: {
  inputMode: "pdf" | "text";
  setInputMode: (m: "pdf" | "text") => void;
  file: File | null;
  setFile: (f: File | null) => void;
  pastedText: string;
  setPastedText: (s: string) => void;
  uploading: boolean;
  onNext: () => void;
}) {
  const { inputMode, setInputMode, file, setFile, pastedText, setPastedText, uploading, onNext } = props;
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-200 text-base">1. Cung cấp nội dung</CardTitle>
        <CardDescription className="text-slate-500">PDF hoặc dán văn bản.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-900 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode("pdf")}
            className={cn(
              "py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2",
              inputMode === "pdf" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-200",
            )}
          >
            <FileUp className="h-4 w-4" /> Tải PDF
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={cn(
              "py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2",
              inputMode === "text" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-200",
            )}
          >
            <FileText className="h-4 w-4" /> Dán văn bản
          </button>
        </div>

        {inputMode === "pdf" ? (
          <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/20 relative">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 mb-3">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-slate-300 text-sm font-semibold mb-1">
              {file ? file.name : "Kéo thả hoặc nhấp để chọn file PDF"}
            </p>
            <p className="text-xs text-slate-500">PDF tối đa 10MB</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="paste" className="text-slate-300">
              Văn bản nguồn
            </Label>
            <Textarea
              id="paste"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Dán đề cương / tóm tắt chương (≥ 100 ký tự)"
              className="h-44 bg-slate-950/50 border-slate-800 text-slate-200 focus-visible:ring-emerald-600"
            />
            <p className="text-[11px] text-slate-500 text-right">
              {pastedText.length} / {MIN_TEXT_LENGTH} ký tự tối thiểu
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-slate-950/30 border-t border-slate-900 justify-end p-4">
        <Button
          onClick={onNext}
          disabled={uploading || (inputMode === "pdf" ? !file : pastedText.trim().length < MIN_TEXT_LENGTH)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang đọc PDF…
            </>
          ) : (
            <>
              Tiếp tục <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step2(props: {
  text: string;
  setText: (s: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { text, setText, onBack, onNext } = props;
  const tooShort = text.trim().length < MIN_TEXT_LENGTH;
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-200 text-base">2. Xem & chỉnh sửa nội dung</CardTitle>
        <CardDescription className="text-slate-500">
          Xoá header / mục lục / chú thích trước khi AI soạn đề.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={cn(
            "h-72 bg-slate-950/50 border-slate-800 text-slate-200 font-mono text-xs focus-visible:ring-emerald-600",
            tooShort && "border-rose-700/60 focus-visible:ring-rose-500",
          )}
        />
        <div className="flex justify-between text-[11px] mt-2">
          <span className={tooShort ? "text-rose-400" : "text-slate-500"}>
            {tooShort ? `Cần ít nhất ${MIN_TEXT_LENGTH} ký tự` : "Đủ nội dung"}
          </span>
          <span className="text-slate-500 tabular-nums">{text.length} ký tự</span>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-950/30 border-t border-slate-900 justify-between p-4">
        <Button variant="outline" onClick={onBack} className="border-slate-800 text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
        <Button onClick={onNext} disabled={tooShort} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          Tiếp tục <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step3(props: {
  title: string;
  setTitle: (s: string) => void;
  subject: string;
  setSubject: (s: string) => void;
  grade: string;
  setGrade: (s: string) => void;
  count: 5 | 10 | 15 | 20;
  setCount: (n: 5 | 10 | 15 | 20) => void;
  generating: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const {
    title,
    setTitle,
    subject,
    setSubject,
    grade,
    setGrade,
    count,
    setCount,
    generating,
    onBack,
    onGenerate,
  } = props;
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-200 text-base">3. Cấu hình bộ đề</CardTitle>
        <CardDescription className="text-slate-500">
          Giáo viên không bị trừ credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-title" className="text-slate-300">
            Tiêu đề (tuỳ chọn)
          </Label>
          <Input
            id="t-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vd: KT 15 phút — Hàm số bậc nhất"
            className="bg-slate-950/50 border-slate-800 text-slate-200"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Môn học</Label>
            <Select value={subject} onValueChange={(v) => v && setSubject(v)}>
              <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                {SUBJECTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Lớp</Label>
            <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
              <SelectTrigger className="bg-slate-950/50 border-slate-800 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    Lớp {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Số câu</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "h-9 rounded-md text-sm font-semibold border transition-colors",
                    count === n
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-900",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-950/30 border-t border-slate-900 justify-between p-4">
        <Button variant="outline" onClick={onBack} className="border-slate-800 text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
        <Button
          onClick={onGenerate}
          disabled={generating}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold min-w-40"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI đang soạn đề…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Tạo {count} câu
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Step4(props: {
  title: string;
  questions: GeneratedQuestion[];
  aiConfigured: boolean | null;
  publishing: boolean;
  quizId: string | null;
  shareCode: string | null;
  onBack: () => void;
  onPublishAndShare: () => void;
  onOpenShare: () => void;
  onDone: () => void;
}) {
  const {
    title,
    questions,
    aiConfigured,
    publishing,
    quizId,
    shareCode,
    onBack,
    onPublishAndShare,
    onOpenShare,
    onDone,
  } = props;
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-slate-200 text-base line-clamp-1">
              {title || "Bộ đề mới"}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {questions.length} câu · {quizId ? "Đã lưu nháp" : "Chưa lưu"}
              {shareCode && ` · Mã chia sẻ ${shareCode}`}
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            {aiConfigured === false && (
              <Badge className="bg-amber-950/60 border border-amber-900 text-amber-400">
                Dữ liệu mẫu
              </Badge>
            )}
            {shareCode ? (
              <Button onClick={onOpenShare} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <Share2 className="h-4 w-4 mr-2" /> Mở hộp chia sẻ
              </Button>
            ) : (
              <Button
                onClick={onPublishAndShare}
                disabled={publishing || !quizId}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold"
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang xuất bản…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" /> Xuất bản & chia sẻ
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionPreview key={i} index={i} q={q} />
        ))}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="border-slate-800 text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Cấu hình lại
        </Button>
        <div className="flex gap-2">
          <Button onClick={onDone} variant="outline" className="border-slate-800 text-slate-300">
            Về bảng GV
          </Button>
          {quizId && (
            <Link
              href={`/quiz/${quizId}`}
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-indigo-600 hover:bg-indigo-500 text-white",
              )}
            >
              Xem preview <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionPreview({ index, q }: { index: number; q: GeneratedQuestion }) {
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
          <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
            {LEVEL_LABEL[q.gdpt_level]}
          </Badge>
          <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
            Độ khó {q.difficulty}/5
          </Badge>
        </div>
        <span className="text-xs text-emerald-400 font-semibold">Đáp án: {q.correct_answer}</span>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-slate-100 font-semibold">{q.question_text}</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-300">
          {q.options.map((opt) => (
            <li
              key={opt.key}
              className={cn(
                "p-2 rounded-md border",
                opt.key === q.correct_answer
                  ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-200"
                  : "bg-slate-950/40 border-slate-800",
              )}
            >
              <span className="font-mono mr-2">{opt.key}.</span>
              {opt.text}
            </li>
          ))}
        </ul>
        {q.explanation && (
          <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-900">
            💡 {q.explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
