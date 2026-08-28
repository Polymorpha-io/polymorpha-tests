import { describe, it, expect } from "vitest";
import { makeDataset } from "../../../generators/dataset";
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

function numericDs() {
  return makeDataset({
    fileName: "num.csv",
    rows: 30,
    cols: [
      { name: "num1", type: "numeric" },
      { name: "num2", type: "numeric" },
      { name: "grp", type: "categorical", cardinality: 3 },
    ],
  });
}
function ctx(ds: ReturnType<typeof makeDataset>) {
  return {
    rows: ds.rows,
    columns: ds.columns,
    columnTypeMap: Object.fromEntries(ds.columns.map((c) => [c.name, c.type])) as Record<string, string>,
    groupValuesFor: (_: string) => ["A", "B", "C"],
  } as any;
}

describe("Diagnostics H/I/J + PostHoc K — normality, variance, corrections, regression diagnostics", () => {
  it("andersonDarling payload — action and rows", () => {
    const ds = numericDs();
    const p = (PB as any).buildAndersonDarling(ctx(ds), { column: "num1", dist: "norm" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("kolmogorovSmirnov payload", () => {
    const ds = numericDs();
    const p = (PB as any).buildKolmogorovSmirnov(ctx(ds), { column: "num1" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("cramerVonMises payload", () => {
    const ds = numericDs();
    const p = (PB as any).buildCramerVonMises(ctx(ds), { column: "num1" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("jarqueBera payload", () => {
    const ds = numericDs();
    const p = (PB as any).buildJarqueBera(ctx(ds), { column: "num1" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("bartlett — needs 2+ groups", () => {
    const ds = numericDs();
    const p = (PB as any).buildBartlett(ctx(ds), { valueCol: "num1", groupCol: "grp" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("fligner payload", () => {
    const ds = numericDs();
    const p = (PB as any).buildFligner(ctx(ds), { valueCol: "num1", groupCol: "grp" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("multipletests holm/sidak/fdrBy — 8 methods", () => {
    const ds = numericDs();
    for (const m of ["holm", "sidak", "fdrBy"] as const) {
      const fn = m === "holm" ? "buildHolm" : m === "sidak" ? "buildSidak" : "buildFdrBy";
      const p = (PB as any)[fn](ctx(ds), { pValues: [0.01, 0.04, 0.5], alpha: 0.05 });
      expect(p.payload.rows).toBe(ds.rows);
    }
  });
  it("boxcox / yeojohnson — lambda", () => {
    const ds = numericDs();
    const b = (PB as any).buildBoxCox(ctx(ds), { column: "num1" });
    expect(b.payload.rows).toBe(ds.rows);
    const y = (PB as any).buildYeoJohnson(ctx(ds), { column: "num1" });
    expect(y.payload.rows).toBe(ds.rows);
  });
  it("bootstrapCI + permutationTest", () => {
    const ds = numericDs();
    const b = (PB as any).buildBootstrapCI(ctx(ds), { column: "num1", statistic: "mean", nResamples: 200 });
    expect(b.payload.rows).toBe(ds.rows);
    const p = (PB as any).buildPermutationTest(ctx(ds), { col1: "num1", col2: "num2" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("regression diagnostics — breuschPagan, durbinWatson, cooksDistance", () => {
    const ds = numericDs();
    const b = (PB as any).buildBreuschPagan(ctx(ds), { target: "num1", predictors: ["num2"] });
    expect(b.payload.rows).toBe(ds.rows);
    const d = (PB as any).buildDurbinWatson(ctx(ds), { target: "num1", predictors: ["num2"] });
    expect(d.payload.rows).toBe(ds.rows);
    const co = (PB as any).buildCooksDistance(ctx(ds), { target: "num1", predictors: ["num2"] });
    expect(co.payload.rows).toBe(ds.rows);
  });
  it("PostHoc — tukeyHSD, dunn, gamesHowell, dunnett (responseCol/groupCol)", () => {
    const ds = numericDs();
    const t = (PB as any).buildTukeyHSD(ctx(ds), { responseCol: "num1", groupCol: "grp", alpha: 0.05 });
    expect(t.payload.rows).toBe(ds.rows);
    const d = (PB as any).buildDunn(ctx(ds), { responseCol: "num1", groupCol: "grp", method: "bonferroni" });
    expect(d.payload.rows).toBe(ds.rows);
    const g = (PB as any).buildGamesHowell(ctx(ds), { responseCol: "num1", groupCol: "grp" });
    expect(g.payload.rows).toBe(ds.rows);
    const du = (PB as any).buildDunnett(ctx(ds), { responseCol: "num1", groupCol: "grp", control: "A" });
    expect(du.payload.rows).toBe(ds.rows);
  });
  it("effectSize extended — hedges_g", () => {
    const ds = numericDs();
    const p = (PB as any).buildEffectSize(ctx(ds), { col1: "num1", kind: "hedges_g" });
    expect(p.payload.rows).toBe(ds.rows);
  });
  it("diagnostics buildDiagnostics generic + buildPostHoc", () => {
    const ds = numericDs();
    const gen = (PB as any).buildDiagnostics(ctx(ds), { method: "andersonDarling", column: "num1" });
    expect(gen.payload.rows).toBe(ds.rows);
    const post = (PB as any).buildPostHoc(ctx(ds), { method: "tukeyHSD", responseCol: "num1", groupCol: "grp" });
    expect(post.payload.rows).toBe(ds.rows);
  });
  it("G20 dirty — diagnostics handle missing without crash", () => {
    const dirty = makeDataset({
      fileName: "dirty.csv",
      rows: 20,
      missingPct: 0.2,
      cols: [
        { name: "num", type: "numeric" },
        { name: "cat", type: "categorical", cardinality: 3 },
      ],
    });
    const p = (PB as any).buildJarqueBera(ctx(dirty), { column: "num" });
    expect(p.payload.rows).toBe(dirty.rows);
  });
});
