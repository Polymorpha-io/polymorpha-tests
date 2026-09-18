"""Tests for the notebook Out[n] last-expression repr (Jupyter parity).

Covers the two layers of the feature:
- `poly_expr_split` (pure split/format helpers, imported by the runner).
- `execute._execute_python` end-to-end wiring (repr_out.json staging,
  template import, `reprOut` merge in both response paths).
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import execute  # noqa: E402
import poly_expr_split  # noqa: E402


# --- split_last_expression (unit) -----------------------------------------


def test_split_bare_expression_is_final():
    prologue, final = poly_expr_split.split_last_expression("x = 40\nx + 2")
    assert final is not None
    assert prologue == "x = 40\n"


def test_split_whole_cell_expression_has_empty_prologue():
    prologue, final = poly_expr_split.split_last_expression("2 + 2")
    assert final is not None
    assert prologue == ""


def test_split_assignment_is_not_final():
    prologue, final = poly_expr_split.split_last_expression("z = 7")
    assert final is None
    assert prologue == "z = 7"


def test_split_trailing_semicolon_suppresses():
    prologue, final = poly_expr_split.split_last_expression("y = 5;\ny + 1;")
    assert final is None


def test_split_syntax_error_returns_code_untouched():
    code = "1 +\n2 +"
    prologue, final = poly_expr_split.split_last_expression(code)
    assert final is None
    assert prologue == code


def test_split_multiline_final_expression_exact_prefix():
    # The prologue must stop at the final node's start — a wrong slice would
    # execute the expression twice (side-effect double-count).
    code = "w = [1, 2, 3]\nsum(\n    w\n)"
    prologue, final = poly_expr_split.split_last_expression(code)
    assert final is not None
    assert prologue == "w = [1, 2, 3]\n"


def test_split_trailing_comment_never_leaks_into_prologue():
    code = "counter = 0\n2 + 2  # answer"
    prologue, final = poly_expr_split.split_last_expression(code)
    assert final is not None
    assert prologue == "counter = 0\n"


# --- format_repr (unit) ----------------------------------------------------


def test_format_repr_plain_value():
    assert poly_expr_split.format_repr("hello") == "'hello'"
    assert poly_expr_split.format_repr(42) == "42"


def test_format_repr_dataframe_head_and_shape():
    pd = pytest.importorskip("pandas")
    out = poly_expr_split.format_repr(pd.DataFrame({"a": [1, 2, 3]}))
    assert "rows x 1 columns" in out
    assert "a" in out


def test_format_repr_series_head():
    pd = pytest.importorskip("pandas")
    out = poly_expr_split.format_repr(pd.Series([10, 20, 30]))
    assert "30" in out


# --- execute._execute_python (integration through the runner template) -----


def run(code: str) -> dict:
    return execute._execute_python(
        code, [], session_id=None, uid="reprout-test"
    )


def test_execute_bare_expression_returns_repr_out():
    r = run("x = 40\nx + 2")
    assert r["exitCode"] == 0
    assert r["reprOut"] == "42"


def test_execute_print_and_expression_both_present():
    r = run("print('hi')\n7 * 6")
    assert r["exitCode"] == 0
    assert r["stdout"].strip() == "hi"
    assert r["reprOut"] == "42"


def test_execute_assignment_only_has_no_repr_out():
    r = run("z = 7")
    assert r["exitCode"] == 0
    assert r["reprOut"] is None


def test_execute_none_value_suppressed():
    r = run("def f():\n    pass\nf()")
    assert r["exitCode"] == 0
    assert r["reprOut"] is None


def test_execute_semicolon_suppressed():
    r = run("y = 5;\ny + 1;")
    assert r["exitCode"] == 0
    assert r["reprOut"] is None


def test_execute_non_expression_last_line_has_no_repr_out():
    r = run("vals = [1, 2, 3]\nfor v in vals:\n    print(v)")
    assert r["exitCode"] == 0
    assert r["reprOut"] is None
    assert r["stdout"].strip() == "1\n2\n3"


def test_execute_dataframe_value_head_shape():
    r = run("import pandas as pd\npd.DataFrame({'a': [1, 2, 3]})")
    assert r["exitCode"] == 0
    assert r["reprOut"] is not None
    assert "rows x 1 columns" in r["reprOut"]


def test_execute_syntax_error_keeps_legacy_error_path():
    r = run("1 +\n2 +")
    assert r["exitCode"] != 0
    assert "SyntaxError" in r["stderr"]
    assert r["reprOut"] is None


def test_execute_error_in_last_expression_surfaces():
    r = run("x = 1\nx + undefined_var")
    assert r["exitCode"] != 0
    assert "NameError" in r["stderr"]


def test_execute_error_response_shape_includes_repr_out_key():
    r = run("raise ValueError('boom')")
    assert "reprOut" in r


def test_execute_expression_runs_exactly_once():
    # Side-effect guard: a bad prologue slice would evaluate the final
    # expression twice (double-exec).
    code = (
        "hits = []\n"
        "class C:\n"
        "    def __add__(self, o):\n"
        "        hits.append(1)\n"
        "        return len(hits)\n"
        "C() + 0"
    )
    r = run(code)
    assert r["exitCode"] == 0
    assert r["reprOut"] == "1"


def test_execute_repr_out_capped():
    r = run("x = 'a' * 100000\nx")
    assert r["exitCode"] == 0
    assert len(r["reprOut"]) <= 20000
