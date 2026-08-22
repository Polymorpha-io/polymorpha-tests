"""Cleaning config generator — dicts for DataCleaner."""

from __future__ import annotations

from .dataset import make_dataset

MISSING_STRATEGIES = ["drop", "mean", "median", "mode", "constant", "ffill", "bfill", "none"]
OUTLIER_METHODS = ["iqr", "zscore", "percentile", "manual", "none"]
OUTLIER_ACTIONS = ["remove", "winsorize", "flag", "nullify"]
ROW_FILTER_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "notContains", "isEmpty", "notEmpty"]
SAMPLE_METHODS = ["none", "head", "tail", "random"]
SCALE_METHODS = ["none", "minmax", "zscore", "robust"]
ENCODING_TYPES = ["none", "binary", "label", "onehot", "ordinal", "frequency"]
MATH_TRANSFORMS = ["log", "log2", "log10", "sqrt", "square", "reciprocal"]
STRING_CASE_MODES = ["none", "lower", "upper", "title"]
STRING_MATCH_MODES = ["contains", "exact", "startsWith", "endsWith", "wholeWord", "regex"]


def make_cleaning_config(dataset: dict | None = None, patch: dict | None = None) -> dict:
    patch = patch or {}
    base = {
        "missing": {},
        "missingRowThresholdPct": None,
        "duplicates": {"enabled": False, "subsetColumns": []},
        "outliers": {},
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
    }
    if dataset and dataset.get("columns"):
        first = dataset["columns"][0]["name"]
        base["rowFilter"]["column"] = first
        for c in dataset["columns"]:
            base["missing"][c["name"]] = {"strategy": "none", "constantValue": "", "addIndicator": False}
            if c["type"] == "numeric":
                base["outliers"][c["name"]] = {"method": "none", "action": "flag", "iqrQ1Pct": 25, "iqrQ3Pct": 75, "iqrMultiplier": 1.5, "zThreshold": 3, "percentileLower": 1, "percentileUpper": 99}
                base["scaling"][c["name"]] = {"method": "none", "outputMin": 0, "outputMax": 1}
            base["renameColumns"].append({"from": c["name"], "to": c["name"]})
    base.update(patch)
    return base


class ConfigBuilder:
    def __init__(self, dataset: dict):
        self.config = make_cleaning_config(dataset)
        self._ds = dataset

    def with_missing(self, col: str, strategy: str, **kw):
        self.config["missing"][col] = {"strategy": strategy, "constantValue": "", "addIndicator": False, **kw}
        return self

    def with_outliers(self, col: str, method: str, action: str, **kw):
        self.config["outliers"][col] = {**self.config["outliers"].get(col, {}), "method": method, "action": action, **kw}
        return self

    def with_string_cleaning(self, **kw):
        self.config["stringCleaning"] = {**self.config["stringCleaning"], "enabled": True, **kw}
        return self

    def with_row_filter(self, col: str, op: str, val: str = ""):
        self.config["rowFilter"] = {"enabled": True, "column": col, "operator": op, "value": val}
        return self

    def with_sampling(self, method: str, count: int = 3):
        self.config["sampling"] = {"enabled": True, "method": method, "count": count}
        return self

    def with_scaling(self, col: str, method: str, **kw):
        self.config["scaling"][col] = {"method": method, "outputMin": 0, "outputMax": 1, **kw}
        return self

    def with_encoding(self, col: str, typ: str, **kw):
        self.config["encodings"][col] = {"type": typ, **kw}
        return self

    def with_math(self, col: str, transform: str):
        self.config["mathTransforms"].append({"column": col, "transform": transform})
        return self

    def with_rename(self, frm: str, to: str):
        self.config["renameColumns"].append({"from": frm, "to": to})
        return self

    def with_remove(self, *cols):
        self.config["removeColumns"].extend(cols)
        return self

    def with_dedupe(self, enabled=True, subset=None):
        self.config["duplicates"] = {"enabled": enabled, "subsetColumns": subset or []}
        return self

    def with_threshold(self, pct: int):
        self.config["missingRowThresholdPct"] = pct
        return self

    def build(self):
        return self.config


# Preset datasets for cleaning cases
def _ds_missing():
    return make_dataset([{"name": "id", "type": "numeric"}, {"name": "category", "type": "categorical", "cardinality": 3}, {"name": "price", "type": "numeric"}], rows=10, missing_pct=0.3, seed="missing")


def _ds_mixed():
    return make_dataset([{"name": "name", "type": "categorical", "cardinality": 4}, {"name": "age", "type": "numeric"}, {"name": "score", "type": "numeric"}], rows=8, seed="mixed")


def _ds_outliers():
    return make_dataset([{"name": "group", "type": "categorical", "cardinality": 2}, {"name": "value", "type": "numeric"}], rows=15, outlier_pct=0.1, seed="outliers")


VALID_CLEANING_CASES = [
    {"label": "mean impute", "dataset": _ds_missing, "patch": lambda d: ConfigBuilder(d).with_missing(next(c["name"] for c in d["columns"] if c["type"] == "numeric"), "mean").build()},
    {"label": "iqr remove", "dataset": _ds_outliers, "patch": lambda d: ConfigBuilder(d).with_outliers("value", "iqr", "remove").build()},
    {"label": "title case", "dataset": _ds_mixed, "patch": lambda d: ConfigBuilder(d).with_string_cleaning(trim=True, caseMode="title").build()},
    {"label": "dedupe", "dataset": lambda: make_dataset([{"name": "email", "type": "categorical"}], rows=4, seed="dup"), "patch": lambda d: ConfigBuilder(d).with_dedupe().build()},
]

INVALID_CLEANING_CASES = [
    {"label": "ghost missing col", "dataset": _ds_mixed, "patch": lambda d: ConfigBuilder(d).with_missing("ghost_col", "mean").build(), "message": "ghost"},
]
