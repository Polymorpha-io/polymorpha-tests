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

import hashlib
import io
import json
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

# Kernel-style sessions (Jupyter model: one long-lived user namespace per
# notebook; each execute_request runs in that same namespace).
# Stateless Cloud Functions can't hold memory across instances, so sessions
# are best-effort per process: single-instance dev and Cloud Run min-1 keep
# them; a fresh instance starts empty and the frontend re-runs top-down.
_SESSION_TTL_SECONDS = 30 * 60
_SESSION_MAX = 200
_SESSIONS_DIRNAME = 'poly_sessions'
# DataFrames wider than this are skipped at persist time (pickle cost guard).
_SESSION_PERSIST_MAX_ROWS = 100_000
_SESSION_VAR_CAP = 50
# Single values pickling larger than this are skipped at persist time
# (one giant list/dict must never stall every Run's session write).
_SESSION_PERSIST_MAX_BYTES = 5_000_000
# Out[n] last-expression repr cap: one huge to_string() must never bloat the
# response (mirrors the frontend CODE_CELL_OUTPUT_MAX_CHARS truncation).
_REPR_OUT_MAX_CHARS = 20_000
# Repeat Runs re-attach the same datasets: raw bytes are cached on disk so
# only the first Run per storagePath pays the download. Signed downloadUrls
# rotate (~45m), so the stable storagePath is the cache key, never the URL.
_DATASETS_DIRNAME = 'poly_datasets'
_DATASET_TTL_SECONDS = 30 * 60
_DATASET_MAX_BYTES = 500_000_000


def _sessions_dir() -> str:
    path = os.path.join(tempfile.gettempdir(), _SESSIONS_DIRNAME)
    os.makedirs(path, exist_ok=True)
    return path


def _session_file(session_key: str) -> str:
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', session_key)[:128]
    return os.path.join(_sessions_dir(), f'session_{safe}.pkl')


def _touch_sessions() -> None:
    """Evict expired session files + enforce the session cap (G18)."""
    try:
        now = time.time()
        entries = []
        for name in os.listdir(_sessions_dir()):
            if not (name.startswith('session_') and name.endswith('.pkl')):
                continue
            full = os.path.join(_sessions_dir(), name)
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                continue
            if now - mtime > _SESSION_TTL_SECONDS:
                try:
                    os.remove(full)
                except OSError:
                    pass
            else:
                entries.append((mtime, full))
        entries.sort()
        while len(entries) > _SESSION_MAX:
            _, oldest = entries.pop(0)
            try:
                os.remove(oldest)
            except OSError:
                pass
    except OSError:
        pass


def _datasets_dir() -> str:
    path = os.path.join(tempfile.gettempdir(), _DATASETS_DIRNAME)
    os.makedirs(path, exist_ok=True)
    return path


def _dataset_cache_key(dataset: dict) -> str:
    """Stable cache key: storagePath first (survives signed-URL rotation),
    downloadUrl fallback for legacy refs without one."""
    stable = dataset.get('storagePath') or dataset.get('downloadUrl') or ''
    return hashlib.sha1(stable.encode('utf-8')).hexdigest()


def _touch_dataset_cache() -> None:
    """Evict expired dataset blobs + enforce the byte cap, oldest first."""
    try:
        now = time.time()
        entries = []
        total = 0
        for name in os.listdir(_datasets_dir()):
            if not (name.endswith('.bin')):
                continue
            full = os.path.join(_datasets_dir(), name)
            try:
                mtime = os.path.getmtime(full)
                size = os.path.getsize(full)
            except OSError:
                continue
            if now - mtime > _DATASET_TTL_SECONDS:
                try:
                    os.remove(full)
                except OSError:
                    pass
            else:
                entries.append((mtime, size, full))
                total += size
        entries.sort()
        while total > _DATASET_MAX_BYTES and entries:
            _, size, oldest = entries.pop(0)
            try:
                os.remove(oldest)
                total -= size
            except OSError:
                pass
    except OSError:
        pass


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
import ast as _ast
import traceback
import pandas as pd
import requests as _requests

# Dataset manifest passed via file (env vars truncate on Windows)
import os as _os
with open(_os.path.join(_os.path.dirname(__file__), "manifest.json"), "r", encoding="utf-8") as _f:
    _manifest = json.load(_f)

# Load datasets as real DataFrames (eager)
# Repeat Runs re-attach the same datasets: raw bytes are cached under
# POLY_DATASET_CACHE_DIR (host evicts by TTL/size) so only the first Run
# pays the download. Key = storagePath (stable across signed-URL rotation).
import hashlib as _hashlib
_http = _requests.Session()
_cache_dir = _os.environ.get("POLY_DATASET_CACHE_DIR", "")

def _cache_path(ref):
    if not _cache_dir:
        return ""
    stable = ref.get("storagePath", "") or ref["downloadUrl"]
    digest = _hashlib.sha1(stable.encode("utf-8")).hexdigest()
    return _os.path.join(_cache_dir, digest + ".bin")

# Raw bytes pending materialization into the run cwd (Colab-upload pattern:
# attached files exist under their real names so pd.read_csv('name.csv')
# resolves natively). Drained just before user code runs.
_pending_files = []
def _note_raw_file(fname, raw):
    try:
        base = _os.path.basename(str(fname or "")).strip()
        if not base or base in (".", "..") or len(base) > 255:
            return
        for _seen, _r in _pending_files:
            if _seen == base:
                sys.stderr.write("Note: '" + base + "' is attached more than once — reads resolve to the first.\\n")
                return  # first ref wins on same-basename collision
        _pending_files.append((base, raw))
    except Exception:
        pass

def _load_df(ref):
    url = ref["downloadUrl"]
    storage_path = ref.get("storagePath", "")
    fname = ref.get("fileName", "data.csv")
    raw = None
    _cpath = _cache_path(ref)
    if _cpath and _os.path.exists(_cpath):
        try:
            with open(_cpath, "rb") as _cf:
                raw = _cf.read()
        except Exception:
            raw = None
    if raw is None:
        resp = _http.get(url, timeout=120)
        resp.raise_for_status()
        raw = resp.content
        if _cpath:
            try:
                with open(_cpath, "wb") as _cf:
                    _cf.write(raw)
            except Exception:
                pass
    if storage_path.endswith(".gz") or fname.endswith(".gz"):
        try:
            raw = gzip.decompress(raw)
        except Exception as e:
            raise ValueError("File '" + fname + "' claims .gz but gzip decompress failed: " + str(e))
    if fname.endswith(".gz"):
        fname = fname[:-3]
    _note_raw_file(fname, raw)
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "csv"
    if ext in ("xlsx", "xls"):
        return pd.read_excel(io.BytesIO(raw))
    return pd.read_csv(io.BytesIO(raw))

# Build { ws_slug: { file_slug: DataFrame } } and flat var map
_ws_handles = {}
_user_ns = {"pd": pd}
# G19: dataset load failures are recorded (not swallowed) so a later
# NameError on the missing df_* variable reports the load cause inline.
_load_errors = {}

for ref in _manifest:
    ws_s = ref.get("_wsSlug", "")
    fs_s = ref.get("_fileSlug", "")
    if not ws_s or not fs_s:
        continue
    try:
        df = _load_df(ref)
    except Exception as e:
        _load_errors["df_" + ws_s + "_" + fs_s] = str(e)
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


# display() shim: pasted analyse snippets call display(df...). In a real
# kernel this renders rich output; here it prints a head + shape so the
# call always runs instead of NameError-ing.
def display(obj, *args, **kwargs):
    """Minimal display() shim: DataFrames print head + shape, else repr."""
    try:
        import pandas as _pd
        if isinstance(obj, _pd.DataFrame):
            print(obj.head(10).to_string())
            print("[" + str(len(obj)) + " rows x " + str(len(obj.columns)) + " columns]")
            return
        if isinstance(obj, _pd.Series):
            print(obj.head(10).to_string())
            return
    except Exception:
        pass
    print(repr(obj))


_user_ns["openfile"] = openfile
_user_ns["display"] = display


# Run cwd = this job's directory (classic subprocess already starts there via
# cwd=tmpdir; warm workers inherit the server cwd). Every job chdirs to its
# own runner dir unconditionally, so a reused warm worker self-heals even if
# a previous job died mid-run. Attached bytes are then materialized under
# their real filenames (Colab-upload pattern) so pd.read_csv('name.csv'),
# read_excel, open() and friends resolve natively — any args, any library.
_RUN_DIR = _os.path.dirname(_os.path.abspath(__file__))
_PREV_CWD = ""
try:
    _PREV_CWD = _os.getcwd()
    if _PREV_CWD != _RUN_DIR:
        _os.chdir(_RUN_DIR)
except Exception as _e:
    sys.stderr.write("chdir to run dir skipped: " + str(_e) + "\\n")
for _base, _raw in _pending_files:
    try:
        with open(_os.path.join(_RUN_DIR, _base), "wb") as _mf:
            _mf.write(_raw)
    except Exception as _e:
        sys.stderr.write("Could not stage '" + _base + "': " + str(_e) + "\\n")
try:
    del _pending_files
except Exception:
    pass


# Run user code
_user_code = open(_os.path.join(_os.path.dirname(__file__), "user_code.py"), "r", encoding="utf-8").read()

_available_df = sorted(k for k in _user_ns if k.startswith("df_"))

# Single-dataset convenience: every Polymorpha snippet assumes bare `df`.
# Multi-dataset sessions keep the explicit df_<ws>_<file> variables only.
if len(_available_df) == 1:
    _user_ns.setdefault("df", _user_ns[_available_df[0]])

# Session restore (Jupyter kernel model): the previous run's user namespace
# is merged underneath the fresh dataset variables, so user mutations and
# variables survive across Runs. Fresh dataset frames always win on name
# collision, so re-attached data can never go stale.
_kernel_provided = set(_user_ns)
_ns_path = _os.environ.get("POLY_NAMESPACE_PATH", "")
if _ns_path and _os.path.exists(_ns_path):
    try:
        import pickle as _pickle
        with open(_ns_path, "rb") as _pf:
            _persisted = _pickle.load(_pf)
        if isinstance(_persisted, dict):
            for _k, _v in _persisted.items():
                if isinstance(_k, str) and not _k.startswith("_"):
                    _user_ns.setdefault(_k, _v)
    except Exception as _e:
        sys.stderr.write("Session restore skipped: " + str(_e) + "\\n")

# Capture stdout
_captured = io.StringIO()
_old_stdout = sys.stdout
sys.stdout = _captured

# Structured error record (Jupyter nbformat error-output parity: ename +
# evalue travel as data, not just traceback text). Written next to
# variables.json; the host merges it into the response when present.
_failed = False

def _record_error(_ename, _evalue):
    global _failed
    _failed = True
    try:
        with open(_os.path.join(_os.path.dirname(__file__), "error.json"), "w", encoding="utf-8") as _ef:
            json.dump({"ename": _ename, "evalue": str(_evalue)[:500]}, _ef)
    except Exception:
        pass

try:
    # Jupyter parity: the last statement, when a bare expression, is eval'd
    # and its repr shown as the cell's Out[n] value (no print required).
    # split_last_expression handles the None/;/SyntaxError suppression rules;
    # the cap bounds one huge to_string() exactly once, at the writer.
    import poly_expr_split as _split
    _prologue, _final_expr = _split.split_last_expression(_user_code)
    if _final_expr is not None:
        exec(compile(_prologue, "<cell>", "exec"), _user_ns)
        _last = eval(compile(_ast.Expression(_final_expr.value), "<cell>", "eval"), _user_ns)
        if _last is not None:
            with open(_os.path.join(_os.path.dirname(__file__), "repr_out.json"), "w", encoding="utf-8") as _rf:
                json.dump({"repr": _split.format_repr(_last)[:__POLY_REPR_OUT_MAX_CHARS__]}, _rf)
    else:
        exec(_user_code, _user_ns)
except SystemExit:
    pass
except NameError as _ne:
    sys.stdout = _old_stdout
    _err_msg = str(_ne)
    _record_error("NameError", _err_msg)
    sys.stderr.write("NameError: " + _err_msg + "\\n")
    import difflib
    _word = _err_msg.split("'")[1] if "'" in _err_msg else ""
    if _word and _word.startswith("df_"):
        if _word in _load_errors:
            sys.stderr.write("Dataset failed to load: " + _load_errors[_word] + "\\n")
        _suggestions = difflib.get_close_matches(_word, _available_df, n=3, cutoff=0.6)
        if _suggestions:
            sys.stderr.write("Did you mean: " + ", ".join(_suggestions) + "?\\n")
        else:
            sys.stderr.write("Available variables: " + ", ".join(_available_df[:10]) + "\\n")
    elif _available_df:
        sys.stderr.write("Available dataset variables: " + ", ".join(_available_df[:10]) + "\\n")
except KeyError as _ke:
    sys.stdout = _old_stdout
    _record_error("KeyError", _ke)
    sys.stderr.write("KeyError: " + str(_ke) + "\\n")
    # Column-truth hint (Jupyter parity): name the actual frame columns so a
    # stale completion or a wrong-dataset assumption is visible at once.
    # Never auto-corrects code — suggestion only (G30).
    try:
        import difflib as _dl2
        _miss = str(_ke).strip("'\\"")
        _cols_all = []
        for _fk in sorted(_user_ns):
            _fv = _user_ns[_fk]
            if isinstance(_fv, pd.DataFrame):
                for _c in list(_fv.columns[:50]):
                    _cs = str(_c)
                    if _cs not in _cols_all:
                        _cols_all.append(_cs)
        if _cols_all:
            _shown = ", ".join(_cols_all[:20])
            if len(_cols_all) > 20:
                _shown += " (+%d more)" % (len(_cols_all) - 20)
            sys.stderr.write("Available columns: " + _shown + "\\n")
            _sug = _dl2.get_close_matches(_miss, _cols_all, n=3, cutoff=0.6)
            if _sug:
                sys.stderr.write("Did you mean: " + ", ".join(_sug) + "?\\n")
    except Exception:
        pass
except Exception as _ex:
    sys.stdout = _old_stdout
    _record_error(type(_ex).__name__, _ex)
    sys.stderr.write(traceback.format_exc())
else:
    sys.stdout = _old_stdout
    _out = _captured.getvalue()
    if _out:
        sys.stdout.write(_out)

# Restore the pre-job cwd: warm-pool workers reuse one interpreter across
# jobs, so a leaked chdir would resolve the next session's relative paths
# against this run's deleted tmpdir (G18). Best-effort; every job chdirs to
# its own dir up front, so a missed restore self-heals on the next run.
try:
    if _PREV_CWD and _os.getcwd() != _PREV_CWD:
        _os.chdir(_PREV_CWD)
except Exception:
    pass

# Session persist + variables snapshot (runs on success AND on error —
# Jupyter keeps partial state when a cell raises). Manifest dataset frames
# (df_* names) are excluded so re-attached data stays fresh; the user's own
# `df` rebinding IS persisted. Oversized frames are skipped (cost guard).
if _ns_path:
    try:
        import pickle as _pickle
        _save = {}
        for _k, _v in _user_ns.items():
            if not isinstance(_k, str) or _k.startswith("_"):
                continue
            if _k in _kernel_provided and _k != "df":
                continue
            try:
                if isinstance(_v, pd.DataFrame) and len(_v) > __POLY_PERSIST_MAX_ROWS__:
                    continue
                # One giant value must never stall every Run's session write.
                _blob = _pickle.dumps(_v)
                if len(_blob) > __POLY_PERSIST_MAX_BYTES__:
                    continue
                _save[_k] = _v
            except Exception:
                continue
        with open(_ns_path, "wb") as _pf:
            _pickle.dump(_save, _pf)
    except Exception as _e:
        sys.stderr.write("Session persist skipped: " + str(_e) + "\\n")

# Variables snapshot for the below-cell inspector (measured metadata only).
_vars = []
try:
    import numpy as _np
except Exception:
    _np = None


def _json_safe(value):
    """Coerce one cell value to JSON-safe form (numpy/NaT/Timestamp/bytes).

    One exotic cell must never kill the whole variables snapshot (G19:
    degrade the value, not the payload).
    """
    try:
        if value is None or isinstance(value, (bool, int, str)):
            return value if not isinstance(value, str) or len(value) <= 200 else value[:197] + "..."
        if isinstance(value, float):
            if value != value or value in (float("inf"), float("-inf")):
                return None
            return value
        if _np is not None and isinstance(value, _np.generic):
            return _json_safe(value.item())
        if _np is not None and isinstance(value, _np.ndarray):
            return "[ndarray " + str(tuple(int(x) for x in value.shape)) + "]"
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if pd.isna(value):
            return None
        if isinstance(value, (bytes, bytearray)):
            return bytes(value).decode("utf-8", errors="replace")[:200]
        if isinstance(value, (list, tuple)):
            return [_json_safe(x) for x in list(value)[:20]]
        if isinstance(value, dict):
            return {str(k)[:64]: _json_safe(x) for k, x in list(value.items())[:20]}
        _r = repr(value)
        return _r if len(_r) <= 200 else _r[:197] + "..."
    except Exception:
        try:
            return repr(value)[:200]
        except Exception:
            return "?"
for _k in sorted(_user_ns):
    if not isinstance(_k, str) or _k.startswith("_"):
        continue
    if _k in ("pd", "workspace", "openfile", "display"):
        continue
    if len(_vars) >= __POLY_VAR_CAP__:
        break
    try:
        _v = _user_ns[_k]
        _t = type(_v).__name__
        _d = ""
        if isinstance(_v, pd.DataFrame):
            _d = str(len(_v)) + " rows × " + str(len(_v.columns)) + " cols"
        elif isinstance(_v, pd.Series):
            _d = "length " + str(len(_v))
        elif _np is not None and isinstance(_v, _np.ndarray):
            _d = "shape " + str(tuple(int(x) for x in _v.shape)) + " " + str(_v.dtype)
        elif isinstance(_v, bool):
            _d = str(_v)
        elif isinstance(_v, (int, float, str)):
            _r = repr(_v)
            _d = _r if len(_r) <= 80 else _r[:77] + "..."
        _entry = {"name": _k, "type": _t, "detail": _d}
        if isinstance(_v, pd.DataFrame):
            # Frame payload for the middle-lane registry: bounded head rows
            # in JSON-safe form (numpy/NaT/bytes coerced — one exotic cell
            # must never kill the whole snapshot).
            _cols = [str(c) for c in list(_v.columns[:20])]
            # Wide frames ship 3 head rows instead of 5 — the inspector
            # shows a preview, and columns × rows is the payload cost.
            _head_src = _v.iloc[:3] if len(_v.columns) > 10 else _v.iloc[:5]
            _head = []
            for _rec in _head_src.to_dict(orient="records"):
                _row = {}
                for _c in _head_src.columns:
                    _row[str(_c)] = _json_safe(_rec[_c])
                _head.append(_row)
            _entry["rows"] = int(len(_v))
            _entry["cols"] = int(len(_v.columns))
            _entry["columns"] = _cols
            _entry["head"] = _head
        _vars.append(_entry)
    except Exception:
        continue
with open(_os.path.join(_os.path.dirname(__file__), "variables.json"), "w", encoding="utf-8") as _vf:
    json.dump(_vars, _vf)

# Jupyter parity: handled user-code errors still exit nonzero so frontends
# key error state off exitCode (execute_reply status error). Session files
# above are already written, so namespace state is preserved like a live
# kernel (partial state on error).
if _failed:
    sys.exit(1)
'''

# Bind module caps into the runner template (plain string: f-strings would
# collide with the template's own braces, so tokens are replaced once).
_RUNNER_TEMPLATE = _RUNNER_TEMPLATE.replace(
    "__POLY_PERSIST_MAX_ROWS__", str(_SESSION_PERSIST_MAX_ROWS)
).replace("__POLY_VAR_CAP__", str(_SESSION_VAR_CAP)).replace(
    "__POLY_PERSIST_MAX_BYTES__", str(_SESSION_PERSIST_MAX_BYTES)
).replace("__POLY_REPR_OUT_MAX_CHARS__", str(_REPR_OUT_MAX_CHARS))

# Out[n] helper module source, staged into every run tmpdir (see
# _execute_python). Strict read: if packaging drops this sibling file the
# cold start must fail loudly, not silently skip Out[n] (G19).
_EXPR_SPLIT_SRC = open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'poly_expr_split.py'),
    encoding='utf-8',
).read()


def _read_variables_file(tmpdir: str) -> list[dict]:
    """Read the runner-written variables snapshot (shared by the classic
    subprocess path and the warm-pool path — one reader, one cap)."""
    try:
        with open(os.path.join(tmpdir, 'variables.json'), encoding='utf-8') as vf:
            loaded = json.load(vf)
        if isinstance(loaded, list):
            return [v for v in loaded if isinstance(v, dict)][:50]
    except Exception:
        pass
    return []


def _read_repr_file(tmpdir: str) -> str | None:
    """Read the runner-written Out[n] last-expression repr (Jupyter
    execute_result parity). Absent/None when the cell had no trailing
    expression value — callers merge additively, never fabricate (G30)."""
    try:
        with open(os.path.join(tmpdir, 'repr_out.json'), encoding='utf-8') as rf:
            loaded = json.load(rf)
        if isinstance(loaded, dict) and isinstance(loaded.get('repr'), str):
            return loaded['repr']
    except Exception:
        pass
    return None


def _read_error_file(tmpdir: str) -> dict:
    """Read the runner-written structured error (ename/evalue). Absent on
    success — callers merge it additively, never fabricate (G30)."""
    try:
        with open(os.path.join(tmpdir, 'error.json'), encoding='utf-8') as ef:
            loaded = json.load(ef)
        if isinstance(loaded, dict):
            ename = loaded.get('ename')
            evalue = loaded.get('evalue')
            if isinstance(ename, str) and isinstance(evalue, str):
                return {'ename': ename, 'evalue': evalue}
    except Exception:
        pass
    return {}


def _execute_python(
    code: str,
    datasets: list[dict],
    session_id: str | None = None,
    uid: str | None = None,
) -> dict:
    """Run Python code in a subprocess with lazy dataset proxies.

    With a session_id the user namespace persists across calls (Jupyter
    kernel model): variables defined in one Run are visible in the next.
    Without one, execution is a single stateless shot (legacy behavior).
    Either way a `variables` snapshot of the final namespace is returned
    for the below-cell inspector.
    """
    safety_error = _check_python_safety(code)
    if safety_error:
        return {
            'stdout': '',
            'stderr': safety_error,
            'exitCode': 1,
            'durationMs': 0,
            'error': safety_error,
            'reprOut': None,
        }

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

        # Out[n] last-expression helper: staged next to runner.py so both
        # engines (runpy warm pool + subprocess) resolve the import and the
        # split logic stays single-source with the test suite (D18).
        expr_split_path = os.path.join(tmpdir, 'poly_expr_split.py')
        with open(expr_split_path, 'w', encoding='utf-8') as f:
            f.write(_EXPR_SPLIT_SRC)

        # Session namespace file: per (uid, session) on disk so it survives
        # across requests; a missing session_id falls back to a tmpdir file
        # (variables snapshot still works, nothing persists).
        _touch_sessions()
        _touch_dataset_cache()
        if session_id:
            ns_path = _session_file(f'{uid or "anon"}::{session_id}')
        else:
            ns_path = os.path.join(tmpdir, 'namespace.pkl')

        # Use a copy of the current environment to avoid breaking Cloud Function dependencies.
        # We inject sys.path so the subprocess inherits the same site-packages (pandas, numpy, etc.).
        clean_env = os.environ.copy()
        clean_env['PYTHONPATH'] = os.pathsep.join(sys.path)
        clean_env['MPLBACKEND'] = 'Agg'
        clean_env['PYTHONIOENCODING'] = 'utf-8'
        clean_env['POLY_NAMESPACE_PATH'] = ns_path
        clean_env['POLY_DATASET_CACHE_DIR'] = _datasets_dir()
        clean_env['TEMP'] = tmpdir
        clean_env['TMP'] = tmpdir
        clean_env['HOME'] = os.environ.get('HOME', tmpdir)
        clean_env['USERPROFILE'] = os.environ.get('USERPROFILE', tmpdir)

        # Warm-pool fast path (default-on unless POLY_WARM_POOL=0): same
        # runner template on a pre-imported interpreter. Narrow catch — any
        # worker fault drops to the classic subprocess path below (single
        # G19 fallback; the subprocess path is the authoritative default).
        try:
            import execute_daemon as _daemon

            _warm_on = _daemon.enabled()
        except ImportError:
            _warm_on = False
        if _warm_on:
            try:
                warm = _daemon.run_warm(
                    runner_path,
                    {
                        'POLY_NAMESPACE_PATH': ns_path,
                        'POLY_DATASET_CACHE_DIR': _datasets_dir(),
                        'TEMP': tmpdir,
                        'TMP': tmpdir,
                        'HOME': os.environ.get('HOME', tmpdir),
                        'USERPROFILE': os.environ.get(
                            'USERPROFILE', tmpdir
                        ),
                    },
                    TIMEOUT_SECONDS,
                )
                duration_ms = int((time.time() - t0) * 1000)
                return {
                    'stdout': warm['stdout'],
                    'stderr': warm['stderr'],
                    'exitCode': warm['exitCode'],
                    'durationMs': duration_ms,
                    'variables': _read_variables_file(tmpdir),
                    'reprOut': _read_repr_file(tmpdir),
                    'engine': 'warm',
                    **_read_error_file(tmpdir),
                }
            except (_daemon.WarmPoolError, OSError):
                pass

        proc = subprocess.run(
            [sys.executable, runner_path],
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            env=clean_env,
            cwd=tmpdir,
            text=True,
        )
        duration_ms = int((time.time() - t0) * 1000)
        variables = _read_variables_file(tmpdir)
        return {
            'stdout': proc.stdout,
            'stderr': proc.stderr,
            'exitCode': proc.returncode,
            'durationMs': duration_ms,
            'variables': variables,
            'reprOut': _read_repr_file(tmpdir),
            'engine': 'subprocess',
            **_read_error_file(tmpdir),
        }
    except subprocess.TimeoutExpired:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': f'Execution timed out after {TIMEOUT_SECONDS}s',
            'exitCode': 124,
            'durationMs': duration_ms,
            'error': 'timeout',
            'reprOut': None,
        }
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1,
            'durationMs': duration_ms,
            'error': str(e),
            'reprOut': None,
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
            except Exception as e:
                raise ValueError("Could not read dataset '" + view_name + "': " + str(e))

        result = con.execute(code)
        rows: list[dict] = []
        try:
            fetched = result.fetchall()
            cols = [d[0] for d in result.description] if result.description else []
            for row in fetched[:MAX_RESULT_ROWS]:
                rows.append(dict(zip(cols, row)))
        except Exception as e:
            raise ValueError("Query ran but results could not be read: " + str(e))

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
            'reprOut': None,
        }
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        return {
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1,
            'durationMs': duration_ms,
            'error': str(e),
            'reprOut': None,
        }


# Handler

def handle_execute(body: dict, uid: str, auth_token: str | None = None) -> dict:
    """Handle a code execution request.

    Expects: { language, code, datasets: [{ uploadId, fileName, storagePath, downloadUrl, workspaceId, workspaceName }] }
    Returns: { stdout, stderr, exitCode, durationMs, variables?, reprOut?, error? }
    """
    language = (body.get('language') or '').lower()
    code = body.get('code') or ''
    raw_datasets = body.get('datasets') or []
    session_id = body.get('sessionId') or None
    if body.get('restartSession') and session_id:
        # Explicit kernel restart: drop the stored namespace (G19: the
        # frontend rotates ids anyway; this covers retry-after-evict).
        try:
            os.remove(_session_file(f'{uid}::{session_id}'))
        except OSError:
            pass

    if not code.strip():
        raise ValueError('No code to execute')

    # Dedup slugs so two workspaces with the same name get unique variable names
    datasets = _dedup_slugs(raw_datasets)

    if language == 'python':
        return _execute_python(code, datasets, session_id, uid)
    elif language in ('sql', 'postgres', 'postgresql', 'mysql'):
        dialect = 'postgres' if language in ('postgres', 'postgresql') else 'mysql' if language == 'mysql' else None
        return _execute_sql(code, datasets, dialect)
    elif language == 'r':
        return _execute_r(code)
    else:
        raise ValueError(f"Unsupported language: {language}. Supported: python, sql, postgres, mysql, r")
