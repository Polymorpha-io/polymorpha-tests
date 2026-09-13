import { describe, it, expect } from "vitest";
import { hashExportPrefs, composeExportHash } from "@/features/export/lib/hash";
import { hashDataset } from "@/lib/hash";
import type { Dataset } from "@/types";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";

function ds(rows: number, cols: string[]): Dataset {
  return {
    fileName: "test.csv",
    uploadedAt: new Date("2026-01-01"),
    columns: cols.map((name) => ({
      name,
      type: "numeric",
      detectedType: "numeric",
    })),
    rows: Array.from({ length: rows }, (_, i) => ({
      a: i,
      b: i * 2,
    })),
  } as unknown as Dataset;
}

describe("hashDataset", () => {
  it("deterministic", async () => {
    const d = ds(5, ["a", "b"]);
    expect(await hashDataset(d)).toBe(await hashDataset(d));
  });
  it("differs on row count", async () => {
    expect(await hashDataset(ds(5, ["a"]))).not.toBe(
      await hashDataset(ds(6, ["a"])),
    );
  });
});

describe("hashExportPrefs", () => {
  it("deterministic for same prefs", async () => {
    const a = await hashExportPrefs(DEFAULT_EXPORT_PREFERENCES);
    const b = await hashExportPrefs({ ...DEFAULT_EXPORT_PREFERENCES });
    expect(a).toBe(b);
  });
  it("changes when flag flips", async () => {
    const a = await hashExportPrefs(DEFAULT_EXPORT_PREFERENCES);
    const b = await hashExportPrefs({
      ...DEFAULT_EXPORT_PREFERENCES,
      includeTests: !DEFAULT_EXPORT_PREFERENCES.includeTests,
    });
    expect(a).not.toBe(b);
  });
});

describe("composeExportHash", () => {
  it("joins", () => expect(composeExportHash("h1", "p1")).toBe("h1__p1"));
});
