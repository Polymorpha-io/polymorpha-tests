/**
 * ExportService — pure + bounded service boundary for exports.
 * No Zustand, no Firestore, no React. S1 client-only.
 */
import type { Dataset, ExportPreferences, StatsResults } from "@/types";
import { ANON_MAX_ROWS } from "@/config";
import { buildExportFileName, sanitizeFileName } from "./sanitize";
import { hashDatasetSync } from "./hash";

export type ExportFormat = "pdf" | "xlsx" | "csv";
export type ReportMode = "essentials" | "standard" | "complete";

export interface FetchFullParams {
  cleaned: Dataset;
  raw: Dataset | null;
  storagePath: string | null;
  totalRowCount: number | null;
  cleaningConfig: unknown | null;
  isAnon: boolean;
}

export interface FetchFullResult {
  dataset: Dataset;
  raw: Dataset | null;
  wasFallback: boolean;
  exportedRowCount: number;
  requestedRowCount: number;
  warning: string | null;
}

function applyAnonCap(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.length > ANON_MAX_ROWS ? rows.slice(0, ANON_MAX_ROWS) : rows;
}

export async function fetchFullIfNeeded(
  params: FetchFullParams,
): Promise<FetchFullResult> {
  const { cleaned, raw, storagePath, totalRowCount, cleaningConfig, isAnon } =
    params;
  const requestedRowCount = totalRowCount ?? cleaned.rows.length;
  const needsFull = !!storagePath && !!totalRowCount && totalRowCount > 100;

  if (!needsFull) {
    const capped =
      isAnon && cleaned.rows.length > ANON_MAX_ROWS
        ? {
            ...cleaned,
            rows: cleaned.rows.slice(0, ANON_MAX_ROWS),
          }
        : cleaned;
    const wasFallback =
      isAnon &&
      cleaned.rows.length > ANON_MAX_ROWS &&
      capped.rows.length !== requestedRowCount;
    return {
      dataset: capped,
      raw,
      wasFallback: !!wasFallback,
      exportedRowCount: capped.rows.length,
      requestedRowCount,
      warning: wasFallback
        ? `Showing ${capped.rows.length.toLocaleString()} of ${requestedRowCount.toLocaleString()} rows (anonymous limit ${ANON_MAX_ROWS.toLocaleString()}).`
        : null,
    };
  }

  // Needs full fetch via callCleanApi
  try {
    const { callCleanApi } = await import("@/lib/stats/api");
    const full = await callCleanApi(
      storagePath!,
      (cleaningConfig as Record<string, unknown>) ?? {},
      (raw?.columns ?? cleaned.columns) as unknown as Array<{
        name: string;
        type: string;
        detectedType: string;
      }>,
      false,
    );
    let rows = full.rows as unknown as Record<string, unknown>[];
    // Apply anon cap after fetch too (G18)
    if (isAnon && rows.length > ANON_MAX_ROWS)
      rows = rows.slice(0, ANON_MAX_ROWS);
    const fetchedDataset: Dataset = {
      ...cleaned,
      columns: full.columns as unknown as Dataset["columns"],
      rows: rows as unknown as Dataset["rows"],
    };
    const wasFallback = rows.length !== requestedRowCount;
    return {
      dataset: fetchedDataset,
      raw,
      wasFallback: !!wasFallback && rows.length < requestedRowCount,
      exportedRowCount: rows.length,
      requestedRowCount,
      warning:
        rows.length < requestedRowCount
          ? `Exporting ${rows.length.toLocaleString()} of ${requestedRowCount.toLocaleString()} rows — full fetch returned truncated data.`
          : null,
    };
  } catch {
    // Fallback to bounded preview slice, never throw (S1)
    const baseRows = cleaned.rows as unknown as Record<string, unknown>[];
    const bounded = isAnon ? applyAnonCap(baseRows) : baseRows;
    const wasFallback = bounded.length !== requestedRowCount;
    return {
      dataset: { ...cleaned, rows: bounded as unknown as Dataset["rows"] },
      raw,
      wasFallback: !!wasFallback,
      exportedRowCount: bounded.length as number,
      requestedRowCount,
      warning: wasFallback
        ? `Full dataset fetch failed — exporting ${bounded.length.toLocaleString()} of ${requestedRowCount.toLocaleString()} rows from preview.`
        : null,
    };
  }
}

export function reportSections(prefs: ExportPreferences): string[] {
  return [
    prefs.includeExecutiveSummary && "executive-summary",
    prefs.includeDataPreparation && "data-preparation",
    prefs.includeDescriptive && "descriptive",
    prefs.includeFrequencies && "frequencies",
    prefs.includeCorrelation && "correlation",
    prefs.includeNormality && "normality",
    prefs.includeTests && "tests",
    prefs.includeMethodology && "methodology",
    prefs.includeVisuals && "visuals",
  ].filter(Boolean) as string[];
}

export function normalizePrefsForPreset(
  prefs: ExportPreferences,
  preset: ReportMode,
): ExportPreferences {
  if (preset === "standard") return { ...prefs };
  if (preset === "essentials") {
    return {
      ...prefs,
      includeCorrelation: false,
      includeNormality: false,
      includeTests: false,
      includeMethodology: false,
      includeFrequencies: false,
      includeVisuals: false,
    };
  }
  // complete: enable everything supported
  return {
    ...prefs,
    includeExecutiveSummary: true,
    includeDataPreparation: true,
    includeDescriptive: true,
    includeFrequencies: true,
    includeCorrelation: true,
    includeNormality: true,
    includeTests: true,
    includeMethodology: true,
    includeVisuals: true,
    includeHistograms: true,
    includeBoxPlots: true,
    includeQQPlots: true,
    includeBarCharts: true,
    includePieCharts: true,
    includeScatterPlots: true,
    includeGroupedBoxPlots: true,
    includePairwiseTests: true,
    includeHeatmap: true,
    exportTTests: true,
    exportAnova: true,
    exportMannWhitney: true,
    exportKruskalWallis: true,
    exportChiSquare: true,
    exportRegression: true,
  };
}

export function buildPdfOptions(params: {
  cleaned: Dataset;
  raw: Dataset | null;
  results: StatsResults;
  cleaningDiff: import("@/types").CleaningDiff | null;
  preferences: ExportPreferences;
  datasetName: string;
  preset: ReportMode;
  userName?: string;
}): import("@polymorpha/business-logic").PDFExportOptions {
  const {
    cleaned,
    raw,
    results,
    cleaningDiff,
    preferences,
    datasetName,
    preset,
    userName,
  } = params;
  const normalized = normalizePrefsForPreset(preferences, preset);
  const reportMode: "premium" | "statistical" | "basic" =
    preset === "essentials"
      ? "basic"
      : preset === "complete"
        ? "premium"
        : "statistical";
  const effectivePrefs =
    preset === "essentials"
      ? normalizePrefsForPreset(preferences, "essentials")
      : normalized;
  return {
    results,
    cleaned,
    raw,
    cleaningDiff,
    datasetName,
    reportMode,
    includeVisuals: effectivePrefs.includeVisuals,
    exportPreferences: effectivePrefs,
    userName,
  } as unknown as import("@polymorpha/business-logic").PDFExportOptions;
}

export async function generatePdfBlob(params: {
  cleaned: Dataset;
  raw: Dataset | null;
  results: StatsResults;
  cleaningDiff: import("@/types").CleaningDiff | null;
  preferences: ExportPreferences;
  datasetName: string;
  preset: ReportMode;
  fileBaseName: string;
  onProgress?: (pct: number, phase: string) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const opts = buildPdfOptions({
    cleaned: params.cleaned,
    raw: params.raw,
    results: params.results,
    cleaningDiff: params.cleaningDiff,
    preferences: params.preferences,
    datasetName: params.datasetName,
    preset: params.preset,
  });
  const outName = buildExportFileName(params.fileBaseName, "pdf");
  if (params.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  // Lazy import pdf — keeps pdf chunk off initial bundle
  const { generatePDFPreviewUrl, downloadPDFAndGetBlob } =
    await import("@polymorpha/business-logic");
  // Prefer getBlob if available via downloadPDFAndGetBlob (intercepts .download)
  // For pure generation, use docBuilder directly to Blob via pdfMake.getBuffer
  const tryBlob = await downloadPDFAndGetBlob(opts, outName, {
    signal: params.signal,
    onProgress: params.onProgress,
  } as never);
  if (tryBlob) return tryBlob;
  // Fallback: generate via preview URL then fetch blob
  const dataUrl = await generatePDFPreviewUrl(opts, {
    signal: params.signal,
    onProgress: params.onProgress,
  } as never);
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function generateExcelBlob(params: {
  cleaned: Dataset;
  results: StatsResults;
  fileBaseName: string;
}): Promise<Blob> {
  void sanitizeFileName(params.fileBaseName);
  // Lazy import to keep excel chunk isolated — build manually with parity-complete mappers
  const XLSX = await import("xlsx");
  const { descriptiveRowsFromResults, testRowsFromResults } =
    await import("./rowMappers");
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(
    params.cleaned.rows as Record<string, unknown>[],
  );
  XLSX.utils.book_append_sheet(wb, ws1, "Cleaned Data");
  const ws2 = XLSX.utils.json_to_sheet(
    descriptiveRowsFromResults(params.results),
  );
  XLSX.utils.book_append_sheet(wb, ws2, "Summary Stats");
  const ws3 = XLSX.utils.json_to_sheet(testRowsFromResults(params.results));
  XLSX.utils.book_append_sheet(wb, ws3, "Test Results");
  // Frequencies as extra sheet for completeness (new parity)
  if (params.results.frequencies && params.results.frequencies.length > 0) {
    const freqRows = params.results.frequencies.flatMap((f) =>
      f.entries.slice(0, 50).map((e) => ({
        Column: f.column,
        Value: e.value,
        Count: e.count,
        "Percent %": e.pct.toFixed(2),
      })),
    );
    if (freqRows.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(freqRows);
      XLSX.utils.book_append_sheet(wb, ws4, "Frequencies");
    }
  }
  // Correlation matrix sheet
  if (params.results.correlation) {
    const corr = params.results.correlation;
    const corrRows = corr.values.map((row, i) => {
      const rec: Record<string, unknown> = { "": corr.columns[i] };
      corr.columns.forEach(
        (c, j) => (rec[c] = Number.isFinite(row[j]) ? row[j].toFixed(3) : ""),
      );
      return rec;
    });
    if (corrRows.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(corrRows);
      XLSX.utils.book_append_sheet(wb, ws5, "Correlation");
    }
  }
  // Normality
  if (params.results.normality && params.results.normality.length > 0) {
    const normRows = params.results.normality.map((n) => ({
      Column: n.column,
      Test: n.test,
      Statistic: Number.isFinite(n.statistic) ? n.statistic.toFixed(4) : "",
      "p-value": Number.isFinite(n.pValue) ? n.pValue.toFixed(4) : "",
      "Is Normal": n.isNormal ? "Yes" : "No",
    }));
    const ws6 = XLSX.utils.json_to_sheet(normRows);
    XLSX.utils.book_append_sheet(wb, ws6, "Normality");
  }
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function generateCsvBlob(params: {
  cleaned: Dataset;
  fileBaseName: string;
}): Promise<Blob> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    params.cleaned.rows as Record<string, unknown>[],
  );
  const csv = XLSX.utils.sheet_to_csv(ws);
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function hashDatasetForMemo(dataset: Dataset): string {
  return hashDatasetSync(dataset, dataset.fileName);
}
