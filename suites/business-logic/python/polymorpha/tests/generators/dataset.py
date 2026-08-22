"""Dataset generator — deterministic rows + columns for pytest."""

from __future__ import annotations

from typing import Any

from .seed import hash_string, mulberry32, pick, rand_int, rand_normal, sample_indices

CATEGORY_VOCAB = ["Control", "DrugA", "DrugB", "Placebo", "red", "green", "blue", "A", "B", "C", "D", "low", "medium", "high"]
TEXT_VOCAB = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"]


def _make_value(spec: dict, rand, missing_pct: float) -> Any:
    if rand() < missing_pct:
        return None
    t = spec["type"]
    if t == "numeric":
        dist = spec.get("dist", "normal")
        raw = (2.718 ** (rand_normal(rand) * 0.6 + rand() * 1.5)) if dist == "skewed" else (20 + rand_normal(rand) * 10)
        return round(raw * 100) / 100
    if t == "categorical":
        vocab = CATEGORY_VOCAB[: spec.get("cardinality", 3)]
        return pick(rand, vocab if vocab else CATEGORY_VOCAB)
    if t == "date":
        y, m, d = rand_int(rand, 2018, 2026), rand_int(rand, 1, 12), rand_int(rand, 1, 28)
        return f"{y}-{m:02d}-{d:02d}"
    if t == "boolean":
        return rand() < 0.5
    return pick(rand, TEXT_VOCAB)


def make_dataset(
    cols: list[dict],
    rows: int = 5,
    missing_pct: float = 0.0,
    outlier_pct: float = 0.0,
    seed: Any = "dataset",
    file_name: str = "generated.csv",
) -> dict:
    """Return {fileName, columns, rows} — columns have name/type/detectedType."""
    if isinstance(seed, str):
        seed = hash_string(seed)
    rand = mulberry32(int(seed))
    columns = [{"name": c["name"], "type": c["type"], "detectedType": c["type"]} for c in cols]
    names = [c["name"] for c in columns]
    numeric_names = [c["name"] for c, s in zip(columns, cols) if s["type"] == "numeric"]
    rows_out: list[dict] = []
    for _ in range(rows):
        row: dict[str, Any] = {}
        for spec in cols:
            row[spec["name"]] = _make_value(spec, rand, spec.get("missingPct", missing_pct))
        rows_out.append(row)
    if outlier_pct > 0 and numeric_names:
        target = int(len(rows_out) * len(numeric_names) * outlier_pct)
        cells = sample_indices(rand, len(rows_out) * len(numeric_names), target)
        for idx in cells:
            r, c = divmod(idx, len(numeric_names))
            col = numeric_names[c]
            cur = rows_out[r][col]
            if isinstance(cur, (int, float)):
                rows_out[r][col] = cur * 20 + 500
    return {"fileName": file_name, "columns": columns, "rows": rows_out}


def make_numeric_dataset(col_count: int = 2, row_count: int = 20, **kw) -> dict:
    return make_dataset([{"name": f"num_{i+1}", "type": "numeric"} for i in range(col_count)], rows=row_count, **kw)


def make_rows(n: int = 6, seed: Any = "rows") -> list[dict]:
    """Simple rows helper for stats tests — mirrors SIMPLE_ROWS shape."""
    ds = make_dataset(
        [{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}, {"name": "g", "type": "categorical", "cardinality": 3}],
        rows=n,
        seed=seed,
    )
    return ds["rows"]


# Presets — mirrors tests/generators/dataset.ts
def _preset_minimal():
    return make_dataset([{"name": "x", "type": "numeric"}, {"name": "y", "type": "numeric"}], rows=5, seed="minimal", file_name="minimal.csv")


def _preset_mixed():
    return make_dataset(
        [{"name": "name", "type": "categorical", "cardinality": 4}, {"name": "age", "type": "numeric"}, {"name": "score", "type": "numeric"}, {"name": "active", "type": "boolean"}],
        rows=8, seed="mixed", file_name="mixed.csv",
    )


def _preset_anova():
    return make_dataset(
        [{"name": "treatment", "type": "categorical", "cardinality": 3}, {"name": "response", "type": "numeric"}, {"name": "block", "type": "categorical", "cardinality": 2}],
        rows=12, seed="anova", file_name="anova.csv",
    )


def _preset_correlation(numeric: int = 3):
    return make_dataset([{"name": f"num_{i+1}", "type": "numeric"} for i in range(numeric)], rows=20, seed="correlation", file_name="correlation.csv")


def _preset_missing():
    return make_dataset([{"name": "id", "type": "numeric"}, {"name": "category", "type": "categorical", "cardinality": 3}, {"name": "price", "type": "numeric"}], rows=10, missing_pct=0.3, seed="missing", file_name="missing.csv")


def _preset_large(rows: int = 100):
    return make_dataset(
        [{"name": "id", "type": "numeric"}, {"name": "category", "type": "categorical", "cardinality": 5}, {"name": "value_a", "type": "numeric"}, {"name": "value_b", "type": "numeric", "dist": "skewed"}, {"name": "flag", "type": "boolean"}],
        rows=rows, missing_pct=0.05, seed="large", file_name="large.csv",
    )


def _df_final_cols():
    return [
        {"name": "Name", "type": "categorical", "cardinality": 30},
        {"name": "Sex", "type": "categorical", "cardinality": 2},
        {"name": "Age", "type": "numeric"},
        {"name": "Height", "type": "numeric"},
        {"name": "Weight", "type": "numeric"},
        {"name": "Team", "type": "categorical", "cardinality": 30},
        {"name": "Year", "type": "numeric"},
        {"name": "Season", "type": "categorical", "cardinality": 2},
        {"name": "Host_City", "type": "categorical", "cardinality": 10},
        {"name": "Host_Country", "type": "categorical", "cardinality": 10},
        {"name": "Sport", "type": "categorical", "cardinality": 15},
        {"name": "Event", "type": "categorical", "cardinality": 30},
        {"name": "GDP_Per_Capita_Constant_LCU_Value", "type": "numeric", "dist": "skewed"},
        {"name": "Cereal_yield_kg_per_hectare_Value", "type": "numeric"},
        {"name": "Military_expenditure_current_LCU_Value", "type": "numeric", "dist": "skewed"},
        {"name": "Tax_revenue_current_LCU_Value", "type": "numeric", "dist": "skewed"},
        {"name": "Expense_current_LCU_Value", "type": "numeric", "dist": "skewed"},
        {"name": "Central_government_debt_total_current_LCU_Value", "type": "numeric", "dist": "skewed"},
        {"name": "Representing_Host", "type": "numeric"},
        {"name": "Avg_Temp", "type": "numeric"},
        {"name": "Medal", "type": "numeric"},
        {"name": "Medal_Binary", "type": "numeric"},
    ]


def _preset_df_final(rows: int = 200):
    return make_dataset(_df_final_cols(), rows=rows, seed="df_final", file_name="df_final_features.csv")


def _preset_df_final_30k():
    return make_dataset(_df_final_cols(), rows=30000, seed="df_final_30k", file_name="df_final_features.csv")


presets = {
    "minimal": _preset_minimal,
    "mixed": _preset_mixed,
    "anova": _preset_anova,
    "correlation": _preset_correlation,
    "missing": _preset_missing,
    "large": _preset_large,
    "df_final": _preset_df_final,
    "df_final_30k": _preset_df_final_30k,
}
