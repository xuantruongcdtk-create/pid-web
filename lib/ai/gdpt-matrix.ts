export interface GDPTTopic {
  id: string;
  name: string;
  grade: number;
  cognitiveLevels: {
    recognize: string;
    comprehend: string;
    apply: string;
    highlyApply: string;
  };
}

export const GDPT_MATRIX: Record<string, GDPTTopic[]> = {
  math: [
    {
      id: "math-11-functions",
      name: "Hàm số lượng giác và phương trình lượng giác",
      grade: 11,
      cognitiveLevels: {
        recognize: "Nhận biết công thức lượng giác cơ bản, định nghĩa hàm số tuần hoàn.",
        comprehend: "Tìm tập xác định, tập giá trị, chu kỳ của hàm số lượng giác.",
        apply: "Giải các phương trình lượng giác cơ bản và đưa về dạng cơ bản.",
        highlyApply: "Giải bài toán thực tế sử dụng phương trình lượng giác, tìm cực trị hàm lượng giác."
      }
    },
    {
      id: "math-11-limits",
      name: "Giới hạn. Hàm số liên tục",
      grade: 11,
      cognitiveLevels: {
        recognize: "Định nghĩa giới hạn dãy số, giới hạn hàm số.",
        comprehend: "Tính giới hạn cơ bản dạng vô định (0/0, vô cùng/vô cùng).",
        apply: "Xét tính liên tục của hàm số tại một điểm hoặc trên một khoảng.",
        highlyApply: "Ứng dụng giới hạn giải quyết các bài toán tiệm cận và thực tế phức tạp."
      }
    }
  ],
  physics: [
    {
      id: "physics-11-oscillations",
      name: "Dao động cơ",
      grade: 11,
      cognitiveLevels: {
        recognize: "Định nghĩa dao động điều hòa, li độ, biên độ, tần số góc.",
        comprehend: "Tính chu kỳ, tần số của con lắc lò xo và con lắc đơn.",
        apply: "Viết phương trình dao động, tính năng lượng dao động điều hòa.",
        highlyApply: "Bài tập tổng hợp hai dao động, dao động tắt dần, cộng hưởng."
      }
    }
  ]
};
