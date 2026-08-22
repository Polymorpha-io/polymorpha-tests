// src/hooks/useLoadWorkspaceDataset.ts
import { useCallback } from "react";
import { useDataStore } from "@/store/useDataStore";
import { detectColumnTypes, determineTargetStep } from "@/lib/workspace";
import {
  applyCleaningConfig,
  buildDefaultConfig,
  normalizeCleaningConfig,
} from "@polymorpha/business-logic";
import { callParseApi, callCleanApi } from "@/lib/stats/api";
import { fetchApiAndConvertToCsv } from "@/lib/apiIngestion";
import { getCacheService } from "@/lib/CacheService";
import { workspaceCache } from "@/lib/cache";
import { analytics } from "@/lib/Analytics";
import { useExportStore } from "@/features/export/store/useExportStore";
import type {
  CleaningConfig,
  CleaningDiff,
  Dataset,
  StatsResults,
  DataOperationStep,
} from "@/types";

import {
  DYNAMIC_SYNC_TTL_MS,
  PREVIEW_MAX_ROWS,
  PREVIEW_ROW_THRESHOLD,
} from "@/config";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function extractAppliedSteps(state: unknown): DataOperationStep[] {
  if (!isRecord(state)) return [];
  const steps = (state as UnknownRecord).appliedSteps;
  return Array.isArray(steps) ? (steps as DataOperationStep[]) : [];
}

/** Perf instrumentation for the open-dataset flow (DEV console only). */
function markDatasetOpen(phase: string, uploadId: string): void {
  if (!import.meta.env.DEV) return;
  try {
    performance.mark(`dataset-open:${phase}:${uploadId}`);
  } catch {
    /* Performance API unavailable — non-critical */
  }
}

/** Report open-dataset timing to the tracking beacon (server-side analytics). */
function trackOpen(
  path: "cache" | "parse" | "preview",
  startMs: number,
  uploadId: string,
  extra: Record<string, unknown> = {},
): void {
  analytics.track("workspace-open", {
    path,
    totalMs: Math.round(performance.now() - startMs),
    uploadId,
    ...extra,
  });
}

/**
 * Hook to load a dataset for a workspace, hydrate the global store, and optionally
 * run cleaning automatically when resuming at the stats or export step.
 *
 * Loading strategy (fastest first):
 *  1. IndexedDB dataset cache hit (keyed by contentHash) — skips /parse + /clean.
 *  2. Large files: 1000-row preview hydrates immediately, full parse in background.
 *  3. Small files / no hash: single synchronous /parse (then /clean if resuming).
 */
export function useLoadWorkspaceDataset(
  workspaceId: string | undefined,
  service: ReturnType<
    typeof import("@/lib/WorkspaceService").createWorkspaceService
  > | null,
) {
  const hydrateForWorkspace = useDataStore((s) => s.hydrateForWorkspace);
  const hydrateFromCache = useDataStore((s) => s.hydrateFromCache);

  const loadDataset = useCallback(
    async (targetUploadId: string) => {
      if (!service || !workspaceId) return;
      markDatasetOpen("start", targetUploadId);
      const t0 = performance.now();
      try {
        // Get upload metadata (storagePath, fileName) from Firestore
        const meta = await service.getUploadMeta(workspaceId, targetUploadId);
        markDatasetOpen("meta", targetUploadId);
        const metaMs = Math.round(performance.now() - t0);

        if (!meta) {
          // Fallback: try old client-side openDataset for datasets with no storageRef
          const fallback = await service.openDataset(
            workspaceId,
            targetUploadId,
          );
          if (!fallback)
            throw new Error(
              "Dataset not found. Try removing and re-uploading.",
            );
          const fbColumns = detectColumnTypes(
            fallback.dataset.raw,
            fallback.dataset.headers,
          );
          const fbRaw: Dataset = {
            columns: fbColumns,
            rows: fallback.dataset.raw as Record<string, unknown>[],
            fileName: fallback.dataset.fileName,
            uploadedAt: new Date(),
          };
          const fbStep = determineTargetStep(fallback.state);
          const fbCfg = fallback.state?.cleaningConfig ?? null;
          const fbNorm = fbCfg
            ? normalizeCleaningConfig(fbCfg, buildDefaultConfig(fbRaw))
            : null;
          let fbClean: Dataset | null = null;
          let fbDiff: CleaningDiff | null = (fallback.state?.cleaningDiff ??
            null) as CleaningDiff | null;
          if ((fbStep === "stats" || fbStep === "export") && fbNorm) {
            const cr = applyCleaningConfig(fbRaw, fbNorm);
            fbClean = cr.dataset;
            fbDiff = cr.diff;
          }
          await hydrateForWorkspace({
            raw: fbRaw,
            cleaned: fbClean,
            cleaningConfig: fbNorm as CleaningConfig | null,
            cleaningDiff: fbDiff,
            results: (fallback.state?.results ?? null) as StatsResults | null,
            exportPreferences: (fallback.state?.exportPreferences ??
              {}) as Record<string, unknown>,
            cart: Array.isArray(fallback.state?.cart)
              ? fallback.state.cart
              : [],
            uploadId: targetUploadId,
            workspaceId,
            step: fbStep,
            appliedSteps: extractAppliedSteps(fallback.state),
          });
          try {
            const fbExp = (
              fallback.state as unknown as { exportState?: unknown }
            )?.exportState as
              | {
                  format?: string;
                  preset?: string;
                  preferences?: Record<string, unknown>;
                  datasetName?: string;
                  includedVisualKeys?: string[];
                }
              | undefined;
            if (fbExp) {
              useExportStore.getState().hydrate({
                format: (fbExp.format as never) ?? "pdf",
                preset: (fbExp.preset as never) ?? "standard",
                preferences: fbExp.preferences as never,
                datasetName: fbExp.datasetName ?? "",
                includedVisualKeys: fbExp.includedVisualKeys ?? [],
              });
            }
          } catch {}
          return;
        }

        // Auto-sync dynamic datasets, but only after the TTL has elapsed
        if (meta.updateMode === "dynamic" && meta.apiUrl && meta.storagePath) {
          const lastSync = workspaceCache.get<number>(
            service.uid,
            "dynamicSync",
            targetUploadId,
          );
          if (!lastSync || Date.now() - lastSync > DYNAMIC_SYNC_TTL_MS) {
            try {
              const apiFile = await fetchApiAndConvertToCsv(meta.apiUrl);
              const { getStorage, ref, uploadBytes } =
                await import("firebase/storage");
              const storage = getStorage();
              await uploadBytes(ref(storage, meta.storagePath), apiFile);
              workspaceCache.set(
                service.uid,
                "dynamicSync",
                Date.now(),
                DYNAMIC_SYNC_TTL_MS,
                targetUploadId,
              );
              console.log("Dynamic dataset updated successfully.");
            } catch (err) {
              console.error("Failed to sync dynamic dataset:", err);
              // We proceed with the existing storage data if the sync fails
            }
          }
        }

        const cacheService = getCacheService();

        // IndexedDB cache hit — skip /parse (and /clean) entirely.
        // Cleaning is applied client-side via business-logic, exactly like the
        // legacy fallback path above.
        if (meta.contentHash) {
          const cached = await cacheService.getDataset(meta.contentHash);
          if (cached) {
            markDatasetOpen("cache-hit", targetUploadId);
            await hydrateFromState(cached, targetUploadId, {
              clientClean: true,
              storagePath: meta.storagePath,
              contentHash: meta.contentHash,
              totalRowCount: meta.rowCount ?? cached.rows.length,
            });
            trackOpen("cache", t0, targetUploadId, { metaMs });
            return;
          }
        }

        const fullLoad = async (): Promise<void> => {
          // Parse via Python backend (handles gzip, CSV/XLSX, column type detection)
          const parsed = await callParseApi(
            meta.storagePath,
            undefined,
            undefined,
            meta.contentHash,
          );

          const columns = parsed.columnTypes as Dataset["columns"];
          const raw: Dataset = {
            columns,
            rows: parsed.rows,
            fileName: parsed.fileName,
            uploadedAt: new Date(),
          };

          // Cache parsed dataset in IndexedDB for instant re-opens (fire-and-forget)
          // For large files we only cache the preview slice; full is on Storage.
          const cacheRows =
            raw.rows.length > PREVIEW_MAX_ROWS
              ? { ...raw, rows: raw.rows.slice(0, PREVIEW_MAX_ROWS) }
              : raw;
          if (meta.contentHash) {
            cacheService
              .setDataset(meta.contentHash, cacheRows)
              .catch(() => {});
          }

          await hydrateFromState(raw, targetUploadId, {
            storagePath: meta.storagePath,
            contentHash: meta.contentHash,
            totalRowCount: parsed.rowCount ?? raw.rows.length,
          });
          markDatasetOpen("hydrated", targetUploadId);
          trackOpen("parse", t0, targetUploadId, { metaMs });
        };

        // Large files: render a 100-row preview immediately, parse fully in background
        // `meta.rowCount` may be stale (50) for old uploads — treat any file with a storagePath as potentially large
        const rowCountForGate = meta.rowCount ?? 0;
        const isLarge =
          rowCountForGate > PREVIEW_ROW_THRESHOLD ||
          rowCountForGate === 50 ||
          rowCountForGate === 100;
        // Always do preview+background for files that have a storagePath; small files will just get the preview fast
        const shouldPreview =
          !!meta.storagePath && (isLarge || rowCountForGate > PREVIEW_MAX_ROWS);
        if (shouldPreview) {
          try {
            const preview = await callParseApi(
              meta.storagePath,
              PREVIEW_MAX_ROWS,
              undefined,
              meta.contentHash,
            );
            await hydrateFromCache(
              {
                columns: preview.columnTypes as Dataset["columns"],
                rows: preview.rows as Dataset["rows"],
                fileName: preview.fileName,
                uploadedAt: new Date(),
              },
              {
                totalRowCount: preview.rowCount ?? rowCountForGate,
                storagePath: meta.storagePath,
              },
            );
            trackOpen("preview", t0, targetUploadId, { metaMs });
            void fullLoad().catch((err) => {
              console.error("Background full dataset load failed:", err);
            });
            return;
          } catch {
            // Preview failed — fall through to the synchronous full load
          }
        }

        await fullLoad();
      } catch (err) {
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, workspaceId, hydrateForWorkspace, hydrateFromCache],
  );

  /** Load saved state, apply cleaning if resuming at stats/export, hydrate store. */
  const hydrateFromState = async (
    raw: Dataset,
    targetUploadId: string,
    opts: {
      clientClean?: boolean;
      storagePath?: string;
      contentHash?: string;
      totalRowCount?: number | null;
    } = {},
  ): Promise<void> => {
    if (!service || !workspaceId) return;

    // Load saved state
    const state = await service.loadState(workspaceId, targetUploadId);
    const targetStep = determineTargetStep(state);
    const savedConfig = state?.cleaningConfig ?? null;
    const normalizedConfig = savedConfig
      ? normalizeCleaningConfig(savedConfig, buildDefaultConfig(raw))
      : null;
    let cleaned: Dataset | null = null;
    let hydratedDiff: CleaningDiff | null = (state?.cleaningDiff ??
      null) as CleaningDiff | null;

    // Apply cleaning if resuming at stats/export step. Cache-hit loads clean
    // client-side (business-logic applyCleaningConfig) — no backend round-trip.
    // For large files, cleaned is kept as a 100-row preview slice; stats use storage-backed full.
    const shouldSlice = (rows: unknown[]) => rows.length > PREVIEW_MAX_ROWS;
    if (
      (targetStep === "stats" || targetStep === "export") &&
      normalizedConfig
    ) {
      try {
        if (opts.clientClean) {
          const cr = applyCleaningConfig(raw, normalizedConfig);
          cleaned = cr.dataset;
          if (shouldSlice(cleaned.rows)) {
            cleaned = {
              ...cleaned,
              rows: cleaned.rows.slice(0, PREVIEW_MAX_ROWS),
            };
          }
          hydratedDiff = cr.diff;
        } else {
          const cleanResult = await callCleanApi(
            opts.storagePath ?? "",
            normalizedConfig as unknown as Record<string, unknown>,
            raw.columns,
            false,
            undefined,
            opts.contentHash,
          );
          const allCleanedRows = cleanResult.rows as Dataset["rows"];
          cleaned = {
            columns: cleanResult.columns as Dataset["columns"],
            rows:
              allCleanedRows.length > PREVIEW_MAX_ROWS
                ? allCleanedRows.slice(0, PREVIEW_MAX_ROWS)
                : allCleanedRows,
            fileName: raw.fileName,
            uploadedAt: new Date(),
          };
          hydratedDiff = cleanResult.diff as unknown as CleaningDiff;
        }
      } catch {
        // Fallback: use raw if clean API fails
        cleaned = raw;
        if (shouldSlice(cleaned.rows)) {
          cleaned = {
            ...cleaned,
            rows: cleaned.rows.slice(0, PREVIEW_MAX_ROWS),
          };
        }
      }
    }

    await hydrateForWorkspace({
      raw,
      cleaned,
      cleaningConfig: normalizedConfig as CleaningConfig | null,
      cleaningDiff: hydratedDiff,
      results: (state?.results ?? null) as StatsResults | null,
      exportPreferences: (state?.exportPreferences ?? {}) as Record<
        string,
        unknown
      >,
      cart: Array.isArray(state?.cart) ? state.cart : [],
      uploadId: targetUploadId,
      workspaceId,
      step: targetStep,
      appliedSteps: extractAppliedSteps(state),
      totalRowCount: opts.totalRowCount ?? raw.rows.length,
      storagePath: opts.storagePath ?? null,
    });
    // Hydrate new export store from v3 state if present
    try {
      const expState = (state as unknown as { exportState?: unknown })
        ?.exportState as
        | {
            format?: string;
            preset?: string;
            preferences?: Record<string, unknown>;
            datasetName?: string;
            includedVisualKeys?: string[];
          }
        | undefined;
      if (expState) {
        useExportStore.getState().hydrate({
          format: (expState.format as never) ?? "pdf",
          preset: (expState.preset as never) ?? "standard",
          preferences: expState.preferences as never,
          datasetName: expState.datasetName ?? "",
          includedVisualKeys: expState.includedVisualKeys ?? [],
        });
      } else if (state?.exportPreferences) {
        // Fallback from legacy v2: seed new store from old prefs
        const legacyPrefs = state.exportPreferences as Record<string, unknown>;
        const keys = Array.isArray(
          (legacyPrefs as unknown as { includedVisualKeys?: unknown })
            .includedVisualKeys,
        )
          ? (legacyPrefs as unknown as { includedVisualKeys: string[] })
              .includedVisualKeys
          : [];
        useExportStore.getState().hydrate({
          preferences: legacyPrefs as never,
          includedVisualKeys: keys,
        });
      }
    } catch {}
  };

  return loadDataset;
}
