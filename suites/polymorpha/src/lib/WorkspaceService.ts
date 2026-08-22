/**
 * WorkspaceService — Orchestration layer for workspace CRUD + state persistence.
 *
 * Components call WorkspaceService only — never FirestoreService directly.
 * Coordinates multi-step flows: Firestore ops + Storage ops + dataset parsing.
 * Does NOT write to useDataStore — returns data for the calling page to hydrate.
 *
 * The implementation is split across per-concern modules (WorkspaceCrud,
 * WorkspaceDatasets, WorkspaceExports, WorkspaceNotes, WorkspaceState); this
 * file is the thin facade that owns the class + shared host state.
 */
import { collection } from "firebase/firestore";
import { getFirebaseDb, getFirebaseStorage } from "@/config/firebase";
import { getCacheService } from "./CacheService";
import * as workspaceCrud from "./WorkspaceCrud";
import * as workspaceDatasets from "./WorkspaceDatasets";
import * as workspaceExports from "./WorkspaceExports";
import * as workspaceState from "./WorkspaceState";
import type { WorkspaceState } from "./workspace";
import type {
  CreateWorkspaceParams,
  OpenDatasetResult,
  WorkspaceDatasetInfo,
  WorkspaceEvent,
  WorkspaceEventType,
  WorkspaceExportInfo,
  WorkspaceHost,
  WorkspaceSummary,
  WorkspaceUpdate,
  WorkspaceUploadMeta,
} from "./WorkspaceServiceTypes";

export * from "./WorkspaceServiceTypes";

/**
 * Service class. Per-concern logic lives in the Workspace* modules; methods
 * here delegate with `this` as the host, keeping the public surface identical.
 */
export class WorkspaceService implements WorkspaceHost {
  readonly uid: string;

  constructor(uid: string) {
    this.uid = uid;
  }

  get db() {
    return getFirebaseDb();
  }
  get storage() {
    return getFirebaseStorage();
  }

  workspacesRef() {
    return collection(this.db!, "users", this.uid, "workspaces");
  }

  /** Invalidate all cached data for this user's workspaces (unified CacheService, Plan2) */
  invalidateCache(workspaceId?: string): void {
    const cs = getCacheService();
    cs.invalidateScope(this.uid, "workspaces");
    cs.invalidate(this.uid, "all-datasets");
    if (workspaceId) {
      cs.invalidate(this.uid, "workspace", workspaceId);
      cs.invalidate(this.uid, "datasets", workspaceId);
      cs.invalidate(this.uid, "exports", workspaceId);
    }
  }

  // CRUD

  createWorkspace(params: CreateWorkspaceParams): Promise<string> {
    return workspaceCrud.createWorkspace(this, params);
  }

  listWorkspaces(): Promise<WorkspaceSummary[]> {
    return workspaceCrud.listWorkspaces(this);
  }

  getWorkspace(workspaceId: string): Promise<WorkspaceSummary | null> {
    return workspaceCrud.getWorkspace(this, workspaceId);
  }

  deleteWorkspace(workspaceId: string): Promise<void> {
    return workspaceCrud.deleteWorkspace(this, workspaceId);
  }

  renameWorkspace(
    workspaceId: string,
    name: string,
    oldName?: string,
  ): Promise<void> {
    return workspaceCrud.renameWorkspace(this, workspaceId, name, oldName);
  }

  updateWorkspace(
    workspaceId: string,
    updates: WorkspaceUpdate,
  ): Promise<void> {
    return workspaceCrud.updateWorkspace(this, workspaceId, updates);
  }

  duplicateWorkspace(workspaceId: string): Promise<string> {
    return workspaceCrud.duplicateWorkspace(this, workspaceId);
  }

  // Dataset Operations

  getDatasetsForWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceDatasetInfo[]> {
    return workspaceDatasets.getDatasetsForWorkspace(this, workspaceId);
  }

  getAllDatasetsForUser(): ReturnType<
    typeof workspaceDatasets.getAllDatasetsForUser
  > {
    return workspaceDatasets.getAllDatasetsForUser(this);
  }

  addUploadToWorkspace(
    workspaceId: string,
    uploadId: string,
    fileName?: string,
    sourceWorkspaceName?: string,
  ): Promise<void> {
    return workspaceDatasets.addUploadToWorkspace(
      this,
      workspaceId,
      uploadId,
      fileName,
      sourceWorkspaceName,
    );
  }

  removeUploadFromWorkspace(
    workspaceId: string,
    uploadId: string,
    fileName?: string,
  ): Promise<void> {
    return workspaceDatasets.removeUploadFromWorkspace(
      this,
      workspaceId,
      uploadId,
      fileName,
    );
  }

  getUploadMeta(
    workspaceId: string,
    uploadId: string,
  ): Promise<WorkspaceUploadMeta | null> {
    return workspaceDatasets.getUploadMeta(this, workspaceId, uploadId);
  }

  openDataset(
    workspaceId: string,
    uploadId: string,
  ): Promise<OpenDatasetResult> {
    return workspaceDatasets.openDataset(this, workspaceId, uploadId);
  }

  // Exports

  getExportsForWorkspace(workspaceId: string): Promise<WorkspaceExportInfo[]> {
    return workspaceExports.getExportsForWorkspace(this, workspaceId);
  }

  addExportToWorkspace(
    workspaceId: string,
    exportId: string,
    exportMeta?: { fileName?: string; fileType?: string },
  ): Promise<void> {
    return workspaceExports.addExportToWorkspace(
      this,
      workspaceId,
      exportId,
      exportMeta,
    );
  }

  // State Persistence

  saveState(
    workspaceId: string,
    state: WorkspaceState,
    uploadId?: string,
  ): Promise<void> {
    return workspaceState.saveState(this, workspaceId, state, uploadId);
  }

  loadState(
    workspaceId: string,
    uploadId?: string,
  ): Promise<WorkspaceState | null> {
    return workspaceState.loadState(this, workspaceId, uploadId);
  }

  // Events

  recordEvent(
    workspaceId: string,
    type: WorkspaceEventType,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    return workspaceState.recordEvent(this, workspaceId, type, payload);
  }

  listEvents(
    workspaceId: string,
    opts: { pageSize?: number; afterId?: string } = {},
  ): Promise<WorkspaceEvent[]> {
    return workspaceState.listEvents(this, workspaceId, opts);
  }
}

/** Factory */
export function createWorkspaceService(uid: string): WorkspaceService {
  return new WorkspaceService(uid);
}
