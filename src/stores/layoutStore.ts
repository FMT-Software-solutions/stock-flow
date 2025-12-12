import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LayoutMode = 'sidebar' | 'topnav' | 'stacked' | 'grid';

interface LayoutState {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layoutMode: 'sidebar',
      setLayoutMode: (mode) => set({ layoutMode: mode }),
    }),
    {
      name: 'layout-storage',
    }
  )
);
