"""Merge pre-flight parity tests (DATA-011) — mirror of ts preflight + cloud guards."""

from polymorpha.dataframe._preflight import (
    MERGE_CONCAT_ALIGN,
    MERGE_CROSS_EXPLOSION,
    MERGE_DTYPE_MISMATCH,
    MERGE_EMPTY_SIDE,
    MERGE_MISSING_KEY,
    Preflight,
    infer_column_kind,
)

LEFT = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]
RIGHT = [{"id": 1, "v": 10}, {"id": 3, "v": 30}]


def test_ok_inner_overlap_and_nulls():
    r = Preflight.merge(
        [{"id": 1, "v": "x"}, {"id": None, "v": "y"}],
        [{"id": 1, "v": 2}],
        on="id",
        how="left",
    )
    assert r["ok"] is True
    assert r["plan"]["overlappingColumns"] == ["v"]
    assert r["plan"]["nullKeysLeft"] == 1
    assert r["plan"]["nullKeysRight"] == 0


def test_missing_key_lists_available():
    r = Preflight.merge(LEFT, RIGHT, on="nope")
    assert r["ok"] is False
    assert r["code"] == MERGE_MISSING_KEY
    assert "Available" in r["message"]


def test_dtype_mismatch_text_vs_numeric():
    r = Preflight.merge(LEFT, [{"id": "1", "v": 5}], on="id")
    assert r["ok"] is False
    assert r["code"] == MERGE_DTYPE_MISMATCH


def test_empty_side():
    assert Preflight.merge(LEFT, [], on="id")["code"] == MERGE_EMPTY_SIDE
    assert Preflight.concat([], [])["code"] == MERGE_EMPTY_SIDE


def test_cross_explosion():
    big = [{"k": i} for i in range(1000)]
    r = Preflight.merge(big, big, how="cross")
    assert r["ok"] is False
    assert r["code"] == MERGE_CROSS_EXPLOSION


def test_cross_small_ok():
    r = Preflight.merge([{"a": 1}], [{"b": 2}], how="cross")
    assert r["ok"] is True


def test_concat_axis1_align():
    r = Preflight.concat(LEFT, [{"a": 1}], axis=1)
    assert r["ok"] is False
    assert r["code"] == MERGE_CONCAT_ALIGN


def test_infer_kind_strict():
    assert infer_column_kind([{"k": 1}, {"k": 2}], "k") == "numeric"
    assert infer_column_kind([{"k": "1"}], "k") == "text"
    assert infer_column_kind([{"k": None}], "k") == "null"
