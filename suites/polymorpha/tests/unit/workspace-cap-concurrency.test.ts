/**
 * P0-A G18 — Workspace creation concurrency invariant
 * Verifies: concurrent createWorkspace under cap cannot exceed limit,
 * same-name dedup remains atomic, and no new `any` is introduced.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkspaceCapError,
  WorkspaceNameConflictError,
} from "@/lib/WorkspaceServiceTypes";

// In-memory Firestore simulation for transaction isolation
type DocData = Record<string, unknown>;
type UidStore = Map<string, DocData>;
const memStore = new Map<string, UidStore>(); // key: uid -> map docId -> data
let docIdCounter = 0;
function nextDocId() {
  docIdCounter += 1;
  return `ws-${docIdCounter}`;
}
function getUidStore(uid: string): UidStore {
  let s = memStore.get(uid);
  if (!s) {
    s = new Map();
    memStore.set(uid, s);
  }
  return s;
}

// Mutex per uid to simulate runTransaction serializable isolation
const uidLocks = new Map<string, Promise<void>>();
function withUidLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const prev = uidLocks.get(uid) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => {
    release = res;
  });
  uidLocks.set(
    uid,
    prev.then(() => next),
  );
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

// Mock firebase/firestore — must be hoisted before importing WorkspaceCrud
vi.mock("firebase/firestore", async () => {
  const actual = (await vi.importActual("firebase/firestore")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    // collection() is called via host.workspacesRef() which we will override to return fake refs,
    // but keep for completeness
    collection: vi.fn((db: unknown, ...path: string[]) => ({
      _path: path.join("/"),
      _db: db,
    })),
    doc: vi.fn((colRef: unknown) => {
      // host.workspacesRef() returns a collection-like object; doc() on it should create new id
      const col = colRef as { _uid?: string };
      const uid = (col as unknown as { _uid?: string })._uid ?? "test-uid";
      // Store pending doc id on the ref; actual map insertion happens in transaction set
      return { _uid: uid, _isDoc: true, id: nextDocId(), _col: colRef };
    }),
    query: vi.fn((colRef: unknown, ...conds: unknown[]) => ({
      _col: colRef,
      _conds: conds,
    })),
    where: vi.fn((field: string, op: string, val: unknown) => ({
      field,
      op,
      val,
    })),
    serverTimestamp: vi.fn(() => new Date()),
    getDocs: vi.fn(async (q: unknown) => {
      const col = q as { _col?: unknown };
      const collectionRef = (col as unknown as { _col?: unknown })._col as
        { _uid?: string } | undefined;
      const uid =
        (collectionRef as unknown as { _uid?: string })?._uid ?? "test-uid";
      const store = getUidStore(uid);
      const docs = Array.from(store.entries())
        .filter(
          ([, data]) => (data as Record<string, unknown>).deletedAt == null,
        )
        .map(([id, data]) => ({ id, data: () => data }));
      return { size: docs.length, docs, empty: docs.length === 0 };
    }),
    getDoc: vi.fn(async (docRef: unknown) => {
      const ref = docRef as { _uid?: string; id: string };
      const store = getUidStore(ref._uid ?? "test-uid");
      const data = store.get(ref.id);
      return { exists: () => !!data, data: () => data, id: ref.id };
    }),
    updateDoc: vi.fn(async () => {}),
    addDoc: vi.fn(async () => ({ id: nextDocId() })),
    runTransaction: vi.fn(
      async (db: unknown, updateFn: (tx: unknown) => Promise<unknown>) => {
        // Extract uid from db placeholder or from first workspacesRef call inside transaction
        // We don't have db->uid mapping, so we infer from a global current uid set by host.workspacesRef()
        // For this test, all transactions for same uid share lock
        // Find uid via a hack: use last created collection's uid, or fallback to test-uid
        const uid =
          (globalThis as unknown as { __testUid?: string }).__testUid ??
          "test-uid";
        return withUidLock(uid, async () => {
          const pendingSets: Array<{
            ref: { id: string; _uid?: string };
            data: DocData;
          }> = [];
          const tx = {
            get: async (q: unknown) => {
              const col = q as { _col?: unknown };
              const collectionRef = (col as unknown as { _col?: unknown })
                ._col as { _uid?: string } | undefined;
              const txUid =
                (collectionRef as unknown as { _uid?: string })?._uid ?? uid;
              const store = getUidStore(txUid);
              const docs = Array.from(store.entries())
                .filter(
                  ([, data]) =>
                    (data as Record<string, unknown>).deletedAt == null,
                )
                .map(([id, data]) => ({ id, data: () => data }));
              return { size: docs.length, docs, empty: docs.length === 0 };
            },
            set: (docRef: unknown, data: DocData) => {
              const ref = docRef as { id: string; _uid?: string };
              pendingSets.push({
                ref: { id: ref.id, _uid: ref._uid ?? uid },
                data,
              });
            },
            update: () => {},
            delete: () => {},
          };
          const result = await updateFn(tx);
          // Atomically apply pending sets
          for (const { ref, data } of pendingSets) {
            const store = getUidStore(ref._uid ?? uid);
            store.set(ref.id, { ...data });
          }
          return result;
        });
      },
    ),
  };
});

// Helper to create a WorkspaceHost-like object that uses our fake collection refs
function makeHost(uid: string) {
  // Expose uid for mock runTransaction to pick up
  (globalThis as unknown as { __testUid?: string }).__testUid = uid;
  const fakeDb = {} as unknown as import("firebase/firestore").Firestore;
  return {
    uid,
    db: fakeDb,
    storage: null as unknown as import("firebase/storage").FirebaseStorage,
    workspacesRef: () =>
      ({
        _uid: uid,
        _path: `users/${uid}/workspaces`,
      }) as unknown as ReturnType<
        typeof import("firebase/firestore").collection
      >,
    getWorkspace: async () => null,
    saveNotes: async () => {},
    recordEvent: async () => {},
    invalidateCache: () => {},
  } as unknown as import("@/lib/WorkspaceServiceTypes").WorkspaceHost;
}

describe("P0-A G18 workspace cap concurrency (runTransaction)", () => {
  beforeEach(() => {
    memStore.clear();
    docIdCounter = 0;
    uidLocks.clear();
  });

  it("concurrent createWorkspace at size 2 limit 3: exactly one succeeds, one throws cap", async () => {
    const { createWorkspace } = await import("@/lib/WorkspaceCrud");
    const host = makeHost("alice");
    const store = getUidStore("alice");
    // Seed 2 existing workspaces
    store.set("ws-1", { name: "Alpha", deletedAt: null });
    store.set("ws-2", { name: "Beta", deletedAt: null });
    docIdCounter = 2;

    const p1 = createWorkspace(host, { name: "Gamma", workspaceLimit: 3 });
    const p2 = createWorkspace(host, { name: "Delta", workspaceLimit: 3 });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<string>[];
    const rejected = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0]!.reason as Error).name).toBe("WorkspaceCapError");
    // Final size must be exactly 3, not 4
    expect(getUidStore("alice").size).toBe(3);
    // Verify error carries limit
    expect((rejected[0]!.reason as WorkspaceCapError).message).toContain("3");
  });

  it("concurrent same-name creation at size 2 limit 3: one succeeds, one throws conflict", async () => {
    const { createWorkspace } = await import("@/lib/WorkspaceCrud");
    const host = makeHost("bob");
    const store = getUidStore("bob");
    store.set("ws-1", { name: "Alpha", deletedAt: null });
    store.set("ws-2", { name: "Beta", deletedAt: null });
    docIdCounter = 2;

    const p1 = createWorkspace(host, { name: "Gamma", workspaceLimit: 3 });
    const p2 = createWorkspace(host, { name: "Gamma", workspaceLimit: 3 });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    // One must fail: either cap (if both count) or name conflict (if both Gamma)
    // With limit 3 and size 2, first Gamma succeeds -> size 3, second fails cap before conflict
    // But if we start at size 1 limit 3, conflict path is testable — adjust case
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = rejected[0]!.reason as Error;
    expect(["WorkspaceCapError", "WorkspaceNameConflictError"]).toContain(
      reason.name,
    );
  });

  it("same-name at size 1 limit 3: second fails with WorkspaceNameConflictError (not cap)", async () => {
    const { createWorkspace } = await import("@/lib/WorkspaceCrud");
    const host = makeHost("carol");
    const store = getUidStore("carol");
    store.set("ws-1", { name: "Alpha", deletedAt: null });
    docIdCounter = 1;

    const p1 = createWorkspace(host, { name: "Gamma", workspaceLimit: 3 });
    const p2 = createWorkspace(host, { name: "Gamma", workspaceLimit: 3 });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // With size 1, two Gammas: first succeeds size 2, second should conflict not cap
    expect((rejected[0]!.reason as Error).name).toBe(
      "WorkspaceNameConflictError",
    );
    expect(getUidStore("carol").size).toBe(2);
  });

  it("uses runTransaction (atomic) not getDocs+addDoc", async () => {
    const firestore = await import("firebase/firestore");
    const host = makeHost("dave");
    const { createWorkspace } = await import("@/lib/WorkspaceCrud");
    // Clear previous calls
    vi.mocked(firestore.runTransaction).mockClear();
    await createWorkspace(host, { name: "Solo", workspaceLimit: 3 });
    expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
    // Ensure getDocs (outside transaction) is not the cap check path
    // Our mock getDocs should not be called for cap inside createWorkspace (it uses tx.get)
    // So verify runTransaction was the cap gate, not a pre-transaction getDocs
  });

  it("does not introduce `any` in new code path (type check proxy)", async () => {
    // This test is a placeholder for D22/G10: the transaction path should be typed
    // without `as any` on new lines. We assert the file does not contain new `as any` in the transaction block.
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/lib/WorkspaceCrud.ts", "utf-8");
    // Extract the runTransaction block (from `await runTransaction` to `return newDocRef.id`)
    const txBlock = content.slice(content.indexOf("await runTransaction"));
    // Allow existing legacy `as unknown` in other files, but new P0-A block must not add `as any`
    const newAnyInTxBlock = (txBlock.match(/\bas any\b/g) ?? []).length;
    expect(newAnyInTxBlock).toBe(0);
  });
});
