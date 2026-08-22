"""Tests for Stats.TTest."""

from __future__ import annotations

import numpy as np
import pytest
from polymorpha.stats import Stats

ROWS = [
    {"x": 1.0, "y": 10.0}, {"x": 2.0, "y": 20.0}, {"x": 3.0, "y": 30.0},
    {"x": 4.0, "y": 40.0}, {"x": 5.0, "y": 50.0}, {"x": 6.0, "y": 60.0},
]


class TestTTest:
    def test_one_sample(self) -> None:
        arr = np.array([r["x"] for r in ROWS], dtype=np.float64)
        result = Stats.TTest.OneSample.test(arr, mu=0)
        assert result.test == "t-test (one-sample)"
        assert result.p_value is not None

    def test_one_sample_with_mu(self) -> None:
        arr = np.array([r["x"] for r in ROWS], dtype=np.float64)
        result = Stats.TTest.OneSample.test(arr, mu=3.5)
        assert result.statistic is not None

    def test_paired(self) -> None:
        arr1 = np.array([r["x"] for r in ROWS], dtype=np.float64)
        arr2 = np.array([r["y"] for r in ROWS], dtype=np.float64)
        result = Stats.TTest.Paired.test(arr1, arr2)
        assert result.test == "t-test (paired)"

    def test_independent(self) -> None:
        arr1 = np.array([r["x"] for r in ROWS[:3]], dtype=np.float64)
        arr2 = np.array([r["x"] for r in ROWS[3:]], dtype=np.float64)
        result = Stats.TTest.Independent.test(arr1, arr2)
        assert result.test == "t-test (independent)"

    def test_run_dispatcher(self) -> None:
        result = Stats.TTest.run(ROWS, {"column": "x"})
        assert hasattr(result, "test")
        assert result.test == "t-test (one-sample)"
