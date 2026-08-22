/**
 * workspace.ts — Serialization, deserialization, migration, and dataset parsing
 * for workspace persistence.
 *
 * Compression: native CompressionStream / DecompressionStream API.
 * Target support: Chrome 80+, Firefox 113+, Safari 16.4+. No pako dependency needed.
 */
import * as XLSX from "xlsx";
import { gunzip } from "fflate";
import type { CartItem } from "@/store/useDataStore";
import type { AppStep } from "@/types";
import { compressGzip, decompressGzip } from "./compression";

// Types

export interface ExportStateSnapshot {
  format?: "pdf" | "xlsx" | "csv";
  preset?: "essentials" | "standard" | "complete";
  preferences?: Record<string, unknown>;
  datasetName?: string;
  includedVisualKeys?: string[];
}

export interface WorkspaceState {
  version: 1 | 2 | 3;
  savedAt: string;
  workspaceId: string;
  step: string;
  activeUploadId: string | null;
  cleaningConfig: Record<string, unknown> | null;
  cleaningDiff: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  exportPreferences: Record<string, unknown>;
  cart: CartItem[];
  notes: string;
  // v2 additions — omitted in v1 blobs, populated via migrateState 1→2
  appliedSteps?: import("@/types").DataOperationStep[];
  totalRowCount?: number | null;
  storagePath?: string | null;
  preflightWarnings?:
    import("@polymorpha/business-logic").PreflightWarning[] | string[];
  checksum?: string;
  // v3 additions — normalised export panel state
  exportState?: ExportStateSnapshot | null;
}

export interface ParsedDataset {
  raw: Record<string, unknown>[];
  headers: string[];
  rowCount: number;
  colCount: number;
  fileName: string;
}

export class WorkspaceStateMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceStateMigrationError";
  }
}

// Column Type Detection — D18/G15: delegate to @polymorpha/business-logic
// Single source: node_modules/@polymorpha/business-logic/ts/src/io/typeDetector.ts
export { detectColumnTypes } from "@polymorpha/business-logic";

// Constants

export const CURRENT_VERSION = 3;
// Re-export canonical D20 constants from @/config for backwards-compat
export { COMPRESS_LEVEL, SKIP_GZIP_BYTES } from "@/config";

// Serialization — now delegates to src/lib/compression.ts (G24 thin adapter reuse)
export { compressGzip, decompressGzip } from "./compression";

/** Serialize a WorkspaceState to gzip-compressed bytes for Firebase Storage upload. */
export async function serializeState(
  state: WorkspaceState,
): Promise<Uint8Array> {
  return compressGzip(JSON.stringify(state));
}

/**
 * Decompress and parse a WorkspaceState blob from Firebase Storage.
 * Always calls migrateState() before returning. Never returns unvalidated raw JSON.
 */
export async function deserializeState(
  blob: ArrayBuffer,
): Promise<WorkspaceState> {
  const decompressed = await decompressGzip(blob);
  const text = new TextDecoder().decode(decompressed);
  const raw = JSON.parse(text);
  return migrateState(raw);
}

// Migration

/**
 * Migrate a WorkspaceState from any older schema version to the current version.
 * Called automatically by deserializeState(). Do not call directly.
 * Throws WorkspaceStateMigrationError if version is unrecognised.
 */
export function migrateState(raw: unknown): WorkspaceState {
  if (!raw || typeof raw !== "object") {
    throw new WorkspaceStateMigrationError("State blob is not a valid object");
  }
  const obj = raw as Record<string, unknown>;
  const version =
    typeof obj.version === "number" && Number.isInteger(obj.version)
      ? obj.version
      : 0;

  if (version === CURRENT_VERSION) return obj as unknown as WorkspaceState;
  if (version > CURRENT_VERSION) {
    throw new WorkspaceStateMigrationError(
      `Unknown state version ${version}. Current version is ${CURRENT_VERSION}.`,
    );
  }

  // Version 0 → 1: initialize missing fields with defaults
  let migrated: WorkspaceState;
  if (version === 0) {
    migrated = {
      version: 1,
      savedAt:
        typeof obj.savedAt === "string"
          ? obj.savedAt
          : new Date().toISOString(),
      workspaceId: String(obj.workspaceId ?? ""),
      step: String(obj.step ?? "upload"),
      activeUploadId:
        typeof obj.activeUploadId === "string" ? obj.activeUploadId : null,
      cleaningConfig: (obj.cleaningConfig as Record<string, unknown>) ?? null,
      cleaningDiff: (obj.cleaningDiff as Record<string, unknown>) ?? null,
      results: (obj.results as Record<string, unknown>) ?? null,
      exportPreferences:
        (obj.exportPreferences as Record<string, unknown>) ?? {},
      cart: Array.isArray(obj.cart) ? (obj.cart as CartItem[]) : [],
      notes: typeof obj.notes === "string" ? obj.notes : "",
      appliedSteps: [],
      totalRowCount: null,
      storagePath: null,
      preflightWarnings: [],
    };
  } else if (version === 1) {
    // Version 1 → 2: add modeller lineage + row count + storagePath
    migrated = {
      version: 2,
      savedAt:
        typeof obj.savedAt === "string"
          ? obj.savedAt
          : new Date().toISOString(),
      workspaceId: String(obj.workspaceId ?? ""),
      step: String(obj.step ?? "upload"),
      activeUploadId:
        typeof obj.activeUploadId === "string" ? obj.activeUploadId : null,
      cleaningConfig: (obj.cleaningConfig as Record<string, unknown>) ?? null,
      cleaningDiff: (obj.cleaningDiff as Record<string, unknown>) ?? null,
      results: (obj.results as Record<string, unknown>) ?? null,
      exportPreferences:
        (obj.exportPreferences as Record<string, unknown>) ?? {},
      cart: Array.isArray(obj.cart) ? (obj.cart as CartItem[]) : [],
      notes: typeof obj.notes === "string" ? obj.notes : "",
      appliedSteps: Array.isArray(obj.appliedSteps)
        ? (obj.appliedSteps as import("@/types").DataOperationStep[])
        : [],
      totalRowCount:
        typeof obj.totalRowCount === "number" ? obj.totalRowCount : null,
      storagePath: typeof obj.storagePath === "string" ? obj.storagePath : null,
      preflightWarnings: Array.isArray(obj.preflightWarnings)
        ? (obj.preflightWarnings as string[])
        : [],
    };
  } else if (version === 2) {
    migrated = {
      version: 3,
      savedAt:
        typeof obj.savedAt === "string"
          ? obj.savedAt
          : new Date().toISOString(),
      workspaceId: String(obj.workspaceId ?? ""),
      step: String(obj.step ?? "upload"),
      activeUploadId:
        typeof obj.activeUploadId === "string" ? obj.activeUploadId : null,
      cleaningConfig: (obj.cleaningConfig as Record<string, unknown>) ?? null,
      cleaningDiff: (obj.cleaningDiff as Record<string, unknown>) ?? null,
      results: (obj.results as Record<string, unknown>) ?? null,
      exportPreferences:
        (obj.exportPreferences as Record<string, unknown>) ?? {},
      cart: Array.isArray(obj.cart) ? (obj.cart as CartItem[]) : [],
      notes: typeof obj.notes === "string" ? obj.notes : "",
      appliedSteps: Array.isArray(obj.appliedSteps)
        ? (obj.appliedSteps as import("@/types").DataOperationStep[])
        : [],
      totalRowCount:
        typeof obj.totalRowCount === "number" ? obj.totalRowCount : null,
      storagePath: typeof obj.storagePath === "string" ? obj.storagePath : null,
      preflightWarnings: Array.isArray(obj.preflightWarnings)
        ? (obj.preflightWarnings as string[])
        : [],
      exportState:
        (obj.exportState as ExportStateSnapshot | null) ??
        (obj.exportPreferences && typeof obj.exportPreferences === "object"
          ? {
              preferences: obj.exportPreferences as Record<string, unknown>,
              format: "pdf" as const,
              preset: "standard" as const,
              includedVisualKeys: [],
              datasetName: "",
            }
          : null),
    };
  } else {
    throw new WorkspaceStateMigrationError(`Unknown state version ${version}.`);
  }

  // Ensure v2 defaults even if 0→1 path just ran
  if (migrated.version === 1) {
    return {
      ...migrated,
      version: 3,
      appliedSteps: (migrated as WorkspaceState).appliedSteps ?? [],
      totalRowCount: (migrated as WorkspaceState).totalRowCount ?? null,
      storagePath: (migrated as WorkspaceState).storagePath ?? null,
      preflightWarnings: (migrated as WorkspaceState).preflightWarnings ?? [],
      exportState:
        (migrated as WorkspaceState).exportState ??
        ({
          format: "pdf",
          preset: "standard",
          preferences: (migrated as WorkspaceState).exportPreferences ?? {},
          includedVisualKeys: [],
          datasetName: "",
        } as ExportStateSnapshot),
    } as WorkspaceState;
  }
  if (migrated.version === 2) {
    return {
      ...migrated,
      version: 3,
      exportState:
        (migrated as WorkspaceState).exportState ??
        ({
          format: "pdf",
          preset: "standard",
          preferences: (migrated as WorkspaceState).exportPreferences ?? {},
          includedVisualKeys: [],
          datasetName: "",
        } as ExportStateSnapshot),
    } as WorkspaceState;
  }
  return migrated;
}

// Dataset Parsing

/**
 * Parse a dataset from raw bytes (already downloaded from Firebase Storage).
 * Decompresses gzip if needed, then parses CSV or XLSX based on file extension.
 */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export async function parseDatasetFromBytes(
  rawBuffer: ArrayBuffer,
  fileName: string,
): Promise<ParsedDataset | null> {
  try {
    // Gzip sniff before decompress — avoids 0.4% false-positive on Excel random 1F 8B
    let fileBytes: Uint8Array;
    const raw = new Uint8Array(rawBuffer);
    if (isGzip(raw)) {
      try {
        if (typeof DecompressionStream !== "undefined") {
          const blob = new Blob([raw as BlobPart]);
          const stream = blob
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
          const decompBlob = await new Response(stream).blob();
          fileBytes = new Uint8Array(await decompBlob.arrayBuffer());
        } else {
          fileBytes = await new Promise<Uint8Array>((resolve, reject) => {
            gunzip(raw, (err, res) => {
              if (err) reject(err);
              else resolve(res);
            });
          });
        }
      } catch {
        fileBytes = raw;
      }
    } else {
      fileBytes = raw;
    }

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "csv";
    let rawRows: Record<string, unknown>[];

    if (ext === "csv") {
      const text = new TextDecoder().decode(fileBytes);
      const workbook = XLSX.read(text, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        throw new Error("CSV file has no data sheets");
      }
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    } else {
      const workbook = XLSX.read(fileBytes.buffer, {
        type: "array",
        cellDates: true,
      });
      const preferred = ["Cleaned Data", "Sheet1"];
      const sheetName =
        preferred.find((s) => workbook.SheetNames.includes(s)) ??
        workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel file has no data sheets");
      }
      const sheet = workbook.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    }

    if (!rawRows || rawRows.length === 0) {
      throw new Error("Dataset file is empty or has no parseable rows");
    }

    const headers = Object.keys(rawRows[0]);
    return {
      raw: rawRows,
      headers,
      rowCount: rawRows.length,
      colCount: headers.length,
      fileName,
    };
  } catch (err) {
    // Re-throw with better error message context
    if (err instanceof Error) {
      throw new Error(`Could not load dataset "${fileName}": ${err.message}`, {
        cause: err,
      });
    }
    throw new Error(`Could not load dataset "${fileName}": Unknown error`, {
      cause: err,
    });
  }
}

// Shared Step Helpers

const VALID_APP_STEPS: readonly AppStep[] = [
  "upload",
  "model",
  "preview",
  "clean",
  "stats",
  "export",
];

/** Safely coerce an unknown value to an AppStep, returning null if invalid. */
export function coerceAppStep(val: unknown): AppStep | null {
  if (typeof val === "string" && VALID_APP_STEPS.includes(val as AppStep)) {
    return val as AppStep;
  }
  return null;
}

/**
 * Determine the target pipeline step when resuming a workspace dataset.
 * Validates that saved step prerequisites are met (e.g., config must exist
 * for the clean step). Does NOT cap stats/export — the caller is responsible
 * for auto-running cleaning to produce the cleaned dataset.
 */
export function determineTargetStep(state: WorkspaceState | null): AppStep {
  if (!state) return "preview";

  const savedStep = coerceAppStep(state.step);
  if (!savedStep || savedStep === "upload") return "preview";

  if (savedStep === "export" || savedStep === "stats") {
    // These steps require cleaned data. If we have a cleaning config,
    // the caller can auto-run cleaning. Otherwise fall back to preview.
    return state.cleaningConfig ? savedStep : "preview";
  }

  if (savedStep === "clean") {
    return state.cleaningConfig ? "clean" : "preview";
  }

  return savedStep;
}

/** Create an empty workspace state snapshot for a new workspace. */
export function createEmptyState(workspaceId: string): WorkspaceState {
  return {
    version: 3,
    savedAt: new Date().toISOString(),
    workspaceId,
    step: "upload",
    activeUploadId: null,
    cleaningConfig: null,
    cleaningDiff: null,
    results: null,
    exportPreferences: {},
    cart: [],
    notes: "",
    appliedSteps: [],
    totalRowCount: null,
    storagePath: null,
    preflightWarnings: [],
    exportState: {
      format: "pdf",
      preset: "standard",
      preferences: {},
      includedVisualKeys: [],
      datasetName: "",
    },
  };
}
