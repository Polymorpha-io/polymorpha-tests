import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { Dataset, StatsResults } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";
import type { ExportFormat, ExportPreset } from "../types";
import {
  fetchFullIfNeeded,
  generateCsvBlob,
  generateExcelBlob,
  generatePdfBlob,
  reportSections,
  triggerDownload,
} from "../lib/ExportService";
import { buildExportFileName } from "../lib/sanitize";
import { sanitizeFileName } from "../lib/sanitize";
import { useExportStore } from "../store/useExportStore";

export interface UseExportControllerParams {
  cleaned: Dataset | null;
  raw: Dataset | null;
  results: StatsResults | null;
  cleaningDiff: unknown;
  storagePath: string | null;
  totalRowCount: number | null;
  cleaningConfig: unknown | null;
}

export function useExportController(params: UseExportControllerParams) {
  const {
    cleaned,
    raw,
    results,
    cleaningDiff,
    storagePath,
    totalRowCount,
    cleaningConfig,
  } = params;
  const store = useExportStore();
  const abortRef = useRef<AbortController | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [lastSections, setLastSections] = useState<string[] | undefined>(
    undefined,
  );
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  const generating = store.generating;

  const handleGenerate = useCallback(async () => {
    if (!cleaned || !results) {
      toast.error("No cleaned dataset or results available.");
      return;
    }
    const isAnon = !useAuthStore.getState().user;
    const fmt: ExportFormat = store.format;
    const preset: ExportPreset = store.preset;
    const base = sanitizeFileName(
      store.datasetName.trim().length > 0
        ? store.datasetName.trim()
        : cleaned.fileName.replace(/\.[^.]+$/, ""),
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    abortRef.current = controller;
    store.setGenerating(true);
    store.setProgress(0, "Preparing…");
    store.setError(null);
    setFallbackWarning(null);

    try {
      // Resolve full dataset if needed (S1)
      store.setProgress(5, "Resolving dataset…");
      const fetchRes = await fetchFullIfNeeded({
        cleaned,
        raw,
        storagePath,
        totalRowCount,
        cleaningConfig,
        isAnon,
      });
      if (fetchRes.warning) {
        setFallbackWarning(fetchRes.warning);
        toast.warning(fetchRes.warning);
      }
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");

      const effectiveCleaned = fetchRes.dataset;
      const effectiveRaw = fetchRes.raw;

      let blob: Blob;
      let fileName: string;

      if (fmt === "pdf") {
        store.setProgress(10, "Building PDF…");
        const onProgress = (pct: number, phase: string) => {
          if (!controller.signal.aborted) store.setProgress(pct, phase);
        };
        blob = await generatePdfBlob({
          cleaned: effectiveCleaned,
          raw: effectiveRaw,
          results,
          cleaningDiff: cleaningDiff as never,
          preferences: store.preferences,
          datasetName: base,
          preset,
          fileBaseName: base,
          onProgress,
          signal: controller.signal,
        });
        fileName = buildExportFileName(base, "pdf");
      } else if (fmt === "xlsx") {
        store.setProgress(30, "Building Excel…");
        blob = await generateExcelBlob({
          cleaned: effectiveCleaned,
          results,
          fileBaseName: base,
        });
        fileName = buildExportFileName(base, "xlsx");
      } else {
        store.setProgress(30, "Building CSV…");
        blob = await generateCsvBlob({
          cleaned: effectiveCleaned,
          fileBaseName: base,
        });
        fileName = `${base}-cleaned.csv`;
      }

      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      triggerDownload(blob, fileName);
      setLastBlob(blob);
      setLastFileName(fileName);
      setLastSections(reportSections(store.preferences));

      // Analytics fire-and-forget (never PII)
      try {
        const { trackDownload } = await import("@/lib/tracking");
        trackDownload(fmt as never);
        const { analytics } = await import("@/lib/Analytics");
        analytics.track(
          "download" as never,
          {
            format: fmt,
            sectionsCount: reportSections(store.preferences).length,
            rowCount: fetchRes.exportedRowCount,
          } as never,
        );
      } catch {}

      // Record completion
      const uid = useAuthStore.getState().user?.uid;
      if (uid) {
        try {
          const { createFirestoreService } =
            await import("@/lib/FirestoreService");
          await createFirestoreService(uid).recordExportCompletion();
        } catch {}
      }
      store.setProgress(100, "Download ready");
      toast.success(
        `${fmt.toUpperCase()} exported — ${fetchRes.exportedRowCount.toLocaleString()} rows`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        store.setProgress(0, "");
        toast.info("Export cancelled");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      store.setError(msg);
      toast.error(`Export failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      store.setGenerating(false);
      if (!store.error) store.setProgress(0, "");
    }
  }, [
    cleaned,
    raw,
    results,
    cleaningDiff,
    storagePath,
    totalRowCount,
    cleaningConfig,
    store,
  ]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveToWorkspace = useCallback(async () => {
    if (!lastBlob || !lastFileName) {
      toast.error("No generated export to save.");
      return;
    }
    const wsId = useDataStore.getState().workspaceId;
    const uid = useAuthStore.getState().user?.uid;
    if (!wsId || !uid) {
      toast.error("Open a workspace and sign in to save.");
      return;
    }
    try {
      store.setGenerating(true);
      const { createFirestoreService } = await import("@/lib/FirestoreService");
      const { createWorkspaceService } = await import("@/lib/WorkspaceService");
      const saveType: "premium-pdf" | "excel" | "csv" =
        store.format === "pdf"
          ? "premium-pdf"
          : store.format === "xlsx"
            ? "excel"
            : "csv";
      const fileType: "pdf" | "xlsx" | "csv" =
        store.format === "pdf"
          ? "pdf"
          : store.format === "xlsx"
            ? "xlsx"
            : "csv";
      const saved = await createFirestoreService(uid).saveExport({
        uploadId: useDataStore.getState().uploadId,
        fileName: lastFileName.replace(/\.(pdf|xlsx|csv)$/i, ""),
        type: saveType,
        blob: lastBlob,
        workspaceId: wsId,
        metadata: {
          rowCount: totalRowCount ?? cleaned?.rows.length ?? 0,
          columnCount: cleaned?.columns.length ?? 0,
          includedColumns: store.preferences.includedColumns,
          testsRun:
            (results?.tTests.length ?? 0) +
            (results?.anova.length ?? 0) +
            (results?.regression.length ?? 0) +
            (results?.mannWhitney.length ?? 0) +
            (results?.kruskalWallis.length ?? 0) +
            (results?.chiSquare.length ?? 0),
          sectionsIncluded: lastSections,
          includeVisuals: store.preferences.includeVisuals,
          generatedAt: new Date().toISOString(),
        },
      });
      if (saved) {
        await createWorkspaceService(uid).addExportToWorkspace(
          wsId,
          saved.exportId,
          {
            fileName: lastFileName,
            fileType,
          },
        );
        toast.success("Saved to workspace");
        // let Pipeline refresh via callback if present — caller handles onExport
      } else {
        toast.error("Failed to save to workspace.");
      }
    } catch (err) {
      toast.error(
        `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      store.setGenerating(false);
    }
  }, [
    lastBlob,
    lastFileName,
    lastSections,
    store,
    cleaned,
    results,
    totalRowCount,
  ]);

  return {
    generating,
    progress: store.progress,
    phase: store.phase,
    error: store.error,
    lastBlob,
    lastFileName,
    lastSections,
    fallbackWarning,
    abortRef,
    handleGenerate,
    handleCancel,
    handleSaveToWorkspace,
    setFallbackWarning,
  };
}
