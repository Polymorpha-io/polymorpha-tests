import { type RefObject } from "react";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { Dataset } from "@/types";
import { HtmlDocPreview } from "./HtmlPreview";
import type {
  DataPreviewTab,
  ExportType,
  PreviewTable,
} from "./types";

interface ExportPreviewProps {
  typeLabel: Record<ExportType, string>;
  selectedType: ExportType;
  isPdfType: boolean;
  htmlPreviewLoading: boolean;
  htmlPreviewError: string | null;
  htmlDocDef: TDocumentDefinitions | null;
  cleaned: Dataset;
  tabularPreview: PreviewTable;
  dataPreviewTab: DataPreviewTab;
  setDataPreviewTab: (tab: DataPreviewTab) => void;
  setShowDataModal: (open: boolean) => void;
  generating: boolean;
  genProgress: number;
  genPhase: string;
  abortRef: RefObject<AbortController | null>;
  previewApproved: boolean;
  setPreviewApproved: (approved: boolean) => void;
  canUsePdfTypes: boolean;
  canExportExcel: boolean;
  canExportCSV: boolean;
  handleGenerate: () => void;
  lastGeneratedExport: {
    uid: string;
    fileName: string;
    mode: "premium-pdf" | "statistical-pdf" | "excel" | "csv" | "docx";
    blob?: Blob;
    sections?: string[];
  } | null;
  wsId: string | null;
  handleSaveToWorkspace: () => void;
  savingToWorkspace: boolean;
}

export function ExportPreview(props: ExportPreviewProps) {
  const {
    typeLabel,
    selectedType,
    isPdfType,
    htmlPreviewLoading,
    htmlPreviewError,
    htmlDocDef,
    cleaned,
    tabularPreview,
    dataPreviewTab,
    setDataPreviewTab,
    setShowDataModal,
    generating,
    genProgress,
    genPhase,
    abortRef,
    previewApproved,
    setPreviewApproved,
    canUsePdfTypes,
    canExportExcel,
    canExportCSV,
    handleGenerate,
    lastGeneratedExport,
    wsId,
    handleSaveToWorkspace,
    savingToWorkspace,
  } = props;
  return (
        <div className="ep-preview">
          <div className="ep-preview-head">
            <h4>Preview: {typeLabel[selectedType]}</h4>
          </div>
          <div className="ep-preview-page-wrap">
            <div className="ep-preview-mockup-area">
              {isPdfType ? (
                htmlPreviewLoading ? (
                  <div className="ep-preview-loading">
                    <span>Building HTML document preview...</span>
                  </div>
                ) : htmlPreviewError ? (
                  <div className="ep-preview-loading">
                    <span>{htmlPreviewError}</span>
                  </div>
                ) : (
                  <HtmlDocPreview docDef={htmlDocDef} />
                )
              ) : (
                <div className="ep-inline-data-preview">
                  <div className="ep-inline-data-head">
                    <span className="ep-inline-data-title">
                      {selectedType === "excel"
                        ? "Excel Workbook"
                        : "CSV Export"}
                    </span>
                    <span className="ep-inline-data-meta">
                      {cleaned.rows.length.toLocaleString()} rows ×{" "}
                      {cleaned.columns.length} columns
                    </span>
                  </div>
                  {selectedType === "excel" && (
                    <div className="ep-inline-sheet-tabs">
                      <button
                        type="button"
                        className={`ep-sheet-badge${dataPreviewTab === "cleaned" ? " ep-sheet-badge--active" : ""}`}
                        onClick={() => setDataPreviewTab("cleaned")}
                      >
                        Cleaned Data
                      </button>
                      <button
                        type="button"
                        className={`ep-sheet-badge${dataPreviewTab === "descriptive" ? " ep-sheet-badge--active" : ""}`}
                        onClick={() => setDataPreviewTab("descriptive")}
                      >
                        Descriptive Stats
                      </button>
                      <button
                        type="button"
                        className={`ep-sheet-badge${dataPreviewTab === "tests" ? " ep-sheet-badge--active" : ""}`}
                        onClick={() => setDataPreviewTab("tests")}
                      >
                        Tests
                      </button>
                    </div>
                  )}
                  <div className="ep-inline-table-scroll">
                    <table className="ep-inline-table">
                      <thead>
                        <tr>
                          {tabularPreview.columns.map((c) => (
                            <th key={c.name}>
                              <span className="ep-inline-col-name">
                                {c.name}
                              </span>
                              {c.type ? (
                                <span
                                  className={`ep-inline-col-type ep-inline-col-type--${c.type}`}
                                >
                                  {c.type}
                                </span>
                              ) : null}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tabularPreview.rows.slice(0, 20).map((row, i) => (
                          <tr key={i}>
                            {tabularPreview.columns.map((c) => (
                              <td key={c.name}>
                                {String(row[c.name] ?? "N/A")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tabularPreview.rows.length > 20 && (
                    <p className="ep-inline-truncated">
                      Showing 20 of{" "}
                      {tabularPreview.rows.length.toLocaleString()} rows
                      <button
                        className="ep-inline-expand-btn"
                        onClick={() => setShowDataModal(true)}
                      >
                        View all →
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>
            {generating && (
              <div className="ep-preview-refresh-overlay">
                <div className="ep-preview-spinner" />
                <span>{genPhase || "Generating PDF..."}</span>
                <div className="ep-progress-bar-wrap">
                  <div
                    className="ep-progress-bar"
                    style={{ width: `${genProgress}%` }}
                  />
                </div>
                <span className="ep-progress-pct">{genProgress}%</span>
                <button
                  className="ep-stop-btn"
                  onClick={() => abortRef.current?.abort()}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="ep-preview-footer">
            {isPdfType && (
              <label className="ep-preview-approve">
                <input
                  type="checkbox"
                  checked={previewApproved}
                  onChange={(e) => setPreviewApproved(e.target.checked)}
                  disabled={generating || !canUsePdfTypes}
                />
                <span>Preview looks good, ready to export</span>
              </label>
            )}
            <button
              className="ep-preview-gen-btn"
              onClick={handleGenerate}
              disabled={
                generating ||
                (isPdfType && (!canUsePdfTypes || !previewApproved)) ||
                (selectedType === "excel" && !canExportExcel) ||
                (selectedType === "csv" && !canExportCSV)
              }
            >
              {generating
                ? `${genPhase || "Generating..."} - ${genProgress}%`
                : `Export ${typeLabel[selectedType]}`}
            </button>
            {lastGeneratedExport && wsId && (
              <div className="ep-workspace-save-row">
                <button
                  className="btn-primary btn-sm"
                  onClick={handleSaveToWorkspace}
                  disabled={savingToWorkspace}
                >
                  {savingToWorkspace ? "Saving..." : "Save to workspace"}
                </button>
              </div>
            )}
          </div>
        </div>
  );
}
