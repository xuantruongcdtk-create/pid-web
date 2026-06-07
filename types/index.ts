export interface Student {
  id: string;
  name: string;
  grade: string;
  class?: string;
  avatarUrl?: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  children: Student[];
}

export interface Score {
  id: string;
  studentId: string;
  subject: string;
  type: "15min" | "1period" | "midterm" | "final";
  value: number;
  date: string;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  grade: string;
  questions: Question[];
  duration?: string;
  difficulty?: "Dễ" | "Trung bình" | "Khó";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  imageUrl?: string;
}
