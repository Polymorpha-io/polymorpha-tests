/**
 * Cleaning-config generator — wraps `@polymorpha/business-logic`'s
 * `buildDefaultConfig` and provides mutators + combinatorial matrices for
 * `applyCleaningConfig` / `validateCleaningConfig` matrix tests.
 */
import { buildDefaultConfig } from "@polymorpha/business-logic";
import type {
  CategoryMapping,
  CleaningConfig,
  Dataset,
  DatePart,
  EncodingType,
  MathTransform,
  MissingConfig,
  MissingStrategy,
  OutlierAction,
  OutlierConfig,
  OutlierMethod,
  RowFilterOperator,
  SampleMethod,
  ScaleMethod,
  StringCaseMode,
  StringMatchMode,
} from "@/types";
import { makeDataset, presets } from "./dataset";

/** Fresh default config for a dataset, then apply `patch`. */
export function makeCleaningConfig(
  dataset: Dataset,
  patch: Partial<CleaningConfig> = {},
): CleaningConfig {
  const config = structuredClone(buildDefaultConfig(dataset));
  return { ...config, ...patch };
}

// ── Mutators (builder pattern) ───────────────────────────────────────

export interface CleaningConfigBuilder {
  config: CleaningConfig;
  withMissing: (
    col: string,
    strategy: MissingStrategy,
    extra?: Partial<MissingConfig>,
  ) => CleaningConfigBuilder;
  withOutliers: (
    col: string,
    method: OutlierMethod,
    action: OutlierAction,
    extra?: Partial<OutlierConfig>,
  ) => CleaningConfigBuilder;
  withStringCleaning: (
    patch?: Partial<CleaningConfig["stringCleaning"]>,
  ) => CleaningConfigBuilder;
  withTypeConversion: (
    patch?: Partial<CleaningConfig["typeConversion"]>,
  ) => CleaningConfigBuilder;
  withRowFilter: (
    column: string,
    operator: RowFilterOperator,
    value?: string,
  ) => CleaningConfigBuilder;
  withSampling: (method: SampleMethod, count?: number) => CleaningConfigBuilder;
  withScaling: (
    col: string,
    method: ScaleMethod,
    extra?: Partial<CleaningConfig["scaling"][string]>,
  ) => CleaningConfigBuilder;
  withEncoding: (
    col: string,
    type: EncodingType,
    extra?: Partial<CleaningConfig["encodings"][string]>,
  ) => CleaningConfigBuilder;
  withMathTransform: (
    col: string,
    transform: MathTransform,
  ) => CleaningConfigBuilder;
  withRename: (from: string, to: string) => CleaningConfigBuilder;
  withRemoveColumns: (...cols: string[]) => CleaningConfigBuilder;
  withDedupe: (enabled?: boolean, subset?: string[]) => CleaningConfigBuilder;
  withStringReplace: (
    col: string,
    find: string,
    replace: string,
    matchMode?: StringMatchMode,
  ) => CleaningConfigBuilder;
  withCategoryMappings: (
    col: string,
    mappings: CategoryMapping["mappings"],
  ) => CleaningConfigBuilder;
  withThreshold: (pct: number) => CleaningConfigBuilder;
  withCaseMode: (mode: StringCaseMode) => CleaningConfigBuilder;
  withDateExtraction: (col: string, parts: DatePart[]) => CleaningConfigBuilder;
  withDerivedColumn: (
    name: string,
    expression: string,
  ) => CleaningConfigBuilder;
  build: () => CleaningConfig;
}

/** Fluent builder over a fresh default config. */
export function configBuilder(dataset: Dataset): CleaningConfigBuilder {
  const config = makeCleaningConfig(dataset);
  const api: CleaningConfigBuilder = {
    config,
    withMissing(col, strategy, extra = {}) {
      config.missing[col] = {
        strategy,
        constantValue: "",
        addIndicator: false,
        ...extra,
      };
      return api;
    },
    withOutliers(col, method, action, extra = {}) {
      config.outliers[col] = {
        ...config.outliers[col],
        method,
        action,
        ...extra,
      };
      return api;
    },
    withStringCleaning(patch = {}) {
      config.stringCleaning = {
        ...config.stringCleaning,
        enabled: true,
        ...patch,
      };
      return api;
    },
    withTypeConversion(patch = {}) {
      config.typeConversion = {
        ...config.typeConversion,
        enabled: true,
        ...patch,
      };
      return api;
    },
    withRowFilter(column, operator, value = "") {
      config.rowFilter = { enabled: true, column, operator, value };
      return api;
    },
    withSampling(method, count = 3) {
      config.sampling = { enabled: true, method, count };
      return api;
    },
    withScaling(col, method, extra = {}) {
      config.scaling[col] = { method, outputMin: 0, outputMax: 1, ...extra };
      return api;
    },
    withEncoding(col, type, extra = {}) {
      config.encodings[col] = { type, ...extra };
      return api;
    },
    withMathTransform(col, transform) {
      config.mathTransforms.push({ column: col, transform });
      return api;
    },
    withRename(from, to) {
      config.renameColumns.push({ from, to });
      return api;
    },
    withRemoveColumns(...cols) {
      config.removeColumns.push(...cols);
      return api;
    },
    withDedupe(enabled = true, subset: string[] = []) {
      config.duplicates = { enabled, subsetColumns: subset };
      return api;
    },
    withStringReplace(col, find, replace, matchMode = "contains") {
      config.stringReplace.push({
        column: col,
        find,
        replace,
        caseSensitive: false,
        matchMode,
      });
      return api;
    },
    withCategoryMappings(col, mappings) {
      config.categoryMappings.push({ column: col, mappings });
      return api;
    },
    withThreshold(pct) {
      config.missingRowThresholdPct = pct;
      return api;
    },
    withCaseMode(mode) {
      config.stringCleaning = {
        ...config.stringCleaning,
        enabled: true,
        caseMode: mode,
      };
      return api;
    },
    withDateExtraction(col, parts) {
      config.dateExtraction.push({ column: col, parts });
      return api;
    },
    withDerivedColumn(name, expression) {
      config.derivedColumns.push({ name, expression });
      return api;
    },
    build: () => config,
  };
  return api;
}

// ── Matrices for describe.each ───────────────────────────────────────

export const MISSING_STRATEGIES: MissingStrategy[] = [
  "drop",
  "mean",
  "median",
  "mode",
  "constant",
  "ffill",
  "bfill",
  "none",
];

export const OUTLIER_METHODS: OutlierMethod[] = [
  "iqr",
  "zscore",
  "percentile",
  "manual",
  "none",
];

export const OUTLIER_ACTIONS: OutlierAction[] = [
  "remove",
  "winsorize",
  "flag",
  "nullify",
];

export const ROW_FILTER_OPERATORS: RowFilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "notContains",
  "isEmpty",
  "notEmpty",
];

export const SAMPLE_METHODS: SampleMethod[] = [
  "none",
  "head",
  "tail",
  "random",
];

export const SCALE_METHODS: ScaleMethod[] = [
  "none",
  "minmax",
  "zscore",
  "robust",
];

export const ENCODING_TYPES: EncodingType[] = [
  "none",
  "binary",
  "label",
  "onehot",
  "ordinal",
  "frequency",
];

export const MATH_TRANSFORMS: MathTransform[] = [
  "log",
  "log2",
  "log10",
  "sqrt",
  "square",
  "reciprocal",
];

export const STRING_CASE_MODES: StringCaseMode[] = [
  "none",
  "lower",
  "upper",
  "title",
];

export const STRING_MATCH_MODES: StringMatchMode[] = [
  "contains",
  "exact",
  "startsWith",
  "endsWith",
  "wholeWord",
  "regex",
];

/**
 * Valid config variants — each entry is a dataset builder + config patch
 * that must apply without throwing.
 */
export interface CleaningCase {
  label: string;
  dataset: () => Dataset;
  patch: (d: Dataset) => CleaningConfig;
}

/**
 * Invalid config variants — each must produce at least one warning from
 * `validateCleaningConfig`.
 */
export interface CleaningWarningCase {
  label: string;
  dataset: () => Dataset;
  patch: (d: Dataset) => CleaningConfig;
  /** expected warning message substring (optional) */
  message?: string;
}

export const VALID_CLEANING_CASES: CleaningCase[] = [
  {
    label: "mean impute missing",
    dataset: () => makeDatasetFixture("missing"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d).withMissing(num!.name, "mean").build();
    },
  },
  {
    label: "constant fill missing",
    dataset: () => makeDatasetFixture("missing"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d)
        .withMissing(num!.name, "constant", { constantValue: "0" })
        .build();
    },
  },
  {
    label: "iqr remove outliers",
    dataset: () => makeDatasetFixture("outliers"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d).withOutliers(num!.name, "iqr", "remove").build();
    },
  },
  {
    label: "zscore winsorize outliers",
    dataset: () => makeDatasetFixture("outliers"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d)
        .withOutliers(num!.name, "zscore", "winsorize")
        .build();
    },
  },
  {
    label: "title-case string cleaning",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d)
        .withCaseMode("title")
        .withStringCleaning({ trim: true })
        .build(),
  },
  {
    label: "log transform numeric column",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d).withMathTransform(num!.name, "log").build();
    },
  },
  {
    label: "minmax scaling",
    dataset: () => makeDatasetFixture("correlation"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d).withScaling(num!.name, "minmax").build();
    },
  },
  {
    label: "label encoding categorical",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) => {
      const cat = d.columns.find((c) => c.type === "categorical");
      return configBuilder(d).withEncoding(cat!.name, "label").build();
    },
  },
  {
    label: "dedupe rows",
    dataset: () => makeDatasetFixture("duplicates"),
    patch: (d) => configBuilder(d).withDedupe().build(),
  },
  {
    label: "remove columns",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d).withRemoveColumns(d.columns[0]!.name).build(),
  },
  {
    label: "row filter gt",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d).withRowFilter(num!.name, "gt", "20").build();
    },
  },
  {
    label: "rename column",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d).withRename(d.columns[0]!.name, "renamed_0").build(),
  },
  {
    label: "derived column ratio",
    dataset: () => makeDatasetFixture("correlation"),
    patch: (d) => {
      const [a, b] = d.columns;
      return configBuilder(d)
        .withDerivedColumn("ratio", `${a!.name} / ${b!.name}`)
        .build();
    },
  },
  {
    label: "date part extraction",
    dataset: () => makeDatasetFixture("dates"),
    patch: (d) => {
      const dateCol = d.columns.find((c) => c.type === "date");
      return configBuilder(d)
        .withDateExtraction(dateCol!.name, ["year", "month"])
        .build();
    },
  },
  {
    label: "sampling head",
    dataset: () => makeDatasetFixture("large"),
    patch: (d) => configBuilder(d).withSampling("head", 5).build(),
  },
];

export const INVALID_CLEANING_CASES: CleaningWarningCase[] = [
  {
    label: "row filter references missing column",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d).withRowFilter("does_not_exist", "eq", "x").build(),
    message: "does not exist",
  },
  {
    label: "constant fill without value",
    dataset: () => makeDatasetFixture("missing"),
    patch: (d) => {
      const num = d.columns.find((c) => c.type === "numeric");
      return configBuilder(d)
        .withMissing(num!.name, "constant", { constantValue: "" })
        .build();
    },
    message: "no value is specified",
  },
  {
    label: "missing config for removed column",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d)
        .withRemoveColumns(d.columns[0]!.name)
        .withMissing("ghost_col", "mean")
        .build(),
    message: "no longer exists",
  },
  {
    label: "string replace empty find",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d).withStringReplace(d.columns[0]!.name, "", "x").build(),
    message: "empty",
  },
  {
    label: "math transform on missing column",
    dataset: () => makeDatasetFixture("mixed"),
    patch: (d) =>
      configBuilder(d).withMathTransform("ghost_col", "log").build(),
  },
];

/** Convenience — named fixture datasets without importing the presets module. */
export function makeDatasetFixture(name: keyof typeof presets): Dataset {
  return presets[name]();
}
