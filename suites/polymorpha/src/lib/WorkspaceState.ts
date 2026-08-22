/**
 * WorkspaceState — pipeline state persistence + activity events for the WorkspaceService.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  writeBatch,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { MAX_EVENTS, PRUNE_BATCH } from "./WorkspaceServiceTypes";
import { CACHE_TTL, workspaceCache } from "./cache";
import { deserializeState, serializeState } from "./workspace";
import type { WorkspaceState } from "./workspace";
import type {
  WorkspaceEvent,
  WorkspaceEventType,
  WorkspaceHost,
} from "./WorkspaceServiceTypes";
import { safeDate } from "./WorkspaceServiceTypes";

// State Persistence

/**
 * Serialize and upload pipeline state to Firebase Storage.
 * When uploadId is provided, state is saved per-dataset.
 * Also bumps workspace `updatedAt` for ordering. Non-fatal but logs.
 */
export async function saveState(
  host: WorkspaceHost,
  workspaceId: string,
  state: WorkspaceState,
  uploadId?: string,
): Promise<void> {
  if (!host.storage) return;
  try {
    const compressed = await serializeState(state);
    const path = uploadId
      ? `users/${host.uid}/workspaces/${workspaceId}/datasets/${uploadId}/state.json.gz`
      : `users/${host.uid}/workspaces/${workspaceId}/state.json.gz`;
    await uploadBytes(ref(host.storage, path), compressed);
    // Bump updatedAt so workspace list ordering reflects save (best-effort)
    if (host.db) {
      try {
        const { doc, updateDoc, serverTimestamp } =
          await import("firebase/firestore");
        await updateDoc(
          doc(host.db, "users", host.uid, "workspaces", workspaceId),
          { updatedAt: serverTimestamp() },
        );
      } catch {
        // non-fatal — Storage succeeded even if Firestore bump failed
      }
    }
    // Invalidate the read-through cache so the next open re-reads this state.
    workspaceCache.invalidate(
      host.uid,
      "state",
      `${workspaceId}:${uploadId ?? "ws"}`,
    );
    // Also invalidate CacheService workspaces list for guest/host parity (07)
    try {
      const { getCacheService } = await import("./CacheService");
      void getCacheService().getTotalCacheSize(); // keep import side-effect warm
    } catch {
      /* ignore */
    }
  } catch (err) {
    // Distinguish permission vs transient — surface via console for now; UI toasts in autosave
    console.warn("[WorkspaceState] saveState failed", err);
  }
}

/**
 * Download and deserialize pipeline state from Firebase Storage.
 * When uploadId is provided, tries per-dataset path first, then falls back
 * to the legacy workspace-level path for backwards compatibility.
 * Returns null if no state file exists yet. Distinguishes permission-denied
 * and corruption for caller to surface (07).
 */
export async function loadState(
  host: WorkspaceHost,
  workspaceId: string,
  uploadId?: string,
): Promise<WorkspaceState | null> {
  if (!host.storage) return null;

  // Read-through cache: repeated opens within the TTL skip the Storage read.
  // saveState() invalidates this key, so freshness is preserved.
  const cacheId = `${workspaceId}:${uploadId ?? "ws"}`;
  const cached = workspaceCache.get<WorkspaceState | null>(
    host.uid,
    "state",
    cacheId,
  );
  if (cached !== undefined) return cached;

  // Helper to try loading from a specific path
  const tryLoad = async (path: string): Promise<WorkspaceState | null> => {
    try {
      const bytes = await getBytes(ref(host.storage!, path));
      return await deserializeState(bytes);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code.includes("permission-denied") ||
        code.includes("unauthenticated")
      ) {
        console.warn(
          "[WorkspaceState] loadState permission denied",
          path,
          code,
        );
        return null;
      }
      if (code.includes("object-not-found") || code.includes("not-found")) {
        return null;
      }
      console.warn("[WorkspaceState] loadState failed", path, err);
      return null;
    }
  };

  // If uploadId is provided, try per-dataset path first
  let state: WorkspaceState | null = null;
  if (uploadId) {
    state = await tryLoad(
      `users/${host.uid}/workspaces/${workspaceId}/datasets/${uploadId}/state.json.gz`,
    );
    if (!state) {
      // Fall back to legacy workspace-level path
      state = await tryLoad(
        `users/${host.uid}/workspaces/${workspaceId}/state.json.gz`,
      );
    }
  } else {
    state = await tryLoad(
      `users/${host.uid}/workspaces/${workspaceId}/state.json.gz`,
    );
  }

  workspaceCache.set(host.uid, "state", state, CACHE_TTL.workspace, cacheId);
  return state;
}

// Events

function eventsRef(host: WorkspaceHost, workspaceId: string) {
  return collection(
    host.db!,
    "users",
    host.uid,
    "workspaces",
    workspaceId,
    "events",
  );
}

/**
 * Record a workspace event. Fire-and-forget — never blocks the caller.
 * Automatically prunes oldest events if > MAX_EVENTS.
 */
export async function recordEvent(
  host: WorkspaceHost,
  workspaceId: string,
  type: WorkspaceEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!host.db) return;
  try {
    const ref = eventsRef(host, workspaceId);
    await addDoc(ref, {
      workspaceId,
      type,
      timestamp: serverTimestamp(),
      payload,
    });

    // Fire-and-forget pruning
    pruneEvents(host, workspaceId).catch(() => {});
  } catch {
    // Never throw — events are non-critical
  }
}

// W13: Use writeBatch for bulk deletes instead of sequential
async function pruneEvents(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<void> {
  if (!host.db) return;
  try {
    const ref = eventsRef(host, workspaceId);
    const countSnap = await getDocs(query(ref, limit(MAX_EVENTS + 1)));
    if (countSnap.size > MAX_EVENTS) {
      const oldest = await getDocs(
        query(ref, orderBy("timestamp", "asc"), limit(PRUNE_BATCH)),
      );
      const batch = writeBatch(host.db);
      for (const d of oldest.docs) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  } catch {
    // Non-critical
  }
}

/**
 * List events for a workspace, newest first. Supports cursor-based pagination.
 */
export async function listEvents(
  host: WorkspaceHost,
  workspaceId: string,
  opts: { pageSize?: number; afterId?: string } = {},
): Promise<WorkspaceEvent[]> {
  if (!host.db) return [];
  try {
    const ref = eventsRef(host, workspaceId);
    let qry = query(
      ref,
      orderBy("timestamp", "desc"),
      limit(opts.pageSize ?? 20),
    );
    if (opts.afterId) {
      const cursorSnap = await getDoc(
        doc(
          host.db,
          "users",
          host.uid,
          "workspaces",
          workspaceId,
          "events",
          opts.afterId,
        ),
      );
      if (cursorSnap.exists()) {
        qry = query(
          ref,
          orderBy("timestamp", "desc"),
          limit(opts.pageSize ?? 20),
          startAfter(cursorSnap),
        );
      }
    }
    const snap = await getDocs(qry);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        workspaceId: data.workspaceId ?? workspaceId,
        type: data.type ?? "workspace.created",
        timestamp: safeDate(data.timestamp),
        payload: data.payload ?? {},
      } as WorkspaceEvent;
    });
  } catch {
    return [];
  }
}
