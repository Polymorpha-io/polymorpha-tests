import { describe, expect, it } from "vitest";
import { buildDefaultConfig } from "@polymorpha/business-logic";
import {
  assocStepColumns,
  previewStepRows,
} from "@/components/CleaningPanel/cleaningPanelPreview";
import { CLEAN_STEPS } from "@/components/CleaningPanel/constants";
import type { Dataset } from "@/types";

const RAW: Dataset = {
  fileName: "t.csv",
  uploadedAt: new Date(0),
  columns: [
    { name: "city", type: "categorical", detectedType: "categorical" },
    { name: "age", type: "numeric", detectedType: "numeric" },
  ],
  rows: [
    { city: "Paris", age: 29 },
    { city: null, age: 44 },
    { city: "London", age: 31 },
    { city: "Paris", age: 52 },
    { city: "Rome", age: 38 },
    { city: "Paris", age: 27 },
  ],
} as unknown as Dataset;

function cfg() {
  return buildDefaultConfig(RAW);
}

describe("assocStepColumns", () => {
  it("returns empty when nothing configured", () => {
    expect(assocStepColumns(CLEAN_STEPS.missing, RAW, cfg())).toEqual([]);
    expect(assocStepColumns(CLEAN_STEPS.duplicates, RAW, cfg())).toEqual([]);
    expect(assocStepColumns(CLEAN_STEPS.columnState, RAW, cfg())).toEqual([]);
  });

  it("picks up configured columns", () => {
    const c = cfg();
    c.missing.city.strategy = "constant";
    expect(assocStepColumns(CLEAN_STEPS.missing, RAW, c)).toEqual(["city"]);
    const d = cfg();
    d.duplicates.enabled = true;
    expect(
      assocStepColumns(CLEAN_STEPS.duplicates, RAW, d).length,
    ).toBeGreaterThan(0);
  });
});

describe("previewStepRows", () => {
  it("returns null when unconfigured or unknown step", () => {
    expect(previewStepRows(RAW, cfg(), CLEAN_STEPS.missing)).toBeNull();
    expect(previewStepRows(RAW, cfg(), CLEAN_STEPS.columnState)).toBeNull();
  });

  it("applies a single missing step over full data", () => {
    const c = cfg();
    c.missing.city.strategy = "constant";
    c.missing.city.constantValue = "other";
    const peek = previewStepRows(RAW, c, CLEAN_STEPS.missing);
    expect(peek?.assoc).toEqual(["city"]);
    // null filled from full-column context, transformed rows present
    expect(peek?.after.rows[1]?.city).toBe("other");
    expect(peek?.totalRows).toBe(6);
  });

  it("isolates the step (other configured steps ignored)", () => {
    const c = cfg();
    c.missing.city.strategy = "constant";
    c.missing.city.constantValue = "other";
    c.duplicates.enabled = true;
    const peek = previewStepRows(RAW, c, CLEAN_STEPS.missing);
    // duplicates still present in the missing-only overlay
    expect(peek?.totalRows).toBe(6);
  });
});

describe("bin quantile mode", () => {
  const SKEWED: Dataset = {
    fileName: "prices.csv",
    uploadedAt: new Date(0),
    columns: [{ name: "price", type: "numeric", detectedType: "numeric" }],
    rows: [
      ...Array.from({ length: 97 }, (_, i) => ({ price: 100000 + i * 1000 })),
      { price: 5000000 },
      { price: 6000000 },
      { price: 7700000 },
    ],
  } as unknown as Dataset;

  it("equal-width bins collapse skewed data into one bin", () => {
    const c = buildDefaultConfig(SKEWED);
    c.binRules = [
      {
        column: "price",
        bins: 4,
        labels: ["low", "medium", "high", "wealthy"],
      },
    ];
    const peek = previewStepRows(SKEWED, c, CLEAN_STEPS.bin);
    expect(peek?.assoc).toEqual(["price"]);
    const bins = (peek?.after.rows ?? []).map((r) => r["price_bin"]);
    expect(bins[0]).toBe("low");
  });

  it("quantile bins split skewed data into equal counts", () => {
    const c = buildDefaultConfig(SKEWED);
    c.binRules = [
      {
        column: "price",
        bins: 4,
        labels: ["low", "medium", "high", "wealthy"],
        method: "quantile",
      },
    ];
    const peek = previewStepRows(SKEWED, c, CLEAN_STEPS.bin);
    expect(peek?.assoc).toEqual(["price"]);
    const counts = new Map<string, number>();
    for (const r of peek?.after.rows ?? [])
      counts.set(
        String(r["price_bin"]),
        (counts.get(String(r["price_bin"])) ?? 0) + 1,
      );
    expect(counts.get("low")).toBe(25);
    expect(counts.get("medium")).toBe(25);
    expect(counts.get("high")).toBe(25);
    expect(counts.get("wealthy")).toBe(25);
  });
});
