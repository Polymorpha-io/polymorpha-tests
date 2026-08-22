/**
 * G24: Reuses existing UI primitives (shadcn, lucide) — thin React adapter, no custom widget protocol.
 * NotebookView is a React strip that renders Notebook cells (native model) and delegates .ipynb via nbformat adapter (future).
 */
import { useEffect, useState } from "react";
import type { NotebookCell } from "./types";
import { notebookService } from "./NotebookService";
import { useDataStore } from "@/store/useDataStore";
import { useStellaStore } from "@/stella/store";
import "./NotebookView.css";

export function NotebookView() {
  const workspaceId = useDataStore((s) => s.workspaceId) ?? "guest";
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [loading, setLoading] = useState(true);
  const toggleStella = useStellaStore((s) => s.toggle);
  const setActiveCell = useStellaStore((s) => s.setActiveCell);
  const sendMessage = useStellaStore((s) => s.sendMessage);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    notebookService
      .listCells(workspaceId)
      .then((cs) => {
        if (mounted) setCells(cs);
      })
      .finally(() => mounted && setLoading(false));
    const id = setInterval(() => {
      notebookService
        .listCells(workspaceId)
        .then((cs) => mounted && setCells(cs));
    }, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [workspaceId]);

  const handleExplain = (cell: NotebookCell) => {
    setActiveCell(cell.id);
    toggleStella();
    // Auto-ask Stella to explain this cell (Suggest→Approve is manual, but Explain is direct)
    const prompt = `Explain Cell ${cell.index} — ${cell.metadata.title || cell.type}${cell.provenance.operation ? ` (${cell.provenance.operation})` : ""}${cell.provenance.columns?.length ? ` columns ${cell.provenance.columns.join(", ")}` : ""}. What did this step do and what changed?`;
    // send after Stella opens (next tick)
    setTimeout(() => {
      sendMessage(prompt).catch(() => {});
    }, 300);
  };

  const handleAsk = (cell: NotebookCell) => {
    setActiveCell(cell.id);
    toggleStella();
  };

  if (loading)
    return <div className="notebook-view loading">Loading notebook…</div>;
  if (cells.length === 0)
    return (
      <div className="notebook-view empty">
        No cells yet — start by uploading a dataset.
      </div>
    );

  return (
    <div className="notebook-view">
      <div className="notebook-view-header">
        <div>
          <h3 className="notebook-view-title">
            Notebook — {cells.filter((c) => c.status === "active").length}{" "}
            active cells
          </h3>
          <span className="notebook-view-subtitle">
            {cells.length} total,{" "}
            {cells.filter((c) => c.status === "superseded").length} superseded
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-text"
            onClick={async () => {
              const blob = await notebookService.exportIpynb(workspaceId);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `notebook-${workspaceId}.ipynb`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Export notebook as .ipynb via nbformat adapter (thin)"
          >
            Export .ipynb
          </button>
          <label className="btn-text" style={{ cursor: "pointer" }}>
            Import .ipynb
            <input
              type="file"
              accept=".ipynb,application/json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const ipynb = JSON.parse(text);
                  await notebookService.importIpynb(workspaceId, ipynb);
                  const cs = await notebookService.listCells(workspaceId);
                  setCells(cs);
                } catch {}
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div className="notebook-cells">
        {cells.map((cell) => (
          <div
            key={cell.id}
            className={`notebook-cell notebook-cell--${cell.status} notebook-cell--${cell.type}`}
          >
            <div className="notebook-cell-head">
              <span className="notebook-cell-index">{cell.index}</span>
              <span className="notebook-cell-type">{cell.type}</span>
              <span className="notebook-cell-title">
                {cell.metadata.title || cell.type}
              </span>
              <span className={`notebook-cell-status status-${cell.status}`}>
                {cell.status}
              </span>
            </div>
            {cell.provenance.operation && (
              <div className="notebook-cell-op">
                op: {cell.provenance.operation}
              </div>
            )}
            {cell.provenance.columns && cell.provenance.columns.length > 0 && (
              <div className="notebook-cell-cols">
                cols: {cell.provenance.columns.join(", ")}
              </div>
            )}
            {cell.outputs.length > 0 && (
              <div className="notebook-cell-outputs">
                {cell.outputs.map((o) => (
                  <div
                    key={o.id}
                    className={`notebook-output notebook-output--${o.type}`}
                  >
                    <span className="notebook-output-title">
                      {o.metadata.title || o.type}
                    </span>
                    <span className="notebook-output-meta">
                      {o.metadata.rowCount != null
                        ? `${o.metadata.rowCount} rows`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="notebook-cell-actions">
              <button
                className="btn-text"
                onClick={() => handleExplain(cell)}
                title="Explain this cell with Stella"
              >
                Explain
              </button>
              <button
                className="btn-text"
                onClick={() => handleAsk(cell)}
                title="Ask Stella about this cell"
              >
                Ask Stella
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
