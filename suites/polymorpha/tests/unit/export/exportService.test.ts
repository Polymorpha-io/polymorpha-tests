import { describe, it, expect, vi } from "vitest";
import { sanitizeFileName } from "@/features/export/lib/sanitize";
import {
  buildPdfOptions,
  normalizePrefsForPreset,
  reportSections,
} from "@/features/export/lib/ExportService";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";
import type { Dataset, StatsResults } from "@/types";

describe("normalizePrefsForPreset", () => {
  it("essentials disables correlation/tests", () => {
    const out = normalizePrefsForPreset(
      { ...DEFAULT_EXPORT_PREFERENCES, includeCorrelation: true },
      "essentials",
    );
    expect(out.includeCorrelation).toBe(false);
    expect(out.includeTests).toBe(false);
    expect(out.includeVisuals).toBe(false);
  });
  it("complete enables all", () => {
    const out = normalizePrefsForPreset(
      { ...DEFAULT_EXPORT_PREFERENCES, includeTests: false },
      "complete",
    );
    expect(out.includeTests).toBe(true);
    expect(out.includeVisuals).toBe(true);
    expect(out.includeHistograms).toBe(true);
  });
});

describe("reportSections", () => {
  it("lists enabled", () => {
    const secs = reportSections(DEFAULT_EXPORT_PREFERENCES);
    expect(secs).toContain("descriptive");
    expect(secs).toContain("tests");
  });
});

describe("buildPdfOptions", () => {
  it("maps essentials -> basic", () => {
    const ds = {
      fileName: "x.csv",
      columns: [],
      rows: [],
      uploadedAt: new Date(),
    } as unknown as Dataset;
    const results = {
      descriptive: [],
      frequencies: [],
      correlation: null,
      normality: [],
      tTests: [],
      anova: [],
      regression: [],
      mannWhitney: [],
      kruskalWallis: [],
      chiSquare: [],
    } as unknown as StatsResults;
    const opts = buildPdfOptions({
      cleaned: ds,
      raw: null,
      results,
      cleaningDiff: null,
      preferences: DEFAULT_EXPORT_PREFERENCES,
      datasetName: "x",
      preset: "essentials",
    });
    expect(opts.reportMode).toBe("basic");
  });
});

describe("sanitize crossed", () => {
  it("sanitizeFileName leading dot", () => {
    expect(sanitizeFileName("..etc/passwd")).toBe("-etc-passwd");
  });
});
