/**
 * WorkspaceExports — export metadata + registration for the WorkspaceService.
 */
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { CACHE_TTL, workspaceCache } from "./cache";
import type {
  WorkspaceExportInfo,
  WorkspaceHost,
} from "./WorkspaceServiceTypes";
import { safeDate } from "./WorkspaceServiceTypes";

/**
 * Fetch all export metadata for a workspace in a single batched operation.
 * Uses SWR cache keyed by workspaceId.
 */
export async function getExportsForWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<WorkspaceExportInfo[]> {
  if (!host.db) return [];
  const ws = await host.getWorkspace(workspaceId);
  if (!ws || ws.exportIds.length === 0) return [];

  return workspaceCache.swr(
    host.uid,
    "exports",
    async () => {
      const results = await Promise.all(
        ws.exportIds.map(async (eid) => {
          try {
            // Try workspace-scoped exports first, fall back to legacy path
            let snap = await getDoc(
              doc(
                host.db!,
                "users",
                host.uid,
                "workspaces",
                workspaceId,
                "exports",
                eid,
              ),
            );
            if (!snap.exists()) {
              snap = await getDoc(
                doc(host.db!, "users", host.uid, "exports", eid),
              );
            }
            if (!snap.exists()) return null;
            const d = snap.data();
            const rawType = (d.type ?? "pdf") as string;
            const fileType: WorkspaceExportInfo["fileType"] =
              rawType === "csv"
                ? "csv"
                : rawType === "excel" || rawType === "xlsx"
                  ? "xlsx"
                  : rawType === "docx"
                    ? "docx"
                    : "pdf";
            return {
              exportId: eid,
              label: d.fileName ?? "Export",
              fileType,
              fileSizeBytes: d.fileSize ?? 0,
              createdAt: safeDate(d.createdAt),
              downloadURL: d.downloadUrl ?? "",
            } as WorkspaceExportInfo;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((e): e is WorkspaceExportInfo => e !== null);
    },
    CACHE_TTL.exports,
    workspaceId,
  );
}

/** Add export to workspace. Throws on failure for optimistic revert. */
export async function addExportToWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
  exportId: string,
  exportMeta?: { fileName?: string; fileType?: string },
): Promise<void> {
  if (!host.db) throw new Error("Firebase not initialised");

  await updateDoc(doc(host.db, "users", host.uid, "workspaces", workspaceId), {
    exportIds: arrayUnion(exportId),
    updatedAt: serverTimestamp(),
  });
  host
    .recordEvent(workspaceId, "export.generated", {
      exportId,
      ...(exportMeta ?? {}),
    })
    .catch(() => {});
  host.invalidateCache(workspaceId);
}
