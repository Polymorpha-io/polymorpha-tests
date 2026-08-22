import type { Row, TTestType } from "@/types";
import {
  tTest,
  pairCorrelation,
  chiSquare,
  computeVif,
  fisherExact,
  kruskalWallis,
  leveneTest,
  mannWhitneyU,
  multipleRegression,
  oneWayAnova,
  welchAnova,
} from "./tests";

// Builder context

export interface BuilderContext {
  rows: Row[];
  columnTypeMap: Record<string, string>;
  groupValuesFor: (col: string) => string[];
}

// Individual test builders

export function buildCorrelation(
  ctx: BuilderContext,
  config: { colA: string; colB: string; method: "pearson" | "spearman" },
) {
  const { colA, colB, method } = config;
  if (!colA || !colB)
    throw new Error("Select two numeric columns for correlation.");
  if (colA === colB)
    throw new Error("Select two different columns for correlation.");
  if (
    ctx.columnTypeMap[colA] !== "numeric" ||
    ctx.columnTypeMap[colB] !== "numeric"
  )
    throw new Error("Correlation requires two numeric columns.");
  return pairCorrelation(ctx.rows, colA, colB, method);
}

export function buildTTest(
  ctx: BuilderContext,
  config: { col1: string; col2: string; type: TTestType; mu: number },
) {
  const { col1, col2, type, mu } = config;
  if (!col1) throw new Error("Select a numeric column for t-test.");
  if (ctx.columnTypeMap[col1] !== "numeric")
    throw new Error(
      `Column "${col1}" is not numeric. t-test requires numeric data.`,
    );
  if (type !== "one-sample") {
    if (!col2)
      throw new Error("Select a second column for the t-test comparison.");
    if (col1 === col2)
      throw new Error(
        "Select two different columns for independent/paired t-test.",
      );
    if (ctx.columnTypeMap[col2] !== "numeric")
      throw new Error(`Column "${col2}" is not numeric.`);
  }
  const n1 = ctx.rows.reduce(
    (c, r) =>
      c + (typeof r[col1] === "number" && isFinite(r[col1] as number) ? 1 : 0),
    0,
  );
  if (n1 < 2)
    throw new Error(`Column "${col1}" has fewer than 2 valid numeric values.`);
  if (type !== "one-sample" && col2) {
    const n2 = ctx.rows.reduce(
      (c, r) =>
        c +
        (typeof r[col2] === "number" && isFinite(r[col2] as number) ? 1 : 0),
      0,
    );
    if (n2 < 2)
      throw new Error(
        `Column "${col2}" has fewer than 2 valid numeric values.`,
      );
  }
  return tTest(ctx.rows, col1, type, type === "one-sample" ? { mu } : { col2 });
}

export function buildAnova(
  ctx: BuilderContext,
  config: { responseCol: string; groupCol: string },
) {
  const { responseCol, groupCol } = config;
  if (!responseCol || !groupCol)
    throw new Error(
      "Select numeric response and categorical factor for ANOVA.",
    );
  if (responseCol === groupCol)
    throw new Error("Response and group columns must be different.");
  if (ctx.columnTypeMap[responseCol] !== "numeric")
    throw new Error(`Response column "${responseCol}" must be numeric.`);
  if (ctx.columnTypeMap[groupCol] !== "categorical")
    throw new Error(`Group column "${groupCol}" must be categorical.`);
  const labels = ctx.groupValuesFor(groupCol);
  if (labels.length < 2)
    throw new Error(
      `"${groupCol}" has fewer than 2 groups. ANOVA needs at least 2.`,
    );
  if (labels.length > 100)
    throw new Error(
      `Too many groups (${labels.length}) in "${groupCol}". Max 100 for ANOVA.`,
    );
  return oneWayAnova(ctx.rows, responseCol, groupCol);
}

export function buildRegression(
  ctx: BuilderContext,
  config: { responseCol: string; predictors: string[] },
) {
  const { responseCol, predictors } = config;
  if (!responseCol || predictors.length === 0)
    throw new Error("Select dependent variable and at least one predictor.");
  if (ctx.columnTypeMap[responseCol] !== "numeric")
    throw new Error(`Dependent variable "${responseCol}" must be numeric.`);
  if (predictors.includes(responseCol))
    throw new Error("Dependent variable cannot also be a predictor.");
  if (predictors.length > 20)
    throw new Error(
      `Too many predictors (${predictors.length}). Max 20 to avoid excessive computation.`,
    );
  const nonNumeric = predictors.filter(
    (col) => ctx.columnTypeMap[col] !== "numeric",
  );
  if (nonNumeric.length > 0)
    throw new Error(`Predictor(s) ${nonNumeric.join(", ")} must be numeric.`);
  const dupes = predictors.filter((c, i) => predictors.indexOf(c) !== i);
  if (dupes.length > 0)
    throw new Error(
      `Duplicate predictor(s): ${[...new Set(dupes)].join(", ")}.`,
    );
  const completeRows = ctx.rows.filter((r) => {
    if (
      typeof r[responseCol] !== "number" ||
      !isFinite(r[responseCol] as number)
    )
      return false;
    return predictors.every(
      (p) => typeof r[p] === "number" && isFinite(r[p] as number),
    );
  }).length;
  if (completeRows < predictors.length + 2)
    throw new Error(
      `Only ${completeRows} complete rows for ${predictors.length} predictors — need at least ${predictors.length + 2}.`,
    );
  return multipleRegression(ctx.rows, responseCol, predictors);
}

export function buildVif(ctx: BuilderContext, config: { cols: string[] }) {
  const { cols } = config;
  if (cols.length < 2)
    throw new Error("VIF needs at least 2 numeric predictors.");
  if (cols.length > 20)
    throw new Error(`Too many predictors (${cols.length}). Max 20 for VIF.`);
  const nonNumeric = cols.filter((col) => ctx.columnTypeMap[col] !== "numeric");
  if (nonNumeric.length > 0)
    throw new Error(
      `Column(s) ${nonNumeric.join(", ")} must be numeric for VIF.`,
    );
  const dupes = cols.filter((c, i) => cols.indexOf(c) !== i);
  if (dupes.length > 0)
    throw new Error(`Duplicate column(s): ${[...new Set(dupes)].join(", ")}.`);
  return computeVif(ctx.rows, cols);
}

export function buildMannWhitney(
  ctx: BuilderContext,
  config: { numCol: string; groupCol: string; g1: string; g2: string },
) {
  const { numCol, groupCol, g1, g2 } = config;
  if (!numCol || !groupCol || !g1 || !g2)
    throw new Error("Mann-Whitney needs numeric column and two groups.");
  if (numCol === groupCol)
    throw new Error("Numeric and group columns must be different.");
  if (g1 === g2) throw new Error("Select two different groups for comparison.");
  if (ctx.columnTypeMap[numCol] !== "numeric")
    throw new Error(`Column "${numCol}" must be numeric for Mann-Whitney.`);
  if (ctx.columnTypeMap[groupCol] !== "categorical")
    throw new Error(`Group column "${groupCol}" should be categorical.`);
  let n1 = 0,
    n2 = 0;
  for (const r of ctx.rows) {
    const g = String(r[groupCol] ?? "");
    const v = r[numCol];
    if (typeof v !== "number" || !isFinite(v)) continue;
    if (g === g1) n1++;
    else if (g === g2) n2++;
    if (n1 >= 2 && n2 >= 2) break;
  }
  if (n1 === 0)
    throw new Error(
      `Group "${g1}" has no valid numeric values in "${numCol}".`,
    );
  if (n2 === 0)
    throw new Error(
      `Group "${g2}" has no valid numeric values in "${numCol}".`,
    );
  return mannWhitneyU(ctx.rows, numCol, groupCol, g1, g2);
}

export function buildKruskal(
  ctx: BuilderContext,
  config: { numCol: string; groupCol: string },
) {
  const { numCol, groupCol } = config;
  if (!numCol || !groupCol)
    throw new Error(
      "Kruskal-Wallis needs numeric column and categorical group.",
    );
  if (numCol === groupCol)
    throw new Error("Numeric and group columns must be different.");
  if (ctx.columnTypeMap[numCol] !== "numeric")
    throw new Error(`Column "${numCol}" must be numeric for Kruskal-Wallis.`);
  if (ctx.columnTypeMap[groupCol] !== "categorical")
    throw new Error(`Group column "${groupCol}" should be categorical.`);
  const labels = ctx.groupValuesFor(groupCol);
  if (labels.length < 2)
    throw new Error(`"${groupCol}" has fewer than 2 groups.`);
  if (labels.length > 100)
    throw new Error(
      `Too many groups (${labels.length}). Max 100 for Kruskal-Wallis.`,
    );
  return kruskalWallis(ctx.rows, numCol, groupCol);
}

export function buildChiSquare(
  ctx: BuilderContext,
  config: { col1: string; col2: string },
) {
  const { col1, col2 } = config;
  if (!col1 || !col2)
    throw new Error("Chi-square needs two categorical columns.");
  if (col1 === col2)
    throw new Error("Select two different columns for chi-square.");
  if (ctx.columnTypeMap[col1] !== "categorical")
    throw new Error(`Column "${col1}" must be categorical for chi-square.`);
  if (ctx.columnTypeMap[col2] !== "categorical")
    throw new Error(`Column "${col2}" must be categorical for chi-square.`);
  const levels1 = new Set<string>();
  const levels2 = new Set<string>();
  for (const r of ctx.rows) {
    const v1 = r[col1];
    const v2 = r[col2];
    if (v1 != null && v1 !== "") levels1.add(String(v1));
    if (v2 != null && v2 !== "") levels2.add(String(v2));
    if (levels1.size > 100 || levels2.size > 100) break;
  }
  if (levels1.size < 2)
    throw new Error(`"${col1}" has fewer than 2 categories.`);
  if (levels2.size < 2)
    throw new Error(`"${col2}" has fewer than 2 categories.`);
  if (levels1.size > 100)
    throw new Error(
      `"${col1}" has too many levels (>100). Chi-square is not appropriate for high-cardinality data.`,
    );
  if (levels2.size > 100)
    throw new Error(
      `"${col2}" has too many levels (>100). Chi-square is not appropriate for high-cardinality data.`,
    );
  if (levels1.size * levels2.size > 5000)
    throw new Error(
      `Contingency table would be ${levels1.size}x${levels2.size} (${levels1.size * levels2.size} cells). Too large — simplify categories first.`,
    );
  return chiSquare(ctx.rows, col1, col2);
}

export function buildFisher(
  ctx: BuilderContext,
  config: { col1: string; col2: string },
) {
  const { col1, col2 } = config;
  if (!col1 || !col2)
    throw new Error("Fisher's exact test needs two categorical columns.");
  if (col1 === col2)
    throw new Error("Select two different columns for Fisher's test.");
  if (ctx.columnTypeMap[col1] !== "categorical")
    throw new Error(`Column "${col1}" must be categorical for Fisher's test.`);
  if (ctx.columnTypeMap[col2] !== "categorical")
    throw new Error(`Column "${col2}" must be categorical for Fisher's test.`);
  const levels1 = new Set<string>();
  const levels2 = new Set<string>();
  for (const r of ctx.rows) {
    const v1 = r[col1];
    const v2 = r[col2];
    if (v1 != null && v1 !== "") levels1.add(String(v1));
    if (v2 != null && v2 !== "") levels2.add(String(v2));
    if (levels1.size > 2 || levels2.size > 2) break;
  }
  if (levels1.size !== 2)
    throw new Error(
      `"${col1}" has ${levels1.size} levels — Fisher's test requires exactly 2. Use chi-square for larger tables.`,
    );
  if (levels2.size !== 2)
    throw new Error(
      `"${col2}" has ${levels2.size} levels — Fisher's test requires exactly 2. Use chi-square for larger tables.`,
    );
  if (ctx.rows.length > 1000)
    throw new Error(
      `Fisher's exact test is computationally expensive for ${ctx.rows.length} rows. Use chi-square instead.`,
    );
  return fisherExact(ctx.rows, col1, col2);
}

export function buildLevene(
  ctx: BuilderContext,
  config: { responseCol: string; groupCol: string },
) {
  const { responseCol, groupCol } = config;
  if (!responseCol || !groupCol)
    throw new Error(
      "Levene's test needs numeric response and categorical factor.",
    );
  if (responseCol === groupCol)
    throw new Error("Response and group columns must be different.");
  if (ctx.columnTypeMap[responseCol] !== "numeric")
    throw new Error(
      `Response column "${responseCol}" must be numeric for Levene's test.`,
    );
  if (ctx.columnTypeMap[groupCol] !== "categorical")
    throw new Error(
      `Group column "${groupCol}" must be categorical for Levene's test.`,
    );
  const labels = ctx.groupValuesFor(groupCol);
  if (labels.length < 2)
    throw new Error(`"${groupCol}" has fewer than 2 groups for Levene's test.`);
  if (labels.length > 100)
    throw new Error(
      `Too many groups (${labels.length}). Max 100 for Levene's test.`,
    );
  return leveneTest(ctx.rows, responseCol, groupCol);
}

export function buildWelchAnova(
  ctx: BuilderContext,
  config: { responseCol: string; groupCol: string },
) {
  const { responseCol, groupCol } = config;
  if (!responseCol || !groupCol)
    throw new Error(
      "Welch's ANOVA needs numeric response and categorical factor.",
    );
  if (responseCol === groupCol)
    throw new Error("Response and group columns must be different.");
  if (ctx.columnTypeMap[responseCol] !== "numeric")
    throw new Error(
      `Response column "${responseCol}" must be numeric for Welch's ANOVA.`,
    );
  if (ctx.columnTypeMap[groupCol] !== "categorical")
    throw new Error(
      `Group column "${groupCol}" must be categorical for Welch's ANOVA.`,
    );
  const labels = ctx.groupValuesFor(groupCol);
  if (labels.length < 2)
    throw new Error(`"${groupCol}" has fewer than 2 groups for Welch's ANOVA.`);
  if (labels.length > 100)
    throw new Error(
      `Too many groups (${labels.length}). Max 100 for Welch's ANOVA.`,
    );
  return welchAnova(ctx.rows, responseCol, groupCol);
}

// Validation reason (returns null if valid, or a reason string)

export interface TestConfig {
  correlation: { colA: string; colB: string; method: "pearson" | "spearman" };
  tTest: { col1: string; col2: string; type: TTestType; mu: number };
  anova: { responseCol: string; groupCol: string };
  welchAnova: { responseCol: string; groupCol: string };
  levene: { responseCol: string; groupCol: string };
  regression: { responseCol: string; predictors: string[] };
  vif: { cols: string[] };
  mannWhitney: { numCol: string; groupCol: string; g1: string; g2: string };
  kruskal: { numCol: string; groupCol: string };
  chiSquare: { col1: string; col2: string };
  fisher: { col1: string; col2: string };
  wilcoxon: { col1: string; col2: string };
}

export type TestBuilderKey = keyof TestConfig;

/** Returns null if the test can run, or a user-friendly reason string if it cannot. */
export function getDisabledReason(
  key: TestBuilderKey,
  config: TestConfig[TestBuilderKey],
  columnTypeMap: Record<string, string>,
): string | null {
  switch (key) {
    case "correlation": {
      const c = config as TestConfig["correlation"];
      if (!c.colA || !c.colB) return "Select two numeric columns";
      if (c.colA === c.colB) return "Columns must be different";
      if (
        columnTypeMap[c.colA] !== "numeric" ||
        columnTypeMap[c.colB] !== "numeric"
      )
        return "Both columns must be numeric";
      return null;
    }
    case "tTest": {
      const c = config as TestConfig["tTest"];
      if (!c.col1) return "Select a numeric column";
      if (columnTypeMap[c.col1] !== "numeric")
        return "Primary column must be numeric";
      if (c.type !== "one-sample") {
        if (!c.col2) return "Select a second numeric column";
        if (c.col1 === c.col2) return "Columns must be different";
        if (columnTypeMap[c.col2] !== "numeric")
          return "Both columns must be numeric";
      }
      return null;
    }
    case "anova":
    case "welchAnova":
    case "levene": {
      const c = config as TestConfig["anova"];
      if (!c.responseCol) return "Select a numeric response";
      if (!c.groupCol) return "Select a categorical factor";
      if (c.responseCol === c.groupCol)
        return "Response and factor must differ";
      if (columnTypeMap[c.responseCol] !== "numeric")
        return "Response must be numeric";
      if (columnTypeMap[c.groupCol] !== "categorical")
        return "Factor must be categorical";
      return null;
    }
    case "regression": {
      const c = config as TestConfig["regression"];
      if (!c.responseCol) return "Select a dependent variable";
      if (c.predictors.length === 0) return "Select at least one predictor";
      if (columnTypeMap[c.responseCol] !== "numeric")
        return "Dependent variable must be numeric";
      if (c.predictors.includes(c.responseCol))
        return "Target cannot be a predictor";
      return null;
    }
    case "vif": {
      const c = config as TestConfig["vif"];
      if (c.cols.length < 2) return "Select at least 2 numeric predictors";
      return null;
    }
    case "mannWhitney": {
      const c = config as TestConfig["mannWhitney"];
      if (!c.numCol || !c.groupCol) return "Select numeric and group columns";
      if (!c.g1 || !c.g2) return "Select two groups to compare";
      if (c.g1 === c.g2) return "Groups must be different";
      return null;
    }
    case "kruskal": {
      const c = config as TestConfig["kruskal"];
      if (!c.numCol) return "Select a numeric column";
      if (!c.groupCol) return "Select a grouping column";
      return null;
    }
    case "chiSquare":
    case "fisher": {
      const c = config as TestConfig["chiSquare"];
      if (!c.col1 || !c.col2) return "Select two categorical columns";
      if (c.col1 === c.col2) return "Columns must be different";
      return null;
    }
    case "wilcoxon": {
      const c = config as TestConfig["wilcoxon"];
      if (!c.col1 || !c.col2) return "Select two numeric columns";
      if (c.col1 === c.col2) return "Columns must be different";
      return null;
    }
  }
}
