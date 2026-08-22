import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/config/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  WorkspaceDatasetInfo,
  WorkspaceService,
  WorkspaceSummary,
} from "@/lib/WorkspaceService";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { formatDate } from "./formatDate";

type PickerTab = "uploads" | "workspaces" | "api";

export function DatasetPickerModal({
  existingUploadIds,
  currentWorkspaceId,
  workspaceList,
  service,
  onAdd,
  onClose,
  onUploadNew,
  onConnectApi,
}: {
  existingUploadIds: string[];
  currentWorkspaceId: string;
  workspaceList: WorkspaceSummary[];
  service: WorkspaceService | null;
  onAdd: (uploadId: string, sourceWorkspaceName?: string) => void;
  onClose: () => void;
  onUploadNew: () => void;
  onConnectApi: (apiUrl: string, updateMode: "static" | "dynamic") => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<PickerTab>("uploads");
  const [uploads, setUploads] = useState<
    Array<{
      id: string;
      fileName: string;
      rowCount: number;
      columnCount: number;
      uploadedAt: Date | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  // API tab state
  const [apiUrl, setApiUrl] = useState("");
  const [updateMode, setUpdateMode] = useState<"static" | "dynamic">("static");

  // Workspace tab state
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [wsDatasets, setWsDatasets] = useState<WorkspaceDatasetInfo[]>([]);
  const [wsLoading, setWsLoading] = useState(false);

  // Fetch user uploads for "My Uploads" tab
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !user) {
      setLoading(false);
      return;
    }
    getDocs(
      query(
        collection(db, "users", user.uid, "uploads"),
        orderBy("uploadedAt", "desc"),
        fsLimit(20),
      ),
    )
      .then((snap) => {
        setUploads(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fileName: data.fileName ?? "Unknown",
              rowCount: data.rowCount ?? 0,
              columnCount: data.columnCount ?? 0,
              uploadedAt: data.uploadedAt?.toDate?.() ?? null,
            };
          }),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  // Fetch datasets when a workspace is selected in "From Workspaces" tab
  useEffect(() => {
    if (!selectedWsId || !service) return;
    setWsLoading(true);
    service
      .getDatasetsForWorkspace(selectedWsId)
      .then((ds) => setWsDatasets(ds))
      .catch(() => setWsDatasets([]))
      .finally(() => setWsLoading(false));
  }, [selectedWsId, service]);

  const available = uploads.filter((u) => !existingUploadIds.includes(u.id));
  const otherWorkspaces = workspaceList.filter(
    (ws) => ws.workspaceId !== currentWorkspaceId,
  );
  const wsAvailable = wsDatasets.filter(
    (d) => !existingUploadIds.includes(d.uploadId),
  );
  const selectedWsName = selectedWsId
    ? (workspaceList.find((w) => w.workspaceId === selectedWsId)?.name ??
      undefined)
    : undefined;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
        hideClose
      >
        <div className="modal-content picker-modal">
          <div className="modal-header">
            <h3 id="picker-title">Add Dataset to Workspace</h3>
            <button
              className="btn-ghost btn-sm"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tab Bar */}
          <div className="picker-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "uploads"}
              className={`picker-tab${activeTab === "uploads" ? " picker-tab--active" : ""}`}
              onClick={() => setActiveTab("uploads")}
            >
              My Uploads
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "workspaces"}
              className={`picker-tab${activeTab === "workspaces" ? " picker-tab--active" : ""}`}
              onClick={() => {
                setActiveTab("workspaces");
                setSelectedWsId(null);
              }}
            >
              From Workspaces
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "api"}
              className={`picker-tab${activeTab === "api" ? " picker-tab--active" : ""}`}
              onClick={() => setActiveTab("api")}
            >
              API Connection
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "uploads" && (
            <>
              {loading ? (
                <p className="loading-hint">Loading uploads…</p>
              ) : available.length === 0 ? (
                <p className="drop-hint">
                  You have no other recent uploads available.
                </p>
              ) : (
                <div
                  className="ws-dataset-list"
                  style={{ maxHeight: 280, overflow: "auto" }}
                >
                  {available.map((u) => (
                    <div key={u.id} className="ws-dataset-card">
                      <div className="ws-dataset-card-body">
                        <h3 className="ws-dataset-card-name">{u.fileName}</h3>
                        <div className="ws-dataset-card-meta">
                          <span>
                            {u.rowCount.toLocaleString()} rows · {u.columnCount}{" "}
                            columns
                          </span>
                          {u.uploadedAt && (
                            <span>Uploaded {formatDate(u.uploadedAt)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => {
                          setAdding(u.id);
                          onAdd(u.id);
                        }}
                        disabled={adding !== null}
                      >
                        {adding === u.id ? "Adding…" : "Add"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "workspaces" && (
            <>
              {otherWorkspaces.length === 0 ? (
                <p className="drop-hint">You have no other workspaces.</p>
              ) : (
                <div style={{ marginBottom: "1rem" }}>
                  <select
                    className="select"
                    value={selectedWsId ?? ""}
                    onChange={(e) => setSelectedWsId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="" disabled>
                      Select a workspace
                    </option>
                    {otherWorkspaces.map((ws) => (
                      <option key={ws.workspaceId} value={ws.workspaceId}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedWsId && (
                <>
                  {wsLoading ? (
                    <p className="loading-hint">Loading datasets…</p>
                  ) : wsAvailable.length === 0 ? (
                    <p className="drop-hint">
                      No new datasets found in this workspace.
                    </p>
                  ) : (
                    <div
                      className="ws-dataset-list"
                      style={{ maxHeight: 280, overflow: "auto" }}
                    >
                      {wsAvailable.map((d) => (
                        <div key={d.uploadId} className="ws-dataset-card">
                          <div className="ws-dataset-card-body">
                            <h3 className="ws-dataset-card-name">
                              {d.fileName}
                            </h3>
                            <div className="ws-dataset-card-meta">
                              <span>
                                {d.rowCount.toLocaleString()} rows ·{" "}
                                {d.colCount} columns
                              </span>
                              {d.uploadedAt && (
                                <span>Uploaded {formatDate(d.uploadedAt)}</span>
                              )}
                            </div>
                          </div>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => {
                              setAdding(d.uploadId);
                              onAdd(d.uploadId, selectedWsName);
                            }}
                            disabled={adding !== null}
                          >
                            {adding === d.uploadId ? "Adding…" : "Add"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "api" && (
            <div
              className="api-connect-zone"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                padding: "1rem 0",
              }}
            >
              <p className="drop-hint" style={{ margin: 0 }}>
                Connect to a live JSON or CSV API.
              </p>
              <input
                type="url"
                className="input"
                placeholder="https://api.example.com/data.json"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <div
                style={{ display: "flex", gap: "1rem", alignItems: "center" }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="pickerUpdateMode"
                    value="static"
                    checked={updateMode === "static"}
                    onChange={() => setUpdateMode("static")}
                  />
                  Static Snapshot
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="pickerUpdateMode"
                    value="dynamic"
                    checked={updateMode === "dynamic"}
                    onChange={() => setUpdateMode("dynamic")}
                  />
                  Dynamic (Auto-sync)
                </label>
              </div>
              <button
                className="btn-primary"
                disabled={!apiUrl}
                onClick={() => onConnectApi(apiUrl, updateMode)}
              >
                Connect API
              </button>
            </div>
          )}

          <div
            className="modal-footer"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "1rem",
              marginTop: "1rem",
            }}
          >
            <button className="btn-ghost" onClick={onUploadNew}>
              Upload New File Instead
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
