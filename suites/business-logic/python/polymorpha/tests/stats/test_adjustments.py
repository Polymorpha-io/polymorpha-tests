"""Tests for Stats.Corrections."""

from __future__ import annotations

import pytest
from polymorpha.stats import Stats


class TestCorrections:
    def test_bonferroni_single(self) -> None:
        assert Stats.Corrections.bonferroni([0.01], 1) == [0.01]

    def test_bonferroni_multiple(self) -> None:
        assert Stats.Corrections.bonferroni([0.01, 0.02, 0.03], 3) == [0.03, 0.06, 0.09]

    def test_bonferroni_caps(self) -> None:
        corrected = Stats.Corrections.bonferroni([0.5, 0.6], 5)
        assert all(c <= 1.0 for c in corrected)

    def test_fdr_bh_empty(self) -> None:
        assert Stats.Corrections.fdr_bh([]) == []

    def test_fdr_bh_no_significant(self) -> None:
        corrected = Stats.Corrections.fdr_bh([0.5, 0.6, 0.7], alpha=0.05)
        assert all(c == p for c, p in zip(corrected, [0.5, 0.6, 0.7]))
