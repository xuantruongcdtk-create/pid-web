import { create } from "zustand";

interface AppState {
  activeChildId: string | null;
  setActiveChildId: (id: string | null) => void;
  recentQuizzesCount: number;
  incrementQuizzesCount: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChildId: "child-1",
  setActiveChildId: (id) => set({ activeChildId: id }),
  recentQuizzesCount: 24,
  incrementQuizzesCount: () => set((state) => ({ recentQuizzesCount: state.recentQuizzesCount + 1 })),
}));
