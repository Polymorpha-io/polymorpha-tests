/**
 * Pipeline — the 6-step stepper (upload ? model ? preview ? clean ? stats ? export) + panels extracted as a reusable component.
 *
 * Works standalone (at / for guests) or embedded inside a workspace detail page
 * (at /workspaces/:id for authenticated users).
 */

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { sanitizeProcessError } from "@/lib/errors/sanitize";
import { Upload } from "@/components/Upload/Upload";
import WorkflowToolbar from "@/components/Pipeline/components/WorkflowToolbar";
import Stepper from "@/components/Pipeline/components/Stepper";
import { DataPreview } from "@/components/DataPreview/DataPreview";
import { DataModeller } from "@/components/DataPreview/DataModeller";
import { CleaningPanel } from "@/components/CleaningPanel/CleaningPanel";
import { AnalysePanel } from "@/components/AnalysePanel/AnalysePanel";
const ExportPanel = React.lazy(() =>
  import("@/features/export/ExportPanel").then((m) => ({
    default: m.ExportPanel,
  })),
);
import { CartFab } from "@/components/CartFab/CartFab";
import { ObjectivePrompt } from "@/components/ObjectivePrompt/ObjectivePrompt";
import { useDataStore } from "@/store/useDataStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useShallow } from "zustand/react/shallow";
import {
  applyCleaningConfig,
  buildDefaultConfig,
} from "@polymorpha/business-logic";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { NotebookView } from "@/notebook/NotebookView";
import { computePreviewData } from "@/lib/data-ops";
import { showToastMessage } from "@/components/ToastMessage/showToastMessage";
import { callCleanApi } from "@/lib/stats/api";
import {
  Eraser,
  Info,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { AppStep, CleaningConfig, CleaningDiff } from "@/types";
import { STEPS_ID, STEP_ORDER } from "@/components/Pipeline/constants";
import "./Pipeline.css";

type UnknownRecord = Record<string, unknown>;
type CleaningDiffRecord = Record<string, unknown> & {
  rowsRemoved?: number;
  encodingLog?: unknown[];
  valuesImputed?: unknown;
  outliersHandled?: unknown;
  duplicatesRemoved?: number;
  columnsRemoved?: number;
  indicatorColumnsAdded?: unknown;
  scaledColumns?: unknown;
};

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getNumberProp(record: unknown, key: string, fallback: number): number {
  if (!isRecord(record)) return fallback;
  const value = record[key];
  return typeof value === "number" ? value : fallback;
}

function getRecordProp(record: unknown, key: string): Record<string, number> {
  if (!isRecord(record)) return {};
  const value = record[key];
  return isRecord(value) ? (value as Record<string, number>) : {};
}

function getArrayProp<T>(record: unknown, key: string): T[] {
  if (!isRecord(record)) return [];
  const value = record[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

// Step helpers

function formatSummaryList(items: string[], limit = 3): string {
  if (items.length <= limit) return items.join("; ");
  const visible = items.slice(0, limit).join("; ");
  return `${visible}; +${items.length - limit} more`;
}

function labelMissingStrategy(
  strategy: CleaningConfig["missing"][string]["strategy"],
): string {
  switch (strategy) {
    case "mean":
      return "mean fill";
    case "median":
      return "median fill";
    case "mode":
      return "mode fill";
    case "constant":
      return "constant fill";
    case "ffill":
      return "forward fill";
    case "bfill":
      return "back fill";
    case "drop":
      return "row drop";
    default:
      return "cleaning";
  }
}

function labelOutlierAction(
  action: CleaningConfig["outliers"][string]["action"],
): string {
  switch (action) {
    case "remove":
      return "removed";
    case "winsorize":
      return "winsorized";
    case "flag":
      return "flagged";
    case "nullify":
      return "set to null";
    default:
      return "handled";
  }
}

function buildCleaningToasts(
  diff: CleaningDiff | null | undefined,
  config: CleaningConfig,
): Array<{ title: string; detail: string; icon: LucideIcon }> {
  const toasts: Array<{ title: string; detail: string; icon: LucideIcon }> = [];
  if (!diff) {
    toasts.push({
      title: "Cleaning applied",
      detail: "No detailed diff available.",
      icon: Info,
    });
    return toasts;
  }

  const imputedEntries = Object.entries(diff.valuesImputed ?? {}).filter(
    ([, count]) => (count as number) > 0,
  );
  if (imputedEntries.length > 0) {
    const total = imputedEntries.reduce((sum, [, count]) => sum + count, 0);
    const details = imputedEntries.map(
      ([column, count]) =>
        `${count} in ${column} via ${labelMissingStrategy(config.missing[column]?.strategy ?? "none")}`,
    );
    toasts.push({
      title: `Filled ${total} missing value${total === 1 ? "" : "s"}`,
      detail: formatSummaryList(details),
      icon: Sparkles,
    });
  }

  const outlierEntries = Object.entries(diff.outliersHandled ?? {}).filter(
    ([, count]) => (count as number) > 0,
  );
  if (outlierEntries.length > 0) {
    const total = outlierEntries.reduce((sum, [, count]) => sum + count, 0);
    const details = outlierEntries.map(
      ([column, count]) =>
        `${count} in ${column} ${labelOutlierAction(config.outliers[column]?.action ?? "flag")}`,
    );
    toasts.push({
      title: `Handled ${total} outlier${total === 1 ? "" : "s"}`,
      detail: formatSummaryList(details),
      icon: SearchCheck,
    });
  }

  const rowRemovalDetails: string[] = [];
  if (diff.rowsRemovedFromMissing > 0)
    rowRemovalDetails.push(
      `${diff.rowsRemovedFromMissing} dropped for missing data`,
    );
  if (diff.rowsRemovedFromOutliers > 0)
    rowRemovalDetails.push(
      `${diff.rowsRemovedFromOutliers} dropped as outliers`,
    );
  if (diff.rowsRemovedFromThreshold > 0)
    rowRemovalDetails.push(
      `${diff.rowsRemovedFromThreshold} over missing-value threshold`,
    );
  if (diff.rowsRemovedFromFilter > 0)
    rowRemovalDetails.push(`${diff.rowsRemovedFromFilter} filtered out`);
  if (diff.duplicatesRemoved > 0)
    rowRemovalDetails.push(
      `${diff.duplicatesRemoved} duplicate${diff.duplicatesRemoved === 1 ? "" : "s"} removed`,
    );
  if (rowRemovalDetails.length > 0) {
    toasts.push({
      title: `Removed ${diff.rowsRemoved} row${diff.rowsRemoved === 1 ? "" : "s"}`,
      detail: formatSummaryList(rowRemovalDetails),
      icon: Eraser,
    });
  }

  const structureDetails: string[] = [];
  if (diff.columnsRemoved > 0)
    structureDetails.push(
      `${diff.columnsRemoved} column${diff.columnsRemoved === 1 ? "" : "s"} removed`,
    );
  if ((diff.indicatorColumnsAdded ?? []).length > 0)
    structureDetails.push(
      `indicator columns added: ${(diff.indicatorColumnsAdded ?? []).slice(0, 2).join(", ")}`,
    );
  if ((diff.scaledColumns ?? []).length > 0)
    structureDetails.push(
      `scaled: ${(diff.scaledColumns ?? []).slice(0, 2).join(", ")}`,
    );
  if ((diff.encodingLog ?? []).length > 0)
    structureDetails.push(
      `encoded ${(diff.encodingLog ?? []).length} column${(diff.encodingLog ?? []).length === 1 ? "" : "s"}`,
    );
  if (diff.stringReplacesApplied > 0)
    structureDetails.push(
      `${diff.stringReplacesApplied} text replacement${diff.stringReplacesApplied === 1 ? "" : "s"}`,
    );
  if (diff.categoryMappingsApplied > 0)
    structureDetails.push(
      `${diff.categoryMappingsApplied} category mapping${diff.categoryMappingsApplied === 1 ? "" : "s"}`,
    );
  if (diff.mathTransformsApplied > 0)
    structureDetails.push(
      `${diff.mathTransformsApplied} math transform${diff.mathTransformsApplied === 1 ? "" : "s"}`,
    );
  if (diff.sortApplied) structureDetails.push("sorted rows");
  if (structureDetails.length > 0) {
    toasts.push({
      title: "Reshaped the dataset",
      detail: formatSummaryList(structureDetails),
      icon: Table2,
    });
  }

  if (toasts.length === 0) {
    const passiveChanges: string[] = [];
    if (config.stringCleaning.enabled)
      passiveChanges.push("standardized text formatting");
    if (config.typeConversion.enabled)
      passiveChanges.push("normalized detected types");
    if (passiveChanges.length > 0) {
      toasts.push({
        title: "Applied non-destructive cleaning",
        detail: formatSummaryList(passiveChanges),
        icon: ShieldCheck,
      });
    } else {
      toasts.push({
        title: "Cleaning applied",
        detail: "No rows or columns changed in a measurable way.",
        icon: Info,
      });
    }
  }

  return toasts.slice(0, 4);
}

// Props

export interface WorkspaceDatasetInfo {
  uploadId: string;
  fileName: string;
  rowCount: number;
  colCount: number;
  uploadedAt: Date;
  storageRef: string;
  hasStorage: boolean;
}

export interface WorkspaceExportInfo {
  exportId: string;
  label: string;
  fileType: string;
  createdAt: Date | null;
  downloadURL: string;
}

export interface PipelineProps {
  workspaceContext?: {
    workspaceId: string;
    workspaceName: string;
    datasets: WorkspaceDatasetInfo[];
    exports: WorkspaceExportInfo[];
    onBack: () => void;
    onLoadDataset: (uploadId: string) => Promise<void>;
    onExportGenerated?: () => void;
  };
}

// Component

export function Pipeline({ workspaceContext }: PipelineProps) {
  const {
    step,
    reset,
    setStep,
    raw,
    cleaned,
    cleaningConfig,
    setCleaningConfig,
    setCleaned,
    setCleanedInPlace,
  } = useDataStore(
    useShallow((s) => ({
      step: s.step,
      reset: s.reset,
      setStep: s.setStep,
      raw: s.raw,
      cleaned: s.cleaned,
      cleaningConfig: s.cleaningConfig,
      setCleaningConfig: s.setCleaningConfig,
      setCleaned: s.setCleaned,
      setCleanedInPlace: s.setCleanedInPlace,
    })),
  );
  const totalRowCount = useDataStore((s) => s.totalRowCount);
  const storagePath = useDataStore((s) => s.storagePath);
  const user = useAuthStore((s) => s.user);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isApplyingCleaning, setIsApplyingCleaning] = useState(false);
  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [showDataPreviewSheet, setShowDataPreviewSheet] = useState(false);

  const isCleaningBusy = isApplyingCleaning || isProcessingStep;
  const guardedSetStep = useCallback(
    (s: AppStep) => {
      if (isCleaningBusy) {
        showToastMessage({
          title: "Processing",
          description:
            "Please wait until cleaning finishes before switching steps.",
          icon: Info,
        });
        return;
      }
      setStep(s);
    },
    [isCleaningBusy, setStep],
  );

  const showCleaningToasts = useCallback(
    (diff: CleaningDiff, config: CleaningConfig) => {
      buildCleaningToasts(diff, config).forEach((toast, index) => {
        showToastMessage({
          title: toast.title,
          description: toast.detail,
          icon: toast.icon,
          duration: 5000 + index * 400,
        });
      });
    },
    [],
  );

  const handleApplyCleaning = useCallback(async () => {
    if (!raw || !cleaningConfig) return;
    flushSync(() => {
      setIsApplyingCleaning(true);
    });
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      // For large datasets, run cleaning server-side so the full rows are
      // processed (preview is only 100 rows for paint). Fall back to client for
      // anonymous/small files without a storagePath. Threshold 5000 via config.
      const { LARGE_FILE_THRESHOLD } = await import("@/config");
      const shouldUseServer =
        !!storagePath &&
        !!totalRowCount &&
        totalRowCount > LARGE_FILE_THRESHOLD;
      if (shouldUseServer) {
        // Smooth per-level: backend cleans full 200k but returns preview 100 only
        const res = await callCleanApi(
          storagePath!,
          cleaningConfig as unknown as Record<string, unknown>,
          raw.columns as unknown as Array<{
            name: string;
            type: string;
            detectedType: string;
          }>,
          true,
          100,
        );
        // Defensive: backend may return missing fields - fallback to raw
        const resRows = (res?.rows as unknown as typeof raw.rows) ?? [];
        const resCols =
          (res?.columns as unknown as typeof raw.columns) ?? raw.columns;
        const resDiff =
          (res?.diff as unknown as CleaningDiff) ?? ({} as CleaningDiff);
        // Ensure diff has safe defaults for global concurrent users (missing encodingLog etc.)
        const resDiffUnknown: unknown =
          resDiff as unknown as CleaningDiffRecord;
        const safeDiff: CleaningDiff = {
          ...resDiff,
          rowsRemoved: getNumberProp(resDiffUnknown, "rowsRemoved", 0),
          valuesImputed: getRecordProp(resDiffUnknown, "valuesImputed"),
          outliersHandled: getRecordProp(resDiffUnknown, "outliersHandled"),
          duplicatesRemoved: getNumberProp(
            resDiffUnknown,
            "duplicatesRemoved",
            0,
          ),
          columnsRemoved: getNumberProp(resDiffUnknown, "columnsRemoved", 0),
          encodingLog: getArrayProp(resDiffUnknown, "encodingLog"),
          indicatorColumnsAdded: getArrayProp(
            resDiffUnknown,
            "indicatorColumnsAdded",
          ),
          scaledColumns: getArrayProp(resDiffUnknown, "scaledColumns"),
        } as CleaningDiff;
        const previewDataset = {
          columns: resCols,
          rows: Array.isArray(resRows) ? resRows.slice(0, 100) : [],
          fileName: raw.fileName,
          uploadedAt: new Date(),
        };
        showCleaningToasts(safeDiff, cleaningConfig);
        setCleaned(previewDataset, safeDiff);
        // Keep totalRowCount as full (from res or previous)
        if (Array.isArray(resRows) && resRows.length > 100) {
          useDataStore.setState({
            totalRowCount:
              (res as unknown as { rowCount?: number }).rowCount ??
              totalRowCount,
          });
        }
        return;
      }
      // Use full raw (pipeline source of truth) — preview is display only.
      const baseData = raw ? ((await computePreviewData()) ?? raw) : null;
      if (!baseData?.columns || !baseData?.rows) return;
      const result = applyCleaningConfig(baseData, cleaningConfig);
      // Harden result for global scale: ensure dataset & diff never undefined
      const safeDataset = result?.dataset ?? baseData;
      const safeDiff2 = (result?.diff as CleaningDiff) ?? ({} as CleaningDiff);
      const safeDiff2Unknown: unknown =
        safeDiff2 as unknown as CleaningDiffRecord;
      showCleaningToasts(
        {
          ...safeDiff2,
          rowsRemoved: getNumberProp(safeDiff2Unknown, "rowsRemoved", 0),
          encodingLog: getArrayProp(safeDiff2Unknown, "encodingLog"),
        } as CleaningDiff,
        cleaningConfig,
      );
      setCleaned(
        {
          columns: safeDataset.columns ?? baseData.columns,
          rows: Array.isArray(safeDataset.rows)
            ? safeDataset.rows
            : baseData.rows,
          fileName: safeDataset.fileName ?? baseData.fileName,
          uploadedAt: safeDataset.uploadedAt ?? new Date(),
        } as typeof baseData,
        {
          ...safeDiff2,
          rowsRemoved: getNumberProp(safeDiff2Unknown, "rowsRemoved", 0),
          encodingLog: getArrayProp(safeDiff2Unknown, "encodingLog"),
        } as CleaningDiff,
      );
    } finally {
      setIsApplyingCleaning(false);
    }
  }, [
    raw,
    cleaningConfig,
    setCleaned,
    showCleaningToasts,
    storagePath,
    totalRowCount,
  ]);

  const handleProcessStep = useCallback(async () => {
    if (!raw || !cleaningConfig) return;
    setIsProcessingStep(true);
    setProcessError(null);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const { LARGE_FILE_THRESHOLD: T } = await import("@/config");
      const shouldUseServer =
        !!storagePath && !!totalRowCount && totalRowCount > T;
      if (shouldUseServer) {
        const res = await callCleanApi(
          storagePath!,
          cleaningConfig as unknown as Record<string, unknown>,
          raw.columns as unknown as Array<{
            name: string;
            type: string;
            detectedType: string;
          }>,
          true,
          100,
        );
        const resRows = (res?.rows as unknown as typeof raw.rows) ?? [];
        const resCols =
          (res?.columns as unknown as typeof raw.columns) ?? raw.columns;
        const resDiff =
          (res?.diff as unknown as CleaningDiff) ?? ({} as CleaningDiff);
        const resDiffUnknown2: unknown =
          resDiff as unknown as CleaningDiffRecord;
        const safeDiff: CleaningDiff = {
          ...resDiff,
          rowsRemoved: getNumberProp(resDiffUnknown2, "rowsRemoved", 0),
          encodingLog: getArrayProp(resDiffUnknown2, "encodingLog"),
        } as CleaningDiff;
        const previewDataset = {
          columns: resCols,
          rows: Array.isArray(resRows) ? resRows.slice(0, 100) : [],
          fileName: raw.fileName,
          uploadedAt: new Date(),
        };
        showCleaningToasts(safeDiff, cleaningConfig);
        setCleanedInPlace(previewDataset, safeDiff);
        return;
      }
      const baseData = raw ? ((await computePreviewData()) ?? raw) : null;
      if (!baseData?.columns || !baseData?.rows)
        throw new Error("Could not compute base data");
      const result = applyCleaningConfig(baseData, cleaningConfig);
      const safeDataset = result?.dataset ?? baseData;
      const safeDiff2 = (result?.diff as CleaningDiff) ?? ({} as CleaningDiff);
      const safeDiff2Unknown: unknown =
        safeDiff2 as unknown as CleaningDiffRecord;
      showCleaningToasts(
        {
          ...safeDiff2,
          rowsRemoved: getNumberProp(safeDiff2Unknown, "rowsRemoved", 0),
          encodingLog: getArrayProp(safeDiff2Unknown, "encodingLog"),
        } as CleaningDiff,
        cleaningConfig,
      );
      setCleanedInPlace(
        {
          columns: safeDataset.columns ?? baseData.columns,
          rows: Array.isArray(safeDataset.rows)
            ? safeDataset.rows
            : baseData.rows,
          fileName: safeDataset.fileName ?? baseData.fileName,
          uploadedAt: safeDataset.uploadedAt ?? new Date(),
        } as typeof baseData,
        {
          ...safeDiff2,
          rowsRemoved: getNumberProp(safeDiff2Unknown, "rowsRemoved", 0),
          encodingLog: getArrayProp(safeDiff2Unknown, "encodingLog"),
        } as CleaningDiff,
      );
    } catch (err: unknown) {
      setProcessError(
        sanitizeProcessError(
          err instanceof Error ? err.message : "Processing failed.",
        ),
      );
    } finally {
      setIsProcessingStep(false);
    }
  }, [
    raw,
    cleaningConfig,
    setCleanedInPlace,
    showCleaningToasts,
    storagePath,
    totalRowCount,
  ]);

  const handleConfirmReset = useCallback(() => {
    reset();
    setShowResetConfirm(false);
  }, [reset]);

  const isWorkspaceMode = Boolean(workspaceContext);
  const isAnonymous = !user;

  // Derived values
  const activeDataset = useMemo(() => {
    if (!raw) return null;
    if (cleaned && step !== STEPS_ID.clean) return cleaned;
    return raw;
  }, [raw, cleaned, step]);

  const stepOrder = useMemo(() => STEP_ORDER, []);
  const currentStepIndex = stepOrder.indexOf(step);
  // In workspace mode, skip 'upload' when going back
  const previousStep = useMemo(() => {
    if (currentStepIndex <= 0) return null;
    const prev = stepOrder[currentStepIndex - 1];
    if (isWorkspaceMode && prev === STEPS_ID.upload) return null;
    return prev;
  }, [currentStepIndex, stepOrder, isWorkspaceMode]);

  const workflowPrimaryAction = useMemo(() => {
    if (step === STEPS_ID.preview && raw) {
      return {
        label: "Continue to Cleaning",
        onClick: async () => {
          const baseData = await computePreviewData();
          if (baseData) {
            setCleaningConfig(buildDefaultConfig(baseData));
            setStep(STEPS_ID.clean);
          }
        },
      };
    }
    if (step === STEPS_ID.model && raw) {
      return {
        label: "Continue to Preview",
        onClick: () => {
          setStep(STEPS_ID.preview);
        },
      };
    }
    if (step === STEPS_ID.clean && raw) {
      return {
        label: "Continue to Analyse",
        onClick: handleApplyCleaning,
        disabled: isApplyingCleaning || isProcessingStep,
        loading: isApplyingCleaning,
      };
    }
    if (step === STEPS_ID.stats && cleaned) {
      return {
        label: "Continue to Export",
        onClick: () => guardedSetStep(STEPS_ID.export),
      };
    }
    return null;
  }, [
    step,
    raw,
    cleaned,
    setCleaningConfig,
    setStep,
    guardedSetStep,
    handleApplyCleaning,
    isApplyingCleaning,
    isProcessingStep,
  ]);

  const showWorkflowFooter = Boolean(
    activeDataset || step !== STEPS_ID.upload || workflowPrimaryAction,
  );

  // Render

  return (
    <div
      className={`pipeline ${isWorkspaceMode ? "pipeline--workspace" : "pipeline--anonymous"}`}
    >
      <ObjectivePrompt />
      {/* Workspace header with dataset switcher */}
      {workspaceContext && (
        <div className="pipeline-ws-header">
          <div className="pipeline-ws-header-left">
            <button
              className="btn-ghost btn-sm"
              onClick={workspaceContext.onBack}
            >
              ← Back to Workspace
            </button>
            <span className="pipeline-ws-title">
              Working in: {workspaceContext.workspaceName}
            </span>
          </div>
        </div>
      )}

      {/* Anonymous sign-in CTA */}
      {!isWorkspaceMode && isAnonymous && step !== STEPS_ID.upload && (
        <div className="pipeline-anon-banner">
          <span>Your progress is not saved.</span>
          <Link to="/login" className="btn-primary btn-sm">
            Sign in to save
          </Link>
        </div>
      )}

      <div className="px-4 sm:px-6 pt-3">
        <Stepper
          current={step}
          setStep={guardedSetStep}
          isWorkspaceMode={isWorkspaceMode}
          disabled={isCleaningBusy}
        />
      </div>

      <div className="page-layout">
        <main className="app-main">
          {showWorkflowFooter && (
            <WorkflowToolbar
              previousStep={previousStep}
              onBack={guardedSetStep}
              onNewFile={
                !isWorkspaceMode && step !== STEPS_ID.upload
                  ? () => setShowResetConfirm(true)
                  : undefined
              }
              onToggleSidebar={
                step === STEPS_ID.preview
                  ? () => setShowDataPreviewSheet((prev) => !prev)
                  : undefined
              }
              primaryAction={workflowPrimaryAction}
            />
          )}

          {/* Upload step — hidden in workspace mode */}
          {!isWorkspaceMode && step === STEPS_ID.upload && (
            <div className="step-panel">
              <Upload />
            </div>
          )}

          {step === STEPS_ID.model && (
            <div className="step-panel">
              <DataModeller isActive={true} />
            </div>
          )}

          {step === STEPS_ID.preview && (
            <div className="step-panel">
              <DataPreview
                showSidebar={showDataPreviewSheet}
                onSidebarOpenChange={setShowDataPreviewSheet}
              />
            </div>
          )}

          {/* TODO: Redesign */}
          {step === STEPS_ID.clean && (
            <div className="step-panel">
              <CleaningPanel
                onProcess={handleProcessStep}
                isProcessing={isProcessingStep}
                processError={processError}
              />
            </div>
          )}

          {step === STEPS_ID.stats && (
            <div className="step-panel">
              <AnalysePanel />
            </div>
          )}

          {step === STEPS_ID.export && (
            <div className="step-panel">
              <Suspense
                fallback={
                  <div className="p-8 text-sm text-muted-foreground">
                    Loading export…
                  </div>
                }
              >
                <ExportPanel
                  onExport={() => workspaceContext?.onExportGenerated?.()}
                />
              </Suspense>
            </div>
          )}

          {/* Notebook — per workspace, cells reference datasets, superseded kept for provenance (G24) */}
          <div className="step-panel notebook-panel">
            <NotebookView />
          </div>
        </main>
      </div>

      {/* Reset confirm dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
          hideClose
        >
          <div className="modal-content">
            <h3>Start fresh?</h3>
            <p>
              This will discard your current dataset and all analysis results.
            </p>
            <div className="modal-actions">
              <button
                className="btn-ghost btn-sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleConfirmReset}
              >
                Start fresh
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CartFab />
    </div>
  );
}
