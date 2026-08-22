/**
 * G24: Thin adapter over fflate + CompressionStream (established libs) — no custom gzip.
 * Reused by WorkspaceState and NotebookStorage (single source, G24-5).
 */
import { gzip, gunzip, strToU8 } from "fflate";
import { COMPRESS_LEVEL } from "@/config";

/** Compress a string payload with gzip — async via CompressionStream or fflate. */
export async function compressGzip(data: string): Promise<Uint8Array> {
  const bytes = strToU8(data);
  if (typeof CompressionStream !== "undefined") {
    try {
      const blob = new Blob([bytes as BlobPart]);
      const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
      const compBlob = await new Response(stream).blob();
      return new Uint8Array(await compBlob.arrayBuffer());
    } catch {}
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    gzip(bytes, { level: COMPRESS_LEVEL }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/** Decompress a gzipped ArrayBuffer — async via DecompressionStream or fflate. */
export async function decompressGzip(
  compressed: ArrayBuffer,
): Promise<ArrayBuffer> {
  const input = new Uint8Array(compressed);
  if (typeof DecompressionStream !== "undefined") {
    try {
      const blob = new Blob([input as BlobPart]);
      const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
      const decompBlob = await new Response(stream).blob();
      return await decompBlob.arrayBuffer();
    } catch {}
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    gunzip(input, (err, result) => {
      if (err) reject(err);
      else resolve(result.buffer as ArrayBuffer);
    });
  });
}
