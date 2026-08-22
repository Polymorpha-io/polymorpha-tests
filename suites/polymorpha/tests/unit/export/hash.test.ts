import { describe, it, expect } from "vitest";
import {
  hashDatasetSync,
  hashExportPrefsSync,
  composeExportHash,
} from "@/features/export/lib/hash";
import type { Dataset, ExportPreferences } from "@/types";
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

describe("hashDatasetSync", () => {
  it("deterministic", () => {
    const d = ds(5, ["a", "b"]);
    expect(hashDatasetSync(d)).toBe(hashDatasetSync(d));
  });
  it("differs on row count", () => {
    expect(hashDatasetSync(ds(5, ["a"]))).not.toBe(
      hashDatasetSync(ds(6, ["a"])),
    );
  });
});

describe("hashExportPrefsSync", () => {
  it("deterministic for same prefs", () => {
    const a = hashExportPrefsSync(DEFAULT_EXPORT_PREFERENCES);
    const b = hashExportPrefsSync({ ...DEFAULT_EXPORT_PREFERENCES });
    expect(a).toBe(b);
  });
  it("changes when flag flips", () => {
    const a = hashExportPrefsSync(DEFAULT_EXPORT_PREFERENCES);
    const b = hashExportPrefsSync({
      ...DEFAULT_EXPORT_PREFERENCES,
      includeTests: !DEFAULT_EXPORT_PREFERENCES.includeTests,
    });
    expect(a).not.toBe(b);
  });
});

describe("composeExportHash", () => {
  it("joins", () => expect(composeExportHash("h1", "p1")).toBe("h1__p1"));
});
