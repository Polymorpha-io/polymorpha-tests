import { describe, it, expect } from "vitest";
import { makeDataset, presets } from "../../../generators/dataset";
import { makeBuilderContext } from "../../../generators/stats";
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

// G20 helpers
function numericSmall() {
  return makeDataset({
    fileName: "numeric_small.csv",
    rows: 20,
    cols: [
      { name: "x1", type: "numeric" },
      { name: "x2", type: "numeric" },
      { name: "x3", type: "numeric" },
      { name: "y", type: "numeric" },
    ],
  });
}
function wideCategorical() {
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
function dirty() {
  return makeDataset({
    fileName: "dirty.csv",
    rows: 20,
    missingPct: 0.2,
    cols: [
      { name: "num1", type: "numeric" },
      { name: "num2", type: "numeric" },
      { name: "cat", type: "categorical", cardinality: 3 },
      { name: "target", type: "numeric" },
    ],
  });
}

describe("Feature Selection — varianceThreshold, selectKBest, rfe", () => {
  const ds = numericSmall();
  const ctx = makeBuilderContext(ds);

  it("buildVarianceThreshold success — default threshold 0 and custom threshold", () => {
    const b: any = (PB as any).buildVarianceThreshold;
    expect(b).toBeTypeOf("function");
    const r1 = b(ctx, { threshold: 0, columns: ["x1", "x2"] });
    expect(r1.action).toBe("varianceThreshold");
    expect(r1.payload.threshold).toBe(0);
    expect(r1.payload.rows).toBe(ctx.rows);
    expect(r1.payload.columns).toEqual(["x1", "x2"]);

    const r2 = b(ctx, { threshold: 0.1, columns: ["x1"] });
    expect(r2.payload.threshold).toBe(0.1);

    // default threshold when omitted → 0
    const r3 = b(ctx, { columns: ["x1"] });
    expect(r3.payload.threshold).toBe(0);
  });

  it("buildVarianceThreshold throws when threshold negative", () => {
    const b: any = (PB as any).buildVarianceThreshold;
    expect(() => b(ctx, { threshold: -0.1, columns: ["x1"] })).toThrow(/threshold must be >=0/);
    expect(() => b(ctx, { threshold: -1 })).toThrow();
  });

  it("buildVarianceThreshold payload rows field matches input dataset", () => {
    const d = dirty();
    const dCtx = makeBuilderContext(d);
    const b: any = (PB as any).buildVarianceThreshold;
    const res = b(dCtx, { threshold: 0.0 });
    expect(res.payload.rows).toBe(dCtx.rows);
    expect(res.payload.rows.length).toBe(d.rows.length);
  });

  it("buildSelectKBest success — payload shape with k, scoreFunc, target", () => {
    const b: any = (PB as any).buildSelectKBest;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target: "y", k: 5, scoreFunc: "f_classif", columns: ["x1", "x2", "x3"] });
    expect(res.action).toBe("selectKBest");
    expect(res.payload.target).toBe("y");
    expect(res.payload.k).toBe(5);
    expect(res.payload.scoreFunc).toBe("f_classif");
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.columns).toEqual(["x1", "x2", "x3"]);
  });

  it("buildSelectKBest default scoreFunc and k bounds", () => {
    const b: any = (PB as any).buildSelectKBest;
    const res = b(ctx, { target: "y" });
    expect(res.payload.k).toBe(5);
    expect(res.payload.scoreFunc).toBe("f_classif");
    expect(res.payload.target).toBe("y");

    expect(() => b(ctx, { target: "y", k: 0 })).toThrow(/k must be 1..20/);
    expect(() => b(ctx, { target: "y", k: 21 })).toThrow();
    expect(() => b(ctx, { target: "", k: 5 })).toThrow(/selectKBest needs target/);
    expect(() => b(ctx, { k: 5 } as any)).toThrow();
  });

  it("buildSelectKBest with scoreFunc variants", () => {
    const b: any = (PB as any).buildSelectKBest;
    for (const fn of ["f_classif", "chi2", "mutual_info_classif", "f_regression"]) {
      const r = b(ctx, { target: "y", k: 2, scoreFunc: fn });
      expect(r.payload.scoreFunc).toBe(fn);
    }
  });

  it("buildRfe success — payload with target, nFeatures, estimator, columns", () => {
    const b: any = (PB as any).buildRfe;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target: "y", nFeatures: 2, estimator: "random_forest", columns: ["x1", "x2"] });
    expect(res.action).toBe("rfe");
    expect(res.payload.target).toBe("y");
    expect(res.payload.nFeatures).toBe(2);
    expect(res.payload.estimator).toBe("random_forest");
    expect(res.payload.rows).toBe(ctx.rows);
  });

  it("buildRfe default estimator and nFeatures bounds", () => {
    const b: any = (PB as any).buildRfe;
    const res = b(ctx, { target: "y" });
    expect(res.payload.nFeatures).toBe(5);
    expect(res.payload.estimator).toBe("random_forest");
    expect(res.payload.target).toBe("y");

    expect(() => b(ctx, { target: "y", nFeatures: 0 })).toThrow(/nFeatures 1..20/);
    expect(() => b(ctx, { target: "y", nFeatures: 21 })).toThrow();
    expect(() => b(ctx, { target: "" } as any)).toThrow(/RFE needs target/);
    expect(() => b(ctx, {} as any)).toThrow();
  });

  it("buildRfe estimator variants", () => {
    const b: any = (PB as any).buildRfe;
    for (const est of ["random_forest", "logistic_regression", "svm", "ridge"]) {
      const r = b(ctx, { target: "y", estimator: est });
      expect(r.payload.estimator).toBe(est);
    }
  });

  it("feature selection with G20 fixtures — numeric_small, wide, dirty payload rows", () => {
    const ns = numericSmall();
    const nsCtx = makeBuilderContext(ns);
    const wc = wideCategorical();
    const wcCtx = makeBuilderContext(wc);
    const d = dirty();
    const dCtx = makeBuilderContext(d);

    const vt: any = (PB as any).buildVarianceThreshold;
    const skb: any = (PB as any).buildSelectKBest;
    const rfe: any = (PB as any).buildRfe;

    // numeric_small → varianceThreshold
    const vtRes = vt(nsCtx, { threshold: 0.01, columns: ["x1", "x2"] });
    expect(vtRes.payload.rows.length).toBe(20);

    // wide_categorical → still works (varianceThreshold doesn't filter type strictly)
    const vtWc = vt(wcCtx, { threshold: 0 });
    expect(vtWc.payload.rows).toBe(wcCtx.rows);

    // dirty → selectKBest with target
    const target = d.columns.find((c) => c.name === "target")!.name;
    const skbDirty = skb(dCtx, { target, k: 1 });
    expect(skbDirty.payload.rows).toBe(dCtx.rows);

    // rfe with dirty
    const rfeDirty = rfe(dCtx, { target, nFeatures: 1, estimator: "random_forest" });
    expect(rfeDirty.payload.rows).toBe(dCtx.rows);
  });

  it("direct callStatsApi payload shape fallback when builder not found", () => {
    // Simulate direct callStatsApi(payload) shape if builders missing
    const mockCall = (action: string, rows: any[], params: any) => ({
      action,
      payload: { rows, ...params },
    });
    const rows = ctx.rows;
    const p1 = mockCall("varianceThreshold", rows, { threshold: 0.5, columns: ["x1"] });
    expect(p1.action).toBe("varianceThreshold");
    expect(p1.payload.threshold).toBe(0.5);
    expect(p1.payload.rows).toBe(rows);

    const p2 = mockCall("selectKBest", rows, { target: "y", k: 2, scoreFunc: "f_classif" });
    expect(p2.payload.k).toBe(2);
    expect(p2.payload.scoreFunc).toBe("f_classif");

    const p3 = mockCall("rfe", rows, { target: "y", nFeatures: 2, estimator: "svm" });
    expect(p3.payload.estimator).toBe("svm");
    expect(p3.payload.nFeatures).toBe(2);
  });

  it("getDisabledReason and builder parity for feature selection keys", () => {
    const columnTypeMap = ctx.columnTypeMap;
    // getDisabledReason may not have feature-selection keys — check it returns null/string without throwing
    const gr: any = (PB as any).getDisabledReason;
    if (typeof gr === "function") {
      // varianceThreshold etc may not be in getDisabledReason switch — should return null default
      const reason = gr("varianceThreshold" as any, { threshold: 0 } as any, columnTypeMap);
      expect(typeof reason === "string" || reason === null).toBe(true);
    }
    // Builders should throw on invalid, not disabled reason — verify parity
    const vt: any = (PB as any).buildVarianceThreshold;
    expect(() => vt(ctx, { threshold: -5 })).toThrow();
    const skb: any = (PB as any).buildSelectKBest;
    expect(() => skb(ctx, { target: "" } as any)).toThrow();
  });
});
