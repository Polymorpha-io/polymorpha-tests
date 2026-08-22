// Core data model

import { Columns as Cols } from "@/constants/schema";

export type ColumnType = (typeof Cols)[keyof typeof Cols];

export interface Column {
  name: string;
  type: ColumnType;
  detectedType: ColumnType; // original auto-detected, before user override
}

export type Row = Record<string, unknown>;

export interface Dataset {
  columns: Column[];
  rows: Row[];
  fileName: string;
  uploadedAt: Date;
}

/** Generic cache entry wrapper used by CacheService (T2/T3) */
export interface CacheEntry<T> {
  value: T;
  timestamp: number; // Date.now() when cached
}

// Cleaning config

export type MissingStrategy =
  "drop" | "mean" | "median" | "mode" | "constant" | "ffill" | "bfill" | "none";
export type OutlierMethod = "iqr" | "zscore" | "percentile" | "manual" | "none";
export type OutlierAction = "remove" | "winsorize" | "flag" | "nullify";
export type StringCaseMode = "none" | "lower" | "upper" | "title";
export type NumericParseMode = "strict" | "lenient";
export type DateParseMode = "none" | "iso" | "flexible";
export type RowFilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "notEmpty";
export type SampleMethod = "none" | "head" | "tail" | "random";
export type ScaleMethod = "none" | "minmax" | "zscore" | "robust";

export interface MissingConfig {
  strategy: MissingStrategy;
  constantValue?: string;
  addIndicator?: boolean;
}

export interface DuplicateConfig {
  enabled: boolean;
  subsetColumns: string[]; // empty = all columns
}

export interface OutlierConfig {
  method: OutlierMethod;
  action: OutlierAction;
  iqrQ1Pct?: number;
  iqrQ3Pct?: number;
  iqrMultiplier?: number;
  zThreshold?: number;
  percentileLower?: number;
  percentileUpper?: number;
  manualLower?: number | null;
  manualUpper?: number | null;
}

export interface TypeOverride {
  columnName: string;
  type: ColumnType;
}

export interface StringCleaningConfig {
  enabled: boolean;
  trim: boolean;
  caseMode: StringCaseMode;
  regexPattern: string;
  regexReplacement: string;
}

export interface TypeConversionConfig {
  enabled: boolean;
  numericParseMode: NumericParseMode;
  booleanConversion: boolean;
  dateParseMode: DateParseMode;
}

export interface RowFilterRule {
  enabled: boolean;
  column: string;
  operator: RowFilterOperator;
  value: string;
}

export interface SampleConfig {
  enabled?: boolean;
  method: SampleMethod;
  count: number;
}

export interface ColumnRenameRule {
  from: string;
  to: string;
}

export interface ScalingConfig {
  method: ScaleMethod;
  outputMin?: number;
  outputMax?: number;
}

export type SortDirection = "asc" | "desc";
export interface SortRule {
  column: string;
  direction: SortDirection;
}

export interface BinRule {
  column: string;
  bins: number;
  labels?: string[];
}

export type DatePart = "year" | "month" | "dayOfWeek" | "hour" | "quarter";
export interface DateExtractionRule {
  column: string;
  parts: DatePart[];
}

export interface DerivedColumnRule {
  name: string;
  expression: string; // e.g. "col_a / col_b"
}

export type StringMatchMode =
  "contains" | "exact" | "startsWith" | "endsWith" | "wholeWord" | "regex";

export interface StringReplaceRule {
  column: string;
  find: string;
  replace: string;
  caseSensitive: boolean;
  matchMode: StringMatchMode;
}

export interface CategoryMapping {
  column: string;
  mappings: Array<{ from: string[]; to: string }>;
}

export type MathTransform =
  "log" | "log2" | "log10" | "sqrt" | "square" | "reciprocal";
export interface MathTransformRule {
  column: string;
  transform: MathTransform;
}

export interface LagLeadRule {
  column: string;
  offset: number; // positive = lag, negative = lead
  newName?: string;
}

export interface InteractionRule {
  columnA: string;
  columnB: string;
  operation: "multiply" | "add" | "subtract" | "divide";
}

export interface CleaningConfig {
  missing: Record<string, MissingConfig>; // keyed by column name
  missingRowThresholdPct: number | null;
  duplicates: DuplicateConfig;
  outliers: Record<string, OutlierConfig>; // keyed by column name (numeric only)
  removeColumns: string[];
  typeOverrides: TypeOverride[];
  stringCleaning: StringCleaningConfig;
  typeConversion: TypeConversionConfig;
  rowFilter: RowFilterRule;
  sampling: SampleConfig;
  trimColumnNames: boolean;
  renameColumns: ColumnRenameRule[];
  scaling: Record<string, ScalingConfig>;
  encodings: Record<string, EncodingConfig>; // keyed by column name (categorical only)
  sortRules: SortRule[];
  binRules: BinRule[];
  dateExtraction: DateExtractionRule[];
  derivedColumns: DerivedColumnRule[];
  stringReplace: StringReplaceRule[];
  categoryMappings: CategoryMapping[];
  mathTransforms: MathTransformRule[];
  lagLeadRules: LagLeadRule[];
  interactionTerms: InteractionRule[];
}

export interface CleaningDiff {
  rowsRemoved: number;
  rowsModified: number;
  columnsRemoved: number;
  rowsRemovedFromMissing: number;
  rowsRemovedFromOutliers: number;
  rowsRemovedFromThreshold: number;
  rowsRemovedFromFilter: number;
  valuesImputed: Record<string, number>; // column → count of imputed values
  outliersHandled: Record<string, number>; // column → count
  indicatorColumnsAdded: string[];
  renamedColumns: number;
  scaledColumns: string[];
  sampledRows: number;
  duplicatesRemoved: number;
  encodingLog: EncodingLog[];
  columnsAdded: string[];
  stringReplacesApplied: number;
  categoryMappingsApplied: number;
  mathTransformsApplied: number;
  sortApplied: boolean;
}

// Feature Engineering

export type EncodingType =
  "none" | "binary" | "label" | "onehot" | "ordinal" | "frequency";

export interface EncodingConfig {
  type: EncodingType;
  ordinalOrder?: string[]; // for ordinal: sorted from low→high
  dropFirst?: boolean;
}

export interface EncodingLog {
  column: string;
  type: EncodingType;
  newColumns: string[]; // original col (label/binary/ordinal) or new cols (onehot)
  mapping: string; // human-readable preview
}

// Statistics results

export interface DescriptiveStats {
  column: string;
  count: number;
  missing: number;
  missingPct: number;
  mean: number;
  median: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
}

export interface FrequencyEntry {
  value: string;
  count: number;
  pct: number;
}

export interface FrequencyTable {
  column: string;
  entries: FrequencyEntry[];
  totalUnique?: number;
}

export interface CorrelationMatrix {
  columns: string[];
  values: number[][];
  method?: "pearson" | "spearman";
}

export interface NormalityResult {
  column: string;
  test: "Shapiro-Wilk" | "Lilliefors";
  statistic: number;
  pValue: number;
  isNormal: boolean; // p > 0.05
  skewness: number;
  kurtosis: number;
  /** Histogram bins for gaussian overlay chart */
  histogram?: {
    binEdges: number[];
    counts: number[];
    mean: number;
    std: number;
  };
  /** Q-Q plot data: theoretical quantiles vs sample quantiles */
  qqPlot?: { theoretical: number[]; sample: number[] };
}

// t-test
export type TTestType = "one-sample" | "independent" | "paired";

export interface TTestResult {
  type: TTestType;
  column1: string;
  column2?: string; // for independent/paired
  mu?: number; // for one-sample
  t: number;
  df: number;
  pValue: number;
  meanDiff: number;
  /** 95% confidence interval for mean difference */
  ci?: [number, number];
  cohensD: number;
  significant: boolean;
  n?: number; // for paired
}

// ANOVA
export interface AnovaGroup {
  label: string;
  values: number[];
}

export interface TukeyComparison {
  groupA: string;
  groupB: string;
  meanDiff: number;
  pAdj: number;
  significant: boolean;
}

export interface AnovaResult {
  factor: string;
  responseVar: string;
  F: number;
  dfBetween: number;
  dfWithin: number;
  pValue: number;
  etaSquared: number;
  /** Less biased effect size estimator */
  omegaSquared?: number;
  significant: boolean;
  tukey: TukeyComparison[];
}

// Regression
export interface RegressionResult {
  dependentVar: string;
  predictors: string[];
  coefficients: Record<string, number>; // predictor → β
  intercept: number;
  interceptCi?: [number, number];
  rSquared: number;
  adjRSquared: number;
  fStatistic: number;
  fPValue: number;
  pValues: Record<string, number>;
  stdErrors: Record<string, number>;
  /** 95% confidence intervals per predictor */
  ci?: Record<string, [number, number]>;
  n?: number;
  dfResid?: number;
}

// Non-parametric
export interface MannWhitneyResult {
  column: string;
  group1: string;
  group2: string;
  U: number;
  pValue: number;
  significant: boolean;
}

export interface WilcoxonResult {
  column1: string;
  column2: string;
  n: number;
  W: number;
  pValue: number;
  /** Effect size r = Z / sqrt(N) */
  effectR: number;
  significant: boolean;
  medianDiff: number;
}

export interface DunnComparison {
  group1: string;
  group2: string;
  z: number;
  pValue: number;
  significant: boolean;
}

export interface KruskalWallisResult {
  column: string;
  H: number;
  df: number;
  pValue: number;
  significant: boolean;
  /** Dunn's post-hoc pairwise comparisons (Bonferroni-corrected) */
  dunn?: DunnComparison[];
}

export interface ChiSquareResult {
  column1: string;
  column2: string;
  chiSq: number;
  df: number;
  pValue: number;
  significant: boolean;
  cramersV: number;
  lowExpectedWarning?: boolean;
}

export interface VifResult {
  predictors: string[];
  vif: Record<string, number>;
  flagged: string[]; // VIF > 5
}

export interface LeveneResult {
  F: number;
  dfBetween: number;
  dfWithin: number;
  pValue: number;
  significant: boolean;
  equalVariances: boolean;
}

export interface WelchAnovaResult {
  factor: string;
  responseVar: string;
  F: number;
  dfNum: number;
  dfDen: number;
  pValue: number;
  significant: boolean;
}

// Data Operations (Power Query Inspired)

export type JoinType = "left" | "right" | "inner" | "full";

export interface AggregationDef {
  newColumn: string;
  operation: "count" | "sum" | "average" | "min" | "max";
  targetColumn?: string; // Not needed for 'count'
}

export type DataSourceType = "workspace" | "local" | "api";

export interface DataSourceDef {
  type: DataSourceType;
  uploadId?: string; // For workspace
  file?: File; // For local
  url?: string; // For API
}

export interface GroupOperationConfig {
  groupByCols: string[];
  aggregations: AggregationDef[];
}

export interface MergeOperationConfig {
  source: DataSourceDef;
  joinType: JoinType;
  leftKey: string;
  rightKey: string;
  behavior: "expand" | "aggregate";
  aggregations?: AggregationDef[]; // If aggregate behavior
}

export interface AppendOperationConfig {
  source: DataSourceDef;
}

export interface PivotOperationConfig {
  indexColumn: string;
  columnsToPivot: string;
  valuesColumn: string;
  aggregation: "count" | "sum" | "average" | "min" | "max";
}

export interface UnpivotOperationConfig {
  columnsToUnpivot: string[];
  variableColumnName: string;
  valueColumnName: string;
}

export interface RenameOperationConfig {
  column: string;
  newName: string;
}

export interface DropOperationConfig {
  column: string;
}

export interface ChangeTypeOperationConfig {
  column: string;
  newType: ColumnType;
}

export type DataOperationStepConfig =
  | ({ type: "group" } & GroupOperationConfig)
  | ({ type: "merge" } & MergeOperationConfig)
  | ({ type: "append" } & AppendOperationConfig)
  | ({ type: "pivot" } & PivotOperationConfig)
  | ({ type: "unpivot" } & UnpivotOperationConfig)
  | ({ type: "rename" } & RenameOperationConfig)
  | ({ type: "drop" } & DropOperationConfig)
  | ({ type: "changeType" } & ChangeTypeOperationConfig);

export interface DataOperationStep {
  id: string;
  description: string;
  config: DataOperationStepConfig;
}

// App state — extended

export type AppStep =
  "upload" | "model" | "preview" | "clean" | "stats" | "export";

export interface TOSTResult {
  test: string;
  pValue: number;
  p_low: number;
  p_high: number;
  significant: boolean;
  equivalent: boolean;
  ci: [number, number];
  low: number;
  high: number;
}
export interface BinomialResult {
  test: string;
  column: string;
  k: number;
  n: number;
  p_hat: number;
  pValue: number;
  significant: boolean;
}

export interface StatsResults {
  descriptive: DescriptiveStats[];
  frequencies: FrequencyTable[];
  correlation: CorrelationMatrix | null;
  normality: NormalityResult[];
  tTests: TTestResult[];
  anova: AnovaResult[];
  regression: RegressionResult[];
  mannWhitney: MannWhitneyResult[];
  kruskalWallis: KruskalWallisResult[];
  chiSquare: ChiSquareResult[];
}

export type PDFFontFamily = "Roboto" | "Helvetica" | "Times" | "Courier";

export interface ExportPreferences {
  includeExecutiveSummary: boolean;
  includeDataPreparation: boolean;
  includeDescriptive: boolean;
  includeFrequencies: boolean;
  includeCorrelation: boolean;
  includeNormality: boolean;
  includeTests: boolean;
  includeMethodology: boolean;
  includeVisuals: boolean;
  // Premium Visuals — Section A (per-column)
  includeHistograms: boolean;
  includeBoxPlots: boolean;
  includeQQPlots: boolean;
  includeBarCharts: boolean;
  includePieCharts: boolean;
  includeInlineColumnStats: boolean;
  // Premium Visuals — Section B (pairwise)
  includeScatterPlots: boolean;
  includeGroupedBoxPlots: boolean;
  includePairwiseTests: boolean;
  // Premium Visuals — Section C (multi-column)
  includeHeatmap: boolean;
  // Column selection (null = all columns included)
  includedColumns: string[] | null;
  // Frequency table columns (null = all categorical columns)
  frequencyColumns: string[] | null;
  // Descriptive section numeric columns (null = all numeric columns)
  descriptiveColumns: string[] | null;
  // Columns to generate visual charts for (empty = no visuals)
  visualColumns: string[];
  // Visuals explicitly selected from Analyse > Visualise
  includedVisualKeys: string[];
  // Per-visual color chosen in Analyse > Visualise
  visualKeyColors: Record<string, string>;
  // Visual-level exclusions (keys like hist:age, pie:sex, scatter:age__fare)
  excludedVisualKeys: string[];
  // Per-test-type export toggles (only applies when includeTests is true)
  exportTTests: boolean;
  exportAnova: boolean;
  exportMannWhitney: boolean;
  exportKruskalWallis: boolean;
  exportChiSquare: boolean;
  exportRegression: boolean;
  // PDF layout customization
  pdfFont: PDFFontFamily;
  includeHeader: boolean;
  includeFooter: boolean;
  includeAuthorName: boolean;
  includeLogo: boolean;
  includeCreationDate: boolean;
  authorName: string;
  location: string;
}

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = {
  includeExecutiveSummary: true,
  includeDataPreparation: true,
  includeDescriptive: true,
  includeFrequencies: true,
  includeCorrelation: true,
  includeNormality: true,
  includeTests: true,
  includeMethodology: true,
  includeVisuals: false,
  includeHistograms: true,
  includeBoxPlots: true,
  includeQQPlots: true,
  includeBarCharts: true,
  includePieCharts: true,
  includeInlineColumnStats: true,
  includeScatterPlots: true,
  includeGroupedBoxPlots: true,
  includePairwiseTests: true,
  includeHeatmap: true,
  includedColumns: null,
  frequencyColumns: null,
  descriptiveColumns: null,
  visualColumns: [],
  includedVisualKeys: [],
  visualKeyColors: {},
  excludedVisualKeys: [],
  exportTTests: true,
  exportAnova: true,
  exportMannWhitney: true,
  exportKruskalWallis: true,
  exportChiSquare: true,
  exportRegression: true,
  pdfFont: "Roboto",
  includeHeader: true,
  includeFooter: true,
  includeAuthorName: true,
  includeLogo: true,
  includeCreationDate: true,
  authorName: "",
  location: "",
};
