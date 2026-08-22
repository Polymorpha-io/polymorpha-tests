import {
  downloadDocx,
  downloadPDFDirect,
  downloadPDFAndGetBlob,
  exportCleanedCSVWithName,
  exportToExcel,
  type PDFExportOptions,
  type PDFGenerationControl,
} from "@polymorpha/business-logic";
import type { StatsResults } from "@/types";
import type { CleaningDiff, Dataset, ExportPreferences } from "@/types";
import { createFirestoreService } from "@/lib/FirestoreService";
import { trackDownload } from "@/lib/tracking";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";
import { callCleanApi } from "@/lib/stats/api";
import type { ExportStatus, ExportType, PendingPdfSave } from "./types";

export interface ExportGenerationContext {
  selectedType: ExportType;
  outputFormat: "pdf" | "docx";
  exportFileBaseName: string;
  normalizedDatasetName: string;
  cleaned: Dataset;
  raw: Dataset | null;
  results: StatsResults;
  cleaningDiff: CleaningDiff | null;
  exportPreferences: ExportPreferences;
  canUsePdfTypes: boolean;
  canExportExcel: boolean;
  canExportCSV: boolean;
  uploadId: string | null;
  storagePath?: string | null;
  totalRowCount?: number | null;
  cleaningConfig?: unknown;
  setExportStatus: (
    update: ExportStatus | ((current: ExportStatus) => ExportStatus),
  ) => void;
  setLastGeneratedExport: (
    exportRef: {
      uid: string;
      fileName: string;
      mode: "premium-pdf" | "statistical-pdf" | "excel" | "csv" | "docx";
      blob?: Blob;
      sections?: string[];
    } | null,
  ) => void;
  setExportReminder: (message: string | null) => void;
  setPendingPdfSave: (pending: PendingPdfSave | null) => void;
  setShowSaveProfileModal: (open: boolean) => void;
  abortRef: { current: AbortController | null };
}

function reportSections(exportPreferences: ExportPreferences): string[] {
  return [
    exportPreferences.includeExecutiveSummary && "executive-summary",
    exportPreferences.includeDataPreparation && "data-preparation",
    exportPreferences.includeDescriptive && "descriptive",
    exportPreferences.includeFrequencies && "frequencies",
    exportPreferences.includeCorrelation && "correlation",
    exportPreferences.includeNormality && "normality",
    exportPreferences.includeTests && "tests",
    exportPreferences.includeMethodology && "methodology",
    exportPreferences.includeVisuals && "visuals",
  ].filter(Boolean) as string[];
}

function buildPdfOptions(
  ctx: ExportGenerationContext,
  mode: ExportType,
): PDFExportOptions {
  const {
    exportPreferences,
    results,
    cleaned,
    raw,
    cleaningDiff,
    normalizedDatasetName,
  } = ctx;
  const userName =
    useAuthStore.getState().user?.displayName ||
    useAuthStore.getState().user?.email ||
    undefined;
  if (mode === "premium") {
    return {
      results,
      cleaned,
      raw,
      cleaningDiff,
      datasetName: normalizedDatasetName,
      reportMode: "premium",
      includeVisuals: exportPreferences.includeVisuals,
      exportPreferences,
      userName,
    };
  }
  if (mode === "basic") {
    return {
      results,
      cleaned,
      raw,
      cleaningDiff,
      datasetName: normalizedDatasetName,
      reportMode: "basic",
      exportPreferences: {
        ...exportPreferences,
        includeCorrelation: false,
        includeTests: false,
        includeFrequencies: false,
        includeNormality: false,
        includeMethodology: false,
        includeVisuals: false,
      },
      userName,
    };
  }
  return {
    results,
    cleaned,
    raw,
    cleaningDiff,
    datasetName: normalizedDatasetName,
    reportMode: "statistical",
    exportPreferences,
    userName,
  };
}

function recordCompletion(uid: string): void {
  createFirestoreService(uid)
    .recordExportCompletion()
    .catch((e) => {
      if (import.meta.env.DEV) console.warn("[polymorpha]", e);
    });
}

export async function generateExport(
  ctx: ExportGenerationContext,
): Promise<void> {
  const currentUid = useAuthStore.getState().user?.uid ?? null;
  trackDownload(ctx.selectedType);

  // Resolve full cleaned dataset for export — preview is 100 rows for display only
  let effectiveCleaned = ctx.cleaned;
  let effectiveRaw = ctx.raw;
  const shouldUseFull =
    !!ctx.storagePath && !!ctx.totalRowCount && ctx.totalRowCount > 100;
  if (shouldUseFull && ctx.storagePath) {
    try {
      ctx.setExportStatus((c) => ({
        ...c,
        phase: "Fetching full dataset…",
        progress: 10,
      }));
      const full = await callCleanApi(
        ctx.storagePath,
        (ctx.cleaningConfig as Record<string, unknown>) ?? {},
        (ctx.raw?.columns ?? ctx.cleaned.columns) as unknown as Array<{
          name: string;
          type: string;
          detectedType: string;
        }>,
        false,
      );
      effectiveCleaned = {
        ...ctx.cleaned,
        columns: full.columns as unknown as typeof ctx.cleaned.columns,
        rows: full.rows as unknown as typeof ctx.cleaned.rows,
      };
      if (effectiveRaw) {
        effectiveRaw = { ...effectiveRaw };
      }
    } catch {
      // fallback to preview slice
    }
  }
  const showProfileReminder = () => {
    if (!currentUid) return;
    ctx.setExportReminder(
      "Downloaded successfully. To keep exports in Profile, enable cloud saving in Profile preferences.",
    );
  };

  ctx.setExportStatus((current) => ({ ...current, error: null }));
  ctx.setExportReminder(null);
  const mode = ctx.selectedType;

  if (mode === "excel") {
    if (!ctx.canExportExcel) {
      ctx.setExportStatus((current) => ({
        ...current,
        error: "Excel export is not available on this plan.",
      }));
      return;
    }
    try {
      const blob = exportToExcel(
        effectiveCleaned,
        ctx.results,
        ctx.exportFileBaseName,
      );
      if (currentUid) {
        recordCompletion(currentUid);
        ctx.setLastGeneratedExport({
          uid: currentUid,
          fileName: `${ctx.exportFileBaseName}.xlsx`,
          mode: "excel",
          blob,
        });
      }
      showProfileReminder();
    } catch (err) {
      alert(
        `Excel export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
    return;
  }

  if (mode === "csv") {
    if (!ctx.canExportCSV) {
      ctx.setExportStatus((current) => ({
        ...current,
        error: "CSV export is not available on this plan.",
      }));
      return;
    }
    try {
      const blob = exportCleanedCSVWithName(
        effectiveCleaned,
        ctx.exportFileBaseName,
      );
      if (currentUid) {
        recordCompletion(currentUid);
        ctx.setLastGeneratedExport({
          uid: currentUid,
          fileName: `${ctx.exportFileBaseName}.csv`,
          mode: "csv",
          blob,
        });
      }
      showProfileReminder();
    } catch (err) {
      alert(
        `CSV export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
    return;
  }

  if (!ctx.canUsePdfTypes) {
    ctx.setExportStatus((current) => ({
      ...current,
      error: "Report export requires a paid plan.",
    }));
    return;
  }

  if (ctx.outputFormat === "docx") {
    try {
      ctx.setExportStatus({
        generating: true,
        progress: 50,
        phase: "Building DOCX...",
        error: null,
      });
      const baseName = ctx.exportFileBaseName;
      const docxUserName =
        ctx.exportPreferences.authorName ||
        useAuthStore.getState().user?.displayName ||
        useAuthStore.getState().user?.email ||
        undefined;
      const blob = await downloadDocx(
        {
          results: ctx.results,
          cleaned: effectiveCleaned,
          exportPreferences: ctx.exportPreferences,
          userName: docxUserName,
        },
        `polymorpha-report-${baseName}.docx`,
      );
      if (currentUid) {
        recordCompletion(currentUid);
        ctx.setLastGeneratedExport({
          uid: currentUid,
          fileName: `polymorpha-report-${baseName}.docx`,
          mode: "docx",
          blob,
        });
      }
      showProfileReminder();
    } catch (err) {
      alert(
        `DOCX export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      ctx.setExportStatus({
        generating: false,
        progress: 0,
        phase: "",
        error: null,
      });
    }
    return;
  }
  if (import.meta.env.DEV)
    console.log("[pdf-export-ui] Starting generation", {
      mode,
      includeVisuals: ctx.exportPreferences.includeVisuals,
    });
  ctx.setExportStatus({
    generating: true,
    progress: 0,
    phase: "Preparing...",
    error: null,
  });
  const controller = new AbortController();
  ctx.abortRef.current = controller;
  try {
    const pdfCtx = { ...ctx, cleaned: effectiveCleaned, raw: effectiveRaw };
    const opts = buildPdfOptions(pdfCtx, mode);
    const control: PDFGenerationControl = {
      onProgress: (pct, phase) => {
        ctx.setExportStatus((current) => ({
          ...current,
          progress: pct,
          phase,
        }));
      },
      signal: controller.signal,
    };
    const baseName = ctx.exportFileBaseName;
    const outFileName = `polymorpha-${mode === "basic" ? "summary" : "report"}-${baseName}.pdf`;

    let pdfBlob: Blob | null = null;
    try {
      pdfBlob = await Promise.race([
        downloadPDFAndGetBlob(opts, outFileName, control),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 120_000),
        ),
      ]);
    } catch (blobErr) {
      if (import.meta.env.DEV)
        console.warn(
          "[pdf-export-ui] getBlob failed, falling back to .download()",
          blobErr,
        );
    }

    if (!pdfBlob) {
      if (import.meta.env.DEV)
        console.warn(
          "[pdf-export-ui] Blob unavailable, using native .download() fallback",
        );
      await downloadPDFDirect(opts, outFileName, control);
      const sections = reportSections(ctx.exportPreferences);
      if (currentUid) {
        const pdfExportType =
          mode === "premium"
            ? ("premium-pdf" as const)
            : ("statistical-pdf" as const);
        ctx.setLastGeneratedExport({
          uid: currentUid,
          fileName: outFileName,
          mode: pdfExportType,
          sections,
        });
        if (!useDataStore.getState().workspaceId) {
          ctx.setExportReminder(
            "PDF downloaded. To save this export in your Profile, enable cloud saving and export again.",
          );
        }
      }
    } else {
      const sections = reportSections(ctx.exportPreferences);

      if (currentUid) {
        const pdfExportType =
          mode === "premium"
            ? ("premium-pdf" as const)
            : ("statistical-pdf" as const);
        ctx.setLastGeneratedExport({
          uid: currentUid,
          fileName: outFileName,
          mode: pdfExportType,
          blob: pdfBlob,
          sections,
        });

        const usage =
          await createFirestoreService(currentUid).getStorageConsentAndUsage(
            currentUid,
          );
        const userName =
          useAuthStore.getState().user?.displayName ||
          useAuthStore.getState().user?.email ||
          undefined;
        ctx.setPendingPdfSave({
          uid: currentUid,
          mode,
          fileName: outFileName,
          blob: pdfBlob,
          sections,
          userName,
          usage: {
            storageConsent: usage.storageConsent,
            totalExports: usage.totalExports,
            maxSavedExports: usage.maxSavedExports,
            totalSavedFiles: usage.totalSavedFiles,
            maxSavedFiles: usage.maxSavedFiles,
          },
        });
        ctx.setShowSaveProfileModal(true);
      }
    }

    if (currentUid) recordCompletion(currentUid);
    if (import.meta.env.DEV)
      console.log("[pdf-export-ui] Generation completed", {
        mode,
        fileName: outFileName,
        persisted: !!pdfBlob,
        sizeBytes: pdfBlob?.size ?? 0,
      });
  } catch (err) {
    if (import.meta.env.DEV)
      console.error("[pdf-export-ui] Generation failed", err, { mode });
    if (!controller.signal.aborted) {
      ctx.setExportStatus((current) => ({
        ...current,
        error: err instanceof Error ? err.message : "Generation failed",
      }));
    }
  } finally {
    ctx.setExportStatus((current) => ({
      ...current,
      generating: false,
      progress: controller.signal.aborted ? 0 : current.progress,
      phase: controller.signal.aborted ? "" : current.phase,
    }));
    ctx.abortRef.current = null;
  }
}
