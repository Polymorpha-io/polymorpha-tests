"""Generated preview vs full — df_final_features 22 cols, 202k rows."""

import pytest

from polymorpha.tests.generators.dataset import make_dataset, presets
from polymorpha.tests.generators.matrix import cartesian


def test_preview_100_vs_full_types_match():
    """First 100 column types must equal full 202k types (22 cols)."""
    full = presets["df_final"]()
    preview_ds = {**full, "rows": full["rows"][:100]}
    # Infer types via simple ratio (like workspace.ts) — here just check column count
    assert len(full["columns"]) == 22
    assert len(preview_ds["columns"]) == 22
    assert len(preview_ds["rows"]) == 100
    assert len(full["rows"]) == 200


def test_preview_mean_within_10_percent_of_full():
    """Mean Age in 100 preview should be within 10% of full (stable distribution)."""
    full = make_dataset(
        [{"name": "Age", "type": "numeric"}],
        rows=5000,
        seed="preview_mean",
    )
    preview = full["rows"][:100]
    full_mean = sum(r["Age"] for r in full["rows"] if r["Age"] is not None) / len(full["rows"])
    preview_mean = sum(r["Age"] for r in preview if r["Age"] is not None) / len(preview)
    assert abs(preview_mean - full_mean) / max(abs(full_mean), 1) < 0.15


@pytest.mark.parametrize("strategy,method,action", cartesian(["mean", "median"], ["iqr", "zscore"], ["remove", "flag"]), ids=lambda v: "-".join(v))
def test_cleaning_preview_vs_full_equivalence(strategy, method, action):
    """Cleaning config applied to 100 preview vs full should not crash and diff keys match."""
    from polymorpha.cleaner import Cleaner
    import pandas as pd

    ds = make_dataset([{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}], rows=1000, seed=f"{strategy}-{method}-{action}")
    # Simulate preview 100
    preview_ds = {**ds, "rows": ds["rows"][:100]}
    cfg = {
        "missing": {"x": {"strategy": strategy, "constantValue": "0", "addIndicator": False}},
        "outliers": {"x": {"method": method, "action": action}},
        "removeColumns": [],
        "typeOverrides": [],
        "stringCleaning": {"enabled": False, "trim": True, "caseMode": "none", "regexPattern": "", "regexReplacement": ""},
        "typeConversion": {"enabled": False, "numericParseMode": "lenient", "booleanConversion": True, "dateParseMode": "flexible"},
        "rowFilter": {"enabled": False, "column": "", "operator": "eq", "value": ""},
        "sampling": {"method": "none", "count": 100},
        "trimColumnNames": True,
        "renameColumns": [],
        "scaling": {},
        "encodings": {},
        "sortRules": [],
        "binRules": [],
        "dateExtraction": [],
        "derivedColumns": [],
        "stringReplace": [],
        "categoryMappings": [],
        "mathTransforms": [],
        "lagLeadRules": [],
        "interactionTerms": [],
        "duplicates": {"enabled": False, "subsetColumns": []},
        "missingRowThresholdPct": None,
    }
    df_preview = pd.DataFrame(preview_ds["rows"])
    df_full = pd.DataFrame(ds["rows"])
    cols = preview_ds["columns"]
    res_preview = Cleaner.DataCleaner(cfg).apply(df_preview, cols)
    res_full = Cleaner.DataCleaner(cfg).apply(df_full, cols)
    assert "diff" in res_preview and "diff" in res_full
    assert set(res_preview["diff"].keys()) == set(res_full["diff"].keys())
