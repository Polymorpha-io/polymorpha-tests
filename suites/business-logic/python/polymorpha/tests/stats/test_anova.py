"""Tests for Stats.Anova."""

from __future__ import annotations

import pytest
from polymorpha.stats import Stats

ROWS = [
    {"val": 1.0, "group": "a"}, {"val": 2.0, "group": "a"},
    {"val": 5.0, "group": "b"}, {"val": 6.0, "group": "b"},
    {"val": 9.0, "group": "c"}, {"val": 10.0, "group": "c"},
]


class TestAnova:
    def test_one_way(self) -> None:
        result = Stats.Anova.OneWay.test(ROWS, col="val", group_col="group")
        assert result.test == "One-way ANOVA"
        assert result.p_value is not None

    def test_welch(self) -> None:
        result = Stats.Anova.Welch.test(ROWS, col="val", group_col="group")
        assert result.test == "Welch's ANOVA"
        assert result.p_value is not None
