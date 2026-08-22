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

class TestCategorical:
    def test_chi_square(self):
        """Chi-square independence."""
        result = Stats.Categorical.ChiSquare.test(SIMPLE_ROWS, 'g', 'cat')
        assert result.test == 'Chi-square'
        assert result.p_value is not None

    def test_chi_square_insufficient(self):
        """Chi-square with missing data."""
        # Need 2x2, g is empty
        result = Stats.Categorical.ChiSquare.test(NAN_ROWS, 'g', 'cat')
        assert result.p_value == 1.0
        assert 'Insufficient' in result.notes[0]

    def test_fisher_exact(self):
        """Fisher's Exact."""
        rows = [
            {'a': 'T', 'b': 'X'}, {'a': 'T', 'b': 'X'},
            {'a': 'F', 'b': 'Y'}, {'a': 'F', 'b': 'Y'},
        ]
        result = Stats.Categorical.FisherExact.test(rows, 'a', 'b')
        assert result.test == "Fisher's exact"
        assert result.p_value is not None

    def test_fisher_exact_invalid(self):
        """Fisher's exact requires 2x2."""
        rows = [
            {'a': 'T', 'b': 'X'}, {'a': 'T', 'b': 'Y'},
            {'a': 'F', 'b': 'Z'}, {'a': 'F', 'b': 'Z'},
        ]
        result = Stats.Categorical.FisherExact.test(rows, 'a', 'b')
        assert result.p_value == 1.0
        assert '2x2' in result.notes[0]
