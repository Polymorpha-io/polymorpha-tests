"""Tests for ML.Cluster.run_with_labels (derived-column write-back)."""

from __future__ import annotations

import pytest
from polymorpha.ml import ML

ROWS = [{"x": float(i), "y": float((i * 7) % 5)} for i in range(12)]
COLUMNS = [
    {"name": "x", "type": "numeric"},
    {"name": "y", "type": "numeric"},
]


class TestRunWithLabels:
    def test_kmeans_appends_one_column(self) -> None:
        res = ML.Cluster.run_with_labels(ROWS, COLUMNS, algorithm="kmeans", n_clusters=3)
        assert "error" not in res
        assert res["newColumn"] == "kmeans_label"
        assert res["rowCount"] == len(ROWS)
        assert len(res["rows"]) == len(ROWS)
        assert len(res["labels"]) == len(ROWS)
        names = [c["name"] for c in res["columns"]]
        assert names == ["x", "y", "kmeans_label"]

    def test_labels_match_rows_positionally(self) -> None:
        res = ML.Cluster.run_with_labels(ROWS, COLUMNS, algorithm="kmeans", n_clusters=2)
        col = res["newColumn"]
        for row, lab in zip(res["rows"], res["labels"]):
            assert row[col] == lab

    def test_custom_column_name(self) -> None:
        res = ML.Cluster.run_with_labels(ROWS, COLUMNS, column="grp", algorithm="kmeans", n_clusters=2)
        assert res["newColumn"] == "grp"
        assert "grp" in res["rows"][0]

    def test_collision_suffixes(self) -> None:
        rows = [{**r, "kmeans_label": 0} for r in ROWS]
        cols = COLUMNS + [{"name": "kmeans_label", "type": "numeric"}]
        res = ML.Cluster.run_with_labels(rows, cols, algorithm="kmeans", n_clusters=2)
        assert res["newColumn"] == "kmeans_label_2"

    def test_dbscan_noise_preserved(self) -> None:
        res = ML.Cluster.run_with_labels(ROWS, COLUMNS, algorithm="dbscan", eps=0.5, min_samples=2)
        assert "error" not in res
        assert res["newColumn"] == "dbscan_label"
        assert len(res["labels"]) == len(ROWS)

    def test_error_passthrough_no_partial_column(self) -> None:
        res = ML.Cluster.run_with_labels([{"x": 1.0}], COLUMNS, algorithm="kmeans")
        assert "error" in res
        assert "rows" not in res

    def test_unknown_algorithm_errors(self) -> None:
        res = ML.Cluster.run_with_labels(ROWS, COLUMNS, algorithm="nope")
        assert "error" in res
