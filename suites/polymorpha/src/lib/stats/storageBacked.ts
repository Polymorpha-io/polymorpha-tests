/**
 * storageBacked — resolve a raw-file reference so stats compute server-side
 * instead of shipping full rows in the request body.
 *
 * Works even after cleaning: the backend re-applies `cleaningConfig` server-side
 * (preview is 100 rows for paint, pipeline is full).
 * Metadata lookup is cached per (user, workspace, upload) for the session.
 */
import { createWorkspaceService } from "@/lib/WorkspaceService";
import { useAuthStore } from "@/store/useAuthStore";
import { useDataStore } from "@/store/useDataStore";

export interface StorageBackedContext {
  uid: string;
  workspaceId: string;
  uploadId: string;
}

export interface StorageBackedRef extends StorageBackedContext {
  storagePath: string;
  contentHash?: string;
}

/** Return the current storage-backed context, or null when no workspace/upload. */
export function getStorageBackedContext(): StorageBackedContext | null {
  const uid = useAuthStore.getState().user?.uid;
  const { workspaceId, uploadId } = useDataStore.getState();
  if (!uid || !workspaceId || !uploadId) return null;
  return { uid, workspaceId, uploadId };
}

const refCache = new Map<string, Promise<StorageBackedRef | null>>();
const refCacheTs = new Map<string, number>();
const REF_CACHE_TTL_MS = 5 * 60 * 1000;

/** Resolve the raw-file reference (cached per session with 5m TTL + dedup). */
export function resolveStorageBacked(
  ctx: StorageBackedContext,
): Promise<StorageBackedRef | null> {
  const key = `${ctx.uid}:${ctx.workspaceId}:${ctx.uploadId}`;
  const hit = refCache.get(key);
  const hitTs = refCacheTs.get(key);
  if (hit && hitTs !== undefined && Date.now() - hitTs < REF_CACHE_TTL_MS) {
    return hit;
  }
  const promise = createWorkspaceService(ctx.uid)
    .getUploadMeta(ctx.workspaceId, ctx.uploadId)
    .then((meta) =>
      meta?.storagePath
        ? {
            ...ctx,
            storagePath: meta.storagePath,
            contentHash: meta.contentHash,
          }
        : null,
    )
    .catch(() => null);
  // Dedup concurrent callers and auto-expire on failure
  refCache.set(key, promise);
  refCacheTs.set(key, Date.now());
  promise.catch(() => {
    refCache.delete(key);
    refCacheTs.delete(key);
  });
  return promise;
}
