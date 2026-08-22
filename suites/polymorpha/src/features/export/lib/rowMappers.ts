/**
 * rowMappers — thin adapter over @polymorpha/business-logic.
 * Reuses canonical serialization (G15/G24) and extends parity for
 * currently missing test categories. Do not duplicate business-logic
 * helpers — import and supplement only.
 */
import type { StatsResults } from "@/types";
import {
  visualLabelFromKey as blVisualLabelFromKey,
  descriptiveRowsFromResults as blDescriptiveRows,
  testRowsFromResults as blTestRows,
} from "@polymorpha/business-logic";

// Re-export canonical helper (G24: reuse, don't reimplement)
export const visualLabelFromKey = blVisualLabelFromKey;

export function descriptiveRowsFromResults(
  results: Pick<StatsResults, "descriptive">,
) {
  // Delegate to authoritative mapper (G15 single source)
  return blDescriptiveRows(results as never) as ReturnType<
    typeof blDescriptiveRows
  >;
}

/**
 * Extends business-logic's testRowsFromResults (currently tTests+anova+tukey)
 * with parity for regression / non-parametric suites that are still missing
 * upstream. When upstream ships parity, this wrapper becomes pass-through.
 */
export function testRowsFromResults(
  results: Pick<
    StatsResults,
    | "tTests"
    | "anova"
    | "regression"
    | "mannWhitney"
    | "kruskalWallis"
    | "chiSquare"
  >,
): ReturnType<typeof blTestRows> {
  // Start from authoritative rows (tTests+anova) then supplement missing suites
  const rows: Record<string, unknown>[] = [
    ...(blTestRows(results as never) as Record<string, unknown>[]),
  ];
  // Supplement Tukey if upstream dist is stale (G16) — ensure parity regardless of BL version
  const hasTukey = rows.some((r) => r.Test === "Tukey HSD");
  if (!hasTukey) {
    for (const a of (results as StatsResults).anova ?? []) {
      for (const comp of (a.tukey as unknown as Array<{ groupA: string; groupB: string; meanDiff: number; pAdj: number; significant: boolean }>) ?? []) {
        rows.push({
          Test: "Tukey HSD",
          "Variable 1": comp.groupA,
          "Variable 2": comp.groupB,
          Statistic: `Δ = ${Number.isFinite(comp.meanDiff) ? comp.meanDiff.toFixed(3) : ""}`,
          df: "",
          "p-value": Number.isFinite(comp.pAdj) ? (comp.pAdj as number).toFixed(4) : "",
          "Effect size": "",
          Significant: comp.significant ? "Yes" : "No",
        });
      }
    }
  }
  for (const r of (results as StatsResults).regression ?? []) {
    rows.push({
      Test: "OLS Regression",
      "Variable 1": r.dependentVar,
      "Variable 2": r.predictors.join(", "),
      Statistic: `F = ${Number.isFinite(r.fStatistic) ? r.fStatistic.toFixed(3) : ""}`,
      df: r.dfResid != null ? `${r.predictors.length}, ${r.dfResid}` : "",
      "p-value": Number.isFinite(r.fPValue) ? r.fPValue.toFixed(4) : "",
      "Effect size": `R² = ${Number.isFinite(r.rSquared) ? r.rSquared.toFixed(3) : ""}`,
      Significant: r.fPValue != null && r.fPValue < 0.05 ? "Yes" : "No",
    });
  }
  for (const m of (results as StatsResults).mannWhitney ?? []) {
    rows.push({
      Test: "Mann-Whitney U",
      "Variable 1": m.column,
      "Variable 2": `${m.group1} vs ${m.group2}`,
      Statistic: `U = ${Number.isFinite(m.U) ? m.U.toFixed(1) : ""}`,
      df: "",
      "p-value": Number.isFinite(m.pValue) ? m.pValue.toFixed(4) : "",
      "Effect size": "",
      Significant: m.significant ? "Yes" : "No",
    });
  }
  for (const k of (results as StatsResults).kruskalWallis ?? []) {
    rows.push({
      Test: "Kruskal-Wallis",
      "Variable 1": k.column,
      "Variable 2": "",
      Statistic: `H = ${Number.isFinite(k.H) ? k.H.toFixed(3) : ""}`,
      df: k.df,
      "p-value": Number.isFinite(k.pValue) ? k.pValue.toFixed(4) : "",
      "Effect size": "",
      Significant: k.significant ? "Yes" : "No",
    });
    for (const d of k.dunn ?? []) {
      rows.push({
        Test: "Dunn post-hoc",
        "Variable 1": d.group1,
        "Variable 2": d.group2,
        Statistic: `z = ${Number.isFinite(d.z) ? d.z.toFixed(3) : ""}`,
        df: "",
        "p-value": Number.isFinite(d.pValue) ? d.pValue.toFixed(4) : "",
        "Effect size": "",
        Significant: d.significant ? "Yes" : "No",
      });
    }
  }
  for (const c of (results as StatsResults).chiSquare ?? []) {
    rows.push({
      Test: "Chi-square",
      "Variable 1": c.column1,
      "Variable 2": c.column2,
      Statistic: `χ² = ${Number.isFinite(c.chiSq) ? c.chiSq.toFixed(3) : ""}`,
      df: c.df,
      "p-value": Number.isFinite(c.pValue) ? c.pValue.toFixed(4) : "",
      "Effect size": `V = ${Number.isFinite(c.cramersV) ? c.cramersV.toFixed(3) : ""}`,
      Significant: c.significant ? "Yes" : "No",
    });
  }
  return rows;
}
