export const ANALYZE_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích học tập theo chương trình GDPT 2018 của Việt Nam.

Nhiệm vụ: phân tích bảng điểm và tâm trạng học tập của một học sinh, sau đó TRẢ VỀ ĐÚNG JSON theo schema được yêu cầu — không thêm văn bản thừa, không bọc trong markdown.

Tiêu chí:
- summary: 2–3 câu, tiếng Việt, gọn, nêu xu hướng chung.
- strengths: 2–4 mục, mỗi mục là chuỗi ngắn, dạng "Môn — điểm mạnh cụ thể".
- weaknesses: 2–4 mục, định dạng tương tự.
- recommendations: 3–5 hành động ngắn, có thể thực thi trong 1 tuần.
- burnoutRisk: "low" | "medium" | "high" — căn cứ vào điểm tụt nhiều môn cùng lúc, tâm trạng thấp, hoặc số ngày học liên tục cao.
- alerts: 0–4 mục cảnh báo cha mẹ. Mỗi alert có { type: 'warning'|'success'|'info', title, description }.
- dnaUpdate: object phong cách học VARK với 4 trường visual, auditory, kinesthetic, reading — mỗi giá trị 0–100 (tổng KHÔNG cần bằng 100), suy đoán từ pattern điểm + ghi chú.

Trả về JSON object thuần với CHÍNH XÁC các key: summary, strengths, weaknesses, recommendations, burnoutRisk, alerts, dnaUpdate.`;

export function buildAnalyzeUserPrompt(args: {
  childName: string;
  grade: string;
  scores: Array<{
    subject: string;
    score: number;
    exam_type: string | null;
    exam_date: string;
    mood_rating: number | null;
    notes: string | null;
  }>;
  previousDnaProfile: Record<string, number> | null;
}) {
  const scoreLines = args.scores
    .map(
      (s) =>
        `- ${s.exam_date} | ${s.subject} | ${s.score}/10 | loại: ${s.exam_type ?? 'regular'}${
          s.mood_rating ? ` | mood: ${s.mood_rating}/5` : ''
        }${s.notes ? ` | ghi chú: ${s.notes}` : ''}`,
    )
    .join('\n');

  return `Học sinh: ${args.childName} — Lớp ${args.grade}
Số bản ghi điểm: ${args.scores.length}

Bảng điểm gần đây:
${scoreLines || '(chưa có dữ liệu)'}

DNA học tập hiện tại (nếu có): ${
    args.previousDnaProfile ? JSON.stringify(args.previousDnaProfile) : '(chưa có)'
  }

Hãy phân tích và trả về JSON theo schema đã quy định.`;
}
