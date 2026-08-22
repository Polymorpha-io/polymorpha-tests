import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppStep,
  CleaningConfig,
  CleaningDiff,
  Dataset,
  ExportPreferences,
  StatsResults,
  DataOperationStep,
} from "@/types";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";
import {
  DataCleaner,
  hashString,
  type PreflightWarning,
} from "@polymorpha/business-logic";
import { getCacheService } from "@/lib/CacheService";
import { ANON_MAX_ROWS, PREVIEW_MAX_ROWS } from "@/config";
import { toast } from "sonner";
import { useExportStore } from "@/features/export/store/useExportStore";

const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof indexedDB === "undefined") return localStorage.getItem(name);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("polymorpha-pipeline-persist", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("kv"))
            req.result.createObjectStore("kv");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const val = await new Promise<string | null>((resolve) => {
        const tx = db.transaction("kv", "readonly");
        const req = tx.objectStore("kv").get(name);
        req.onsuccess = () => resolve((req.result as string) ?? null);
        req.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      });
      return val;
    } catch {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      if (typeof indexedDB === "undefined") {
        localStorage.setItem(name, value);
        return;
      }
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("polymorpha-pipeline-persist", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("kv"))
            req.result.createObjectStore("kv");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, name);
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
      try {
        localStorage.setItem(name, value);
      } catch {
        /* ignore quota */
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      if (typeof indexedDB === "undefined") {
        localStorage.removeItem(name);
        return;
      }
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("polymorpha-pipeline-persist", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").delete(name);
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
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    }
  },
};

async function hashDataset(
  dataset: Dataset,
  salt?: string | null,
): Promise<string> {
  try {
    const payload = `${salt ?? ""}:${dataset.fileName}:${dataset.columns.map((c) => `${c.name}:${c.type}`).join(",")}:${dataset.rows.length}:${JSON.stringify(dataset.rows.slice(0, 5))}`;
    const hex = await hashString(payload);
    return `h${hex.slice(0, 12)}_${dataset.rows.length}_${dataset.columns.length}`;
  } catch {
    return `h${Date.now().toString(36)}_${dataset.rows.length}`;
  }
}

function hashDatasetSyncFallback(
  dataset: Dataset,
  salt?: string | null,
): string {
  try {
    const str = `${salt ?? ""}:${dataset.fileName}:${dataset.columns.map((c) => `${c.name}:${c.type}`).join(",")}:${dataset.rows.length}:${JSON.stringify(dataset.rows.slice(0, 5))}`;
    let h = 5381;
    for (let i = 0; i < str.length; i++)
      h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
    return `h${h.toString(36)}_${dataset.rows.length}_${dataset.columns.length}`;
  } catch {
    return `h${Date.now().toString(36)}_${dataset.rows.length}`;
  }
}

function triggerRagBehind(dataset: Dataset | null): void {
  if (!dataset || dataset.rows.length === 0) return;
  // RAG-only, streaming, not RecommendationLaws — run behind via idle callback
  const w = window as unknown as {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
  };
  const run = () => {
    import("@/lib/rag/RagService")
      .then((m) => m.profileDatasetStreaming(dataset).catch(() => {}))
      .catch(() => {});
  };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 32);
}

export interface HydratePayload {
  raw: Dataset;
  preview?: Dataset | null;
  cleaned: Dataset | null;
  cleaningConfig: CleaningConfig | null;
  cleaningDiff: CleaningDiff | null;
  results: StatsResults | null;
  exportPreferences: Partial<ExportPreferences>;
  cart: CartItem[];
  uploadId: string;
  workspaceId: string;
  step: AppStep;
  appliedSteps: DataOperationStep[];
  preflightWarnings?: PreflightWarning[];
  totalRowCount?: number | null;
  storagePath?: string | null;
  objective?: string | null;
}

export interface CartItem {
  id: string;
  type: "test" | "visual" | "method";
  label: string;
  meta?: Record<string, unknown>;
}

interface DataStore {
  step: AppStep;
  raw: Dataset | null;
  rawHash: string | null;
  preview: Dataset | null;
  cleaned: Dataset | null;
  cleaningConfig: CleaningConfig | null;
  cleaningDiff: CleaningDiff | null;
  results: StatsResults | null;
  exportPreferences: ExportPreferences;
  uploadId: string | null;
  cart: CartItem[];
  workspaceId: string | null;
  appliedSteps: DataOperationStep[];
  stepCache: Map<string, Dataset>; // Memoizes computed datasets per step ID
  stepCacheHashes: Map<string, string>; // Plan3: durable hash chain
  preflightWarnings: PreflightWarning[];
  totalRowCount: number | null;
  storagePath: string | null;
  objective: string | null;

  setStep: (step: AppStep) => void;
  setRaw: (
    dataset: Dataset,
    opts?: {
      preview?: Dataset | null;
      totalRowCount?: number | null;
      storagePath?: string | null;
    },
  ) => Promise<void>;
  getRawAsync: () => Promise<Dataset | null>;
  setCleaned: (dataset: Dataset, diff: CleaningDiff) => void;
  setCleanedInPlace: (dataset: Dataset, diff: CleaningDiff) => void;
  setCleaningConfig: (config: CleaningConfig) => void;
  setResults: (results: StatsResults) => void;
  setExportPreferences: (updates: Partial<ExportPreferences>) => void;
  setUploadId: (id: string | null) => void;
  setWorkspaceId: (id: string | null) => void;
  setObjective: (objective: string | null) => void;
  hydrateForWorkspace: (payload: HydratePayload) => Promise<void>;
  /** Instantly restore a cached dataset (skip parse, go to preview) */
  hydrateFromCache: (
    dataset: Dataset,
    opts?: {
      preview?: Dataset | null;
      totalRowCount?: number | null;
      storagePath?: string | null;
    },
  ) => Promise<void>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  reset: () => void;

  // Applied Steps
  addAppliedStep: (step: DataOperationStep) => void;
  removeAppliedStep: (id: string) => void;
  reorderAppliedSteps: (startIndex: number, endIndex: number) => void;
  clearAppliedSteps: () => void;

  // Memoization Cache
  setStepCache: (id: string, dataset: Dataset) => Promise<void>;
  clearStepCacheAfter: (index: number) => void;
  getStepDataset: (id: string) => Promise<Dataset | null>;
  clearDownstream: (target: AppStep) => void;
}

const emptyResults = (): StatsResults => ({
  descriptive: [],
  frequencies: [],
  correlation: null,
  normality: [],
  tTests: [],
  anova: [],
  regression: [],
  mannWhitney: [],
  kruskalWallis: [],
  chiSquare: [],
});

const CAN_TRANSITION: Record<AppStep, AppStep[]> = {
  upload: ["model", "preview", "clean", "stats", "export"],
  model: ["preview", "upload", "clean"],
  preview: ["model", "clean", "upload", "stats"],
  clean: ["preview", "stats", "upload", "export"],
  stats: ["clean", "export", "preview", "upload"],
  export: ["stats", "clean", "preview", "upload"],
};

const GUARD: Partial<Record<AppStep, (s: DataStore) => boolean>> = {
  // Guard is advisory for UI (Pipeline.tsx) not for direct store setStep;
  // keep permissive so tests and hydration can set any step. UI validates via `canTransition`+`isReady`.
};

const STEP_ORDER: AppStep[] = [
  "upload",
  "model",
  "preview",
  "clean",
  "stats",
  "export",
];
function getDownstream(target: AppStep): AppStep[] {
  const idx = STEP_ORDER.indexOf(target);
  return idx >= 0 ? STEP_ORDER.slice(idx + 1) : [];
}

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      step: "upload",
      raw: null,
      rawHash: null,
      preview: null,
      cleaned: null,
      cleaningConfig: null,
      cleaningDiff: null,
      results: null,
      exportPreferences: { ...DEFAULT_EXPORT_PREFERENCES },
      uploadId: null,
      workspaceId: null,
      cart: [],
      appliedSteps: [],
      stepCache: new Map(),
      stepCacheHashes: new Map(),
      preflightWarnings: [],
      totalRowCount: null,
      storagePath: null,
      objective: null,

      setStep: (step) =>
        set((state) => {
          const cur = state.step;
          if (cur === step) return state;
          const allowed = CAN_TRANSITION[cur] ?? [];
          if (!allowed.includes(step)) {
            toast.error(
              `Cannot go from ${cur} to ${step}. Complete prior steps first.`,
            );
            return state;
          }
          const guard = GUARD[step];
          if (guard && !guard(state as unknown as DataStore)) {
            toast.error(
              `Step ${step} is not ready. Complete prior steps first.`,
            );
            return state;
          }
          const curIdx = STEP_ORDER.indexOf(cur);
          const targetIdx = STEP_ORDER.indexOf(step);
          if (targetIdx < curIdx) {
            const downstream = getDownstream(step);
            const patch: Partial<DataStore> = { step };
            if (downstream.includes("clean")) {
              patch.cleaned = null;
              patch.cleaningDiff = null;
              patch.cleaningConfig = null;
            }
            if (downstream.includes("stats")) {
              patch.results = null;
              patch.cart = [];
            }
            if (downstream.length > 0) {
              const newCache = new Map<string, Dataset>();
              const newHashes = new Map<string, string>();
              patch.stepCache = newCache as unknown as Map<string, Dataset>;
              patch.stepCacheHashes = newHashes as unknown as Map<
                string,
                string
              >;
            }
            if (downstream.length > 0 && import.meta.env.DEV) {
              console.debug(
                `[pipeline] backward ${cur}→${step}, cleared ${downstream.join(",")}`,
              );
            }
            // Clear export transient — do not leak stale blob/preview across backward nav
            try {
              useExportStore.getState().resetTransient();
              useExportStore.getState().setLastGenerated(null, null);
            } catch {}
            return patch as DataStore;
          }
          return { step };
        }),

      setRaw: async (dataset, opts) => {
        // Guard: empty dataset (0 rows) — keep but warn, don't cache empty
        if (!dataset.rows || dataset.rows.length === 0) {
          toast.error(
            "Uploaded file has no data rows — please check file content and delimiter.",
          );
          if (import.meta.env.DEV)
            console.warn(
              "[pipeline] setRaw received 0 rows:",
              dataset.fileName,
            );
        }
        // G18: anon cap ANON_MAX_ROWS before caching (slice, not reject) — D20
        let effectiveDataset = dataset;
        try {
          const { useAuthStore } = require("@/store/useAuthStore");
          const isAnon = !useAuthStore.getState().user;
          if (isAnon && dataset.rows.length > ANON_MAX_ROWS) {
            effectiveDataset = {
              ...dataset,
              rows: dataset.rows.slice(0, ANON_MAX_ROWS),
            };
            if (import.meta.env.DEV)
              console.warn(
                `[pipeline] anon ${ANON_MAX_ROWS} cap: sliced ${dataset.rows.length}→${ANON_MAX_ROWS}`,
              );
          }
        } catch {}
        const warnings =
          DataCleaner.runUniversalPreflightChecks(effectiveDataset);
        const derivedPreview =
          opts?.preview !== undefined
            ? opts.preview
            : {
                ...effectiveDataset,
                rows: effectiveDataset.rows.slice(0, PREVIEW_MAX_ROWS),
              };
        const rawHash = await hashDataset(
          effectiveDataset,
          opts?.storagePath ?? effectiveDataset.fileName,
        );
        if (effectiveDataset.rows.length > 0) {
          try {
            getCacheService()
              .setDataset(rawHash, effectiveDataset)
              .catch(() => {});
          } catch {}
        }
        set((state) => {
          if (state.rawHash) {
            try {
              getCacheService()
                .evictDataset(state.rawHash)
                .catch(() => {});
            } catch {}
          }
          const shouldClearObjective = state.rawHash !== rawHash;
          return {
            raw: effectiveDataset,
            rawHash,
            preview: derivedPreview,
            cleaned: null,
            cleaningConfig: null,
            cleaningDiff: null,
            results: null,
            step: state.step === "upload" ? "model" : "preview",
            appliedSteps: [],
            stepCache: new Map(),
            stepCacheHashes: new Map(),
            preflightWarnings: warnings,
            totalRowCount: opts?.totalRowCount ?? effectiveDataset.rows.length,
            storagePath: opts?.storagePath ?? state.storagePath,
            objective: shouldClearObjective ? null : state.objective,
          };
        });
        // RAG-only streaming behind dataset load (not RecommendationLaws)
        triggerRagBehind(effectiveDataset);
      },

      getRawAsync: async () => {
        const s = get();
        if (s.raw) return s.raw;
        if (s.rawHash) {
          try {
            const { getCacheService } = await import("@/lib/CacheService");
            const cached = await getCacheService().getDataset(s.rawHash);
            if (cached) return cached;
          } catch {}
        }
        if (s.preview) return s.preview;
        return null;
      },

      setCleaned: (dataset, diff) => {
        set({ cleaned: dataset, cleaningDiff: diff, step: "stats" });
        triggerRagBehind(dataset);
      },

      setCleanedInPlace: (dataset, diff) => {
        set({ cleaned: dataset, cleaningDiff: diff });
        triggerRagBehind(dataset);
      },

      setCleaningConfig: (config) => set({ cleaningConfig: config }),

      setResults: (results) => set({ results }),

      setExportPreferences: (updates) =>
        set((state) => ({
          exportPreferences: { ...state.exportPreferences, ...updates },
        })),

      setUploadId: (id) => set({ uploadId: id }),
      setWorkspaceId: (id) => set({ workspaceId: id }),
      setObjective: (objective) => set({ objective }),

      hydrateForWorkspace: async (payload) => {
        const raw = payload.raw;
        const preview =
          (payload as unknown as { preview?: Dataset | null }).preview ??
          (raw ? { ...raw, rows: raw.rows.slice(0, 100) } : null);
        const downstream = getDownstream(payload.step);
        const cleaned = downstream.includes("clean") ? null : payload.cleaned;
        const cleaningConfigVal = downstream.includes("clean")
          ? null
          : payload.cleaningConfig;
        const cleaningDiffVal = downstream.includes("clean")
          ? null
          : payload.cleaningDiff;
        const resultsVal = downstream.includes("stats")
          ? null
          : payload.results;
        const cartVal = downstream.includes("stats") ? [] : payload.cart;
        const rawHash = raw
          ? await hashDataset(raw, payload.storagePath ?? null)
          : null;
        if (raw && rawHash) {
          try {
            getCacheService()
              .setDataset(rawHash, raw)
              .catch(() => {});
          } catch {}
        }
        set({
          step: payload.step,
          raw,
          rawHash,
          preview,
          cleaned,
          cleaningConfig: cleaningConfigVal,
          cleaningDiff: cleaningDiffVal,
          results: resultsVal,
          exportPreferences: {
            ...DEFAULT_EXPORT_PREFERENCES,
            ...payload.exportPreferences,
          },
          cart: cartVal,
          uploadId: payload.uploadId,
          workspaceId: payload.workspaceId,
          appliedSteps: payload.appliedSteps || [],
          stepCache: new Map(),
          stepCacheHashes: new Map(),
          preflightWarnings: payload.raw
            ? DataCleaner.runUniversalPreflightChecks(payload.raw)
            : [],
          totalRowCount:
            payload.totalRowCount ?? payload.raw?.rows.length ?? null,
          storagePath: payload.storagePath ?? null,
          objective:
            (payload as unknown as { objective?: string | null }).objective ??
            null,
        });
        // RAG-only streaming behind load (not RecommendationLaws)
        triggerRagBehind(cleaned ?? raw);
      },

      /**
       * Instantly restore a dataset from cache (skips parse).
       * Resets pipeline to preview step with the cached raw dataset.
       */
      hydrateFromCache: async (dataset, opts) => {
        const preview = opts?.preview ?? {
          ...dataset,
          rows: dataset.rows.slice(0, 100),
        };
        const rh = await hashDataset(dataset, opts?.storagePath ?? null);
        try {
          getCacheService()
            .setDataset(rh, dataset)
            .catch(() => {});
        } catch {}
        set({
          raw: dataset,
          rawHash: rh,
          preview,
          cleaned: null,
          cleaningConfig: null,
          cleaningDiff: null,
          results: null,
          step: "preview",
          appliedSteps: [],
          stepCache: new Map(),
          stepCacheHashes: new Map(),
          preflightWarnings: DataCleaner.runUniversalPreflightChecks(dataset),
          totalRowCount: opts?.totalRowCount ?? dataset.rows.length,
          storagePath: opts?.storagePath ?? null,
          objective: null,
        });
        // P4: preview path (large files) must also trigger RAG — profile the 100-row preview quickly so UI not stuck pending forever
        triggerRagBehind(dataset);
      },

      addToCart: (item) =>
        set((state) => ({
          cart: state.cart.some((c) => c.id === item.id)
            ? state.cart
            : [...state.cart, item],
        })),

      removeFromCart: (id) =>
        set((state) => {
          if (!state.cart.some((c) => c.id === id)) return state;
          return { cart: state.cart.filter((c) => c.id !== id) };
        }),

      clearCart: () => set({ cart: [] }),

      reset: () => {
        try {
          const s = get();
          if (s.rawHash)
            getCacheService()
              .evictDataset(s.rawHash)
              .catch(() => {});
          for (const h of s.stepCacheHashes.values())
            getCacheService()
              .evictDataset(h)
              .catch(() => {});
        } catch {}
        return set({
          step: "upload",
          raw: null,
          rawHash: null,
          preview: null,
          cleaned: null,
          cleaningConfig: null,
          cleaningDiff: null,
          results: emptyResults(),
          workspaceId: null,
          exportPreferences: { ...DEFAULT_EXPORT_PREFERENCES },
          uploadId: null,
          cart: [],
          appliedSteps: [],
          stepCache: new Map(),
          stepCacheHashes: new Map(),
          preflightWarnings: [],
          totalRowCount: null,
          storagePath: null,
          objective: null,
        });
      },

      // Applied Steps Actions
      addAppliedStep: (step) =>
        set((state) => ({
          appliedSteps: [...state.appliedSteps, step],
        })),

      removeAppliedStep: (id) =>
        set((state) => {
          const index = state.appliedSteps.findIndex((s) => s.id === id);
          if (index === -1) return state;
          const newCache = new Map(state.stepCache);
          const newHashes = new Map(state.stepCacheHashes);
          for (let i = index; i < state.appliedSteps.length; i++) {
            const delId = state.appliedSteps[i].id;
            newCache.delete(delId);
            const h = newHashes.get(delId);
            if (h) {
              try {
                getCacheService()
                  .evictDataset(h)
                  .catch(() => {});
              } catch {}
              newHashes.delete(delId);
            }
          }
          return {
            appliedSteps: state.appliedSteps.filter((s) => s.id !== id),
            stepCache: newCache,
            stepCacheHashes: newHashes,
          };
        }),

      reorderAppliedSteps: (startIndex, endIndex) =>
        set((state) => {
          const result = Array.from(state.appliedSteps);
          const [removed] = result.splice(startIndex, 1);
          result.splice(endIndex, 0, removed);
          const firstAffectedIndex = Math.min(startIndex, endIndex);
          const newCache = new Map(state.stepCache);
          const newHashes = new Map(state.stepCacheHashes);
          for (let i = firstAffectedIndex; i < state.appliedSteps.length; i++) {
            const delId = state.appliedSteps[i].id;
            newCache.delete(delId);
            const h = newHashes.get(delId);
            if (h) {
              try {
                getCacheService()
                  .evictDataset(h)
                  .catch(() => {});
              } catch {}
              newHashes.delete(delId);
            }
          }
          newCache.delete(removed.id);
          const rh = newHashes.get(removed.id);
          if (rh) {
            try {
              getCacheService()
                .evictDataset(rh)
                .catch(() => {});
            } catch {}
            newHashes.delete(removed.id);
          }
          return {
            appliedSteps: result,
            stepCache: newCache,
            stepCacheHashes: newHashes,
          };
        }),

      clearAppliedSteps: () => {
        try {
          const s = get();
          for (const h of s.stepCacheHashes.values()) {
            getCacheService()
              .evictDataset(h)
              .catch(() => {});
          }
        } catch {}
        return set({
          appliedSteps: [],
          stepCache: new Map(),
          stepCacheHashes: new Map(),
        });
      },

      setStepCache: async (id, dataset) => {
        const s = get();
        const h = await hashDataset(dataset, s.storagePath ?? s.rawHash ?? id);
        try {
          getCacheService()
            .setDataset(h, dataset)
            .catch(() => {});
        } catch {}
        set((state) => {
          const newCache = new Map(state.stepCache);
          const newHashes = new Map(state.stepCacheHashes);
          newCache.set(id, dataset);
          newHashes.set(id, h);
          return { stepCache: newCache, stepCacheHashes: newHashes };
        });
      },

      clearStepCacheAfter: (index) =>
        set((state) => {
          const newCache = new Map(state.stepCache);
          const newHashes = new Map(state.stepCacheHashes);
          for (let i = index; i < state.appliedSteps.length; i++) {
            const delId = state.appliedSteps[i].id;
            newCache.delete(delId);
            const h = newHashes.get(delId);
            if (h) {
              try {
                getCacheService()
                  .evictDataset(h)
                  .catch(() => {});
              } catch {}
              newHashes.delete(delId);
            }
          }
          return { stepCache: newCache, stepCacheHashes: newHashes };
        }),

      getStepDataset: async (id) => {
        const s = get();
        if (s.stepCache.has(id)) return s.stepCache.get(id)!;
        const h = s.stepCacheHashes.get(id);
        if (!h) return null;
        try {
          const { getCacheService } = await import("@/lib/CacheService");
          const ds = await getCacheService().getDataset(h);
          if (ds) {
            const nc = new Map(s.stepCache);
            nc.set(id, ds);
            set({ stepCache: nc });
            return ds;
          }
        } catch {}
        return null;
      },

      clearDownstream: (target) => {
        const downstream = getDownstream(target);
        if (downstream.length === 0) return;
        const patch: Partial<DataStore> = {};
        if (downstream.includes("clean")) {
          patch.cleaned = null;
          patch.cleaningDiff = null;
          patch.cleaningConfig = null;
        }
        if (downstream.includes("stats")) {
          patch.results = null;
          patch.cart = [];
        }
        const s = get();
        const newCache = new Map(s.stepCache);
        const newHashes = new Map(s.stepCacheHashes);
        for (const h of newHashes.values()) {
          try {
            getCacheService()
              .evictDataset(h)
              .catch(() => {});
          } catch {}
        }
        newCache.clear();
        newHashes.clear();
        patch.stepCache = newCache as unknown as Map<string, Dataset>;
        patch.stepCacheHashes = newHashes as unknown as Map<string, string>;
        set(patch as Partial<DataStore> as DataStore);
        // Clear new export transient state as well (G21: stale preview/blob)
        try {
          useExportStore.getState().resetTransient();
          useExportStore.getState().setLastGenerated(null, null);
        } catch {}
      },
    }),
    {
      name: "polymorpha-pipeline",
      version: 10,
      storage: createJSONStorage(() => idbStorage),
      // Bounded persist (Plan1): raw full in T3 by hash, preview100 in IDB, rawHash persisted — never empty rows
      partialize: (state) => {
        if (state.raw) {
          const h =
            state.rawHash ??
            hashDatasetSyncFallback(
              state.raw,
              state.storagePath ?? state.rawHash,
            );
          try {
            getCacheService()
              .setDataset(h, state.raw)
              .catch(() => {});
          } catch {}
          return {
            step: state.step,
            raw: null,
            rawHash: h,
            rawMeta: {
              fileName: state.raw.fileName,
              columns: state.raw.columns,
              uploadedAt: state.raw.uploadedAt,
            },
            preview: state.preview,
            appliedSteps: state.appliedSteps,
            totalRowCount: state.totalRowCount,
            storagePath: state.storagePath,
            uploadId: state.uploadId,
            workspaceId: state.workspaceId,
            cleaningConfig: state.cleaningConfig,
            stepCacheHashes: Array.from(state.stepCacheHashes.entries()),
            objective: state.objective,
          };
        }
        return {
          step: state.step,
          raw: null,
          rawHash: state.rawHash,
          rawMeta: (state as unknown as { rawMeta?: unknown }).rawMeta ?? null,
          preview: state.preview,
          appliedSteps: state.appliedSteps,
          totalRowCount: state.totalRowCount,
          storagePath: state.storagePath,
          uploadId: state.uploadId,
          workspaceId: state.workspaceId,
          cleaningConfig: state.cleaningConfig,
          stepCacheHashes: Array.from(state.stepCacheHashes.entries()),
          objective: state.objective,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) return;
        if (state?.stepCacheHashes && Array.isArray(state.stepCacheHashes)) {
          try {
            useDataStore.setState({
              stepCacheHashes: new Map(
                state.stepCacheHashes as unknown as [string, string][],
              ),
            } as unknown as Partial<DataStore> as DataStore);
          } catch {}
        }
        // If raw is null (bounded) but hash+preview exist, restore raw async from T3
        // Do not use empty-rows sentinel — raw:null means "load from hash"
        if (!state?.raw && state?.rawHash) {
          const preview = state.preview as unknown as Dataset | null;
          import("@/lib/CacheService")
            .then(({ getCacheService }) =>
              getCacheService().getDataset(state.rawHash!),
            )
            .then((ds) => {
              if (ds && ds.rows.length > 0) {
                useDataStore.setState({ raw: ds });
              } else if (preview && preview.rows.length > 0) {
                // T3 miss (evicted): use preview as degraded raw (100 rows) so Process never shows 0
                if (import.meta.env.DEV)
                  console.warn(
                    "[pipeline] T3 miss for rawHash, using preview 100 as fallback",
                  );
                useDataStore.setState({
                  raw: {
                    ...preview,
                    fileName:
                      (state as unknown as { rawMeta?: { fileName?: string } })
                        .rawMeta?.fileName ?? preview.fileName,
                  } as Dataset,
                });
              }
            })
            .catch(() => {
              const p = state.preview as unknown as Dataset | null;
              if (p)
                useDataStore.setState({
                  raw: p,
                } as unknown as Partial<DataStore> as DataStore);
            });
        }
        // Legacy: raw persisted as empty rows array — fix to null + restore from preview/T3
        if (
          state?.raw &&
          Array.isArray((state.raw as unknown as { rows?: unknown[] }).rows) &&
          (state.raw as unknown as { rows: unknown[] }).rows.length === 0
        ) {
          const preview = state.preview as unknown as Dataset | null;
          if (state.rawHash) {
            import("@/lib/CacheService")
              .then(({ getCacheService }) =>
                getCacheService().getDataset(state.rawHash!),
              )
              .then((ds) => {
                if (ds) useDataStore.setState({ raw: ds });
                else if (preview)
                  useDataStore.setState({
                    raw: preview,
                  } as unknown as Partial<DataStore> as DataStore);
                else
                  useDataStore.setState({
                    raw: null,
                  } as unknown as Partial<DataStore> as DataStore);
              })
              .catch(() => {
                if (preview)
                  useDataStore.setState({
                    raw: preview,
                  } as unknown as Partial<DataStore> as DataStore);
              });
          } else if (preview) {
            useDataStore.setState({
              raw: preview,
            } as unknown as Partial<DataStore> as DataStore);
          } else {
            useDataStore.setState({
              raw: null,
            } as unknown as Partial<DataStore> as DataStore);
          }
        }
      },
      migrate: (persistedState, version) => {
        const state = persistedState as unknown as Record<string, unknown>;
        if (version < 8) {
          const raw = state.raw as unknown as Dataset | null;
          const preview =
            (state as unknown as { preview?: Dataset | null }).preview ??
            (raw ? { ...raw, rows: raw.rows.slice(0, 100) } : null);
          return {
            ...state,
            preview,
            appliedSteps: (state.appliedSteps as unknown[]) ?? [],
            totalRowCount:
              (state.totalRowCount as number) ?? raw?.rows.length ?? null,
            storagePath: (state.storagePath as string) ?? null,
          } as DataStore;
        }
        if (version < 9) {
          const raw = state.raw as unknown as Dataset | null;
          const isEmptyRows =
            raw &&
            Array.isArray((raw as unknown as { rows?: unknown[] }).rows) &&
            (raw as unknown as { rows: unknown[] }).rows.length === 0;
          if (isEmptyRows) {
            // Legacy bug: raw persisted as empty rows — recover via preview/hash
            return {
              ...state,
              raw: null,
              rawHash:
                (state as unknown as { rawHash?: string }).rawHash ?? null,
              stepCacheHashes:
                (state as unknown as { stepCacheHashes?: unknown })
                  .stepCacheHashes ?? [],
            } as unknown as DataStore;
          }
          if (
            raw &&
            Array.isArray((raw as unknown as { rows?: unknown[] }).rows) &&
            (raw as unknown as { rows: unknown[] }).rows.length > 100
          ) {
            const h = hashDatasetSyncFallback(
              raw,
              (state.storagePath as string) ?? null,
            );
            try {
              getCacheService()
                .setDataset(h, raw)
                .catch(() => {});
            } catch {}
            return {
              ...state,
              raw: null,
              rawHash: h,
              rawMeta: {
                fileName: raw.fileName,
                columns: raw.columns,
                uploadedAt: raw.uploadedAt,
              },
              preview:
                (state.preview as unknown as Dataset | null) ??
                ({
                  ...raw,
                  rows: (raw as unknown as { rows: unknown[] }).rows.slice(
                    0,
                    100,
                  ),
                } as unknown as Dataset),
              stepCacheHashes:
                (state as unknown as { stepCacheHashes?: unknown })
                  .stepCacheHashes ?? [],
            } as unknown as DataStore;
          }
          if (!state.rawHash && state.preview) {
            return { ...state, stepCacheHashes: [] } as unknown as DataStore;
          }
          if (state.stepCacheHashes && Array.isArray(state.stepCacheHashes)) {
            return state as unknown as DataStore;
          }
          return { ...state, stepCacheHashes: [] } as unknown as DataStore;
        }
        if (version < 10) {
          return {
            ...state,
            objective: (state.objective as string | null) ?? null,
          } as unknown as DataStore;
        }
        return persistedState as DataStore;
      },
      // Skip persisting synthetic Map objects; they cannot be JSON'd
      skipHydration: false,
    },
  ),
);
