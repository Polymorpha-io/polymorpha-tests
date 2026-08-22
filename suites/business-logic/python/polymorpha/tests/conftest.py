"""Shared fixtures — re-exports generators for all test modules."""

import pytest
from polymorpha.tests.generators.dataset import make_dataset, make_numeric_dataset, presets
from polymorpha.tests.generators.seed import hash_string, mulberry32

SIMPLE_ROWS = [
    {"x": 1.0, "y": 10.0, "g": "a", "cat": "yes"},
    {"x": 2.0, "y": 20.0, "g": "a", "cat": "no"},
    {"x": 3.0, "y": 30.0, "g": "b", "cat": "yes"},
    {"x": 4.0, "y": 40.0, "g": "b", "cat": "no"},
    {"x": 5.0, "y": 50.0, "g": "c", "cat": "yes"},
    {"x": 6.0, "y": 60.0, "g": "c", "cat": "no"},
]
NAN_ROWS = [
    {"x": 1.0, "y": 10.0},
    {"x": float("nan"), "y": 20.0},
    {"x": 3.0, "y": float("inf")},
    {"x": float("-inf"), "y": 40.0},
    {"x": None, "y": 50.0},
]


@pytest.fixture
def simple_rows():
    return SIMPLE_ROWS


@pytest.fixture
def nan_rows():
    return NAN_ROWS


@pytest.fixture
def rng():
    return mulberry32(42)
