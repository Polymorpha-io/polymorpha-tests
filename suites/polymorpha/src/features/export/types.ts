import type {
  Dataset,
  CleaningDiff,
  ExportPreferences,
  StatsResults,
} from "@/types";

export type ExportFormat = "pdf" | "xlsx" | "csv";
export type ExportPreset = "essentials" | "standard" | "complete";

/** Normalised export format state — replaces bespoke ExportType + outputFormat. */
export interface ExportState {
  format: ExportFormat;
  preset: ExportPreset;
  preferences: ExportPreferences;
  datasetName: string;
  includedVisualKeys: string[];
}

export type DataPreviewTab = "cleaned" | "descriptive" | "tests";

export interface PreviewTable {
  columns: Array<{ name: string; type?: string }>;
  rows: Record<string, unknown>[];
}

export interface ExportStatus {
  generating: boolean;
  progress: number;
  phase: string;
  error: string | null;
}

export type ExportMode = "pdf" | "xlsx" | "csv";

export interface LastGeneratedExport {
  uid: string;
  fileName: string;
  mode: ExportMode;
  blob?: Blob;
  sections?: string[];
  exportedRowCount?: number;
  requestedRowCount?: number;
  wasFallback?: boolean;
}

export interface FetchFullResult {
  dataset: Dataset;
  raw: Dataset | null;
  wasFallback: boolean;
  exportedRowCount: number;
  requestedRowCount: number;
}

export interface ExportGenerationParams {
  format: ExportFormat;
  cleaned: Dataset;
  raw: Dataset | null;
  results: StatsResults;
  cleaningDiff: CleaningDiff | null;
  preferences: ExportPreferences;
  datasetName: string;
  includedVisualKeys: string[];
  abortSignal?: AbortSignal;
  onProgress?: (pct: number, phase: string) => void;
}

export interface VisualCandidate {
  key: string;
  label: string;
  color: string;
}
