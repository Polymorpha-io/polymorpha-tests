/**
 * G24: Checked @xenova/transformers (already in package.json) + BL hashString — reuses Xenova/all-MiniLM-L6-v2 via @xenova/transformers and BL hashString for dedup, thin batch/dedup layer only. No new vector DB; brute cosine for <1k vectors. Worker port deferred per G24(9).
 */
import { hashString } from "@polymorpha/business-logic";
import {
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_VERSION,
} from "./types";
import type { EmbeddingEntry } from "./types";
import { embeddingCache } from "./EmbeddingCache";
import { embedBatch, ensureEmbeddingModelLoaded } from "./EmbeddingWorker";

function makeKey(textHash: string): string {
  return `${DEFAULT_EMBEDDING_MODEL}:${DEFAULT_EMBEDDING_VERSION}:${textHash}`;
}

async function textHash(text: string): Promise<string> {
  try {
    const hex = await hashString(text);
    return hex.slice(0, 16);
  } catch {
    // fallback djb2
    let h = 5381;
    for (let i = 0; i < text.length; i++)
      h = (Math.imul(33, h) ^ text.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
}

// inflight dedup
const inflight = new Map<string, Promise<Float32Array>>();

export class EmbeddingService {
  private static instance: EmbeddingService | null = null;
  static getInstance(): EmbeddingService {
    if (!this.instance) this.instance = new EmbeddingService();
    return this.instance;
  }

  async initialize(): Promise<void> {
    await ensureEmbeddingModelLoaded();
  }

  async embed(text: string): Promise<Float32Array> {
    const h = await textHash(text);
    const key = makeKey(h);
    // cache hit
    const cached = await embeddingCache.get(key);
    if (cached) {
      embeddingCache.touch(key).catch(() => {});
      return cached.vector;
    }
    // inflight
    const existing = inflight.get(key);
    if (existing) return existing;
    const p = (async () => {
      await ensureEmbeddingModelLoaded();
      const vec = (await embedBatch([text]))[0];
      const entry: EmbeddingEntry = {
        embeddingKey: key,
        model: DEFAULT_EMBEDDING_MODEL,
        version: DEFAULT_EMBEDDING_VERSION,
        dimension: DEFAULT_EMBEDDING_DIM,
        vector: vec,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      await embeddingCache.set(entry);
      return vec;
    })();
    inflight.set(key, p);
    try {
      const v = await p;
      return v;
    } finally {
      inflight.delete(key);
    }
  }

  async embedMany(
    texts: string[],
  ): Promise<{ vectors: Float32Array[]; keys: string[] }> {
    if (texts.length === 0) return { vectors: [], keys: [] };
    // normalize + dedup preserving order
    const seen = new Map<string, number>(); // hash -> first idx
    const uniqueTexts: string[] = [];
    const uniqueHashes: string[] = [];
    const indexMap: number[] = []; // original idx -> unique idx
    const hashes = await Promise.all(texts.map(textHash));
    for (let i = 0; i < texts.length; i++) {
      const h = hashes[i];
      let uniqIdx = seen.get(h);
      if (uniqIdx === undefined) {
        uniqIdx = uniqueTexts.length;
        seen.set(h, uniqIdx);
        uniqueTexts.push(texts[i]);
        uniqueHashes.push(h);
      }
      indexMap.push(uniqIdx);
    }
    const uniqueKeys = uniqueHashes.map(makeKey);
    // cache lookup for unique
    const cachedVectors = new Map<string, Float32Array>();
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];
    const missingKeys: string[] = [];
    for (let i = 0; i < uniqueTexts.length; i++) {
      const k = uniqueKeys[i];
      // eslint-disable-next-line no-await-in-loop
      const e = await embeddingCache.get(k);
      if (e) {
        cachedVectors.set(k, e.vector);
        embeddingCache.touch(k).catch(() => {});
      } else {
        // inflight check
        const inf = inflight.get(k);
        if (inf) {
          // eslint-disable-next-line no-await-in-loop
          const v = await inf;
          cachedVectors.set(k, v);
        } else {
          missingIndices.push(i);
          missingTexts.push(uniqueTexts[i]);
          missingKeys.push(k);
        }
      }
    }
    if (missingTexts.length > 0) {
      await ensureEmbeddingModelLoaded();
      // create inflight promises for missing
      const batchPromise = embedBatch(missingTexts);
      for (let j = 0; j < missingKeys.length; j++) {
        const k = missingKeys[j];
        const p = batchPromise.then((arr) => arr[j]);
        inflight.set(k, p);
      }
      const vectors = await batchPromise;
      const entries: EmbeddingEntry[] = [];
      for (let j = 0; j < vectors.length; j++) {
        const k = missingKeys[j];
        const v = vectors[j];
        cachedVectors.set(k, v);
        entries.push({
          embeddingKey: k,
          model: DEFAULT_EMBEDDING_MODEL,
          version: DEFAULT_EMBEDDING_VERSION,
          dimension: DEFAULT_EMBEDDING_DIM,
          vector: v,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
        inflight.delete(k);
      }
      await embeddingCache.setMany(entries);
    }
    // reassemble in original order
    const outVectors: Float32Array[] = [];
    const outKeys: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const uniqIdx = indexMap[i];
      const k = uniqueKeys[uniqIdx];
      const v = cachedVectors.get(k)!;
      outVectors.push(v);
      outKeys.push(k);
    }
    return { vectors: outVectors, keys: outKeys };
  }

  async getCached(text: string): Promise<Float32Array | null> {
    const h = await textHash(text);
    const e = await embeddingCache.get(makeKey(h));
    return e ? e.vector : null;
  }

  async invalidateByKey(embeddingKey: string): Promise<void> {
    await embeddingCache.invalidate(embeddingKey);
  }

  async clear(): Promise<void> {
    await embeddingCache.clear();
  }

  // helper for callers that already have sourceHash
  makeEmbeddingKeyFromSourceHash(sourceHash: string): string {
    return makeKey(sourceHash);
  }
}

export const embeddingService = EmbeddingService.getInstance();
