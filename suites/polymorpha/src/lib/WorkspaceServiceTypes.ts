/**
 * Shared types + host contract for the WorkspaceService decomposition.
 * WorkspaceService.ts composes the per-concern modules below this layer.
 */
import type { CollectionReference, Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { ParsedDataset, WorkspaceState } from "./workspace";

// Utility

/** Safely convert a Firestore Timestamp, Date, string, or number to a valid Date. */
export function safeDate(ts: unknown): Date {
  if (
    ts != null &&
    typeof (ts as Record<string, unknown>).toDate === "function"
  ) {
    const d = (ts as { toDate: () => Date }).toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
  if (typeof ts === "string" || typeof ts === "number") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

// Event Types

export type WorkspaceEventType =
  | "workspace.created"
  | "workspace.renamed"
  | "workspace.status_changed"
  | "workspace.duplicated"
  | "dataset.added"
  | "dataset.removed"
  | "export.generated"
  | "export.downloaded"
  | "pipeline.step_changed"
  | "pipeline.tests_run"
  | "pipeline.cleaning_applied";

export interface WorkspaceEvent {
  id: string;
  workspaceId: string;
  type: WorkspaceEventType;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export const MAX_EVENTS = 500;
export const PRUNE_BATCH = 100;

// Types

export type WorkspaceType = "pipeline";

export const WORKSPACE_TYPE_DEFAULT: WorkspaceType = "pipeline";

export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  description?: string;
  status: "active" | "draft" | "archived";
  type: WorkspaceType;
  createdAt: Date;
  updatedAt: Date;
  step: string;
  uploadIds: string[];
  exportIds: string[];
  testsRun: number;
  testsSummary: string[];
  tags: string[];
  datasetSources?: Record<string, string>;
}

export type WorkspaceUpdate = Partial<
  Pick<
    WorkspaceSummary,
    "step" | "testsRun" | "testsSummary" | "name" | "status"
  >
>;

export interface CreateWorkspaceParams {
  name?: string;
  workspaceLimit?: number;
  type?: WorkspaceType;
  template?: {
    status?: string;
    defaultView?: string;
    tags?: { name: string; color: string }[];
  };
}

export interface WorkspaceDatasetInfo {
  uploadId: string;
  fileName: string;
  rowCount: number;
  colCount: number;
  uploadedAt: Date;
  storageRef: string;
  hasStorage: boolean;
  sourceWorkspaceName?: string;
}

export interface WorkspaceExportInfo {
  exportId: string;
  label: string;
  fileType: "pdf" | "csv" | "xlsx" | "docx";
  fileSizeBytes: number;
  createdAt: Date;
  downloadURL: string;
}

export interface OpenDatasetResult {
  dataset: ParsedDataset;
  state: WorkspaceState | null;
}

export interface CodeFileInfo {
  fileId: string;
  name: string;
  language: string;
  updatedAt: Date;
  sizeBytes: number;
}

export interface WorkspaceUploadMeta {
  storagePath: string;
  fileName: string;
  fileSize: number;
  rowCount?: number;
  /** Content hash of the parsed file — key for the IndexedDB dataset cache. */
  contentHash?: string;
  sourceType?: "file" | "api";
  apiUrl?: string;
  updateMode?: "static" | "dynamic";
}

export class WorkspaceCapError extends Error {
  constructor(limit: number) {
    super(
      `Free accounts can save up to ${limit} workspaces. Upgrade to keep this one.`,
    );
    this.name = "WorkspaceCapError";
  }
}

export class WorkspaceNameConflictError extends Error {
  constructor(name: string) {
    super(
      `A workspace named "${name}" already exists. Choose a different name.`,
    );
    this.name = "WorkspaceNameConflictError";
  }
}

/**
 * Cross-call surface the per-concern modules need from the host class.
 * WorkspaceService implements this; modules receive it as their first arg.
 */
export interface WorkspaceHost {
  readonly uid: string;
  readonly db: Firestore | null;
  readonly storage: FirebaseStorage | null;
  workspacesRef(): CollectionReference;
  invalidateCache(workspaceId?: string): void;
  getWorkspace(workspaceId: string): Promise<WorkspaceSummary | null>;
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  getDatasetsForWorkspace(workspaceId: string): Promise<WorkspaceDatasetInfo[]>;
  updateWorkspace(workspaceId: string, updates: WorkspaceUpdate): Promise<void>;
  saveState(
    workspaceId: string,
    state: WorkspaceState,
    uploadId?: string,
  ): Promise<void>;
  loadState(
    workspaceId: string,
    uploadId?: string,
  ): Promise<WorkspaceState | null>;
  recordEvent(
    workspaceId: string,
    type: WorkspaceEventType,
    payload?: Record<string, unknown>,
  ): Promise<void>;
}
