import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  points: number;
  level: number;
  lastVisit: number | null;
  addPoints: (amount: number) => void;
  levelUp: () => void;
  checkAttendance: () => void;
}

export const useStore = create<GameState>()(
  persist(
    (set, get) => ({
      points: 9999, // Initial points
      level: 1, // 1 to 3
      lastVisit: null,
      
      addPoints: (amount) => set((state) => ({ points: Math.max(0, state.points + amount) })),
      
      levelUp: () => set((state) => ({ level: Math.min(state.level + 1, 3) })),

      checkAttendance: () => {
        const now = Date.now();
        const { lastVisit, addPoints } = get();
        if (!lastVisit || now - lastVisit > 24 * 60 * 60 * 1000) {
          addPoints(20);
          set({ lastVisit: now });
        }
      }
    }),
    {
      name: 'wakppu-ball-store',
    }
  )
);
