import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import {
  createWorkspaceService,
  type WorkspaceSummary,
  WorkspaceNameConflictError,
} from "@/lib/WorkspaceService";
import { EnhancedSidebar } from "@/components/EnhancedSidebar/EnhancedSidebar";
import "./WorkspaceListPage.css";

function formatDate(d: Date | string | number | unknown): string {
  try {
    const date = d instanceof Date ? d : new Date(d as string | number);
    if (isNaN(date.getTime())) return String(d ?? "");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(d ?? "");
  }
}

const STEP_LABELS: Record<string, string> = {
  upload: "Upload",
  preview: "Preview",
  clean: "Process",
  stats: "Analyse",
  export: "Export",
};

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const service = useMemo(
    () => (user ? createWorkspaceService(user.uid) : null),
    [user?.uid],
  );

  const fetchWorkspaces = useCallback(async () => {
    if (!service) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setWorkspaces(await service.listWorkspaces());
    } catch {
      setError("Could not load workspaces.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const location = useLocation();

  useEffect(() => {
    if (authInitialized && !user) {
      sessionStorage.setItem(
        "polymorpha-redirect",
        location.pathname + location.search,
      );
      navigate("/login", { replace: true });
    }
  }, [authInitialized, user, navigate, location.pathname, location.search]);

  // Create — no popup, direct pipeline workspace

  const handleCreate = useCallback(async () => {
    if (!service) return;
    setCreating(true);
    setError(null);
    try {
      const id = await service.createWorkspace({
        workspaceLimit: 3,
        type: "pipeline",
        template: {
          status: "active",
          tags: [],
        },
      });
      navigate(`/workspaces/${id}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not create workspace.";
      console.error("[handleCreate] failed:", err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }, [service, navigate]);

  // Delete

  const handleDelete = useCallback(
    async (ws: WorkspaceSummary) => {
      if (!service) return;
      setDeletingId(ws.workspaceId);
      try {
        await service.deleteWorkspace(ws.workspaceId);
        setWorkspaces((prev) =>
          prev.filter((w) => w.workspaceId !== ws.workspaceId),
        );
      } catch {
        setError("Could not delete workspace.");
      } finally {
        setDeletingId(null);
      }
    },
    [service],
  );

  // Duplicate

  const handleDuplicate = useCallback(
    async (ws: WorkspaceSummary) => {
      if (!service) return;
      try {
        const newId = await service.duplicateWorkspace(ws.workspaceId);
        navigate(`/workspaces/${newId}`);
      } catch {
        setError("Could not duplicate workspace.");
      }
    },
    [service, navigate],
  );

  // Rename

  const startRename = useCallback((ws: WorkspaceSummary) => {
    setRenamingId(ws.workspaceId);
    setRenameValue(ws.name);
    setRenameError(null);
  }, []);

  const submitRename = useCallback(
    async (ws: WorkspaceSummary) => {
      if (!service || !renameValue.trim()) {
        setRenamingId(null);
        setRenameError(null);
        return;
      }
      setRenameError(null);
      try {
        await service.renameWorkspace(ws.workspaceId, renameValue.trim());
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.workspaceId === ws.workspaceId
              ? { ...w, name: renameValue.trim() }
              : w,
          ),
        );
        setRenamingId(null);
      } catch (err) {
        if (err instanceof WorkspaceNameConflictError) {
          setRenameError(err.message);
        } else {
          setError("Could not rename workspace.");
          setRenamingId(null);
        }
      }
    },
    [service, renameValue],
  );

  const handleSelect = useCallback(
    (id: string) => {
      navigate(`/workspaces/${id}`);
      setSidebarOpen(false);
    },
    [navigate],
  );

  // Render

  if (!authInitialized || !user) {
    return (
      <div className="workspace-page-layout">
        <main className="workspace-page-shell">
          <div className="workspace-skeleton-list" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="workspace-skeleton-card" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="workspace-page-layout">
      {/* Mobile toggle */}
      <button
        className="workspace-sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      <div
        className={`workspace-sidebar-wrapper${sidebarOpen ? " workspace-sidebar-wrapper--open" : ""}`}
      >
        <EnhancedSidebar
          workspaces={workspaces}
          activeWorkspaceId={null}
          onSelectWorkspace={handleSelect}
          onRenameWorkspace={startRename}
          onDuplicateWorkspace={handleDuplicate}
          onDeleteWorkspace={handleDelete}
          loading={loading}
        />
      </div>

      <main className="workspace-page-shell">
        <header className="workspace-page-head">
          <h2>Your Workspaces</h2>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating…" : "New workspace"}
          </button>
        </header>

        {error && (
          <div className="workspace-error" role="alert">
            <span>{error}</span>
            <button className="btn-ghost btn-sm" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="workspace-skeleton-list" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="workspace-skeleton-card" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="workspace-empty">
            <p>No workspaces yet.</p>
            <p>Create a workspace to start organizing your analysis.</p>
            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create Workspace"}
            </button>
          </div>
        ) : (
          <ul className="workspace-list">
            {workspaces.map((ws) => (
              <li key={ws.workspaceId} className="workspace-card">
                <div
                  className="workspace-card-body"
                  onClick={() => navigate(`/workspaces/${ws.workspaceId}`)}
                  style={{ cursor: "pointer" }}
                >
                  {renamingId === ws.workspaceId ? (
                    <>
                      <input
                        className="workspace-rename-input"
                        value={renameValue}
                        onChange={(e) => {
                          setRenameValue(e.target.value);
                          setRenameError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(ws);
                          if (e.key === "Escape") {
                            setRenamingId(null);
                            setRenameError(null);
                          }
                        }}
                        onBlur={() => submitRename(ws)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Workspace name"
                        aria-invalid={!!renameError}
                      />
                      {renameError && (
                        <span className="workspace-rename-error" role="alert">
                          {renameError}
                        </span>
                      )}
                    </>
                  ) : (
                    <h3 className="workspace-card-name">{ws.name}</h3>
                  )}
                  <div className="workspace-card-meta">
                    <span className="workspace-meta-step">
                      Step: {STEP_LABELS[ws.step] ?? ws.step}
                    </span>
                    {ws.testsRun > 0 && (
                      <span className="workspace-meta-tests">
                        {ws.testsRun} test{ws.testsRun !== 1 ? "s" : ""} run
                      </span>
                    )}
                    {ws.uploadIds.length > 0 && (
                      <span className="workspace-meta-stat">
                        {ws.uploadIds.length} dataset
                        {ws.uploadIds.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="workspace-card-date">
                    Last modified: {formatDate(ws.updatedAt)}
                  </div>
                </div>
                <div className="workspace-card-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => navigate(`/workspaces/${ws.workspaceId}`)}
                    disabled={deletingId !== null}
                  >
                    Open
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(ws);
                    }}
                    disabled={renamingId !== null || deletingId !== null}
                  >
                    Rename
                  </button>
                  <button
                    className="btn-ghost btn-sm workspace-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ws);
                    }}
                    disabled={deletingId !== null || renamingId !== null}
                  >
                    {deletingId === ws.workspaceId ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
