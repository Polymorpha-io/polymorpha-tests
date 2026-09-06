"""Central tests for StellaRagProfiler.to_knowledge_records (G22 suite owner: suites/stella).

Covers the thin adapter business-logic profile dict -> KnowledgeRecord dicts:
kinds emitted, deterministic sourceHash ids, provenance shape, empty input.
Uses a hand-built profile dict (no pandas needed for this path).
"""

from polymorpha_stella.rag import StellaRagProfiler


def _profile():
    return {
        "dataset": {"rows": 100, "cols": 3, "duplicatePct": 5.0, "duplicateRows": 5},
        "perColumn": [
            {"name": "age", "type": "numeric", "unique": 90, "missingPct": 2.0,
             "topK": [{"value": 30}, {"value": 40}]},
            {"name": "city", "type": "categorical", "unique": 10, "missingPct": 0.0,
             "topK": [{"value": "Berlin"}, {"value": "Paris"}]},
        ],
        "missing": {"missingTogether": [{"a": "age", "b": "city", "correlation": 0.75}]},
        "duplicate": None,
        "quality": None,
    }


def _records():
    prof = StellaRagProfiler.__new__(StellaRagProfiler)  # skip RagProfiler init
    return prof.to_knowledge_records(
        _profile(), workspace_id="ws1", dataset_id="up1",
        dataset_name="sales.csv", content_hash="ch1",
    )


def test_emits_profile_column_and_relationship_kinds():
    kinds = sorted(r["kind"] for r in _records())
    assert kinds == ["column_semantic", "column_semantic", "dataset_profile", "relationship"]


def test_ids_and_hashes_deterministic():
    first = _records()
    second = _records()
    assert [r["id"] for r in first] == [r["id"] for r in second]
    assert [r["sourceHash"] for r in first] == [r["sourceHash"] for r in second]
    assert all(len(r["sourceHash"]) == 16 for r in first)


def test_provenance_shape():
    for r in _records():
        assert r["workspaceId"] == "ws1"
        assert r["provenance"]["datasetIds"] == ["up1"]
        assert r["provenance"]["contentHash"] == "ch1"


def test_empty_profile_yields_no_records():
    prof = StellaRagProfiler.__new__(StellaRagProfiler)
    assert prof.to_knowledge_records({}, workspace_id="ws1", dataset_id="up1") == []
