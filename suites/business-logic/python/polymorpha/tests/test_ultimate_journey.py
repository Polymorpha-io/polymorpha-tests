"""Ultimate-journey parity — business-logic shapes behind E2E stages C/D.

Mirrors `polymorpha-tests/suites/polymorpha/tests/e2e/ultimate-journey.spec.ts`
on a deterministic dirty-like frame (seed "ultimate_journey"): numerics
salary/age + 2-group treatment, 10% missing. Locks the response contracts
the journey asserts in the browser (spotlight numbers, train metrics) so a
backend shape change fails here first, not in Playwright.
"""

from __future__ import annotations

import math

import pytest

from polymorpha.ml import ML
from polymorpha.stats import Stats
from polymorpha.tests.generators.dataset import make_dataset


def journey_frame() -> tuple[list[dict], list[dict]]:
    ds = make_dataset(
        cols=[
            {"name": "salary", "type": "numeric"},
            {"name": "age", "type": "numeric"},
            {"name": "treatment", "type": "categorical", "cardinality": 2},
        ],
        rows=40,
        missing_pct=0.1,
        seed="ultimate_journey",
    )
    return ds["rows"], ds["columns"]


class TestUltimateJourney:
    def test_stage_c_descriptive_shape(self) -> None:
        """Stage C1: descriptive numbers behind the Analyse spotlight."""
        rows, _ = journey_frame()
        result = Stats.Descriptive.compute(rows, "salary")
        assert result["column"] == "salary"
        assert result["count"] > 0
        assert math.isfinite(result["mean"])
        assert math.isfinite(result["median"])
        assert result["min"] <= result["max"]

    def test_stage_c_mann_whitney_shape(self) -> None:
        """Stage C2: Mann-Whitney U/statistic/p-value, missing-tolerant."""
        rows, _ = journey_frame()
        result = Stats.NonParametric.MannWhitney.test(
            rows,
            col="salary",
            group_col="treatment",
            group1="Control",
            group2="DrugA",
        )
        assert result.test == "Mann-Whitney U"
        assert result.p_value is not None
        assert 0.0 <= result.p_value <= 1.0

    def test_stage_d_train_shape(self) -> None:
        """Stage D1: knn train returns metrics, never a raw throw."""
        rows, columns = journey_frame()
        result = ML.Training(algorithm="knn").run(
            rows, columns, target="treatment", features=["age", "salary"]
        )
        assert "error" not in result, result.get("error")
        metrics = result["metrics"]
        assert 0.0 <= metrics["testAccuracy"] <= 1.0
