import { describe, it, expect } from "vitest";
import { makeDataset, presets } from "../../../generators/dataset";
import { makeBuilderContext } from "../../../generators/stats";
import * as PB from "@polymorpha/business-logic/ts/dist/networking/payloadBuilders.js";

function numericSmall() {
  return makeDataset({
    fileName: "numeric_small.csv",
    rows: 20,
    cols: [
      { name: "feat1", type: "numeric" },
      { name: "feat2", type: "numeric" },
      { name: "feat3", type: "numeric" },
      { name: "target", type: "numeric" },
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
      { name: "a", type: "numeric" },
      { name: "b", type: "numeric" },
      { name: "c", type: "categorical", cardinality: 3 },
      { name: "target", type: "numeric" },
    ],
  });
}

describe("Model Selection — gridSearch, randomSearch, crossValidate, learningCurve, validationCurve", () => {
  const ds = numericSmall();
  const ctx = makeBuilderContext(ds);
  const features = ["feat1", "feat2"];
  const target = "target";

  it("buildGridSearch success — payload shape with target, features, algorithm, cv, paramGrid", () => {
    const b: any = (PB as any).buildGridSearch;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target, features, algorithm: "random_forest", cv: 3 });
    expect(res.action).toBe("gridSearch");
    expect(res.payload.target).toBe(target);
    expect(res.payload.predictors).toEqual(features);
    expect(res.payload.features).toEqual(features);
    expect(res.payload.algorithm).toBe("random_forest");
    expect(res.payload.cv).toBe(3);
    expect(res.payload.paramGrid).toBeDefined();
    expect(res.payload.rows).toBe(ctx.rows);
    // alias param_grid
    expect(res.payload.param_grid).toEqual(res.payload.paramGrid);
  });

  it("buildGridSearch custom paramGrid and scoring", () => {
    const b: any = (PB as any).buildGridSearch;
    const customGrid = { n_estimators: [10, 20], max_depth: [3, 5] };
    const res = b(ctx, { target, features, paramGrid: customGrid, scoring: "accuracy" });
    expect(res.payload.paramGrid).toEqual(customGrid);
    expect(res.payload.scoring).toBe("accuracy");
    expect(res.payload.algorithm).toBe("random_forest");
  });

  it("buildGridSearch throws on missing target/features and too many predictors", () => {
    const b: any = (PB as any).buildGridSearch;
    expect(() => b(ctx, { target: "", features })).toThrow(/needs target/);
    expect(() => b(ctx, { target, features: [] })).toThrow(/needs predictors/);
    expect(() => b(ctx, { target, features: Array.from({ length: 21 }, (_, i) => `f${i}`) })).toThrow(/Too many/);
    expect(() => b(ctx, { target, features, cv: 1 })).toThrow(/cv must be 2..5/);
    expect(() => b(ctx, { target, features, cv: 6 })).toThrow();
  });

  it("buildRandomSearch success — payload with paramDistributions, nIter", () => {
    const b: any = (PB as any).buildRandomSearch;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target, features, algorithm: "svm", nIter: 10, cv: 3 });
    expect(res.action).toBe("randomSearch");
    expect(res.payload.target).toBe(target);
    expect(res.payload.predictors).toEqual(features);
    expect(res.payload.algorithm).toBe("svm");
    expect(res.payload.nIter).toBe(10);
    expect(res.payload.n_iter).toBe(10);
    expect(res.payload.cv).toBe(3);
    expect(res.payload.rows).toBe(ctx.rows);
    expect(res.payload.paramDistributions).toBeDefined();
  });

  it("buildRandomSearch nIter bounds and cv checks", () => {
    const b: any = (PB as any).buildRandomSearch;
    expect(() => b(ctx, { target, features, nIter: 0 })).toThrow(/nIter must be 1..50/);
    expect(() => b(ctx, { target, features, nIter: 51 })).toThrow();
    expect(() => b(ctx, { target, features, nIter: 5, cv: 1 })).toThrow(/cv must be 2..5/);
    expect(() => b(ctx, { target: "", features })).toThrow(/needs target/);
    expect(() => b(ctx, { target, features: [] })).toThrow(/needs predictors/);
  });

  it("buildRandomSearch paramDistributions alias handling", () => {
    const b: any = (PB as any).buildRandomSearch;
    const grid = { C: [0.1, 1.0] };
    const r1 = b(ctx, { target, features, paramDistributions: grid });
    expect(r1.payload.paramDistributions).toEqual(grid);
    expect(r1.payload.param_distributions).toEqual(grid);
    // alias via paramGrid
    const r2 = b(ctx, { target, features, paramGrid: grid } as any);
    expect(r2.payload.paramDistributions).toEqual(grid);
  });

  it("buildCrossValidate success — cv 2..10 and scoring array", () => {
    const b: any = (PB as any).buildCrossValidate;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target, features, algorithm: "knn", cv: 5 });
    expect(res.action).toBe("crossValidate");
    expect(res.payload.target).toBe(target);
    expect(res.payload.cv).toBe(5);
    expect(res.payload.algorithm).toBe("knn");
    expect(Array.isArray(res.payload.scoring)).toBe(true);
    expect(res.payload.scoring).toContain("accuracy");
    expect(res.payload.rows).toBe(ctx.rows);
  });

  it("buildCrossValidate cv bounds and missing checks", () => {
    const b: any = (PB as any).buildCrossValidate;
    expect(() => b(ctx, { target, features, cv: 1 })).toThrow(/cv must be 2..10/);
    expect(() => b(ctx, { target, features, cv: 11 })).toThrow();
    expect(() => b(ctx, { target: "", features })).toThrow(/needs target/);
    expect(() => b(ctx, { target, features: [] })).toThrow();
    // default cv 5
    const res = b(ctx, { target, features });
    expect(res.payload.cv).toBe(5);
  });

  it("buildLearningCurve success — trainSizes validation", () => {
    const b: any = (PB as any).buildLearningCurve;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, { target, features, algorithm: "random_forest", cv: 3, trainSizes: [0.1, 0.5, 1.0] });
    expect(res.action).toBe("learningCurve");
    expect(res.payload.target).toBe(target);
    expect(res.payload.trainSizes).toEqual([0.1, 0.5, 1.0]);
    expect(res.payload.train_sizes).toEqual([0.1, 0.5, 1.0]);
    expect(res.payload.cv).toBe(3);
    expect(res.payload.rows).toBe(ctx.rows);
  });

  it("buildLearningCurve trainSizes bounds and cv", () => {
    const b: any = (PB as any).buildLearningCurve;
    expect(() => b(ctx, { target, features, trainSizes: [] })).toThrow(/trainSizes must be non-empty/);
    expect(() => b(ctx, { target, features, trainSizes: [0.01] })).toThrow(/trainSizes values must be in/);
    expect(() => b(ctx, { target, features, trainSizes: [1.5] })).toThrow();
    expect(() => b(ctx, { target, features, cv: 6 })).toThrow(/cv must be 2..5/);
    expect(() => b(ctx, { target: "", features })).toThrow(/needs target/);
    // defaults
    const res = b(ctx, { target, features });
    expect(res.payload.trainSizes.length).toBeGreaterThan(0);
    expect(res.payload.cv).toBe(3);
  });

  it("buildValidationCurve success — paramName, paramRange, cv", () => {
    const b: any = (PB as any).buildValidationCurve;
    expect(b).toBeTypeOf("function");
    const res = b(ctx, {
      target,
      features,
      algorithm: "knn",
      paramName: "n_neighbors",
      paramRange: [3, 5, 7],
      cv: 3,
    });
    expect(res.action).toBe("validationCurve");
    expect(res.payload.paramName).toBe("n_neighbors");
    expect(res.payload.param_name).toBe("n_neighbors");
    expect(res.payload.paramRange).toEqual([3, 5, 7]);
    expect(res.payload.param_range).toEqual([3, 5, 7]);
    expect(res.payload.cv).toBe(3);
    expect(res.payload.rows).toBe(ctx.rows);
  });

  it("buildValidationCurve validation — missing paramName, empty range, bounds", () => {
    const b: any = (PB as any).buildValidationCurve;
    expect(() => b(ctx, { target, features, paramName: "", paramRange: [1, 2] })).toThrow(/needs paramName/);
    expect(() => b(ctx, { target, features, paramName: "C", paramRange: [] })).toThrow(/needs non-empty paramRange/);
    expect(() => b(ctx, { target, features, paramName: "C", paramRange: Array.from({ length: 21 }, (_, i) => i) })).toThrow(/too large/);
    expect(() => b(ctx, { target, features, paramName: "C", paramRange: [null as any] })).toThrow(/must be numbers or strings/);
    expect(() => b(ctx, { target, features, paramName: "C", paramRange: [1, 2], cv: 6 })).toThrow(/cv must be 2..5/);
  });

  it("G20 fixtures — dirty and numeric_small with model selection builders", () => {
    const ns = numericSmall();
    const nsCtx = makeBuilderContext(ns);
    const d = dirty();
    const dCtx = makeBuilderContext(d);
    const bGrid: any = (PB as any).buildGridSearch;
    const bCV: any = (PB as any).buildCrossValidate;

    const resNS = bGrid(nsCtx, { target: "target", features: ["feat1", "feat2"] });
    expect(resNS.payload.rows.length).toBe(20);

    const resDirty = bCV(dCtx, { target: "target", features: ["a", "b"] });
    expect(resDirty.payload.rows).toBe(dCtx.rows);
    expect(resDirty.payload.rows.length).toBe(d.rows.length);
  });

  it("payload rows passthrough for all model selection builders", () => {
    const builders = [
      (PB as any).buildGridSearch,
      (PB as any).buildRandomSearch,
      (PB as any).buildCrossValidate,
      (PB as any).buildLearningCurve,
      (PB as any).buildValidationCurve,
    ];
    for (const b of builders) {
      expect(b).toBeTypeOf("function");
      const cfg: any =
        b === (PB as any).buildValidationCurve
          ? { target, features, paramName: "C", paramRange: [0.1, 1] }
          : b === (PB as any).buildLearningCurve
            ? { target, features, trainSizes: [0.5, 1.0] }
            : { target, features };
      const res = b(ctx, cfg);
      expect(res.payload.rows).toBe(ctx.rows);
      expect(typeof res.action).toBe("string");
      expect(res.action.length).toBeGreaterThan(0);
    }
  });

  it("fallback direct callStatsApi shape when builder alias via predictors/features", () => {
    const b: any = (PB as any).buildGridSearch;
    // features vs predictors alias
    const r1 = b(ctx, { target, predictors: features } as any);
    expect(r1.payload.features).toEqual(features);
    expect(r1.payload.predictors).toEqual(features);
    const r2 = b(ctx, { target, features } as any);
    expect(r2.payload.predictors).toEqual(features);
  });
});
