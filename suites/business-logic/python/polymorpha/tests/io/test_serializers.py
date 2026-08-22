"""Tests for IO.safe_float and IO.Encoder."""

from __future__ import annotations

import numpy as np
import pytest
from polymorpha.io import IO
from polymorpha.io._encoder import clean_nan


class TestSafeFloat:
    def test_none(self) -> None:
        assert IO.safe_float(None) is None
    def test_float_value(self) -> None:
        assert IO.safe_float(3.14) == 3.14
    def test_nan_value(self) -> None:
        assert IO.safe_float(float("nan")) is None
    def test_numeric_string(self) -> None:
        assert IO.safe_float("3.14") == 3.14
    def test_empty_string(self) -> None:
        assert IO.safe_float("") is None
    def test_non_numeric_string(self) -> None:
        assert IO.safe_float("abc") is None
    def test_int(self) -> None:
        assert IO.safe_float(42) == 42.0


class TestEncoder:
    def test_numpy_int(self) -> None:
        encoder = IO.Encoder()
        result = encoder.default(np.int64(42))
        assert result == 42
        assert isinstance(result, int)

    def test_numpy_float(self) -> None:
        encoder = IO.Encoder()
        result = encoder.default(np.float64(3.14))
        assert result == 3.14
        assert isinstance(result, float)

    def test_clean_nan(self) -> None:
        assert clean_nan(float("nan")) is None
        assert clean_nan(float("inf")) is None
        assert clean_nan({"a": float("nan"), "b": 1.0}) == {"a": None, "b": 1.0}
