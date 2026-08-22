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

NAN_ROWS = [
    {'x': 1.0, 'y': 10.0},
    {'x': float('nan'), 'y': 20.0},
    {'x': 3.0, 'y': float('inf')},
    {'x': float('-inf'), 'y': 40.0},
    {'x': None, 'y': 50.0},
]

class TestCorrelation:
    def test_correlation_matrix(self):
        """P2-F: correlation matrix includes FDR-corrected p-values."""
        result = Stats.Correlation.compute(SIMPLE_ROWS, ['x', 'y'], 'pearson')
        assert result is not None
        assert 'columns' in result
        assert 'values' in result
        assert 'pValues' in result  # FDR correction added
        assert len(result['values']) == 2
        # x and y are perfectly correlated
        assert result['values'][0][1] == pytest.approx(1.0, abs=0.001)

    def test_correlation_single_column(self):
        """Correlation requires at least 2 columns."""
        result = Stats.Correlation.compute(SIMPLE_ROWS, ['x'], 'pearson')
        assert result is None

    def test_correlation_too_few_rows(self):
        """Correlation requires at least 3 rows with data."""
        rows = [{'x': 1, 'y': 10}, {'x': 2, 'y': 20}]
        result = Stats.Correlation.compute(rows, ['x', 'y'], 'pearson')
        assert result is None
