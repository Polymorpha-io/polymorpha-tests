import math
import sys
import os
import numpy as np
import pytest

from polymorpha.cleaner import Cleaner

SIMPLE_ROWS = [
    {'x': 1.0, 'y': 10.0, 'g': 'a', 'cat': 'yes'},
    {'x': 2.0, 'y': 20.0, 'g': 'a', 'cat': 'no'},
    {'x': 3.0, 'y': 30.0, 'g': 'b', 'cat': 'yes'},
    {'x': 4.0, 'y': 40.0, 'g': 'b', 'cat': 'no'},
    {'x': 5.0, 'y': 50.0, 'g': 'c', 'cat': 'yes'},
    {'x': 6.0, 'y': 60.0, 'g': 'c', 'cat': 'no'},
]

class TestLevene:
    def test_levene(self):
        """Levene's test."""
        arrs = [np.array([1.0, 2.0]), np.array([3.0, 4.0])]
        labels = ['a', 'b']
        result = Cleaner.Assumptions().check_equal_variance(arrs, labels)
        
        assert 'test' in result
        assert 'pValue' in result
        assert 'equalVariances' in result

    def test_levene_insufficient(self):
        """Levene with too few arrays."""
        arrs = [np.array([1.0, 2.0])]
        result = Cleaner.Assumptions().check_equal_variance(arrs, ['a'])
        assert result['pValue'] is None
        assert 'fewer than 2 groups' in result['note']
