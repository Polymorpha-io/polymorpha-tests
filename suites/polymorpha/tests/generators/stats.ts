/**
 * Stats generators — BuilderContext fixtures, per-action request/result
 * factories, and correlation-matrix builders for stats/API matrix tests.
 */
import type { BuilderContext } from "@/lib/stats/testBuilders";
import type { CorrelationMatrix, Dataset, Row } from "@/types";
import { mulberry32 } from "./seed";
import { categoricalColumns, numericColumns } from "./matrix";

/** Build a valid BuilderContext from a dataset. */
export function makeBuilderContext(dataset: Dataset): BuilderContext {
  const columnTypeMap: Record<string, string> = {};
  for (const col of dataset.columns) {
    columnTypeMap[col.name] = col.type;
  }
  const cache = new Map<string, string[]>();
  return {
    rows: dataset.rows,
    columnTypeMap,
    groupValuesFor: (col: string) => {
      if (cache.has(col)) return cache.get(col)!;
      const values = [
        ...new Set(
          dataset.rows
            .map((r) => r[col])
            .filter((v): v is string | number => v != null && v !== "")
            .map(String),
        ),
      ];
      cache.set(col, values);
      return values;
    },
  };
}

/** Valid symmetric correlation matrix for `columns` with off-diagonal `r`. */
export function correlationMatrix(
  columns: string[],
  r: number,
  seed = 1,
): CorrelationMatrix {
  const n = columns.length;
  const values: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : r)),
  );
  return { columns, values, method: "pearson" };
}

/** Injected-outlier dataset rows that make a numeric column clearly skewed. */
export function rowsWithOutliers(
  base: Row[],
  colName: string,
  count = 2,
  factor = 30,
): Row[] {
  const out = base.map((r) => ({ ...r }));
  for (let i = 0; i < count; i++) {
    const row = out[i % out.length];
    if (row && typeof row[colName] === "number") {
      row[colName] = (row[colName] as number) * factor;
    }
  }
  return out;
}

/** Two-group rows for Mann-Whitney / Kruskal / ANOVA builders. */
export function groupedRows(
  cols: { numeric: string; group: string },
  perGroup = 4,
  seed = 7,
): Row[] {
  const rand = mulberry32(seed);
  const rows: Row[] = [];
  for (const g of ["A", "B", "C"]) {
    for (let i = 0; i < perGroup; i++) {
      rows.push({
        [cols.numeric]: Math.round(20 + rand() * 80 * 100) / 100,
        [cols.group]: g,
      });
    }
  }
  return rows;
}

// ── Per-action request/result factories (callStatsApi contract) ───────

/** Default params for an action given a dataset with at least 2 numeric cols. */
export function paramsForAction(
  action: string,
  dataset: Dataset,
): Record<string, unknown> {
  const num = numericColumns(dataset.columns);
  const cat = categoricalColumns(dataset.columns);
  const a = num[0] ?? dataset.columns[0]?.name ?? "col1";
  const b = num[1] ?? num[0] ?? "col2";
  const g = cat[0] ?? "group";
  switch (action) {
    case "descriptive":
      return { column: a };
    case "frequency":
      return { column: g };
    case "correlation":
      return { columns: num.slice(0, 2) };
    case "normality":
      return { column: a, method: "shapiro-wilk" };
    case "ttest":
      return { col1: a, col2: b, type: "independent" };
    case "anova":
    case "holistic":
    case "welchAnova":
    case "levene":
      return { response: a, group: g };
    case "regression":
      return { target: a, predictors: num.slice(1, 3) };
    case "vif":
      return { cols: num.slice(0, 2) };
    case "mannWhitney":
      return { col: a, group: g, g1: "A", g2: "B" };
    case "kruskalWallis":
      return { col: a, group: g };
    case "chiSquare":
    case "fisherExact":
      return { col1: g, col2: cat[1] ?? g };
    case "wilcoxon":
      return { col1: a, col2: b };
    case "tost":
    case "tostMean":
      return { col: a, low: -1, high: 1 };
    case "binomial":
      return { col: g, success: "A" };
    case "mcnemar":
      return { col1: g, col2: cat[1] ?? g };
    case "gofChisquare":
      return { col: g };
    case "twoWayAnova":
      return { responseCol: a, factorA: g, factorB: cat[1] ?? g };
    case "repeatedAnova":
      return { valueCol: a, subjectCol: g, withinCol: cat[1] ?? g };
    case "friedman":
      return { columns: num.slice(0, 2) };
    case "partialCorrelation":
      return { colA: a, colB: b, control: num[2] ?? a };
    case "pointBiserial":
      return { catCol: g, numCol: a };
    case "logisticRegression":
    case "ridgeRegression":
    case "lassoRegression":
      return { target: a, predictors: num.slice(1, 3) };
    case "moderation":
      return { target: a, predictor: b, moderator: num[2] ?? a };
    case "mediation":
      return { target: a, predictor: b, mediator: num[2] ?? a };
    default:
      return {};
  }
}

/** A valid result object for `action` (passes callStatsApi's validateOutput). */
export function resultForAction(
  action: string,
  columns: string[] = ["col1", "col2"],
): unknown {
  const [a, b] = columns;
  switch (action) {
    case "descriptive":
      return {
        column: a,
        count: 10,
        missing: 0,
        missingPct: 0,
        mean: 5,
        std: 1.5,
      };
    case "frequency":
      return {
        column: a,
        entries: [{ value: "x", count: 3, pct: 30 }],
        totalUnique: 1,
      };
    case "correlation":
      return correlationMatrix(columns.slice(0, 2), 0.5);
    case "pairCorrelation":
      return { r: 0.5, pValue: 0.05, c1: a, c2: b };
    case "normality":
      return {
        column: a,
        test: "Shapiro-Wilk",
        statistic: 0.98,
        pValue: 0.4,
        isNormal: true,
        skewness: 0.1,
        kurtosis: -0.2,
      };
    case "ttest":
      return {
        type: "independent",
        column1: a,
        column2: b,
        t: 2.1,
        df: 18,
        pValue: 0.05,
        significant: true,
        cohensD: 0.9,
        meanDiff: 3,
      };
    case "anova":
      return {
        factor: "group",
        responseVar: a,
        F: 4.2,
        dfBetween: 2,
        dfWithin: 27,
        pValue: 0.02,
        etaSquared: 0.2,
        significant: true,
        tukey: [],
      };
    case "holistic":
      // Omnibus holistic check reuses the one-way ANOVA engine (same as the
      // UI's testsRunner holistic task): F + share-of-variance story.
      return {
        factor: "group",
        responseVar: a,
        F: 4.2,
        dfBetween: 2,
        dfWithin: 27,
        pValue: 0.02,
        etaSquared: 0.2,
        significant: true,
        tukey: [],
      };
    case "welchAnova":
      return {
        factor: "group",
        responseVar: a,
        F: 4.2,
        dfNum: 2,
        dfDen: 25,
        pValue: 0.02,
        significant: true,
      };
    case "levene":
      return {
        F: 1.1,
        dfBetween: 2,
        dfWithin: 27,
        pValue: 0.35,
        significant: false,
        equalVariances: true,
      };
    case "regression":
      return {
        dependentVar: a,
        predictors: [b],
        coefficients: { [b]: 1.2 },
        intercept: 1,
        rSquared: 0.6,
        adjRSquared: 0.58,
        fStatistic: 12,
        fPValue: 0.001,
        pValues: { [b]: 0.01 },
        stdErrors: { [b]: 0.3 },
      };
    case "vif":
      return { predictors: [a, b], vif: { [a]: 1.2, [b]: 1.1 }, flagged: [] };
    case "mannWhitney":
      return {
        column: a,
        group1: "A",
        group2: "B",
        U: 12,
        pValue: 0.3,
        significant: false,
      };
    case "kruskalWallis":
      return { column: a, H: 2.1, df: 2, pValue: 0.3, significant: false };
    case "chiSquare":
      return {
        column1: a,
        column2: b,
        chiSq: 3.2,
        df: 1,
        pValue: 0.07,
        significant: false,
        cramersV: 0.4,
      };
    case "fisherExact":
      return { pValue: 0.2, oddsRatio: 1.5, significant: false };
    case "wilcoxon":
      return {
        column1: a,
        column2: b,
        n: 10,
        W: 15,
        statistic: 15,
        pValue: 0.4,
        effectR: 0.1,
        significant: false,
        medianDiff: 0.5,
      };
    case "tost":
    case "tostMean":
      return {
        test: "TOST",
        pValue: 0.9,
        p_low: 0.05,
        p_high: 0.05,
        significant: true,
        equivalent: true,
        ci: [-0.5, 0.5],
        low: -1,
        high: 1,
      };
    case "binomial":
      return {
        test: "binomial",
        column: a,
        k: 5,
        n: 10,
        p_hat: 0.5,
        pValue: 0.6,
        significant: false,
      };
    case "groupValues":
      return { column: a, values: ["x", "y"] };
    case "cleaningStats":
      return { rowsRemoved: 2, columnsRemoved: 1 };
    case "rankColumns":
      return { ranked: [{ column: a, score: 0.9 }] };
    case "detectIdentifierColumns":
      return { identifierColumns: [a] };
    case "kendallTau":
      return {
        tau: 0.3,
        pValue: 0.2,
        significant: false,
        n: 10,
        method: "kendall",
      };
    case "mcnemar":
      return {
        test: "McNemar",
        a: 3,
        b: 1,
        c: 2,
        d: 4,
        n: 10,
        pValue: 0.5,
        significant: false,
      };
    case "gofChisquare":
      return {
        test: "Chi-square GOF",
        column: a,
        categories: ["x", "y"],
        observed: [5, 5],
        expected: [5.0, 5.0],
        df: 1,
        pValue: 0.15,
        lowExpectedWarning: false,
      };
    case "twoWayAnova":
      return {
        test: "Two-way ANOVA",
        value_col: a,
        factor_a: { F: 2.1, pValue: 0.1, significant: false, etaSquared: 0.1 },
        factor_b: { F: 1.2, pValue: 0.3, significant: false, etaSquared: 0.05 },
        interaction: {
          F: 0.8,
          pValue: 0.5,
          significant: false,
          etaSquared: 0.02,
        },
        n: 20,
      };
    case "repeatedAnova":
      return {
        test: "Repeated measures ANOVA",
        value_col: a,
        within: b,
        subject: "subject",
        F: 3.1,
        pValue: 0.09,
        pValueGG: 0.1,
        epsilon: 0.8,
        significant: false,
        significantGG: false,
        n: 20,
      };
    case "friedman":
      return {
        test: "Friedman",
        pValue: 0.4,
        significant: false,
        W: 0.2,
        k: 2,
        columns: [a, b],
      };
    case "partialCorrelation":
      return {
        x: a,
        y: b,
        z: [a],
        r: 0.4,
        pValue: 0.1,
        significant: false,
        n: 20,
        df: 17,
      };
    case "pointBiserial":
      return {
        binary: a,
        numeric: b,
        r: 0.5,
        pValue: 0.05,
        significant: true,
        n: 20,
      };
    case "logisticRegression":
      return {
        test: "Logistic regression",
        target: a,
        predictors: [b],
        n: 20,
        coefficients: {
          [b]: { coef: 0.5, se: 0.2, pValue: 0.05, ci: [0.1, 0.9] },
        },
        intercept: 0.1,
        auc: 0.75,
        converged: true,
      };
    case "ridgeRegression":
    case "lassoRegression":
      return {
        test: "Ridge regression",
        target: a,
        predictors: [b],
        alpha: 1.0,
        coefficients: { [b]: 0.4 },
        intercept: 0.2,
        n: 20,
      };
    case "moderation":
      return {
        test: "Moderation",
        target: a,
        predictor: b,
        moderator: a,
        interaction_coef: 0.3,
        interaction_p: 0.2,
        significant: false,
        rSquared: 0.5,
        n: 20,
      };
    case "mediation":
      return {
        test: "Mediation",
        target: a,
        predictor: b,
        mediator: a,
        a: 0.4,
        b: 0.5,
        c: 0.3,
        c_prime: 0.1,
        indirect: 0.2,
        sobel_z: 2.1,
        prop_mediated: 0.6,
        n: 20,
      };
    case "andersonDarling":
      return {
        column: a,
        test: "Anderson-Darling",
        statistic: 0.75,
        criticalValues: [0.576, 0.656, 0.787, 0.918],
        significanceLevel: 0.05,
        reject: false,
        significant: false,
        n: 20,
      };
    case "kolmogorovSmirnov":
      return {
        column: a,
        test: "Kolmogorov-Smirnov",
        statistic: 0.12,
        pValue: 0.6,
        significant: false,
        n: 20,
      };
    case "cramerVonMises":
      return {
        column: a,
        test: "Cramér-von Mises",
        statistic: 0.08,
        pValue: 0.5,
        significant: false,
        n: 20,
      };
    case "jarqueBera":
      return {
        column: a,
        test: "Jarque-Bera",
        statistic: 1.1,
        pValue: 0.58,
        significant: false,
        n: 20,
      };
    case "bartlett":
      return {
        statistic: 2.4,
        pValue: 0.3,
        significant: false,
        equalVariances: true,
        nGroups: 3,
      };
    case "fligner":
      return {
        statistic: 1.8,
        pValue: 0.4,
        significant: false,
        equalVariances: true,
      };
    case "ansari":
      return { column: a, statistic: 30, pValue: 0.45, significant: false };
    case "moodMedian":
      return {
        column: a,
        statistic: 0.9,
        pValue: 0.34,
        significant: false,
        median: 5,
      };
    case "brunnerMunzel":
      return { column: a, statistic: 0.5, pValue: 0.62, significant: false };
    case "tukeyHSD":
      return {
        pairs: [
          {
            group1: "A",
            group2: "B",
            meandiff: 1.5,
            pAdj: 0.03,
            lower: 0.2,
            upper: 2.8,
            reject: true,
          },
        ],
        alpha: 0.05,
        n: 30,
        k: 3,
      };
    case "dunnTest":
      return {
        pairs: [
          {
            group1: "A",
            group2: "B",
            U: 12,
            pValue: 0.04,
            pAdj: 0.12,
            significant: false,
          },
        ],
        method: "bonferroni",
        k: 3,
      };
    case "dunnett":
      return {
        pairs: [
          {
            group: "B",
            control: "A",
            statistic: 2.2,
            pValue: 0.04,
            significant: true,
          },
        ],
        control: "A",
        method: "dunnett",
      };
    case "gamesHowell":
      return {
        pairs: [
          {
            group1: "A",
            group2: "B",
            meanDiff: 1.5,
            t: 2.4,
            df: 18.5,
            q: 3.4,
            k: 3,
            pValue: 0.03,
            significant: true,
          },
        ],
        k: 3,
        n: 30,
        method: "games-howell",
      };
    case "multipletests":
      return {
        method: "bonferroni",
        alpha: 0.05,
        original: [0.01, 0.04, 0.3],
        corrected: [0.03, 0.12, 0.9],
        reject: [true, false, false],
        n: 3,
      };
    case "holm":
      return {
        method: "holm",
        alpha: 0.05,
        original: [0.01, 0.04, 0.3],
        corrected: [0.03, 0.08, 0.3],
        reject: [true, false, false],
        n: 3,
      };
    case "sidak":
      return {
        method: "sidak",
        alpha: 0.05,
        original: [0.01, 0.04, 0.3],
        corrected: [0.03, 0.11, 0.65],
        reject: [true, false, false],
        n: 3,
      };
    case "fdrBy":
      return {
        method: "fdr_by",
        alpha: 0.05,
        original: [0.01, 0.04, 0.3],
        corrected: [0.03, 0.08, 0.4],
        reject: [true, false, false],
        n: 3,
      };
    case "boxcox":
      return { transformed: [1.1, 1.4, 1.2], lambda: 0.5, n: 3 };
    case "yeojohnson":
      return { transformed: [0.9, 1.3, 1.1], lambda: 1.0, n: 3 };
    case "bootstrapCI":
      return {
        statistic: 5.0,
        estimate: 5.0,
        ciLow: 4.2,
        ciHigh: 5.8,
        confidenceLevel: 0.95,
        n: 20,
      };
    case "permutationTest":
      return { column: a, statistic: 1.9, pValue: 0.06, significant: false };
    case "breuschPagan":
      return {
        lmStatistic: 2.2,
        pValue: 0.33,
        fStatistic: 1.1,
        fPValue: 0.35,
        significant: false,
        homoscedastic: true,
      };
    case "durbinWatson":
      return {
        durbinWatson: 1.9,
        interpretation: "no autocorrelation",
        n: 20,
      };
    case "cooksDistance":
      return {
        cooksDistance: [0.01, 0.02, 0.5],
        threshold: 0.2,
        flaggedIndices: [2],
        flaggedCount: 1,
        maxCook: 0.5,
      };
    default:
      return { pValue: 0.5, significant: false };
  }
}
