/**
 * lib/vector/EmbeddingService — thin re-export / adapter over canonical
 * src/embeddings/EmbeddingService (G24 reuse, D18 no duplicate).
 * Keeps lib/vector/* as canonical import path for representation layer per G23 plan,
 * but delegates to established embeddings/* singleton for dedup + IDB cache.
 */
import { EMBED_DIM } from "@/config";
import { embeddingService as canonical } from "@/embeddings/EmbeddingService";
import { chunkText as modelChunkText } from "@/stella/models/embeddingModel";

export type EmbeddingVector = Float32Array;

export async function chunkText(text: string): Promise<string[]> {
  // Prefer model tokenizer-aware chunkText (G24 §8)
  try {
    return modelChunkText(text);
  } catch {
    const svc = canonical as unknown as {
      chunkText?: (t: string) => Promise<string[]>;
    };
    if (svc.chunkText) return svc.chunkText(text);
    return [text];
  }
}

export async function embed(text: string): Promise<EmbeddingVector> {
  if (EMBED_DIM !== 384) {
    console.warn(`[EmbeddingService] EMBED_DIM ${EMBED_DIM} != model 384`);
  }
  return canonical.embed(text);
}

export async function embedMany(texts: string[]): Promise<EmbeddingVector[]> {
  const res = await canonical.embedMany(texts);
  return res.vectors;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

export const embeddingService = {
  embed,
  embedMany,
  chunkText,
  cosineSimilarity,
} as const;
