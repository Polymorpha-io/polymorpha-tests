/**
 * Lightweight cache layer for WorkspaceService — shim to CacheService (Plan2).
 * Deprecated: import from "./CacheService" directly. This file re-exports for compat.
 * One release shim per G18 global scale — do not add new logic here.
 */
import { getCacheService, CACHE_TTL as CS_TTL } from "./CacheService";

export const CACHE_TTL = CS_TTL;

// One-time cleaner for old polymorpha_cache: keys (migration from Plan2)
try {
  const ss = typeof window !== "undefined" ? window.sessionStorage : null;
  if (ss) {
    const olds: string[] = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k?.startsWith("polymorpha_cache:")) olds.push(k);
    }
    for (const k of olds) ss.removeItem(k);
  }
} catch {}

const svc = getCacheService();

export const workspaceCache = {
  get<T>(uid: string, scope: string, id?: string): T | undefined {
    if (import.meta.env.DEV) console.debug("[cache shim] get", uid, scope, id);
    const v = svc.get<T>(uid, scope, id);
    return v ?? undefined;
  },
  set<T>(
    uid: string,
    scope: string,
    data: T,
    ttlMs: number,
    id?: string,
  ): void {
    svc.set(uid, scope, data, ttlMs, id);
  },
  invalidate(uid: string, scope: string, id?: string): void {
    svc.invalidate(uid, scope, id);
  },
  invalidateScope(uid: string, scope: string): void {
    svc.invalidateScope(uid, scope);
  },
  inflight: (svc as unknown as { inflight: Map<string, Promise<unknown>> })
    .inflight,
  async swr<T>(
    uid: string,
    scope: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    id?: string,
  ): Promise<T> {
    return svc.swr(uid, scope, fetcher, ttlMs, id);
  },
};
