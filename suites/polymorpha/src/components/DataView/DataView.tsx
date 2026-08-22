/**
 * DataView — Table and Gallery views for workspace datasets.
 */
import { useState } from "react";
import type { WorkspaceDatasetInfo } from "@/lib/WorkspaceService";
import "./DataView.css";

function fmtDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ViewMode = "table" | "gallery";

interface DataViewProps {
  datasets: WorkspaceDatasetInfo[];
  onOpen: (uploadId: string) => void;
}

export function DataView({ datasets, onOpen }: DataViewProps) {
  const [view, setView] = useState<ViewMode>("table");
  const [sortKey, setSortKey] =
    useState<keyof WorkspaceDatasetInfo>("uploadedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = [...(datasets ?? [])].sort((a, b) => {
    const va = a[sortKey],
      vb = b[sortKey];
    if (va instanceof Date && vb instanceof Date)
      return sortDir === "desc"
        ? vb.getTime() - va.getTime()
        : va.getTime() - vb.getTime();
    if (typeof va === "number" && typeof vb === "number")
      return sortDir === "desc" ? vb - va : va - vb;
    return sortDir === "desc"
      ? String(vb).localeCompare(String(va))
      : String(va).localeCompare(String(vb));
  });

  const toggleSort = (key: keyof WorkspaceDatasetInfo) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortIcon = (key: keyof WorkspaceDatasetInfo) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="dv-container">
      <div className="dv-toolbar">
        <div className="dv-view-switcher">
          <button
            className={`dv-view-btn${view === "table" ? " dv-view-active" : ""}`}
            onClick={() => setView("table")}
          >
            📋 Table
          </button>
          <button
            className={`dv-view-btn${view === "gallery" ? " dv-view-active" : ""}`}
            onClick={() => setView("gallery")}
          >
            🖼️ Gallery
          </button>
        </div>
        {selected.size > 0 && (
          <div className="dv-selection-bar">
            {selected.size} selected
            <button
              className="btn-ghost btn-sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {view === "table" ? (
        <div className="dv-table-wrap">
          <table className="dv-table">
            <thead>
              <tr>
                <th className="dv-th-check">
                  <input
                    type="checkbox"
                    onChange={() =>
                      setSelected(
                        selected.size === datasets.length
                          ? new Set()
                          : new Set(datasets.map((d) => d.uploadId)),
                      )
                    }
                    checked={
                      selected.size === datasets.length && datasets.length > 0
                    }
                  />
                </th>
                <th
                  className="dv-th-name"
                  onClick={() => toggleSort("fileName")}
                >
                  Name{sortIcon("fileName")}
                </th>
                <th onClick={() => toggleSort("rowCount")}>
                  Rows{sortIcon("rowCount")}
                </th>
                <th onClick={() => toggleSort("colCount")}>
                  Cols{sortIcon("colCount")}
                </th>
                <th onClick={() => toggleSort("uploadedAt")}>
                  Uploaded{sortIcon("uploadedAt")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ds) => (
                <tr
                  key={ds.uploadId}
                  className={selected.has(ds.uploadId) ? "dv-row-selected" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(ds.uploadId)}
                      onChange={() => toggleSelect(ds.uploadId)}
                    />
                  </td>
                  <td className="dv-td-name">
                    📄 {ds.fileName}
                    {ds.sourceWorkspaceName && (
                      <div className="dv-source-workspace">
                        from {ds.sourceWorkspaceName}
                      </div>
                    )}
                  </td>
                  <td>{ds.rowCount.toLocaleString()}</td>
                  <td>{ds.colCount}</td>
                  <td>
                    {ds.uploadedAt instanceof Date
                      ? ds.uploadedAt.toLocaleDateString()
                      : fmtDate(ds.uploadedAt)}
                  </td>
                  <td className="dv-td-actions">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => onOpen(ds.uploadId)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dv-gallery">
          {sorted.map((ds) => (
            <div
              key={ds.uploadId}
              className="dv-gallery-card"
              onClick={() => onOpen(ds.uploadId)}
            >
              <div className="dv-gallery-icon">📊</div>
              <h4 className="dv-gallery-name">{ds.fileName}</h4>
              {ds.sourceWorkspaceName && (
                <div className="dv-source-workspace">
                  from {ds.sourceWorkspaceName}
                </div>
              )}
              <div className="dv-gallery-meta">
                {ds.rowCount.toLocaleString()} rows · {ds.colCount} columns
              </div>
              <div className="dv-gallery-date">
                {ds.uploadedAt instanceof Date
                  ? ds.uploadedAt.toLocaleDateString()
                  : fmtDate(ds.uploadedAt)}
              </div>
              <button className="btn-primary btn-sm dv-gallery-btn">
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
