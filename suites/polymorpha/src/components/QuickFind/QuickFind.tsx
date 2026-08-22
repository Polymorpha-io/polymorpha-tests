/**
 * QuickFind — Ctrl+K command palette for workspaces, datasets, and exports.
 * Opens in < 100ms. Client-side only — no server calls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSummary } from "@/lib/WorkspaceService";
import "./QuickFind.css";

interface QuickFindProps {
  open: boolean;
  onClose: () => void;
  workspaces: WorkspaceSummary[];
  onSelectWorkspace: (id: string) => void;
}

interface SearchResult {
  id: string;
  type: "workspace" | "dataset" | "export";
  title: string;
  subtitle: string;
  workspaceId: string;
}

export function QuickFind({
  open,
  onClose,
  workspaces,
  onSelectWorkspace,
}: QuickFindProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build search index from workspaces
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      // Show most recent workspaces (top 5)
      return workspaces.slice(0, 5).map((ws) => ({
        id: ws.workspaceId,
        type: "workspace" as const,
        title: ws.name,
        subtitle: `${ws.uploadIds.length} dataset${ws.uploadIds.length !== 1 ? "s" : ""} · ${ws.exportIds.length} export${ws.exportIds.length !== 1 ? "s" : ""}`,
        workspaceId: ws.workspaceId,
      }));
    }

    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // Match workspaces by name
    for (const ws of workspaces) {
      if (ws.name.toLowerCase().includes(q)) {
        items.push({
          id: ws.workspaceId,
          type: "workspace",
          title: ws.name,
          subtitle: `${ws.status}`,
          workspaceId: ws.workspaceId,
        });
      }
    }

    return items.slice(0, 10);
  }, [query, workspaces]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onClose();
      onSelectWorkspace(result.workspaceId);
    },
    [onClose, onSelectWorkspace],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    },
    [onClose, results, selectedIndex, handleSelect],
  );

  if (!open) return null;

  return (
    <div className="quickfind-overlay" onClick={onClose}>
      <div
        className="quickfind-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Find"
      >
        <div className="quickfind-search-row">
          <svg
            className="quickfind-search-icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <line x1="10" y1="10" x2="14" y2="14" />
          </svg>
          <input
            ref={inputRef}
            className="quickfind-input"
            type="text"
            placeholder="Search workspaces…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search workspaces"
          />
        </div>

        <div className="quickfind-results">
          {results.length === 0 ? (
            <div className="quickfind-empty">
              {query.trim()
                ? "No workspaces found."
                : "Start typing to search…"}
            </div>
          ) : (
            <div className="quickfind-list">
              <div className="quickfind-section-label">Workspaces</div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  className={`quickfind-item${index === selectedIndex ? " quickfind-item--selected" : ""}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="quickfind-item-type">
                    {result.type === "workspace"
                      ? "📁"
                      : result.type === "dataset"
                        ? "📊"
                        : "📎"}
                  </span>
                  <span className="quickfind-item-title">{result.title}</span>
                  <span className="quickfind-item-subtitle">
                    {result.subtitle}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="quickfind-footer">
          <span>
            <kbd>↑↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
