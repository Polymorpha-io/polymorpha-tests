import { describe, expect, it, vi, beforeEach } from "vitest";
import { callStatsApi } from "@/lib/stats/api";
import { recomputeStep } from "@/lib/data-ops";
import type { Dataset } from "@/types";

vi.mock("@/lib/stats/api", () => ({
  callStatsApi: vi.fn(),
  callStatsApiWithPath: vi.fn(),
}));

function dataset(): Dataset {
  return {
    fileName: "pay.csv",
    uploadedAt: new Date(0),
    columns: [
      {
        name: "Salary",
        type: "numeric" as const,
        detectedType: "numeric" as const,
      },
      {
        name: "Region",
        type: "categorical" as const,
        detectedType: "categorical" as const,
      },
    ],
    rows: [
      { Salary: 60000, Region: "EU" },
      { Salary: 40000, Region: "US" },
    ],
  };
}

const QUERY = {
  type: "query",
  expr: 'Salary > 50000 and Region == "EU"',
} as const;

beforeEach(() => {
  vi.mocked(callStatsApi).mockReset();
});

describe("recomputeStep server failure", () => {
  it("names the transport cause inline with the keys suffix", async () => {
    vi.mocked(callStatsApi).mockRejectedValue(
      new Error("fetch failed for /api/v1/stats (connection refused)"),
    );
    const err = await recomputeStep(dataset(), { ...QUERY }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    // The user's repro: cause present, no console round-trip needed.
    expect(message).toContain(
      "Backend unavailable for query after automatic retries:",
    );
    expect(message).toContain("connection refused");
    expect(message).toContain("Top-level keys: type, expr");
  });

  it("leaves validation errors unmasked (never wrapped as outage)", async () => {
    const validation = 'Stats API: Query failed: Column "Salary" not found.';
    vi.mocked(callStatsApi).mockRejectedValue(new Error(validation));
    const err = await recomputeStep(dataset(), { ...QUERY }).catch((e) => e);
    expect((err as Error).message).toBe(validation);
    expect((err as Error).message).not.toContain("automatic retries");
  });

  it("caps a verbose transport cause instead of echoing it whole", async () => {
    vi.mocked(callStatsApi).mockRejectedValue(new Error(`x`.repeat(400)));
    const err = await recomputeStep(dataset(), { ...QUERY }).catch((e) => e);
    const message = (err as Error).message;
    expect(message).toContain("…");
    expect(message).not.toContain("x".repeat(400));
    expect(message).toContain("Top-level keys: type, expr");
  });
});
