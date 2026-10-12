import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketingTabKey } from '@/config/marketing-nav';

interface MarketingNavStore {
  /** The last top-nav tab the user worked in, so the sidebar keeps its items on pages outside any tab. */
  lastTab: MarketingTabKey | null;
  setLastTab: (tab: MarketingTabKey) => void;
}

export const useMarketingNavStore = create<MarketingNavStore>()(
  persist(
    (set) => ({
      lastTab: null,
      setLastTab: (lastTab) => set({ lastTab }),
    }),
    { name: 'marketing-nav-store' },
  ),
);
