/**
 * Generated cleaning matrix suite — every valid/invalid cleaning config
 * variant from `tests/generators/cleaning.ts`, plus enum cross-products,
 * run through the real `applyCleaningConfig` / `validateCleaningConfig`.
 */
import { describe, it, expect } from "vitest";
import {
  applyCleaningConfig,
  buildDefaultConfig,
  validateCleaningConfig,
} from "@polymorpha/business-logic";
import {
  ENCODING_TYPES,
  INVALID_CLEANING_CASES,
  MATH_TRANSFORMS,
  MISSING_STRATEGIES,
  OUTLIER_ACTIONS,
  OUTLIER_METHODS,
  ROW_FILTER_OPERATORS,
  SAMPLE_METHODS,
  SCALE_METHODS,
  STRING_CASE_MODES,
  STRING_MATCH_MODES,
  VALID_CLEANING_CASES,
  configBuilder,
  makeDatasetFixture,
} from "../../generators";
import { cartesian } from "../../generators";
import { expectCleaningDiff, expectValidDataset } from "../../generators";

describe("applyCleaningConfig — valid config matrix", () => {
  describe.each(VALID_CLEANING_CASES)("$label", (tc) => {
    it("applies without throwing and returns a structurally valid dataset", () => {
      const dataset = tc.dataset();
      const config = tc.patch(dataset);
      const result = applyCleaningConfig(dataset, config);
      expectValidDataset(result.dataset);
      expectCleaningDiff(result.diff);
    });
  });
});

describe("validateCleaningConfig — invalid config matrix", () => {
  describe.each(INVALID_CLEANING_CASES)("$label", (tc) => {
    it("produces at least one warning", () => {
      const dataset = tc.dataset();
      const config = tc.patch(dataset);
      const warnings = validateCleaningConfig(dataset, config);
      expect(warnings.length).toBeGreaterThan(0);
      if (tc.message) {
        expect(warnings.some((w) => w.message.includes(tc.message!))).toBe(
          true,
        );
      }
    });
  });
});

describe("applyCleaningConfig — enum cross-products", () => {
  it.each(
    cartesian(MISSING_STRATEGIES, OUTLIER_METHODS, OUTLIER_ACTIONS).map(
      ([strategy, method, action]) => ({
        label: `missing=${strategy} outlier=${method}/${action}`,
        strategy,
        method,
        action,
      }),
    ),
  )("$label", ({ strategy, method, action }) => {
    const dataset = makeDatasetFixture("outliers");
    const numeric = dataset.columns.find((c) => c.type === "numeric")!;
    const config = configBuilder(dataset)
      .withMissing(numeric.name, strategy, { constantValue: "0" })
      .withOutliers(numeric.name, method, action)
      .build();
    const result = applyCleaningConfig(dataset, config);
    expectValidDataset(result.dataset);
  });

  it.each(
    cartesian(STRING_CASE_MODES, STRING_MATCH_MODES).map(
      ([caseMode, matchMode]) => ({
        label: `case=${caseMode} match=${matchMode}`,
        caseMode,
        matchMode,
      }),
    ),
  )("$label", ({ caseMode, matchMode }) => {
    const dataset = makeDatasetFixture("dates");
    const col = dataset.columns[0]!;
    const config = configBuilder(dataset)
      .withCaseMode(caseMode)
      .withStringReplace(col.name, "a", "x", matchMode)
      .build();
    const result = applyCleaningConfig(dataset, config);
    expectValidDataset(result.dataset);
  });

  it.each(
    cartesian(SCALE_METHODS, ENCODING_TYPES).map(([scale, encoding]) => ({
      label: `scale=${scale} encoding=${encoding}`,
      scale,
      encoding,
    })),
  )("$label", ({ scale, encoding }) => {
    const dataset = makeDatasetFixture("mixed");
    const numeric = dataset.columns.find((c) => c.type === "numeric")!;
    const cat = dataset.columns.find((c) => c.type === "categorical")!;
    const config = configBuilder(dataset)
      .withScaling(numeric.name, scale)
      .withEncoding(cat.name, encoding)
      .build();
    const result = applyCleaningConfig(dataset, config);
    expectValidDataset(result.dataset);
  });

  it.each(
    cartesian(MATH_TRANSFORMS, SAMPLE_METHODS).map(([transform, sample]) => ({
      label: `transform=${transform} sample=${sample}`,
      transform,
      sample,
    })),
  )("$label", ({ transform, sample }) => {
    const dataset = makeDatasetFixture("large");
    const numeric = dataset.columns.find((c) => c.type === "numeric")!;
    const config = configBuilder(dataset)
      .withMathTransform(numeric.name, transform)
      .withSampling(sample, 5)
      .build();
    const result = applyCleaningConfig(dataset, config);
    expectValidDataset(result.dataset);
  });

  it.each(ROW_FILTER_OPERATORS.map((op) => ({ label: `operator=${op}`, op })))(
    "$label",
    ({ op }) => {
      const dataset = makeDatasetFixture("mixed");
      const numeric = dataset.columns.find((c) => c.type === "numeric")!;
      const config = configBuilder(dataset)
        .withRowFilter(
          numeric.name,
          op,
          op === "isEmpty" || op === "notEmpty" ? "" : "20",
        )
        .build();
      const result = applyCleaningConfig(dataset, config);
      expectValidDataset(result.dataset);
    },
  );
});

describe("buildDefaultConfig — defaults", () => {
  it("builds a no-op config for any dataset (applying is identity)", () => {
    const dataset = makeDatasetFixture("mixed");
    const config = buildDefaultConfig(dataset);
    const result = applyCleaningConfig(dataset, config);
    expect(result.dataset.rows).toEqual(dataset.rows);
    expect(result.dataset.columns.map((c) => c.name)).toEqual(
      dataset.columns.map((c) => c.name),
    );
    expect(result.diff.rowsRemoved).toBe(0);
    expect(result.diff.columnsRemoved).toBe(0);
  });

  it("buildDefaultConfig + applyCleaningConfig never mutate the input", () => {
    const dataset = makeDatasetFixture("missing");
    const before = JSON.stringify(dataset);
    const config = buildDefaultConfig(dataset);
    applyCleaningConfig(dataset, config);
    expect(JSON.stringify(dataset)).toBe(before);
  });
});
