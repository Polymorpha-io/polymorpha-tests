/**
 * WorkspaceDatasets — dataset metadata + open flows for the WorkspaceService.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
import { CACHE_TTL, workspaceCache } from "./cache";
import { parseDatasetFromBytes } from "./workspace";
import type {
  WorkspaceDatasetInfo,
  WorkspaceHost,
  WorkspaceUploadMeta,
  OpenDatasetResult,
} from "./WorkspaceServiceTypes";
import { safeDate } from "./WorkspaceServiceTypes";

/**
 * Fetch all dataset metadata for a workspace in a single batched operation.
 * Uses SWR cache keyed by workspaceId. Avoids N+1 getDoc calls.
 */
export async function getDatasetsForWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<WorkspaceDatasetInfo[]> {
  if (!host.db) return [];
  const ws = await host.getWorkspace(workspaceId);
  if (!ws || ws.uploadIds.length === 0) return [];

  const datasetSources = ws.datasetSources ?? {};

  return workspaceCache.swr(
    host.uid,
    "datasets",
    async () => {
      const ids = [...new Set(ws.uploadIds)];
      const snapshots = await Promise.all(
        chunk(ids, 10).map((batch) =>
          getDocs(
            query(
              collection(host.db!, "users", host.uid, "uploads"),
              where(documentId(), "in", batch),
            ),
          ),
        ),
      );
      const byId = new Map<string, Record<string, unknown>>();
      for (const snap of snapshots) {
        for (const d of snap.docs) byId.set(d.id, d.data());
      }
      return ids
        .map((uid) => {
          const d = byId.get(uid);
          if (!d) return null;
          const storageRef = d.storageRef ?? "";
          return {
            uploadId: uid,
            fileName: d.fileName ?? "Unknown",
            rowCount: d.rowCount ?? 0,
            colCount: d.columnCount ?? 0,
            uploadedAt: safeDate(d.uploadedAt),
            storageRef,
            hasStorage: !!storageRef,
            sourceWorkspaceName: datasetSources[uid] ?? undefined,
          } as WorkspaceDatasetInfo;
        })
        .filter((d): d is WorkspaceDatasetInfo => d !== null);
    },
    CACHE_TTL.datasets,
    workspaceId,
  );
}

/** Split an array into fixed-size chunks (Firestore `in` caps at 10 ids). */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * List all datasets across ALL the user's workspaces, grouped by workspace.
 * Used by the Code Editor workspace to expose cross-workspace dataset variables.
 * SWR-cached under the 'all-datasets' scope.
 */
export async function getAllDatasetsForUser(host: WorkspaceHost): Promise<
  Array<{
    workspaceId: string;
    workspaceName: string;
    datasets: WorkspaceDatasetInfo[];
  }>
> {
  if (!host.db) return [];
  return workspaceCache.swr(
    host.uid,
    "all-datasets",
    async () => {
      const workspaces = await host.listWorkspaces();
      const results = await Promise.all(
        workspaces.map(async (ws) => {
          try {
            const datasets = await host.getDatasetsForWorkspace(ws.workspaceId);
            return {
              workspaceId: ws.workspaceId,
              workspaceName: ws.name,
              datasets,
            };
          } catch {
            return {
              workspaceId: ws.workspaceId,
              workspaceName: ws.name,
              datasets: [] as WorkspaceDatasetInfo[],
            };
          }
        }),
      );
      return results.filter((g) => g.datasets.length > 0);
    },
    CACHE_TTL.datasets,
  );
}

/** Add upload to workspace. Throws on failure for optimistic revert. */
export async function addUploadToWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
  uploadId: string,
  fileName?: string,
  sourceWorkspaceName?: string,
): Promise<void> {
  if (!host.db) throw new Error("Firebase not initialised");

  const updateData: Record<string, unknown> = {
    uploadIds: arrayUnion(uploadId),
    updatedAt: serverTimestamp(),
  };
  if (sourceWorkspaceName) {
    updateData[`datasetSources.${uploadId}`] = sourceWorkspaceName;
  }
  await updateDoc(
    doc(host.db, "users", host.uid, "workspaces", workspaceId),
    updateData,
  );
  host
    .recordEvent(workspaceId, "dataset.added", {
      uploadId,
      fileName: fileName ?? "",
    })
    .catch(() => {});
  host.invalidateCache(workspaceId);
}

/** Remove upload from workspace. */
export async function removeUploadFromWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
  uploadId: string,
  fileName?: string,
): Promise<void> {
  if (!host.db) return;

  await updateDoc(doc(host.db, "users", host.uid, "workspaces", workspaceId), {
    uploadIds: arrayRemove(uploadId),
    updatedAt: serverTimestamp(),
  });
  host
    .recordEvent(workspaceId, "dataset.removed", {
      uploadId,
      fileName: fileName ?? "",
    })
    .catch(() => {});
  host.invalidateCache(workspaceId);
}

/**
 * Get upload metadata (storagePath, fileName) without downloading the blob.
 * Used by the new Python-backed flow where parse/clean happen server-side.
 */
export async function getUploadMeta(
  host: WorkspaceHost,
  _workspaceId: string,
  uploadId: string,
): Promise<WorkspaceUploadMeta | null> {
  if (!host.db) {
    if (import.meta.env.DEV)
      console.warn("[WorkspaceService] Firestore DB not initialized");
    return null;
  }
  try {
    const uploadSnap = await getDoc(
      doc(host.db, "users", host.uid, "uploads", uploadId),
    );
    if (!uploadSnap.exists()) {
      if (import.meta.env.DEV)
        console.warn("[WorkspaceService] Upload doc not found:", uploadId);
      return null;
    }
    const data = uploadSnap.data();
    const storagePath = data.storageRef as string;
    if (!storagePath && !data.apiUrl) {
      if (import.meta.env.DEV)
        console.warn(
          "[WorkspaceService] Upload doc has no storageRef or apiUrl:",
          uploadId,
        );
      return null;
    }
    return {
      storagePath: storagePath || "",
      fileName: (data.fileName as string) ?? "dataset",
      fileSize: (data.fileSize as number) ?? 0,
      rowCount: (data.rowCount as number) ?? 0,
      contentHash: data.contentHash as string | undefined,
      sourceType: data.sourceType as "file" | "api",
      apiUrl: data.apiUrl as string,
      updateMode: data.updateMode as "static" | "dynamic",
    };
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn("[WorkspaceService] Error fetching upload meta:", err);
    return null;
  }
}

/**
 * Download, parse, and return a dataset + last saved state.
 * Does not write to useDataStore — the calling page is responsible for store hydration.
 * Returns { state: null } if no state has ever been saved (first open).
 * @deprecated Use getUploadMeta() + callParseApi() instead. Kept for fallback.
 */
export async function openDataset(
  host: WorkspaceHost,
  workspaceId: string,
  uploadId: string,
): Promise<OpenDatasetResult> {
  if (!host.db || !host.storage) throw new Error("Firebase not initialised");

  // Fetch upload doc
  const uploadSnap = await getDoc(
    doc(host.db, "users", host.uid, "uploads", uploadId),
  );
  if (!uploadSnap.exists()) throw new Error("Dataset not found.");
  const uploadData = uploadSnap.data();
  const storageRefPath = uploadData.storageRef as string;
  const fileName = (uploadData.fileName as string) ?? "dataset";
  if (!storageRefPath)
    throw new Error(
      "Dataset file not available — the file may have failed to upload. Try removing and re-uploading this dataset.",
    );

  // Download bytes via Firebase SDK (avoids CORS issues with fetch)
  const bytes = await getBytes(ref(host.storage, storageRefPath));
  const dataset = await parseDatasetFromBytes(bytes, fileName);
  if (!dataset) throw new Error("Could not parse dataset file.");

  // Load state scoped to this dataset
  const state = await host.loadState(workspaceId, uploadId);

  return { dataset, state };
}
