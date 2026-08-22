import { create } from "zustand";
import { THEME_OPTIONS, toTheme } from "@/constants/theme";
import type { Theme } from "@/constants/theme";

export interface PreferencesData {
  theme: Theme;
}

interface PreferencesStore {
  theme: Theme;
  preferenceSnapshot: Partial<PreferencesData>;
  setTheme: (theme: string) => void;
  setPreferences: (data: PreferencesData) => void;
  reset: () => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  theme: THEME_OPTIONS.SYSTEM,
  preferenceSnapshot: {},
  setTheme: (theme) => set({ theme: toTheme(theme) }),
  setPreferences: (data) =>
    set({
      theme: toTheme(data.theme),
      preferenceSnapshot: { theme: toTheme(data.theme) },
    }),
  reset: () =>
    set({
      theme: THEME_OPTIONS.SYSTEM,
      preferenceSnapshot: {},
    }),
}));
