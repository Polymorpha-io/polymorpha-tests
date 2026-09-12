"""Truth-alignment tests — research-grounded formula/label fixes.

Each test recomputes the expectation with independent scipy/numpy arithmetic
(not the fixed helper itself) so regressions against the literature fail loudly.
Refs: Fisher 1925; Cohen 1988; Lakens 2013; Benjamini-Hochberg 1995;
Cochran 1954; Lilliefors 1967; Joanes & Gill 1998.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sp_stats
from statsmodels.stats.multitest import multipletests

from polymorpha.stats import Stats


def _eta_squared_direct(groups: list[np.ndarray]) -> float:
    all_vals = np.concatenate(groups)
    grand = all_vals.mean()
    ssb = sum(len(g) * (g.mean() - grand) ** 2 for g in groups)
    sst = ((all_vals - grand) ** 2).sum()
    return float(ssb / sst)


class TestEtaSquared:
    def test_matches_ssb_over_sst(self) -> None:
        rows = [
            {"v": 1.0, "g": "a"}, {"v": 2.0, "g": "a"}, {"v": 3.0, "g": "a"},
            {"v": 5.0, "g": "b"}, {"v": 6.0, "g": "b"}, {"v": 7.0, "g": "b"},
            {"v": 9.0, "g": "c"}, {"v": 10.0, "g": "c"}, {"v": 11.0, "g": "c"},
        ]
        result = Stats.Anova.OneWay.test(rows, col="v", group_col="g")
        assert result.effect_size is not None
        groups = [
            np.array([1.0, 2.0, 3.0]),
            np.array([5.0, 6.0, 7.0]),
            np.array([9.0, 10.0, 11.0]),
        ]
        assert result.effect_size.value == round(_eta_squared_direct(groups), 4)


class TestPairedDz:
    def test_paired_uses_dz_not_pooled(self) -> None:
        # Correlated pairs: dz and pooled-ds disagree; truth is dz (Lakens 2013).
        a = np.array([10.0, 12.0, 9.0, 14.0, 11.0, 13.0])
        b = np.array([8.0, 10.0, 9.0, 11.0, 10.0, 12.0])
        result = Stats.TTest.Paired.test(a, b)
        assert result.effect_size is not None
        diffs = a - b
        dz = float(diffs.mean() / diffs.std(ddof=1))
        assert result.effect_size.value == round(dz, 4)
        assert result.effect_size.method == "Cohen's dz"

    def test_independent_stays_pooled(self) -> None:
        a = np.array([10.0, 12.0, 9.0, 14.0, 11.0])
        b = np.array([8.0, 10.0, 9.0, 11.0, 10.0])
        result = Stats.TTest.Independent.test(a, b)
        assert result.effect_size is not None
        s1, s2 = float(a.std(ddof=1)), float(b.std(ddof=1))
        pooled = float(np.sqrt(((len(a) - 1) * s1 ** 2 + (len(b) - 1) * s2 ** 2) / (len(a) + len(b) - 2)))
        assert result.effect_size.value == round(float((a.mean() - b.mean()) / pooled), 4)


class TestCorrelationPValues:
    def test_raw_and_bh_disclosed(self) -> None:
        rng = np.random.default_rng(7)
        x = rng.normal(size=40)
        rows = [{"x": float(xi), "y": float(0.5 * xi + rng.normal(scale=0.5)), "z": float(rng.normal())} for xi in x]
        result = Stats.Correlation.compute(rows, ["x", "y", "z"], "pearson")
        assert result is not None
        assert result["pCorrection"] == "fdr_bh"
        df = pd.DataFrame(rows)[["x", "y", "z"]].apply(pd.to_numeric, errors="coerce")
        raw: dict[tuple[int, int], float] = {}
        cols = ["x", "y", "z"]
        for i in range(3):
            for j in range(i + 1, 3):
                pair = df[[cols[i], cols[j]]].dropna()
                _, pv = sp_stats.pearsonr(pair.iloc[:, 0].values, pair.iloc[:, 1].values)
                raw[(i, j)] = float(pv)
        order = [(0, 1), (0, 2), (1, 2)]
        _, bh, _, _ = multipletests([raw[k] for k in order], method="fdr_bh")
        for idx, (i, j) in enumerate(order):
            assert result["pValuesRaw"][i][j] == raw[(i, j)]
            assert result["pValues"][i][j] == float(bh[idx])


class TestChiSquareCochran:
    def test_sparse_table_flagged(self) -> None:
        rows = [{"a": "x", "b": "p"}] * 20 + [{"a": "y", "b": "p"}] * 2 + [{"a": "y", "b": "q"}] * 2
        result = Stats.Categorical.ChiSquare.test(rows, "a", "b")
        assert any("Cochran" in n for n in result.notes)

    def test_dense_table_clean(self) -> None:
        cell = 20
        rows = (
            [{"a": "x", "b": "p"}] * cell
            + [{"a": "x", "b": "q"}] * cell
            + [{"a": "y", "b": "p"}] * cell
            + [{"a": "y", "b": "q"}] * cell
        )
        result = Stats.Categorical.ChiSquare.test(rows, "a", "b")
        assert not any("Cochran" in n for n in result.notes)


class TestDistributionDiagnostics:
    def test_ks_estimated_params_noted(self) -> None:
        out = Stats.Diagnostics.kolmogorov_smirnov([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
        assert "pValue" in out
        assert "Lilliefors" in out.get("note", "")

    def test_cvm_tests_fitted_normal(self) -> None:
        # Mean-100 data must not be tested against N(0,1): statistic would explode.
        arr = [98.0, 100.0, 102.0, 99.0, 101.0, 100.5, 99.5, 101.5]
        out = Stats.Diagnostics.cramer_von_mises(arr)
        assert "pValue" in out
        standardized = (np.array(arr) - np.mean(arr)) / np.std(arr, ddof=1)
        ref = sp_stats.cramervonmises(standardized, "norm")
        assert out["statistic"] == float(ref.statistic)
        assert "fitted normal" in out.get("note", "")


class TestEffectInterpretation:
    def test_cohen_1988_bands(self) -> None:
        base = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        s = float(base.std(ddof=1))
        m = float(base.mean())
        for target, label in [(0.1, "negligible"), (0.3, "small"), (0.6, "medium"), (1.2, "large")]:
            out = Stats.Diagnostics.effect_size_extended(base.tolist(), None, mu=m - target * s, kind="cohens_d")
            assert out["interpretation"] == label, (target, out)

    def test_kurtosis_is_excess(self) -> None:
        # Normal(0,1) large sample: excess kurtosis ≈ 0, not 3 (Joanes & Gill 1998).
        rng = np.random.default_rng(11)
        rows = [{"v": float(v)} for v in rng.normal(size=2000)]
        desc = Stats.Descriptive.compute(rows, "v")
        assert desc["kurtosis"] is not None
        assert abs(desc["kurtosis"]) < 0.5
