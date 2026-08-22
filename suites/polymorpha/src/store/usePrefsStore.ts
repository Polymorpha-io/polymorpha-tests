import { create } from "zustand";
import { readStorageJson, writeStorageValue } from "@/lib/storage";

export type StatsLevel = "basic" | "advanced" | "professional";

interface PrefsStore {
  decimalPlaces: number;
  statsLevel: StatsLevel;
  setDecimalPlaces: (dp: number) => void;
  setStatsLevel: (level: StatsLevel) => void;
  hydrate: () => void;
  reset: () => void;
}

const STORAGE_KEY = "polymorpha-user-prefs";

function loadFromStorage(): { decimalPlaces: number; statsLevel: StatsLevel } {
  const parsed = readStorageJson<{
    decimalPlaces?: number;
    statsLevel?: StatsLevel;
  } | null>(STORAGE_KEY, null);
  if (parsed) {
    return {
      decimalPlaces: parsed.decimalPlaces ?? 3,
      statsLevel: parsed.statsLevel ?? "basic",
    };
  }
  return { decimalPlaces: 3, statsLevel: "basic" };
}

function persist(state: { decimalPlaces: number; statsLevel: StatsLevel }) {
  writeStorageValue(STORAGE_KEY, JSON.stringify(state));
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  ...loadFromStorage(),
  setDecimalPlaces: (dp) => {
    set({ decimalPlaces: dp });
    persist({ decimalPlaces: dp, statsLevel: get().statsLevel });
  },
  setStatsLevel: (level) => {
    set({ statsLevel: level });
    persist({ decimalPlaces: get().decimalPlaces, statsLevel: level });
  },
  hydrate: () => {
    const loaded = loadFromStorage();
    set(loaded);
  },
  reset: () => {
    const defaults = { decimalPlaces: 3, statsLevel: "basic" as StatsLevel };
    set(defaults);
    persist(defaults);
  },
}));

/** Format a number respecting the user's decimal places preference. */
export function fmtNum(n: number | null | undefined): string {
  if (n == null || typeof n !== "number") return "—";
  if (!isFinite(n)) return n > 0 ? "∞" : "−∞";
  const dp = usePrefsStore.getState().decimalPlaces;
  if (Math.abs(n) >= 1e6) return n.toExponential(2);
  if (Math.abs(n) > 0 && Math.abs(n) < 1e-6) return n.toExponential(2);
  return n.toFixed(dp);
}
