import type { Dataset, RowFilterOperator } from "@/types";
import type { CleanTreeGroup } from "./types";

export const TYPE_LABEL: Record<string, string> = {
  numeric: "NUM",
  categorical: "CAT",
  date: "DATE",
  boolean: "BOOL",
  unknown: "?",
};

export const EMPTY_DATASET: Dataset = {
  fileName: "",
  uploadedAt: new Date(0),
  rows: [],
  columns: [],
};

export const FILTER_OPERATORS: Array<{
  value: RowFilterOperator;
  label: string;
}> = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Does not equal" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "isEmpty", label: "Is empty" },
  { value: "notEmpty", label: "Is not empty" },
];

export const CLEAN_STEPS = {
  rowGate: "row-gate",
  sort: "sort",
  sampling: "sampling",
  missing: "missing",
  outliers: "outliers",
  duplicates: "duplicates",
  stringReplace: "string-replace",
  standardize: "standardize",
  typeConversion: "type-conversion",
  textCleanup: "text-cleanup",
  columns: "columns",
  mathTransform: "math-transform",
  encoding: "encoding",
  bin: "bin",
  dateExtract: "date-extract",
  derived: "derived",
  lagLead: "lag-lead",
  interaction: "interaction",
  exploreVisualise: "explore-visualise",
  exploreDescriptive: "explore-descriptive",
  exploreFrequency: "explore-frequency",
  columnState: "column-state",
} as const;

export const CLEAN_TREE_NAV_VARIANT = {
  Panel: "panel",
  Drawer: "drawer",
} as const;

export const CLEAN_TREE: CleanTreeGroup[] = [
  {
    group: "Pre-processing",
    items: [
      { id: CLEAN_STEPS.rowGate, label: "Row gate" },
      { id: CLEAN_STEPS.sort, label: "Sort rows" },
      { id: CLEAN_STEPS.sampling, label: "Row sampling" },
    ],
  },
  {
    group: "Data quality",
    items: [
      { id: CLEAN_STEPS.missing, label: "Missing values" },
      { id: CLEAN_STEPS.outliers, label: "Outliers" },
      { id: CLEAN_STEPS.duplicates, label: "Duplicates" },
      { id: CLEAN_STEPS.stringReplace, label: "String replace" },
      { id: CLEAN_STEPS.standardize, label: "Standardize categories" },
    ],
  },
  {
    group: "Transform",
    items: [
      { id: CLEAN_STEPS.typeConversion, label: "Type conversion" },
      { id: CLEAN_STEPS.textCleanup, label: "Text cleanup" },
      { id: CLEAN_STEPS.columns, label: "Columns & rename" },
      { id: CLEAN_STEPS.mathTransform, label: "Log/power transform" },
    ],
  },
  {
    group: "Feature engineering",
    items: [
      { id: CLEAN_STEPS.encoding, label: "Encoding" },
      { id: CLEAN_STEPS.bin, label: "Bin / discretize" },
      { id: CLEAN_STEPS.dateExtract, label: "Date extraction" },
      { id: CLEAN_STEPS.derived, label: "Derived columns" },
      { id: CLEAN_STEPS.lagLead, label: "Lag / lead" },
      { id: CLEAN_STEPS.interaction, label: "Interaction terms" },
    ],
  },
  {
    group: "Explore",
    configurable: false,
    items: [
      { id: CLEAN_STEPS.exploreVisualise, label: "Visualise" },
      { id: CLEAN_STEPS.exploreDescriptive, label: "Descriptive" },
      { id: CLEAN_STEPS.exploreFrequency, label: "Frequencies" },
    ],
  },
  {
    group: "Overview",
    configurable: false,
    items: [{ id: CLEAN_STEPS.columnState, label: "Column state" }],
  },
];
