import { useEffect, useMemo, useState, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { createFirestoreService } from "@/lib/FirestoreService";
import { createWorkspaceService } from "@/lib/WorkspaceService";
import { useDataStore } from "@/store/useDataStore";
import type {
  BuilderSection,
  DataPreviewTab,
  ExportStatus,
  ExportType,
  PendingPdfSave,
  PreviewState,
  PreviewTable,
  VisualCandidate,
} from "@/components/ExportPanel/types";
import {
  visualLabelFromKey,
  descriptiveRowsFromResults,
  testRowsFromResults,
} from "@/components/ExportPanel/utils";
import { generateExport } from "@/components/ExportPanel/generateExport";
import { usePdfPreview } from "./usePdfPreview";

export function useExportGeneration(onExport?: () => void) {
  const {
    cleaned,
    raw,
    results,
    cleaningDiff,
    exportPreferences,
    setExportPreferences,
    cart,
    uploadId,
    wsId,
    storagePath,
    totalRowCount,
    cleaningConfig,
  } = useDataStore(
    useShallow((s) => ({
      cleaned: s.cleaned,
      raw: s.raw,
      results: s.results,
      cleaningDiff: s.cleaningDiff,
      exportPreferences: s.exportPreferences,
      setExportPreferences: s.setExportPreferences,
      cart: s.cart,
      uploadId: s.uploadId,
      wsId: s.workspaceId,
      storagePath: s.storagePath,
      totalRowCount: s.totalRowCount,
      cleaningConfig: s.cleaningConfig,
    })),
  );
  // Price/ads removed — all exports free on simplified branch

  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    generating: false,
    progress: 0,
    phase: "",
    error: null,
  });
  const [selectedType, setSelectedType] = useState<ExportType>("premium");
  const [outputFormat, setOutputFormat] = useState<"pdf" | "docx">("pdf");
  const [activeBuilderSection, setActiveBuilderSection] =
    useState<BuilderSection>("visuals");
  const [datasetName, setDatasetName] = useState("");
  const [previewApproved, setPreviewApproved] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>({
    docDef: null,
    loading: false,
    error: null,
  });
  const [showDataModal, setShowDataModal] = useState(false);
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
  const [pendingPdfSave, setPendingPdfSave] = useState<PendingPdfSave | null>(
    null,
  );
  const [savingToProfile, setSavingToProfile] = useState(false);
  const [dataPreviewTab, setDataPreviewTab] =
    useState<DataPreviewTab>("cleaned");
  const [exportReminder, setExportReminder] = useState<string | null>(null);
  const [lastGeneratedExport, setLastGeneratedExport] = useState<{
    uid: string;
    fileName: string;
    mode: "premium-pdf" | "statistical-pdf" | "excel" | "csv" | "docx";
    blob?: Blob;
    sections?: string[];
  } | null>(null);
  const [savingToWorkspace, setSavingToWorkspace] = useState(false);
  const [exportSplitPct, setExportSplitPct] = useState(60);
  const abortRef = useRef<AbortController | null>(null);
  const exportLayoutRef = useRef<HTMLDivElement | null>(null);
  const isDraggingExportSplitRef = useRef(false);

  const {
    generating,
    progress: genProgress,
    phase: genPhase,
    error: genError,
  } = exportStatus;
  const {
    docDef: htmlDocDef,
    loading: htmlPreviewLoading,
    error: htmlPreviewError,
  } = previewState;

  const isPdfType =
    selectedType === "premium" ||
    selectedType === "statistical" ||
    selectedType === "basic";
  const datasetNameFallback =
    cleaned?.fileName
      .replace(/\.[^.]+$/, "")
      .replace(
        /^polymorpha-(?:report|summary|premium-report(?:-visuals)?)-/,
        "",
      ) ?? "dataset";
  const normalizedDatasetName =
    datasetName.trim().length > 0 ? datasetName.trim() : datasetNameFallback;
  const sanitizedDatasetName = normalizedDatasetName
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  const exportFileBaseName =
    sanitizedDatasetName.length > 0 ? sanitizedDatasetName : "dataset";

  useEffect(() => {
    setPreviewApproved(false);
  }, [selectedType, exportPreferences]);

  useEffect(() => {
    if (showDataModal) setDataPreviewTab("cleaned");
  }, [showDataModal]);

  const tabularPreview = useMemo<PreviewTable>(() => {
    if (!cleaned) return { columns: [], rows: [] };
    if (selectedType !== "excel" || dataPreviewTab === "cleaned") {
      return {
        columns: cleaned.columns.map((c) => ({ name: c.name, type: c.type })),
        rows: cleaned.rows as Record<string, unknown>[],
      };
    }

    if (!results) return { columns: [], rows: [] };

    const rows =
      dataPreviewTab === "descriptive"
        ? descriptiveRowsFromResults(results)
        : testRowsFromResults(results);
    const first = rows[0] ?? {};
    const columns = Object.keys(first).map((name) => ({ name }));
    return { columns, rows: rows as Record<string, unknown>[] };
  }, [cleaned, selectedType, dataPreviewTab, results]);

  useEffect(() => {
    if (!cleaned) return;
    setDatasetName(cleaned.fileName.replace(/\.[^.]+$/, ""));
  }, [cleaned]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingExportSplitRef.current || !exportLayoutRef.current) return;
      const rect = exportLayoutRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relative = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(75, Math.max(40, relative));
      setExportSplitPct(clamped);
    };

    const handleMouseUp = () => {
      if (!isDraggingExportSplitRef.current) return;
      isDraggingExportSplitRef.current = false;
      document.body.classList.remove("is-resizing-export-layout");
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("is-resizing-export-layout");
    };
  }, []);

  const startExportSplitDrag = () => {
    isDraggingExportSplitRef.current = true;
    document.body.classList.add("is-resizing-export-layout");
  };

  const handleExportSplitKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setExportSplitPct((v) => Math.max(40, v - 2));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setExportSplitPct((v) => Math.min(75, v + 2));
    }
  };

  useEffect(() => {
    if (!cleaned) return;
    if (!exportPreferences.includeVisuals) return;
    if (exportPreferences.visualColumns.length > 0) return;
    const defaultVisualColumns = cleaned.columns
      .filter(
        (column) => column.type === "numeric" || column.type === "categorical",
      )
      .map((column) => column.name);
    if (defaultVisualColumns.length > 0) {
      setExportPreferences({ visualColumns: defaultVisualColumns });
    }
  }, [
    cleaned,
    exportPreferences.includeVisuals,
    exportPreferences.visualColumns.length,
    setExportPreferences,
  ]);

  // Auto-enable includeVisuals when user has added visuals from Analyse
  useEffect(() => {
    if (
      exportPreferences.includedVisualKeys.length > 0 &&
      !exportPreferences.includeVisuals
    ) {
      setExportPreferences({ includeVisuals: true });
    }
  }, [
    exportPreferences.includedVisualKeys.length,
    exportPreferences.includeVisuals,
    setExportPreferences,
  ]);

  // Sync cart visuals → includedVisualKeys
  useEffect(() => {
    const chartTypeToPrefix: Record<string, string> = {
      histogram: "hist",
      box: "box",
      bar: "bar",
      pie: "pie",
      scatter: "scatter",
      bubble: "scatter",
      contour: "scatter",
      violin: "box",
      heatmap: "heatmap",
      area: "hist",
      line: "hist",
    };
    const cartVisuals = cart.filter((item) => item.type === "visual");
    const keys = cartVisuals
      .map((item) => {
        const chartType =
          typeof item.meta?.chartType === "string"
            ? item.meta.chartType
            : "hist";
        const colA = typeof item.meta?.colA === "string" ? item.meta.colA : "";
        const colB = typeof item.meta?.colB === "string" ? item.meta.colB : "";
        const visMode =
          typeof item.meta?.visMode === "string"
            ? item.meta.visMode
            : "univariate";
        if (colB && visMode === "bivariate") {
          // bivariate box → gbox in PDF
          const prefix =
            chartType === "box"
              ? "gbox"
              : (chartTypeToPrefix[chartType] ?? chartType);
          const ordered = [colA, colB].sort((a, b) => a.localeCompare(b));
          return `${prefix}:${ordered[0]}__${ordered[1]}`;
        }
        const prefix = chartTypeToPrefix[chartType] ?? chartType;
        return `${prefix}:${colA}`;
      })
      .filter(Boolean);
    const current = exportPreferences.includedVisualKeys;
    const same =
      keys.length === current.length && keys.every((k, i) => k === current[i]);
    if (!same) {
      setExportPreferences({ includedVisualKeys: keys });
    }
  }, [cart, exportPreferences.includedVisualKeys, setExportPreferences]);

  // All export types free — no plan gating

  usePdfPreview({
    isPdfType,
    selectedType,
    cleaned,
    results,
    raw,
    cleaningDiff,
    exportPreferences,
    normalizedDatasetName,
    setPreviewState,
  });

  const allColumns = cleaned?.columns ?? [];
  const numericCols = allColumns.filter((c) => c.type === "numeric");
  const categoricalCols = allColumns.filter((c) => c.type === "categorical");
  const visualCandidates = useMemo<VisualCandidate[]>(() => {
    return Array.from(new Set(exportPreferences.includedVisualKeys)).map(
      (key) => ({
        key,
        label: visualLabelFromKey(key),
        color: exportPreferences.visualKeyColors[key] ?? "#2563eb",
      }),
    );
  }, [exportPreferences.includedVisualKeys, exportPreferences.visualKeyColors]);
  const frequencySelection = exportPreferences.frequencyColumns ?? null;
  const descriptiveSelection = exportPreferences.descriptiveColumns ?? null;

  const totalTests = results
    ? results.tTests.length +
      results.anova.length +
      results.regression.length +
      results.mannWhitney.length +
      results.kruskalWallis.length +
      results.chiSquare.length
    : 0;

  const canSavePendingPdf =
    !!pendingPdfSave &&
    pendingPdfSave.usage.storageConsent &&
    pendingPdfSave.usage.totalExports < pendingPdfSave.usage.maxSavedExports &&
    pendingPdfSave.usage.totalSavedFiles < pendingPdfSave.usage.maxSavedFiles;

  const pendingPdfWarning = pendingPdfSave
    ? !pendingPdfSave.usage.storageConsent
      ? "Cloud saving is currently disabled. The PDF is downloading in the background. Enable cloud saving in Profile to save future exports."
      : pendingPdfSave.usage.totalExports >=
            pendingPdfSave.usage.maxSavedExports ||
          pendingPdfSave.usage.totalSavedFiles >=
            pendingPdfSave.usage.maxSavedFiles
        ? `You are already at the storage limit (${pendingPdfSave.usage.maxSavedExports} exports, ${pendingPdfSave.usage.maxSavedFiles} total files). This PDF is still downloading in the background; keep it locally or upload manually later after freeing space.`
        : null
    : null;

  const handleSaveToWorkspace = async () => {
    if (!lastGeneratedExport) return;
    const wsId = useDataStore.getState().workspaceId;
    if (!wsId) return;
    setSavingToWorkspace(true);
    try {
      const effectiveRowCount = totalRowCount ?? cleaned?.rows.length ?? 0;
      const saved = await createFirestoreService(
        lastGeneratedExport.uid,
      ).saveExport({
        uploadId,
        fileName: lastGeneratedExport.fileName.replace(
          /\.(pdf|docx|xlsx|csv)$/i,
          "",
        ),
        type: lastGeneratedExport.mode,
        blob: lastGeneratedExport.blob,
        workspaceId: wsId,
        metadata: {
          rowCount: effectiveRowCount,
          columnCount: cleaned?.columns.length ?? 0,
          includedColumns: exportPreferences.includedColumns,
          testsRun: totalTests,
          sectionsIncluded: lastGeneratedExport.sections,
          includeVisuals: exportPreferences.includeVisuals,
          generatedAt: new Date().toISOString(),
        },
      });
      if (saved) {
        await createWorkspaceService(
          lastGeneratedExport.uid,
        ).addExportToWorkspace(wsId, saved.exportId, {
          fileName: lastGeneratedExport.fileName,
          fileType:
            lastGeneratedExport.mode === "excel"
              ? "xlsx"
              : lastGeneratedExport.mode === "csv"
                ? "csv"
                : lastGeneratedExport.mode === "docx"
                  ? "docx"
                  : "pdf",
        });
        onExport?.();
        setExportReminder("Saved to workspace!");
        setLastGeneratedExport(null);
      } else {
        setExportReminder("Failed to save to workspace.");
      }
    } catch (err) {
      if (import.meta.env.DEV)
        console.error("[ExportPanel] handleSaveToWorkspace failed:", err);
      setExportReminder(
        "Save to workspace failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setSavingToWorkspace(false);
    }
  };

  const handleSavePdfToProfile = async () => {
    if (!pendingPdfSave || !canSavePendingPdf) {
      setShowSaveProfileModal(false);
      return;
    }
    setSavingToProfile(true);
    try {
      const exportType =
        pendingPdfSave.mode === "premium" ? "premium-pdf" : "statistical-pdf";
      const effectiveRowCount2 = totalRowCount ?? cleaned?.rows.length ?? 0;
      const saved = await createFirestoreService(pendingPdfSave.uid).saveExport(
        {
          uploadId,
          fileName: pendingPdfSave.fileName.replace(/\.pdf$/i, ""),
          type: exportType,
          blob: pendingPdfSave.blob,
          workspaceId: useDataStore.getState().workspaceId,
          metadata: {
            rowCount: effectiveRowCount2,
            columnCount: cleaned?.columns.length ?? 0,
            includedColumns: exportPreferences.includedColumns,
            testsRun: totalTests,
            sectionsIncluded: pendingPdfSave.sections,
            includeVisuals: exportPreferences.includeVisuals,
            generatedAt: new Date().toISOString(),
            ...(exportPreferences.pdfFont
              ? { pdfFont: exportPreferences.pdfFont }
              : {}),
            ...(exportPreferences.authorName || pendingPdfSave.userName
              ? {
                  authorName:
                    exportPreferences.authorName || pendingPdfSave.userName,
                }
              : {}),
            ...(exportPreferences.location
              ? { location: exportPreferences.location }
              : {}),
          },
        },
      );
      if (saved) {
        // Auto-attach export to workspace if in workspace context
        const wsId = useDataStore.getState().workspaceId;
        if (wsId && pendingPdfSave.uid) {
          createWorkspaceService(pendingPdfSave.uid!)
            .addExportToWorkspace(wsId, saved.exportId)
            .then(() => {
              onExport?.();
            })
            .catch(() => {});
        }
        if (saved.downloadUrl) {
          setExportReminder("PDF saved to Profile > Export History.");
        } else {
          setExportReminder(
            "Export entry saved to Profile history, but the PDF file could not be attached (storage cap reached or upload blocked).",
          );
        }
      } else {
        setExportReminder(
          "PDF downloaded, but cloud save failed. Check storage consent, quota, or sign-in session.",
        );
      }
    } catch (err) {
      if (import.meta.env.DEV)
        console.error("[ExportPanel] handleSavePdfToProfile failed:", err);
      setExportReminder(
        `PDF downloaded, but save failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setSavingToProfile(false);
      setShowSaveProfileModal(false);
      setPendingPdfSave(null);
    }
  };
  const handleGenerate = () => {
    if (!cleaned || !results) return;
    void generateExport({
      selectedType,
      outputFormat,
      exportFileBaseName,
      normalizedDatasetName,
      cleaned,
      raw,
      results,
      cleaningDiff,
      exportPreferences,
      canUsePdfTypes: true,
      canExportExcel: true,
      canExportCSV: true,
      uploadId,
      storagePath: storagePath ?? null,
      totalRowCount: totalRowCount ?? null,
      cleaningConfig: cleaningConfig ?? null,
      setExportStatus,
      setLastGeneratedExport,
      setExportReminder,
      setPendingPdfSave,
      setShowSaveProfileModal,
      abortRef,
    });
  };

  const typeLabel: Record<ExportType, string> = {
    premium: `Full Report (${outputFormat.toUpperCase()})`,
    statistical: `Text Report (${outputFormat.toUpperCase()})`,
    basic: `Basic Summary (${outputFormat.toUpperCase()})`,
    excel: "Excel Workbook",
    csv: "Cleaned CSV",
  };

  return {
    exportStatus,
    selectedType,
    setSelectedType,
    outputFormat,
    setOutputFormat,
    activeBuilderSection,
    setActiveBuilderSection,
    datasetName,
    setDatasetName,
    previewApproved,
    setPreviewApproved,
    previewState,
    showDataModal,
    setShowDataModal,
    showSaveProfileModal,
    setShowSaveProfileModal,
    savingToProfile,
    dataPreviewTab,
    setDataPreviewTab,
    exportReminder,
    lastGeneratedExport,
    savingToWorkspace,
    exportSplitPct,
    abortRef,
    exportLayoutRef,
    startExportSplitDrag,
    handleExportSplitKeyDown,
    handleGenerate,
    handleSavePdfToProfile,
    handleSaveToWorkspace,
    canSavePendingPdf,
    pendingPdfWarning,
    pendingPdfSave,
    descriptiveSelection,
    frequencySelection,
    isPdfType,
    typeLabel,
    exportFileBaseName,
    normalizedDatasetName,
    tabularPreview,
    visualCandidates,
    numericCols,
    categoricalCols,
    totalTests,
    planFeatures: {
      canExportPDF: true,
      canExportVisualPDF: true,
      canExportExcel: true,
      canExportCSV: true,
      canExportDOCX: true,
    } as const,
    canUsePdfTypes: true as const,
    wsId,
    generating,
    genProgress,
    genPhase,
    genError,
    htmlDocDef,
    htmlPreviewLoading,
    htmlPreviewError,
  };
}
