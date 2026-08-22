"""
Polymorpha ML Service — Google Cloud Function (2nd gen)
Handles feature extraction, model training, and inference for the ML Analyse tab.

Routes:
  POST /api/v1/machine-learning

Deploy:
  gcloud functions deploy polymorpha-ml \
    --gen2 --runtime python312 --region us-central1 \
    --source ./cloud-functions/ml \
    --entry-point ml_handler \
    --trigger-http --allow-unauthenticated \
    --memory 1024MB --timeout 120s
"""

from __future__ import annotations

import json
from typing import Any

import functions_framework
from flask import Request
from pydantic import ValidationError

from polymorpha import IO, ML
from polymorpha.schemas import MLRequest
from auth import verify_token
import re

ANON_MAX_ROWS = 10_000


def _sanitize_validation_error(exc) -> str:  # type: ignore[no-untyped-def]
    """Never echo rows/columns payloads from ML ValidationErrors."""
    try:
        try:
            errors = exc.errors(include_url=False, include_context=False, include_input=False)  # type: ignore[call-arg]
        except TypeError:
            try:
                errors = exc.errors(include_url=False, include_context=False)  # type: ignore[call-arg]
            except TypeError:
                errors = exc.errors()
    except Exception:
        return "Invalid request. Please retry."
    parts: list[str] = []
    for err in errors[:3]:
        err = {k: v for k, v in err.items() if k not in ("input", "ctx", "url")}
        msg = str(err.get("msg", "Invalid input"))
        if "Unsupported" in msg:
            m = re.search(r"Unsupported[^']*'([^']+)'", msg)
            act = m.group(1) if m else "unknown"
            parts.append(f"This ML action ({act}) is temporarily unavailable. Please retry.")
            continue
        if "rows" in msg.lower() or "columns" in msg.lower():
            msg = "Invalid request payload. Please retry."
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, ") :]
        loc = err.get("loc", ())
        loc_str = ".".join(str(x) for x in loc) if loc else ""
        if loc_str and loc_str not in msg:
            msg = f"{loc_str}: {msg}"
        if len(msg) > 300:
            msg = msg[:300] + "…"
        parts.append(msg)
    if not parts:
        return "Invalid request. Please retry."
    combined = " | ".join(parts)
    if len(combined) > 500:
        combined = combined[:500] + "…"
    for token in ("'rows'", '"rows"', "'columns'", '"columns"'):
        if token in combined:
            return "Invalid request. Please retry."
    return combined


def _sanitize_generic_error(msg: str) -> str:
    if not isinstance(msg, str):
        msg = str(msg)
    lower = msg.lower()
    if "'rows'" in lower or '"rows"' in lower or "'columns'" in lower:
        return "Request failed due to invalid input. Please retry."
    if "Supported" in msg:
        m = re.search(r"Unsupported[^']*'([^']+)'", msg)
        if m:
            return f"This ML action ({m.group(1)}) is temporarily unavailable. Please retry."
        return "This ML action is temporarily unavailable. Please retry."
    if len(msg) > 500:
        msg = msg[:500] + "…"
    return msg


# Cloud Function Entry Point

@functions_framework.http
def ml_handler(request: Request):
    """HTTP Cloud Function entry point for ML actions."""
    if request.method == 'OPTIONS':
        return IO.Response.cors_preflight(request.headers.get('Origin'))

    if request.method != 'POST':
        return IO.Response.error('Method not allowed', 405)

    try:
        uid = verify_token(request)
    except ValueError as e:
        return IO.Response.error(str(e), 401)

    try:
        body = request.get_json(silent=True) or {}
        # G20 dataset-agnostic: preserve fallback rows/cols before popping storage keys
        fallback_rows = body.get("rows")
        fallback_cols = body.get("columns")
        storage_path = body.pop("storagePath", None)
        download_url = body.pop("downloadUrl", None)
        # P0-C G18 storagePath isolation
        if storage_path and uid != "anonymous-user" and not storage_path.startswith(f"users/{uid}/"):
            return IO.Response.error(f"storagePath not owned by {uid}: {storage_path!r}", 403)
        cleaning_config = body.pop("cleaningConfig", None)
        # totalRowCount is diagnostic only
        body.pop("totalRowCount", None)
        body.pop("sourceUrl", None)
        if storage_path:
            try:
                # G20: pass sourceUrl not needed for ML, but keep generic
                parser = IO.Parser(download_url, storage_path) if download_url else IO.Parser(storage_path)  # type: ignore[call-arg]
                parsed = parser.parse()
                if parsed.get("rows") is not None:
                    body["rows"] = parsed["rows"]
                    if not body.get("columns"):
                        body["columns"] = parsed.get("columnTypes", [])
                else:
                    raise ValueError(f"Storage dataset empty ({storage_path})")
                if cleaning_config:
                    import pandas as pd
                    from polymorpha.cleaner import Cleaner

                    df = pd.DataFrame(parsed["rows"])
                    cols = parsed.get("columnTypes", body.get("columns", fallback_cols) or [])
                    cleaned = Cleaner.DataCleaner(cleaning_config).apply(df, cols)
                    if cleaned.get("rows") is not None:
                        body["rows"] = cleaned["rows"]
                    if cleaned.get("columns") is not None:
                        body["columns"] = cleaned["columns"]
            except Exception as exc:
                # G19 fail inline but allow fallback rows for universality: use preview if storage fails
                if fallback_rows is not None:
                    body["rows"] = fallback_rows
                    if fallback_cols is not None and not body.get("columns"):
                        body["columns"] = fallback_cols
                else:
                    raise ValueError(f"Failed to load dataset from Storage ({storage_path}): {exc}") from exc
        if "rows" not in body or body["rows"] is None:
            if fallback_rows is not None:
                body["rows"] = fallback_rows
                if fallback_cols is not None and not body.get("columns"):
                    body["columns"] = fallback_cols
            else:
                raise ValueError("No rows provided and Storage fetch not requested")
        # Anon: take first ANON_MAX_ROWS, not reject.
        if uid == "anonymous-user" and len(body.get("rows", []) or []) > ANON_MAX_ROWS:
            body["rows"] = body["rows"][:ANON_MAX_ROWS]
        validated = MLRequest(**body)
        result = dispatch(
            validated.action,
            validated.rows,
            validated.columns,
            validated.cleaningDiff,
            validated.statsResults,
            validated.params,
            uid,
        )
        # Use clean_nan to ensure NaN/Infinity become null for valid JSON (IO.Encoder alone leaves NaN)
        from polymorpha.io._encoder import clean_nan
        body = json.dumps(clean_nan(result), cls=IO.Encoder)
        origin = IO.Response.resolve_origin(request.headers.get('Origin'))
        return (body, 200, {
            'Access-Control-Allow-Origin': origin,
            'Content-Type': 'application/json',
        })
    except ValidationError as e:
        return IO.Response.error(_sanitize_validation_error(e), 422)
    except ValueError as e:
        return IO.Response.error(_sanitize_generic_error(str(e)), 400)
    except Exception as e:
        return IO.Response.error(_sanitize_generic_error(f'Internal error: {type(e).__name__}: {e}'), 500)


def dispatch(
    action: str,
    rows: list[dict],
    columns: list[dict],
    cleaning_diff: dict,
    stats_results: dict,
    params: dict,
    uid: str,
) -> dict:
    """Route to the correct ML action handler using polymorpha business-logic."""

    if action == 'extract_features':
        dataset_features = ML.Features.extract_dataset(
            rows, columns, cleaning_diff, stats_results,
        )
        column_features = ML.Features.extract_columns(
            rows, columns, stats_results,
        )
        return IO.Response.success({
            'datasetFeatures': dataset_features,
            'columnFeatures': column_features,
        })
    elif action == 'recommend_all':
        return IO.Response.success(ML.Recommender.recommend_all(rows, columns))
    elif action == 'recommend_cleaning':
        recs = ML.Recommender.Cleaning.recommend(
            rows, columns, cleaning_diff, stats_results,
        )
        return IO.Response.success({'recommendations': recs})
    elif action == 'recommend_tests':
        recs = ML.Recommender.Tests.recommend(
            rows, columns, stats_results, params,
        )
        return IO.Response.success({'recommendations': recs})
    elif action == 'detect_anomalies':
        contamination = (params or {}).get('contamination', 0.05)
        result = ML.Anomaly(contamination=contamination).detect(rows, columns)
        return IO.Response.success(result)
    elif action == 'train':
        p = params or {}
        algorithm = p.get('algorithm') or p.get('modelType') or 'knn'
        target = p.get('target') or p.get('targetColumn') or ''
        features = p.get('features') if 'features' in p else p.get('featureColumns')
        task = p.get('task')
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
        result = ML.Training(algorithm=algorithm, task=task, hyperparams=hyperparams, test_size=test_size).run(
            rows, columns, target=target, features=features,
        )
        return IO.Response.success(result)
    else:
        raise ValueError(f'Unknown action: {action}')
