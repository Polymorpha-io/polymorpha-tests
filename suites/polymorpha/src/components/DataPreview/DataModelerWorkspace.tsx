import type { RefObject } from "react";
import {
  Download,
  Save,
  Combine,
  SplitSquareVertical,
  BarChart2,
  Plus,
  Database,
  HelpCircle,
} from "lucide-react";
import { exportCleanedCSVWithName } from "@polymorpha/business-logic";
import type { Column, Dataset } from "@/types";
import type { PipelineProps } from "@/components/Pipeline/Pipeline";
import { DataModelerCanvas } from "./DataModelerCanvas";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { DataModellerHelpModal } from "./DataModellerHelpModal";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface DataModelerWorkspaceProps {
  mobileOpen: boolean;
  onMobileClose?: () => void;
  fileName: string;
  rows: Record<string, unknown>[];
  columns: Column[];
  totalRowCount?: number | null;
  previewLimit?: number;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  handleDownloadModel: () => void;
  handleSaveModel: () => void;
  workspaceContext?: PipelineProps["workspaceContext"];
  extraDatasets: Dataset[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  allAvailableDatasets: Dataset[];
  setTerminalDataset: (ds: Dataset | null) => void;
  setPreviewDataset: (ds: Dataset | null) => void;
  viewDataset: Dataset;
  displayRows: Record<string, unknown>[];
  orderedColumns: Column[];
}

export function DataModelerWorkspace({
  mobileOpen,
  onMobileClose,
  fileName,
  rows,
  columns,
  totalRowCount,
  previewLimit = 100,
  isHelpOpen,
  setIsHelpOpen,
  handleDownloadModel,
  handleSaveModel,
  workspaceContext,
  extraDatasets,
  fileInputRef,
  handleLocalUpload,
  isImporting,
  allAvailableDatasets,
  setTerminalDataset,
  setPreviewDataset,
  viewDataset,
  displayRows,
  orderedColumns,
}: DataModelerWorkspaceProps) {
  const effectiveTotal = totalRowCount ?? rows.length;
  const isTruncated = effectiveTotal > previewLimit;
  const previewLabel = isTruncated
    ? `${previewLimit.toLocaleString()} of ${effectiveTotal.toLocaleString()} rows · ${columns.length} cols — preview (full data used for stats/clean)`
    : `${effectiveTotal.toLocaleString()} rows · ${columns.length} cols`;
  return (
    <div
      className={`preview-container${mobileOpen ? " preview--mobile-open" : ""}`}
    >
      <div className="preview-header">
        <div>
          <h2>{fileName} · Data Modeller</h2>
          <p className="preview-meta" title={previewLabel}>
            {previewLabel}
          </p>
        </div>
        <div
          className="preview-header-actions"
          style={{ display: "flex", gap: "8px" }}
        >
          <button
            className="btn-ghost btn-sm"
            onClick={() => setIsHelpOpen(true)}
          >
            <HelpCircle size={14} /> Help
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={handleDownloadModel}
          >
            <Download size={14} /> Download CSV
          </button>
          <button className="btn-primary btn-sm" onClick={handleSaveModel}>
            <Save size={14} /> Save & Continue
          </button>
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
      <div className="data-modeler-layout">
        <aside className="data-modeler-sidebar">
          <div className="data-modeler-sidebar-header">
            <Database size={16} /> Connections
          </div>
          <div className="data-modeler-sidebar-content">
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({
                    nodeType: "dataSource",
                    label: `${fileName} (Current)`,
                    sourceId: fileName,
                    rowCount: effectiveTotal,
                    colCount: columns.length,
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <Database size={14} /> <span>{fileName} (Current)</span>
            </div>
            {workspaceContext?.datasets
              .filter((d) => d.fileName !== fileName)
              .map((d) => (
                <div
                  key={d.uploadId}
                  className="data-source-draggable"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/reactflow",
                      JSON.stringify({
                        nodeType: "dataSource",
                        label: d.fileName,
                        sourceId: d.fileName,
                      }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <Database size={14} /> <span>{d.fileName}</span>
                </div>
              ))}
            {extraDatasets.map((d, i) => (
              <div
                key={`extra-${i}`}
                className="data-source-draggable"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/reactflow",
                    JSON.stringify({
                      nodeType: "dataSource",
                      label: d.fileName,
                      sourceId: d.fileName,
                      rowCount: d.rows.length,
                      colCount: d.columns.length,
                    }),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <Database size={14} /> <span>{d.fileName}</span>
              </div>
            ))}

            <div style={{ marginTop: "12px" }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".csv,.xlsx"
                onChange={handleLocalUpload}
              />
              <button
                className="btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Plus size={14} />{" "}
                {isImporting ? "Importing..." : "Import Data"}
              </button>
            </div>

            <div
              style={{
                marginTop: "16px",
                fontSize: "11px",
                color: "var(--muted-foreground)",
              }}
            >
              Drag tables into the canvas to join or union them.
            </div>
          </div>

          <div
            className="data-modeler-sidebar-header"
            style={{ marginTop: "16px" }}
          >
            <Combine size={16} /> Operations
          </div>
          <div className="data-modeler-sidebar-content">
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({
                    nodeType: "join",
                    label: "Inner Join",
                    joinType: "inner",
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <Combine size={14} /> <span>Inner Join</span>
            </div>
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({
                    nodeType: "join",
                    label: "Left Join",
                    joinType: "left",
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <Combine size={14} /> <span>Left Join</span>
            </div>
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({
                    nodeType: "join",
                    label: "Full Join",
                    joinType: "full",
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <Combine size={14} /> <span>Full Join</span>
            </div>
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({ nodeType: "union", label: "Union" }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <SplitSquareVertical size={14} /> <span>Union</span>
            </div>
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({
                    nodeType: "aggregate",
                    label: "Aggregate",
                  }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <BarChart2 size={14} /> <span>Aggregate</span>
            </div>
            <div
              className="data-source-draggable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/reactflow",
                  JSON.stringify({ nodeType: "export", label: "Export" }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <Download size={14} /> <span>Export</span>
            </div>
          </div>
        </aside>
        <div
          className="preview-canvas-area data-modeler-top-pane"
          style={{
            flex: 1,
            backgroundColor: "var(--background)",
            position: "relative",
          }}
        >
          <DataModelerCanvas
            datasets={allAvailableDatasets}
            totalRowCount={effectiveTotal}
            previewLimit={previewLimit}
            onModelChange={setTerminalDataset}
            onPreviewChange={setPreviewDataset}
            onExportNodeClick={(ds) =>
              exportCleanedCSVWithName(ds, `${ds.fileName}-modeled`)
            }
          />
        </div>
        <div className="data-modeler-bottom-pane ag-theme-quartz">
          <div
            style={{
              width: "100%",
              height: "100%",
              flex: 1,
              overflow: "hidden",
            }}
          >
            <AgGridReact
              key={`grid-${viewDataset.fileName || "unknown"}`}
              rowData={displayRows}
              columnDefs={orderedColumns.map((c) => ({
                field: c.name,
                headerName: c.name,
                filter: true,
                sortable: true,
                resizable: true,
              }))}
              rowSelection={{ mode: "multiRow" }}
              suppressCellFocus={true}
              defaultColDef={{ minWidth: 100 }}
            />
          </div>
          {isTruncated && (
            <div className="vtable-truncation-note" style={{ borderTop: "1px solid var(--border)" }}>
              Showing first {previewLimit.toLocaleString()} of {effectiveTotal.toLocaleString()} rows — scroll preview, full dataset runs in analysis
            </div>
          )}
        </div>
      </div>

      <DataModellerHelpModal
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
