"""
Polymorpha Stats & ML API — Google Cloud Function (2nd gen)
Combined server for statistical computations and machine learning model training.

Routes:
  POST /api/v1/stats           — Statistical tests and computations
  POST /api/v1/machine-learning — ML model training, feature extraction, anomaly detection

Deploy:
  gcloud functions deploy polymorpha-stats \
    --gen2 --runtime python312 --region us-central1 \
    --source ./cloud-functions/stats \
    --entry-point stats_handler \
    --trigger-http --allow-unauthenticated \
    --memory 1024MB --timeout 120s
"""

from __future__ import annotations

import json
import math
import os
import re
import threading
import time
from typing import Any

import functions_framework
import numpy as np
import pandas as pd
from flask import Request, jsonify
from pydantic import ValidationError
from scipy import stats as sp_stats
from scipy.stats import (
    anderson,
    chi2_contingency,
    f_oneway,
    fisher_exact,
    kruskal,
    kstest,
    levene,
    mannwhitneyu,
    pearsonr,
    shapiro,
    ttest_1samp,
    ttest_ind,
    ttest_rel,
    wilcoxon,
    rankdata,
)
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import lilliefors
from statsmodels.regression.linear_model import OLS
from statsmodels.tools import add_constant

from auth import verify_token
from polymorpha import Stats, ML, Cleaner, IO
from polymorpha.stats._anova import _build_groups
from polymorpha.io._safe_float import safe_float
from polymorpha.schemas import StatsRequest, MLRequest, ParseRequest, CleanRequest
from execute import handle_execute

# Helpers


def extract_numeric(rows: list[dict], col: str) -> np.ndarray:
    """Extract finite numeric values from a column."""
    vals = [safe_float(r.get(col)) for r in rows]
    return np.array([v for v in vals if v is not None], dtype=np.float64)


# Server-side parsed-file cache
#
# parse → clean → Run-batch currently downloads + parses the same Storage file
# 2-3 times per open. A small module-level LRU (keyed by uid + storagePath +
# contentHash) turns that into a single Storage download. Keying on the client's
# contentHash makes invalidation exact: new content → new hash → new entry.
# The client sends contentHash in the parse/clean body (extra field — the
# Pydantic models ignore unknown keys).

ANON_MAX_ROWS = 10_000

_PARSE_CACHE_ENABLED = os.environ.get('POLYMORPHA_PARSE_CACHE', '1') != '0'
_PARSE_CACHE_TTL_SECONDS = 600
_PARSE_CACHE_MAX_ENTRIES = 8
_PARSE_CACHE_MAX_TOTAL_ROWS = 400_000
_PARSE_CACHE_MAX_TOTAL_BYTES = 80 * 1024 * 1024
_PARSE_CACHE_LOCK = threading.Lock()

_parse_cache: dict[tuple[str, str, str | None, int | None], dict] = {}
_parse_cache_ts: dict[tuple[str, str, str | None, int | None], float] = {}
_parse_cache_rows: dict[tuple[str, str, str | None, int | None], int] = {}
_parse_cache_bytes: dict[tuple[str, str, str | None, int | None], int] = {}


def _parse_with_cache(
    uid: str,
    storage_path: str,
    download_url: str | None,
    max_rows: int | None = None,
    content_hash: str | None = None,
) -> dict:
    """Parse a Storage file, memoizing full parses. Preview parses (maxRows)
    never touch the cache. Thread-safe via _PARSE_CACHE_LOCK."""
    key = (uid, storage_path, content_hash or None, max_rows)
    now = time.time()
    if max_rows is None and _PARSE_CACHE_ENABLED:
        with _PARSE_CACHE_LOCK:
            cached = _parse_cache.get(key)
            if cached is not None and now - _parse_cache_ts.get(key, 0) < _PARSE_CACHE_TTL_SECONDS:
                print(f'[parse-cache] HIT {storage_path}')
                return cached
    if max_rows is None:
        print(f'[parse-cache] MISS {storage_path}')
    parser = IO.Parser(download_url, storage_path)
    parsed = parser.parse(max_rows=max_rows)
    if max_rows is not None or not _PARSE_CACHE_ENABLED:
        return parsed
    # Estimate bytes as rows*cols*~50 bytes per cell + JSON overhead
    rows = parsed.get('rows', [])
    cols = parsed.get('columnTypes', [])
    est_bytes = len(rows) * max(1, len(cols)) * 50
    rows_count = int(parsed.get('rowCount') or len(rows))
    with _PARSE_CACHE_LOCK:
        if len(_parse_cache) >= _PARSE_CACHE_MAX_ENTRIES:
            oldest_key = min(_parse_cache_ts, key=_parse_cache_ts.get)
            _parse_cache.pop(oldest_key, None)
            _parse_cache_ts.pop(oldest_key, None)
            _parse_cache_rows.pop(oldest_key, None)
            _parse_cache_bytes.pop(oldest_key, None)
        total_rows = sum(_parse_cache_rows.values()) + rows_count
        total_bytes = sum(_parse_cache_bytes.values()) + est_bytes
        while (total_rows > _PARSE_CACHE_MAX_TOTAL_ROWS or total_bytes > _PARSE_CACHE_MAX_TOTAL_BYTES) and _parse_cache:
            oldest_key = min(_parse_cache_ts, key=_parse_cache_ts.get)
            total_rows -= _parse_cache_rows.get(oldest_key, 0)
            total_bytes -= _parse_cache_bytes.get(oldest_key, 0)
            _parse_cache.pop(oldest_key, None)
            _parse_cache_ts.pop(oldest_key, None)
            _parse_cache_rows.pop(oldest_key, None)
            _parse_cache_bytes.pop(oldest_key, None)
        _parse_cache[key] = parsed
        _parse_cache_ts[key] = now
        _parse_cache_rows[key] = rows_count
        _parse_cache_bytes[key] = est_bytes
    return parsed

# Legacy contract shaping
#
# The Analyse panel (TS) sends builder-style params and expects the legacy
# response contract (U / H / F / t / df / type / ...). The polymorpha wheel
# emits TestResult-shaped dicts (statistic / pValue / significant / ...).
# The two helpers below bridge the gap at the API boundary — they rename and
# reshape existing values, they never recompute statistics.

_BUILDER_PARAM_ALIASES: dict[str, dict[str, str]] = {
    'pairCorrelation': {'colA': 'column1', 'colB': 'column2'},
    'ttest': {'type': 'kind', 'column2': 'col2'},
    'anova': {'responseCol': 'column'},
    'welchAnova': {'responseCol': 'column'},
    'levene': {'responseCol': 'column'},
    'wilcoxon': {'col1': 'column', 'col2': 'column2'},
    'mannWhitney': {'numCol': 'column', 'g1': 'group1Label', 'g2': 'group2Label'},
    'kruskalWallis': {'numCol': 'column'},
    'chiSquare': {'col1': 'column1', 'col2': 'column2'},
    'fisherExact': {'col1': 'column1', 'col2': 'column2'},
    'regression': {'responseCol': 'dependentVar'},
    'vif': {'cols': 'predictors'},
}


# ——— Sanitization & action aliasing (prevents row/column leakage in errors) ———

_ACTION_ALIASES: dict[str, str] = {
    # Equivalence: frontend buildTost() emits tostMean (BL), backend historically only knew 'tost'
    "tostMean": "tost",
    "tostProportion": "tost",
    # Legacy kebab / snake aliases observed in the wild / screenshots
    "mann-whitney": "mannWhitney",
    "kendall_tau": "kendallTau",
    "kendallTau": "kendallTau",
    "gof_chisquare": "gofChisquare",
    "gofchisquare": "gofChisquare",
    "two_way_anova": "twoWayAnova",
    "repeated_anova": "repeatedAnova",
    "partial_correlation": "partialCorrelation",
    "point_biserial": "pointBiserial",
    "logistic_regression": "logisticRegression",
    "ridge_regression": "ridgeRegression",
    "lasso_regression": "lassoRegression",
}


def _normalize_action(body: dict) -> dict:
    """Map aliased action names to canonical ones before Pydantic validation."""
    if not isinstance(body, dict):
        return body
    act = body.get("action")
    if isinstance(act, str) and act in _ACTION_ALIASES:
        body = dict(body)
        body["action"] = _ACTION_ALIASES[act]
    return body


def _sanitize_validation_error(exc: ValidationError) -> str:
    """Return a user-safe message from a Pydantic ValidationError — never echo `input` rows."""
    try:
        # include_input=False drops the huge 'input' field (Pydantic v2); fall back if not supported
        try:
            errors = exc.errors(include_url=False, include_context=False, include_input=False)  # type: ignore[call-arg]
        except TypeError:
            try:
                errors = exc.errors(include_url=False, include_context=False)  # type: ignore[call-arg]
            except TypeError:
                errors = exc.errors()
    except Exception:
        return "Invalid request. Please check your selected columns and retry."

    parts: list[str] = []
    for err in errors[:3]:  # cap number of issues exposed
        # Never include raw input / ctx
        err = {k: v for k, v in err.items() if k not in ("input", "ctx", "url")}
        msg = str(err.get("msg", "Invalid input"))
        # Pydantic wraps our ValueError as "Value error, Unsupported action 'tostMean'..."
        # Hide the internal Supported list and row payload entirely
        if "Unsupported action" in msg:
            # Extract action name if present without echoing Supported list
            m = re.search(r"Unsupported action '([^']+)'", msg)
            act = m.group(1) if m else str(err.get("loc", [""])[0] if err.get("loc") else "unknown")
            # Friendly mapping
            friendly = {
                "tostMean": "TOST Equivalence",
                "tost": "TOST Equivalence",
                "tostProportion": "TOST Proportion",
            }.get(act, act)
            parts.append(
                f"This test ({friendly}) is temporarily unavailable. Please try a different variable or retry. (ref: {act})"
            )
            continue
        # Strip any accidental row-like substrings that might have slipped into msg
        if "rows" in msg.lower() or "Artist Name" in msg or "Total Streams" in msg:
            msg = "Invalid request payload. Please check your selected columns and retry."
        # Trim wrapping "Value error, " prefix
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, ") :]
        loc = err.get("loc", ())
        loc_str = ".".join(str(x) for x in loc) if loc else ""
        # Do not echo field values; only field path
        if loc_str and loc_str not in msg:
            msg = f"{loc_str}: {msg}"
        if len(msg) > 300:
            msg = msg[:300] + "…"
        parts.append(msg)

    if not parts:
        return "Invalid request. Please check your selected columns and retry."
    combined = " | ".join(parts)
    if len(combined) > 500:
        combined = combined[:500] + "…"
    # Final redaction: ensure no row-like tokens survive
    for token in ("'rows'", '"rows"', "Artist Name", "Total Streams", "Lead Streams"):
        if token in combined:
            return "Invalid request. Please check your selected columns and retry."
    return combined


def _sanitize_generic_error(msg: str) -> str:
    """Redact row/column payloads from generic ValueError/Exception messages."""
    if not isinstance(msg, str):
        msg = str(msg)
    # If message contains a dump of rows (heuristic), replace entirely
    lower = msg.lower()
    if "'rows'" in lower or '"rows"' in lower or "'artist name'" in lower or "total streams" in lower:
        return "Request failed due to invalid input. Please check your selected columns and retry."
    # Hide Supported lists (internal)
    if "Supported:" in msg or "Supported action" in msg:
        m = re.search(r"Unsupported action '([^']+)'", msg)
        if m:
            return f"This test ({m.group(1)}) is temporarily unavailable. Please retry."
        return "This test is temporarily unavailable. Please retry."
    if len(msg) > 500:
        msg = msg[:500] + "…"
    return msg


def _legacy_params(action: str, params: dict) -> dict:
    """Map Analyse-panel builder param names onto wheel-expected names."""
    aliases = _BUILDER_PARAM_ALIASES.get(action, {})
    if not aliases:
        return params
    merged = dict(params)
    for src, dst in aliases.items():
        if src in params and dst not in params:
            merged[dst] = params[src]
    return merged


def _finite_num(value: Any, fallback: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return fallback
    return v if math.isfinite(v) else fallback


def _numeric_col(rows: list[dict], col: str) -> np.ndarray:
    vals = [safe_float(r.get(col)) for r in rows]
    return np.array([v for v in vals if v is not None], dtype=np.float64)


def _group_labels(rows: list[dict], group_col: str) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for r in rows:
        g = str(r.get(group_col, '')).strip()
        if g and g not in seen:
            seen.add(g)
            labels.append(g)
    return labels


def _sanitize_p_value(d: dict) -> dict:
    """Never let NaN / null p-values or statistics escape to JSON — the frontend
    rejects them ('API returned invalid p-value'). Degenerate inputs become
    p=1.0 / not significant instead of a hard failure."""
    p = d.get('pValue')
    if p is not None and (not isinstance(p, (int, float)) or not math.isfinite(float(p))):
        d['pValue'] = 1.0
        d['significant'] = False
        notes = d.get('notes')
        if not isinstance(notes, list):
            d['notes'] = []
        note = 'degenerate input - p-value undefined'
        if note not in d['notes']:
            d['notes'].append(note)
    stat = d.get('statistic')
    if stat is not None and (not isinstance(stat, (int, float)) or not math.isfinite(float(stat))):
        d['statistic'] = 0.0
    return d


def _ensure_statistic(d: dict, key: str, note: str) -> None:
    """Guarantee a canonical test-statistic key exists even for degenerate
    results (tiny groups / empty groups) where the wheel emits no statistic.
    The frontend validator requires U/H/W — emit 0.0 + explanatory note."""
    if key in d and d[key] is not None:
        return
    if 'statistic' in d and d['statistic'] is not None:
        d[key] = d['statistic']
        return
    d[key] = 0.0
    notes = d.get('notes')
    if not isinstance(notes, list):
        d['notes'] = []
    if note not in d['notes']:
        d['notes'].append(note)


def _num_str_equal(a: str, b: str) -> bool:
    """Numeric-equivalence for label comparison: JS String(1.0) == "1" but
    Python str(1.0) == "1.0". Only treat as equal when the mismatch is exactly
    the int/float repr boundary (one side ends in '.0'), so distinct string
    categories (e.g. "001" vs "1") never collapse."""
    try:
        fa, fb = float(a), float(b)
    except (TypeError, ValueError):
        return False
    return fa == fb and (a.endswith('.0') or b.endswith('.0'))


def _resolve_group_label(rows: list[dict], group_col: str | None, label: Any) -> Any:
    """Resolve a client-supplied group label to the Python string form actually
    present in the rows. The wheel matches groups with str(value) == label;
    without this shim numeric group columns mismatch ("1" vs "1.0") and every
    group comes back empty — producing a degenerate n<4 result."""
    if label is None or not group_col:
        return label
    raw = str(label).strip()
    for r in rows:
        v = r.get(group_col)
        if v is None:
            continue
        s = str(v).strip()
        if s == raw:
            return label
        if _num_str_equal(s, raw):
            return s
    return label


def _shape_ttest(d: dict, params: dict, rows: list[dict]) -> None:
    kind = params.get('type') or params.get('kind') or 'one-sample'
    col = params.get('column')
    col2 = params.get('column2')
    d['type'] = kind
    d['column1'] = col or d.get('column1')
    if col2 or 'column2' not in d:
        d['column2'] = col2
    if 't' not in d and 'statistic' in d:
        d['t'] = d['statistic']
    a = _numeric_col(rows, col)
    if kind == 'one-sample':
        n = len(a)
        mu = _finite_num(params.get('mu', 0.0), 0.0)
        mean = float(a.mean()) if n else 0.0
        d['meanDiff'] = round(mean - mu, 4)
        sd = float(a.std(ddof=1)) if n > 1 else 0.0
        d['cohensD'] = round((mean - mu) / sd, 4) if sd != 0.0 else None
        d['df'] = int(n - 1)
        d['n'] = n
    elif kind == 'paired':
        pairs = [
            (safe_float(r.get(col)), safe_float(r.get(col2)))
            for r in rows
            if col2
        ]
        diffs = [x - y for x, y in pairs if x is not None and y is not None]
        n = len(diffs)
        m = float(sum(diffs)) / n if n else 0.0
        sd = float(np.std(np.array(diffs), ddof=1)) if n > 1 else 0.0
        d['meanDiff'] = round(m, 4)
        d['cohensD'] = round(m / sd, 4) if sd != 0.0 else None
        d['df'] = int(n - 1)
        d['n'] = n
    else:
        b = _numeric_col(rows, col2)
        df = len(a) + len(b) - 2
        m1 = float(a.mean()) if len(a) else 0.0
        m2 = float(b.mean()) if len(b) else 0.0
        d['meanDiff'] = round(m1 - m2, 4)
        s1 = float(a.std(ddof=1)) if len(a) > 1 else 0.0
        s2 = float(b.std(ddof=1)) if len(b) > 1 else 0.0
        pooled = math.sqrt(((len(a) - 1) * s1 * s1 + (len(b) - 1) * s2 * s2) / df) if df > 0 else 0.0
        d['cohensD'] = round((m1 - m2) / pooled, 4) if pooled != 0.0 else None
        d['df'] = int(df)
        d['n'] = len(a)
    ci = d.get('ci')
    if isinstance(ci, dict) and 'lower' in ci and 'upper' in ci:
        d['ci'] = [ci['lower'], ci['upper']]


def _shape_anova(d: dict, action: str, params: dict, rows: list[dict]) -> None:
    if 'F' not in d and 'statistic' in d:
        d['F'] = d['statistic']
    response = params.get('column') or params.get('responseCol')
    group = params.get('groupCol') or params.get('groupColumn')
    labels = _group_labels(rows, group)
    k = len(labels)
    d['factor'] = group or d.get('factor')
    d['responseVar'] = response or d.get('responseVar')
    if action == 'anova':
        if 'dfBetween' not in d and k >= 1:
            d['dfBetween'] = int(k - 1)
        if 'dfWithin' not in d:
            d['dfWithin'] = int(len(_numeric_col(rows, response)) - k)
        es = d.get('effectSize')
        if d.get('etaSquared') is None and isinstance(es, dict) and isinstance(es.get('value'), (int, float)):
            d['etaSquared'] = es['value']
    else:
        if 'dfNum' not in d and k >= 1:
            d['dfNum'] = int(k - 1)
        if 'dfDen' not in d:
            d['dfDen'] = int(len(_numeric_col(rows, response)) - k)


def _shape_levene(d: dict, params: dict, rows: list[dict]) -> None:
    if 'F' not in d and 'statistic' in d:
        d['F'] = d['statistic']
    p = d.get('pValue')
    if p is None or not isinstance(p, (int, float)) or not math.isfinite(float(p)):
        d['pValue'] = 1.0
        d['equalVariances'] = True
        d['significant'] = False
    else:
        if 'equalVariances' not in d or d.get('equalVariances') is None:
            d['equalVariances'] = float(p) > 0.05
        d['significant'] = not bool(d.get('equalVariances'))
    response = params.get('column') or params.get('responseCol')
    group = params.get('groupCol') or params.get('groupColumn')
    labels = _group_labels(rows, group)
    k = len(labels)
    d['factor'] = group or d.get('factor')
    d['responseVar'] = response or d.get('responseVar')
    if 'dfBetween' not in d and k >= 1:
        d['dfBetween'] = int(k - 1)
    if 'dfWithin' not in d:
        d['dfWithin'] = int(len(_numeric_col(rows, response)) - k)


def _shape_chi_square(d: dict, params: dict, rows: list[dict]) -> None:
    if 'chiSq' not in d and 'statistic' in d:
        d['chiSq'] = d['statistic']
    col1 = params.get('col1') or params.get('column1')
    col2 = params.get('col2') or params.get('column2')
    d['column1'] = col1 or d.get('column1')
    d['column2'] = col2 or d.get('column2')
    pairs = [
        (str(r.get(col1, '')), str(r.get(col2, '')))
        for r in rows
        if col1 and col2 and r.get(col1) is not None and r.get(col2) is not None
    ]
    r_count = len(set(p[0] for p in pairs))
    c_count = len(set(p[1] for p in pairs))
    if 'df' not in d:
        d['df'] = int((r_count - 1) * (c_count - 1)) if r_count >= 2 and c_count >= 2 else 0
    chi = d.get('chiSq')
    denom = len(pairs) * min(r_count - 1, c_count - 1)
    if denom > 0 and isinstance(chi, (int, float)) and math.isfinite(float(chi)):
        d['cramersV'] = round(math.sqrt(float(chi) / denom), 4)
    else:
        d['cramersV'] = 0.0


def _shape_fisher(d: dict, params: dict, rows: list[dict]) -> None:
    col1 = params.get('col1') or params.get('column1')
    col2 = params.get('col2') or params.get('column2')
    d['column1'] = col1 or d.get('column1')
    d['column2'] = col2 or d.get('column2')
    if 'oddsRatio' not in d:
        pairs = [
            (str(r.get(col1, '')), str(r.get(col2, '')))
            for r in rows
            if col1 and col2 and r.get(col1) is not None and r.get(col2) is not None
        ]
        row_cats = sorted(set(p[0] for p in pairs))
        col_cats = sorted(set(p[1] for p in pairs))
        if len(row_cats) == 2 and len(col_cats) == 2:
            a = sum(1 for rv, cv in pairs if rv == row_cats[0] and cv == col_cats[0])
            b = sum(1 for rv, cv in pairs if rv == row_cats[0] and cv == col_cats[1])
            c = sum(1 for rv, cv in pairs if rv == row_cats[1] and cv == col_cats[0])
            dd = sum(1 for rv, cv in pairs if rv == row_cats[1] and cv == col_cats[1])
            denom = b * c
            d['oddsRatio'] = round((a * dd) / denom, 4) if denom else None
        else:
            d['oddsRatio'] = None


def _shape_regression(d: dict, params: dict) -> None:
    coeffs = d.get('coefficients')
    if isinstance(coeffs, list):
        rows_out: dict[str, float] = {}
        p_values: dict[str, float] = {}
        std_errors: dict[str, float] = {}
        for e in coeffs:
            if not isinstance(e, dict):
                continue
            name = e.get('predictor')
            if name == 'intercept':
                if isinstance(e.get('coefficient'), (int, float)):
                    d['intercept'] = e['coefficient']
                continue
            if isinstance(e.get('coefficient'), (int, float)):
                rows_out[name] = e['coefficient']
            if isinstance(e.get('pValue'), (int, float)):
                p_values[name] = e['pValue']
            if isinstance(e.get('stdErr'), (int, float)):
                std_errors[name] = e['stdErr']
        d['coefficients'] = rows_out
        d['pValues'] = p_values
        d['stdErrors'] = std_errors
    d['dependentVar'] = params.get('dependentVar') or params.get('responseCol') or d.get('dependentVar')
    d['predictors'] = params.get('predictors') or d.get('predictors')
    if 'dfResid' not in d and 'df' in d:
        d['dfResid'] = d['df']
    for key in ('rSquared', 'fPValue', 'fStatistic', 'adjRSquared', 'intercept'):
        v = d.get(key)
        if v is not None and (not isinstance(v, (int, float)) or not math.isfinite(float(v))):
            d[key] = None


def _legacy_result(action: str, result: Any, params: dict, rows: list[dict]) -> Any:
    """Reshape wheel/backend results into the frontend's legacy response contract."""
    if not isinstance(result, dict):
        return result
    d = _sanitize_p_value(dict(result))
    if action == 'ttest':
        _shape_ttest(d, params, rows)
    elif action in ('anova', 'welchAnova'):
        _shape_anova(d, action, params, rows)
    elif action == 'levene':
        _shape_levene(d, params, rows)
    elif action == 'mannWhitney':
        _ensure_statistic(d, 'U', 'groups too small — U not computable')
        d['group1'] = params.get('g1') or params.get('group1Label')
        d['group2'] = params.get('g2') or params.get('group2Label')
        d['column'] = params.get('numCol') or params.get('column')
    elif action == 'kruskalWallis':
        _ensure_statistic(d, 'H', 'groups too small — H not computable')
        d['column'] = params.get('numCol') or params.get('column')
        if 'df' not in d:
            k = len(_group_labels(rows, params.get('groupCol') or params.get('groupColumn')))
            if k >= 1:
                d['df'] = int(k - 1)
    elif action == 'chiSquare':
        _shape_chi_square(d, params, rows)
    elif action == 'fisherExact':
        _shape_fisher(d, params, rows)
    elif action == 'wilcoxon':
        _ensure_statistic(d, 'W', 'too few pairs — statistic not computable')
        if 'statistic' not in d or d['statistic'] is None:
            d['statistic'] = d['W']
        d['column1'] = params.get('col1') or params.get('column')
        d['column2'] = params.get('col2') or params.get('column2')
    elif action == 'regression':
        _shape_regression(d, params)
    return d

# Cloud Function Entry Point

@functions_framework.http
def stats_handler(request: Request, *args, **kwargs):
    """Main HTTP handler — routes by path prefix."""
    t_start = time.time()

    if request.method == 'OPTIONS':
        return IO.Response.cors_preflight(request.headers.get('Origin'))

    if request.method != 'POST':
        return IO.Response.error('Method not allowed', 405)

    # Extract Firebase ID token for Storage REST API fallback
    auth_header = request.headers.get('Authorization', '')
    auth_token = auth_header[7:] if auth_header.startswith('Bearer ') else None

    # Authenticate — anonymous users get 'anonymous-user' and can use
    # the pipeline; only fatal SDK errors raise ValueError → 401.
    try:
        uid = verify_token(request)
    except ValueError as e:
        return IO.Response.error(str(e), 401)

    try:
        body = request.get_json(silent=True)
        if not body:
            return IO.Response.error('Invalid JSON body', 400)

        # Normalize aliased actions before validation so 'tostMean' etc. don't 422
        body = _normalize_action(body)

        path = request.path.rstrip('/')

        if path.startswith('/api/v1/machine-learning'):
            result = _handle_ml(body, uid)
        elif path.startswith('/api/v1/parse'):
            result = _handle_parse(body, uid, auth_token)
        elif path.startswith('/api/v1/clean'):
            result = _handle_clean(body, uid, auth_token)
        elif path.startswith('/api/v1/execute'):
            result = _handle_execute(body, uid, auth_token)
        elif path.startswith('/api/v1/stats') or path in ('/api/v1', '/api/v1/'):
            result = _handle_stats(body, uid, auth_token)
        else:
            # Legacy path support (no version prefix)
            result = _handle_legacy(path, body, uid, auth_token)

        return IO.Response.json(result)

    except ValidationError as e:
        safe = _sanitize_validation_error(e)
        return IO.Response.json(IO.Response.make_envelope(
            result=None,
            error=safe,
            duration_ms=(time.time() - t_start) * 1000,
        ), 422)
    except ValueError as e:
        return IO.Response.error(_sanitize_generic_error(str(e)), 400)
    except Exception as e:
        # Never echo raw exception that might contain row dumps
        return IO.Response.error(_sanitize_generic_error(str(e)), 500)


def _handle_legacy(path: str, body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle legacy paths (without /api/v1 prefix)."""
    if path.startswith('/machine-learning'):
        return _handle_ml(body, uid)
    elif '/parse' in path:
        return _handle_parse(body, uid, auth_token)
    elif '/clean' in path:
        return _handle_clean(body, uid, auth_token)
    elif '/execute' in path:
        return _handle_execute(body, uid, auth_token)
    elif path.startswith('/stats') or path == '' or path == '/':
        return _handle_stats(body, uid, auth_token)
    else:
        raise ValueError(f'Unknown route: {path}')


# Execute Route Handler

def _handle_execute(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle code execution requests (Code Editor workspace Run button)."""
    result = handle_execute(body, uid, auth_token)
    return IO.Response.success(result)


# Parse Route Handler

def _handle_parse(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle file parsing requests."""
    validated = ParseRequest(**body)
    # P0-C G18 storagePath isolation
    _sp = getattr(validated, "storagePath", None) or getattr(validated, "storage_path", None) or body.get("storagePath") or body.get("storage_path")
    if _sp and uid != "anonymous-user" and not _sp.startswith(f"users/{uid}/"):
        return IO.Response.error(f"storagePath not owned by {uid}: {_sp!r}", 403)
    parsed = _parse_with_cache(
        uid,
        validated.storagePath,
        validated.downloadUrl,
        validated.maxRows,
        body.get('contentHash') if isinstance(body, dict) else None,
    )
    # Anon: take first ANON_MAX_ROWS, not reject - per-user cheap slice.
    if uid == "anonymous-user":
        rc = int(parsed.get("rowCount") or len(parsed.get("rows", [])))
        if rc > ANON_MAX_ROWS:
            parsed = dict(parsed)
            parsed["rows"] = parsed["rows"][:ANON_MAX_ROWS]
            parsed["rowCount"] = ANON_MAX_ROWS
    return IO.Response.success(parsed)


# Clean Route Handler

def _handle_clean(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle data cleaning requests."""
    validated = CleanRequest(**body)
    # P0-C G18 storagePath isolation
    _sp = getattr(validated, "storagePath", None) or getattr(validated, "storage_path", None) or body.get("storagePath") or body.get("storage_path")
    if _sp and uid != "anonymous-user" and not _sp.startswith(f"users/{uid}/"):
        return IO.Response.error(f"storagePath not owned by {uid}: {_sp!r}", 403)
    parsed = _parse_with_cache(
        uid,
        validated.storagePath,
        validated.downloadUrl,
        validated.maxRows,
        body.get('contentHash') if isinstance(body, dict) else None,
    )
    if uid == "anonymous-user":
        rc = int(parsed.get("rowCount") or len(parsed.get("rows", [])))
        if rc > ANON_MAX_ROWS:
            parsed = dict(parsed)
            parsed["rows"] = parsed["rows"][:ANON_MAX_ROWS]
            parsed["rowCount"] = ANON_MAX_ROWS
    import pandas as pd
    df = pd.DataFrame(parsed["rows"])
    cleaner = Cleaner.DataCleaner(validated.cleaningConfig)
    result = cleaner.apply(df, validated.columns, validated.preview, validated.maxRows)
    return IO.Response.success(result)


# ML Route Handler

def _handle_ml(body: dict, uid: str) -> dict:
    """Handle machine-learning actions."""
    validated = MLRequest(**body)
    # Anon: take first ANON_MAX_ROWS, not reject.
    if uid == "anonymous-user" and len(validated.rows) > ANON_MAX_ROWS:
        validated = validated.model_copy(update={"rows": validated.rows[:ANON_MAX_ROWS]}) if hasattr(validated, "model_copy") else validated
        # Fallback for Pydantic v1 - mutate
        try:
            validated.rows = validated.rows[:ANON_MAX_ROWS]  # type: ignore
        except Exception:
            pass
    action = validated.action
    rows = validated.rows
    columns = validated.columns
    cleaning_diff = validated.cleaningDiff
    stats_results = validated.statsResults
    params = validated.params

    if action == 'extract_features':
        dataset_features = ML.Features.extract_dataset(rows, columns, cleaning_diff, stats_results)
        column_features = ML.Features.extract_columns(rows, columns, stats_results)
        return IO.Response.success({'datasetFeatures': dataset_features, 'columnFeatures': column_features})
    elif action == 'recommend_all':
        return IO.Response.success(ML.Recommender.recommend_all(rows, columns))
    elif action == 'recommend_cleaning':
        return IO.Response.success({'recommendations': ML.Recommender.Cleaning.recommend(rows, columns, cleaning_diff, stats_results)})
    elif action == 'recommend_tests':
        return IO.Response.success({'recommendations': ML.Recommender.Tests.recommend(rows, columns, stats_results, params)})
    elif action == 'detect_anomalies':
        contamination = params.get('contamination', 0.05) if params else 0.05
        return IO.Response.success(ML.Anomaly(contamination=contamination).detect(rows, columns))
    elif action == 'train':
        # Canonical keys + legacy fallbacks (shim used targetColumn/modelType/featureColumns)
        p = params or {}
        algorithm = p.get('algorithm') or p.get('modelType') or 'knn'
        target = p.get('target') or p.get('targetColumn') or ''
        features = p.get('features') if 'features' in p else p.get('featureColumns')
        task = p.get('task')
        # testSize may be 0.2 or 20 (legacy) — normalize to 0.1-0.5
        raw_ts = p.get('testSize')
        if raw_ts is None:
            raw_ts = p.get('test_size', 0.2)
        try:
            test_size = float(raw_ts)
            if test_size > 1:
                test_size = test_size / 100.0
        except Exception:
            test_size = 0.2
        hyperparams = p.get('hyperparams') or p.get('hyper_params') or {}
        if not isinstance(hyperparams, dict):
            hyperparams = {}
        return IO.Response.success(ML.Training(algorithm=algorithm, task=task, hyperparams=hyperparams, test_size=test_size).run(rows, columns, target=target, features=features))
    else:
        raise ValueError(f'Unknown ML action: {action}')


# Stats Route Handler

def _handle_stats(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle all statistical computation actions.

    Supports two modes:
     1. Direct: rows provided in the body (legacy, still works)
     2. Storage-backed: storagePath provided → Python fetches data from Storage,
        optionally applies cleaning config, then computes stats.
    """
    validated = StatsRequest(**body)
    # P0-C G18 storagePath isolation
    _sp = getattr(validated, "storagePath", None) or getattr(validated, "storage_path", None) or body.get("storagePath") or body.get("storage_path")
    if _sp and uid != "anonymous-user" and not _sp.startswith(f"users/{uid}/"):
        return IO.Response.error(f"storagePath not owned by {uid}: {_sp!r}", 403)
    action = validated.action
    rows = validated.rows
    params = _legacy_params(action, validated.params)
    numeric_cols = validated.numericCols
    cat_cols = validated.catCols
    columns = validated.columns
    storage_path = validated.storagePath
    cleaning_config = validated.cleaningConfig

    # If storagePath is provided, fetch data from Storage (and optionally clean)
    download_url = validated.downloadUrl
    if storage_path:
        parsed = _parse_with_cache(
            uid,
            storage_path,
            download_url,
            content_hash=body.get('contentHash') if isinstance(body, dict) else None,
        )
        rows = parsed['rows']
        columns = parsed['columnTypes']
        numeric_cols = [c['name'] for c in columns if c['type'] == 'numeric']
        cat_cols = [c['name'] for c in columns if c['type'] == 'categorical']

        if cleaning_config:
            import pandas as pd
            df = pd.DataFrame(parsed["rows"])
            cleaner = Cleaner.DataCleaner(cleaning_config)
            cleaned_result = cleaner.apply(df, columns, preview=False)
            rows = cleaned_result['rows']
            columns = cleaned_result['columns']

    if uid == "anonymous-user" and len(rows) > ANON_MAX_ROWS:
        rows = rows[:ANON_MAX_ROWS]

    warnings: list[str] = []
    n_rows = len(rows)
    if n_rows < 30 and n_rows > 0:
        warnings.append(f'n={n_rows} < 30 — CLT-reliant tests may be unreliable')

    if action == 'computeAll':
        descriptive = [Stats.Descriptive.compute(rows, col) for col in numeric_cols]
        frequencies = [Stats.Descriptive.frequency(rows, col) for col in cat_cols]
        correlation = Stats.Correlation.compute(rows, numeric_cols)
        normality = []
        for col in numeric_cols:
            entry = Stats.Normality.run(extract_numeric(rows, col), 'auto').to_dict()
            entry['column'] = col
            # Attach descriptive-derived skewness/kurtosis for frontend table
            desc = next((d for d in descriptive if d.get('column') == col), None)
            if desc is not None:
                if desc.get('skewness') is not None:
                    entry['skewness'] = desc['skewness']
                if desc.get('kurtosis') is not None:
                    entry['kurtosis'] = desc['kurtosis']
            # Ensure required fields are present as finite numbers (sanitize nulls)
            if entry.get('statistic') is None:
                entry['statistic'] = 0.0
            if entry.get('pValue') is None:
                entry['pValue'] = 1.0
                entry['isNormal'] = True
            if entry.get('isNormal') is None:
                entry['isNormal'] = True
            normality.append(entry)
        result = {'descriptive': descriptive, 'frequencies': frequencies, 'correlation': correlation, 'normality': normality}
        return IO.Response.success(result, n=n_rows, warnings=warnings)
    elif action == 'bonferroni':
        p_vals = params.get('pValues', [])
        n = params.get('nComparisons', len(p_vals))
        result = {
            'originalPValues': p_vals,
            'bonferroniCorrected': Stats.Corrections.bonferroni(p_vals, n),
            'fdrCorrected': Stats.Corrections.fdr_bh(p_vals),
            'nComparisons': max(n, len(p_vals)),
        }
        return IO.Response.success(result, n=0, warnings=warnings)
    elif action == 'descriptive':
        result = Stats.Descriptive.compute(rows, params['column'])
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'frequency':
        result = Stats.Descriptive.frequency(rows, params['column'])
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'correlation':
        result = Stats.Correlation.compute(rows, params['columns'], params.get('method', 'pearson'))
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'normality':
        arr = extract_numeric(rows, params['column'])
        result = Stats.Normality.run(arr, params.get('method', 'auto')).to_dict()
        result['column'] = params['column']
        if len(arr) >= 3:
            result['qqPlot'] = Stats.Normality.QQPlot.build(arr)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'ttest':
        result = Stats.TTest.run(rows, params).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'anova':
        result = Stats.Anova.run(rows, params).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'levene':
        col = params.get('numericCol') or params.get('column', '')
        group_col = params.get('groupCol', '')
        groups_map = _build_groups(rows, col, group_col)
        arrays = [np.array(v, dtype=np.float64) for v in groups_map.values()]
        labels = list(groups_map.keys())
        result = Cleaner.Assumptions().check_equal_variance(arrays, labels)
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'welchAnova':
        col = params.get('column') or params.get('numericCol')
        group_col = params.get('groupColumn') or params.get('groupCol')
        result = Stats.Anova.Welch.test(rows, col, group_col).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'wilcoxon':
        col1 = params.get('column')
        col2 = params.get('column2')
        result = Stats.NonParametric.Wilcoxon.test(rows, col1, col2).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'mannWhitney':
        col = params.get('column')
        group_col = params.get('groupCol')
        g1 = _resolve_group_label(rows, group_col, params.get('group1Label'))
        g2 = _resolve_group_label(rows, group_col, params.get('group2Label'))
        result = Stats.NonParametric.MannWhitney.test(rows, col, group_col, g1, g2).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'kruskalWallis':
        col = params.get('column') or params.get('numericCol')
        group_col = params.get('groupColumn') or params.get('groupCol')
        result = Stats.NonParametric.KruskalWallis.test(rows, col, group_col).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'chiSquare':
        result = Stats.Categorical.ChiSquare.test(rows, params.get('column1'), params.get('column2')).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'fisherExact':
        result = Stats.Categorical.FisherExact.test(rows, params.get('column1'), params.get('column2')).to_dict()
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'regression':
        target = params.get('dependentVar') or params.get('target')
        predictors = params.get('predictors', [])
        result = Stats.Regression.run(rows, params)
        return IO.Response.success(_legacy_result(action, result, params, rows), n=len(rows), warnings=warnings)
    elif action == 'vif':
        predictors = params.get('predictors', [])
        if len(predictors) >= 2:
            X = np.column_stack([extract_numeric(rows, p) for p in predictors])
            vif_warnings = Cleaner.Assumptions().check_vif(X, predictors)
            vif_map: dict[str, float] = {}
            try:
                corr = np.corrcoef(X, rowvar=False)
                vifs = np.diag(np.linalg.inv(corr))
                for p, v in zip(predictors, vifs):
                    if math.isfinite(float(v)):
                        vif_map[p] = round(float(v), 4)
            except np.linalg.LinAlgError:
                pass
            result = {
                'predictors': predictors,
                'vif': vif_map,
                'flagged': [p for p in predictors if p in vif_map and vif_map[p] > 5],
                'warnings': vif_warnings,
            }
        else:
            result = {'predictors': predictors, 'vif': {predictors[0]: 1.0} if predictors else {}, 'flagged': []}
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'pairCorrelation':
        from scipy import stats as sp_stats
        col1 = params.get('column1')
        col2 = params.get('column2')
        method = params.get('method', 'pearson')
        x = extract_numeric(rows, col1)
        y = extract_numeric(rows, col2)
        min_len = min(len(x), len(y))
        x, y = x[:min_len], y[:min_len]
        if len(x) < 3:
            raise ValueError(f'Not enough paired numeric values ({len(x)})')
        if method == 'spearman':
            r, p = sp_stats.spearmanr(x, y)
        else:
            r, p = sp_stats.pearsonr(x, y)
        result = {'c1': col1, 'c2': col2, 'r': float(r), 'pValue': float(p), 'method': method, 'n': len(x)}
        if not math.isfinite(result['r']):
            result['r'] = 0.0
        _sanitize_p_value(result)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'groupValues':
        col = params.get('column', '')
        cap = params.get('cap', 200)
        seen = []
        seen_set = set()
        for r in rows:
            v = r.get(col)
            if v is None or str(v).strip() == '':
                continue
            s = str(v)
            if s not in seen_set:
                seen_set.add(s)
                seen.append(s)
                if len(seen) >= cap:
                    break
        result = {'column': col, 'values': seen, 'capped': len(seen) >= cap}
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'insight':
        import re
        descriptive = params.get('descriptive', [])
        normality = params.get('normality', [])
        corr_pairs = params.get('corrPairs', [])
        total_rows = params.get('totalRows', 0)
        num_cols = params.get('numCols', 0)
        cat_cols = params.get('catCols', 0)
        notes = [f"{total_rows:,} rows across {num_cols} numeric and {cat_cols} categorical columns"]
        worst_missing = sorted([d for d in descriptive if d.get('missingPct', 0) > 0], key=lambda d: d.get('missingPct', 0), reverse=True)
        if worst_missing and worst_missing[0].get('missingPct', 0) > 5:
            col = worst_missing[0].get('column', '?')
            pct = worst_missing[0]['missingPct']
            notes.append(f"missing focus: {col} at {pct:.1f}%")
        else:
            notes.append("missing data stable: no column above 5%")
        if corr_pairs:
            strongest = corr_pairs[0]
            if abs(strongest.get('r', 0)) >= 0.7:
                notes.append(f"strong link: {strongest['colA']} vs {strongest['colB']} (r={strongest['r']:.2f})")
        non_normal = [n for n in normality if not n.get('isNormal', True)]
        if non_normal:
            notes.append(f"{len(non_normal)} numeric column{'s' if len(non_normal) > 1 else ''} non-normal: prefer rank-based tests")
        skewed = sorted([d for d in descriptive if d.get('skewness') is not None], key=lambda d: abs(d.get('skewness', 0)), reverse=True)
        if skewed and abs(skewed[0].get('skewness', 0)) > 1:
            notes.append(f"most skewed: {skewed[0]['column']} ({skewed[0]['skewness']:.2f})")
        result = {'text': '  \u2022  '.join(notes[:4])}
        return IO.Response.success(result, n=0, warnings=warnings)
    elif action == 'recommendations':
        import re
        highlights = params.get('highlights', [])
        recs = []
        for h in highlights:
            name = h.get('name', '')
            metric = h.get('metric', '')
            detail = h.get('detail', '')
            p_match = re.search(r'p\s*=\s*([\d.]+)', metric)
            p = float(p_match.group(1)) if p_match else None
            r_match = re.search(r'r\s*=\s*(-?[\d.]+)', metric)
            r = float(r_match.group(1)) if r_match else None
            r2_match = re.search(r'R2\s*=\s*([\d.]+)', metric)
            r2 = float(r2_match.group(1)) if r2_match else None
            vif_match = re.search(r'max\s*=\s*([\d.]+)', metric)
            vif = float(vif_match.group(1)) if vif_match else None
            if 'Correlation' in name and r is not None:
                abs_r = abs(r)
                if abs_r >= 0.7:
                    recs.append({'title': f"Strong {'positive' if r > 0 else 'negative'} correlation detected", 'body': f"{detail} shows r = {r:.2f}. Consider building a regression model.", 'tone': 'action'})
                elif abs_r >= 0.4:
                    recs.append({'title': 'Moderate correlation', 'body': f"{detail} shows r = {r:.2f}. Additional predictors may improve a model.", 'tone': 'ok'})
                else:
                    recs.append({'title': 'Weak or no linear relationship', 'body': f"{detail} shows r = {r:.2f}. A linear model is unlikely to be useful.", 'tone': 'caution'})
                continue
            if name == 'VIF' and vif is not None:
                if vif > 10:
                    recs.append({'title': 'Severe multicollinearity', 'body': f"Max VIF = {vif:.1f}. {detail}. Remove or combine flagged predictors.", 'tone': 'caution'})
                elif vif > 5:
                    recs.append({'title': 'Moderate multicollinearity', 'body': f"Max VIF = {vif:.1f}. {detail}. Consider ridge/LASSO regularization.", 'tone': 'caution'})
                else:
                    recs.append({'title': 'No multicollinearity concern', 'body': 'All VIF values are below 5.', 'tone': 'ok'})
                continue
            if name == 'Regression' and r2 is not None and p is not None:
                if p < 0.05 and r2 >= 0.6:
                    recs.append({'title': 'Strong predictive model', 'body': f"R\u00B2 = {r2:.3f}, p = {p:.4f}. The model explains {r2*100:.0f}% of variance.", 'tone': 'action'})
                elif p < 0.05:
                    recs.append({'title': 'Significant but modest model', 'body': f"R\u00B2 = {r2:.3f}, p = {p:.4f}.", 'tone': 'caution'})
                else:
                    recs.append({'title': 'Model not significant', 'body': f"F-test p = {p:.4f}.", 'tone': 'caution'})
                continue
            if 'Levene' in name and p is not None:
                if p < 0.05:
                    recs.append({'title': 'Unequal variances detected', 'body': f"Levene's test p = {p:.4f}. Use Welch's ANOVA.", 'tone': 'caution'})
                else:
                    recs.append({'title': 'Equal variances confirmed', 'body': f"Levene's test p = {p:.4f}.", 'tone': 'ok'})
                continue
            if p is not None:
                if p < 0.001:
                    recs.append({'title': f"Highly significant ({name})", 'body': f"p < 0.001. {detail}.", 'tone': 'action'})
                elif p < 0.05:
                    recs.append({'title': f"Significant ({name})", 'body': f"p = {p:.4f}. {detail}.", 'tone': 'action'})
                elif p < 0.1:
                    recs.append({'title': f"Marginal ({name})", 'body': f"p = {p:.4f}. {detail}.", 'tone': 'caution'})
                else:
                    recs.append({'title': f"Non-significant ({name})", 'body': f"p = {p:.4f}. {detail}.", 'tone': 'ok'})
        result = {'recommendations': recs}
        return IO.Response.success(result, n=0, warnings=warnings)
    elif action == 'detectIdentifierColumns':
        import re
        columns_list = params.get('columns', [])
        identifiers = []
        for col in columns_list:
            normalized = col.strip().lower()
            if re.search(r'(^|[_\s-])(id|uuid|guid|identifier|recordid|record_id|rowid|row_id|index)([_\s-]|$)', normalized):
                identifiers.append(col)
                continue
            values = [r.get(col) for r in rows if r.get(col) is not None and str(r.get(col)).strip() != '']
            if len(values) < 3:
                continue
            unique_count = len(set(str(v) for v in values))
            ratio = unique_count / len(values)
            if ratio >= 0.98:
                id_hint = re.search(r'(^|[_\s-])(key|code|no|num|number|seq|serial|pk|fk|ref|hash|token)([_\s-]|$)', normalized)
                if id_hint or normalized.endswith('id'):
                    identifiers.append(col)
        result = {'identifiers': identifiers}
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'cleaningStats':
        col = params.get('column', '')
        method = params.get('method', 'iqr')
        arr = extract_numeric(rows, col)
        if len(arr) == 0:
            result = {'error': f'No numeric values in column "{col}"'}
        else:
            result = {'column': col, 'count': len(arr), 'mean': float(arr.mean()),
                       'median': float(np.median(arr)), 'std': float(arr.std(ddof=1)) if len(arr) > 1 else 0.0,
                       'min': float(arr.min()), 'max': float(arr.max())}
            q1 = float(np.percentile(arr, 25))
            q3 = float(np.percentile(arr, 75))
            result['q1'] = q1
            result['q3'] = q3
            if method == 'iqr':
                multiplier = params.get('multiplier', 1.5)
                iqr = q3 - q1
                result['lower'] = q1 - multiplier * iqr
                result['upper'] = q3 + multiplier * iqr
            elif method == 'zscore':
                threshold = params.get('threshold', 3.0)
                m = float(arr.mean())
                sd = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
                result['lower'] = m - threshold * sd
                result['upper'] = m + threshold * sd
            elif method == 'percentile':
                result['lower'] = float(np.percentile(arr, params.get('lowerPct', 5)))
                result['upper'] = float(np.percentile(arr, params.get('upperPct', 95)))
            lower = result.get('lower', float('-inf'))
            upper = result.get('upper', float('inf'))
            result['outlierCount'] = int(np.sum((arr < lower) | (arr > upper)))
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'rankColumns':
        from scipy import stats as sp_stats
        columns_list = params.get('columns', [])
        ranked = []
        for col_name in columns_list:
            arr = extract_numeric(rows, col_name)
            if len(arr) < 5:
                continue
            mean_val = float(arr.mean())
            std_val = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
            cv = std_val / abs(mean_val) if mean_val != 0 else 0.0
            normalized = col_name.lower()
            if 'id' in normalized and cv < 0.4 and len(arr) > 50 and std_val / len(arr) < 0.5:
                continue
            skew = float(sp_stats.skew(arr, bias=False)) if len(arr) >= 3 else 0.0
            score = abs(skew) + cv * 0.5
            ranked.append({'column': col_name, 'score': score, 'skewness': skew, 'cv': cv})
        ranked.sort(key=lambda x: x['score'], reverse=True)
        result = {'ranked': ranked}
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    # ── Extended inferential stats (filtered) ──────────────────────────────
    elif action in ('kendallTau', 'kendall_tau'):
        col1 = params.get('colA') or params.get('col1') or params.get('column1') or ''
        col2 = params.get('colB') or params.get('col2') or params.get('column2') or ''
        result = Stats.CorrelationExtended.kendall(rows, col1, col2)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action in ('tostMean', 'tost', 'tostProportion'):
        col = params.get('col') or params.get('column') or ''
        low = float(params.get('low', -0.5))
        high = float(params.get('high', 0.5))
        if action != 'tostProportion':
            # tost_mean signature is (rows, col, col1, col2, low, high) —
            # pass bounds as keywords so they don't bind to col1/col2.
            result = Stats.Equivalence.tost_mean(rows, col, low=low, high=high)
        else:
            # tost_proportion signature is (rows, col, p0, low, high) —
            # p0 stays at its default; bounds passed as keywords.
            result = Stats.Equivalence.tost_proportion(rows, col, low=low, high=high)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'binomial':
        col = params.get('col') or params.get('column') or ''
        p0 = float(params.get('p0', 0.5))
        result = Stats.Binomial.test(rows, col, p0)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'mcnemar':
        col1 = params.get('col1') or params.get('column1') or ''
        col2 = params.get('col2') or params.get('column2') or ''
        result = Stats.Binomial.mcnemar(rows, col1, col2)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'gofChisquare':
        col = params.get('col') or params.get('column') or ''
        result = Stats.Binomial.gof_chisquare(rows, col)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'twoWayAnova':
        resp = params.get('responseCol') or params.get('response') or params.get('column') or ''
        fa = params.get('factorA') or params.get('factor_a') or params.get('groupCol') or ''
        fb = params.get('factorB') or params.get('factor_b') or params.get('col2') or ''
        result = Stats.AnovaExtended.two_way(rows, resp, fa, fb)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'repeatedAnova':
        subj = params.get('subjectCol') or params.get('subject') or ''
        within = params.get('withinCol') or params.get('within') or params.get('groupCol') or ''
        val = params.get('valueCol') or params.get('value') or params.get('column') or ''
        result = Stats.AnovaExtended.repeated_measures(rows, subj, within, val)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'friedman':
        cols = params.get('columns') or params.get('cols') or []
        result = Stats.AnovaExtended.friedman(rows, cols)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'partialCorrelation':
        ca = params.get('colA') or params.get('x') or ''
        cb = params.get('colB') or params.get('y') or ''
        cc = params.get('control') or params.get('z') or params.get('colC') or ''
        # partial expects list for control
        z_list = [cc] if isinstance(cc, str) and cc else (cc if isinstance(cc, list) else [])
        result = Stats.CorrelationExtended.partial(rows, ca, cb, z_list)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'pointBiserial':
        cat = params.get('catCol') or params.get('col1') or ''
        num = params.get('numCol') or params.get('col2') or params.get('column') or ''
        result = Stats.CorrelationExtended.point_biserial(rows, cat, num)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action in ('logisticRegression', 'logistic_regression'):
        target = params.get('target') or params.get('dependentVar') or ''
        preds = params.get('predictors') or params.get('cols') or []
        result = Stats.RegressionExtended.logistic(rows, target, preds)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'ridgeRegression':
        target = params.get('target') or params.get('dependentVar') or ''
        preds = params.get('predictors') or params.get('cols') or []
        result = Stats.RegressionExtended.ridge_lasso(rows, target, preds, method="ridge")
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'lassoRegression':
        target = params.get('target') or params.get('dependentVar') or ''
        preds = params.get('predictors') or params.get('cols') or []
        result = Stats.RegressionExtended.ridge_lasso(rows, target, preds, method="lasso")
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'moderation':
        target = params.get('target') or ''
        pred = params.get('predictor') or params.get('col1') or ''
        mod = params.get('moderator') or params.get('col2') or ''
        result = Stats.RegressionExtended.moderation(rows, target, pred, mod)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    elif action == 'mediation':
        target = params.get('target') or ''
        pred = params.get('predictor') or ''
        med = params.get('mediator') or ''
        result = Stats.RegressionExtended.mediation(rows, target, pred, med)
        return IO.Response.success(result, n=len(rows), warnings=warnings)
    else:
        raise ValueError(f'Unknown action: {action}')
