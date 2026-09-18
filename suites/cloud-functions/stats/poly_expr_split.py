"""Jupyter Out[n] last-expression support for the execute runner.

Imported by the inlined runner template (both the classic subprocess and the
warm-pool path stage this module next to runner.py, so `import` resolves via
the script dir on sys.path) and by the central test suite directly — one
implementation, never duplicated (D18/G15).
"""

import ast


def split_last_expression(code: str):
    """Split `code` into (prologue, final_expr_node).

    Jupyter parity: only a trailing bare expression produces an Out[n] value.
    Returns final_expr_node=None (and code untouched) when the cell has no
    displayable trailing expression — assignment, trailing `;`, or a
    SyntaxError, which the caller must run as plain exec so error reporting
    stays byte-identical with the pre-Out[n] behavior.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return code, None
    if not tree.body or not isinstance(tree.body[-1], ast.Expr):
        return code, None
    if code.rstrip().endswith(";"):
        return code, None
    final = tree.body[-1]
    # Slice by node start position (not get_source_segment): a trailing
    # comment or a multi-line final expression would otherwise leave the
    # expression itself inside the prologue and execute it twice.
    lines = code.splitlines(keepends=True)
    start_idx = final.lineno - 1
    prefix = "".join(lines[:start_idx])
    if start_idx < len(lines):
        prefix += lines[start_idx][: final.col_offset]
    return prefix, final


def format_repr(value) -> str:
    """Text/plain rendering of an Out[n] value.

    DataFrames/Series render head + shape like the runner's display() shim;
    everything else uses repr(). Any formatting fault falls back to repr()
    — never fabricate, never raise (G19/G30).
    """
    try:
        import pandas as pd

        if isinstance(value, pd.DataFrame):
            return value.head(10).to_string() + "\n[%d rows x %d columns]" % (
                len(value),
                len(value.columns),
            )
        if isinstance(value, pd.Series):
            return value.head(10).to_string()
    except Exception:
        pass
    return repr(value)
