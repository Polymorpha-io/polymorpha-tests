import { describe, expect, it } from "vitest";
import { recipeToPandasScript, stepToPandas } from "@/lib/codegen/pandas";
import type { DataOperationStepConfig } from "@/types/operations";

describe("stepToPandas", () => {
  it("emits groupby with named aggregations and having filter", () => {
    const frag = stepToPandas({
      type: "group",
      groupByCols: ["region"],
      aggregations: [
        { newColumn: "total", operation: "sum", targetColumn: "sales" },
        { newColumn: "n", operation: "count" },
      ],
      having: [{ column: "total", operator: "gt", value: 5 }],
    } as DataOperationStepConfig);
    expect(frag.backend).toBe("groupBy");
    expect(frag.code).toContain('df.groupby(["region"])');
    expect(frag.code).toContain('"total"=(\"sales", \'sum\')');
    expect(frag.code).toContain('"n"=(\"region", \'size\')');
    expect(frag.code).toContain('.query("total > 5")');
  });

  it("emits pivot_table with fill and margins", () => {
    const frag = stepToPandas({
      type: "pivot",
      indexColumn: "region",
      columnsToPivot: "year",
      valuesColumn: "sales",
      aggregation: "sum",
      fillValue: 0,
      margins: true,
    } as DataOperationStepConfig);
    expect(frag.code).toContain("pd.pivot_table(df");
    expect(frag.code).toContain('aggfunc="sum"');
  });

  it("emits merge with keys and second-dataset hint", () => {
    const frag = stepToPandas({
      type: "merge",
      source: { type: "local" },
      joinType: "left",
      leftKey: "id",
      rightKey: "id",
      behavior: "expand",
      how: "left",
      leftOn: "id",
      rightOn: "id",
      rightDatasetName: "right.csv",
    } as DataOperationStepConfig);
    expect(frag.backend).toBe("merge");
    expect(frag.code).toContain('pd.merge(df, right, how="left"');
    expect(frag.code).toContain("right.csv");
  });

  it("emits df.eval assignment and escapes quotes", () => {
    const frag = stepToPandas({
      type: "assign",
      column: "total",
      expr: "price * qty",
    } as DataOperationStepConfig);
    expect(frag.code).toBe('df["total"] = df.eval("price * qty")');
  });

  it("emits rolling as a column assignment", () => {
    const frag = stepToPandas({
      type: "rolling",
      column: "sales",
      window: 7,
      fn: "mean",
      minPeriods: 1,
    } as DataOperationStepConfig);
    expect(frag.code).toContain(".rolling(window=7, min_periods=1).mean()");
    expect(frag.code).toContain('df["sales_roll"] = ');
  });

  it("omits rolling defaults when unset", () => {
    const frag = stepToPandas({
      type: "rolling",
      column: "sales",
      window: 7,
    } as DataOperationStepConfig);
    expect(frag.code).toContain(".rolling(window=7).mean()");
    expect(frag.code).not.toContain("min_periods");
  });

  it("emits to_datetime with format and sklearn scale snippet", () => {
    const dt = stepToPandas({
      type: "toDatetime",
      column: "ts",
      format: "%Y-%m-%d",
    } as DataOperationStepConfig);
    expect(dt.code).toContain('pd.to_datetime(df["ts"], format="%Y-%m-%d"');
    const sc = stepToPandas({
      type: "scaleFeatures",
      method: "standard",
      columns: ["a", "b"],
    } as DataOperationStepConfig);
    expect(sc.code).toContain("StandardScaler()");
    expect(sc.code).toContain("_scaler = StandardScaler()");
  });

  it("returns null code for note cells", () => {
    const frag = stepToPandas({
      type: "note",
      cellKind: "clean",
      inputStepId: null,
      summary: "Cleaned 10 rows",
    } as DataOperationStepConfig);
    expect(frag.code).toBeNull();
    expect(frag.title).toContain("Cleaned 10 rows");
  });

  it("picks double quotes to avoid escaping single quotes", () => {
    const frag = stepToPandas({
      type: "drop",
      column: "o'Brien",
    } as DataOperationStepConfig);
    expect(frag.code).toBe('df.drop(columns="o\'Brien")');
  });

  it("casts booleans with a valid astype call", () => {
    const frag = stepToPandas({
      type: "changeType",
      column: "flag",
      newType: "boolean",
    } as DataOperationStepConfig);
    expect(frag.code).toBe('df["flag"] = df["flag"].astype("boolean")');
  });

  it("instantiates PolynomialFeatures once with a temp var", () => {
    const frag = stepToPandas({
      type: "encodeFeatures",
      method: "polynomial",
      columns: ["a", "b"],
    } as DataOperationStepConfig);
    const occurrences = (frag.code?.match(/PolynomialFeatures\(/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(frag.code).toContain("_poly = PolynomialFeatures(");
    expect(frag.code).toContain("_poly_out = _poly.fit_transform(");
  });

  it("computes reindex set_index once", () => {
    const frag = stepToPandas({
      type: "reindex",
      column: "day",
      method: "ffill",
    } as DataOperationStepConfig);
    const occurrences = (frag.code?.match(/set_index\(/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("keeps fuzzyMatch honest instead of O(n²) per-row unique()", () => {
    const frag = stepToPandas({
      type: "fuzzyMatch",
      column: "city",
      threshold: 80,
    } as DataOperationStepConfig);
    expect(frag.code).not.toContain("extractOne");
    expect(frag.code).not.toContain(".unique()");
    expect(frag.code).toContain("rapidfuzz");
  });

  it("degrades incomplete configs to a comment instead of throwing", () => {
    const frag = stepToPandas({ type: "sort" } as unknown as DataOperationStepConfig);
    expect(frag.code).toContain("# step: sort");
  });

  it("rejects unsafe apply func names", () => {
    const frag = stepToPandas({
      type: "apply",
      column: "a",
      func: "f(x); evil()",
    } as DataOperationStepConfig);
    expect(frag.code).toContain("# step: apply");
  });
});

describe("recipeToPandasScript", () => {
  it("assembles a deterministic replay script with shape footer", () => {
    const steps = [
      { type: "query", expr: "sales > 0" },
      { type: "sort", by: "sales", ascending: false },
    ] as unknown as DataOperationStepConfig[];
    const a = recipeToPandasScript("sales.csv", steps);
    const b = recipeToPandasScript("sales.csv", steps);
    expect(a).toBe(b);
    expect(a).toContain('df = pd.read_csv("sales.csv")');
    expect(a).toContain("# 1.");
    expect(a).toContain("# 2.");
    expect(a).toContain("df = df.query(");
    expect(a).toContain("df = df.sort_values(");
    expect(a).toContain("print(df.shape)");
  });

  it("restores verbose headers when asked", () => {
    const steps = [
      { type: "query", expr: "sales > 0" },
    ] as unknown as DataOperationStepConfig[];
    const out = recipeToPandasScript("sales.csv", steps, { verbose: true });
    expect(out).toContain("# --- Step 1:");
    expect(out).toContain("[backend: query]");
  });
});
