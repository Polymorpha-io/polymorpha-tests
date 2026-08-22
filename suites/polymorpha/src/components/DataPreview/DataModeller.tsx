import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "@/types";
import { useShallow } from "zustand/react/shallow";
import { applyCleaningConfig } from "@polymorpha/business-logic";
import { useDataStore } from "@/store/useDataStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ANON_MAX_ROWS } from "@/config";
import type { PipelineProps } from "@/components/Pipeline/Pipeline";
import { computePreviewData } from "@/lib/data-ops";
import { toast } from "sonner";
import { AppliedStepsSidebar } from "./AppliedStepsSidebar";
import { AnonymousLimitModal } from "@/components/AnonymousLimitModal";
import "./DataModeller.css";
import "./css/dm-toolbar.css";
import "./css/dm-steps-sidebar.css";
import "./css/dm-sidebar-toggle.css";
import "./css/dm-vtable.css";
import "./css/dm-mobile.css";
import "./css/dm-layout.css";
import { exportCleanedCSVWithName } from "@polymorpha/business-logic";
import { hashFile } from "@polymorpha/business-logic";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage, getFirebaseAuth } from "@/config/firebase";
import { callParseApi } from "@/lib/stats/api";
import {
  SIDEBAR_COLLAPSE_THRESHOLD,
  collectManipulatedColumns,
  getColPx,
} from "./dataModellerUtils";
import { TypeBadge } from "./TypeBadge";
import { DataModellerTable } from "./DataModellerTable";
import { DataModelerWorkspace } from "./DataModelerWorkspace";
import { DataOperationModals } from "./DataOperationModals";

interface DataModellerProps {
  readOnly?: boolean;
  isActive?: boolean;
  previewLimit?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  workspaceContext?: PipelineProps["workspaceContext"];
}

export function DataModeller({
  readOnly = false,
  isActive = true,
  previewLimit: previewLimitProp = 100,
  mobileOpen = false,
  onMobileClose,
  workspaceContext,
}: DataModellerProps) {
  const { raw, cleaned, cleaningConfig, step, appliedSteps, addAppliedStep } =
    useDataStore(
      useShallow((s) => ({
        raw: s.raw,
        cleaned: s.cleaned,
        cleaningConfig: s.cleaningConfig,
        step: s.step,
        appliedSteps: s.appliedSteps,
        addAppliedStep: s.addAppliedStep,
      })),
    );

  const previewLimit = previewLimitProp;

  const parentRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [activeOperation, setActiveOperation] = useState<
    "group" | "merge" | "append" | "pivot" | "unpivot" | null
  >(null);

  const [extraDatasets, setExtraDatasets] = useState<Dataset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [terminalDataset, setTerminalDataset] = useState<Dataset | null>(null);
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [anonLimitOpen, setAnonLimitOpen] = useState(false);
  const [anonLimitInfo, setAnonLimitInfo] = useState<{
    total: number;
    truncated: number;
  } | null>(null);

  const allAvailableDatasets = useMemo(() => {
    return raw ? [raw, ...extraDatasets] : extraDatasets;
  }, [raw, extraDatasets]);

  useEffect(() => {
    if (!isActive) return;

    const element = parentRef.current;
    if (!element) return;

    const updateWidth = () => setAvailableWidth(element.clientWidth);
    const frameId = requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isActive]);

  const [computedRaw, setComputedRaw] = useState<Dataset | null>(raw);
  const [isComputing, setIsComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);

  useEffect(() => {
    if (!raw) return;
    if (appliedSteps.length === 0) {
      setComputedRaw(raw);
      setComputeError(null);
      return;
    }

    let isMounted = true;
    setIsComputing(true);
    setComputeError(null);

    computePreviewData()
      .then((data) => {
        if (isMounted && data) {
          setComputedRaw(data);
          setIsComputing(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setComputeError(err.message);
          setIsComputing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [raw, appliedSteps]);

  const cleanStepSample = useMemo(() => {
    if (step !== "clean" || !computedRaw || !cleaningConfig) return null;
    const sampleDataset = {
      ...computedRaw,
      rows: computedRaw.rows.slice(0, previewLimit),
    };
    return applyCleaningConfig(sampleDataset, cleaningConfig);
  }, [step, computedRaw, cleaningConfig, previewLimit]);

  // Diff info for color-coding
  const cleanDiff = cleanStepSample?.diff ?? null;

  // Raw rows for diff comparison on clean step
  const rawSampleRows = useMemo(() => {
    if (step !== "clean" || !computedRaw) return null;
    return computedRaw.rows.slice(0, previewLimit);
  }, [step, computedRaw, previewLimit]);

  const safeDataset = previewDataset ??
    computedRaw ?? {
      columns: [],
      rows: [],
      fileName: "",
      uploadedAt: new Date(),
    };
  const viewDataset =
    step === "clean"
      ? (cleanStepSample?.dataset ?? safeDataset)
      : step === "stats" || step === "export"
        ? (cleaned ?? safeDataset)
        : safeDataset;
  const isPreviewMode = step === "clean";

  const { columns, rows, fileName } = viewDataset;
  const orderedColumns = useMemo(() => {
    if (!isPreviewMode) return columns;
    const prioritized = collectManipulatedColumns(cleaningConfig);
    if (prioritized.length === 0) return columns;

    const rank = new Map(prioritized.map((name, index) => [name, index]));
    const promoted = columns
      .filter((column) => rank.has(column.name))
      .sort(
        (left, right) =>
          (rank.get(left.name) ?? 0) - (rank.get(right.name) ?? 0),
      );
    const remainder = columns.filter((column) => !rank.has(column.name));
    return [...promoted, ...remainder];
  }, [columns, cleaningConfig, isPreviewMode]);
  const isSamplePanel = isPreviewMode && readOnly;

  const numericCount = orderedColumns.filter(
    (c) => c.type === "numeric",
  ).length;
  const categoricalCount = orderedColumns.filter(
    (c) => c.type === "categorical",
  ).length;
  const otherCount = orderedColumns.length - numericCount - categoricalCount;

  const [sidebarOpen, setSidebarOpen] = useState(
    orderedColumns.length <= SIDEBAR_COLLAPSE_THRESHOLD,
  );
  // Auto-collapse when column count changes (e.g., new file uploaded)
  useEffect(() => {
    setSidebarOpen(orderedColumns.length <= SIDEBAR_COLLAPSE_THRESHOLD);
  }, [orderedColumns.length]);

  // Column widths — computed once, shared by header + every virtual row
  const ROW_NUM_PX = 52;
  const baseColPxs = orderedColumns.map(getColPx);
  const baseTotalWidth = ROW_NUM_PX + baseColPxs.reduce((a, b) => a + b, 0);
  const extraWidthPerColumn =
    orderedColumns.length > 0 && availableWidth > baseTotalWidth
      ? Math.floor((availableWidth - baseTotalWidth) / orderedColumns.length)
      : 0;
  const extraWidthRemainder =
    orderedColumns.length > 0 && availableWidth > baseTotalWidth
      ? (availableWidth - baseTotalWidth) % orderedColumns.length
      : 0;
  const colPxs = baseColPxs.map(
    (px, index) =>
      px + extraWidthPerColumn + (index < extraWidthRemainder ? 1 : 0),
  );
  const totalWidth = Math.max(
    baseTotalWidth,
    availableWidth,
    ROW_NUM_PX + colPxs.reduce((a, b) => a + b, 0),
  );
  const gridCols = `${ROW_NUM_PX}px ` + colPxs.map((px) => `${px}px`).join(" ");

  const displayRows =
    rows.length > previewLimit ? rows.slice(0, previewLimit) : rows;
  // raw is full pipeline source of truth; preview is 100-slice for display.
  const fullRowCount = raw?.rows.length ?? rows.length;
  const isTruncated = fullRowCount > previewLimit;

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 10,
  });

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const contentHash = await hashFile(file, () => {});
      const uid = getFirebaseAuth()?.currentUser?.uid;
      const tempPath = uid
        ? `users/${uid}/uploads/pending/${contentHash}/${file.name}`
        : `anonymous/pending/${contentHash}/${file.name}`;
      const storage = getFirebaseStorage();
      if (!storage) throw new Error("Storage not available");

      await uploadBytes(ref(storage, tempPath), file);

      // Fetch full file for canvas DAG - preview slicing is display-only (DataModelerWorkspace does slice)
      const parsed = await callParseApi(tempPath);
      let effectiveRows = parsed.rows as Dataset["rows"];
      let effectiveFileName = parsed.fileName;
      if (!uid && parsed.rowCount > ANON_MAX_ROWS) {
        effectiveRows = effectiveRows.slice(0, ANON_MAX_ROWS);
        setAnonLimitInfo({
          total: parsed.rowCount,
          truncated: ANON_MAX_ROWS,
        });
        setAnonLimitOpen(true);
        toast.message(
          `Anonymous uploads limited to first ${ANON_MAX_ROWS.toLocaleString()} of ${parsed.rowCount.toLocaleString()} rows. Sign in for unlimited.`,
        );
      }
      const newDataset: Dataset = {
        columns: parsed.columnTypes as Dataset["columns"],
        rows: effectiveRows,
        fileName: effectiveFileName,
        uploadedAt: new Date(),
      };
      setExtraDatasets((prev) => [...prev, newDataset]);
    } catch (err) {
      console.error("Failed to import local file", err);
      alert(
        "Failed to import file: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadModel = () => {
    exportCleanedCSVWithName(viewDataset, `${fileName}-modeled`);
  };

  const handleSaveModel = async () => {
    let next = terminalDataset ?? computedRaw!;
    const state = useDataStore.getState();
    const uid = useAuthStore.getState().user?.uid;
    if (!uid && next.rows.length > ANON_MAX_ROWS) {
      setAnonLimitInfo({
        total: next.rows.length,
        truncated: ANON_MAX_ROWS,
      });
      setAnonLimitOpen(true);
      toast.message(
        `Anonymous limited to first ${ANON_MAX_ROWS.toLocaleString()} of ${next.rows.length.toLocaleString()} rows. Sign in for unlimited.`,
      );
      next = { ...next, rows: next.rows.slice(0, ANON_MAX_ROWS) };
    }
    const isMutated =
      appliedSteps.length > 0 ||
      (terminalDataset !== null && terminalDataset !== computedRaw) ||
      extraDatasets.length > 0;
    // Mutated data no longer matches Storage file - null it so downstream stats use rows mode (full raw) not stale storageBacked fetch. No extra Storage put for global scale - client distributes load; Phase 2 can re-upload if >50k.
    const storagePath = isMutated ? null : (state.storagePath ?? null);
    const preview: Dataset = { ...next, rows: next.rows.slice(0, 100) };
    await state.setRaw(next, {
      storagePath,
      totalRowCount: next.rows.length,
      preview,
    });
    state.setStep("preview");
  };

  if (!raw) return null;

  if (!readOnly && isActive && !isSamplePanel) {
    return (
      <>
        <DataModelerWorkspace
          mobileOpen={mobileOpen}
          onMobileClose={onMobileClose}
          fileName={fileName}
          rows={rows}
          columns={columns}
          totalRowCount={fullRowCount}
          previewLimit={previewLimit}
          isHelpOpen={isHelpOpen}
          setIsHelpOpen={setIsHelpOpen}
          handleDownloadModel={handleDownloadModel}
          handleSaveModel={handleSaveModel}
          workspaceContext={workspaceContext}
          extraDatasets={extraDatasets}
          fileInputRef={fileInputRef}
          handleLocalUpload={handleLocalUpload}
          isImporting={isImporting}
          allAvailableDatasets={allAvailableDatasets}
          setTerminalDataset={setTerminalDataset}
          setPreviewDataset={setPreviewDataset}
          viewDataset={viewDataset}
          displayRows={displayRows}
          orderedColumns={orderedColumns}
        />
        {anonLimitInfo && (
          <AnonymousLimitModal
            open={anonLimitOpen}
            onOpenChange={setAnonLimitOpen}
            totalRows={anonLimitInfo.total}
            truncatedRows={anonLimitInfo.truncated}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={`preview-container${isSamplePanel ? " preview-container--sample" : ""}${mobileOpen ? " preview--mobile-open" : ""}`}
    >
      <div
        className={`preview-header${isSamplePanel ? " preview-header--sample" : ""}`}
      >
        <div>
          <h2>
            {isSamplePanel
              ? "Sample Cleaned Preview"
              : isPreviewMode
                ? `${fileName} · cleaned preview`
                : fileName}
          </h2>
          <p className="preview-meta">
            {fullRowCount.toLocaleString()} rows · {columns.length} columns
          </p>
        </div>
        {onMobileClose && (
          <button
            className="modal-close-icon preview-close-mobile"
            onClick={onMobileClose}
            aria-label="Close preview"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {isPreviewMode && (
        <div
          className={`preview-clean-banner${isSamplePanel ? " preview-clean-banner--sample" : ""}`}
        >
          Sample preview of what might change (first {previewLimit} rows only).
          New generated columns such as bin outputs are moved to the front here.
          Full cleaning runs after you click Apply Cleaning.
        </div>
      )}

      {/* NEW DATA OPERATIONS TOOLBAR */}
      {!readOnly && isActive && workspaceContext && !isSamplePanel && (
        <div className="preview-data-ops-toolbar">
          <div className="preview-data-ops-toolbar-left">
            <span className="ops-toolbar-title">Data Operations</span>
            <span className="ops-toolbar-subtitle">
              Power Query inspired tools
            </span>
          </div>
          <div className="preview-data-ops-toolbar-actions">
            <button
              className="btn-secondary btn-sm"
              onClick={() => setActiveOperation("group")}
            >
              Group By
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setActiveOperation("merge")}
            >
              Merge Datasets
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setActiveOperation("append")}
            >
              Append Datasets
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setActiveOperation("pivot")}
            >
              Pivot
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setActiveOperation("unpivot")}
            >
              Unpivot
            </button>
          </div>
        </div>
      )}

      {(() => {
        const showLeftSidebar = !readOnly && sidebarOpen;
        const showRightSidebar = !readOnly && isActive && !isSamplePanel;

        let layoutClass = "preview-content-layout";
        if (!showLeftSidebar && !showRightSidebar)
          layoutClass += " preview-content-layout--table-only";
        else if (!showLeftSidebar)
          layoutClass += " preview-content-layout--right-only";
        else if (!showRightSidebar)
          layoutClass += " preview-content-layout--left-only";
        else layoutClass += " preview-content-layout--both";

        return (
          <div className={layoutClass}>
            {showLeftSidebar && (
              <aside
                className="preview-schema-sidebar"
                aria-label="Columns overview"
              >
                <div className="preview-schema-summary preview-schema-summary--sidebar">
                  {numericCount > 0 && (
                    <span>
                      <strong>{numericCount}</strong> numeric
                    </span>
                  )}
                  {categoricalCount > 0 && (
                    <span>
                      <strong>{categoricalCount}</strong> categorical
                    </span>
                  )}
                  {otherCount > 0 && (
                    <span>
                      <strong>{otherCount}</strong> other
                    </span>
                  )}
                  {orderedColumns.length > SIDEBAR_COLLAPSE_THRESHOLD && (
                    <button
                      className="sidebar-toggle-btn"
                      onClick={() => setSidebarOpen(false)}
                      aria-label="Hide columns sidebar"
                    >
                      Hide
                    </button>
                  )}
                </div>
                <div className="preview-columns preview-columns--sidebar">
                  {orderedColumns.map((col) => (
                    <div key={col.name} className="col-card">
                      <TypeBadge col={col} />
                      <span className="col-name" title={col.name}>
                        {col.name}
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            )}
            {!readOnly && !sidebarOpen && (
              <button
                className="sidebar-expand-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Show columns sidebar"
                title="Show columns sidebar"
              >
                <span className="sidebar-expand-count">
                  {orderedColumns.length} cols
                </span>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 3 11 8 6 13" />
                </svg>
              </button>
            )}

            <div className="preview-table-pane">
              {computeError && (
                <div
                  className="vtable-truncation-note"
                  style={{
                    background: "var(--destructive, #ef4444)",
                    color: "white",
                    borderTop: "none",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Error computing preview data: {computeError}
                </div>
              )}
              {isComputing && (
                <div
                  className="vtable-truncation-note"
                  style={{
                    background: "var(--muted)",
                    borderTop: "none",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  Computing preview data...
                </div>
              )}
              {/* Virtual table (CSS grid — alignment guaranteed) */}
              <DataModellerTable
                parentRef={parentRef}
                rowVirtualizer={rowVirtualizer}
                gridCols={gridCols}
                totalWidth={totalWidth}
                orderedColumns={orderedColumns}
                displayRows={displayRows}
                isPreviewMode={isPreviewMode}
                rawSampleRows={rawSampleRows}
                cleanDiff={cleanDiff}
                cleaningConfig={cleaningConfig}
              />
            </div>

            {showRightSidebar && <AppliedStepsSidebar />}
          </div>
        );
      })()}
      {isTruncated && (
        <div className="vtable-truncation-note">
          Showing first {previewLimit.toLocaleString()} of{" "}
          {fullRowCount.toLocaleString()} rows
        </div>
      )}

      {/* DATA OPERATION MODALS */}
      <DataOperationModals
        activeOperation={activeOperation}
        onClose={() => setActiveOperation(null)}
        orderedColumns={orderedColumns}
        fileName={fileName}
        workspaceContext={workspaceContext}
        addAppliedStep={addAppliedStep}
      />
      {anonLimitInfo && (
        <AnonymousLimitModal
          open={anonLimitOpen}
          onOpenChange={setAnonLimitOpen}
          totalRows={anonLimitInfo.total}
          truncatedRows={anonLimitInfo.truncated}
        />
      )}
    </div>
  );
}
