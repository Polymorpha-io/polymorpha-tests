"""Shared assertion oracles."""

from __future__ import annotations


def expect_valid_dataset(dataset: dict) -> None:
    names = [c["name"] for c in dataset["columns"]]
    assert len(names) == len(set(names)), "duplicate column names"
    for col in dataset["columns"]:
        assert col["type"] in ("numeric", "categorical", "date", "boolean", "unknown")
    for row in dataset["rows"]:
        for col in dataset["columns"]:
            assert col["name"] in row


def expect_valid_correlation_matrix(matrix: dict) -> None:
    n = len(matrix["columns"])
    assert len(matrix["values"]) == n
    for i in range(n):
        assert len(matrix["values"][i]) == n
        assert matrix["values"][i][i] == 1
        for j in range(n):
            assert -1 <= matrix["values"][i][j] <= 1
            assert abs(matrix["values"][i][j] - matrix["values"][j][i]) < 1e-6
