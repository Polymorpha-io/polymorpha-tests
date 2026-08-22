/**
 * EnhancedSidebar — Hierarchical workspace navigation with:
 * - Favorites section (localStorage-backed)
 * - All Workspaces section (active + draft, sorted by updatedAt)
 * - Archived section (collapsed by default)
 * - Search/filter
 * - Star toggle for favorites
 * - Drag-to-reorder in favorites section
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSummary } from "@/lib/WorkspaceService";
import "./EnhancedSidebar.css";

// Favorites helpers

const FAVORITES_KEY = "polymorpha_favorites";

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

// Props

interface EnhancedSidebarProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onRenameWorkspace?: (workspace: WorkspaceSummary) => void;
  onDuplicateWorkspace?: (workspace: WorkspaceSummary) => void;
  onDeleteWorkspace?: (workspace: WorkspaceSummary) => void;
  loading?: boolean;
}

// Component

export function EnhancedSidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  loading = false,
}: EnhancedSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workspaceId: string;
  } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // Persist favorites
  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  // Filtering

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase();
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q));
  }, [workspaces, searchQuery]);

  // Grouping

  const favorited = useMemo(
    () => filtered.filter((ws) => favorites.includes(ws.workspaceId)),
    [filtered, favorites],
  );

  const active = useMemo(
    () =>
      filtered.filter(
        (ws) => ws.status !== "archived" && !favorites.includes(ws.workspaceId),
      ),
    [filtered, favorites],
  );

  const archived = useMemo(
    () =>
      filtered.filter(
        (ws) => ws.status === "archived" && !favorites.includes(ws.workspaceId),
      ),
    [filtered, favorites],
  );

  // Favorites actions

  const toggleFavorite = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;
    setFavorites((prev) => {
      const fromIdx = prev.indexOf(draggedId);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedId);
      return next;
    });
  }, []);

  // Context menu

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, workspaceId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, workspaceId });
    },
    [],
  );

  const contextWorkspace = useMemo(
    () => workspaces.find((w) => w.workspaceId === contextMenu?.workspaceId),
    [workspaces, contextMenu],
  );

  // Render item

  const renderItem = (ws: WorkspaceSummary, isFavorite = false) => {
    const isActive = ws.workspaceId === activeWorkspaceId;
    const isFav = favorites.includes(ws.workspaceId);
    const statusDot =
      ws.status === "active" ? "🟢" : ws.status === "draft" ? "🟡" : "⚪";
    const isDragTarget = dragOverId === ws.workspaceId;

    return (
      <li
        key={ws.workspaceId}
        className={`enh-sidebar-item${isActive ? " enh-sidebar-item--active" : ""}${isDragTarget ? " enh-sidebar-item--drag-over" : ""}`}
        draggable={isFavorite}
        onDragStart={
          isFavorite ? (e) => handleDragStart(e, ws.workspaceId) : undefined
        }
        onDragOver={
          isFavorite ? (e) => handleDragOver(e, ws.workspaceId) : undefined
        }
        onDragLeave={isFavorite ? handleDragLeave : undefined}
        onDrop={isFavorite ? (e) => handleDrop(e, ws.workspaceId) : undefined}
        onContextMenu={(e) => handleContextMenu(e, ws.workspaceId)}
      >
        <button
          className="enh-sidebar-item-btn"
          onClick={() => onSelectWorkspace(ws.workspaceId)}
          title={ws.name}
        >
          {isFavorite && (
            <span className="enh-sidebar-drag-handle" aria-hidden="true">
              ⋮⋮
            </span>
          )}
          <span className="enh-sidebar-item-name">{ws.name}</span>
          <span className="enh-sidebar-status-dot" title={ws.status}>
            {statusDot}
          </span>
          {ws.uploadIds.length > 0 && (
            <span className="enh-sidebar-item-badge">
              {ws.uploadIds.length}
            </span>
          )}
        </button>
        <button
          className={`enh-sidebar-star${isFav ? " enh-sidebar-star--active" : ""}`}
          onClick={(e) => toggleFavorite(ws.workspaceId, e)}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          {isFav ? "⭐" : "☆"}
        </button>
      </li>
    );
  };

  // Loading state

  if (loading) {
    return (
      <aside
        className="enh-sidebar"
        aria-label="Workspaces"
        aria-busy="true"
        ref={sidebarRef}
      >
        <div className="enh-sidebar-search">
          <div className="enh-sidebar-search-skeleton" />
        </div>
        <div className="enh-sidebar-skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="enh-sidebar-skeleton-item" />
          ))}
        </div>
      </aside>
    );
  }

  // Empty state

  if (workspaces.length === 0) {
    return (
      <aside
        className="enh-sidebar"
        aria-label="Workspaces"
        ref={sidebarRef}
      ></aside>
    );
  }

  // Normal render

  return (
    <aside className="enh-sidebar" aria-label="Workspaces" ref={sidebarRef}>
      {/* Search */}
      <div className="enh-sidebar-search">
        <svg
          className="enh-sidebar-search-icon"
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
          className="enh-sidebar-search-input"
          type="search"
          placeholder="Filter workspaces…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter workspaces"
        />
      </div>

      <nav className="enh-sidebar-nav">
        {/* Favorites section */}
        {favorited.length > 0 && (
          <div className="enh-sidebar-section">
            <div className="enh-sidebar-section-header">
              <span className="enh-sidebar-section-label">⭐ Favorites</span>
              <span className="enh-sidebar-section-count">
                {favorited.length}
              </span>
            </div>
            <ul className="enh-sidebar-list">
              {favorited.map((ws) => renderItem(ws, true))}
            </ul>
          </div>
        )}

        {/* All Workspaces */}
        <div className="enh-sidebar-section">
          <div className="enh-sidebar-section-header">
            <span className="enh-sidebar-section-label">📁 All Workspaces</span>
            <span className="enh-sidebar-section-count">{active.length}</span>
          </div>
          {active.length === 0 && searchQuery.trim() ? (
            <p className="enh-sidebar-empty-text">No results</p>
          ) : (
            <ul className="enh-sidebar-list">
              {active.map((ws) => renderItem(ws))}
            </ul>
          )}
        </div>

        {/* Archived */}
        {archived.length > 0 && (
          <div className="enh-sidebar-section">
            <button
              className="enh-sidebar-section-header enh-sidebar-section-toggle"
              onClick={() => setArchivedExpanded((v) => !v)}
            >
              <span className="enh-sidebar-section-label">📦 Archived</span>
              <span className="enh-sidebar-section-count">
                {archived.length}
              </span>
              <span
                className={`enh-sidebar-chevron${archivedExpanded ? " enh-sidebar-chevron--open" : ""}`}
              >
                ▸
              </span>
            </button>
            {archivedExpanded && (
              <ul className="enh-sidebar-list enh-sidebar-list--archived">
                {archived.map((ws) => renderItem(ws))}
              </ul>
            )}
          </div>
        )}
      </nav>

      {/* Context Menu */}
      {contextMenu && contextWorkspace && (
        <div
          className="enh-sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="enh-context-item"
            onClick={() => {
              onSelectWorkspace(contextMenu.workspaceId);
              setContextMenu(null);
            }}
          >
            📂 Open
          </button>
          <button
            className="enh-context-item"
            onClick={() => {
              toggleFavorite(contextMenu.workspaceId);
              setContextMenu(null);
            }}
          >
            {favorites.includes(contextMenu.workspaceId)
              ? "⭐ Unfavorite"
              : "☆ Favorite"}
          </button>
          <button
            className="enh-context-item"
            onClick={() => {
              onRenameWorkspace?.(contextWorkspace);
              setContextMenu(null);
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="enh-context-item"
            onClick={() => {
              onDuplicateWorkspace?.(contextWorkspace);
              setContextMenu(null);
            }}
          >
            📋 Duplicate
          </button>
          <div className="enh-context-divider" />
          <button
            className="enh-context-item enh-context-item--danger"
            onClick={() => {
              onDeleteWorkspace?.(contextWorkspace);
              setContextMenu(null);
            }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </aside>
  );
}
