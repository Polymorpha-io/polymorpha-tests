"""Generated contract matrix — every catalog test must be wired."""

import pytest

from polymorpha.tests.generators.contract import ALL_TEST_KEYS, KNOWN_MISSING_BUILDERS, contract_entries, stats_action_for
from polymorpha.tests.generators.stats import result_for_action


@pytest.mark.parametrize("key", ALL_TEST_KEYS, ids=lambda k: k)
def test_has_action_specific_mock(key):
    r = result_for_action(stats_action_for(key), ["num_1", "num_2"])
    assert not (set(r.keys()) == {"pValue", "significant"} and r.get("pValue") == 0.5), f"{key} missing mock"


def test_catalog_is_27():
    assert len(ALL_TEST_KEYS) == 27


def test_known_missing_builders_are_documented():
    assert len(KNOWN_MISSING_BUILDERS) == 10


@pytest.mark.parametrize("entry", contract_entries(), ids=lambda e: e["key"])
def test_entry_has_builder_or_is_known_missing(entry):
    if entry["hasBuilder"]:
        return
    assert entry["key"] in KNOWN_MISSING_BUILDERS
