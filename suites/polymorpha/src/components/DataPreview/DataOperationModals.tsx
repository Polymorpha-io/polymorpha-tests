import { useState } from "react";
import type { Column, DataOperationStep } from "@/types";
import type { PipelineProps } from "@/components/Pipeline/Pipeline";

export interface DataOperationModalsProps {
  activeOperation: "group" | "merge" | "append" | "pivot" | "unpivot" | null;
  onClose: () => void;
  orderedColumns: Column[];
  fileName: string;
  workspaceContext?: PipelineProps["workspaceContext"];
  addAppliedStep: (step: DataOperationStep) => void;
}

export function DataOperationModals({
  activeOperation,
  onClose,
  orderedColumns,
  fileName,
  workspaceContext,
  addAppliedStep,
}: DataOperationModalsProps) {
  const [dataSourceType, setDataSourceType] = useState<
    "workspace" | "local" | "api"
  >("workspace");

  return (
    <>
      {activeOperation === "group" && (
        <div className="modal-overlay" role="dialog" aria-label="Group By">
          <div className="modal-content modal-content--wide">
            <h3>Group By</h3>
            <p
              style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}
            >
              Select columns to group by and define multiple aggregations (e.g.
              Sum of Sales).
            </p>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Group by column:</label>
              <select className="form-select">
                {orderedColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">New column name:</label>
              <input type="text" className="form-input" placeholder="Count" />
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Operation:</label>
                <select className="form-select">
                  <option value="count">Count Rows</option>
                  <option value="sum">Sum</option>
                  <option value="average">Average</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Column:</label>
                <select className="form-select">
                  {orderedColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  addAppliedStep({
                    id: crypto.randomUUID(),
                    description: "Grouped Rows",
                    config: {
                      type: "group",
                      groupByCols: [],
                      aggregations: [],
                    },
                  });
                  onClose();
                }}
              >
                Apply (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
      {activeOperation === "merge" && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-label="Merge Datasets"
        >
          <div className="modal-content modal-content--wide">
            <h3>Merge Datasets</h3>
            <p
              style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}
            >
              Join another dataset in your workspace side-by-side using matching
              keys.
            </p>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "8px",
                  marginBottom: "12px",
                }}
              >
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "workspace"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("workspace")}
                >
                  Workspace Data
                </button>
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "local"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("local")}
                >
                  Local File
                </button>
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "api"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("api")}
                >
                  API URL
                </button>
              </div>

              {dataSourceType === "workspace" && (
                <>
                  <label className="form-label">
                    Select Workspace Dataset:
                  </label>
                  <select className="form-select">
                    <option value="">-- Select dataset --</option>
                    <optgroup label="Current Workspace">
                      {workspaceContext?.datasets
                        .filter((d) => d.fileName !== fileName)
                        .map((d) => (
                          <option key={d.uploadId} value={d.uploadId}>
                            {d.fileName}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Other Workspaces">
                      <option value="mock-1">
                        sales_data_2025.csv (Marketing WS)
                      </option>
                      <option value="mock-2">
                        users_export.xlsx (Admin WS)
                      </option>
                    </optgroup>
                  </select>
                </>
              )}

              {dataSourceType === "local" && (
                <>
                  <label className="form-label">
                    Upload CSV or Excel file:
                  </label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    className="form-input"
                    style={{ padding: "4px" }}
                  />
                </>
              )}

              {dataSourceType === "api" && (
                <>
                  <label className="form-label">API URL (CSV or JSON):</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://api.example.com/data.csv"
                  />
                </>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Join Kind:</label>
              <select className="form-select">
                <option value="left">
                  Left Outer (all from first, matching from second)
                </option>
                <option value="right">
                  Right Outer (all from second, matching from first)
                </option>
                <option value="inner">Inner (only matching rows)</option>
                <option value="full">Full Outer (all rows from both)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Matching column (Current):</label>
                <select className="form-select">
                  <option value="">-- Select --</option>
                  {orderedColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Matching column (Other):</label>
                <select className="form-select">
                  <option value="">-- Select --</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "16px" }}>
              <label
                className="form-label"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input type="checkbox" defaultChecked />
                <span>Expand rows (may duplicate records)</span>
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  addAppliedStep({
                    id: crypto.randomUUID(),
                    description: "Merged Dataset",
                    config: {
                      type: "merge",
                      source: { type: "workspace" },
                      joinType: "left",
                      leftKey: "",
                      rightKey: "",
                      behavior: "expand",
                    },
                  });
                  onClose();
                }}
              >
                Apply (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
      {activeOperation === "append" && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-label="Append Datasets"
        >
          <div className="modal-content modal-content--wide">
            <h3>Append Datasets</h3>
            <p
              style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}
            >
              Stack another dataset vertically on top of this one.
            </p>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "8px",
                  marginBottom: "12px",
                }}
              >
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "workspace"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("workspace")}
                >
                  Workspace Data
                </button>
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "local"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("local")}
                >
                  Local File
                </button>
                <button
                  className="btn-ghost btn-sm"
                  style={
                    dataSourceType === "api"
                      ? {
                          background: "var(--muted)",
                          color: "var(--foreground)",
                        }
                      : {}
                  }
                  onClick={() => setDataSourceType("api")}
                >
                  API URL
                </button>
              </div>

              {dataSourceType === "workspace" && (
                <>
                  <label className="form-label">
                    Select Workspace Dataset:
                  </label>
                  <select className="form-select">
                    <option value="">-- Select dataset --</option>
                    <optgroup label="Current Workspace">
                      {workspaceContext?.datasets
                        .filter((d) => d.fileName !== fileName)
                        .map((d) => (
                          <option key={d.uploadId} value={d.uploadId}>
                            {d.fileName}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Other Workspaces">
                      <option value="mock-1">
                        sales_data_2025.csv (Marketing WS)
                      </option>
                      <option value="mock-2">
                        users_export.xlsx (Admin WS)
                      </option>
                    </optgroup>
                  </select>
                </>
              )}

              {dataSourceType === "local" && (
                <>
                  <label className="form-label">
                    Upload CSV or Excel file:
                  </label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    className="form-input"
                    style={{ padding: "4px" }}
                  />
                </>
              )}

              {dataSourceType === "api" && (
                <>
                  <label className="form-label">API URL (CSV or JSON):</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://api.example.com/data.csv"
                  />
                </>
              )}
            </div>
            <div
              className="preview-clean-banner"
              style={{ marginTop: "16px", borderRadius: "var(--radius-sm)" }}
            >
              Appending will stack the selected dataset below the current one,
              matching columns by name.
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  addAppliedStep({
                    id: crypto.randomUUID(),
                    description: "Appended Dataset",
                    config: { type: "append", source: { type: "workspace" } },
                  });
                  onClose();
                }}
              >
                Apply (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
      {activeOperation === "pivot" && (
        <div className="modal-overlay" role="dialog" aria-label="Pivot Data">
          <div className="modal-content">
            <h3>Pivot Data</h3>
            <p
              style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}
            >
              Convert unique values from a column into multiple columns.
            </p>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Index Column (keep as rows):</label>
              <select className="form-select">
                {orderedColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">
                Column to Pivot (becomes new headers):
              </label>
              <select className="form-select">
                {orderedColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Values Column:</label>
              <select className="form-select">
                {orderedColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Aggregation Function:</label>
              <select className="form-select">
                <option value="sum">Sum</option>
                <option value="average">Average</option>
                <option value="count">Count</option>
                <option value="min">Minimum</option>
                <option value="max">Maximum</option>
              </select>
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  addAppliedStep({
                    id: crypto.randomUUID(),
                    description: "Pivoted Column",
                    config: {
                      type: "pivot",
                      indexColumn: "",
                      columnsToPivot: "",
                      valuesColumn: "",
                      aggregation: "sum",
                    },
                  });
                  onClose();
                }}
              >
                Apply (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
      {activeOperation === "unpivot" && (
        <div className="modal-overlay" role="dialog" aria-label="Unpivot Data">
          <div className="modal-content">
            <h3>Unpivot Data</h3>
            <p
              style={{ color: "var(--muted-foreground)", marginBottom: "16px" }}
            >
              Flatten multiple columns into a single Variable-Value pair.
            </p>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Columns to Unpivot:</label>
              <select
                className="form-select"
                multiple
                style={{ height: "100px" }}
              >
                {orderedColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span
                className="form-hint"
                style={{ fontSize: "11px", color: "var(--muted-foreground)" }}
              >
                Hold Ctrl/Cmd to select multiple
              </span>
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Variable Column Name:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Variable"
                defaultValue="Variable"
              />
            </div>
            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label">Value Column Name:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Value"
                defaultValue="Value"
              />
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button className="btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  addAppliedStep({
                    id: crypto.randomUUID(),
                    description: "Unpivoted Columns",
                    config: {
                      type: "unpivot",
                      columnsToUnpivot: [],
                      variableColumnName: "Variable",
                      valueColumnName: "Value",
                    },
                  });
                  onClose();
                }}
              >
                Apply (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
