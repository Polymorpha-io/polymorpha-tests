import { describe, it, expect } from "vitest";
import {
  columnBlurb,
  countValue,
  distinctValues,
  enrichPaletteCtx,
  DISTINCT_CAP,
  PEEK_MAX_ROWS,
} from "@/components/NotebookWorkbench/palettes/columnMeta";
import type { Row } from "@/types";

function rows(n: number, fn: (i: number) => Record<string, unknown>): Row[] {
  return Array.from({ length: n }, (_, i) => fn(i) as Row);
}

const BASE = {
  columns: ["age", "city"],
  numeric: ["age"],
  categorical: ["city"],
  fileBase: "t",
};
const COLS = [
  { name: "age", type: "numeric" },
  { name: "city", type: "categorical" },
];

describe("columnMeta", () => {
  it("blurbs numeric columns with mean ± sd + missing", () => {
    const data = rows(4, (i) => ({ age: [10, 20, 30, null][i], city: "A" }));
    const ctx = enrichPaletteCtx(BASE, COLS, data);
    expect(columnBlurb(ctx.meta.age)).toBe(
      "numeric · n=3 · mean 20 ± 10 · missing 25%",
    );
  });

  it("blurbs categorical columns with top values", () => {
    const data = rows(5, (i) => ({
      age: 1,
      city: ["A", "A", "A", "B", ""][i],
    }));
    const ctx = enrichPaletteCtx(BASE, COLS, data);
    expect(columnBlurb(ctx.meta.city)).toBe(
      "categorical · n=4 · top A (3), B (1) · missing 20%",
    );
  });

  it("degrades honestly with no rows", () => {
    const ctx = enrichPaletteCtx(BASE, COLS, []);
    expect(columnBlurb(ctx.meta.age)).toContain("n=0");
    expect(ctx.distinct("age")).toEqual([]);
    expect(ctx.countValue("age", "x")).toEqual({ n: 0, pct: 0 });
  });

  it("caps distinct values and peek rows", () => {
    const data = rows(300, (i) => ({ age: i, city: `c${i}` }));
    const ctx = enrichPaletteCtx(BASE, COLS, data);
    expect(ctx.distinct("city").length).toBeLessThanOrEqual(DISTINCT_CAP);
    const big = enrichPaletteCtx(
      BASE,
      COLS,
      rows(PEEK_MAX_ROWS + 100, (i) => ({ age: i, city: "x" })),
    );
    expect(big.meta.age.n).toBe(PEEK_MAX_ROWS);
    expect(big.peekNote).toContain("peek of first");
  });

  it("counts values for columnValue blurbs", () => {
    const data = rows(4, (i) => ({ age: 1, city: ["A", "A", "B", "B"][i] }));
    const ctx = enrichPaletteCtx(BASE, COLS, data);
    expect(ctx.countValue("city", "A")).toEqual({ n: 2, pct: 50 });
  });

  it("never emits undefined", () => {
    const data = rows(2, () => ({ age: undefined, city: null }));
    const ctx = enrichPaletteCtx(BASE, COLS, data);
    for (const m of Object.values(ctx.meta)) {
      expect(columnBlurb(m)).not.toContain("undefined");
    }
    expect(columnBlurb(undefined)).not.toContain("undefined");
  });
});

describe("distinctValues", () => {
  it("keeps first-seen order and skips empties", () => {
    const data = rows(5, (i) => ({ c: ["b", "", "a", "b", null][i] }));
    expect(distinctValues(data as Row[], "c")).toEqual(["b", "a"]);
  });
});
