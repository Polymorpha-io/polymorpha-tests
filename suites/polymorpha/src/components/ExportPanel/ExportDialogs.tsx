import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import type { Dataset } from "@/types";
import type { ExportType } from "./types";
import type {
  DataPreviewTab,
  PendingPdfSave,
  PreviewTable,
} from "./types";

interface DataPreviewModalProps {
  showDataModal: boolean;
  setShowDataModal: (open: boolean) => void;
  selectedType: ExportType;
  exportFileBaseName: string;
  dataPreviewTab: DataPreviewTab;
  setDataPreviewTab: (tab: DataPreviewTab) => void;
  tabularPreview: PreviewTable;
  cleaned: Dataset | null;
}

export function DataPreviewModal(props: DataPreviewModalProps) {
  const {
    showDataModal,
    setShowDataModal,
    selectedType,
    exportFileBaseName,
    dataPreviewTab,
    setDataPreviewTab,
    tabularPreview,
    cleaned,
  } = props;
  return (
      <Dialog open={showDataModal && !!cleaned} onOpenChange={setShowDataModal}>
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
          hideClose
        >
          <div className="ep-data-modal">
            <div className="ep-data-modal-head">
              <h3>
                {selectedType === "excel"
                  ? "Excel Workbook Preview"
                  : "CSV Preview"}{" "}
                - {exportFileBaseName}
              </h3>
              <button
                className="ep-data-modal-close"
                onClick={() => setShowDataModal(false)}
              >
                ×
              </button>
            </div>
            {selectedType === "excel" && (
              <div className="ep-data-modal-tabs">
                <button
                  type="button"
                  className={`ep-data-tab${dataPreviewTab === "cleaned" ? " ep-data-tab--active" : ""}`}
                  onClick={() => setDataPreviewTab("cleaned")}
                >
                  Cleaned Data
                </button>
                <button
                  type="button"
                  className={`ep-data-tab${dataPreviewTab === "descriptive" ? " ep-data-tab--active" : ""}`}
                  onClick={() => setDataPreviewTab("descriptive")}
                >
                  Descriptive Stats
                </button>
                <button
                  type="button"
                  className={`ep-data-tab${dataPreviewTab === "tests" ? " ep-data-tab--active" : ""}`}
                  onClick={() => setDataPreviewTab("tests")}
                >
                  Tests
                </button>
              </div>
            )}
            <div className="ep-data-modal-body">
              <table className="stats-table">
                <thead>
                  <tr>
                    {tabularPreview.columns.map((c) => (
                      <th key={c.name}>
                        <span className="ep-modal-col-name">{c.name}</span>
                        {c.type ? (
                          <span
                            className={`ep-modal-col-type ep-modal-col-type--${c.type}`}
                          >
                            {c.type}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabularPreview.rows.slice(0, 100).map((row, i) => (
                    <tr key={i}>
                      {tabularPreview.columns.map((c) => (
                        <td key={c.name}>{String(row[c.name] ?? "N/A")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {tabularPreview.rows.length > 100 && (
                <p className="ep-data-modal-truncated">
                  Showing first 100 of{" "}
                  {tabularPreview.rows.length.toLocaleString()} rows
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}

interface SaveExportModalProps {
  showSaveProfileModal: boolean;
  setShowSaveProfileModal: (open: boolean) => void;
  savingToProfile: boolean;
  pendingPdfSave: PendingPdfSave | null;
  pendingPdfWarning: string | null;
  canSavePendingPdf: boolean;
  handleSavePdfToProfile: () => void;
}

export function SaveExportModal(props: SaveExportModalProps) {
  const {
    showSaveProfileModal,
    setShowSaveProfileModal,
    savingToProfile,
    pendingPdfSave,
    pendingPdfWarning,
    canSavePendingPdf,
    handleSavePdfToProfile,
  } = props;
  return (
      <Dialog
        open={showSaveProfileModal && !!pendingPdfSave}
        onOpenChange={(open) => {
          if (!savingToProfile) setShowSaveProfileModal(open);
        }}
      >
        <DialogContent
          className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
          hideClose
          onInteractOutside={(e) => {
            if (savingToProfile) e.preventDefault();
          }}
        >
          <div className="ep-data-modal ep-save-modal">
            <div className="ep-data-modal-head">
              <h3>Save Export to Profile?</h3>
              <button
                className="ep-data-modal-close"
                onClick={() => setShowSaveProfileModal(false)}
                disabled={savingToProfile}
              >
                ×
              </button>
            </div>
            <div className="ep-save-modal-body">
              <p className="ep-save-modal-copy">
                Your PDF download has started in the background. Do you want to
                also save this export in your Profile history?
              </p>
              <p className="ep-save-modal-metrics">
                Exports: {pendingPdfSave?.usage?.totalExports ?? 0} /{" "}
                {pendingPdfSave?.usage?.maxSavedExports ?? 0} · Total files:{" "}
                {pendingPdfSave?.usage?.totalSavedFiles ?? 0} /{" "}
                {pendingPdfSave?.usage?.maxSavedFiles ?? 0}
              </p>
              {pendingPdfWarning && (
                <p className="ep-save-modal-warning">{pendingPdfWarning}</p>
              )}
              <div className="ep-save-modal-actions">
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => setShowSaveProfileModal(false)}
                  disabled={savingToProfile}
                >
                  Skip
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleSavePdfToProfile}
                  disabled={savingToProfile || !canSavePendingPdf}
                >
                  {savingToProfile ? "Saving..." : "Save to Profile"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
