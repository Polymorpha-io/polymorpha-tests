import type { DescriptiveStats, FrequencyTable, Row } from "@/types";
import { callStatsApi, callStatsApiWithPath } from "./api";
import type { StorageBackedRef } from "./storageBacked";
import { useDataStore } from "@/store/useDataStore";

function computeDescriptiveLocal(
  rows: Row[],
  colName: string,
): DescriptiveStats {
  const vals: number[] = [];
  let missing = 0;
  for (const r of rows) {
    const v = r[colName];
    if (v === null || v === undefined || v === "") {
      missing++;
      continue;
    }
    const num = Number(v);
    if (Number.isFinite(num)) vals.push(num);
    else missing++;
  }
  const n = vals.length;
  const total = rows.length;
  const missingPct = total ? (missing / total) * 100 : 0;
  if (n === 0) {
    return {
      column: colName,
      count: 0,
      missing,
      missingPct: Math.round(missingPct * 100) / 100,
      mean: 0,
      median: 0,
      std: 0,
      variance: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      skewness: 0,
      kurtosis: 0,
    } as DescriptiveStats;
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const variance =
    n > 1 ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const skewness =
    n >= 3 && std !== 0
      ? vals.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n
      : 0;
  const kurtosis =
    n >= 3 && std !== 0
      ? vals.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / n - 3
      : 0;
  return {
    column: colName,
    count: n,
    missing,
    missingPct: Math.round(missingPct * 100) / 100,
    mean,
    median,
    std,
    variance,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    skewness,
    kurtosis,
  } as DescriptiveStats;
}

export async function computeDescriptive(
  rows: Row[],
  colName: string,
  storageBacked?: StorageBackedRef | null,
): Promise<DescriptiveStats> {
  const tryLocal = () => computeDescriptiveLocal(rows, colName);
  if (!storageBacked && rows.length <= 1000) return tryLocal();
  if (storageBacked) {
    const cleaningConfig = useDataStore.getState()
      .cleaningConfig as unknown as Record<string, unknown> | null;
    return await callStatsApiWithPath<DescriptiveStats>(
      "descriptive",
      storageBacked.storagePath,
      cleaningConfig,
      { column: colName },
      { contentHash: storageBacked.contentHash },
    );
  }
  return await callStatsApi<DescriptiveStats>("descriptive", rows, {
    column: colName,
  });
}

function computeFrequencyLocal(
  rows: Row[],
  colName: string,
  maxEntries = 30,
): FrequencyTable {
  const vals: string[] = [];
  for (const r of rows) {
    const v = r[colName];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s === "") continue;
    vals.push(s);
  }
  const total = vals.length;
  if (total === 0)
    return { column: colName, entries: [], totalUnique: 0 } as FrequencyTable;
  const counts = new Map<string, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxEntries);
  const entries = sorted.map(([value, count]) => ({
    value,
    count,
    pct: Math.round((count / total) * 10000) / 100,
  }));
  return {
    column: colName,
    entries,
    totalUnique: counts.size,
  } as FrequencyTable;
}

export async function computeFrequency(
  rows: Row[],
  colName: string,
  storageBacked?: StorageBackedRef | null,
): Promise<FrequencyTable> {
  const tryLocal = () => computeFrequencyLocal(rows, colName);
  if (!storageBacked && rows.length <= 1000) return tryLocal();
  if (storageBacked) {
    const cleaningConfig = useDataStore.getState()
      .cleaningConfig as unknown as Record<string, unknown> | null;
    return await callStatsApiWithPath<FrequencyTable>(
      "frequency",
      storageBacked.storagePath,
      cleaningConfig,
      { column: colName },
      { contentHash: storageBacked.contentHash },
    );
  }
  return await callStatsApi<FrequencyTable>("frequency", rows, {
    column: colName,
  });
}
