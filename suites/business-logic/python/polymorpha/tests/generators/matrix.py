"""Matrix utilities — cartesian product for @pytest.mark.parametrize."""

from __future__ import annotations

import itertools
from typing import Any


def cartesian(*arrays: list[Any]) -> list[list[Any]]:
    if not arrays:
        return [[]]
    return [list(c) for c in itertools.product(*arrays)]


def label_for(row: dict) -> str:
    return " | ".join(f"{k}={v}" for k, v in row.items())


def enum_cases(values: list[str]) -> list[dict]:
    return [{"label": v, "value": v} for v in values]


def numeric_columns(columns: list[dict]) -> list[str]:
    return [c["name"] for c in columns if c.get("type") == "numeric"]


def categorical_columns(columns: list[dict]) -> list[str]:
    return [c["name"] for c in columns if c.get("type") == "categorical"]
