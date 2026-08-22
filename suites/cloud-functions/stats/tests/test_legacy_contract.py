"""Tests for the legacy response-contract shaping in the stats Cloud Function.

Verifies that Analyse-panel builder params are mapped correctly and that
results satisfy the frontend's per-action contract (U/H/F/t/df/type/...).
"""

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402

ROWS = [
    {"score": 10, "grp": "g1", "y": 2, "g": "a", "cat1": "A", "cat2": "X",
     "target": 3, "p1": 1, "p2": 2, "p3": 3, "colA": 1, "colB": 2},
    {"score": 12, "grp": "g1", "y": 3, "g": "a", "cat1": "A", "cat2": "X",
     "target": 4, "p1": 2, "p2": 5, "p3": 6, "colA": 2, "colB": 4},
    {"score": 14, "grp": "g1", "y": 5, "g": "a", "cat1": "A", "cat2": "Y",
     "target": 5, "p1": 3, "p2": 7, "p3": 10, "colA": 3, "colB": 6},
    {"score": 15, "grp": "g1", "y": 4, "g": "b", "cat1": "B", "cat2": "X",
     "target": 6, "p1": 4, "p2": 10, "p3": 12, "colA": 4, "colB": 8},
    {"score": 20, "grp": "g2", "y": 8, "g": "b", "cat1": "B", "cat2": "Y",
     "target": 7, "p1": 5, "p2": 15, "p3": 15, "colA": 5, "colB": 10},
    {"score": 22, "grp": "g2", "y": 9, "g": "b", "cat1": "A", "cat2": "X",
     "target": 8, "p1": 6, "p2": 18, "p3": 19, "colA": 6, "colB": 12},
    {"score": 24, "grp": "g2", "y": 10, "g": "c", "cat1": "B", "cat2": "Y",
     "target": 9, "p1": 7, "p2": 17, "p3": 21, "colA": 7, "colB": 14},
    {"score": 26, "grp": "g2", "y": 12, "g": "c", "cat1": "A", "cat2": "Y",
     "target": 10, "p1": 8, "p2": 20, "p3": 24, "colA": 8, "colB": 16},
]


def run_action(action: str, params: dict, rows=ROWS) -> dict:
    body = main._handle_stats({"action": action, "rows": rows, "params": params}, "anonymous-user")
    assert body.get("error") is None, body
    result = body.get("result")
    assert isinstance(result, dict), body
    return result


CASES = [
    ("mannWhitney",
     {"numCol": "score", "groupCol": "grp", "g1": "g1", "g2": "g2"},
     ["U", "pValue", "significant", "group1", "group2", "column"]),
    ("kruskalWallis",
     {"numCol": "score", "groupCol": "grp"},
     ["H", "pValue", "df", "significant"]),
    ("ttest",
     {"column": "score", "column2": "y", "type": "independent", "mu": 0},
     ["t", "pValue", "df", "significant", "type", "meanDiff", "cohensD"]),
    ("ttest",
     {"column": "score", "type": "one-sample", "mu": 10},
     ["t", "pValue", "df", "significant", "type", "meanDiff", "cohensD"]),
    ("anova",
     {"responseCol": "y", "groupCol": "g"},
     ["F", "pValue", "significant", "dfBetween", "dfWithin", "etaSquared"]),
    ("welchAnova",
     {"responseCol": "y", "groupCol": "g"},
     ["F", "pValue", "significant", "dfNum", "dfDen"]),
    ("levene",
     {"responseCol": "y", "groupCol": "g"},
     ["pValue", "significant", "equalVariances", "F", "dfBetween", "dfWithin"]),
    ("chiSquare",
     {"col1": "cat1", "col2": "cat2"},
     ["chiSq", "pValue", "df", "cramersV", "significant"]),
    ("fisherExact",
     {"col1": "cat1", "col2": "cat2"},
     ["pValue", "oddsRatio", "significant"]),
    ("wilcoxon",
     {"col1": "score", "col2": "y"},
     ["pValue", "statistic", "significant", "W"]),
    ("regression",
     {"responseCol": "target", "predictors": ["p1", "p2"]},
     ["rSquared", "intercept", "coefficients", "fPValue", "pValues", "stdErrors"]),
    ("vif",
     {"cols": ["p1", "p2", "p3"]},
     ["predictors", "vif", "flagged"]),
    ("pairCorrelation",
     {"colA": "score", "colB": "y", "method": "pearson"},
     ["r", "pValue", "c1", "c2"]),
    ("correlation",
     {"columns": ["score", "y"], "method": "pearson"},
     ["columns", "values"]),
]


@pytest.mark.parametrize("action,params,required", CASES)
def test_legacy_contract_fields(action, params, required):
    result = run_action(action, params)
    for key in required:
        assert key in result, f"{action}: missing {key} in {sorted(result)}"


@pytest.mark.parametrize("key", ["pValue", "U", "H", "F", "t", "chiSq", "W"])
def test_stat_values_are_finite(key):
    for action, params, _ in CASES:
        if action == "correlation":
            continue
        result = run_action(action, params)
        if key in result and result[key] is not None:
            assert math.isfinite(float(result[key])), f"{action}: {key} non-finite"


def test_regression_coefficients_mapped_to_dict():
    result = run_action(
        "regression",
        {"responseCol": "target", "predictors": ["p1", "p2"]},
    )
    assert isinstance(result["coefficients"], dict)
    assert "intercept" not in result["coefficients"]
    assert set(result["coefficients"]) == {"p1", "p2"}
    assert isinstance(result["intercept"], float)
    assert set(result["pValues"]) == {"p1", "p2"}
    assert set(result["stdErrors"]) == {"p1", "p2"}


def test_vif_populates_map_and_flags():
    result = run_action("vif", {"cols": ["p1", "p2", "p3"]})
    assert set(result["vif"]) == {"p1", "p2", "p3"}
    assert all(isinstance(v, float) for v in result["vif"].values())
    assert isinstance(result["flagged"], list)


def test_pair_correlation_builder_keys():
    result = run_action("pairCorrelation", {"colA": "score", "colB": "y", "method": "pearson"})
    assert result["c1"] == "score"
    assert result["c2"] == "y"
    assert "r" in result and "pValue" in result


def test_degenerate_p_value_never_leaks_nan():
    const_rows = [{"y": 5, "g": "a"}, {"y": 5, "g": "a"}, {"y": 5, "g": "b"}, {"y": 3, "g": "b"}]
    result = run_action("anova", {"responseCol": "y", "groupCol": "g"}, rows=const_rows)
    p = result.get("pValue")
    assert p is not None
    assert math.isfinite(float(p))
    assert isinstance(result.get("significant"), bool)


def test_mann_whitney_tiny_groups_still_have_U():
    tiny_rows = [
        {"score": 1.0, "grp": "a"},
        {"score": 2.0, "grp": "a"},
        {"score": 3.0, "grp": "b"},
    ]
    result = run_action(
        "mannWhitney",
        {"numCol": "score", "groupCol": "grp", "g1": "a", "g2": "b"},
        rows=tiny_rows,
    )
    assert "U" in result, f"missing U in {sorted(result)}"
    assert result["U"] == 0.0
    assert result["pValue"] == 1.0
    assert result["significant"] is False
    assert any("too small" in n for n in result.get("notes", []))


def test_kruskal_wallis_empty_groups_still_have_H():
    result = run_action(
        "kruskalWallis",
        {"numCol": "score", "groupCol": "grp"},
        rows=[{"score": 5, "grp": "x"}],
    )
    assert "H" in result, f"missing H in {sorted(result)}"
    assert result["H"] == 0.0


def test_wilcoxon_too_few_pairs_still_have_statistic():
    result = run_action(
        "wilcoxon",
        {"col1": "score", "col2": "y"},
        rows=[
            {"score": 1, "y": 2},
            {"score": 3, "y": 4},
        ],
    )
    assert "W" in result, f"missing W in {sorted(result)}"
    assert "statistic" in result
    assert result["statistic"] == result["W"]


def test_mann_whitney_numeric_label_mismatch_resolved():
    rows = [
        {"score": 10, "grp": 1.0},
        {"score": 15, "grp": 1.0},
        {"score": 20, "grp": 1.0},
        {"score": 12, "grp": 2.0},
        {"score": 22, "grp": 2.0},
        {"score": 24, "grp": 2.0},
    ]
    result = run_action(
        "mannWhitney",
        {"numCol": "score", "groupCol": "grp", "g1": "1", "g2": "2"},
        rows=rows,
    )
    assert "U" in result, f"missing U in {sorted(result)}"
    assert result["U"] > 0.0, f"expected real statistic, got {result['U']}"
    assert math.isfinite(float(result["pValue"]))


def test_pair_correlation_constant_column_sanitized():
    const_x = [{"x": 7, "y": 1.0}, {"x": 7, "y": 2.0}, {"x": 7, "y": 3.0}, {"x": 7, "y": 4.0}]
    result = run_action("pairCorrelation", {"colA": "x", "colB": "y", "method": "pearson"}, rows=const_x)
    assert "pValue" in result
    assert result["pValue"] == 1.0
    assert math.isfinite(float(result["r"]))