"""Business-logic test generators — deterministic, seed-driven."""

from .seed import hash_string, mulberry32
from .dataset import make_dataset, make_numeric_dataset, presets
from .matrix import cartesian
from .stats import params_for_action, result_for_action
from .contract import ALL_TEST_KEYS, KNOWN_MISSING_BUILDERS, contract_entries

__all__ = ["hash_string", "mulberry32", "make_dataset", "presets", "cartesian", "params_for_action", "result_for_action", "contract_entries", "ALL_TEST_KEYS"]
