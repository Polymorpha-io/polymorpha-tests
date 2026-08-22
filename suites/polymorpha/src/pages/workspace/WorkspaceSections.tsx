import type { WorkspaceSummary } from "@/lib/WorkspaceService";
import type { WorkspaceDatasetInfo } from "@/lib/WorkspaceService";
import { DataView } from "@/components/DataView/DataView";

export interface WorkspaceSectionsProps {
  workspace: WorkspaceSummary;
  datasets: WorkspaceDatasetInfo[];
  workspaceId: string;
  onOpenDataset: (uploadId: string) => void;
  onAddDataset: () => void;
  pdfFiles: { name: string; url: string }[];
  listingPdfs: boolean;
  handleOpenPdf: (file: { name: string; url: string }) => void;
}

export function WorkspaceSections({
  workspace,
  datasets,
  onOpenDataset,
  onAddDataset,
  pdfFiles,
  listingPdfs,
  handleOpenPdf,
}: WorkspaceSectionsProps) {
  return (
    <>
      {/* Existing sections: Datasets, Pipeline, Exports, Notes */}
      <section className="ws-section">
        <div className="ws-section-header">
          <h2>Datasets ({datasets.length})</h2>
          <button className="btn-primary btn-sm" onClick={onAddDataset}>
            + Add Dataset
          </button>
        </div>
        {datasets.length === 0 ? (
          <div className="ws-empty-section ws-empty-illustrated">
            <div className="ws-empty-illustration">📤</div>
            <h3>No datasets yet</h3>
            <p>Upload your first CSV or Excel file to start analysing.</p>
            <button
              className="btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={onAddDataset}
            >
              Upload Dataset
            </button>
          </div>
        ) : (
          <DataView datasets={datasets} onOpen={onOpenDataset} />
        )}
      </section>

      <section className="ws-section">
        <div className="ws-section-header">
          <h2>Pipeline</h2>
        </div>
        <p className="ws-detail-meta">
          Step: {workspace.step} · {workspace.testsRun} tests run
        </p>
      </section>

      <section className="ws-section">
        <div className="ws-section-header">
          <h2>Export PDFs</h2>
        </div>
        {pdfFiles.length === 0 && !listingPdfs ? (
          <div className="ws-empty-section ws-empty-illustrated">
            <div className="ws-empty-illustration">📎</div>
            <h3>No PDFs found</h3>
            <p>Generate a report and save it to see it here.</p>
          </div>
        ) : listingPdfs ? (
          <div className="ws-empty-section ws-empty-illustrated">
            <div className="ws-empty-illustration">📎</div>
            <h3>Scanning...</h3>
            <p>Looking for saved exports...</p>
          </div>
        ) : (
          <div className="ws-dataset-list">
            {pdfFiles.map((f, i) => (
              <div key={i} className="ws-dataset-card">
                <div className="ws-dataset-card-body">
                  <h3 className="ws-dataset-card-name">{f.name}</h3>
                </div>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => handleOpenPdf(f)}
                >
                  View PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </section>


    </>
  );
}
