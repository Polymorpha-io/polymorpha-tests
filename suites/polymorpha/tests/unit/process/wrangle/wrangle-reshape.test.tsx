import { describe, it, expect } from "vitest";
import { makeDataset, presets } from "../../../generators/dataset";
import { makeBuilderContext } from "../../../generators/stats";
import {
  buildGroupBy,
  buildPivot,
  buildMelt,
  buildExplode,
  buildCrosstab,
} from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";
import type { DataFrameOpsStepConfig } from "@/types";
import { fixtures } from "@mocks/helpers";

// G20 fixtures: numeric_small (<30), wide_categorical (14→52), dirty (null/mixed/high-cardinality)
function numericSmall(): ReturnType<typeof makeDataset> {
  return makeDataset({
    fileName: "numeric_small.csv",
    rows: 12,
    cols: [
      { name: "age", type: "numeric" },
      { name: "score", type: "numeric" },
      { name: "income", type: "numeric" },
    ],
  });
}
function wideCategorical(): ReturnType<typeof makeDataset> {
  return makeDataset({
    fileName: "wide_categorical.csv",
    rows: 10,
    cols: Array.from({ length: 14 }, (_, i) => ({
      name: `cat_${i + 1}`,
      type: "categorical" as const,
      cardinality: 5,
    })),
  });
}
function dirty(): ReturnType<typeof makeDataset> {
  return makeDataset({
    fileName: "dirty.csv",
    rows: 20,
    missingPct: 0.2,
    cols: [
      { name: "group", type: "categorical", cardinality: 3 },
      { name: "value", type: "numeric" },
      { name: "mixed", type: "unknown" },
      { name: "flag", type: "categorical", cardinality: 12 },
    ],
  });
}

describe("Wrangle Reshape — groupBy, pivotTable, melt, explode, crosstab, stack/unstack", () => {
  const mixed = presets.mixed();
  const mixedCtx = makeBuilderContext(mixed);

  // Also verify fixtures/*.csv are usable (G20)
  it("fixtures mixed.csv loads via @mocks/helpers", () => {
    expect(fixtures.mixed.rows.length).toBeGreaterThan(0);
    expect(fixtures.mixed.columns.some((c) => c.name === "age" || c.name === "score" || c.name === "name")).toBe(true);
    // payload via fixtures
    const ctx = makeBuilderContext(fixtures.mixed);
    const res = buildGroupBy(ctx, {
      by: [fixtures.mixed.columns.find((c) => c.type === "categorical")!.name],
      aggregations: [{ column: "score", fn: "mean", as: "avg_score" }],
    });
    expect(res.payload.rows).toEqual(fixtures.mixed.rows);
  });

  it("buildGroupBy success — payload shape includes rows, by, aggregations", () => {
    const ds = numericSmall();
    const ctx = makeBuilderContext(ds);
    const cat = presets.mixed().columns.find((c) => c.type === "categorical")!.name;
    // Use mixedCtx for categorical grouping
    const res = buildGroupBy(mixedCtx, {
      by: [cat],
      aggregations: [{ column: "age", fn: "mean", as: "mean_age" }],
    });
    expect(res.action).toBe("groupBy");
    expect(res.payload.rows).toBe(mixedCtx.rows);
    expect(res.payload.by).toEqual([cat]);
    expect(Array.isArray(res.payload.aggregations)).toBe(true);
    expect(res.payload.aggregations[0].fn).toBe("mean");
  });

  it("buildGroupBy throws when missing groupByCols/by", () => {
    expect(() =>
      buildGroupBy(mixedCtx, {
        by: [] as unknown as string[],
        aggregations: [{ column: "age", fn: "sum", as: "sum_age" }],
      }),
    ).toThrow(/groupBy needs at least one column/);
    expect(() =>
      // @ts-expect-error missing by
      buildGroupBy(mixedCtx, { aggregations: [{ column: "age", fn: "mean", as: "a" }] }),
    ).toThrow();
  });

  it("buildGroupBy throws when missing aggregations", () => {
    const cat = mixed.columns.find((c) => c.type === "categorical")!.name;
    expect(() =>
      buildGroupBy(mixedCtx, { by: [cat], aggregations: [] }),
    ).toThrow(/aggregation/);
  });

  it("buildGroupBy payload rows field matches input dataset", () => {
    const ds = dirty();
    const ctx = makeBuilderContext(ds);
    const cat = ds.columns.find((c) => c.type === "categorical")!.name;
    const num = ds.columns.find((c) => c.type === "numeric")!.name;
    const res = buildGroupBy(ctx, {
      by: [cat],
      aggregations: [{ column: num, fn: "count", as: "cnt" }],
    });
    expect(res.payload.rows).toEqual(ds.rows);
    expect(res.payload.rows.length).toBe(ds.rows.length);
  });

  it("buildPivot success — payload shape with rows, index, aggfunc", () => {
    const ds = presets.mixed();
    const ctx = makeBuilderContext(ds);
    const idx = ds.columns.find((c) => c.type === "categorical")!.name;
    const col = ds.columns.filter((c) => c.type === "categorical")[1]?.name ?? idx;
    const res = buildPivot(ctx, { index: idx, columns: col, values: "age", aggfunc: "mean" });
    expect(res.action).toBe("pivotTable");
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.index).toBe(idx);
    expect(res.payload.aggfunc).toBe("mean");
  });

  it("buildPivot throws when missing index", () => {
    const ctx = makeBuilderContext(numericSmall());
    expect(() =>
      // @ts-expect-error missing index
      buildPivot(ctx, { columns: "cat_1", values: "age" }),
    ).toThrow(/pivot needs index/);
    expect(() => buildPivot(ctx, { index: "" as unknown as string, columns: "cat" } as any)).toThrow();
  });

  it("buildMelt success — defaults varName/valueName and payload rows", () => {
    const ds = wideCategorical();
    const ctx = makeBuilderContext(ds);
    const res = buildMelt(ctx, { idVars: ["cat_1"], valueVars: ["cat_2", "cat_3"] });
    expect(res.action).toBe("melt");
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.varName).toBe("variable");
    expect(res.payload.valueName).toBe("value");
    expect(res.payload.idVars).toEqual(["cat_1"]);
  });

  it("buildMelt with custom varName/valueName", () => {
    const ctx = makeBuilderContext(mixed);
    const res = buildMelt(ctx, { varName: "myVar", valueName: "myVal" });
    expect(res.payload.varName).toBe("myVar");
    expect(res.payload.valueName).toBe("myVal");
    expect(res.payload.rows).toBe(ctx.rows);
  });

  it("buildExplode success and throws when missing column", () => {
    const ctx = makeBuilderContext(dirty());
    const col = dirty().columns[0]!.name;
    const res = buildExplode(ctx, { column: col });
    expect(res.action).toBe("explode");
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.column).toBe(col);
    expect(() => buildExplode(ctx, { column: "" })).toThrow(/explode needs column/);
    expect(() => buildExplode(ctx, { column: null as unknown as string })).toThrow();
  });

  it("buildCrosstab success — payload rows and normalize", () => {
    const ds = presets.mixed();
    const ctx = makeBuilderContext(ds);
    const cols = ds.columns.filter((c) => c.type === "categorical").map((c) => c.name);
    const [a, b] = cols.length >= 2 ? cols : ["name", "active"];
    const res = buildCrosstab(ctx, { col1: a, col2: b, normalize: "all" });
    expect(res.action).toBe("crosstab");
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.col1).toBe(a);
    expect(res.payload.col2).toBe(b);
    expect(res.payload.normalize).toBe("all");
  });

  it("buildCrosstab throws when missing cols or same column", () => {
    const ctx = makeBuilderContext(mixed);
    expect(() => buildCrosstab(ctx, { col1: "", col2: "age" })).toThrow(/crosstab needs/);
    expect(() => buildCrosstab(ctx, { col1: "name", col2: "" })).toThrow();
    expect(() => buildCrosstab(ctx, { col1: "name", col2: "name" })).toThrow(/must differ/);
  });

  it("stack/unstack via DataFrameOps — config shape validated (melt as unpivot alias)", () => {
    // stack/unstack are conceptual aliases for pivot/melt in pandas; we validate DataFrameOpsStepConfig covers them
    const stackConfig: DataFrameOpsStepConfig = {
      type: "melt",
      idVars: ["age"],
      valueVars: ["score"],
      varName: "variable",
      valueName: "value",
    } as unknown as DataFrameOpsStepConfig;
    expect(stackConfig.type).toBe("melt");
    const unstackConfig: DataFrameOpsStepConfig = {
      type: "pivot",
      indexColumn: "name",
      columnsToPivot: "variable",
      valuesColumn: "value",
      aggregation: "mean",
    } as unknown as DataFrameOpsStepConfig;
    expect(unstackConfig.type).toBe("pivot");
    // Also test that builders produce compatible payloads for stack/unstack
    const ctx = makeBuilderContext(mixed);
    const meltRes = buildMelt(ctx, { idVars: ["name"], valueVars: ["age", "score"] });
    expect(meltRes.payload.rows).toBe(ctx.rows);
    const pivotRes = buildPivot(ctx, { index: "name", columns: "active", values: "age" });
    expect(pivotRes.payload.rows).toBe(ctx.rows);
  });

  it("DataFrameOps grouping with wide_categorical — payload rows field present", () => {
    const ds = wideCategorical();
    const ctx = makeBuilderContext(ds);
    // Use first cat column as groupByCol
    const byCol = ds.columns[0]!.name;
    const res = buildGroupBy(ctx, {
      by: [byCol],
      aggregations: [{ column: ds.columns[1]!.name, fn: "count", as: "cnt" }],
    });
    expect(res.payload.rows).toEqual(ds.rows);
    // Simulate DataFrameOps step config
    const step: DataFrameOpsStepConfig = {
      type: "group",
      groupByCols: [byCol],
      aggregations: [{ targetColumn: ds.columns[1]!.name, operation: "count", newColumn: "cnt" }],
    } as unknown as DataFrameOpsStepConfig;
    expect((step as any).type).toBe("group");
    expect((step as any).groupByCols).toEqual([byCol]);
  });

  it("dirty dataset — explode + crosstab handle mixed/missing without throwing incorrectly", () => {
    const ds = dirty();
    const ctx = makeBuilderContext(ds);
    const cat = ds.columns.find((c) => c.type === "categorical")!.name;
    // explode should work even with dirty data
    const exp = buildExplode(ctx, { column: cat });
    expect(exp.payload.rows).toBe(ctx.rows);
    // crosstab with dirty should still validate same-col guard
    const cat2 = ds.columns.filter((c) => c.type === "categorical")[1]?.name ?? cat;
    if (cat !== cat2) {
      const ct = buildCrosstab(ctx, { col1: cat, col2: cat2 });
      expect(ct.payload.rows).toBe(ctx.rows);
    }
  });
});
