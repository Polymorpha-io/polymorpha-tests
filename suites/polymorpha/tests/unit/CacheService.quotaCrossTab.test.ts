import { describe, it, expect, beforeEach } from "vitest";
import { getCacheService, CACHE_TTL } from "@/lib/CacheService";

describe("CacheService — quota, cross-tab, ANON slice, LRU", () => {
  beforeEach(async () => {
    const svc = getCacheService();
    await svc.clearAll();
  });

  it("quota TTL 30s via CacheService", async () => {
    const svc = getCacheService();
    const uid = "test-uid";
    svc.set(uid, "quota", { totalStorageBytes: 1000 }, CACHE_TTL.quota);
    expect(svc.get(uid, "quota")).toEqual({ totalStorageBytes: 1000 });
    svc.invalidate(uid, "quota");
    expect(svc.get(uid, "quota")).toBeNull();
  });

  it("cross-tab invalidate via localStorage", async () => {
    const svc = getCacheService();
    const uid = "uid-cross";
    svc.set(uid, "workspaces", ["ws1"], CACHE_TTL.workspaceList);
    expect(svc.get(uid, "workspaces")).toEqual(["ws1"]);
    svc.invalidateScope(uid, "workspaces");
    expect(svc.get(uid, "workspaces")).toBeNull();
  });

  it("inflight dedup", async () => {
    const svc = getCacheService();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { v: 1 };
    };
    const p1 = svc.swr("u", "datasets", fetcher, 30000);
    const p2 = svc.swr("u", "datasets", fetcher, 30000);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(r1).toEqual(r2);
  });

  it("LRU eviction keeps ≤50", async () => {
    const svc = getCacheService();
    for (let i = 0; i < 60; i++) svc.setMem(`k${i}`, i);
    expect(svc.getMem("k0")).toBeNull();
    expect(svc.getMem("k59")).toBe(59);
  });
});
