import math
import sys
import os
import numpy as np
import pytest

from polymorpha.stats import Stats
from polymorpha.cleaner import Cleaner

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

class TestRegression:
    def test_ols_regression(self):
        """OLS regression with diagnostics."""
        rows = [
            {'y': 1, 'x1': 1, 'x2': 10},
            {'y': 2, 'x1': 2, 'x2': 20},
            {'y': 3, 'x1': 3, 'x2': 30},
            {'y': 4, 'x1': 4, 'x2': 40},
            {'y': 5, 'x1': 5, 'x2': 50},
        ]
        result = Stats.Regression.run(rows, {'dependentVar': 'y', 'predictors': ['x1']})
        assert 'rSquared' in result
        assert 'coefficients' in result
        assert len(result['coefficients']) > 0

    def test_regression_insufficient_rows(self):
        """Regression needs at least as many rows as predictors."""
        rows = [{'y': 1, 'x1': 1}]
        result = Stats.Regression.run(rows, {'dependentVar': 'y', 'predictors': ['x1']})
        assert 'error' in result

class TestVIF:
    def test_vif(self):
        """Variance Inflation Factor."""
        X = np.array([
            [1, 10],
            [2, 20],
            [3, 30],
            [4, 40],
        ])
        warnings = Cleaner.Assumptions().check_vif(X, ['x1', 'x2'])
        # perfect collinearity -> warnings
        assert len(warnings) > 0
        assert warnings[0]['constraint'] == 'high_vif'

    def test_vif_single_predictor(self):
        """VIF with single predictor."""
        X = np.array([[1], [2], [3], [4]])
        warnings = Cleaner.Assumptions().check_vif(X, ['x'])
        # No collinearity with 1 predictor
        assert len(warnings) == 0
