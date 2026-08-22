/**
 * Contract generator — the interconnecting check that every test offered in
 * the sidebar (TEST_GROUPS) has: a STATS_ACTIONS entry, a payload builder
 * (or a documented gap), and an action-specific mock result. This is the
 * catch-all for the `kendall_tau` AttributeError class of bugs.
 */
import * as BL from "@polymorpha/business-logic";
import type { TestKey } from "@polymorpha/business-logic";
import { STATS_ACTIONS } from "@/lib/stats/api";
import { paramsForAction, resultForAction } from "./stats";

/** PascalCase builder export name for a TestKey, e.g. kendallTau → buildKendallTau. */
export function builderNameFor(key: TestKey): string {
  return `build${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/**
 * Extended tests that intentionally have no `build*` in business-logic
 * `payloadBuilders` yet — they run via the generic parity loop in testsRunner.
 * If a builder is added upstream, the contract test FAILS until this list is
 * updated (fail loud instead of silently drifting).
 */
export const KNOWN_MISSING_BUILDERS: readonly TestKey[] = [
  "wilcoxon",
  "mcnemar",
  "gofChisquare",
  "repeatedAnova",
  "partialCorrelation",
  "pointBiserial",
  "ridgeRegression",
  "lassoRegression",
  "moderation",
  "mediation",
];

/** Canonical STATS_ACTIONS action for a TestKey (drift names resolved). */
export function statsActionFor(key: TestKey): string {
  const actionMap: Partial<Record<TestKey, string>> = {
    kruskal: "kruskalWallis",
    fisher: "fisherExact",
    tTest: "ttest",
    wilcoxon: "wilcoxon",
  };
  return actionMap[key] ?? key;
}

export interface ContractEntry {
  key: TestKey;
  action: string;
  builderName: string;
  hasBuilder: boolean;
  minRows: number;
  hasActionSpecificMock: boolean;
}

/** Whether resultForAction returned a real shape rather than the fallback. */
function hasActionSpecificMock(key: TestKey): boolean {
  const result = resultForAction(statsActionFor(key), ["num_1", "num_2"]);
  const keys = Object.keys(result as Record<string, unknown>);
  // The default fallback only has pValue/significant — everything else is a
  // deliberate shape that validateOutput can enforce.
  return keys.length !== 2 || !("pValue" in result!);
}

/** Build the contract table for all 27 catalog keys. */
export function contractEntries(): ContractEntry[] {
  return (Object.keys(BL.TEST_META) as TestKey[]).map((key) => {
    const action = statsActionFor(key);
    const builderName = builderNameFor(key);
    const meta = (
      STATS_ACTIONS as Record<string, { minRows: number } | undefined>
    )[action];
    return {
      key,
      action,
      builderName,
      hasBuilder:
        typeof (BL as unknown as Record<string, unknown>)[builderName] ===
        "function",
      minRows: meta?.minRows ?? 0,
      hasActionSpecificMock: hasActionSpecificMock(key),
    };
  });
}

/** Every key that is missing a mock — the default `{pValue}` fallback shape. */
export function missingMockKeys(): TestKey[] {
  return contractEntries()
    .filter((e) => !e.hasActionSpecificMock)
    .map((e) => e.key);
}

/** All 27 keys from the canonical catalog. */
export const ALL_TEST_KEYS: readonly TestKey[] = Object.keys(
  BL.TEST_META,
) as TestKey[];

export { paramsForAction };
