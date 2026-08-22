import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import type { WorkspaceDatasetInfo } from "@/lib/WorkspaceService";
import { Pipeline } from "@/components/Pipeline/Pipeline";
import { ConflictModal } from "@/components/ConflictModal/ConflictModal";
import { EnhancedSidebar } from "@/components/EnhancedSidebar/EnhancedSidebar";
import { DatasetPickerModal } from "./workspace/DatasetPickerModal";
import { WorkspaceHeader } from "./workspace/WorkspaceHeader";
import { WorkspaceSections } from "./workspace/WorkspaceSections";
import { useWorkspaceData } from "./workspace/hooks/useWorkspaceData";
import { useWorkspaceDatasetActions } from "./workspace/hooks/useWorkspaceDatasetActions";
import "./WorkspaceDetailPage.css";

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);

  const [datasets, setDatasets] = useState<WorkspaceDatasetInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);

  const core = useWorkspaceData({
    workspaceId,
    user,
    authInitialized,
    datasets,
    setDatasets,
    setError,
    setShowPipeline,
  });
  const actions = useWorkspaceDatasetActions({
    service: core.service,
    workspaceId,
    user,
    datasets,
    setDatasets,
    setError,
    setShowPipeline,
  });

  const {
    workspace,
    exports,
    workspaceList,
    loading,
    renaming,
    setRenaming,
    renameValue,
    setRenameValue,
    sidebarOpen,
    setSidebarOpen,
    openingFileName,
    loadingDataset,
    pdfFiles,
    listingPdfs,
    viewingPdf,
    setViewingPdf,
    viewingPdfName,
    fetchWorkspace,
    handleOpenPdf,
    startRename,
    submitRename,
    handleDelete,
    handleSelectWorkspace,
    handleRenameFromSidebar,
    handleDuplicateFromSidebar,
    handleDeleteFromSidebar,
    handleOpenDataset,
    loadDataset,
  } = core;

  const {
    showDatasetPicker,
    setShowDatasetPicker,
    uploadingNew,
    uploadProgress,
    conflictState,
    fileInputRef,
    handleAddDataset,
    handleApiSelected,
    handleFileSelected,
    handleConflictRename,
    handleConflictOverwrite,
    handleConflictCancel,
  } = actions;

  // Render

  if (!authInitialized || !user) {
    return (
      <main className="ws-detail-shell">
        <div className="workspace-skeleton-list" aria-busy="true">
          <div className="workspace-skeleton-card" />
        </div>
      </main>
    );
  }

  if (loading && !workspace) {
    return (
      <main className="ws-detail-shell">
        <div className="workspace-skeleton-list" aria-busy="true">
          <div className="workspace-skeleton-card" />
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="ws-detail-shell">
        <div className="workspace-empty">
          <p>{error || "Workspace not found."}</p>
          <button
            className="btn-primary"
            onClick={() => navigate("/workspaces", { replace: true })}
          >
            Back to workspaces
          </button>
        </div>
      </main>
    );
  }

  if (showPipeline) {
    return (
      <Pipeline
        workspaceContext={{
          workspaceId: workspaceId!,
          workspaceName: workspace?.name ?? "",
          onBack: () => setShowPipeline(false),
          datasets,
          exports,
          onLoadDataset: loadDataset,
          onExportGenerated: fetchWorkspace,
        }}
      />
    );
  }
  return (
    <div className="workspace-page-layout">
      {loadingDataset && (
        <div className="loading-overlay" role="alert" aria-busy="true">
          <div className="loading-spinner" />
          <p>
            Opening <strong>{openingFileName}</strong>…
          </p>
        </div>
      )}
      {uploadingNew && (
        <div className="loading-overlay" role="alert" aria-busy="true">
          <div className="loading-spinner" />
          <p>{uploadProgress || "Preparing…"}</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
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
          workspaces={workspaceList}
          activeWorkspaceId={workspaceId ?? null}
          onSelectWorkspace={handleSelectWorkspace}
          onRenameWorkspace={handleRenameFromSidebar}
          onDuplicateWorkspace={handleDuplicateFromSidebar}
          onDeleteWorkspace={handleDeleteFromSidebar}
        />
      </div>

      <main className="ws-detail-shell">
        <WorkspaceHeader
          workspace={workspace}
          renaming={renaming}
          renameValue={renameValue}
          error={error}
          setRenaming={setRenaming}
          setRenameValue={setRenameValue}
          setError={setError}
          startRename={startRename}
          submitRename={submitRename}
          handleDelete={handleDelete}
        />

        <WorkspaceSections
          workspace={workspace}
          datasets={datasets}
          workspaceId={workspaceId!}
          onOpenDataset={handleOpenDataset}
          onAddDataset={() => setShowDatasetPicker(true)}
          pdfFiles={pdfFiles}
          listingPdfs={listingPdfs}
          handleOpenPdf={handleOpenPdf}
        />
      </main>

      {showDatasetPicker && (
        <DatasetPickerModal
          existingUploadIds={datasets.map((d) => d.uploadId)}
          currentWorkspaceId={workspaceId!}
          workspaceList={workspaceList}
          service={core.service}
          onAdd={handleAddDataset}
          onClose={() => setShowDatasetPicker(false)}
          onUploadNew={() => {
            setShowDatasetPicker(false);
            fileInputRef.current?.click();
          }}
          onConnectApi={handleApiSelected}
        />
      )}

      {conflictState && (
        <ConflictModal
          existingName={conflictState.existingName}
          newName={conflictState.newName}
          existingNames={datasets.map((d) => d.fileName)}
          onRename={handleConflictRename}
          onOverwrite={handleConflictOverwrite}
          onCancel={handleConflictCancel}
        />
      )}

      {viewingPdf && (
        <div
          className="modal-overlay"
          onClick={() => {
            setViewingPdf(null);
            URL.revokeObjectURL(viewingPdf);
          }}
        >
          <div
            className="modal-content pdf-viewer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{viewingPdfName}</h3>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  setViewingPdf(null);
                  URL.revokeObjectURL(viewingPdf);
                }}
              >
                ✕
              </button>
            </div>
            <iframe src={viewingPdf} title="PDF Viewer" />
          </div>
        </div>
      )}
    </div>
  );
}
