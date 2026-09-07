import { describe, it, expect } from "vitest";
import {
  preflightMerge,
  preflightConcat,
  describeSuffixPlan,
  inferColumnKind,
  MERGE_CROSS_CELL_LIMIT,
  MERGE_MISSING_KEY,
  MERGE_DTYPE_MISMATCH,
  MERGE_EMPTY_SIDE,
  MERGE_CROSS_EXPLOSION,
  MERGE_CONCAT_ALIGN,
} from "@polymorpha/business-logic";

/**
 * [POLY-DATA] MergePreflight upstream contract (DATA-011/013).
 * Single source of truth: ts/src/core/mergePreflight.ts (+ Python mirror
 * python/polymorpha/dataframe/_preflight.py). Polymorpha, cloud-functions,
 * and these tests all assert the same stable MERGE_* codes.
 */

const LEFT = [
  { id: 1, name: "a" },
  { id: 2, name: "b" },
];
const RIGHT = [
  { id: 1, v: 10 },
  { id: 3, v: 30 },
];

describe("preflightMerge", () => {
  it("ok inner with overlap + null counts", () => {
    const r = preflightMerge(
      {
        leftRows: [
          { id: 1, v: "x" },
          { id: null, v: "y" },
        ],
        rightRows: [{ id: 1, v: 2 }],
        on: "id",
        how: "left",
      },
      "merge",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.overlappingColumns).toEqual(["v"]);
      expect(r.plan.nullKeysLeft).toBe(1);
      expect(r.plan.nullKeysRight).toBe(0);
    }
  });

  it("missing key names available columns", () => {
    const r = preflightMerge({ leftRows: LEFT, rightRows: RIGHT, on: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe(MERGE_MISSING_KEY);
      expect(r.message).toContain("Available:");
    }
  });

  it("strict dtype: text key vs numeric key mismatches", () => {
    const r = preflightMerge({
      leftRows: LEFT,
      rightRows: [{ id: "1", v: 5 }],
      on: "id",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(MERGE_DTYPE_MISMATCH);
  });

  it("empty side fails", () => {
    const r = preflightMerge({ leftRows: LEFT, rightRows: [], on: "id" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(MERGE_EMPTY_SIDE);
  });

  it("cross explosion guarded by MERGE_CROSS_CELL_LIMIT", () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ k: i }));
    const r = preflightMerge({ leftRows: big, rightRows: big, how: "cross" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(MERGE_CROSS_EXPLOSION);
    expect(MERGE_CROSS_CELL_LIMIT).toBe(500_000);
  });

  it("custom left/right keys resolve independently", () => {
    const r = preflightMerge({
      leftRows: [{ a: 1 }],
      rightRows: [{ b: 1 }],
      leftOn: "a",
      rightOn: "b",
    });
    // Both keys exist and kinds agree (numeric/numeric) → ok.
    expect(r.ok).toBe(true);
  });
});

describe("preflightConcat", () => {
  it("axis-1 row mismatch fails positionally", () => {
    const r = preflightConcat({
      leftRows: LEFT,
      rightRows: [{ a: 1 }],
      axis: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(MERGE_CONCAT_ALIGN);
  });

  it("both empty fails", () => {
    const r = preflightConcat({ leftRows: [], rightRows: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(MERGE_EMPTY_SIDE);
  });
});

describe("describeSuffixPlan + inferColumnKind", () => {
  it("suffix plan is deterministic left→_x right→_y", () => {
    expect(describeSuffixPlan(["v", "w"])).toBe("v → v_x, v_y; w → w_x, w_y");
    expect(describeSuffixPlan([])).toBeNull();
  });

  it("kind inference is strict (no numeric-string coercion)", () => {
    expect(inferColumnKind([{ k: 1 }], "k")).toBe("numeric");
    expect(inferColumnKind([{ k: "1" }], "k")).toBe("text");
    expect(inferColumnKind([{ k: null }], "k")).toBe("null");
  });
});
