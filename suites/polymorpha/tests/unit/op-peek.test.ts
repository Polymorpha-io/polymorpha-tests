import { describe, expect, it } from "vitest";
import { computeOpPeek } from "@/components/DataPreview/modeller/opPeek";
import type { DataOperationStepConfig } from "@/types";

const ROWS = [
  { city: "Paris", price: 10 },
  { city: "London", price: 30 },
  { city: "Paris", price: 20 },
  { city: "Rome", price: 40 },
  { city: "London", price: 50 },
  { city: "Oslo", price: 60 },
];

function peek(
  cfg: DataOperationStepConfig,
  rows = ROWS,
  extras?: { otherRows?: typeof ROWS },
) {
  return computeOpPeek(rows, cfg, extras);
}

describe("computeOpPeek", () => {
  it("sorts by column and shows sorted head", () => {
    const p = peek({ type: "sort", by: "price", ascending: true } as never);
    expect(p?.after.headers).toContain("price");
    expect(p?.after.rows[0]?.[0]).toBe("10");
    expect(p?.note).toMatch(/sorted by price/);
  });

  it("drops a column", () => {
    const p = peek({ type: "drop", column: "city" } as never);
    expect(p?.before.headers).toContain("city");
    expect(p?.after.headers).not.toContain("city");
  });

  it("renames a column header", () => {
    const p = peek({
      type: "rename",
      column: "city",
      newName: "town",
    } as never);
    expect(p?.after.headers).toContain("town");
    expect(p?.after.rows[0]?.[0]).toBe("Paris");
  });

  it("replaces substrings", () => {
    const p = peek({
      type: "replace",
      column: "city",
      toReplace: "o",
      value: "0",
      regex: false,
    } as never);
    expect(p?.after.rows[1]?.[0]).toBe("L0nd0n");
  });

  it("factorizes to first-seen codes with _code column", () => {
    const p = peek({ type: "factorize", column: "city" } as never);
    expect(p?.after.headers).toEqual(["city_code"]);
    expect(p?.after.rows.map((r) => r[0])).toEqual(["0", "1", "0", "2", "1"]);
  });

  it("queries with a simple expression", () => {
    const p = peek({ type: "query", expr: "price > 25" } as never);
    expect(p?.after.rows.length).toBe(4);
    expect(p?.note).toMatch(/4 of 6 rows match/);
  });

  it("returns null for unparseable query expressions", () => {
    expect(peek({ type: "query", expr: "drop table x" } as never)).toBeNull();
  });

  it("topN takes the largest", () => {
    const p = peek({
      type: "topN",
      column: "price",
      n: 2,
      largest: true,
    } as never);
    expect(p?.after.rows.map((r) => r[0])).toEqual(["60", "50"]);
  });

  it("shifts with leading blanks", () => {
    const p = peek({ type: "shift", column: "price", periods: 1 } as never);
    expect(p?.after.headers).toEqual(["price_shift_1"]);
    expect(p?.after.rows[0]?.[0]).toBe("—");
    expect(p?.after.rows[1]?.[0]).toBe("10");
  });

  it("getDummies delegates with dropFirst", () => {
    const p = peek(
      {
        type: "getDummies",
        columns: ["city"],
        prefixSep: "_",
        dropFirst: true,
      } as never,
      ROWS.slice(0, 3),
    );
    expect(p?.after.headers).toEqual(["city_London"]);
    expect(p?.after.rows).toEqual([["0"], ["1"], ["0"]]);
  });

  it("concat stacks other rows", () => {
    const p = peek({ type: "concat", axis: 0 } as never, ROWS.slice(0, 2), {
      otherRows: ROWS.slice(2, 4),
    });
    expect(p?.note).toMatch(/2 \+ 2 rows stacked/);
    expect(p?.after.rows.length).toBe(4);
  });

  it("merge reports key overlap without fake rows", () => {
    const p = peek(
      {
        type: "merge",
        leftKey: "city",
        rightKey: "city",
        how: "inner",
      } as never,
      ROWS.slice(0, 3),
      { otherRows: [{ city: "Paris" }, { city: "X" }] },
    );
    expect(p?.note).toMatch(/2 of 3 left keys match/);
  });

  it("balance shows class counts and target", () => {
    const p = peek({
      type: "balance",
      target: "city",
      method: "oversample",
    } as never);
    expect(p?.before.headers).toEqual(["city", "rows"]);
    expect(p?.after.rows.find((r) => r[0] === "Paris")?.[1]).toBe("2");
  });

  it("assign shows schema note without fabricated values", () => {
    const p = peek({
      type: "assign",
      column: "double",
      expr: "price * 2",
    } as never);
    expect(p?.after.headers).toEqual(["double"]);
    expect(p?.after.rows[0]).toEqual(["—"]);
    expect(p?.note).toMatch(/runs on Apply/);
  });

  it("returns null without rows", () => {
    expect(peek({ type: "drop", column: "city" } as never, [])).toBeNull();
  });
});
