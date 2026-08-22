/**
 * VectorStore — retrieval index layer.
 * Representation layer = semantic representation of data
 * Vector layer = retrieval index
 * RAG = retrieval/context assembly
 * G18 per-user isolation `uid:vector:contentHash:chunkId`, 20MB quota via clientStore.
 * G24 reuse: delegates IDB persistence to clientStore (mirrors CacheService pattern).
 */
import type { EmbeddingVector } from "./EmbeddingService";
import { cosineSimilarity } from "./EmbeddingService";
import * as clientStore from "./clientStore";

export type VectorRecord = {
  id: string; // chunkId
  datasetId: string;
  uploadId: string;
  contentHash: string;
  chunkHash: string;
  text: string;
  embedding: EmbeddingVector;
  kind:
    "dataset_profile" | "column_semantic" | "data_representative" | "exact_row";
  sample?: {
    n: number;
    method: string;
    coverage: "sample" | "exact";
    seed: string;
    strategyVersion: string;
  };
  workspaceId?: string;
};

export async function putVectors(
  uid: string,
  vectors: VectorRecord[],
): Promise<void> {
  await clientStore.putVectors(uid, vectors);
}

export async function getVectors(
  uid: string,
  contentHash: string,
  chunkIds: string[],
): Promise<VectorRecord[]> {
  return clientStore.getVectors(uid, contentHash, chunkIds);
}

export async function getAllVectors(
  uid: string,
  opts?: { workspaceId?: string },
): Promise<VectorRecord[]> {
  if (opts?.workspaceId) {
    return clientStore.getAllByWorkspace(uid, opts.workspaceId);
  }
  return clientStore.getAllByUid(uid);
}

export async function deleteVectorsByContentHash(
  uid: string,
  contentHash: string,
): Promise<void> {
  await clientStore.deleteByContentHash(uid, contentHash);
}

export async function searchVectors(
  _uid: string,
  _queryEmbedding: EmbeddingVector,
  _opts: { topK?: number; scope?: string } = {},
): Promise<Array<{ record: VectorRecord; score: number }>> {
  // Brute cosine today — G24 vector indexing: established library (e.g., hnswlib-wasm) can replace this loop
  return [];
}

export async function federatedSearch(
  _uid: string,
  queryEmbedding: EmbeddingVector,
  candidates: VectorRecord[],
  topK = 5,
): Promise<Array<{ record: VectorRecord; score: number }>> {
  const scored = candidates.map((rec) => ({
    record: rec,
    score: cosineSimilarity(queryEmbedding, rec.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Single retrieval-plane abstraction — replaceable.
 * Today: IDB brute cosine via clientStore; later: pgvector/HNSW behind same interface.
 * Callers (KnowledgeService/Stella) depend only on this shape, not EmbeddingCache/clientStore directly.
 */
export interface VectorFilter {
  workspaceId?: string;
  scope: "workspace" | "all";
  kinds?: VectorRecord["kind"][];
  uid: string;
}

export interface VectorSearchResult {
  record: VectorRecord;
  score: number;
}

export async function upsert(
  uid: string,
  vectors: VectorRecord[],
): Promise<void> {
  await putVectors(uid, vectors);
}

export async function search(
  uid: string,
  queryEmbedding: EmbeddingVector,
  filter: VectorFilter,
  limit = 8,
): Promise<VectorSearchResult[]> {
  const all =
    filter.scope === "all"
      ? await clientStore.getAllByUid(filter.uid)
      : filter.workspaceId
        ? await clientStore.getAllByWorkspace(filter.uid, filter.workspaceId)
        : await clientStore.getAllByUid(filter.uid);
  const filtered = filter.kinds?.length
    ? all.filter((r) => filter.kinds!.includes(r.kind))
    : all;
  return federatedSearch(uid, queryEmbedding, filtered, limit);
}

export const vectorStore = {
  upsert,
  search,
  putVectors,
  getVectors,
  getAllVectors,
  deleteVectorsByContentHash,
  searchVectors,
  federatedSearch,
  clearAll,
};

export async function clearAll(): Promise<void> {
  await clientStore.clearAll();
}
