/**
 * Descriptive suite — G19 no fallback-fallbacks: network errors must fail inline
 * (no silent local fallback). Local compute only for rows <=1000 without storage ref.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Row } from "@/types";

vi.mock("@/lib/stats/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stats/api")>();
  return {
    ...actual,
    callStatsApi: vi.fn(),
    callStatsApiWithPath: vi.fn(),
  };
});

import { computeDescriptive, computeFrequency } from "@/lib/stats/descriptive";
import { callStatsApi, callStatsApiWithPath } from "@/lib/stats/api";

const ROWS: Row[] = [{ v: 10 }, { v: 20 }, { v: 30 }, { v: null }, { v: 40 }];

describe("computeDescriptive — G19 inline error (no fallback)", () => {
  beforeEach(() => {
    vi.mocked(callStatsApi).mockReset();
    vi.mocked(callStatsApiWithPath).mockReset();
  });

  it("fails inline on 'network error' for large rows (no fallback)", async () => {
    const large = Array.from({ length: 1001 }, () => ({ v: 1 }));
    vi.mocked(callStatsApi).mockRejectedValue(new Error("network error"));
    await expect(computeDescriptive(large, "v")).rejects.toThrow(
      /network error/,
    );
  });

  it("fails inline on 'Failed to fetch' for large rows (no fallback)", async () => {
    const large = Array.from({ length: 1001 }, () => ({ v: 1 }));
    vi.mocked(callStatsApi).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(computeDescriptive(large, "v")).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  it("rethrows non-network errors for large rows", async () => {
    const large = Array.from({ length: 1001 }, () => ({ v: 1 }));
    vi.mocked(callStatsApi).mockRejectedValue(
      new Error("API returned invalid p-value"),
    );
    await expect(computeDescriptive(large, "v")).rejects.toThrow(
      /invalid p-value/,
    );
  });

  it("computes locally for small rows without storage ref (no API call)", async () => {
    const stats = await computeDescriptive([{ v: null }, { v: null }], "v");
    expect(stats.count).toBe(0);
    expect(stats.missing).toBe(2);
    expect(stats.mean).toBe(0);
  });

  it("uses the storage-backed path when a ref is provided", async () => {
    vi.mocked(callStatsApiWithPath).mockResolvedValue({
      column: "v",
      count: 99,
      missing: 0,
      missingPct: 0,
      mean: 999,
      median: 999,
      std: 0,
      variance: 0,
      min: 999,
      max: 999,
      q1: 999,
      q3: 999,
      skewness: 0,
      kurtosis: 0,
    });
    const ref = { storagePath: "users/u/datasets/d.csv", contentHash: "abc" };
    const stats = await computeDescriptive(ROWS, "v", ref);
    expect(stats.mean).toBe(999);
    expect(callStatsApiWithPath).toHaveBeenCalledWith(
      "descriptive",
      "users/u/datasets/d.csv",
      null,
      { column: "v" },
      { contentHash: "abc" },
    );
  });

  it("fails inline when the storage-backed path fails (no fallback)", async () => {
    vi.mocked(callStatsApiWithPath).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    const ref = { storagePath: "p.csv", contentHash: "h" };
    await expect(computeDescriptive(ROWS, "v", ref)).rejects.toThrow(
      /Failed to fetch/,
    );
  });
});

describe("computeFrequency — G19 inline error (no fallback)", () => {
  beforeEach(() => {
    vi.mocked(callStatsApi).mockReset();
  });

  it("fails inline on network error for large rows (no fallback)", async () => {
    const large = Array.from({ length: 1001 }, (_, i) => ({ g: `v${i}` }));
    vi.mocked(callStatsApi).mockRejectedValue(new Error("network error"));
    await expect(computeFrequency(large, "g")).rejects.toThrow(/network error/);
  });

  it("computes locally for small rows without API (no network)", async () => {
    const table = await computeFrequency([{ g: null }, { g: null }], "g");
    expect(table.entries).toEqual([]);
    expect(table.totalUnique).toBe(0);
  });

  it("caps entries locally for small rows", async () => {
    const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
      g: `v${i % 40}`,
    }));
    const table = await computeFrequency(rows, "g");
    expect(table.entries.length).toBeLessThanOrEqual(30);
    expect(table.totalUnique).toBe(40);
  });
});
