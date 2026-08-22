import math
import sys
import os
import numpy as np
import pytest

from polymorpha.stats import Stats

SIMPLE_ROWS = [
    {'x': 1.0, 'y': 10.0, 'g': 'a', 'cat': 'yes'},
    {'x': 2.0, 'y': 20.0, 'g': 'a', 'cat': 'no'},
    {'x': 3.0, 'y': 30.0, 'g': 'b', 'cat': 'yes'},
    {'x': 4.0, 'y': 40.0, 'g': 'b', 'cat': 'no'},
    {'x': 5.0, 'y': 50.0, 'g': 'c', 'cat': 'yes'},
    {'x': 6.0, 'y': 60.0, 'g': 'c', 'cat': 'no'},
]

class TestNormality:
    def test_normality_shapiro(self):
        """Normality test returns correct shape."""
        arr = np.array([r['x'] for r in SIMPLE_ROWS])
        result = Stats.Normality.run(arr, method='shapiro-wilk')
        assert result.test == 'Shapiro-Wilk'
        assert result.p_value is not None
        assert result.is_normal is not None

        qq = Stats.Normality.QQPlot.build(arr)
        assert 'theoretical' in qq
        assert 'sample' in qq

    def test_normality_lilliefors(self):
        """Lilliefors test."""
        arr = np.array([r['x'] for r in SIMPLE_ROWS])
        result = Stats.Normality.run(arr, method='lilliefors')
        assert result.test == 'Lilliefors'

    def test_normality_insufficient_data(self):
        """Less than 3 points."""
        arr = np.array([1.0])
        result = Stats.Normality.run(arr, method='shapiro-wilk')
        # Should handle gracefully, returning p_value 1.0 and is_normal None
        assert result.p_value == 1.0
        assert result.is_normal is None
        assert "n < 3" in result.notes[0]

    def test_normality_constant_values(self):
        """Constant columns must not produce NaN p-values (breaks API consumers)."""
        arr = np.array([3.0] * 8)
        for method in ('shapiro-wilk', 'lilliefors', 'dagostino'):
            result = Stats.Normality.run(arr, method=method)
            assert result.p_value == 1.0
            assert result.is_normal is None
            assert result.statistic is None
            assert any("constant" in note for note in result.notes)
