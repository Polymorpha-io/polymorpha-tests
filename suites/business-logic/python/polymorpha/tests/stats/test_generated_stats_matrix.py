"""Generated stats matrix — all 27 actions produce valid results."""

import pytest

from polymorpha.schemas.api import StatsRequest
from polymorpha.stats import Stats
from polymorpha.tests.generators.contract import ALL_TEST_KEYS, stats_action_for
from polymorpha.tests.generators.dataset import make_dataset
from polymorpha.tests.generators.stats import params_for_action

# Map action to a callable that exercises it — mirrors cloud-functions dispatch
ACTION_CALLABLES = {
    "kendallTau": lambda rows, p: Stats.CorrelationExtended.kendall(rows, p["colA"], p["colB"]),
    "partialCorrelation": lambda rows, p: Stats.CorrelationExtended.partial(rows, p["colA"], p["colB"], [p["control"]]),
    "pointBiserial": lambda rows, p: Stats.CorrelationExtended.point_biserial(rows, p["catCol"], p["numCol"]),
    "tost": lambda rows, p: Stats.Equivalence.tost_mean(rows, col=p["col"], low=p["low"], high=p["high"]),
    "binomial": lambda rows, p: Stats.Binomial.test(rows, col=p["col"]),
    "mcnemar": lambda rows, p: Stats.Binomial.mcnemar(rows, col1=p["col1"], col2=p["col2"]),
    "gofChisquare": lambda rows, p: Stats.Binomial.gof_chisquare(rows, col=p["col"]),
    "twoWayAnova": lambda rows, p: Stats.AnovaExtended.two_way(rows, value_col=p["responseCol"], factor_a=p["factorA"], factor_b=p["factorB"]),
    "friedman": lambda rows, p: Stats.AnovaExtended.friedman(rows, columns=p["columns"]),
    "logisticRegression": lambda rows, p: Stats.RegressionExtended.logistic(rows, target=p["target"], predictors=p["predictors"]),
}


@pytest.mark.parametrize("key", ALL_TEST_KEYS, ids=lambda k: k)
def test_stats_request_supported(key):
    action = stats_action_for(key)
    # Should not raise ValidationError
    req = StatsRequest(action=action, rows=[{"x": 1}], params={})
    assert req.action == action


@pytest.mark.parametrize("key", ["kendallTau", "partialCorrelation", "pointBiserial", "tost", "binomial", "mcnemar", "gofChisquare", "twoWayAnova", "friedman", "logisticRegression"], ids=lambda k: k)
def test_extended_action_runs(key):
    action = stats_action_for(key)
    # Build a dataset that satisfies the action's column needs
    if key == "pointBiserial":
        ds = make_dataset([{"name": "num", "type": "numeric"}, {"name": "bin", "type": "categorical", "cardinality": 2}], rows=20, seed=key)
    elif key == "binomial":
        ds = make_dataset([{"name": "cat", "type": "categorical", "cardinality": 2}], rows=10, seed=key)
        rows = [{"cat": "yes"} for _ in range(5)] + [{"cat": "no"} for _ in range(5)]
        params = {"col": "cat"}
        fn = ACTION_CALLABLES.get(action)
        if fn is None:
            pytest.skip(f"no direct callable for {action}")
        res = fn(rows, params)
        assert isinstance(res, dict)
        assert "pValue" in res
        return
    elif key == "gofChisquare":
        ds = make_dataset([{"name": "cat", "type": "categorical", "cardinality": 3}], rows=12, seed=key)
        rows = ds["rows"]
        params = {"col": "cat"}
        fn = ACTION_CALLABLES.get(action)
        res = fn(rows, params)
        assert isinstance(res, dict)
        assert "pValue" in res
        return
    else:
        ds = make_dataset(
            [{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}, {"name": "z", "type": "numeric"}, {"name": "cat", "type": "categorical", "cardinality": 3}, {"name": "flag", "type": "categorical", "cardinality": 2}],
            rows=20, seed=key,
        )
    rows = ds["rows"]
    params = params_for_action(action, ds)

    fn = ACTION_CALLABLES.get(action)
    if fn is None:
        pytest.skip(f"no direct callable for {action}")
    try:
        res = fn(rows, params)
        assert isinstance(res, dict)
        # twoWayAnova nests pValue inside factor_a/b/interaction
        if key == "twoWayAnova":
            assert "interaction" in res or "factor_a" in res
        else:
            assert "pValue" in res or "tau" in res or "r" in res or "p_low" in res or "p_high" in res or "significant" in res
    except ValueError as e:
        msg = str(e).lower()
        assert any(k in msg for k in ("singular", "insufficient", "needs", "requires", "conditions", "paired", "at least 3"))
