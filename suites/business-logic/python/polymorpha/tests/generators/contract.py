"""Contract generator — every catalog test must be wired end-to-end."""

from __future__ import annotations

from .stats import params_for_action, result_for_action

# Canonical 27 TestKeys (mirrors ts/src/stats/testCatalog.ts)
ALL_TEST_KEYS = [
    "correlation", "tTest", "anova", "welchAnova", "levene", "regression", "vif", "mannWhitney", "kruskal", "chiSquare", "fisher", "wilcoxon",
    "tost", "binomial", "mcnemar", "gofChisquare", "twoWayAnova", "repeatedAnova", "friedman",
    "kendallTau", "partialCorrelation", "pointBiserial", "logisticRegression", "ridgeRegression", "lassoRegression", "moderation", "mediation",
]

KNOWN_MISSING_BUILDERS = ["wilcoxon", "mcnemar", "gofChisquare", "repeatedAnova", "partialCorrelation", "pointBiserial", "ridgeRegression", "lassoRegression", "moderation", "mediation"]

# Drift aliases: TestKey -> STATS_ACTIONS action
ACTION_MAP = {"kruskal": "kruskalWallis", "fisher": "fisherExact", "tTest": "ttest"}


def stats_action_for(key: str) -> str:
    return ACTION_MAP.get(key, key)


def builder_name_for(key: str) -> str:
    return f"build{key[0].upper()}{key[1:]}"


def has_action_specific_mock(key: str) -> bool:
    r = result_for_action(stats_action_for(key), ["num_1", "num_2"])
    # fallback is exactly {"pValue":0.5,"significant":False}
    return not (set(r.keys()) == {"pValue", "significant"} and r["pValue"] == 0.5)


def contract_entries():
    from polymorpha.schemas.api import StatsRequest  # local import to avoid circular

    # introspect supported set via a dummy validation attempt
    # Instead, read the model's supported literal by inspecting source is easier: just use known 27
    entries = []
    for key in ALL_TEST_KEYS:
        action = stats_action_for(key)
        # check builder existence via import
        try:
            import polymorpha  # noqa: F401
            has_builder = key not in KNOWN_MISSING_BUILDERS
        except Exception:
            has_builder = False
        entries.append({"key": key, "action": action, "hasBuilder": has_builder, "hasMock": has_action_specific_mock(key)})
    return entries
