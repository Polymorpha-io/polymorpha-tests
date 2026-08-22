import { create } from "zustand";

export interface UserStats {
  totalUploads: number;
  totalExports: number;
  totalStorageBytes: number;
  datasetsAnalysed: number;
  totalRowsProcessed: number;
  totalColumnsProcessed: number;
  testsRun: number;
}

const initialStats: UserStats = {
  totalUploads: 0,
  totalExports: 0,
  totalStorageBytes: 0,
  datasetsAnalysed: 0,
  totalRowsProcessed: 0,
  totalColumnsProcessed: 0,
  testsRun: 0,
};

interface UsageStatsStore {
  stats: UserStats;
  setStats: (data: Partial<UserStats>) => void;
  reset: () => void;
}

export const useUsageStatsStore = create<UsageStatsStore>((set) => ({
  stats: { ...initialStats },
  setStats: (data) =>
    set((state) => ({
      stats: { ...state.stats, ...data },
    })),
  reset: () => set({ stats: { ...initialStats } }),
}));
