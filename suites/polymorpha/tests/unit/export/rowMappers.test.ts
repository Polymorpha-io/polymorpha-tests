import { describe, it, expect } from "vitest";
import {
  descriptiveRowsFromResults,
  testRowsFromResults,
  visualLabelFromKey,
} from "@/features/export/lib/rowMappers";

describe("visualLabelFromKey", () => {
  it("heatmap:global special", () =>
    expect(visualLabelFromKey("heatmap:global")).toBe("Correlation heatmap"));
  it("single hist", () =>
    expect(visualLabelFromKey("hist:age")).toBe("Histogram - age"));
  it("pair scatter", () =>
    expect(visualLabelFromKey("scatter:age__fare")).toBe(
      "Scatter - age x fare",
    ));
  it("pair gbox", () =>
    expect(visualLabelFromKey("gbox:sex__age")).toBe(
      "Grouped box - sex x age",
    ));
  it("bad key passthrough", () =>
    expect(visualLabelFromKey("bad")).toBe("bad"));
});

describe("descriptiveRowsFromResults", () => {
  it("maps descriptive stats", () => {
    const rows = descriptiveRowsFromResults({
      descriptive: [
        {
          column: "age",
          count: 10,
          missing: 1,
          missingPct: 10,
          mean: 30,
          median: 29,
          std: 5,
          variance: 25,
          min: 20,
          max: 40,
          q1: 25,
          q3: 35,
          skewness: 0.1,
          kurtosis: 0.2,
        },
      ],
    } as never);
    expect(rows[0].Column).toBe("age");
    expect(rows[0].Mean).toBe("30.0000");
    expect(rows[0]["Missing %"]).toBe("10.00");
  });
  it("handles NaN as empty", () => {
    const rows = descriptiveRowsFromResults({
      descriptive: [
        {
          column: "x",
          count: 1,
          missing: 0,
          missingPct: 0,
          mean: NaN,
          median: NaN,
          std: NaN as unknown as number,
          variance: 0,
          min: NaN,
          max: NaN,
          q1: NaN,
          q3: NaN,
          skewness: NaN as unknown as number,
          kurtosis: NaN as unknown as number,
        },
      ],
    } as never);
    expect(rows[0].Mean).toBe("");
    expect(rows[0].Min).toBe("");
  });
});

describe("testRowsFromResults — parity", () => {
  it("covers tTests + anova + tukey + regression + mannWhitney + kruskal + chiSquare", () => {
    const rows = testRowsFromResults({
      tTests: [
        {
          type: "independent",
          column1: "a",
          column2: "b",
          t: 2.5,
          df: 10,
          pValue: 0.02,
          cohensD: 0.8,
          significant: true,
        },
      ],
      anova: [
        {
          factor: "g",
          responseVar: "y",
          F: 3.1,
          dfBetween: 2,
          dfWithin: 27,
          pValue: 0.06,
          etaSquared: 0.18,
          significant: false,
          tukey: [
            {
              groupA: "A",
              groupB: "B",
              meanDiff: 1.2,
              pAdj: 0.04,
              significant: true,
            },
          ],
        },
      ],
      regression: [
        {
          dependentVar: "y",
          predictors: ["x1", "x2"],
          fStatistic: 5,
          dfResid: 20,
          fPValue: 0.01,
          rSquared: 0.5,
        },
      ],
      mannWhitney: [
        {
          column: "score",
          group1: "A",
          group2: "B",
          U: 12,
          pValue: 0.03,
          significant: true,
        },
      ],
      kruskalWallis: [
        {
          column: "val",
          H: 7.2,
          df: 2,
          pValue: 0.02,
          significant: true,
          dunn: [
            {
              group1: "A",
              group2: "B",
              z: 2.1,
              pValue: 0.03,
              significant: true,
            },
          ],
        },
      ],
      chiSquare: [
        {
          column1: "sex",
          column2: "smoke",
          chiSq: 4.5,
          df: 1,
          pValue: 0.03,
          cramersV: 0.2,
          significant: true,
        },
      ],
    } as never);
    // BL currently returns tTests+anova (2) + wrapper adds Tukey supplement => 3 base. Extra 5 suites => 8 total.
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.some((r) => r.Test === "OLS Regression")).toBe(true);
    expect(rows.some((r) => r.Test === "Mann-Whitney U")).toBe(true);
    expect(rows.some((r) => r.Test === "Tukey HSD")).toBe(true);
    expect(rows.some((r) => r.Test === "Dunn post-hoc")).toBe(true);
    expect(rows.some((r) => r.Test === "Chi-square")).toBe(true);
  });
});
