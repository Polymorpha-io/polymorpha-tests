import { describe, it, expect } from "vitest";
import { stepToPython } from "@polymorpha/business-logic";
import type { StepCodeInput } from "@polymorpha/business-logic";

/**
 * [POLY-CELLS] Forward golden tests for the view-only renderers.
 * Law: every known op family renders real pandas (no fallback header),
 * view-only (editable false). Incomplete configs still degrade to the
 * fallback with the "incomplete config" marker — never a crash.
 */

const GOLDEN: [string, StepCodeInput, string][] = [
  [
    "pivot",
    {
      type: "pivot",
      indexColumn: "region",
      columnsToPivot: "year",
      valuesColumn: "revenue",
      aggregation: "sum",
    },
    "pd.pivot_table(",
  ],
  [
    "melt",
    {
      type: "melt",
      idVars: ["id"],
      valueVars: ["a"],
      varName: "k",
      valueName: "v",
    },
    "pd.melt(",
  ],
  [
    "unpivot",
    {
      type: "unpivot",
      columnsToUnpivot: ["a"],
      variableColumnName: "k",
      valueColumnName: "v",
    },
    "pd.melt(",
  ],
  ["explode", { type: "explode", column: "tags" }, `df.explode("tags")`],
  [
    "crosstab",
    { type: "crosstab", column1: "a", column2: "b" },
    "pd.crosstab(",
  ],
  [
    "crosstab-alias",
    { type: "crosstab", col1: "a", col2: "b", normalize: "index" },
    'normalize="index"',
  ],
  ["transpose", { type: "transpose" }, "df = df.T"],
  [
    "jsonFlatten",
    { type: "jsonFlatten", column: "payload" },
    "pd.json_normalize(",
  ],
  ["concat", { type: "concat", axis: 0 }, "pd.concat([df, other"],
  ["join", { type: "join", on: "id", how: "left" }, 'df.merge(right, on="id"'],
  [
    "append",
    { type: "append", source: { type: "workspace" } },
    "pd.concat([df, other]",
  ],
  ["assign", { type: "assign", column: "c", expr: "a + b" }, `.eval("a + b")`],
  [
    "replace",
    { type: "replace", column: "c", toReplace: "x", value: "y" },
    `.replace("x", "y")`,
  ],
  [
    "replace-map",
    { type: "replace", column: "c", toReplace: { x: "y" } },
    `.replace({"x": "y"})`,
  ],
  [
    "mapValues",
    { type: "mapValues", column: "c", mapping: { x: "y" } },
    `.map({"x": "y"})`,
  ],
  ["factorize", { type: "factorize", column: "c" }, "pd.factorize("],
  ["apply", { type: "apply", column: "c", func: "len" }, ".apply(len)"],
  ["drop", { type: "drop", column: "c" }, `drop(columns="c")`],
  [
    "rename",
    { type: "rename", column: "a", newName: "b" },
    `rename(columns={"a": "b"})`,
  ],
  [
    "changeType",
    { type: "changeType", column: "c", newType: "numeric" },
    "pd.to_numeric(",
  ],
  [
    "split",
    { type: "split", column: "c", delimiter: "," },
    `.str.split(",", expand=True)`,
  ],
  [
    "stringMetrics",
    { type: "stringMetrics", column: "c", metrics: ["wordCount"] },
    ".str.split().str.len()",
  ],
  ["sample", { type: "sample", n: 10 }, "df.sample(n=10)"],
  ["topN", { type: "topN", column: "price", n: 5 }, 'nlargest(5, "price")'],
  [
    "rank",
    { type: "rank", column: "c", method: "dense" },
    '.rank(method="dense")',
  ],
  ["cut", { type: "cut", column: "c", bins: 4 }, "pd.cut("],
  ["qcut", { type: "qcut", column: "c", q: 4 }, "pd.qcut("],
  [
    "toCategorical",
    { type: "toCategorical", column: "c", categories: ["a"] },
    "pd.Categorical(",
  ],
  [
    "catCodes",
    { type: "catCodes", column: "c" },
    'astype("category").cat.codes',
  ],
  ["setIndex", { type: "setIndex", column: "c" }, 'set_index("c")'],
  ["resetIndex", { type: "resetIndex", drop: true }, "reset_index(drop=True)"],
  ["reindex", { type: "reindex", column: "c" }, 'set_index("c")'],
  [
    "describeExtended",
    { type: "describeExtended", columns: ["a"] },
    '.describe(include="all")',
  ],
  [
    "rolling",
    { type: "rolling", column: "c", window: 7 },
    ".rolling(7).mean()",
  ],
  ["expanding", { type: "expanding", column: "c" }, ".expanding().mean()"],
  ["ewm", { type: "ewm", column: "c", span: 5 }, ".ewm(span=5).mean()"],
  ["shift", { type: "shift", column: "c" }, ".shift(1)"],
  ["diff", { type: "diff", column: "c", periods: 2 }, ".diff(2)"],
  ["pctChange", { type: "pctChange", column: "c" }, ".pct_change(1)"],
  [
    "interpolate",
    { type: "interpolate", column: "c", method: "linear" },
    '.interpolate(method="linear")',
  ],
  [
    "resample",
    {
      type: "resample",
      dateColumn: "d",
      rule: "ME",
      valueColumn: "v",
      agg: "sum",
    },
    '.resample("ME")["v"].sum()',
  ],
  ["dateDiff", { type: "dateDiff", startCol: "s", endCol: "e" }, ".dt.days"],
  ["toDatetime", { type: "toDatetime", column: "d" }, "pd.to_datetime("],
  [
    "businessDays",
    { type: "businessDays", startCol: "s", endCol: "e" },
    "np.busday_count(",
  ],
  ["groupedCum", { type: "groupedCum", by: ["g"], column: "v" }, ".cumsum()"],
  ["balance", { type: "balance", target: "y" }, "imblearn"],
  ["fuzzyMatch", { type: "fuzzyMatch", column: "name" }, "rapidfuzz"],
];

describe("stepToPython forward view-only renderers", () => {
  for (const [label, cfg, needle] of GOLDEN) {
    it(`${label} renders real code, view-only`, () => {
      const r = stepToPython(cfg);
      expect(r.editable, `${label}: view-only`).toBe(false);
      expect(r.code, `${label}: canonical call`).toContain(needle);
      expect(r.code, `${label}: no fallback`).not.toContain(
        "auto-generated preview",
      );
    });
  }

  it("incomplete view-only configs degrade to the fallback", () => {
    for (const cfg of [
      { type: "explode" },
      { type: "pivot", indexColumn: "a" },
      { type: "topN", column: "c" },
      { type: "resample" },
      { type: "dateDiff", startCol: "s" },
      { type: "balance" },
    ]) {
      const r = stepToPython(cfg);
      expect(r.editable).toBe(false);
      expect(r.code).toContain("auto-generated preview");
    }
  });

  it("unknown types still fall back with guidance", () => {
    const r = stepToPython({ type: "mystery-op", foo: 1 });
    expect(r.editable).toBe(false);
    expect(r.code).toContain("auto-generated preview");
    expect(r.note ?? "").toMatch(/mystery-op/);
  });
});
