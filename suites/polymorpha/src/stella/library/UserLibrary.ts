import { getFirebaseDb } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useDataStore } from "@/store/useDataStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Embedder } from "@/stella/brain/Embedder";
import type { LibraryResult } from "@/stella/types";
import { useRagStore } from "@/store/useRagStore";
import { EMBED_PER_COLUMN_LIMIT, EMBED_SAMPLING_SEED, EMBED_SAMPLING_VERSION } from "@/config";
import { buildDataRepresentativeEmbeddings } from "@/lib/representation/DatasetRepresentationService";
import * as VectorStore from "@/lib/vector/VectorStore";
import type { VectorRecord } from "@/lib/vector/VectorStore";
import { hashString } from "@polymorpha/business-logic";

interface WorkspaceChunk {
  text: string;
  embedding: Float32Array;
  metadata: Record<string, unknown>;
}

const SEARCH_TOP_K = 5;

type FederatedSearchOpts = {
  uid?: string | null;
  scope?: "workspace" | "all";
  workspaceId?: string | null;
};

export class UserLibrary {
  // G23 multi-dataset: per-uploadId chunks + per-uploadId lastRagHash
  private chunksByDataset: Map<string, WorkspaceChunk[]> = new Map();
  private lastRagHashByDataset: Map<string, string | null> = new Map();
  private vectorCache: Map<string, VectorRecord[]> = new Map();
  // textHash -> embedding memo to avoid re-embed Promise.all churn
  private textHashMemo: Map<string, Float32Array> = new Map();
  private lastWorkspaceId: string | null = null;
  private embedderRef: Embedder | null = null;

  // compat single chunks view (active dataset)
  private get activeChunks(): WorkspaceChunk[] | null {
    const activeId =
      useDataStore.getState().uploadId ?? useRagStore.getState().activeUploadId;
    if (activeId && this.chunksByDataset.has(activeId))
      return this.chunksByDataset.get(activeId)!;
    // fallback first entry
    const first = this.chunksByDataset.values().next().value as
      WorkspaceChunk[] | undefined;
    return first ?? null;
  }

  async init(workspaceId: string | null, embedder: Embedder): Promise<void> {
    if (!workspaceId) return;
    this.lastWorkspaceId = workspaceId;
    this.embedderRef = embedder;
    this.chunksByDataset.clear();
    this.vectorCache.clear();

    const state = useDataStore.getState();
    const ragState = useRagStore.getState();

    // Determine per-dataset profiles to embed
    const uploadIds = new Set<string>();
    if (state.uploadId) uploadIds.add(state.uploadId);
    for (const k of ragState.byDataset.keys()) uploadIds.add(k);
    // also fetch workspace uploadIds for federated scope
    const workspaceUploads = await this.fetchAllUploads(workspaceId);
    for (const u of workspaceUploads) uploadIds.add(u.uploadId);

    // Build for active dataset first
    await this.buildWorkspaceChunks(workspaceId, state, embedder);

    // Build for other workspace datasets lazily (if RAG profile exists)
    for (const uid of uploadIds) {
      if (uid === state.uploadId) continue;
      const profileState = ragState.byDataset.get(uid);
      if (profileState?.profile.dataset) {
        try {
          await this.buildRepresentativeForExistingProfile(
            uid,
            workspaceId,
            embedder,
          );
        } catch {}
      }
    }
  }

  private buildRagChunkTextsForUpload(uploadId: string | null): string[] {
    const rag = useRagStore.getState();
    const state = uploadId ? rag.byDataset.get(uploadId) : null;
    const profile = state?.profile ?? rag.profile;
    const out: string[] = [];
    if (profile.dataset) {
      const d = profile.dataset;
      out.push(
        `RAG dataset profile: ${d.rows} rows × ${d.cols} cols (${d.format}), ` +
          `duplicate ${d.duplicatePct}% (${d.duplicateRows} rows), ` +
          `empty rows ${d.emptyRows}, empty cols ${d.emptyCols}, ` +
          `constant cols: ${d.constantCols.length ? d.constantCols.join(", ") : "none"}, ` +
          `types: ${Object.entries(d.columnCountByType)
            .map(([k, v]) => `${k}:${v}`)
            .join(", ")}`,
      );
    }
    if (profile.perColumn && profile.perColumn.length) {
      for (const c of profile.perColumn.slice(0, EMBED_PER_COLUMN_LIMIT)) {
        if (c.mean !== undefined) {
          out.push(
            `Column "${c.name}" (${c.type}): missing ${c.missingPct}% (${c.missing} missing), unique ${c.unique} (${(c.cardinalityRatio * 100).toFixed(1)}%), mean ${Number(c.mean).toFixed(2)} median ${Number(c.median).toFixed(2)} std ${Number(c.std).toFixed(2)} skew ${Number(c.skewness).toFixed(2)}`,
          );
        } else {
          const top = c.topK?.[0]
            ? `${c.topK[0].value} ${c.topK[0].pct}%`
            : "—";
          out.push(
            `Column "${c.name}" (${c.type}): missing ${c.missingPct}%, unique ${c.unique} (${(c.cardinalityRatio * 100).toFixed(1)}%), top ${top}, entropy ${c.entropy}`,
          );
        }
      }
      if (profile.perColumn.length > EMBED_PER_COLUMN_LIMIT) {
        out.push(
          `+${profile.perColumn.length - EMBED_PER_COLUMN_LIMIT} more columns (RAG perColumn truncated)`,
        );
      }
    }
    if (profile.missing) {
      const m = profile.missing;
      if (m.highMissingCols.length) {
        out.push(
          `Missing >20%: ${m.highMissingCols.join(", ")}; avg per row ${m.perRow.avgMissingPerRow}, max ${m.perRow.maxMissingPerRow}`,
        );
      }
      if (m.missingTogether.length) {
        out.push(
          `Missing together (r>0.3): ${m.missingTogether.map((p) => `${p.a}↔${p.b} ${p.correlation}`).join("; ")}`,
        );
      }
    }
    if (profile.duplicate) {
      const d = profile.duplicate;
      const parts: string[] = [];
      if (d.candidateKeys.length)
        parts.push(`PK candidates: ${d.candidateKeys.join(", ")}`);
      if (d.uniqueCols.length)
        parts.push(`unique >98%: ${d.uniqueCols.slice(0, 3).join(", ")}`);
      if (d.compositeKeys.length)
        parts.push(
          `composite keys: ${d.compositeKeys.map((k) => k.join("+")).join("; ")}`,
        );
      out.push(
        `Duplicate: ${d.duplicateRows} rows ${d.duplicatePct}%` +
          (parts.length ? `; ${parts.join("; ")}` : ""),
      );
    }
    if (profile.quality) {
      const q = profile.quality;
      const parts: string[] = [];
      if (q.whitespaceCols.length)
        parts.push(`whitespace: ${q.whitespaceCols.join(", ")}`);
      if (q.mixedTypes.length)
        parts.push(`mixed types: ${q.mixedTypes.join(", ")}`);
      if (q.invalid.length)
        parts.push(
          `invalid: ${q.invalid.map((i) => `${i.column} ${i.issue}×${i.count}`).join("; ")}`,
        );
      if (parts.length) out.push(`Quality: ${parts.join("; ")}`);
    }
    // update per-dataset lastRagHash
    if (uploadId) {
      const h =
        useRagStore.getState().byDataset.get(uploadId)?.hash ??
        useRagStore.getState().hash;
      this.lastRagHashByDataset.set(uploadId, h ?? null);
    }
    return out;
  }

  private async buildWorkspaceChunks(
    workspaceId: string,
    state: ReturnType<typeof useDataStore.getState>,
    embedder: Embedder,
  ): Promise<void> {
    const activeUploadId =
      state.uploadId ?? useRagStore.getState().activeUploadId ?? "default";
    const chunkTexts: string[] = [];

    const ragTexts = this.buildRagChunkTextsForUpload(state.uploadId ?? null);
    if (ragTexts.length > 0) {
      chunkTexts.push(...ragTexts);
    } else {
      if (state.raw) {
        const cols = state.raw.columns.map((c) => c.name).join(", ");
        chunkTexts.push(
          `Active dataset "${state.raw.fileName}" has ${state.raw.rows.length} rows and columns: ${cols}`,
        );
      }
      if (state.cleaned) {
        const cols = state.cleaned.columns.map((c) => c.name).join(", ");
        chunkTexts.push(
          `Cleaned dataset has ${state.cleaned.rows.length} rows and columns: ${cols}`,
        );
      }
    }

    if (state.cleaningConfig) {
      const configStr = JSON.stringify(state.cleaningConfig);
      chunkTexts.push(`Cleaning configuration: ${configStr}`);
    }

    if (state.results) {
      const resultKeys = Object.entries(state.results)
        .filter(
          ([, v]) => v != null && (Array.isArray(v) ? v.length > 0 : true),
        )
        .map(([k]) => k);
      if (resultKeys.length > 0) {
        chunkTexts.push(`Analysis results available: ${resultKeys.join(", ")}`);
      }
    }

    const uploadDocs = await this.fetchAllUploads(workspaceId);
    for (const upload of uploadDocs) {
      if (upload.uploadId === state.uploadId) continue;
      const cols = upload.columns?.join(", ") || "unknown";
      chunkTexts.push(
        `Upload "${upload.fileName}" has ${upload.rowCount} rows, ${upload.colCount} columns: ${cols}`,
      );
    }

    // Representative embeddings: hybrid client+server — build DataRepresentativeEmbedding for active dataset if possible
    const representativeVectors = await this.buildDataRepresentativeVectors(
      state,
      workspaceId,
      embedder,
    );

    await this.embedAll(
      chunkTexts,
      embedder,
      {
        workspaceId,
        uploadId: activeUploadId,
        spotlight: ragTexts.length ? "rag" : "workspace",
      },
      activeUploadId,
    );

    // Merge representative vectors into vectorCache + also embed their texts for semantic search
    if (representativeVectors.length) {
      const existing = this.chunksByDataset.get(activeUploadId) ?? [];
      const repChunks: WorkspaceChunk[] = representativeVectors.map((v) => ({
        text: v.text,
        embedding: v.embedding,
        metadata: {
          workspaceId,
          uploadId: v.uploadId,
          datasetId: v.datasetId,
          contentHash: v.contentHash,
          chunkHash: v.chunkHash,
          kind: v.kind,
          sample: v.sample,
          embeddingKind: "data_representative",
          sampleCoverage: v.sample?.coverage ?? "sample",
        },
      }));
      // Deduplicate by chunkHash and keep per-dataset limit
      const merged = [...existing, ...repChunks];
      this.chunksByDataset.set(activeUploadId, merged);
      // Persist to VectorStore for federated search cold start
      const uid = useAuthStore.getState().user?.uid ?? "anon";
      try {
        await VectorStore.putVectors(uid, representativeVectors);
        const cached = this.vectorCache.get(activeUploadId) ?? [];
        this.vectorCache.set(activeUploadId, [
          ...cached,
          ...representativeVectors,
        ]);
      } catch {}
    }
  }

  private async buildRepresentativeForExistingProfile(
    uploadId: string,
    workspaceId: string,
    embedder: Embedder,
  ): Promise<void> {
    // Cheap: if already cached, skip
    if (this.vectorCache.has(uploadId)) return;
    const rag = useRagStore.getState().byDataset.get(uploadId);
    if (!rag?.profile.perColumn) return;
    // Need raw dataset for representative sampling — try from CacheService or current state
    const state = useDataStore.getState();
    let dataset = state.raw && state.uploadId === uploadId ? state.raw : null;
    if (!dataset) {
      try {
        const { getCacheService } = await import("@/lib/CacheService");
        if (state.rawHash) {
          dataset = (await getCacheService().getDataset(state.rawHash)) ?? null;
        }
      } catch {}
    }
    if (!dataset || dataset.rows.length === 0) return;
    const contentHash = rag.hash ?? (await this.deriveContentHash(dataset));
    const vectors = await this.createRepresentativeVectors(
      uploadId,
      contentHash,
      dataset,
      rag.profile.perColumn,
      workspaceId,
      embedder,
    );
    if (vectors.length) {
      const uid = useAuthStore.getState().user?.uid ?? "anon";
      await VectorStore.putVectors(uid, vectors).catch(() => {});
      this.vectorCache.set(uploadId, vectors);
      const chunks: WorkspaceChunk[] = vectors.map((v) => ({
        text: v.text,
        embedding: v.embedding,
        metadata: {
          workspaceId,
          uploadId: v.uploadId,
          datasetId: v.datasetId,
          contentHash: v.contentHash,
          kind: v.kind,
          sample: v.sample,
          embeddingKind: "data_representative",
          sampleCoverage: v.sample?.coverage ?? "sample",
        },
      }));
      this.chunksByDataset.set(uploadId, chunks);
    }
  }

  private async deriveContentHash(
    dataset: import("@/types").Dataset,
  ): Promise<string> {
    try {
      const hex = await hashString(
        `${dataset.fileName}:${dataset.rows.length}:${dataset.columns.length}:${JSON.stringify(dataset.rows.slice(0, 2))}`,
      );
      return `h${hex.slice(0, 12)}_${dataset.rows.length}_${dataset.columns.length}`;
    } catch {
      return `h${Date.now().toString(36)}_${dataset.rows.length}`;
    }
  }

  private async buildDataRepresentativeVectors(
    state: ReturnType<typeof useDataStore.getState>,
    workspaceId: string,
    embedder: Embedder,
  ): Promise<VectorRecord[]> {
    const dataset = state.cleaned ?? state.raw;
    if (!dataset || dataset.rows.length === 0) return [];
    const uploadId = state.uploadId ?? "default";
    const rag =
      useRagStore.getState().byDataset.get(uploadId) ??
      (useRagStore.getState() as unknown as {
        profile: import("@/lib/rag/types").RagDatasetProfile;
        hash: string | null;
      });
    const perColumn = (
      rag as unknown as {
        profile: {
          perColumn: import("@/lib/rag/types").PerColumnProfile[] | null;
        };
      }
    ).profile.perColumn;
    if (!perColumn || perColumn.length === 0) return [];
    const contentHash =
      (rag as unknown as { hash: string | null }).hash ??
      (await this.deriveContentHash(dataset));
    // Server exact for >5k is still client representative + server future; keep client sample N=200 per G18
    return this.createRepresentativeVectors(
      uploadId,
      contentHash,
      dataset,
      perColumn,
      workspaceId,
      embedder,
    );
  }

  private async createRepresentativeVectors(
    uploadId: string,
    contentHash: string,
    dataset: import("@/types").Dataset,
    perColumn: import("@/lib/rag/types").PerColumnProfile[],
    workspaceId: string,
    embedder: Embedder,
  ): Promise<VectorRecord[]> {
    const datasetId = uploadId;
    let reps: import("@/lib/representation/types").DataRepresentativeEmbedding[] =
      [];
    try {
      reps = await buildDataRepresentativeEmbeddings(
        datasetId,
        uploadId,
        contentHash,
        dataset,
        perColumn,
        {
          mode: dataset.rows.length <= 1000 ? "exact" : "representative",
          sampleN: dataset.rows.length <= 1000 ? dataset.rows.length : 200,
        },
      );
    } catch {
      return [];
    }
    if (reps.length === 0) return [];
    // Deduplicate via textHash memo + chunkHash
    const texts = reps.map((r) => r.text);
    const embeddings = await this.embedWithMemo(texts, embedder);
    const records: VectorRecord[] = reps.map((r, i) => ({
      id: r.chunkId,
      datasetId: r.datasetId,
      uploadId: r.uploadId,
      contentHash: r.contentHash,
      chunkHash: r.chunkHash,
      text: r.text,
      embedding: embeddings[i],
      kind: r.kind,
      sample: r.metadata.sample,
      workspaceId,
    }));
    // Preserve privacy contract rawDataPersisted:false sampleCoverage
    return records;
  }

  private async embedWithMemo(
    texts: string[],
    embedder: Embedder,
  ): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    const toEmbed: string[] = [];
    const toEmbedIndices: number[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      // contentHash:chunkHash memo via textHash
      let h: string;
      try {
        h = await hashString(
          `${EMBED_SAMPLING_SEED}:${EMBED_SAMPLING_VERSION}:${text.slice(0, 120)}`,
        );
      } catch {
        h = `${text.length}:${text.slice(0, 32)}`;
      }
      hashes.push(h);
      const hit = this.textHashMemo.get(h);
      if (hit) out[i] = hit;
      else {
        toEmbed.push(text);
        toEmbedIndices.push(i);
      }
    }
    if (toEmbed.length) {
      // batch via embedder.embedMany if available, else Promise.all
      let vectors: Float32Array[] = [];
      try {
        if (
          typeof (
            embedder as unknown as {
              embedMany: (t: string[]) => Promise<Float32Array[]>;
            }
          ).embedMany === "function"
        ) {
          vectors = await (
            embedder as unknown as {
              embedMany: (t: string[]) => Promise<Float32Array[]>;
            }
          ).embedMany(toEmbed);
        } else {
          vectors = await Promise.all(toEmbed.map((t) => embedder.embed(t)));
        }
      } catch {
        vectors = await Promise.all(
          toEmbed.map((t) =>
            embedder.embed(t).catch(() => new Float32Array(384)),
          ),
        );
      }
      for (let j = 0; j < vectors.length; j++) {
        const idx = toEmbedIndices[j];
        const h = hashes[idx];
        this.textHashMemo.set(h, vectors[j]);
        out[idx] = vectors[j];
      }
    }
    return out;
  }

  private async syncRagIfNeeded(): Promise<void> {
    if (!this.lastWorkspaceId || !this.embedderRef) return;
    const rag = useRagStore.getState();
    const activeId = useDataStore.getState().uploadId ?? rag.activeUploadId;
    if (!activeId) return;
    const curHash = rag.byDataset.get(activeId)?.hash ?? rag.hash;
    const last = this.lastRagHashByDataset.get(activeId) ?? null;
    if (curHash && curHash !== last) {
      const state = useDataStore.getState();
      await this.buildWorkspaceChunks(
        this.lastWorkspaceId,
        state,
        this.embedderRef,
      );
    }
  }

  private async embedAll(
    texts: string[],
    embedder: Embedder,
    metadata: Record<string, unknown>,
    uploadId: string,
  ): Promise<void> {
    if (texts.length === 0) {
      this.chunksByDataset.set(uploadId, []);
      return;
    }
    const embeddings = await this.embedWithMemo(texts, embedder);
    const chunks = texts.map((text, i) => ({
      text,
      embedding: embeddings[i],
      metadata: {
        ...metadata,
        kind: (metadata as { kind?: string }).kind ?? "rag_profile",
      },
    }));
    this.chunksByDataset.set(uploadId, chunks);
  }

  private async fetchAllUploads(workspaceId: string): Promise<UploadInfo[]> {
    const db = getFirebaseDb();
    const user = useAuthStore.getState().user;
    if (!db || !user) return [];

    try {
      const wsSnap = await getDoc(
        doc(db, "users", user.uid, "workspaces", workspaceId),
      );
      if (!wsSnap.exists()) return [];
      const wsData = wsSnap.data() as { uploadIds?: string[] };
      const uploadIds = wsData.uploadIds ?? [];
      if (uploadIds.length === 0) return [];

      const results = await Promise.all(
        uploadIds.map(async (uid) => {
          try {
            const snap = await getDoc(
              doc(db, "users", user.uid, "uploads", uid),
            );
            if (!snap.exists()) return null;
            const d = snap.data();
            return {
              uploadId: uid,
              fileName: (d.fileName as string) ?? "Unknown",
              rowCount: (d.rowCount as number) ?? 0,
              colCount: (d.columnCount as number) ?? 0,
              columns: (d.columns as string[]) ?? [],
            };
          } catch {
            return null;
          }
        }),
      );

      return results.filter((r): r is UploadInfo => r !== null);
    } catch {
      return [];
    }
  }

  async search(
    queryEmbedding: Float32Array,
    opts?: FederatedSearchOpts,
  ): Promise<LibraryResult[]> {
    try {
      await this.syncRagIfNeeded();
    } catch {
      /* non-critical */
    }
    // Federated path: if VectorStore has records for uid, use federatedSearch
    if (opts?.uid) {
      const federated = await this.federatedSearch(queryEmbedding, opts);
      if (federated.length) return federated;
    }

    const chunks = this.activeChunks;
    if (!chunks || chunks.length === 0) return [];

    const scored = chunks.map((chunk) => ({
      source: "workspace" as const,
      text: chunk.text,
      score: Embedder.cosineSimilarity(queryEmbedding, chunk.embedding),
      metadata: chunk.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, SEARCH_TOP_K);
  }

  async federatedSearch(
    queryEmbedding: Float32Array,
    opts: FederatedSearchOpts,
  ): Promise<LibraryResult[]> {
    const uid = opts.uid ?? useAuthStore.getState().user?.uid ?? null;
    if (!uid) return [];
    const scope = opts.scope ?? "workspace";
    let candidates: VectorRecord[] = [];
    try {
      if (scope === "all") {
        candidates = await VectorStore.getAllVectors(uid);
        // also include in-mem not yet persisted
        for (const vecs of this.vectorCache.values()) {
          for (const v of vecs)
            if (!candidates.find((c) => c.chunkHash === v.chunkHash))
              candidates.push(v);
        }
      } else {
        const wsId = opts.workspaceId ?? this.lastWorkspaceId;
        if (!wsId) return [];
        candidates = await VectorStore.getAllVectors(uid, {
          workspaceId: wsId,
        });
        const activeId = useDataStore.getState().uploadId;
        if (activeId) {
          const cached = this.vectorCache.get(activeId);
          if (cached) {
            for (const v of cached)
              if (
                !candidates.find(
                  (c) => c.id === v.id && c.contentHash === v.contentHash,
                )
              )
                candidates.push(v);
          }
        }
        // fallback to in-mem chunksByDataset as VectorRecord-like
        if (candidates.length === 0) {
          const memVectors = Array.from(this.vectorCache.values()).flat();
          const filtered = wsId
            ? memVectors.filter((v) => v.workspaceId === wsId)
            : memVectors;
          candidates = filtered;
        }
      }
    } catch {
      return [];
    }
    if (candidates.length === 0) return [];
    const scored = await VectorStore.federatedSearch(
      uid,
      queryEmbedding,
      candidates,
      SEARCH_TOP_K,
    );
    return scored.map((s) => ({
      source: "workspace" as const,
      text: s.record.text,
      score: s.score,
      metadata: {
        workspaceId: s.record.workspaceId,
        uploadId: s.record.uploadId,
        datasetId: s.record.datasetId,
        contentHash: s.record.contentHash,
        chunkHash: s.record.chunkHash,
        kind: s.record.kind,
        sample: s.record.sample,
        embeddingKind: s.record.kind,
        sampleCoverage: s.record.sample?.coverage ?? "sample",
        // privacy contract
        source: "derived-data",
        persistence: "local",
        rawDataPersisted: false,
      },
    }));
  }
}

interface UploadInfo {
  uploadId: string;
  fileName: string;
  rowCount: number;
  colCount: number;
  columns: string[];
}
