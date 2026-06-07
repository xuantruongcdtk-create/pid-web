import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChildStore {
  selectedChildId: string | null;
  setSelectedChild: (id: string | null) => void;
  /** Reset on logout. */
  reset: () => void;
}

export const useChildStore = create<ChildStore>()(
  persist(
    (set) => ({
      selectedChildId: null,
      setSelectedChild: (id) => set({ selectedChildId: id }),
      reset: () => set({ selectedChildId: null }),
    }),
    { name: "pid-selected-child" },
  ),
);
