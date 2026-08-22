"""Tests for ML.Features."""

from __future__ import annotations

import pytest
from polymorpha.ml import ML

ROWS = [
    {"num": 1.0, "cat": "a"}, {"num": 2.0, "cat": "b"},
    {"num": 3.0, "cat": "a"}, {"num": None, "cat": "c"},
]
COLUMNS = [
    {"name": "num", "type": "numeric"}, {"name": "cat", "type": "categorical"},
]
CLEANING_DIFF = {"rowsRemoved": 1, "columnsRemoved": 0}
STATS_RESULTS = {"descriptive": [], "normality": [], "correlation": None}


class TestFeatures:
    def test_extract_dataset(self) -> None:
        result = ML.Features.extract_dataset(ROWS, COLUMNS, CLEANING_DIFF, STATS_RESULTS)
        assert result["rowCount"] == 4
        assert result["columnCount"] == 2
        assert result["numericColumnCount"] == 1
        assert isinstance(result["missingRate"], float)

    def test_extract_columns(self) -> None:
        result = ML.Features.extract_columns(ROWS, COLUMNS, STATS_RESULTS)
        assert len(result) == 2
        assert {c["column"] for c in result} == {"num", "cat"}
