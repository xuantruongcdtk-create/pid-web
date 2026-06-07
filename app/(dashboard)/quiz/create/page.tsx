"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
  Check,
  CheckCircle2,
  CircleDot,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3 | 4;
type StepStatus = "pending" | "active" | "done";

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

export default function CreateQuizPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  // -- Profile (credits gate)
  const profileQ = useQuery({
    queryKey: ["profile-credits"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("plan, credits")
        .eq("id", user.id)
        .maybeSingle();
      return data as { plan: string | null; credits: number | null } | null;
    },
    staleTime: 30_000,
  });

  const credits = profileQ.data?.credits ?? null;
  const plan = profileQ.data?.plan ?? null;
  const hasUnlimited = plan === "teacher_pro" || plan === "premium";
  const canGenerate = hasUnlimited || (credits ?? 0) > 0;

  // -- Step state
  const [step, setStep] = useState<Step>(1);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");

  // Step 1: source input
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");

  // Step 2: extracted text (editable)
  const [extractedText, setExtractedText] = useState("");

  // Step 3: config
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Toán");
  const [grade, setGrade] = useState("11");
  const [count, setCount] = useState<5 | 10 | 15 | 20>(10);

  // Step 4: review
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // ---- Mutations ---------------------------------------------------------

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
      toast.success(`Đã đọc ${data.pages} trang PDF`);
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
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const err = new Error(json.message ?? json.error ?? "Tạo đề thất bại");
        (err as any).code = json.error;
        throw err;
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
      setAiConfigured(json.aiConfigured);
      setTitle((t) => t || json.data.title);
      setStep(4);
      if (!json.aiConfigured) toast.warning("Dùng dữ liệu mẫu (AI chưa được cấu hình)");
      else toast.success(`Đã tạo ${json.data.questions.length} câu hỏi`);
    },
    onError: (e: any) => {
      if (e?.code === "no_credits") toast.error("Bạn đã hết credits. Hãy nâng cấp gói.");
      else if (e?.code === "rate_limited") toast.error(e.message);
      else toast.error(e?.message ?? "Lỗi khi tạo đề");
    },
  });

  // ---- Step transition helpers ------------------------------------------

  const goToStep2 = () => {
    if (inputMode === "pdf") {
      if (!file) return toast.error("Hãy chọn file PDF");
      uploadPdfMut.mutate(file);
    } else {
      if (pastedText.trim().length < MIN_TEXT_LENGTH)
        return toast.error(`Cần ít nhất ${MIN_TEXT_LENGTH} ký tự`);
      setExtractedText(pastedText.trim());
      setStep(2);
    }
  };

  const goToStep3 = () => {
    if (extractedText.trim().length < MIN_TEXT_LENGTH) {
      return toast.error(`Văn bản cần ít nhất ${MIN_TEXT_LENGTH} ký tự`);
    }
    setStep(3);
  };

  const confirmGenerate = () => {
    if (!canGenerate) {
      toast.error("Bạn đã hết credits");
      return;
    }
    generateMut.mutate();
  };

  // ---- UI ---------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <Header />

      <StepIndicator step={step} />

      <CreditsBanner credits={credits} plan={plan} hasUnlimited={hasUnlimited} />

      {step === 1 && (
        <Step1
          inputMode={inputMode}
          setInputMode={setInputMode}
          file={file}
          setFile={setFile}
          pastedText={pastedText}
          setPastedText={setPastedText}
          onNext={goToStep2}
          uploading={uploadPdfMut.isPending}
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
          canGenerate={canGenerate}
          generating={generateMut.isPending}
          onBack={() => setStep(2)}
          onGenerate={confirmGenerate}
        />
      )}

      {step === 4 && (
        <Step4
          title={title}
          questions={questions}
          aiConfigured={aiConfigured}
          quizId={quizId}
          onBack={() => setStep(3)}
          onSaveAndExit={() => router.push("/quiz")}
          onTry={() => quizId && router.push(`/quiz/${quizId}`)}
          updateQuestion={(idx, patch) =>
            setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
          }
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Header + step indicator
// ----------------------------------------------------------------------------

function Header() {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-indigo-400 animate-pulse" />
        Tạo bài tập tự động bằng AI
      </h2>
      <p className="text-slate-400 text-sm">
        Tải lên file tài liệu (PDF) hoặc dán văn bản — AI sẽ soạn bộ câu hỏi theo Chương trình GDPT 2018.
      </p>
    </div>
  );
}

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Nguồn nội dung" },
  { id: 2, label: "Xem & chỉnh sửa" },
  { id: 3, label: "Cấu hình" },
  { id: 4, label: "Xem trước & lưu" },
];

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {STEPS.map((s) => {
        const status: StepStatus = step > s.id ? "done" : step === s.id ? "active" : "pending";
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border p-3 flex items-center gap-2 text-sm transition-colors",
              status === "active" && "bg-indigo-950/40 border-indigo-500/40 text-indigo-200",
              status === "done" && "bg-emerald-950/30 border-emerald-700/40 text-emerald-200",
              status === "pending" && "bg-slate-900/40 border-slate-900 text-slate-500",
            )}
          >
            {status === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : status === "active" ? (
              <CircleDot className="h-4 w-4 text-indigo-400" />
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

function CreditsBanner({
  credits,
  plan,
  hasUnlimited,
}: {
  credits: number | null;
  plan: string | null;
  hasUnlimited: boolean;
}) {
  if (hasUnlimited) {
    return (
      <Card className="bg-emerald-950/30 border-emerald-900/60">
        <CardContent className="p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Gói {plan} — tạo đề không giới hạn.
        </CardContent>
      </Card>
    );
  }
  if (credits === null) return null;
  return (
    <Card
      className={cn(
        "border",
        credits > 0
          ? "bg-indigo-950/30 border-indigo-900/60"
          : "bg-rose-950/30 border-rose-900/60",
      )}
    >
      <CardContent className="p-3 text-xs flex items-center justify-between gap-2">
        <span className={credits > 0 ? "text-indigo-300" : "text-rose-300"}>
          Credits còn lại: <strong>{credits}</strong>{" "}
          {credits > 0
            ? "— mỗi lần tạo đề sẽ trừ 1 credit."
            : "— mua thêm credits để tiếp tục."}
        </span>
        {credits <= 0 && (
          <a
            href="/settings"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "border-rose-800 text-rose-300 hover:bg-rose-900/40",
            )}
          >
            Mua credits
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 1 — source input
// ----------------------------------------------------------------------------

function Step1(props: {
  inputMode: "pdf" | "text";
  setInputMode: (m: "pdf" | "text") => void;
  file: File | null;
  setFile: (f: File | null) => void;
  pastedText: string;
  setPastedText: (s: string) => void;
  onNext: () => void;
  uploading: boolean;
}) {
  const { inputMode, setInputMode, file, setFile, pastedText, setPastedText, onNext, uploading } =
    props;
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-200 text-base">1. Cung cấp nội dung</CardTitle>
        <CardDescription className="text-slate-500">
          Chọn PDF từ máy tính hoặc dán văn bản trực tiếp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-900 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode("pdf")}
            className={cn(
              "py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2",
              inputMode === "pdf"
                ? "bg-slate-900 text-white"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <FileUp className="h-4 w-4" /> Tải PDF
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={cn(
              "py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2",
              inputMode === "text"
                ? "bg-slate-900 text-white"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <FileText className="h-4 w-4" /> Dán văn bản
          </button>
        </div>

        {inputMode === "pdf" ? (
          <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/20 relative">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 mb-3">
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
              placeholder="Dán đoạn lý thuyết, tóm tắt chương, đề cương… (≥ 100 ký tự)"
              className="h-44 bg-slate-950/50 border-slate-800 text-slate-200 focus-visible:ring-indigo-600"
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
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
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

// ----------------------------------------------------------------------------
// Step 2 — preview / edit extracted text
// ----------------------------------------------------------------------------

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
          Rà soát văn bản — bạn có thể xoá phần header, mục lục… trước khi AI soạn đề.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={cn(
            "h-72 bg-slate-950/50 border-slate-800 text-slate-200 font-mono text-xs focus-visible:ring-indigo-600",
            tooShort && "border-rose-700/60 focus-visible:ring-rose-500",
          )}
        />
        <div className="flex justify-between text-[11px] mt-2">
          <span className={tooShort ? "text-rose-400" : "text-slate-500"}>
            {tooShort ? `Cần ít nhất ${MIN_TEXT_LENGTH} ký tự` : "Nội dung đủ để soạn đề"}
          </span>
          <span className="text-slate-500 tabular-nums">{text.length} ký tự</span>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-950/30 border-t border-slate-900 justify-between p-4">
        <Button variant="outline" onClick={onBack} className="border-slate-800 text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
        </Button>
        <Button
          onClick={onNext}
          disabled={tooShort}
          className="bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          Tiếp tục <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 3 — config + final confirm to generate (credits deducted here)
// ----------------------------------------------------------------------------

function Step3(props: {
  title: string;
  setTitle: (s: string) => void;
  subject: string;
  setSubject: (s: string) => void;
  grade: string;
  setGrade: (s: string) => void;
  count: 5 | 10 | 15 | 20;
  setCount: (n: 5 | 10 | 15 | 20) => void;
  canGenerate: boolean;
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
    canGenerate,
    generating,
    onBack,
    onGenerate,
  } = props;
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader>
        <CardTitle className="text-slate-200 text-base">3. Cấu hình bộ đề</CardTitle>
        <CardDescription className="text-slate-500">
          Chọn môn, lớp và số câu. Credits chỉ bị trừ khi bấm <strong>Tạo đề</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-slate-300">
            Tiêu đề bộ đề (tuỳ chọn)
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vd: Kiểm tra 15 phút — Hàm số bậc nhất"
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
                      ? "bg-indigo-600 border-indigo-500 text-white"
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
          disabled={!canGenerate || generating}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-600/10 min-w-40"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI đang soạn đề…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Tạo {count} câu (−1 credit)
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Step 4 — review + edit generated questions
// ----------------------------------------------------------------------------

function Step4(props: {
  title: string;
  questions: GeneratedQuestion[];
  aiConfigured: boolean | null;
  quizId: string | null;
  onBack: () => void;
  onSaveAndExit: () => void;
  onTry: () => void;
  updateQuestion: (idx: number, patch: Partial<GeneratedQuestion>) => void;
}) {
  const { title, questions, aiConfigured, quizId, onBack, onSaveAndExit, onTry, updateQuestion } =
    props;
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/40 border-slate-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-slate-200 text-base">{title || "Bộ đề mới"}</CardTitle>
            <CardDescription className="text-slate-500">
              {questions.length} câu hỏi · {quizId ? "Đã lưu vào thư viện" : "Chưa lưu"}
            </CardDescription>
          </div>
          {aiConfigured === false && (
            <Badge className="bg-amber-950/60 border border-amber-900 text-amber-400">
              Dữ liệu mẫu (chưa cấu hình AI)
            </Badge>
          )}
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionEditor key={i} index={i} q={q} update={(patch) => updateQuestion(i, patch)} />
        ))}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="border-slate-800 text-slate-300">
          <ArrowLeft className="h-4 w-4 mr-2" /> Cấu hình lại
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onSaveAndExit}
            className="border-slate-800 text-slate-300"
          >
            <Check className="h-4 w-4 mr-2" /> Về thư viện
          </Button>
          {quizId && (
            <Button onClick={onTry} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Làm thử ngay <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  q,
  update,
}: {
  index: number;
  q: GeneratedQuestion;
  update: (patch: Partial<GeneratedQuestion>) => void;
}) {
  return (
    <Card className="bg-slate-900/40 border-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
            <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
              {LEVEL_LABEL[q.gdpt_level]}
            </Badge>
            <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
              Độ khó {q.difficulty}/5
            </Badge>
          </div>
          <span className="text-xs text-emerald-400 font-semibold">
            Đáp án: {q.correct_answer}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={q.question_text}
          onChange={(e) => update({ question_text: e.target.value })}
          className="bg-slate-950/50 border-slate-800 text-slate-100 text-sm"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt, oi) => (
            <div key={opt.key} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => update({ correct_answer: opt.key })}
                className={cn(
                  "shrink-0 h-7 w-7 rounded-md font-bold text-xs",
                  q.correct_answer === opt.key
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-900",
                )}
              >
                {opt.key}
              </button>
              <Input
                value={opt.text}
                onChange={(e) =>
                  update({
                    options: q.options.map((o, j) =>
                      j === oi ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
                className="bg-slate-950/50 border-slate-800 text-slate-200 text-sm"
              />
            </div>
          ))}
        </div>
        <Textarea
          value={q.explanation}
          onChange={(e) => update({ explanation: e.target.value })}
          placeholder="Giải thích đáp án"
          className="h-20 bg-slate-950/50 border-slate-800 text-slate-300 text-xs"
        />
      </CardContent>
    </Card>
  );
}
