/**
 * WorkspaceCrud — Ground-up minimal CRUD for WorkspaceService.
 * No Transaction.get(Query) — SDK 12 only allows DocumentReference in transactions.
 * Creation is outside-transaction getDocs + addDoc (v1 best-effort cap).
 */
import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { CACHE_TTL, workspaceCache } from "./cache";
import type {
  CreateWorkspaceParams,
  WorkspaceHost,
  WorkspaceSummary,
  WorkspaceUpdate,
} from "./WorkspaceServiceTypes";
import {
  WorkspaceCapError,
  WorkspaceNameConflictError,
  safeDate,
} from "./WorkspaceServiceTypes";

function uniqueName(existingLower: Set<string>, base: string): string {
  if (!existingLower.has(base.toLowerCase())) return base;
  let suffix = 2;
  let candidate = `${base} (${suffix})`;
  while (existingLower.has(candidate.toLowerCase())) {
    suffix++;
    candidate = `${base} (${suffix})`;
  }
  return candidate;
}

/**
 * Create a workspace — completely revised from ground up.
 * No transaction-query. Outside read for cap + name dedup, then single addDoc.
 */
export async function createWorkspace(
  host: WorkspaceHost,
  params: CreateWorkspaceParams,
): Promise<string> {
  if (!host.db) throw new Error("Firebase not initialised");

  const wsLimit = params.workspaceLimit ?? 3;

  // Outside-transaction cap check — v1 best-effort (atomic cap via counter doc is follow-up)
  if (wsLimit > 0) {
    const capSnap = await getDocs(
      query(host.workspacesRef(), where("deletedAt", "==", null), limit(50)),
    );
    if (capSnap.size >= wsLimit) throw new WorkspaceCapError(wsLimit);
  }

  // Name dedup — single outside read
  const snap = await getDocs(
    query(host.workspacesRef(), where("deletedAt", "==", null), limit(50)),
  );
  const existingNames = new Set(
    snap.docs.map((d) => (d.data().name as string | undefined)?.toLowerCase() ?? ""),
  );

  const now = new Date();
  const defaultName = `Workspace — ${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
  let name = params.name?.trim() || defaultName;

  if (!params.name?.trim()) {
    name = uniqueName(existingNames, name);
  } else if (existingNames.has(name.toLowerCase())) {
    throw new WorkspaceNameConflictError(name);
  }

  const template = params.template;
  const tags = Array.isArray(template?.tags)
    ? template.tags
        .map((t) => (typeof t === "string" ? t : (t as { name: string }).name ?? ""))
        .filter(Boolean)
    : [];

  const ref = await addDoc(host.workspacesRef(), {
    name,
    status: template?.status || "active",
    type: "pipeline" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    tags,
    step: "upload",
    uploadIds: [],
    exportIds: [],
    testsRun: 0,
    testsSummary: [],
  });

  host.recordEvent(ref.id, "workspace.created", { name }).catch(() => {});
  host.invalidateCache();

  return ref.id;
}

/** List all non-deleted workspaces, sorted by updatedAt desc. Uses SWR cache. */
export async function listWorkspaces(
  host: WorkspaceHost,
): Promise<WorkspaceSummary[]> {
  if (!host.db) return [];
  return workspaceCache.swr(
    host.uid,
    "workspaces",
    async () => {
      const q = query(
        host.workspacesRef(),
        where("deletedAt", "==", null),
        limit(50),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          workspaceId: d.id,
          name: data.name ?? "",
          description: data.description,
          status: data.status ?? "active",
          type: "pipeline" as const,
          createdAt: safeDate(data.createdAt),
          updatedAt: safeDate(data.updatedAt),
          step: data.step ?? "upload",
          uploadIds: Array.isArray(data.uploadIds) ? data.uploadIds : [],
          exportIds: Array.isArray(data.exportIds) ? data.exportIds : [],
          testsRun: data.testsRun ?? 0,
          testsSummary: data.testsSummary ?? [],
          tags: data.tags ?? [],
        };
      });
      list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return list;
    },
    CACHE_TTL.workspaceList,
  );
}

/** Get a single workspace. Returns null if not found or deleted. Uses SWR cache. */
export async function getWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<WorkspaceSummary | null> {
  if (!host.db) return null;
  return workspaceCache.swr(
    host.uid,
    "workspace",
    async () => {
      const snap = await getDoc(
        doc(host.db!, "users", host.uid, "workspaces", workspaceId),
      );
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.deletedAt) return null;
      return {
        workspaceId: snap.id,
        name: data.name ?? "",
        description: data.description,
        status: data.status ?? "active",
        type: "pipeline" as const,
        createdAt: safeDate(data.createdAt),
        updatedAt: safeDate(data.updatedAt),
        step: data.step ?? "upload",
        uploadIds: Array.isArray(data.uploadIds) ? data.uploadIds : [],
        exportIds: Array.isArray(data.exportIds) ? data.exportIds : [],
        testsRun: data.testsRun ?? 0,
        testsSummary: data.testsSummary ?? [],
        tags: data.tags ?? [],
        datasetSources: data.datasetSources ?? {},
      } as WorkspaceSummary;
    },
    CACHE_TTL.workspace,
    workspaceId,
  );
}

/** Soft-delete a workspace. */
export async function deleteWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<void> {
  if (!host.db) return;
  await updateDoc(doc(host.db, "users", host.uid, "workspaces", workspaceId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  host.invalidateCache(workspaceId);
}

/** Rename a workspace. Throws if name is empty or conflicts. */
export async function renameWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
  name: string,
  oldName?: string,
): Promise<void> {
  if (!name.trim()) throw new Error("Workspace name cannot be empty.");
  if (!host.db) return;

  const existing = await getDocs(
    query(host.workspacesRef(), where("deletedAt", "==", null)),
  );
  const trimmed = name.trim();
  const conflict = existing.docs.some((d) => {
    if (d.id === workspaceId) return false;
    return (d.data().name?.toLowerCase?.() ?? "") === trimmed.toLowerCase();
  });
  if (conflict) throw new WorkspaceNameConflictError(trimmed);

  await updateDoc(doc(host.db, "users", host.uid, "workspaces", workspaceId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
  host
    .recordEvent(workspaceId, "workspace.renamed", {
      from: oldName ?? "",
      to: trimmed,
    })
    .catch(() => {});
  host.invalidateCache(workspaceId);
}

/** Update workspace metadata (step, testsRun, etc.). Always injects updatedAt. */
export async function updateWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
  updates: WorkspaceUpdate,
): Promise<void> {
  if (!host.db) return;
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.step !== undefined) data.step = updates.step;
  if (updates.testsRun !== undefined) data.testsRun = updates.testsRun;
  if (updates.testsSummary !== undefined) data.testsSummary = updates.testsSummary;
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.status !== undefined) data.status = updates.status;
  await updateDoc(
    doc(host.db, "users", host.uid, "workspaces", workspaceId),
    data,
  );

  if (updates.status !== undefined) {
    host
      .recordEvent(workspaceId, "workspace.status_changed", {
        status: updates.status,
      })
      .catch(() => {});
  }
  if (updates.step !== undefined) {
    host
      .recordEvent(workspaceId, "pipeline.step_changed", {
        step: updates.step,
      })
      .catch(() => {});
  }
  if (updates.testsRun !== undefined && updates.testsRun > 0) {
    host
      .recordEvent(workspaceId, "pipeline.tests_run", {
        testsRun: updates.testsRun,
        testsSummary: updates.testsSummary ?? [],
      })
      .catch(() => {});
  }
  host.invalidateCache(workspaceId);
}

/**
 * Duplicate a workspace. Copies: name, tags, status.
 * Does NOT copy: datasets, exports, pipeline state, activity events.
 */
export async function duplicateWorkspace(
  host: WorkspaceHost,
  workspaceId: string,
): Promise<string> {
  if (!host.db) throw new Error("Firebase not initialised");

  const original = await host.getWorkspace(workspaceId);
  if (!original) throw new Error("Workspace not found.");

  let newName = `${original.name} (copy)`;
  const all = await getDocs(
    query(host.workspacesRef(), where("deletedAt", "==", null)),
  );
  const existingNames = new Set(
    all.docs.map((d) => d.data().name?.toLowerCase?.() ?? ""),
  );
  let suffix = 2;
  while (existingNames.has(newName.toLowerCase())) {
    newName = `${original.name} (copy ${suffix})`;
    suffix++;
  }

  const docRef = await addDoc(host.workspacesRef(), {
    name: newName,
    status: original.status,
    type: "pipeline" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    tags: original.tags,
    step: "upload",
    uploadIds: [],
    exportIds: [],
    testsRun: 0,
    testsSummary: [],
  });

  await host.recordEvent(docRef.id, "workspace.created", {
    source: "duplicate",
    originalId: workspaceId,
  });
  await host.recordEvent(docRef.id, "workspace.duplicated", {
    originalName: original.name,
  });
  host.invalidateCache();

  return docRef.id;
}
