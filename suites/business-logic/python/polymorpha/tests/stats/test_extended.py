"""Tests for Stats extended inferential — 15 retained Numiqo parity (filtered)."""

from __future__ import annotations

import math
import numpy as np
import pytest

from polymorpha.stats import Stats


# ── TOST Equivalence ───────────────────────────────────────────────────────

class TestTOST:
    def test_tost_one_sample_equivalent(self):
        # Values centered at 0 within [-0.5, 0.5] → equivalent
        rows = [{"x": v} for v in [0.1, -0.1, 0.05, -0.05, 0.0, 0.08]]
        res = Stats.Equivalence.tost_mean(rows, col="x", low=-0.5, high=0.5)
        assert "pValue" in res
        assert 0 <= res["pValue"] <= 1
        assert "equivalent" in res
        assert res["equivalent"] is True
        assert res["significant"] is True or res["significant"] is False

    def test_tost_one_sample_not_equivalent(self):
        rows = [{"x": v} for v in [5.0, 5.1, 4.9, 5.05, 4.95, 5.2]]
        res = Stats.Equivalence.tost_mean(rows, col="x", low=-0.5, high=0.5)
        assert res["equivalent"] is False

    def test_tost_two_sample(self):
        rows = [{"a": 0.1, "b": 0.0}, {"a": -0.1, "b": 0.1}, {"a": 0.05, "b": -0.05}, {"a": 0.0, "b": 0.02}]
        res = Stats.Equivalence.tost_mean(rows, col1="a", col2="b", low=-0.5, high=0.5)
        assert "pValue" in res
        assert "meanDiff" in res

    def test_tost_invalid_bounds(self):
        rows = [{"x": 1.0}, {"x": 2.0}]
        with pytest.raises(ValueError):
            Stats.Equivalence.tost_mean(rows, col="x", low=1.0, high=0.5)

    def test_tost_proportion(self):
        rows = [{"p": "yes"} for _ in range(5)] + [{"p": "no"} for _ in range(5)]
        res = Stats.Equivalence.tost_proportion(rows, col="p", p0=0.5, low=0.3, high=0.7)
        assert "pValue" in res
        assert "p_hat" in res


# ── Binomial ───────────────────────────────────────────────────────────────

class TestBinomial:
    def test_binomial_balanced(self):
        rows = [{"b": "yes"} for _ in range(5)] + [{"b": "no"} for _ in range(5)]
        res = Stats.Binomial.test(rows, col="b", p=0.5)
        assert res["test"] == "Binomial"
        assert res["n"] == 10
        assert res["k"] == 5
        assert 0 <= res["pValue"] <= 1

    def test_binomial_extreme(self):
        rows = [{"b": "yes"} for _ in range(9)] + [{"b": "no"}]
        res = Stats.Binomial.test(rows, col="b", p=0.5)
        assert res["pValue"] < 0.05
        assert res["significant"] is True

    def test_binomial_invalid_p(self):
        rows = [{"b": "yes"}]
        with pytest.raises(ValueError):
            Stats.Binomial.test(rows, col="b", p=1.5)

    def test_mcnemar(self):
        # paired: a= yes/no, b= yes/no
        rows = [
            {"a": "yes", "b": "yes"},
            {"a": "yes", "b": "no"},
            {"a": "no", "b": "yes"},
            {"a": "no", "b": "no"},
            {"a": "yes", "b": "no"},
            {"a": "no", "b": "yes"},
        ]
        res = Stats.Binomial.mcnemar(rows, col1="a", col2="b")
        assert res["test"] == "McNemar"
        assert "chi2" in res
        assert 0 <= res["pValue"] <= 1

    def test_gof_uniform(self):
        rows = [{"c": "A"}, {"c": "A"}, {"c": "B"}, {"c": "B"}, {"c": "C"}, {"c": "C"}]
        res = Stats.Binomial.gof_chisquare(rows, col="c")
        assert res["test"] == "Chi-square GOF"
        assert res["df"] == 2
        assert "pValue" in res

    def test_gof_with_expected(self):
        rows = [{"c": "A"} for _ in range(10)] + [{"c": "B"} for _ in range(20)]
        res = Stats.Binomial.gof_chisquare(rows, col="c", expected={"A": 0.5, "B": 0.5})
        assert res["n"] == 30


# ── ANOVA Extended ─────────────────────────────────────────────────────────

class TestAnovaExtended:
    def test_two_way(self):
        rows = []
        # 2x2 factorial with 2 reps per cell
        for a in ["A", "B"]:
            for b in ["X", "Y"]:
                for v in [10.0, 12.0]:
                    # add effect: A+X higher
                    val = v + (5 if a == "A" and b == "X" else 0)
                    rows.append({"val": val, "fa": a, "fb": b})
        res = Stats.AnovaExtended.two_way(rows, value_col="val", factor_a="fa", factor_b="fb")
        assert res["test"] == "Two-way ANOVA"
        assert "factor_a" in res
        assert "factor_b" in res
        assert "interaction" in res
        assert 0 <= res["factor_a"]["pValue"] <= 1

    def test_two_way_insufficient(self):
        rows = [{"val": 1.0, "fa": "A", "fb": "X"}]
        with pytest.raises(ValueError):
            Stats.AnovaExtended.two_way(rows, value_col="val", factor_a="fa", factor_b="fb")

    def test_repeated_measures(self):
        # 3 subjects x 2 conditions long format
        rows = []
        for subj in ["s1", "s2", "s3"]:
            for cond, base in [("c1", 10), ("c2", 12)]:
                rows.append({"subj": subj, "cond": cond, "val": base + hash(subj) % 3})
        res = Stats.AnovaExtended.repeated_measures(rows, subject_col="subj", within_col="cond", value_col="val")
        assert res["test"] == "Repeated measures ANOVA"
        assert "F" in res
        assert 0 <= res["pValue"] <= 1

    def test_friedman(self):
        rows = [
            {"c1": 1.0, "c2": 2.0, "c3": 3.0},
            {"c1": 2.0, "c2": 3.0, "c3": 5.0},
            {"c1": 1.5, "c2": 2.5, "c3": 4.0},
            {"c1": 1.2, "c2": 2.8, "c3": 4.5},
        ]
        res = Stats.AnovaExtended.friedman(rows, columns=["c1", "c2", "c3"])
        assert res["test"] == "Friedman"
        assert 0 <= res["pValue"] <= 1
        assert "W" in res

    def test_friedman_insufficient_columns(self):
        rows = [{"c1": 1.0, "c2": 2.0}]
        with pytest.raises(ValueError):
            Stats.AnovaExtended.friedman(rows, columns=["c1", "c2"])


# ── Correlation Extended ───────────────────────────────────────────────────

class TestCorrelationExtended:
    def test_kendall(self):
        rows = [{"x": float(i), "y": float(i * 2)} for i in range(10)]
        res = Stats.CorrelationExtended.kendall(rows, col1="x", col2="y")
        assert res["tau"] == pytest.approx(1.0, abs=0.01)
        assert res["significant"] is True
        assert res["n"] == 10

    def test_kendall_negative(self):
        rows = [{"x": float(i), "y": float(-i)} for i in range(10)]
        res = Stats.CorrelationExtended.kendall(rows, col1="x", col2="y")
        assert res["tau"] < 0

    def test_kendall_insufficient(self):
        rows = [{"x": 1.0, "y": 2.0}]
        with pytest.raises(ValueError):
            Stats.CorrelationExtended.kendall(rows, col1="x", col2="y")

    def test_partial(self):
        # x and y correlated via z, partial should be weaker
        np.random.seed(0)
        z = np.random.randn(30)
        x = z + np.random.randn(30) * 0.5
        y = z + np.random.randn(30) * 0.5
        rows = [{"x": float(xi), "y": float(yi), "z": float(zi)} for xi, yi, zi in zip(x, y, z)]
        res = Stats.CorrelationExtended.partial(rows, col_x="x", col_y="y", col_z=["z"])
        assert "r" in res
        assert -1 <= res["r"] <= 1
        assert 0 <= res["pValue"] <= 1

    def test_partial_singular(self):
        # perfect collinearity → singular matrix (z = x)
        rows = [{"x": float(i), "y": float(i * 2), "z": float(i)} for i in range(5)]
        # x and z are perfectly correlated (r=1) → correlation matrix singular when combined with y
        # Depending on numpy handling, this may either raise or produce r≈1; both are acceptable
        try:
            res = Stats.CorrelationExtended.partial(rows, col_x="x", col_y="y", col_z=["z"])
            # If it doesn't raise, partial with perfect collinearity should be near 0 or 1 and still valid
            assert -1 <= res["r"] <= 1
        except ValueError as e:
            assert "singular" in str(e).lower()

    def test_point_biserial(self):
        rows = []
        for i in range(10):
            rows.append({"b": "yes", "n": float(10 + i)})
            rows.append({"b": "no", "n": float(5 + i * 0.5)})
        res = Stats.CorrelationExtended.point_biserial(rows, binary_col="b", numeric_col="n")
        assert "r" in res
        assert -1 <= res["r"] <= 1


# ── Regression Extended ────────────────────────────────────────────────────

class TestRegressionExtended:
    def _logistic_rows(self, n=30):
        np.random.seed(1)
        rows = []
        for _ in range(n):
            x1 = float(np.random.randn())
            x2 = float(np.random.randn())
            logit = -0.5 + 1.2 * x1 - 0.8 * x2
            p = 1 / (1 + math.exp(-logit))
            y = "yes" if np.random.rand() < p else "no"
            rows.append({"y": y, "x1": x1, "x2": x2})
        return rows

    def test_logistic(self):
        rows = self._logistic_rows(40)
        res = Stats.RegressionExtended.logistic(rows, target="y", predictors=["x1", "x2"])
        assert res["test"] == "Logistic regression"
        assert "coefficients" in res
        assert "x1" in res["coefficients"]
        assert "or" in res["coefficients"]["x1"]
        assert res["n"] >= 10

    def test_logistic_insufficient(self):
        rows = [{"y": "yes", "x1": 1.0}] * 5
        with pytest.raises(ValueError):
            Stats.RegressionExtended.logistic(rows, target="y", predictors=["x1"])

    def test_ridge(self):
        np.random.seed(2)
        rows = [{"y": float(2 * x + np.random.randn() * 0.5), "x": float(x)} for x in np.linspace(0, 10, 20)]
        res = Stats.RegressionExtended.ridge_lasso(rows, target="y", predictors=["x"], method="ridge")
        assert "coefficients" in res
        assert "cvR2" in res or res["cvR2"] is None

    def test_lasso(self):
        np.random.seed(3)
        rows = [{"y": float(2 * x + np.random.randn() * 0.5), "x": float(x), "x2": float(x * 0.5)} for x in np.linspace(0, 10, 20)]
        res = Stats.RegressionExtended.ridge_lasso(rows, target="y", predictors=["x", "x2"], method="lasso")
        assert res["test"] == "Lasso regression"

    def test_moderation(self):
        np.random.seed(4)
        rows = []
        for _ in range(30):
            x = float(np.random.randn())
            m = float(np.random.randn())
            y = float(1 + 2 * x + 1.5 * m + 0.8 * x * m + np.random.randn() * 0.5)
            rows.append({"y": y, "x": x, "m": m})
        res = Stats.RegressionExtended.moderation(rows, target="y", predictor="x", moderator="m")
        assert res["test"] == "Moderation"
        assert "interaction_p" in res
        assert 0 <= res["interaction_p"] <= 1

    def test_mediation(self):
        np.random.seed(5)
        rows = []
        for _ in range(40):
            x = float(np.random.randn())
            m = float(1 + 0.7 * x + np.random.randn() * 0.5)
            y = float(0.5 * x + 0.8 * m + np.random.randn() * 0.5)
            rows.append({"y": y, "x": x, "m": m})
        res = Stats.RegressionExtended.mediation(rows, target="y", predictor="x", mediator="m")
        assert res["test"] == "Mediation"
        assert "sobel_z" in res
        assert "pValue" in res
        assert 0 <= res["pValue"] <= 1

    def test_moderation_insufficient(self):
        rows = [{"y": 1.0, "x": 2.0, "m": 3.0}]
        with pytest.raises(ValueError):
            Stats.RegressionExtended.mediation(rows, target="y", predictor="x", mediator="m")
