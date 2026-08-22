/**
 * Deterministic PRNG utilities for test generators.
 * All factories accept a `seed` so generated data is reproducible between runs.
 * Never use bare `Math.random` in generators — use these helpers.
 */

/** mulberry32 — fast deterministic 32-bit PRNG. Returns function yielding [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash — derive a numeric seed from a test label. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Random integer in [min, max] (inclusive). */
export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** Random pick from an array. */
export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)] ?? arr[0];
}

/** Fisher–Yates shuffle (new array, input untouched). */
export function seededShuffle<T>(rand: () => number, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Box–Muller transform — standard normal sample. */
export function randNormal(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Sample `count` distinct indices from `[0, n)`. */
export function sampleIndices(
  rand: () => number,
  n: number,
  count: number,
): number[] {
  const k = Math.min(count, n);
  return seededShuffle(
    rand,
    Array.from({ length: n }, (_, i) => i),
  ).slice(0, k);
}
