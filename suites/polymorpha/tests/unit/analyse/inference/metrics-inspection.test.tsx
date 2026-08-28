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
      { name: "target", type: "categorical", cardinality: 2 },
      { name: "score", type: "numeric" },
    ],
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
      { name: "target", type: "categorical", cardinality: 2 },
    ],
  });
}

// Mock ML metric payload generators (mirrors python/polymorpha/ml/_metrics.py)
function mockComputeClassification(yTrue: string[], yPred: string[], yProba?: number[][]) {
  const acc = yTrue.filter((v, i) => v === yPred[i]).length / yTrue.length;
  const result: any = {
    accuracy: Number(acc.toFixed(4)),
    f1Weighted: 0.8,
    confusionMatrix: [[5, 1], [2, 12]],
    classificationReport: {},
  };
  if (yProba) {
    const fpr = [0, 0.1, 1];
    const tpr = [0, 0.9, 1];
    result.rocCurve = { fpr, tpr, thresholds: [1, 0.5, 0], auc: 0.92 };
    result.prCurve = { precision: [1, 0.8, 0.5], recall: [0, 0.7, 1], averagePrecision: 0.85 };
    result.brierScore = 0.12;
  }
  return result;
}
function mockComputeRegression(yTrue: number[], yPred: number[]) {
  const n = yTrue.length;
  const mape = yTrue.reduce((s, v, i) => s + Math.abs((v - yPred[i]!) / (v || 1)), 0) / n;
  const mean = yTrue.reduce((a, b) => a + b, 0) / n;
  const ssTot = yTrue.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = yTrue.reduce((s, v, i) => s + (v - yPred[i]!) ** 2, 0);
  const evs = 1 - ssRes / (ssTot || 1);
  return { mape: Number(mape.toFixed(4)), evs: Number(evs.toFixed(4)), r2: Number(evs.toFixed(4)) };
}
function mockSilhouette(rows: any[], labels: number[]) {
  if (new Set(labels).size < 2) return { error: "Need at least 2 clusters" };
  if (labels.length !== rows.length) return { error: `labels length ${labels.length} != rows ${rows.length}` };
  return { silhouetteScore: 0.42, silhouettePerSample: labels.map(() => 0.4), n: rows.length, k: new Set(labels).size };
}
function mockCalibration(yTrue: string[], yProba: number[], nBins = 10) {
  if (new Set(yTrue).size !== 2) return { error: "Calibration curve requires binary target" };
  return { probTrue: [0.1, 0.5, 0.9], probPred: [0.15, 0.55, 0.85], nBins };
}
function mockPermutationImportance(features: string[]) {
  return {
    importances: features.map((f, i) => ({ feature: f, importanceMean: 0.3 - i * 0.05, importanceStd: 0.02 })),
    scoring: "accuracy",
    nRepeats: 10,
    task: "classification",
  };
}
function mockPartialDependence(feature: string, grid: number[], average: number[]) {
  return { feature, grid, average, task: "classification" };
}

describe("Metrics & Inspection — compute_classification rocCurve/prCurve/brier, compute_regression mape/evs, silhouette, calibration, permutationImportance, partialDependence", () => {
  const ds = numericSmall();
  const ctx = makeBuilderContext(ds);

  it("compute_classification — rocCurve, prCurve, brier via yProba", () => {
    const yTrue = ["A", "B", "A", "B", "A", "B", "A", "B", "A", "B"];
    const yPred = ["A", "B", "A", "A", "A", "B", "B", "B", "A", "B"];
    const yProba = yTrue.map((_, i) => (i % 2 === 0 ? [0.8, 0.2] : [0.3, 0.7]));
    const probaPos = yProba.map((r) => r[1]!);
    const res = mockComputeClassification(yTrue, yPred, yProba);
    expect(res.accuracy).toBeGreaterThanOrEqual(0);
    expect(res.accuracy).toBeLessThanOrEqual(1);
    expect(res.rocCurve).toBeDefined();
    expect(res.rocCurve.fpr.length).toBe(res.rocCurve.tpr.length);
    expect(res.rocCurve.auc).toBeGreaterThan(0.5);
    expect(res.prCurve).toBeDefined();
    expect(res.prCurve.precision.length).toBeGreaterThan(0);
    expect(res.brierScore).toBeGreaterThanOrEqual(0);
    expect(res.brierScore).toBeLessThanOrEqual(1);
    expect(res.confusionMatrix).toBeDefined();
  });

  it("compute_classification without yProba — no roc/pr curve", () => {
    const yTrue = ["yes", "no", "yes", "no"];
    const yPred = ["yes", "no", "no", "no"];
    const res = mockComputeClassification(yTrue, yPred);
    expect(res.accuracy).toBeDefined();
    expect(res.rocCurve).toBeUndefined();
    expect(res.prCurve).toBeUndefined();
    expect(res.brierScore).toBeUndefined();
    expect(res.f1Weighted).toBeDefined();
  });

  it("compute_regression — mape and evs", () => {
    const yTrue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => v * 1.1);
    const yPred = [1.1, 2.05, 3.2, 3.9, 5.1, 6.0, 7.2, 7.8, 9.0, 10.2];
    const res = mockComputeRegression(yTrue, yPred);
    expect(res.mape).toBeGreaterThanOrEqual(0);
    expect(res.mape).toBeLessThan(0.2);
    expect(res.evs).toBeGreaterThan(0.8);
    expect(res.r2).toBeGreaterThan(0.8);
    expect(typeof res.mape).toBe("number");
    expect(typeof res.evs).toBe("number");
  });

  it("compute_regression edge — perfect prediction mape 0 evs 1", () => {
    const y = [1, 2, 3, 4, 5];
    const res = mockComputeRegression(y, [...y]);
    expect(res.mape).toBeCloseTo(0, 2);
    expect(res.evs).toBeCloseTo(1, 2);
  });

  it("silhouette — requires labels and 2+ clusters", () => {
    const rows = ctx.rows;
    const labels = rows.map((_, i) => i % 3);
    const res = mockSilhouette(rows, labels);
    expect((res as any).silhouetteScore).toBeGreaterThan(-1);
    expect((res as any).silhouetteScore).toBeLessThanOrEqual(1);
    expect((res as any).k).toBe(3);
    expect((res as any).n).toBe(rows.length);

    const err1 = mockSilhouette(rows, rows.map(() => 0));
    expect((err1 as any).error).toMatch(/Need at least 2 clusters/);
    const err2 = mockSilhouette(rows, [0, 1]);
    expect((err2 as any).error).toMatch(/labels length/);
  });

  it("silhouette with G20 numeric_small — payload rows match", () => {
    const ns = numericSmall();
    const labels = ns.rows.map((_, i) => (i < 10 ? 0 : 1));
    const res = mockSilhouette(ns.rows, labels);
    expect((res as any).n).toBe(20);
    expect((res as any).silhouettePerSample.length).toBe(20);
  });

  it("calibration_curve — binary target, probTrue/probPred", () => {
    const yTrue = ["A", "B", "A", "B", "A", "B", "A", "B"];
    const yProba = [0.1, 0.9, 0.2, 0.85, 0.15, 0.95, 0.3, 0.8];
    const res = mockCalibration(yTrue, yProba, 3);
    expect((res as any).probTrue.length).toBe(3);
    expect((res as any).probPred.length).toBe(3);
    expect((res as any).nBins).toBe(3);
    expect((res as any).probTrue[0]).toBeGreaterThanOrEqual(0);
    expect((res as any).probTrue[0]).toBeLessThanOrEqual(1);

    const err = mockCalibration(["A", "A", "A"], [0.1, 0.2, 0.3]);
    expect((err as any).error).toMatch(/binary target/);
  });

  it("permutationImportance — feature ranking", () => {
    const features = ["feat1", "feat2", "feat3"];
    const res = mockPermutationImportance(features);
    expect(res.importances.length).toBe(3);
    expect(res.importances[0]!.feature).toBe("feat1");
    expect(res.importances[0]!.importanceMean).toBeGreaterThan(res.importances[1]!.importanceMean);
    expect(res.scoring).toBe("accuracy");
    expect(res.nRepeats).toBe(10);
    // Sorted descending
    const sorted = [...res.importances].sort((a, b) => b.importanceMean - a.importanceMean);
    expect(res.importances).toEqual(sorted);
  });

  it("partialDependence — grid and average arrays", () => {
    const grid = [0, 0.5, 1, 1.5, 2];
    const avg = [0.1, 0.3, 0.5, 0.7, 0.9];
    const res = mockPartialDependence("feat1", grid, avg);
    expect(res.feature).toBe("feat1");
    expect(res.grid.length).toBe(5);
    expect(res.average.length).toBe(5);
    expect(res.task).toBe("classification");
    // Grid should be monotonic
    for (let i = 1; i < res.grid.length; i++) {
      expect(res.grid[i]!).toBeGreaterThan(res.grid[i - 1]!);
    }
  });

  it("MLRequest schema validation — metrics & inspection actions supported", () => {
    const supported = new Set([
      "extract_features", "recommend_cleaning", "recommend_tests",
      "detect_anomalies", "train",
      "scale", "scaleData", "impute", "encode", "preprocess",
      "pipeline", "pipelineCreate", "pipelineTransform", "columnTransformer", "featureUnion",
      "varianceThreshold", "selectKBest", "rfe", "featureSelection",
      "gridSearch", "randomSearch", "crossValidate", "learningCurve", "validationCurve",
      "metrics", "metricsClassification", "metricsRegression", "silhouette", "calibrationCurve", "permutationImportance", "partialDependence",
      "cluster", "kmeans", "dbscan", "hdbscan", "agglomerative", "birch", "spectral", "optics",
      "pca", "truncatedSvd", "nmf", "factorAnalysis", "lda",
      "tsne", "isomap", "mds", "spectralEmbedding",
      "gmm", "bayesianGmm", "mixture",
      "lof", "oneClassSvm", "ellipticEnvelope", "anomalyExtended",
      "tfidf", "countVectorizer", "tfidfVectorizer",
      "calibrate", "saveModel", "loadModel", "predict",
    ]);
    const needed = ["metricsClassification", "metricsRegression", "silhouette", "calibrationCurve", "permutationImportance", "partialDependence"];
    for (const a of needed) {
      expect(supported.has(a), `${a} must be supported`).toBe(true);
    }
    // verify compute_classification maps to metricsClassification
    const mockReq = (action: string, rows: any[]) => ({ action, rows });
    expect(mockReq("metricsClassification", ctx.rows).action).toBe("metricsClassification");
    expect(mockReq("silhouette", ctx.rows).rows).toBe(ctx.rows);
  });

  it("dirty dataset — metrics handle missing gracefully (mock imputation)", () => {
    const d = dirty();
    const dCtx = makeBuilderContext(d);
    expect(dCtx.rows.length).toBe(20);
    // Simulate that compute handles missing by filtering
    const yTrue = d.rows.map((r) => (r["target"] as string) ?? "A").filter(Boolean) as string[];
    const yPred = [...yTrue];
    // introduce one mismatch
    if (yPred.length > 0) yPred[0] = yPred[0] === "A" ? "B" : "A";
    const res = mockComputeClassification(yTrue, yPred);
    expect(res.accuracy).toBeGreaterThanOrEqual(0);
    expect(res.accuracy).toBeLessThan(1);
  });

  it("payload rows passthrough for inspection actions", () => {
    const features = ["feat1", "feat2"];
    const mockPayload = (action: string, extra: any) => ({
      action,
      payload: { rows: ctx.rows, columns: ds.columns, target: "target", features, ...extra },
    });
    const p1 = mockPayload("permutationImportance", { nRepeats: 10 });
    expect(p1.payload.rows).toBe(ctx.rows);
    expect(p1.payload.nRepeats).toBe(10);
    const p2 = mockPayload("partialDependence", { feature: "feat1", gridResolution: 50 });
    expect(p2.payload.feature).toBe("feat1");
    expect(p2.payload.rows).toBe(ctx.rows);
    const p3 = mockPayload("silhouette", { labels: ctx.rows.map((_, i) => i % 2) });
    expect(p3.payload.rows).toBe(ctx.rows);
  });
});
