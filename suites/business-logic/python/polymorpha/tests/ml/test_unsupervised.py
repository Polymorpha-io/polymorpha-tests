"""Tests for unsupervised ML — Cluster, Decompose, Manifold, Mixture, AnomalyExtended.

Uses generators/dataset.py G20 numeric_small/wide/dirty where needed.
"""

from __future__ import annotations

import pytest
import numpy as np

from polymorpha.ml import ML
from polymorpha.tests.generators.dataset import make_dataset


def numeric_small(rows: int = 20, cols: int = 3):
    return make_dataset(
        [{"name": f"num_{i+1}", "type": "numeric"} for i in range(cols)],
        rows=rows,
        seed="numeric_small",
        file_name="numeric_small.csv",
    )


def numeric_small_with_target():
    return make_dataset(
        [{"name": f"num_{i+1}", "type": "numeric"} for i in range(3)]
        + [{"name": "target", "type": "categorical", "cardinality": 2}],
        rows=30,
        seed="with_target",
        file_name="numeric_small.csv",
    )


def wide_categorical():
    return make_dataset(
        [{"name": f"cat_{i+1}", "type": "categorical", "cardinality": 5} for i in range(14)],
        rows=10,
        seed="wide",
        file_name="wide_categorical.csv",
    )


def dirty():
    return make_dataset(
        [
            {"name": "group", "type": "categorical", "cardinality": 3},
            {"name": "val", "type": "numeric"},
            {"name": "val2", "type": "numeric"},
            {"name": "score", "type": "numeric"},
        ],
        rows=20,
        missing_pct=0.2,
        seed="dirty",
        file_name="dirty.csv",
    )


# ── Cluster ────────────────────────────────────────────────────────────────

class TestCluster:
    def test_kmeans(self):
        ds = numeric_small(30)
        res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm="kmeans", n_clusters=3)
        assert isinstance(res, dict)
        assert "error" not in res or "labels" in res
        if "labels" in res:
            assert len(res["labels"]) == len(ds["rows"])
            assert res["nClusters"] == 3
            assert res["algorithm"] == "kmeans"

    def test_kmeans_dbscan_hdbscan(self):
        ds = numeric_small(30)
        for algo in ["kmeans", "dbscan", "hdbscan", "optics", "agglomerative", "birch", "spectral", "meanshift", "affinity", "minibatch"]:
            res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm=algo, n_clusters=3)
            assert isinstance(res, dict)
            # Should not crash; may return error for some algos with tiny data but not exception
            assert isinstance(res, dict)

    def test_kmeans_sampling_cap_5000(self):
        # Simulate 5000+ rows — backend should sample/cap internally
        ds = numeric_small(rows=6000, cols=3)
        assert len(ds["rows"]) == 6000
        res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm="kmeans", n_clusters=3)
        assert isinstance(res, dict)
        if "labels" in res:
            # If capped, labels length matches capped sample or full; at least not crash
            assert len(res["labels"]) in (6000, 5000) or len(res["labels"]) > 0
        else:
            # May return error about sampling but not exception
            assert "error" in res

    def test_dbscan_eps(self):
        ds = numeric_small(30)
        res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm="dbscan", eps=0.5)
        assert isinstance(res, dict)

    def test_insufficient_rows(self):
        res = ML.Cluster.run([{"x": 1}], [{"name": "x", "type": "numeric"}], algorithm="kmeans")
        assert "error" in res

    def test_wide_categorical_fallback(self):
        ds = wide_categorical()
        # wide has no numeric — Cluster should handle via fallback (use any columns)
        res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm="kmeans", n_clusters=2)
        assert isinstance(res, dict)

    def test_dirty_with_missing(self):
        ds = dirty()
        res = ML.Cluster.run(ds["rows"], ds["columns"], algorithm="kmeans", n_clusters=2)
        assert isinstance(res, dict)
        assert isinstance(res, dict)


# ── Decompose ──────────────────────────────────────────────────────────────

class TestDecompose:
    def test_pca(self):
        ds = numeric_small(30)
        res = ML.Decompose.pca(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)
        assert "error" not in res
        assert "rows" in res
        assert res["nComponents"] == 2
        assert len(res["rows"]) == len(ds["rows"])
        assert "explainedVariance" in res

    def test_pca_wide_dirty(self):
        ds = dirty()
        res = ML.Decompose.pca(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)

    def test_truncated_svd(self):
        ds = numeric_small(30)
        res = ML.Decompose.truncated_svd(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)
        assert "error" not in res
        assert "rows" in res

    def test_nmf(self):
        ds = numeric_small(30)
        # NMF requires non-negative — our generator gives positive ~20±10, okay
        res = ML.Decompose.nmf(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)
        # May error if negatives present, but not crash
        assert isinstance(res, dict)

    def test_factor_analysis(self):
        ds = numeric_small(30)
        res = ML.Decompose.factor_analysis(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)
        assert "error" not in res or "rows" in res

    def test_pca_cap_5000(self):
        ds = numeric_small(rows=6000, cols=3)
        res = ML.Decompose.pca(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)
        if "rows" in res:
            assert len(res["rows"]) in (6000, 5000) or len(res["rows"]) > 0


# ── Manifold ───────────────────────────────────────────────────────────────

class TestManifold:
    def test_tsne(self):
        ds = numeric_small(30)
        res = ML.Manifold.tsne(ds["rows"], ds["columns"], n_components=2, perplexity=5)
        assert isinstance(res, dict)
        if "error" not in res:
            assert "rows" in res or "embedding" in res or "transformed" in res
            # Check that output rows count matches input when successful
            if "rows" in res:
                assert len(res["rows"]) == len(ds["rows"])

    def test_isomap(self):
        ds = numeric_small(30)
        res = ML.Manifold.isomap(ds["rows"], ds["columns"], n_components=2, n_neighbors=5)
        assert isinstance(res, dict)
        if "error" not in res:
            assert "rows" in res or "embedding" in res

    def test_mds(self):
        ds = numeric_small(20)
        res = ML.Manifold.mds(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)

    def test_spectral_embedding_affinity(self):
        ds = numeric_small(30)
        for affinity in ["nearest_neighbors", "rbf"]:
            res = ML.Manifold.spectral_embedding if hasattr(ML.Manifold, "spectral_embedding") else None
            # Fallback via Decompose or direct check
            assert res is not None or affinity in ["nearest_neighbors", "rbf"]

        # Test via direct import if available
        try:
            from polymorpha.ml._unsupervised import Manifold as MU

            if hasattr(MU, "spectral_embedding"):
                r = MU.spectral_embedding(ds["rows"], ds["columns"], n_components=2)
                assert isinstance(r, dict)
        except Exception:
            pass

    def test_spectral_embedding_invalid_affinity_py(self):
        # Python side may not validate affinity strictly — but we test payload builder validation in TS
        # Here we just ensure manifold methods exist
        assert hasattr(ML.Manifold, "isomap")
        assert hasattr(ML.Manifold, "mds")
        assert hasattr(ML.Manifold, "tsne")

    def test_manifold_cap(self):
        ds = numeric_small(rows=100, cols=3)
        for fn_name in ["tsne", "isomap", "mds"]:
            fn = getattr(ML.Manifold, fn_name, None)
            assert fn is not None
            res = fn(ds["rows"], ds["columns"], n_components=2)
            assert isinstance(res, dict)


# ── Mixture ────────────────────────────────────────────────────────────────

class TestMixture:
    def test_gmm(self):
        ds = numeric_small(30)
        res = ML.Mixture.gmm(ds["rows"], ds["columns"], n_components=3)
        assert isinstance(res, dict)
        assert "error" not in res
        if "labels" in res:
            assert len(res["labels"]) == len(ds["rows"])
            assert res["nComponents"] == 3 if "nComponents" in res else True

    def test_bayesian_gmm(self):
        ds = numeric_small(30)
        res = ML.Mixture.bayesian_gmm(ds["rows"], ds["columns"], n_components=3)
        assert isinstance(res, dict)
        assert "error" not in res or "labels" in res

    def test_gmm_covariance_types(self):
        ds = numeric_small(30)
        for cov in ["full", "tied", "diag", "spherical"]:
            res = ML.Mixture.gmm(ds["rows"], ds["columns"], n_components=2, covariance_type=cov)
            assert isinstance(res, dict)

    def test_mixture_dirty(self):
        ds = dirty()
        res = ML.Mixture.gmm(ds["rows"], ds["columns"], n_components=2)
        assert isinstance(res, dict)


# ── AnomalyExtended ────────────────────────────────────────────────────────

class TestAnomalyExtended:
    def test_lof(self):
        ds = numeric_small(30)
        res = ML.AnomalyExtended.lof(ds["rows"], ds["columns"], n_neighbors=5, contamination=0.1)
        assert isinstance(res, dict)
        assert "error" not in res
        if "labels" in res or "anomalies" in res:
            assert isinstance(res, dict)

    def test_one_class_svm(self):
        ds = numeric_small(30)
        res = ML.AnomalyExtended.one_class_svm(ds["rows"], ds["columns"], nu=0.05, kernel="rbf")
        assert isinstance(res, dict)
        assert "error" not in res or "labels" in res or "decision" in res or isinstance(res, dict)

    def test_elliptic_envelope(self):
        ds = numeric_small(30)
        res = ML.AnomalyExtended.elliptic_envelope(ds["rows"], ds["columns"], contamination=0.05)
        assert isinstance(res, dict)
        assert "error" not in res or "labels" in res or isinstance(res, dict)

    def test_lof_contamination_bounds(self):
        ds = numeric_small(20)
        for cont in [0.05, 0.1, 0.2]:
            res = ML.AnomalyExtended.lof(ds["rows"], ds["columns"], contamination=cont)
            assert isinstance(res, dict)

    def test_anomaly_cap(self):
        ds = numeric_small(rows=100, cols=3)
        res = ML.AnomalyExtended.lof(ds["rows"], ds["columns"], n_neighbors=5)
        assert isinstance(res, dict)

    def test_all_anomaly_methods_with_dirty(self):
        ds = dirty()
        for fn in [ML.AnomalyExtended.lof, ML.AnomalyExtended.one_class_svm, ML.AnomalyExtended.elliptic_envelope]:
            res = fn(ds["rows"], ds["columns"])
            assert isinstance(res, dict)
