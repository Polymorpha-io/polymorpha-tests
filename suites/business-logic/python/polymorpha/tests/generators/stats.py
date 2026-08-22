"""Stats helpers — params/result factories for all 27 TestKeys."""

from __future__ import annotations

from typing import Any

from .dataset import make_dataset
from .matrix import categorical_columns, numeric_columns


def params_for_action(action: str, dataset: dict) -> dict:
    cols = dataset["columns"]
    num = numeric_columns(cols)
    cat = categorical_columns(cols)
    a = num[0] if num else (cols[0]["name"] if cols else "col1")
    b = num[1] if len(num) > 1 else (num[0] if num else "col2")
    g = cat[0] if cat else "group"
    c1 = cat[1] if len(cat) > 1 else g
    if action == "descriptive":
        return {"column": a}
    if action == "frequency":
        return {"column": g}
    if action in ("correlation",):
        return {"columns": num[:2] if len(num) >= 2 else [a, b]}
    if action == "normality":
        return {"column": a, "method": "shapiro-wilk"}
    if action == "ttest":
        return {"column": a, "column2": b, "type": "independent"}
    if action in ("anova", "welchAnova", "levene"):
        return {"responseCol": a, "groupCol": g}
    if action == "regression":
        return {"responseCol": a, "predictors": num[1:3] if len(num) > 2 else [b]}
    if action == "vif":
        return {"cols": num[:2] if len(num) >= 2 else [a, b]}
    if action == "mannWhitney":
        return {"numCol": a, "groupCol": g, "g1": "A", "g2": "B"}
    if action == "kruskal":
        return {"numCol": a, "groupCol": g}
    if action in ("chiSquare", "fisher"):
        return {"col1": g, "col2": c1}
    if action == "wilcoxon":
        return {"col1": a, "col2": b}
    if action in ("tost", "tostMean"):
        return {"col": a, "low": -0.5, "high": 0.5}
    if action == "binomial":
        return {"col": g}
    if action == "mcnemar":
        return {"col1": g, "col2": c1}
    if action == "gofChisquare":
        return {"col": g}
    if action == "twoWayAnova":
        return {"responseCol": a, "factorA": g, "factorB": c1}
    if action == "repeatedAnova":
        return {"subjectCol": g, "withinCol": c1, "valueCol": a}
    if action == "friedman":
        return {"columns": num[:3] if len(num) >= 3 else ([a, b, "c"] if len(cols) >= 1 else [a, b, "c"])}
    if action in ("kendallTau", "partialCorrelation"):
        return {"colA": a, "colB": b, "control": num[2] if len(num) > 2 else a}
    if action == "pointBiserial":
        return {"catCol": g, "numCol": a}
    if action in ("logisticRegression", "ridgeRegression", "lassoRegression"):
        return {"target": g if g != a else cat[0] if cat else "flag", "predictors": num[:2] if len(num) >= 2 else [a, b]}
    if action == "moderation":
        return {"target": a, "predictor": b, "moderator": num[2] if len(num) > 2 else a}
    if action == "mediation":
        return {"target": a, "predictor": b, "mediator": num[2] if len(num) > 2 else a}
    return {}


def result_for_action(action: str, columns: list[str] | None = None) -> Any:
    cols = columns or ["col1", "col2"]
    a, b = (cols + ["col1", "col2"])[:2]
    if action == "descriptive":
        return {"column": a, "count": 10, "missing": 0, "missingPct": 0, "mean": 5, "std": 1.5, "pValue": 0.4}
    if action == "frequency":
        return {"column": a, "entries": [{"value": "x", "count": 3, "pct": 30}], "totalUnique": 1}
    if action in ("correlation", "pairCorrelation"):
        n = 2
        vals = [[1 if i == j else 0.5 for j in range(n)] for i in range(n)]
        return {"columns": cols[:n], "values": vals, "r": 0.5, "pValue": 0.05}
    if action == "normality":
        return {"column": a, "test": "Shapiro-Wilk", "statistic": 0.98, "pValue": 0.4, "isNormal": True}
    if action == "ttest":
        return {"type": "independent", "column1": a, "column2": b, "t": 2.1, "df": 18, "pValue": 0.05, "significant": True}
    if action == "anova":
        return {"factor": "group", "responseVar": a, "F": 4.2, "dfBetween": 2, "dfWithin": 27, "pValue": 0.02, "significant": True}
    if action == "welchAnova":
        return {"factor": "group", "responseVar": a, "F": 4.2, "dfNum": 2, "dfDen": 25, "pValue": 0.02, "significant": True}
    if action == "levene":
        return {"F": 1.1, "dfBetween": 2, "dfWithin": 27, "pValue": 0.35, "significant": False}
    if action == "regression":
        return {"dependentVar": a, "predictors": [b], "coefficients": {b: 1.2}, "intercept": 1, "rSquared": 0.6, "pValue": 0.01, "significant": True}
    if action == "vif":
        return {"predictors": [a, b], "vif": {a: 1.2, b: 1.1}, "flagged": []}
    if action == "mannWhitney":
        return {"column": a, "group1": "A", "group2": "B", "U": 12, "pValue": 0.3, "significant": False}
    if action in ("kruskal", "kruskalWallis"):
        return {"column": a, "H": 2.1, "df": 2, "pValue": 0.3, "significant": False}
    if action in ("chiSquare", "chiSquare"):
        return {"column1": a, "column2": b, "chiSq": 3.2, "df": 1, "pValue": 0.07, "significant": False}
    if action in ("fisher", "fisherExact"):
        return {"pValue": 0.2, "oddsRatio": 1.5, "significant": False}
    if action == "wilcoxon":
        return {"column1": a, "column2": b, "n": 10, "W": 15, "statistic": 15, "pValue": 0.4, "significant": False}
    if action in ("tost", "tostMean", "tostProportion"):
        return {"test": "TOST", "pValue": 0.9, "p_low": 0.05, "p_high": 0.05, "significant": True}
    if action == "binomial":
        return {"test": "Binomial", "column": a, "k": 5, "n": 10, "p_hat": 0.5, "pValue": 0.6, "significant": False}
    if action == "mcnemar":
        return {"test": "McNemar", "a": 3, "b": 1, "c": 2, "d": 4, "n": 10, "pValue": 0.5, "significant": False}
    if action == "gofChisquare":
        return {"test": "Chi-square GOF", "column": a, "categories": ["x", "y"], "observed": [5, 5], "expected": [5.0, 5.0], "df": 1, "pValue": 0.15}
    if action == "twoWayAnova":
        return {"test": "Two-way ANOVA", "value_col": a, "factor_a": {"F": 2.1, "pValue": 0.1, "significant": False}, "factor_b": {"F": 1.2, "pValue": 0.3, "significant": False}, "interaction": {"F": 0.8, "pValue": 0.5, "significant": False}, "n": 20}
    if action == "repeatedAnova":
        return {"test": "Repeated measures ANOVA", "value_col": a, "within": b, "subject": "subject", "F": 3.1, "pValue": 0.09, "significant": False, "n": 20}
    if action == "friedman":
        return {"test": "Friedman", "pValue": 0.4, "significant": False, "W": 0.2, "k": 2, "columns": [a, b]}
    if action == "kendallTau":
        return {"tau": 0.3, "pValue": 0.2, "significant": False, "n": 10, "method": "kendall"}
    if action == "partialCorrelation":
        return {"x": a, "y": b, "z": [a], "r": 0.4, "pValue": 0.1, "significant": False, "n": 20}
    if action == "pointBiserial":
        return {"binary": a, "numeric": b, "r": 0.5, "pValue": 0.05, "significant": True, "n": 20}
    if action == "logisticRegression":
        return {"test": "Logistic regression", "target": a, "predictors": [b], "n": 20, "coefficients": {b: {"coef": 0.5}}, "intercept": 0.1, "auc": 0.75}
    if action in ("ridgeRegression", "lassoRegression"):
        return {"test": "Ridge", "target": a, "predictors": [b], "alpha": 1.0, "coefficients": {b: 0.4}, "intercept": 0.2, "n": 20}
    if action == "moderation":
        return {"test": "Moderation", "target": a, "predictor": b, "moderator": a, "interaction_coef": 0.3, "interaction_p": 0.2, "significant": False}
    if action == "mediation":
        return {"test": "Mediation", "target": a, "predictor": b, "mediator": a, "indirect": 0.2, "sobel_z": 2.1, "pValue": 0.01, "significant": True}
    return {"pValue": 0.5, "significant": False}


def make_builder_context(dataset: dict) -> dict:
    col_map = {c["name"]: c["type"] for c in dataset["columns"]}
    cache: dict[str, list[str]] = {}

    def group_values_for(col: str) -> list[str]:
        if col in cache:
            return cache[col]
        vals = sorted({str(r[col]) for r in dataset["rows"] if r.get(col) not in (None, "")})
        cache[col] = vals
        return vals

    return {"rows": dataset["rows"], "columnTypeMap": col_map, "groupValuesFor": group_values_for}
