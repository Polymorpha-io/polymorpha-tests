import { useState } from "react";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";

interface ConflictModalProps {
  existingName: string;
  newName: string;
  onRename: (newDisplayName: string) => void;
  onOverwrite: () => void;
  onCancel: () => void;
  /** All current dataset filenames in the workspace (for duplicate-check on rename) */
  existingNames: string[];
}

export function ConflictModal({
  existingName,
  newName,
  onRename,
  onOverwrite,
  onCancel,
  existingNames,
}: ConflictModalProps) {
  const [renameValue, setRenameValue] = useState(newName);
  const [renameError, setRenameError] = useState("");

  const validateAndRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Name cannot be empty.");
      return;
    }
    // Check against all existing names (case-insensitive)
    const isDuplicate = existingNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) {
      setRenameError("A dataset with this name already exists.");
      return;
    }
    onRename(trimmed);
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none sm:rounded-none max-w-none flex items-center justify-center"
        hideClose
      >
        <div className="conflict-panel">
          {/* Header */}
          <div className="conflict-header">
            <div className="conflict-icon" aria-hidden="true">
              <svg
                viewBox="0 0 20 20"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 7a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
              </svg>
            </div>
            <div>
              <h3 id="conflict-title">Duplicate dataset name</h3>
              <p>
                A dataset named{" "}
                <span className="conflict-filename">
                  &ldquo;{existingName}&rdquo;
                </span>{" "}
                already exists in this workspace.
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="conflict-options">
            {/* Rename */}
            <div className="conflict-option">
              <p className="conflict-option-label">Rename</p>
              <p className="conflict-option-desc">
                Add with a different display name.
              </p>
              <div className="conflict-rename-row">
                <input
                  type="text"
                  className={`conflict-rename-input${renameError ? " conflict-rename-input--error" : ""}`}
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") validateAndRename();
                  }}
                  placeholder="Enter new name…"
                  aria-label="New dataset name"
                  autoFocus
                />
                <button
                  type="button"
                  className="conflict-btn conflict-btn--rename"
                  onClick={validateAndRename}
                  disabled={!renameValue.trim()}
                >
                  Add
                </button>
              </div>
              {renameError && (
                <p className="conflict-rename-error">{renameError}</p>
              )}
            </div>

            {/* Overwrite */}
            <div className="conflict-option">
              <p className="conflict-option-label">Overwrite</p>
              <p className="conflict-option-desc">
                Remove the existing dataset and replace it with this one.
              </p>
              <button
                type="button"
                className="conflict-btn conflict-btn--overwrite"
                onClick={onOverwrite}
              >
                Replace existing
              </button>
            </div>
          </div>

          {/* Cancel */}
          <div className="conflict-footer">
            <button
              type="button"
              className="conflict-btn conflict-btn--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
