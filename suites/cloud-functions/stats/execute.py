"""
execute.py — Code execution endpoint for Code Editor workspaces.

POST /api/v1/execute
  Input:  { language: 'python'|'sql'|'postgres'|'mysql'|'r',
            code: str,
            datasets: [{ uploadId, fileName, storagePath, downloadUrl,
                         workspaceId, workspaceName }] }
  Output: { stdout: str, stderr: str, exitCode: int,
            durationMs: int, resultRows?: list, error?: str }

Cross-workspace dataset access:
  - Python: `workspace.<wsSlug>.<fileSlug>` returns a DataFrame (lazy proxy)
             `openfile(workspace.<ws>.<file>)` or `openfile("ws/file.csv")`
             `df_<wsSlug>_<fileSlug>` auto-instantiated lazy variables
  - SQL:    `<wsSlug>_<fileSlug>` views (DuckDB lazy via read_csv_auto)

Sandboxing:
- Python: subprocess with 30s timeout, scrubbed env, no network # P0-C G18 storagePath isolation added
imports,
            datasets injected as lazy proxy DataFrames
  - SQL/Postgres/MySQL: in-memory DuckDB, datasets registered as lazy views
  - R: subprocess Rscript -e (deferred — returns error if not installed)
"""
from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Any

import pandas as pd

from polymorpha import IO as _IO


TIMEOUT_SECONDS = 30
MAX_RESULT_ROWS = 1000


# Naming helpers

_SAFE_NAME_RE = re.compile(r'[^a-zA-Z0-9_]')


def _slug(name: str) -> str:
    """Convert any name to a safe Python/SQL identifier slug."""
    safe = _SAFE_NAME_RE.sub('_', name.strip())
    if not safe or safe[0].isdigit():
        safe = f't_{safe}'
    return safe.lower()


def _ws_slug(workspace_name: str) -> str:
    """Slug for a workspace name: 'Marketing Analysis' -> 'marketing_analysis'"""
    return _slug(workspace_name)


def _file_slug(file_name: str) -> str:
    """Slug for a file name: 'sales.csv' -> 'sales'"""
    base = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
    return _slug(base)


def _dedup_slugs(datasets: list[dict]) -> list[dict]:
    """Add unique _wsSlug and _fileSlug fields to each dataset.

    If two workspaces produce the same slug, suffix _2, _3, etc.
    If two files in the same workspace produce the same slug, suffix _2, _3, etc.
    """
    ws_slug_counts: dict[str, int] = {}
    file_slug_counts: dict[str, int] = {}  # keyed by ws_slug

    result = []
    for ds in datasets:
        ws_name = ds.get('workspaceName', 'unknown')
        file_name = ds.get('fileName', 'data.csv')

        ws_s = _ws_slug(ws_name)
        # Dedup workspace slug
        if ws_s in ws_slug_counts:
            ws_slug_counts[ws_s] += 1
            ws_s_final = f'{ws_s}_{ws_slug_counts[ws_s]}'
        else:
            ws_slug_counts[ws_s] = 1
            ws_s_final = ws_s

        fs_s = _file_slug(file_name)
        # Dedup file slug within this workspace slug
        file_key = f'{ws_s_final}:{fs_s}'
        if file_key in file_slug_counts:
            file_slug_counts[file_key] += 1
            fs_s_final = f'{fs_s}_{file_slug_counts[file_key]}'
        else:
            file_slug_counts[file_key] = 1
            fs_s_final = fs_s

        result.append({**ds, '_wsSlug': ws_s_final, '_fileSlug': fs_s_final})
    return result


def _var_name(ws_slug: str, file_slug: str) -> str:
    """Python variable name: df_marketing_sales"""
    return f'df_{ws_slug}_{file_slug}'


def _table_name(ws_slug: str, file_slug: str) -> str:
    """SQL table/view name: marketing_sales"""
    return f'{ws_slug}_{file_slug}'


# Safety checks

_BLOCKED_PY_IMPORTS = (
    'import socket',
    'import urllib',
    'import requests',
    'import http',
    'import ftplib',
    'import smtplib',
    'import telnetlib',
    'import paramiko',
    'from socket',
    'from urllib',
    'from requests',
    'from http',
)


def _check_python_safety(code: str) -> str | None:
    """Basic static safety check. Returns error message if code is unsafe."""
    for blocked in _BLOCKED_PY_IMPORTS:
        if blocked in code:
            return f"Blocked import for security: '{blocked}'. Network access is not allowed."
    if '__import__' in code:
        return "Blocked __import__ for security."
    if 'subprocess' in code:
        return "Blocked 'subprocess' module for security."
    if 'os.system' in code or 'os.popen' in code:
        return "Blocked os.system/os.popen for security."
    return None


# Dataset loading

def _load_dataset_as_dataframe(dataset: dict) -> pd.DataFrame:
    """Download a workspace dataset and parse it into a DataFrame."""
    download_url = dataset.get('downloadUrl')
    storage_path = dataset.get('storagePath')
    file_name = dataset.get('fileName', 'data.csv')
    if not download_url:
        raise ValueError(f"Dataset {file_name} missing downloadUrl")

    raw = _IO.Parser(download_url, storage_path).fetch()
    if file_name.endswith('.gz'):
        file_name = file_name[:-3]
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'csv'

    if ext in ('xlsx', 'xls'):
        return pd.read_excel(io.BytesIO(raw))
    return pd.read_csv(io.BytesIO(raw))


# Python runner script (inlined in subprocess)

# This script is written to a temp file and executed by the venv Python.
# It defines the lazy proxy classes, builds the workspace registry,
# injects df_* variables, and runs the user's code.
# Using a string template (not inline f-strings) for clarity.

_RUNNER_TEMPLATE = '''\
import sys
import io
import gzip
import json
import traceback
import pandas as pd
import requests as _requests

# Dataset manifest passed via file (env vars truncate on Windows)
import os as _os
with open(_os.path.join(_os.path.dirname(__file__), "manifest.json"), "r", encoding="utf-8") as _f:
    _manifest = json.load(_f)

# Load datasets as real DataFrames (eager)
def _load_df(ref):
    url = ref["downloadUrl"]
    storage_path = ref.get("storagePath", "")
    fname = ref.get("fileName", "data.csv")
    resp = _requests.get(url, timeout=120)
    resp.raise_for_status()
    raw = resp.content
    if storage_path.endswith(".gz") or fname.endswith(".gz"):
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
    if fname.endswith(".gz"):
        fname = fname[:-3]
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "csv"
    if ext in ("xlsx", "xls"):
        return pd.read_excel(io.BytesIO(raw))
    return pd.read_csv(io.BytesIO(raw))

# Build { ws_slug: { file_slug: DataFrame } } and flat var map
_ws_handles = {}
_user_ns = {"pd": pd}

for ref in _manifest:
    ws_s = ref.get("_wsSlug", "")
    fs_s = ref.get("_fileSlug", "")
    if not ws_s or not fs_s:
        continue
    try:
        df = _load_df(ref)
    except Exception as e:
        sys.stderr.write("Failed to load " + ref.get("fileName", "?") + ": " + str(e) + "\\n")
        continue
    _ws_handles.setdefault(ws_s, {})[fs_s] = df
    _user_ns["df_" + ws_s + "_" + fs_s] = df


# Workspace registry (returns real DataFrames)
class _WorkspaceHandle:
    """workspace.<name>.<file> returns a real DataFrame."""
    def __init__(self, ws_name, dfs):
        object.__setattr__(self, "_ws_name", ws_name)
        object.__setattr__(self, "_dfs", dfs)

    def openfile(self, file_name):
        base = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
        import re as _re
        slug = _re.sub(r"[^a-zA-Z0-9_]", "_", base).lower()
        if not slug or slug[0].isdigit():
            slug = "t_" + slug
        dfs = object.__getattribute__(self, "_dfs")
        if slug in dfs:
            return dfs[slug]
        for key in dfs:
            if key == slug or key.startswith(slug + "_"):
                return dfs[key]
        raise KeyError("No dataset named '" + file_name + "' in workspace '" + object.__getattribute__(self, "_ws_name") + "'. Available: " + str(list(dfs.keys())))

    def __getattr__(self, file_slug):
        dfs = object.__getattribute__(self, "_dfs")
        if file_slug in dfs:
            return dfs[file_slug]
        raise AttributeError("No dataset '" + file_slug + "' in workspace '" + object.__getattribute__(self, "_ws_name") + "'. Available: " + str(list(dfs.keys())))

    def __dir__(self):
        return list(object.__getattribute__(self, "_dfs").keys()) + ["openfile"]

    def __repr__(self):
        dfs = object.__getattribute__(self, "_dfs")
        return "Workspace('" + object.__getattribute__(self, "_ws_name") + "', datasets=" + str(list(dfs.keys())) + ")"


class _WorkspaceRegistry:
    """workspace.<wsSlug> returns a handle."""
    def __init__(self, handles):
        object.__setattr__(self, "_handles", handles)

    def __getattr__(self, ws_slug):
        handles = object.__getattribute__(self, "_handles")
        if ws_slug in handles:
            return _WorkspaceHandle(ws_slug, handles[ws_slug])
        raise AttributeError("No workspace '" + ws_slug + "'. Available: " + str(list(handles.keys())))

    def __dir__(self):
        return list(object.__getattribute__(self, "_handles").keys())

    def __repr__(self):
        handles = object.__getattribute__(self, "_handles")
        return "Workspaces(" + str(list(handles.keys())) + ")"


_workspace = _WorkspaceRegistry(_ws_handles)
_user_ns["workspace"] = _workspace


# openfile() global function
def openfile(ref):
    """Open a dataset and return a pandas DataFrame.

    Accepts:
      - openfile(workspace.marketing.sales)       # DataFrame from registry
      - openfile(df_marketing_sales)              # DataFrame variable
      - openfile("marketing/sales.csv")           # "workspace/file" string
      - openfile("marketing/sales")              # "workspace/file" (no ext)
    """
    if isinstance(ref, pd.DataFrame):
        return ref
    if isinstance(ref, str):
        parts = ref.split("/", 1)
        if len(parts) != 2:
            raise ValueError("openfile string must be 'workspace/filename', got: " + repr(ref))
        ws_slug, file_name = parts[0], parts[1]
        handles = object.__getattribute__(_workspace, "_handles")
        if ws_slug not in handles:
            raise KeyError("No workspace '" + ws_slug + "'. Available: " + str(list(handles.keys())))
        return _WorkspaceHandle(ws_slug, handles[ws_slug]).openfile(file_name)
    raise TypeError("openfile() accepts a DataFrame or 'workspace/file' string. Got: " + type(ref).__name__)


_user_ns["openfile"] = openfile


# Run user code
_user_code = open(_os.path.join(_os.path.dirname(__file__), "user_code.py"), "r", encoding="utf-8").read()

_available_df = sorted(k for k in _user_ns if k.startswith("df_"))

# Capture stdout
_captured = io.StringIO()
_old_stdout = sys.stdout
sys.stdout = _captured

try:
    exec(_user_code, _user_ns)
except SystemExit:
    pass
except NameError as _ne:
    sys.stdout = _old_stdout
    _err_msg = str(_ne)
    sys.stderr.write("NameError: " + _err_msg + "\\n")
    import difflib
    _word = _err_msg.split("'")[1] if "'" in _err_msg else ""
    if _word and _word.startswith("df_"):
        _suggestions = difflib.get_close_matches(_word, _available_df, n=3, cutoff=0.6)
        if _suggestions:
            sys.stderr.write("Did you mean: " + ", ".join(_suggestions) + "?\\n")
        else:
            sys.stderr.write("Available variables: " + ", ".join(_available_df[:10]) + "\\n")
    elif _available_df:
        sys.stderr.write("Available dataset variables: " + ", ".join(_available_df[:10]) + "\\n")
except Exception:
    sys.stdout = _old_stdout
    sys.stderr.write(traceback.format_exc())
else:
    sys.stdout = _old_stdout
    _out = _captured.getvalue()
    if _out:
        sys.stdout.write(_out)
'''


def _execute_python(code: str, datasets: list[dict]) -> dict:
    """Run Python code in a subprocess with lazy dataset proxies."""
    safety_error = _check_python_safety(code)
    if safety_error:
        return {
            'stdout': '',
            'stderr': safety_error,
            'exitCode': 1,
            'durationMs': 0,
            'error': safety_error,
        }

    import json
    t0 = time.time()
    tmpdir = tempfile.mkdtemp(prefix='poly_exec_')
    try:
        runner_path = os.path.join(tmpdir, 'runner.py')
        with open(runner_path, 'w', encoding='utf-8') as f:
            f.write(_RUNNER_TEMPLATE)

        # Write manifest and user code to files (env vars truncate on Windows at ~32KB)
        manifest_path = os.path.join(tmpdir, 'manifest.json')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(datasets, f)

        user_code_path = os.path.join(tmpdir, 'user_code.py')
        with open(user_code_path, 'w', encoding='utf-8') as f:
            f.write(code)

        # Use a copy of the current environment to avoid breaking Cloud Function dependencies.
        # We inject sys.path so the subprocess inherits the same site-packages (pandas, numpy, etc.).
        clean_env = os.environ.copy()
        clean_env['PYTHONPATH'] = os.pathsep.join(sys.path)
        clean_env['MPLBACKEND'] = 'Agg'
        clean_env['PYTHONIOENCODING'] = 'utf-8'
        clean_env['TEMP'] = tmpdir
        clean_env['TMP'] = tmpdir
        clean_env['HOME'] = os.environ.get('HOME', tmpdir)
        clean_env['USERPROFILE'] = os.environ.get('USERPROFILE', tmpdir)

        proc = subprocess.run(
            [sys.executable, runner_path],
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            env=clean_env,
            cwd=tmpdir,
            text=True,
        )
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': proc.stdout,
            'stderr': proc.stderr,
            'exitCode': proc.returncode,
            'durationMs': duration_ms,
        }
    except subprocess.TimeoutExpired:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': f'Execution timed out after {TIMEOUT_SECONDS}s',
            'exitCode': 124,
            'durationMs': duration_ms,
            'error': 'timeout',
        }
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1,
            'durationMs': duration_ms,
            'error': str(e),
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# SQL execution (DuckDB)

def _execute_sql(code: str, datasets: list[dict], dialect: str | None = None) -> dict:
    """Run SQL against in-memory DuckDB with datasets as lazy views.

    Each dataset is registered as a view: <wsSlug>_<fileSlug>
    The view uses read_csv_auto('<downloadUrl>') so DuckDB only downloads
    the data when the view is actually queried.
    """
    try:
        import duckdb
    except ImportError:
        return {
            'stdout': '',
            'stderr': 'DuckDB is not installed on the backend.',
            'exitCode': 1,
            'durationMs': 0,
            'error': 'duckdb not installed',
        }

    t0 = time.time()
    try:
        con = duckdb.connect(':memory:')
        if dialect:
            con.execute(f"SET dialect = '{dialect}';")

        # Register each dataset as a lazy view using pre-computed slugs
        for ds in datasets:
            ws_s = ds.get('_wsSlug', _ws_slug(ds.get('workspaceName', 'unknown')))
            fs_s = ds.get('_fileSlug', _file_slug(ds.get('fileName', 'data.csv')))
            view_name = _table_name(ws_s, fs_s)
            download_url = ds.get('downloadUrl', '')
            if not download_url:
                continue
            # read_csv_auto downloads + infers schema on first query
            try:
                con.execute(
                    f"CREATE VIEW {view_name} AS SELECT * FROM read_csv_auto('{download_url}', header=true)"
                )
            except Exception:
                # Skip datasets that fail to register
                pass

        result = con.execute(code)
        rows: list[dict] = []
        try:
            fetched = result.fetchall()
            cols = [d[0] for d in result.description] if result.description else []
            for row in fetched[:MAX_RESULT_ROWS]:
                rows.append(dict(zip(cols, row)))
        except Exception:
            pass

        duration_ms = int((time.time() - t0) * 1000)
        stdout = _format_table(rows) if rows else 'Query executed successfully (no rows returned).'
        return {
            'stdout': stdout,
            'stderr': '',
            'exitCode': 0,
            'durationMs': duration_ms,
            'resultRows': rows,
        }
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1,
            'durationMs': duration_ms,
            'error': str(e),
        }


def _format_table(rows: list[dict]) -> str:
    """Format result rows as a simple text table."""
    if not rows:
        return ''
    cols = list(rows[0].keys())
    widths = {c: len(c) for c in cols}
    for r in rows:
        for c in cols:
            widths[c] = max(widths[c], len(str(r.get(c, '')))[:40])

    header = ' | '.join(c.ljust(widths[c]) for c in cols)
    sep = '-+-'.join('-' * widths[c] for c in cols)
    body = '\n'.join(' | '.join(str(r.get(c, '')).ljust(widths[c])[:40] for c in cols) for r in rows)
    return f'{header}\n{sep}\n{body}'


# R execution (deferred)

def _execute_r(code: str) -> dict:
    """Run R code via Rscript. Returns clear error if R is not installed."""
    rscript = shutil.which('Rscript')
    if not rscript:
        return {
            'stdout': '',
            'stderr': 'Rscript is not installed on the backend. R execution is not yet available.',
            'exitCode': 1,
            'durationMs': 0,
            'error': 'Rscript not installed',
        }

    t0 = time.time()
    try:
        proc = subprocess.run(
            [rscript, '-e', code],
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            text=True,
        )
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': proc.stdout,
            'stderr': proc.stderr,
            'exitCode': proc.returncode,
            'durationMs': duration_ms,
        }
    except subprocess.TimeoutExpired:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': f'Execution timed out after {TIMEOUT_SECONDS}s',
            'exitCode': 124,
            'durationMs': duration_ms,
            'error': 'timeout',
        }
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1,
            'durationMs': duration_ms,
            'error': str(e),
        }


# Handler

def handle_execute(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle a code execution request.

    Expects: { language, code, datasets: [{ uploadId, fileName, storagePath, downloadUrl, workspaceId, workspaceName }] }
    Returns: { stdout, stderr, exitCode, durationMs, resultRows?, error? }
    """
    language = (body.get('language') or '').lower()
    code = body.get('code') or ''
    raw_datasets = body.get('datasets') or []

    if not code.strip():
        raise ValueError('No code to execute')

    # Dedup slugs so two workspaces with the same name get unique variable names
    datasets = _dedup_slugs(raw_datasets)

    if language == 'python':
        return _execute_python(code, datasets)
    elif language in ('sql', 'postgres', 'postgresql', 'mysql'):
        dialect = 'postgres' if language in ('postgres', 'postgresql') else 'mysql' if language == 'mysql' else None
        return _execute_sql(code, datasets, dialect)
    elif language == 'r':
        return _execute_r(code)
    else:
        raise ValueError(f"Unsupported language: {language}. Supported: python, sql, postgres, mysql, r")
