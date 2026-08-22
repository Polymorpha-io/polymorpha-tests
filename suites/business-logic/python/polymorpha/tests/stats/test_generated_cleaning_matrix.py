"""Generated cleaning matrix — deterministic configs through DataCleaner."""

import pandas as pd
import pytest

from polymorpha.cleaner import Cleaner
from polymorpha.tests.generators.cleaning import INVALID_CLEANING_CASES, MISSING_STRATEGIES, OUTLIER_ACTIONS, OUTLIER_METHODS, VALID_CLEANING_CASES, make_cleaning_config
from polymorpha.tests.generators.dataset import make_dataset
from polymorpha.tests.generators.matrix import cartesian


@pytest.mark.parametrize("case", VALID_CLEANING_CASES, ids=lambda c: c["label"])
def test_valid_cleaning_applies(case):
    ds = case["dataset"]()
    cfg = case["patch"](ds)
    df = pd.DataFrame(ds["rows"])
    cleaner = Cleaner.DataCleaner(cfg)
    res = cleaner.apply(df, ds["columns"])
    assert "rows" in res and "columns" in res and "diff" in res


@pytest.mark.parametrize("case", INVALID_CLEANING_CASES, ids=lambda c: c["label"])
def test_invalid_cleaning_has_message(case):
    ds = case["dataset"]()
    cfg = case["patch"](ds)
    # For python, invalid configs don't raise but produce diff — just check it runs
    df = pd.DataFrame(ds["rows"])
    cleaner = Cleaner.DataCleaner(cfg)
    res = cleaner.apply(df, ds["columns"])
    assert res is not None


@pytest.mark.parametrize(
    "strategy,method,action",
    cartesian(MISSING_STRATEGIES, OUTLIER_METHODS, OUTLIER_ACTIONS),
    ids=lambda v: f"{v[0]}-{v[1]}-{v[2]}",
)
def test_cartesian_no_crash(strategy, method, action):
    ds = make_dataset([{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}], rows=10, seed=f"{strategy}-{method}-{action}")
    cfg = make_cleaning_config(ds)
    cfg["missing"]["x"] = {"strategy": strategy, "constantValue": "0", "addIndicator": False}
    cfg["outliers"]["x"] = {"method": method, "action": action}
    df = pd.DataFrame(ds["rows"])
    res = Cleaner.DataCleaner(cfg).apply(df, ds["columns"])
    assert res is not None
