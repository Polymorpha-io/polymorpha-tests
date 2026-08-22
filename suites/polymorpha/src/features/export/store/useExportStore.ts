import { create } from "zustand";
import type { ExportPreferences } from "@/types";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";
import type { ExportFormat, ExportPreset } from "../types";

export interface ExportStoreState {
  format: ExportFormat;
  preset: ExportPreset;
  preferences: ExportPreferences;
  datasetName: string;
  includedVisualKeys: string[];
  // transient — not persisted
  generating: boolean;
  progress: number;
  phase: string;
  error: string | null;
  lastGeneratedBlob?: Blob | null;
  lastGeneratedFileName?: string | null;
}

export interface ExportStoreActions {
  setFormat: (f: ExportFormat) => void;
  setPreset: (p: ExportPreset) => void;
  setPreferences: (up: Partial<ExportPreferences>) => void;
  setDatasetName: (n: string) => void;
  setIncludedVisualKeys: (keys: string[]) => void;
  setGenerating: (v: boolean) => void;
  setProgress: (p: number, phase?: string) => void;
  setError: (e: string | null) => void;
  setLastGenerated: (blob: Blob | null, fileName: string | null) => void;
  resetTransient: () => void;
  hydrate: (snap: Partial<ExportStoreSnapshot>) => void;
  snapshot: () => ExportStoreSnapshot;
}

export interface ExportStoreSnapshot {
  format: ExportFormat;
  preset: ExportPreset;
  preferences: ExportPreferences;
  datasetName: string;
  includedVisualKeys: string[];
}

export const useExportStore = create<ExportStoreState & ExportStoreActions>(
  (set, get) => ({
    format: "pdf",
    preset: "standard",
    preferences: { ...DEFAULT_EXPORT_PREFERENCES },
    datasetName: "",
    includedVisualKeys: [],
    generating: false,
    progress: 0,
    phase: "",
    error: null,
    lastGeneratedBlob: null,
    lastGeneratedFileName: null,

    setFormat: (format) => set({ format }),
    setPreset: (preset) => set({ preset }),
    setPreferences: (up) =>
      set((s) => ({ preferences: { ...s.preferences, ...up } })),
    setDatasetName: (datasetName) => set({ datasetName }),
    setIncludedVisualKeys: (includedVisualKeys) => set({ includedVisualKeys }),
    setGenerating: (generating) => set({ generating }),
    setProgress: (progress, phase) =>
      set((s) => ({ progress, phase: phase ?? s.phase })),
    setError: (error) => set({ error }),
    setLastGenerated: (blob, fileName) =>
      set({ lastGeneratedBlob: blob, lastGeneratedFileName: fileName }),
    resetTransient: () =>
      set({
        generating: false,
        progress: 0,
        phase: "",
        error: null,
      }),
    hydrate: (snap) =>
      set({
        format: snap.format ?? "pdf",
        preset: snap.preset ?? "standard",
        preferences: snap.preferences
          ? { ...DEFAULT_EXPORT_PREFERENCES, ...snap.preferences }
          : { ...DEFAULT_EXPORT_PREFERENCES },
        datasetName: snap.datasetName ?? "",
        includedVisualKeys: snap.includedVisualKeys ?? [],
      }),
    snapshot: () => {
      const s = get();
      return {
        format: s.format,
        preset: s.preset,
        preferences: s.preferences,
        datasetName: s.datasetName,
        includedVisualKeys: s.includedVisualKeys,
      };
    },
  }),
);
