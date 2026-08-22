// src/hooks/useWorkspaceAutosave.ts
import { useCallback, useEffect, useRef } from "react";
import { useDataStore } from "@/store/useDataStore";
import { useShallow } from "zustand/react/shallow";
import { createWorkspaceService } from "@/lib/WorkspaceService";
import type { WorkspaceState } from "@/lib/workspace";
import { useExportStore } from "@/features/export/store/useExportStore";
import { notebookRepository } from "@/notebook/NotebookRepository";
import { saveNotebook } from "@/notebook/NotebookStorage";

type WorkspaceService = ReturnType<typeof createWorkspaceService>;

/**
 * Hook to autosave the current pipeline state to Firestore.
 * v2: includes appliedSteps / totalRowCount / storagePath + dirty check + beacon flush.
 */
export function useWorkspaceAutosave(
  workspaceId: string | undefined,
  service: WorkspaceService | null,
) {
  const {
    step,
    cleaningConfig,
    cleaningDiff,
    results,
    exportPreferences,
    cart,
    uploadId,
    appliedSteps,
    totalRowCount,
    storagePath,
  } = useDataStore(
    useShallow((s) => ({
      step: s.step,
      cleaningConfig: s.cleaningConfig,
      cleaningDiff: s.cleaningDiff,
      results: s.results,
      exportPreferences: s.exportPreferences,
      cart: s.cart,
      uploadId: s.uploadId,
      appliedSteps: s.appliedSteps,
      totalRowCount: s.totalRowCount,
      storagePath: s.storagePath,
    })),
  );
  const exportSnapshot = useExportStore(
    useShallow((s) => ({
      format: s.format,
      preset: s.preset,
      preferences: s.preferences,
      datasetName: s.datasetName,
      includedVisualKeys: s.includedVisualKeys,
    })),
  );

  // Refs to avoid stale closures
  const serviceRef = useRef(service);
  const workspaceIdRef = useRef(workspaceId);
  useEffect(() => {
    serviceRef.current = service;
  }, [service]);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // Build a snapshot of the current workspace state
  const buildCurrentState = useCallback((): WorkspaceState => {
    const storeState = useDataStore.getState();
    const exportState = useExportStore.getState();
    return {
      version: 3,
      savedAt: new Date().toISOString(),
      workspaceId: workspaceIdRef.current ?? "",
      step: storeState.step,
      activeUploadId: storeState.uploadId,
      cleaningConfig: storeState.cleaningConfig as unknown as Record<
        string,
        unknown
      > | null,
      cleaningDiff: storeState.cleaningDiff as unknown as Record<
        string,
        unknown
      > | null,
      results: storeState.results as unknown as Record<string, unknown> | null,
      exportPreferences: (storeState.exportPreferences ??
        {}) as unknown as Record<string, unknown>,
      cart: storeState.cart.map((c) => ({
        id: c.id,
        type: c.type,
        label: c.label,
        meta: c.meta,
      })),
      notes: "", // persisted separately
      appliedSteps: storeState.appliedSteps,
      totalRowCount: storeState.totalRowCount,
      storagePath: storeState.storagePath,
      preflightWarnings: storeState.preflightWarnings as unknown as string[],
      exportState: {
        format: exportState.format,
        preset: exportState.preset,
        preferences: exportState.preferences as unknown as Record<
          string,
          unknown
        >,
        datasetName: exportState.datasetName,
        includedVisualKeys: exportState.includedVisualKeys,
      },
    };
  }, []);

  // Dirty check ref to avoid wasteful writes (07)
  const lastSavedJsonRef = useRef<string>("");

  // Debounced autosave (5s) – per-dataset
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!serviceRef.current || !workspaceIdRef.current || step === "upload")
      return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const svc = serviceRef.current;
        const wsId = workspaceIdRef.current;
        if (!svc || !wsId) return;
        const state = buildCurrentState();
        // dirty check — skip if unchanged
        const json = JSON.stringify({
          step: state.step,
          cleaningConfig: state.cleaningConfig,
          appliedSteps: state.appliedSteps,
          totalRowCount: state.totalRowCount,
          storagePath: state.storagePath,
          results: state.results,
          cart: state.cart,
          exportState: state.exportState,
        });
        if (json === lastSavedJsonRef.current) return;
        lastSavedJsonRef.current = json;
        const currentUploadId = useDataStore.getState().uploadId;
        await svc.saveState(wsId, state, currentUploadId ?? undefined);
        // Also persist notebook per workspace (IDB already, now Firebase per G24 thin adapter, defer speculative is false — notebook is required, so save)
        try {
          const nb = await notebookRepository.getByWorkspace(wsId);
          if (nb) {
            // Cast to WorkspaceHost for saveNotebook
            const host =
              svc as unknown as import("@/lib/WorkspaceServiceTypes").WorkspaceHost;
            await saveNotebook(host, wsId, nb);
          }
        } catch {}
      } catch {
        // non‑fatal
      }
    }, 5000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    cleaningConfig,
    cleaningDiff,
    results,
    exportPreferences,
    cart,
    step,
    uploadId,
    appliedSteps,
    totalRowCount,
    storagePath,
    exportSnapshot,
    service,
    workspaceId,
    buildCurrentState,
  ]);

  // Flush on unmount + visibilitychange / beforeunload (07)
  useEffect(() => {
    const flush = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const currentStep = useDataStore.getState().step;
      if (
        currentStep !== "upload" &&
        serviceRef.current &&
        workspaceIdRef.current
      ) {
        const state = buildCurrentState();
        const currentUploadId = useDataStore.getState().uploadId;
        const wsId = workspaceIdRef.current!;
        serviceRef.current
          .saveState(wsId, state, currentUploadId ?? undefined)
          .catch(() => {});
        // also flush notebook
        notebookRepository
          .getByWorkspace(wsId)
          .then((nb) => {
            if (!nb) return;
            const host =
              serviceRef.current as unknown as import("@/lib/WorkspaceServiceTypes").WorkspaceHost;
            return saveNotebook(host, wsId, nb);
          })
          .catch(() => {});
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = () => {
      flush();
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
