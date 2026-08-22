export const Columns = {
  Numeric: "numeric",
  Categorical: "categorical",
  Date: "date",
  Boolean: "boolean",
  Unknown: "unknown",
} as const;

export const ColumnsAbbr = {
  [Columns.Numeric]: "num",
  [Columns.Categorical]: "cat",
  [Columns.Date]: "date",
  [Columns.Boolean]: "bool",
  [Columns.Unknown]: "unk",
} as const;
