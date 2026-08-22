import { create } from "zustand";
import type {
  RagDatasetProfile,
  RagPipelineName,
  PipelineStatus,
  RagProfileState,
} from "@/lib/rag/types";

const initialProfile: RagDatasetProfile = {
  dataset: null,
  perColumn: null,
  missing: null,
  duplicate: null,
  quality: null,
};

const initialStatus: Record<RagPipelineName, PipelineStatus> = {
  dataset: "pending",
  perColumn: "pending",
  missing: "pending",
  duplicate: "pending",
  quality: "pending",
};

function emptyState(): RagProfileState {
  return {
    profile: { ...initialProfile },
    status: { ...initialStatus },
    isProfiling: false,
    error: null,
    hash: null,
    updatedAt: null,
    uploadId: null,
    contentHash: null,
    sample: null,
  };
}

interface RagStore {
  // Single-dataset compat: active upload's state mirrors byDataset[activeUploadId]
  profile: RagDatasetProfile;
  status: Record<RagPipelineName, PipelineStatus>;
  isProfiling: boolean;
  error: string | null;
  hash: string | null;
  updatedAt: number | null;

  // Multi-dataset G23: Map<uploadId, RagProfileState> — no overwrite on switch
  byDataset: Map<string, RagProfileState>;
  activeUploadId: string | null;

  // streaming updates — now uploadId-aware
  setPipelineResult: <K extends keyof RagDatasetProfile>(
    name: RagPipelineName,
    key: K,
    value: RagDatasetProfile[K],
    uploadId?: string | null,
  ) => void;
  setStatus: (
    name: RagPipelineName,
    status: PipelineStatus,
    uploadId?: string | null,
  ) => void;
  startProfiling: (hash: string, uploadId?: string | null) => void;
  finishProfiling: (uploadId?: string | null) => void;
  setError: (err: string | null, uploadId?: string | null) => void;
  reset: (uploadId?: string | null) => void;
  // G23 helpers
  getFor: (uploadId: string) => RagProfileState | null;
  setActiveUpload: (uploadId: string | null) => void;
  setSample: (
    sample: RagProfileState["sample"],
    uploadId?: string | null,
  ) => void;
}

function cloneMap(
  m: Map<string, RagProfileState>,
): Map<string, RagProfileState> {
  return new Map(m);
}

function syncActive(
  byDataset: Map<string, RagProfileState>,
  activeUploadId: string | null,
): Partial<RagStore> {
  if (!activeUploadId) return {};
  const s = byDataset.get(activeUploadId);
  if (!s) return {};
  return {
    profile: s.profile,
    status: s.status,
    isProfiling: s.isProfiling,
    error: s.error,
    hash: s.hash,
    updatedAt: s.updatedAt,
  };
}

export const useRagStore = create<RagStore>((set, get) => ({
  profile: { ...initialProfile },
  status: { ...initialStatus },
  isProfiling: false,
  error: null,
  hash: null,
  updatedAt: null,
  byDataset: new Map<string, RagProfileState>(),
  activeUploadId: null,

  setPipelineResult: (name, key, value, uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const cur = next.get(uid) ?? emptyState();
      const updated: RagProfileState = {
        ...cur,
        profile: { ...cur.profile, [key]: value },
        status: { ...cur.status, [name]: "done" as PipelineStatus },
        updatedAt: Date.now(),
        uploadId: uid === "__single__" ? cur.uploadId : uid,
      };
      next.set(uid, updated);
      return {
        byDataset: next,
        ...syncActive(next, s.activeUploadId),
        updatedAt: Date.now(),
      } as Partial<RagStore> as RagStore;
    }),

  setStatus: (name, status, uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const cur = next.get(uid) ?? emptyState();
      const nextStatus = { ...cur.status, [name]: status } as Record<
        RagPipelineName,
        PipelineStatus
      >;
      const updated: RagProfileState = {
        ...cur,
        status: nextStatus,
        isProfiling:
          status === "running"
            ? true
            : Object.values(nextStatus).some((v) => v === "running"),
        updatedAt: Date.now(),
        uploadId: uid === "__single__" ? cur.uploadId : uid,
      };
      next.set(uid, updated);
      return {
        byDataset: next,
        ...syncActive(next, s.activeUploadId),
      } as Partial<RagStore> as RagStore;
    }),

  startProfiling: (hash, uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const st: RagProfileState = {
        profile: { ...initialProfile },
        status: {
          dataset: "pending",
          perColumn: "pending",
          missing: "pending",
          duplicate: "pending",
          quality: "pending",
        },
        isProfiling: true,
        error: null,
        hash,
        updatedAt: Date.now(),
        uploadId: uid === "__single__" ? null : uid,
        contentHash: null,
        sample: null,
      };
      next.set(uid, st);
      const patch: Partial<RagStore> = {
        byDataset: next,
        hash,
        isProfiling: true,
        error: null,
        profile: { ...initialProfile },
        status: st.status,
        updatedAt: st.updatedAt,
      };
      if (uid !== "__single__")
        (patch as unknown as Record<string, unknown>).activeUploadId = uid;
      return patch as RagStore;
    }),

  finishProfiling: (uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const cur = next.get(uid);
      if (cur) {
        const updated: RagProfileState = {
          ...cur,
          isProfiling: Object.values(cur.status).some((v) => v === "running"),
          updatedAt: Date.now(),
        };
        next.set(uid, updated);
        return {
          byDataset: next,
          ...syncActive(next, s.activeUploadId),
        } as Partial<RagStore> as RagStore;
      }
      return {
        isProfiling: Object.values(s.status).some((v) => v === "running"),
        updatedAt: Date.now(),
      } as Partial<RagStore> as RagStore;
    }),

  setError: (error, uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const cur = next.get(uid);
      if (cur) {
        next.set(uid, {
          ...cur,
          error,
          isProfiling: false,
          updatedAt: Date.now(),
        });
        return {
          byDataset: next,
          ...syncActive(next, s.activeUploadId),
          error,
          isProfiling: false,
        } as Partial<RagStore> as RagStore;
      }
      return { error, isProfiling: false } as Partial<RagStore> as RagStore;
    }),

  reset: (uploadId) =>
    set((s) => {
      if (uploadId) {
        const next = cloneMap(s.byDataset);
        next.delete(uploadId);
        const wasActive = s.activeUploadId === uploadId;
        return {
          byDataset: next,
          ...(wasActive
            ? {
                profile: { ...initialProfile },
                status: { ...initialStatus },
                isProfiling: false,
                error: null,
                hash: null,
                updatedAt: null,
                activeUploadId: null,
              }
            : {}),
        } as Partial<RagStore> as RagStore;
      }
      return {
        profile: { ...initialProfile },
        status: { ...initialStatus },
        isProfiling: false,
        error: null,
        hash: null,
        updatedAt: null,
        byDataset: new Map<string, RagProfileState>(),
        activeUploadId: null,
      } as RagStore;
    }),

  getFor: (uploadId) => get().byDataset.get(uploadId) ?? null,

  setActiveUpload: (uploadId) =>
    set((s) => {
      if (!uploadId)
        return { activeUploadId: null } as Partial<RagStore> as RagStore;
      const found = s.byDataset.get(uploadId);
      if (!found)
        return { activeUploadId: uploadId } as Partial<RagStore> as RagStore;
      return {
        activeUploadId: uploadId,
        profile: found.profile,
        status: found.status,
        isProfiling: found.isProfiling,
        error: found.error,
        hash: found.hash,
        updatedAt: found.updatedAt,
      } as Partial<RagStore> as RagStore;
    }),

  setSample: (sample, uploadId) =>
    set((s) => {
      const uid = uploadId ?? s.activeUploadId ?? "__single__";
      const next = cloneMap(s.byDataset);
      const cur = next.get(uid) ?? emptyState();
      next.set(uid, { ...cur, sample, updatedAt: Date.now() });
      return { byDataset: next } as Partial<RagStore> as RagStore;
    }),
}));
