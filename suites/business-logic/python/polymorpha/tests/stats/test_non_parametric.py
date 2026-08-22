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

class TestNonParametric:
    def test_mann_whitney(self):
        """Mann-Whitney U."""
        rows = [
            {'x': 1.0, 'g': 'a'}, {'x': 2.0, 'g': 'a'},
            {'x': 5.0, 'g': 'b'}, {'x': 6.0, 'g': 'b'},
        ]
        result = Stats.NonParametric.MannWhitney.test(rows, col='x', group_col='g', group1='a', group2='b')
        assert result.test == 'Mann-Whitney U'
        assert result.p_value is not None

    def test_wilcoxon(self):
        """Wilcoxon signed-rank."""
        rows = [
            {'before': 10, 'after': 8},
            {'before': 12, 'after': 9},
            {'before': 11, 'after': 10},
            {'before': 14, 'after': 12},
            {'before': 13, 'after': 11},
            {'before': 15, 'after': 13},
            {'before': 16, 'after': 14},
        ]
        result = Stats.NonParametric.Wilcoxon.test(rows, 'before', 'after')
        assert result.test == 'Wilcoxon signed-rank'
        assert result.p_value is not None

    def test_kruskal_wallis(self):
        """Kruskal-Wallis."""
        rows = [
            {'x': 1, 'g': 'a'}, {'x': 2, 'g': 'a'}, {'x': 3, 'g': 'a'},
            {'x': 4, 'g': 'b'}, {'x': 5, 'g': 'b'}, {'x': 6, 'g': 'b'},
        ]
        result = Stats.NonParametric.KruskalWallis.test(rows, 'x', 'g')
        assert result.test == 'Kruskal-Wallis H'
        assert result.p_value is not None

    def test_kruskal_wallis_insufficient(self):
        """Kruskal-Wallis with too few data points."""
        rows = [{'x': 1, 'g': 'a'}, {'x': 2, 'g': 'a'}]
        result = Stats.NonParametric.KruskalWallis.test(rows, 'x', 'g')
        assert result.p_value == 1.0
        assert 'Need \u22652 valid groups' in result.notes[0]
