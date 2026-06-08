/**
 * Mock AI responses used when GOOGLE_AI_API_KEY is not configured.
 * Keeps the UI rendering smoothly in dev / preview environments without
 * requiring a real API key.
 *
 * Every helper returns a payload identical in shape to what the real
 * Gemini-backed routes return, plus { aiConfigured: false }.
 */

export const AI_NOT_CONFIGURED_MESSAGE = "Gemini AI chưa được cấu hình";

export function hasGeminiKey(): boolean {
  const key = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!key) return false;
  // Reject common placeholder values from .env.example
  if (/^AIza\.\.\.?$/.test(key)) return false;
  if (key === "your_google_ai_key" || key === "changeme") return false;
  // Real Gemini API keys start with `AIza` and are ~39 chars long.
  if (!key.startsWith("AIza")) return false;
  if (key.length < 30) return false;
  return true;
}


// ---- analyze --------------------------------------------------------------

export function mockAnalysis(childName = "Học sinh") {
  return {
    summary: `Đây là báo cáo mẫu cho ${childName}. Em đang duy trì kết quả ổn định ở các môn chính; cần thêm điểm số thực tế để AI phân tích chính xác hơn.`,
    strengths: [
      "Toán — kỹ năng tính toán nhanh và chính xác",
      "Tiếng Anh — vốn từ vựng phong phú",
    ],
    weaknesses: [
      "Vật lý — phần Điện xoay chiều còn yếu",
      "Văn — kỹ năng phân tích văn bản tự sự",
    ],
    recommendations: [
      "Mỗi ngày làm 5 câu trắc nghiệm Vật lý chương Điện xoay chiều",
      "Đọc và tóm tắt 1 truyện ngắn / tuần",
      "Ôn từ vựng Anh 15 phút mỗi sáng theo Spaced Repetition",
    ],
    burnoutRisk: "low" as const,
    alerts: [
      {
        type: "info" as const,
        title: "Đang dùng dữ liệu mẫu",
        description: AI_NOT_CONFIGURED_MESSAGE + " — hãy thêm GOOGLE_AI_API_KEY vào .env.local.",
      },
    ],
    dnaUpdate: {
      visual: 72,
      auditory: 45,
      kinesthetic: 58,
      reading: 65,
    },
  };
}

// ---- coach ----------------------------------------------------------------

export function mockCoachReply(lastUserMessage: string) {
  return {
    role: "assistant" as const,
    content:
      `${AI_NOT_CONFIGURED_MESSAGE}. Đây là câu trả lời mẫu cho: "${lastUserMessage}". ` +
      "Khi bạn cấu hình GOOGLE_AI_API_KEY, AI Coach sẽ trả lời thực tế dựa trên ngữ cảnh học tập của con.",
    timestamp: new Date().toISOString(),
  };
}

// ---- dna ------------------------------------------------------------------

export function mockDnaUpdate(studentId?: string) {
  return {
    studentId: studentId ?? null,
    traits: { logic: 78, velocity: 72, retention: 68, focus: 65 },
    vark: { visual: 70, auditory: 45, kinesthetic: 55, reading: 60 },
    updatedAt: new Date().toISOString(),
    note: AI_NOT_CONFIGURED_MESSAGE,
  };
}

// ---- quiz-generate --------------------------------------------------------

const GDPT_LEVELS = ["nhan_biet", "thong_hieu", "van_dung", "van_dung_cao"] as const;
type GdptLevel = (typeof GDPT_LEVELS)[number];

export function mockQuizGeneration(args: {
  subject: string;
  grade: string;
  count: number;
  sourceSnippet?: string;
}) {
  const { subject, grade, count } = args;
  // Distribute GDPT levels roughly 30/40/20/10
  const distribution: Record<GdptLevel, number> = {
    nhan_biet: Math.round(count * 0.3),
    thong_hieu: Math.round(count * 0.4),
    van_dung: Math.round(count * 0.2),
    van_dung_cao: count - Math.round(count * 0.3) - Math.round(count * 0.4) - Math.round(count * 0.2),
  };
  const levelSequence: GdptLevel[] = [];
  (Object.entries(distribution) as Array<[GdptLevel, number]>).forEach(([lvl, n]) => {
    for (let i = 0; i < Math.max(0, n); i++) levelSequence.push(lvl);
  });
  while (levelSequence.length < count) levelSequence.push("thong_hieu");

  const questions = Array.from({ length: count }, (_, idx) => {
    const level = levelSequence[idx];
    const correct = ["A", "B", "C", "D"][idx % 4];
    return {
      order_index: idx + 1,
      question_text: `[Mẫu] Câu hỏi ${idx + 1} về ${subject} lớp ${grade} — mức ${level.replace("_", " ")}.`,
      question_type: "multiple_choice" as const,
      options: [
        { key: "A", text: `Phương án A của câu ${idx + 1}` },
        { key: "B", text: `Phương án B của câu ${idx + 1}` },
        { key: "C", text: `Phương án C của câu ${idx + 1}` },
        { key: "D", text: `Phương án D của câu ${idx + 1}` },
      ],
      correct_answer: correct,
      explanation: `Giải thích mẫu cho câu ${idx + 1}. ${AI_NOT_CONFIGURED_MESSAGE}.`,
      gdpt_level: level,
      difficulty: Math.min(5, Math.max(1, Math.ceil((idx + 1) / Math.max(1, Math.floor(count / 5))))),
    };
  });

  return {
    title: `[Mẫu] Bộ câu hỏi ${subject} — Lớp ${grade}`,
    subject,
    grade,
    total_questions: questions.length,
    estimated_minutes: Math.max(5, questions.length * 1.5),
    gdpt_level_distribution: {
      nhan_biet: 30,
      thong_hieu: 40,
      van_dung: 20,
      van_dung_cao: 10,
    },
    questions,
    note: AI_NOT_CONFIGURED_MESSAGE,
  };
}
