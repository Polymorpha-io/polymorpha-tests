/**
 * CacheService — Multi-tier caching for Polymorpha.
 *
 * Tiers:
 *   T1: In-memory LRU (instant, cleared on tab close)
 *   T2: SessionStorage (sync, 5MB browser limit, cleared on tab close)
 *   T3: IndexedDB (async, 50MB app cap, persists across sessions)
 *
 * Eviction: LRU when T3 exceeds 50MB. All tiers cleared on logout.
 */

import type { Dataset } from "@/types";
import { MAX_MEM_ENTRIES, MAX_SESSION_KEYS, MAX_T3_BYTES } from "@/config";

// Constants

/** Increment on breaking cache schema changes */
const CACHE_VERSION = 1;

/** IndexedDB database name */
const DB_NAME = "polymorpha-cache";

/** Object store name for datasets (T3) */
const STORE_DATASETS = "datasets";

/** Object store name for blobs (T3) */
const STORE_BLOBS = "blobs";

/** TTLs (mirrors cache.ts CACHE_TTL, now canonical) */
export const CACHE_TTL = {
  workspaceList: 30_000,
  workspace: 60_000,
  datasets: 30_000,
  exports: 30_000,
  events: 15_000,
  quota: 30_000,
  pipeline: 60_000,
} as const;

// SessionStorage helpers (T2)

interface SessionEntry<T> {
  value: T;
  expiresAt: number; // timestamp ms, 0 = no expiry
}

function getSS(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// IndexedDB helpers (T3)

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, CACHE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DATASETS)) {
        db.createObjectStore(STORE_DATASETS);
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => {
        const entry = req.result as { v: T; ts: number } | undefined;
        resolve(entry?.v ?? null);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(
  storeName: string,
  key: string,
  value: T,
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put({ v: value, ts: Date.now() }, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently skip if IndexedDB is unavailable
  }
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

// LRU In-Memory Cache (T1)

interface MemEntry<T> {
  value: T;
  lastAccess: number;
}

const memStore = new Map<string, MemEntry<unknown>>();

// Unified cache helpers (Plan2: single source for workspaceCache + CacheService)
function cacheKey(uid: string, scope: string, id?: string): string {
  return id ? `${uid}:${scope}:${id}` : `${uid}:${scope}`;
}
const invalidatedKeys = new Set<string>();
const inflight = new Map<string, Promise<unknown>>();
const INVALIDATE_KEY = "polymorpha_cache_invalidate";
function broadcastInvalidation(k: string): void {
  try {
    localStorage.setItem(
      INVALIDATE_KEY,
      JSON.stringify({ key: k, time: Date.now() }),
    );
  } catch {}
}
function setupCrossTabInvalidation(): void {
  try {
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key !== INVALIDATE_KEY || !e.newValue) return;
      try {
        const { key: k } = JSON.parse(e.newValue);
        if (k) {
          for (const memKey of Array.from(memStore.keys())) {
            if (memKey === k || memKey.startsWith(k)) memStore.delete(memKey);
          }
          invalidatedKeys.add(k);
        }
      } catch {}
    });
  } catch {}
}
try {
  setupCrossTabInvalidation();
} catch {}
function sessionDeletePrefix(prefix: string): void {
  const ss = getSS();
  if (!ss) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ss.length; i++) {
      const k = ss.key(i);
      if (k?.startsWith(`p:${prefix}`)) keys.push(k);
    }
    for (const k of keys) ss.removeItem(k);
  } catch {}
}
async function idbDeletePrefix(
  storeName: string,
  prefix: string,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const key = cursor.key as string;
          if (key === prefix || key.startsWith(prefix)) cursor.delete();
          cursor.continue();
        } else resolve();
      };
      req.onerror = () => resolve();
    });
    db.close();
  } catch {}
}

// Service

export class CacheService {
  // T2: SessionStorage

  getSession<T>(key: string): T | null {
    const ss = getSS();
    if (!ss) return null;
    try {
      const raw = ss.getItem(`p:${key}`);
      if (!raw) return null;
      const entry = JSON.parse(raw) as SessionEntry<T>;
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        ss.removeItem(`p:${key}`);
        return null;
      }
      return entry.value;
    } catch {
      return null;
    }
  }

  setSession<T>(key: string, value: T, ttlMs?: number): void {
    const ss = getSS();
    if (!ss) return;
    try {
      if (ss.length >= MAX_SESSION_KEYS && !ss.getItem(`p:${key}`)) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (!k?.startsWith("p:")) continue;
          try {
            const e = JSON.parse(ss.getItem(k)!) as SessionEntry<unknown>;
            const t = e.expiresAt || 0;
            if (t < oldestTime) {
              oldestTime = t;
              oldestKey = k;
            }
          } catch {
            oldestKey = k;
            break;
          }
        }
        if (oldestKey) ss.removeItem(oldestKey);
      }
      const entry: SessionEntry<T> = {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : 0,
      };
      ss.setItem(`p:${key}`, JSON.stringify(entry));
    } catch {
      // SessionStorage full — silently skip
    }
  }

  removeSession(key: string): void {
    const ss = getSS();
    if (!ss) return;
    try {
      ss.removeItem(`p:${key}`);
    } catch {
      // ignore
    }
  }

  // T1: In-Memory LRU

  getMem<T>(key: string): T | null {
    const entry = memStore.get(key) as MemEntry<T> | undefined;
    if (!entry) return null;
    entry.lastAccess = Date.now();
    return entry.value;
  }

  setMem<T>(key: string, value: T): void {
    // LRU eviction: if at capacity, remove least recently accessed
    if (memStore.size >= MAX_MEM_ENTRIES && !memStore.has(key)) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, e] of memStore) {
        if (e.lastAccess < oldestTime) {
          oldestTime = e.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) memStore.delete(oldestKey);
    }
    memStore.set(key, { value, lastAccess: Date.now() } as MemEntry<unknown>);
  }

  removeMem(key: string): void {
    memStore.delete(key);
  }

  // T3: IndexedDB — Dataset cache (keyed by content hash)

  async getDataset(hash: string): Promise<Dataset | null> {
    return idbGet<Dataset>(STORE_DATASETS, hash);
  }

  async setDataset(hash: string, dataset: Dataset): Promise<void> {
    await this._evictIfNeeded();
    await idbSet(STORE_DATASETS, hash, dataset);
  }

  async evictDataset(hash: string): Promise<void> {
    await idbDelete(STORE_DATASETS, hash);
  }

  // T3: IndexedDB — Blob cache (keyed by content hash)

  async getBlob(hash: string): Promise<Blob | null> {
    return idbGet<Blob>(STORE_BLOBS, hash);
  }

  async setBlob(hash: string, blob: Blob): Promise<void> {
    await this._evictIfNeeded();
    await idbSet(STORE_BLOBS, hash, blob);
  }

  async evictBlob(hash: string): Promise<void> {
    await idbDelete(STORE_BLOBS, hash);
  }

  // Housekeeping

  /** Estimate total IndexedDB usage in bytes — sums our stores, not entire origin */
  async getTotalCacheSize(): Promise<number> {
    try {
      const db = await openDB();
      let total = 0;
      for (const storeName of [STORE_DATASETS, STORE_BLOBS] as const) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              const val = cursor.value as { v: unknown; ts: number };
              try {
                if (val.v instanceof Blob) {
                  total += (val.v as Blob).size;
                } else {
                  // G21: use actual Blob.size via serialized byte length, not rows*200 heuristic
                  total += new Blob([JSON.stringify(val.v)]).size;
                }
              } catch {
                total += 1024;
              }
              cursor.continue();
            } else resolve();
          };
          req.onerror = () => resolve();
        });
      }
      db.close();
      if (total > 0) return total;
      // Fallback to estimate if our sum is 0 (empty stores)
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.usage) return estimate.usage;
    } catch {
      // ignore
    }
    return 0;
  }

  /** Evict oldest entries until size < keepBytes (true LRU, not delete-all) */
  async evictLRU(keepBytes: number): Promise<void> {
    try {
      const db = await openDB();
      const stores = [STORE_DATASETS, STORE_BLOBS] as const;
      const target = Math.floor(keepBytes * 0.5);
      for (const storeName of stores) {
        const entries: Array<{ key: string; ts: number; size: number }> = [];
        await new Promise<void>((resolve) => {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              const v = cursor.value as { v: unknown; ts: number };
              let size = 1024;
              try {
                if (v.v instanceof Blob) size = (v.v as Blob).size;
                else size = new Blob([JSON.stringify(v.v)]).size;
              } catch {
                size = 1024;
              }
              entries.push({
                key: cursor.key as string,
                ts: v.ts ?? 0,
                size,
              });
              cursor.continue();
            } else resolve();
          };
          req.onerror = () => resolve();
        });
        entries.sort((a, b) => a.ts - b.ts);
        let total = entries.reduce((s, e) => s + e.size, 0);
        if (total <= target) continue;
        const delTx = db.transaction(storeName, "readwrite");
        const delStore = delTx.objectStore(storeName);
        for (const entry of entries) {
          if (total <= target) break;
          delStore.delete(entry.key);
          total -= entry.size;
        }
        await new Promise<void>((resolve) => {
          delTx.oncomplete = () => resolve();
          delTx.onerror = () => resolve();
        });
      }
      db.close();
    } catch {
      // ignore
    }
  }

  /** Clear all caches (on logout) */
  async clearAll(): Promise<void> {
    // Clear T1
    memStore.clear();

    // Clear T2
    try {
      const ss = getSS();
      if (ss) {
        const keys: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k?.startsWith("p:")) keys.push(k);
        }
        for (const k of keys) ss.removeItem(k);
      }
    } catch {
      // ignore
    }

    // Clear T3
    try {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // don't block on this
      });
    } catch {
      // ignore
    }
  }

  // Unified scoped API (Plan2: single source)
  get<T>(uid: string, scope: string, id?: string): T | null {
    const k = cacheKey(uid, scope, id);
    if (
      invalidatedKeys.has(k) ||
      Array.from(invalidatedKeys).some((p) => k.startsWith(p))
    )
      return null;
    const mem = this.getMem<T>(k);
    if (mem !== null) return mem;
    return this.getSession<T>(k);
  }

  set<T>(
    uid: string,
    scope: string,
    data: T,
    ttlMs: number,
    id?: string,
  ): void {
    const k = cacheKey(uid, scope, id);
    this.setMem(k, data);
    this.setSession(k, data, ttlMs);
    invalidatedKeys.delete(k);
    for (const p of Array.from(invalidatedKeys))
      if (k.startsWith(p)) invalidatedKeys.delete(p);
  }

  invalidate(uid: string, scope: string, id?: string): void {
    const k = cacheKey(uid, scope, id);
    this.removeMem(k);
    this.removeSession(k);
    idbDelete(STORE_DATASETS, k).catch(() => {});
    idbDelete(STORE_BLOBS, k).catch(() => {});
    invalidatedKeys.add(k);
    broadcastInvalidation(k);
  }

  invalidateScope(uid: string, scope: string): void {
    const prefix = cacheKey(uid, scope);
    for (const mk of Array.from(memStore.keys()))
      if (mk === prefix || mk.startsWith(prefix + ":")) memStore.delete(mk);
    sessionDeletePrefix(prefix);
    idbDeletePrefix(STORE_DATASETS, prefix).catch(() => {});
    idbDeletePrefix(STORE_BLOBS, prefix).catch(() => {});
    invalidatedKeys.add(prefix);
    broadcastInvalidation(prefix);
  }

  inflight = inflight;

  async swr<T>(
    uid: string,
    scope: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    id?: string,
  ): Promise<T> {
    const k = cacheKey(uid, scope, id);
    if (this.inflight.has(k)) {
      const pending = this.inflight.get(k) as Promise<T>;
      const cached = this.get<T>(uid, scope, id);
      if (cached !== null) return cached;
      return pending;
    }
    const cached = this.get<T>(uid, scope, id);
    if (
      cached !== null &&
      !invalidatedKeys.has(k) &&
      !Array.from(invalidatedKeys).some((p) => k.startsWith(p))
    ) {
      const p = fetcher()
        .then((fresh) => this.set(uid, scope, fresh, ttlMs, id))
        .catch(() => {})
        .finally(() => this.inflight.delete(k));
      this.inflight.set(k, p as Promise<unknown>);
      return cached;
    }
    const promise = fetcher()
      .then((fresh) => {
        this.set(uid, scope, fresh, ttlMs, id);
        return fresh;
      })
      .finally(() => this.inflight.delete(k));
    this.inflight.set(k, promise as Promise<unknown>);
    return (await promise) as T;
  }

  // Internal

  private async _evictIfNeeded(): Promise<void> {
    const size = await this.getTotalCacheSize();
    if (size > MAX_T3_BYTES * 0.8) {
      await this.evictLRU(MAX_T3_BYTES * 0.5);
    }
  }
}

// Singleton

let _instance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!_instance) {
    _instance = new CacheService();
  }
  return _instance;
}
