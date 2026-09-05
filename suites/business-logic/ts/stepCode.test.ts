import { describe, it, expect } from "vitest";
import {
  stepToPython,
  pythonToStep,
  isCellEditable,
  sourceToPython,
  notebookToPython,
} from "@polymorpha/business-logic";
import type { StepCodeInput } from "@polymorpha/business-logic";

/**
 * [POLY-CELLS] Round-trip parity for the notebook cell codec.
 * Law: parse(generate(cfg)) deep-equals cfg up to documented normalizations
 * (average→mean, full→outer, count-aggs regroup on group key, legacy single
 * having→array, merge aliases→canonical keys). Config literals below use the
 * real polymorpha UI shapes (array having, scalar/array by, merge aliases).
 */

function roundTrip(
  label: string,
  config: StepCodeInput,
  normalized?: StepCodeInput,
) {
  const gen = stepToPython(config);
  expect(gen.editable, `${label}: editable`).toBe(true);
  const back = pythonToStep(gen.code, config);
  expect(back.ok, `${label}: parses — ${back.ok ? "" : back.error}`).toBe(true);
  if (back.ok) {
    expect(back.config, `${label}: round-trip`).toEqual(normalized ?? config);
  }
}

describe("stepToPython/pythonToStep round-trip", () => {
  it("query basic + quotes", () => {
    roundTrip("query", { type: "query", expr: "price > 50000" });
    roundTrip("query quotes", {
      type: "query",
      expr: 'region == "R ""prime"""',
    });
  });

  it("sort scalar/array/default", () => {
    roundTrip("sort scalar desc", {
      type: "sort",
      by: "price",
      ascending: false,
    });
    roundTrip("sort multi default", { type: "sort", by: ["a", "b"] });
    roundTrip("sort multi flags", {
      type: "sort",
      by: ["a", "b"],
      ascending: [true, false],
    });
  });

  it("sort bracketed columns", () => {
    roundTrip("sort brackets", {
      type: "sort",
      by: ["price[USD]", "a]b"],
      ascending: [true, false],
    });
  });

  it("group count/having/normalizations", () => {
    roundTrip(
      "group legacy single having normalizes to array",
      {
        type: "group",
        groupByCols: ["waterfront"],
        aggregations: [
          { newColumn: "n", operation: "count" },
          { newColumn: "price_mean", operation: "mean", targetColumn: "price" },
        ],
        having: { column: "n", operator: "gt", value: 10 },
      },
      {
        type: "group",
        groupByCols: ["waterfront"],
        aggregations: [
          { newColumn: "n", operation: "count" },
          { newColumn: "price_mean", operation: "mean", targetColumn: "price" },
        ],
        having: [{ column: "n", operator: "gt", value: 10 }],
      },
    );
    roundTrip("group multi-having array", {
      type: "group",
      groupByCols: ["waterfront"],
      aggregations: [{ newColumn: "n", operation: "count" }],
      having: [
        { column: "n", operator: "gt", value: 10 },
        { column: "price_mean", operator: "lte", value: 500000 },
      ],
    });
    roundTrip(
      "group average normalizes to mean",
      {
        type: "group",
        groupByCols: ["view"],
        aggregations: [
          { newColumn: "x", operation: "average", targetColumn: "price" },
        ],
      },
      {
        type: "group",
        groupByCols: ["view"],
        aggregations: [
          { newColumn: "x", operation: "mean", targetColumn: "price" },
        ],
      },
    );
    roundTrip("group distinctList", {
      type: "group",
      groupByCols: ["region"],
      aggregations: [
        { newColumn: "areas", operation: "distinctList", targetColumn: "area" },
      ],
    });
    roundTrip("group bracketed keys", {
      type: "group",
      groupByCols: ["band[0]"],
      aggregations: [{ newColumn: "n", operation: "count" }],
    });
  });

  it("merge canonical + legacy aliases", () => {
    roundTrip("merge left", {
      type: "merge",
      source: { type: "workspace", uploadId: "abc123" },
      joinType: "left",
      leftKey: "district",
      rightKey: "district",
      behavior: "expand",
    });
    roundTrip(
      "merge full normalizes to outer",
      {
        type: "merge",
        source: { type: "api", url: "https://x.test/d.csv" },
        joinType: "full",
        leftKey: "a",
        rightKey: "b",
        behavior: "expand",
      },
      {
        type: "merge",
        source: { type: "api", url: "https://x.test/d.csv" },
        joinType: "full",
        leftKey: "a",
        rightKey: "b",
        behavior: "expand",
      },
    );
    roundTrip(
      "merge legacy aliases normalize",
      {
        type: "merge",
        source: { type: "workspace", uploadId: "u1" },
        leftOn: "a",
        rightOn: "b",
        how: "left",
      },
      {
        type: "merge",
        source: { type: "workspace", uploadId: "u1" },
        leftKey: "a",
        rightKey: "b",
        joinType: "left",
      },
    );
  });

  it("getDummies full/bare/bracketed", () => {
    roundTrip("getDummies full", {
      type: "getDummies",
      columns: ["view", "grade"],
      prefixSep: "_",
      dropFirst: true,
    });
    roundTrip("getDummies bare", { type: "getDummies" });
    roundTrip("getDummies brackets", {
      type: "getDummies",
      columns: ["x[y]"],
    });
  });

  it("accepts whitespace reformatting", () => {
    const back = pythonToStep(
      `df = df.sort_values(\n  by=['a', 'b'],\n  ascending=[True, False]\n)`,
      { type: "sort", by: ["x"] },
    );
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.config).toEqual({
        type: "sort",
        by: ["a", "b"],
        ascending: [true, false],
      });
    }
  });

  it("applies parameter edits within the family", () => {
    const back = pythonToStep(`df = df.query('price >= 100')`, {
      type: "query",
      expr: "price > 50000",
    });
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.config).toEqual({
        type: "query",
        expr: "price >= 100",
      });
    }
  });
});

describe("pythonToStep rejections (fail inline, config untouched)", () => {
  const q: StepCodeInput = { type: "query", expr: "price > 50000" };
  const cases: Array<[string, string, RegExp]> = [
    ["empty", "   ", /empty/],
    ["cross-op", `df = df.sort_values(by='price')`, /query/],
    [
      "multi-statement",
      `df = df.query('a > 1')\ndf = df.query('b > 2')`,
      /parameter edits/,
    ],
    ["import", `import os\ndf = df.query('a > 1')`, /parameter edits/],
    [
      "bad having",
      `df = df.groupby(['w']).agg(n=('w', 'size')).reset_index().query('oops')`,
      /Having filter/,
    ],
    [
      "bad how",
      `df = pd.merge(df, other, left_on='a', right_on='b', how='sideways')`,
      /how must be/,
    ],
  ];
  for (const [label, source, hint] of cases) {
    it(`rejects: ${label}`, () => {
      const cfg: StepCodeInput =
        label === "bad having"
          ? {
              type: "group",
              groupByCols: ["w"],
              aggregations: [{ newColumn: "n", operation: "count" }],
            }
          : label === "bad how"
            ? {
                type: "merge",
                source: { type: "workspace" },
                joinType: "left",
                leftKey: "a",
                rightKey: "b",
                behavior: "expand",
              }
            : q;
      const back = pythonToStep(source, cfg);
      expect(back.ok).toBe(false);
      if (!back.ok) expect(back.error).toMatch(hint);
    });
  }
});

describe("capability map + chain export", () => {
  it("editable families vs view-only fallback", () => {
    for (const t of ["query", "sort", "group", "merge", "getDummies"]) {
      expect(isCellEditable(t)).toBe(true);
    }
    for (const t of ["fuzzyMatch", "balance", "pivot", "note"]) {
      expect(isCellEditable(t)).toBe(false);
    }
    const fb = stepToPython({ type: "fuzzyMatch", column: "name" });
    expect(fb.editable).toBe(false);
    expect(fb.note ?? "").toMatch(/fuzzyMatch/);
    expect(pythonToStep("whatever", { type: "fuzzyMatch" }).ok).toBe(false);
  });

  it("incomplete configs degrade, never crash", () => {
    for (const cfg of [
      { type: "query" },
      { type: "sort", by: [] },
      { type: "group", groupByCols: ["a"], aggregations: [] },
      { type: "merge", behavior: "expand" },
      { type: "mystery-op", foo: 1 },
    ]) {
      expect(stepToPython(cfg).editable).toBe(false);
    }
  });

  it("source + notebook export", () => {
    expect(sourceToPython("housing.csv")).toBe(
      `df = pd.read_csv("housing.csv")`,
    );
    const nb = notebookToPython([
      {
        title: "Load housing.csv",
        code: `df = pd.read_csv("housing.csv")`,
        output: "690 rows × 14 cols",
      },
      { title: "Filter", code: `df = df.query('price > 50000')` },
    ]);
    expect(nb).toMatch(/Cell 1 · Load housing\.csv/);
    expect(nb).toMatch(/# Out: 690 rows/);
  });
});
