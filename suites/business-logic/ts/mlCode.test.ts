import { describe, it, expect } from "vitest";
import { mlCodeForAction, mlCodeActions } from "@polymorpha/business-logic";

/**
 * [POLY-CELLS] Golden tests for the ML reference map.
 * Law: every known action renders its sklearn snippet; unknown actions
 * degrade to an honest comment.
 */

describe("mlCodeForAction", () => {
  it("covers the endpoint action inventory", () => {
    for (const a of [
      "train",
      "scale",
      "impute",
      "encode",
      "pipeline",
      "pipelineTransform",
      "varianceThreshold",
      "selectKBest",
      "rfe",
      "gridSearch",
      "randomSearch",
      "crossValidate",
      "learningCurve",
      "validationCurve",
      "metricsClassification",
      "metricsRegression",
      "rocCurve",
      "prCurve",
      "silhouette",
      "calibrationCurve",
      "permutationImportance",
      "partialDependence",
      "cluster",
      "pca",
      "truncatedSvd",
      "nmf",
      "factorAnalysis",
      "tsne",
      "isomap",
      "mds",
      "gmm",
      "bayesianGmm",
      "lof",
      "oneClassSvm",
      "ellipticEnvelope",
    ]) {
      expect(mlCodeActions(), `missing builder: ${a}`).toContain(a);
    }
  });

  it("representative snippets contain their canonical calls", () => {
    expect(
      mlCodeForAction("train", {
        estimator: "ridge",
        target: "y",
        features: ["a"],
      }).code,
    ).toContain("Ridge(");
    expect(mlCodeForAction("scale", {}).code).toContain("StandardScaler");
    expect(
      mlCodeForAction("impute", { params: { strategy: "knn" } }).code,
    ).toContain("KNNImputer");
    expect(mlCodeForAction("gridSearch", {}).code).toContain("GridSearchCV");
    expect(mlCodeForAction("pca", {}).code).toContain("PCA(");
    expect(mlCodeForAction("lof", {}).code).toContain("LocalOutlierFactor");
    const hdb = mlCodeForAction("cluster", { estimator: "hdbscan" });
    expect(hdb.code).toContain("HDBSCAN");
    expect(hdb.requires ?? "").toMatch(/hdbscan/);
  });

  it("unknown actions degrade honestly", () => {
    expect(mlCodeForAction("bogus", {}).code).toContain(
      "no standalone snippet for 'bogus'",
    );
  });
});
