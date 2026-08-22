import type { TDocumentDefinitions } from "pdfmake/interfaces";

export type ExportType = "premium" | "statistical" | "basic" | "excel" | "csv";

export type VisualCandidate = {
  key: string;
  label: string;
  color: string;
};

export type BuilderSection = "columns" | "sections" | "tests" | "visuals" | "layout";
export type DataPreviewTab = "cleaned" | "descriptive" | "tests";
export type PreviewColumn = { name: string; type?: string };
export type PreviewTable = {
  columns: PreviewColumn[];
  rows: Record<string, unknown>[];
};
export type PendingPdfSave = {
  uid: string;
  mode: ExportType;
  fileName: string;
  blob: Blob;
  sections: string[];
  userName?: string;
  usage: {
    storageConsent: boolean;
    totalExports: number;
    maxSavedExports: number;
    totalSavedFiles: number;
    maxSavedFiles: number;
  };
};

export type ExportStatus = {
  generating: boolean;
  progress: number;
  phase: string;
  error: string | null;
};

export type PreviewState = {
  docDef: TDocumentDefinitions | null;
  loading: boolean;
  error: string | null;
};
