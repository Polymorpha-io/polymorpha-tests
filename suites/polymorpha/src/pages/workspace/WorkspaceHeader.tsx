import type { WorkspaceSummary } from "@/lib/WorkspaceService";
import { formatDate } from "./formatDate";

export interface WorkspaceHeaderProps {
  workspace: WorkspaceSummary;
  renaming: boolean;
  renameValue: string;
  error: string | null;
  setRenaming: (open: boolean) => void;
  setRenameValue: (value: string) => void;
  setError: (message: string | null) => void;
  startRename: () => void;
  submitRename: () => void;
  handleDelete: () => void;
}

export function WorkspaceHeader({
  workspace,
  renaming,
  renameValue,
  error,
  setRenaming,
  setRenameValue,
  setError,
  startRename,
  submitRename,
  handleDelete,
}: WorkspaceHeaderProps) {
  return (
    <>
      <header className="ws-detail-header">
        <div className="ws-detail-header-actions">
          <button className="btn-ghost btn-sm" onClick={startRename}>
            Rename
          </button>
          <button
            className="btn-ghost btn-sm workspace-delete-btn"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </header>

      {error && (
        <div className="workspace-error" role="alert">
          <span>{error}</span>
          <button className="btn-ghost btn-sm" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="ws-detail-title-section">
        <div className="ws-detail-icon-row">
          <div>
            {renaming ? (
              <input
                className="workspace-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                onBlur={submitRename}
                autoFocus
                aria-label="Workspace name"
              />
            ) : (
              <h1
                className="ws-detail-title"
                onClick={startRename}
                title="Click to rename"
              >
                {workspace.name}
              </h1>
            )}
            {/* Status Badge */}
            <span
              className={`ws-status-badge ws-status-${workspace.status}`}
              title={workspace.status}
            >
              {workspace.status === "active"
                ? "🟢 Active"
                : workspace.status === "draft"
                  ? "🟡 Draft"
                  : "⚪ Archived"}
            </span>
          </div>
        </div>
        <p className="ws-detail-meta">
          Created {formatDate(workspace.createdAt)}
          {workspace.updatedAt !== workspace.createdAt
            ? ` · Updated ${formatDate(workspace.updatedAt)}`
            : ""}
        </p>
      </div>
    </>
  );
}
