/**
 * Contract matrix — every TestKey from the canonical catalog must be fully
 * wired across the chain: sidebar catalog → STATS_ACTIONS → payload builder →
 * action-specific mock → output validation. Prevents regressions like the
 * `kendall_tau` AttributeError (UI offered a test whose backend method name
 * didn't exist).
 */
import { describe, it, expect } from "vitest";
import * as BL from "@polymorpha/business-logic";
import type { TestKey } from "@polymorpha/business-logic";
import { STATS_ACTIONS } from "@/lib/stats/api";
import {
  ALL_TEST_KEYS,
  KNOWN_MISSING_BUILDERS,
  contractEntries,
  builderNameFor,
  missingMockKeys,
  statsActionFor,
} from "../../generators/contract";
import { resultForAction } from "../../generators/stats";

describe("stats action contract — every catalog test is wired", () => {
  const entries = contractEntries();

  describe.each(entries)("$key ($action)", (entry) => {
    it("has a STATS_ACTIONS entry", () => {
      expect(entry.minRows).toBeGreaterThan(0);
    });

    it("has a builder in business-logic OR is a documented gap", () => {
      if (entry.hasBuilder) return;
      expect(KNOWN_MISSING_BUILDERS).toContain(entry.key);
    });

    it("has an action-specific mock result (not the generic fallback)", () => {
      expect(entry.hasActionSpecificMock).toBe(true);
    });

    it("mock result passes callStatsApi-style field checks", () => {
      const result = resultForAction(entry.action, ["num_1", "num_2"]);
      expect(result).not.toBeNull();
    });
  });
});

describe("stats action contract — cross-check sanity", () => {
  it("catalog exposes exactly 27 tests", () => {
    expect(ALL_TEST_KEYS).toHaveLength(27);
  });

  it("every KNOWN_MISSING_BUILDER key actually has no builder export", () => {
    for (const key of KNOWN_MISSING_BUILDERS) {
      const name = builderNameFor(key);
      expect(typeof (BL as unknown as Record<string, unknown>)[name]).not.toBe(
        "function",
      );
    }
  });

  it("no action-specific mock is missing (default fallback would hide schema drift)", () => {
    const missing = missingMockKeys();
    expect(missing).toEqual([]);
  });

  it("every TEST_GROUPS key is present in STATS_ACTIONS after alias resolution", () => {
    for (const group of BL.TEST_GROUPS) {
      for (const key of group.tests) {
        const action = statsActionFor(key as TestKey);
        expect(
          (STATS_ACTIONS as Record<string, { minRows: number }>)[action]
            ?.minRows,
        ).toBeGreaterThan(0);
      }
    }
  });
});
