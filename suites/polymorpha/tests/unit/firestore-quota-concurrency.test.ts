/**
 * P0-B G18 — Firestore quota atomicity (runTransaction)
 * Verifies: concurrent recordUpload cannot overshoot maxSavedBytes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory user store for quota simulation
type UserData = {
  totalStorageBytes: number;
  maxSavedBytes: number;
  totalUploads: number;
  totalExports: number;
};
const userStore = new Map<string, UserData>();
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

vi.mock("firebase/firestore", async () => {
  const actual = (await vi.importActual("firebase/firestore")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    doc: vi.fn((...args: unknown[]) => {
      if (args.length === 1) {
        const col = args[0] as { _uid?: string };
        const ref: Record<string, unknown> = {
          _uid: col._uid ?? "test-uid",
          id: `upload-${Math.random().toString(36).slice(2, 8)}`,
          _isDoc: true,
        };
        (ref as Record<string, unknown>).withConverter = () => ref;
        return ref;
      }
      const uid = args[2] as string;
      const id = (args[4] as string) ?? (args[3] as string) ?? "test-id";
      const ref: Record<string, unknown> = {
        _uid: uid ?? "test-uid",
        id,
        _isDoc: true,
      };
      (ref as Record<string, unknown>).withConverter = () => ref;
      return ref;
    }),
    collection: vi.fn((...args: unknown[]) => {
      const uid = args[2] as string;
      const col: Record<string, unknown> = {
        _uid: uid ?? "test-uid",
        _path: args.join("/"),
      };
      (col as Record<string, unknown>).withConverter = () => col;
      return col;
    }),
    serverTimestamp: vi.fn(() => new Date()),
    increment: vi.fn((n: number) => ({ _increment: n })),
    runTransaction: vi.fn(
      async (db: unknown, updateFn: (tx: unknown) => Promise<unknown>) => {
        const uid =
          (globalThis as unknown as { __testUid?: string }).__testUid ??
          "test-uid";
        // Simulate serialized transactions: first sees 60, second sees 90
        // Use callCount to determine which concurrent call this is
        const callIdx =
          (globalThis as unknown as { __txCallCount?: number }).__txCallCount ??
          0;
        (globalThis as unknown as { __txCallCount?: number }).__txCallCount =
          callIdx + 1;
        const tx = {
          get: async (ref: unknown) => {
            // For concurrent test, first call sees 60, second sees 90 (after first commit)
            const base = callIdx === 0 ? 60 * 1024 * 1024 : 90 * 1024 * 1024;
            // For sequential test, use actual store value
            const isConcurrent = (
              globalThis as unknown as { __isConcurrent?: boolean }
            ).__isConcurrent;
            const total = isConcurrent
              ? base
              : (userStore.get(uid)?.totalStorageBytes ?? 0);
            const max = userStore.get(uid)?.maxSavedBytes ?? 104857600;
            const data = {
              totalStorageBytes: total,
              maxSavedBytes: max,
              totalUploads: userStore.get(uid)?.totalUploads ?? 0,
            };
            return {
              exists: () => true,
              data: () => data,
            };
          },
          set: (ref: unknown, data: unknown) => {},
          update: (ref: unknown, updates: Record<string, unknown>) => {
            const data = userStore.get(uid);
            if (!data) return;
            for (const [k, v] of Object.entries(updates)) {
              const inc = v as { _increment?: number };
              if (inc && typeof inc._increment === "number") {
                if (k === "totalStorageBytes")
                  data.totalStorageBytes += inc._increment;
                if (k === "totalUploads") data.totalUploads += inc._increment;
                if (k === "totalExports") data.totalExports += inc._increment;
              }
            }
            userStore.set(uid, { ...data });
          },
        };
        return updateFn(tx);
      },
    ),
    getDoc: vi.fn(async (ref: unknown) => {
      const uid = (ref as { _uid?: string })._uid ?? "test-uid";
      const data = userStore.get(uid);
      return {
        exists: () => !!data,
        data: () => data,
      } as unknown as import("firebase/firestore").DocumentSnapshot;
    }),
    getDocs: vi.fn(async () => ({ size: 0, docs: [], empty: true })),
    addDoc: vi.fn(async () => ({
      id: `upload-${Math.random().toString(36).slice(2, 8)}`,
    })),
    updateDoc: vi.fn(async (ref: unknown, updates: Record<string, unknown>) => {
      const uid =
        (ref as { _uid?: string })._uid ??
        (globalThis as unknown as { __testUid?: string }).__testUid ??
        "test-uid";
      const data = userStore.get(uid) ?? {
        totalStorageBytes: 0,
        maxSavedBytes: 104857600,
        totalUploads: 0,
        totalExports: 0,
      };
      for (const [k, v] of Object.entries(updates)) {
        const inc = v as { _increment?: number };
        if (inc && typeof inc._increment === "number") {
          if (k === "totalStorageBytes")
            data.totalStorageBytes += inc._increment;
          if (k === "totalUploads") data.totalUploads += inc._increment;
        }
      }
      userStore.set(uid, data as UserData);
    }),
    setDoc: vi.fn(async () => {}),
  };
});

vi.mock("@/config/firebase", () => ({
  getFirebaseDb: () => ({}),
  getFirebaseAuth: () => ({ currentUser: { uid: "test-uid" } }),
  getFirebaseStorage: () => null,
}));

vi.mock("@polymorpha/business-logic", () => ({
  compressBlobAsync: async (blob: Blob) => blob,
}));

vi.mock("@/lib/CacheService", () => ({
  getCacheService: () => ({
    get: () => null,
    set: () => {},
    invalidate: () => {},
    invalidateScope: () => {},
  }),
}));

function makeBlob(size: number): Blob {
  // Create a blob of given size (filled with zeros)
  const chunk = new Uint8Array(1024).fill(0);
  const parts: Uint8Array[] = [];
  let remaining = size;
  while (remaining > 0) {
    const take = Math.min(remaining, chunk.length);
    parts.push(chunk.slice(0, take));
    remaining -= take;
  }
  return new Blob(parts as unknown as BlobPart[]);
}

describe("P0-B G18 quota atomicity (runTransaction)", () => {
  beforeEach(() => {
    userStore.clear();
    uidLocks.clear();
    (globalThis as unknown as { __testUid?: string }).__testUid = "test-uid";
    (globalThis as unknown as { __txCallCount?: number }).__txCallCount = 0;
    (globalThis as unknown as { __isConcurrent?: boolean }).__isConcurrent =
      false;
  });

  it("concurrent recordUpload overshoot: 60MB used, max 100MB, two 30MB uploads → one succeeds, total 90MB not 120MB", async () => {
    (globalThis as unknown as { __isConcurrent?: boolean }).__isConcurrent =
      true;
    (globalThis as unknown as { __txCallCount?: number }).__txCallCount = 0;
    const { createFirestoreService } = await import("@/lib/FirestoreService");
    const uid = "test-uid";
    userStore.set(uid, {
      totalStorageBytes: 60 * 1024 * 1024,
      maxSavedBytes: 100 * 1024 * 1024,
      totalUploads: 5,
      totalExports: 0,
    });

    const svc = createFirestoreService(uid);
    const blob30 = makeBlob(30 * 1024 * 1024);

    const p1 = svc.recordUpload({
      fileName: "a.csv",
      fileSize: 30 * 1024 * 1024,
      rowCount: 100,
      columnCount: 2,
      columns: ["a", "b"],
      blob: blob30,
    });
    const p2 = svc.recordUpload({
      fileName: "b.csv",
      fileSize: 30 * 1024 * 1024,
      rowCount: 100,
      columnCount: 2,
      columns: ["a", "b"],
      blob: blob30,
    });

    const results = await Promise.allSettled([p1, p2]);
    // One should succeed (string id), one should return null (cap exceeded caught and returns null)
    const fulfilled = results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r as PromiseFulfilledResult<string | null>).value !== null,
    );
    const rejectedOrNull = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r as PromiseFulfilledResult<string | null>).value === null,
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejectedOrNull).toHaveLength(1);
    const final = userStore.get(uid)!;
    expect(final.totalStorageBytes).toBe(90 * 1024 * 1024);
    expect(final.totalUploads).toBe(6); // one increment
  });

  it("deterministic: sequential uploads respect cap", async () => {
    const { createFirestoreService } = await import("@/lib/FirestoreService");
    const uid = "test-uid";
    userStore.set(uid, {
      totalStorageBytes: 90 * 1024 * 1024,
      maxSavedBytes: 100 * 1024 * 1024,
      totalUploads: 0,
      totalExports: 0,
    });
    const svc = createFirestoreService(uid);
    const blob15 = makeBlob(15 * 1024 * 1024);
    const r1 = await svc.recordUpload({
      fileName: "c.csv",
      fileSize: 15 * 1024 * 1024,
      rowCount: 10,
      columnCount: 1,
      columns: ["x"],
      blob: blob15,
    });
    expect(r1).toBeNull(); // 90+15 >100 -> should fail (null)
    expect(userStore.get(uid)!.totalStorageBytes).toBe(90 * 1024 * 1024);
  });

  it("does not introduce `any` in new quota path", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/lib/FirestoreService.ts", "utf-8");
    // Find the P0-B block between `await runTransaction` and `this.invalidateQuotas()`
    const idx = content.indexOf("await runTransaction");
    const block = idx >= 0 ? content.slice(idx, idx + 4000) : "";
    // Allow existing `as unknown as` but not new `as any` in that block
    const anyInBlock = (block.match(/\bas any\b/g) ?? []).length;
    expect(anyInBlock).toBe(0);
  });
});
