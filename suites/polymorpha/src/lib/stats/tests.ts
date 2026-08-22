import type {
  AnovaResult,
  ChiSquareResult,
  KruskalWallisResult,
  LeveneResult,
  MannWhitneyResult,
  RegressionResult,
  Row,
  TTestResult,
  TTestType,
  VifResult,
  WelchAnovaResult,
  WilcoxonResult,
} from "@/types";
import { callStatsApi } from "./api";

export interface FisherExactResult {
  column1: string;
  column2: string;
  pValue: number;
  significant: boolean;
  oddsRatio: number;
}

export interface PairCorrelationResult {
  c1: string;
  c2: string;
  r: number;
  pValue: number;
  method: string;
  n: number;
}

export interface Recommendation {
  title: string;
  body: string;
  tone: "action" | "caution" | "ok";
}

export function pairCorrelation(
  rows: Row[],
  column1: string,
  column2: string,
  method: "pearson" | "spearman" = "pearson",
): Promise<PairCorrelationResult> {
  return callStatsApi<PairCorrelationResult>("pairCorrelation", rows, {
    column1,
    column2,
    method,
  });
}

export function groupValues(
  rows: Row[],
  column: string,
  cap = 200,
): Promise<{ column: string; values: string[]; capped: boolean }> {
  return callStatsApi("groupValues", rows, { column, cap });
}

export function insight(params: {
  descriptive: unknown[];
  normality: unknown[];
  corrPairs: unknown[];
  totalRows: number;
  numCols: number;
  catCols: number;
}): Promise<{ text: string }> {
  return callStatsApi("insight", [], params);
}

export function recommendations(
  highlights: Array<{
    name: string;
    metric: string;
    detail: string;
    tone: string;
  }>,
): Promise<{ recommendations: Recommendation[] }> {
  return callStatsApi("recommendations", [], { highlights });
}

export function cleaningStats(
  rows: Row[],
  column: string,
  method: "iqr" | "zscore" | "percentile" = "iqr",
  options: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return callStatsApi("cleaningStats", rows, { column, method, ...options });
}

export function rankColumns(
  rows: Row[],
  columns: string[],
): Promise<{
  ranked: Array<{
    column: string;
    score: number;
    skewness: number;
    cv: number;
  }>;
}> {
  return callStatsApi("rankColumns", rows, { columns });
}

export function tTest(
  rows: Row[],
  col1: string,
  type: TTestType,
  options: { col2?: string; mu?: number } = {},
): Promise<TTestResult> {
  return callStatsApi<TTestResult>("ttest", rows, {
    column: col1,
    type,
    column2: options.col2,
    mu: options.mu,
  });
}

export function oneWayAnova(
  rows: Row[],
  numericCol: string,
  groupCol: string,
): Promise<AnovaResult> {
  return callStatsApi<AnovaResult>("anova", rows, {
    numericCol,
    groupCol,
    factor: groupCol,
    responseVar: numericCol,
  });
}

export function multipleRegression(
  rows: Row[],
  dependentVar: string,
  predictors: string[],
): Promise<RegressionResult> {
  return callStatsApi<RegressionResult>("regression", rows, {
    dependentVar,
    predictors,
  });
}

export function mannWhitneyU(
  rows: Row[],
  colName: string,
  groupCol: string,
  group1Label: string,
  group2Label: string,
): Promise<MannWhitneyResult> {
  return callStatsApi<MannWhitneyResult>("mannWhitney", rows, {
    column: colName,
    groupCol,
    group1Label,
    group2Label,
  });
}

export function kruskalWallis(
  rows: Row[],
  numericCol: string,
  groupCol: string,
): Promise<KruskalWallisResult> {
  return callStatsApi<KruskalWallisResult>("kruskalWallis", rows, {
    numericCol,
    groupCol,
    column: numericCol,
  });
}

export function chiSquare(
  rows: Row[],
  col1: string,
  col2: string,
): Promise<ChiSquareResult> {
  return callStatsApi<ChiSquareResult>("chiSquare", rows, {
    column1: col1,
    column2: col2,
  });
}

export function computeVif(
  rows: Row[],
  predictors: string[],
): Promise<VifResult> {
  return callStatsApi<VifResult>("vif", rows, { predictors });
}

export function leveneTest(
  rows: Row[],
  numericCol: string,
  groupCol: string,
): Promise<LeveneResult> {
  return callStatsApi<LeveneResult>("levene", rows, { numericCol, groupCol });
}

export function welchAnova(
  rows: Row[],
  numericCol: string,
  groupCol: string,
): Promise<WelchAnovaResult> {
  return callStatsApi<WelchAnovaResult>("welchAnova", rows, {
    numericCol,
    groupCol,
    factor: groupCol,
    responseVar: numericCol,
  });
}

export function fisherExact(
  rows: Row[],
  col1: string,
  col2: string,
): Promise<FisherExactResult> {
  return callStatsApi<FisherExactResult>("fisherExact", rows, {
    column1: col1,
    column2: col2,
  });
}

export function wilcoxonSignedRank(
  rows: Row[],
  col1: string,
  col2: string,
): Promise<WilcoxonResult> {
  return callStatsApi<WilcoxonResult>("wilcoxon", rows, {
    column: col1,
    column2: col2,
  });
}
