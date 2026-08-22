import math
import sys
import os
import numpy as np
import pytest

SIMPLE_ROWS = [
    {'x': 1.0, 'y': 10.0, 'g': 'a', 'cat': 'yes'},
    {'x': 2.0, 'y': 20.0, 'g': 'a', 'cat': 'no'},
    {'x': 3.0, 'y': 30.0, 'g': 'b', 'cat': 'yes'},
    {'x': 4.0, 'y': 40.0, 'g': 'b', 'cat': 'no'},
    {'x': 5.0, 'y': 50.0, 'g': 'c', 'cat': 'yes'},
    {'x': 6.0, 'y': 60.0, 'g': 'c', 'cat': 'no'},
]

NAN_ROWS = [
    {'x': 1.0, 'y': 10.0},
    {'x': float('nan'), 'y': 20.0},
    {'x': 3.0, 'y': float('inf')},
    {'x': float('-inf'), 'y': 40.0},
    {'x': None, 'y': 50.0},
]

from polymorpha.stats import Stats

class TestDescriptive:
    def test_descriptive_valid(self):
        """P2-A: compute_descriptive returns correct shape."""
        result = Stats.Descriptive.compute(SIMPLE_ROWS, 'x')
        assert result['column'] == 'x'
        assert result['count'] == 6
        assert result['mean'] == pytest.approx(3.5)
        assert result['median'] == pytest.approx(3.5)
        assert result['min'] == 1.0
        assert result['max'] == 6.0
        assert result['missing'] == 0
        assert 'std' in result

    def test_descriptive_with_missing(self):
        """P2-B: NaN/None handling in descriptive."""
        result = Stats.Descriptive.compute(NAN_ROWS, 'x')
        # NaN/Inf values are handled gracefully - no crash
        assert result['column'] == 'x'
        assert result['count'] >= 1  # at least some valid values
        assert 'missing' in result

    def test_descriptive_uniform_column(self):
        """P2-C: uniform column (zero std)."""
        # Create rows where all values are 5
        uniform = [{'y': 5.0}, {'y': 5.0}, {'y': 5.0}]
        result = Stats.Descriptive.compute(uniform, 'y')
        assert result['std'] == 0.0
        assert result['variance'] == 0.0

    def test_descriptive_empty(self):
        """Empty data."""
        result = Stats.Descriptive.compute([], 'x')
        assert result['count'] == 0

    def test_frequency(self):
        """Frequency table."""
        result = Stats.Descriptive.frequency(SIMPLE_ROWS, 'g')
        assert result['totalUnique'] == 3
        assert len(result['entries']) == 3
