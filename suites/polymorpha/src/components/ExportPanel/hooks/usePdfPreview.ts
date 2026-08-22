import { useEffect } from "react";
import {
  buildPDFDocDefinition,
  type PDFExportOptions,
  type PDFGenerationControl,
} from "@polymorpha/business-logic";
import type { CleaningDiff, Dataset, ExportPreferences } from "@/types";
import type { StatsResults } from "@/types";
import type { ExportType, PreviewState } from "@/components/ExportPanel/types";

interface UsePdfPreviewArgs {
  isPdfType: boolean;
  selectedType: ExportType;
  cleaned: Dataset | null;
  results: StatsResults | null;
  raw: Dataset | null;
  cleaningDiff: CleaningDiff | null;
  exportPreferences: ExportPreferences;
  normalizedDatasetName: string;
  setPreviewState: (
    update: PreviewState | ((current: PreviewState) => PreviewState),
  ) => void;
}

export function usePdfPreview(args: UsePdfPreviewArgs) {
  const {
    isPdfType,
    selectedType,
    cleaned,
    results,
    raw,
    cleaningDiff,
    exportPreferences,
    normalizedDatasetName,
    setPreviewState,
  } = args;
  useEffect(() => {
    // Build HTML preview for PDF types (debounced to avoid thrashing on rapid checkbox clicks)
    if (!cleaned || !results || !isPdfType) {
      setPreviewState({ docDef: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    const previewController = new AbortController();

    const timerId = setTimeout(() => {
      setPreviewState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const previewMode =
        selectedType === "premium"
          ? "premium"
          : selectedType === "basic"
            ? "basic"
            : "statistical";
      const opts: PDFExportOptions =
        previewMode === "premium"
          ? {
              results,
              cleaned,
              raw,
              cleaningDiff,
              datasetName: normalizedDatasetName,
              reportMode: "premium",
              includeVisuals: exportPreferences.includeVisuals,
              exportPreferences,
            }
          : previewMode === "basic"
            ? {
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
              }
            : {
                results,
                cleaned,
                raw,
                cleaningDiff,
                datasetName: normalizedDatasetName,
                reportMode: "statistical",
                exportPreferences,
              };
      const previewControl: PDFGenerationControl = {
        signal: previewController.signal,
      };

      (async () => {
        try {
          let docDef = await buildPDFDocDefinition(opts, previewControl);

          if (
            !docDef &&
            previewMode === "premium" &&
            exportPreferences.includeVisuals
          ) {
            const retryOpts: PDFExportOptions = {
              ...opts,
              includeVisuals: false,
              exportPreferences: {
                ...exportPreferences,
                includeVisuals: false,
                visualColumns: [],
              },
            };
            docDef = await buildPDFDocDefinition(retryOpts, previewControl);
          }
          if (!cancelled)
            setPreviewState({ docDef, loading: false, error: null });
        } catch (err: unknown) {
          if (previewController.signal.aborted || cancelled) return;
          const errMsg = err instanceof Error ? err.message : "";
          const timedOut = errMsg.toLowerCase().includes("timed out");
          const canRetryWithoutVisuals =
            previewMode === "premium" && exportPreferences.includeVisuals;

          if (timedOut && canRetryWithoutVisuals) {
            try {
              const retryOpts: PDFExportOptions = {
                ...opts,
                includeVisuals: false,
                exportPreferences: {
                  ...exportPreferences,
                  includeVisuals: false,
                  visualColumns: [],
                },
              };
              const retryDocDef = await buildPDFDocDefinition(
                retryOpts,
                previewControl,
              );
              if (!cancelled) {
                setPreviewState({
                  docDef: retryDocDef,
                  loading: false,
                  error:
                    "Preview timed out with visuals, showing text-only fallback preview.",
                });
              }
              return;
            } catch {
              /* fall through */
            }
          }
          if (!cancelled) {
            setPreviewState((current) => ({
              ...current,
              loading: false,
              error:
                err instanceof Error ? err.message : "Failed to build preview",
            }));
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      previewController.abort();
      clearTimeout(timerId);
    };
  }, [
    selectedType,
    cleaned,
    results,
    raw,
    cleaningDiff,
    exportPreferences,
    isPdfType,
    normalizedDatasetName,
  ]);
}
