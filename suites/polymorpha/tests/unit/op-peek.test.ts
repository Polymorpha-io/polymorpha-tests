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

  it("queries with an in-list (value-list filter syntax)", () => {
    const p = peek({
      type: "query",
      expr: 'city in ["Paris", "Rome"]',
    } as never);
    expect(p).not.toBeNull();
    expect(p?.after.rows.length).toBe(3);
  });

  it("queries with not-in and mixed int/str literals", () => {
    const rows = [{ floors: 1 }, { floors: "1" }, { floors: 2 }, { floors: 3 }];
    const excluded = peek(
      { type: "query", expr: 'floors not in [1, "1", 2, "2"]' } as never,
      rows,
    );
    expect(excluded?.after.rows.length).toBe(1);
    const included = peek(
      { type: "query", expr: 'floors in [1, "1", 2, "2"]' } as never,
      rows,
    );
    expect(included?.after.rows.length).toBe(3);
  });

  it("queries backtick-quoted columns (spaced names)", () => {
    const rows = [{ "my col": 1 }, { "my col": 2 }, { "my col": 3 }];
    const listed = peek(
      { type: "query", expr: '`my col` in [1, "1"]' } as never,
      rows,
    );
    expect(listed).not.toBeNull();
    expect(listed?.after.rows.length).toBe(1);
    const compared = peek(
      { type: "query", expr: "`my col` > 1" } as never,
      rows,
    );
    expect(compared?.after.rows.length).toBe(2);
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

  it("assign computes new-column values over the preview slice", () => {
    const p = peek({
      type: "assign",
      column: "double",
      expr: "price * 2",
    } as never);
    expect(p?.after.headers).toEqual(["double"]);
    expect(p?.before.headers).toEqual(["price"]);
    expect(p?.after.rows.map((r) => r[0])).toEqual([
      "20",
      "60",
      "40",
      "80",
      "100",
    ]);
    expect(p?.note).toMatch(/double = price \* 2/);
  });

  it("assign overwrites the target column in place", () => {
    const p = peek({
      type: "assign",
      column: "price",
      expr: "price + 5",
    } as never);
    expect(p?.before.headers).toEqual(["price"]);
    expect(p?.after.headers).toEqual(["price"]);
    expect(p?.after.rows[0]).toEqual(["15"]);
  });

  it("apply evaluates the x-expr on the target column", () => {
    const p = peek({
      type: "apply",
      column: "price",
      func: "x * 2",
    } as never);
    expect(p?.before.headers).toEqual(["price"]);
    expect(p?.after.headers).toEqual(["price"]);
    expect(p?.after.rows.map((r) => r[0])).toEqual([
      "20",
      "60",
      "40",
      "80",
      "100",
    ]);
    expect(p?.note).toMatch(/x \* 2 on price/);
  });

  it("apply shows honest blanks for blocked expressions", () => {
    const p = peek({
      type: "apply",
      column: "price",
      func: "__import__('os')",
    } as never);
    expect(p?.after.headers).toEqual(["price"]);
    expect(p?.after.rows[0]).toEqual(["—"]);
    expect(p?.note).toMatch(/blocked/);
  });

  it("apply blocks prototype-chain access", () => {
    const p = peek({
      type: "apply",
      column: "price",
      func: "x.constructor",
    } as never);
    expect(p?.after.rows[0]).toEqual(["—"]);
    expect(p?.note).toMatch(/blocked/);
  });

  it("apply leaves method text inside string literals alone", () => {
    const p = peek({
      type: "apply",
      column: "city",
      func: '".upper()"',
    } as never);
    expect(p?.after.rows.map((r) => r[0])).toEqual([
      ".upper()",
      ".upper()",
      ".upper()",
      ".upper()",
      ".upper()",
    ]);
  });

  it("apply still evaluates real string methods", () => {
    const p = peek({
      type: "apply",
      column: "city",
      func: "x.upper()",
    } as never);
    expect(p?.after.rows[0]).toEqual(["PARIS"]);
  });

  it("apply supports the re bridge like the backend", () => {
    const p = peek({
      type: "apply",
      column: "city",
      func: 're.sub("o", "0", x)',
    } as never);
    expect(p?.after.rows[1]).toEqual(["L0nd0n"]);
  });

  it("assign supports backtick headers with spaces", () => {
    const p = peek(
      {
        type: "assign",
        column: "doubled",
        expr: "`my col` * 2",
      } as never,
      [{ "my col": 5 }, { "my col": 7 }],
    );
    expect(p?.before.headers).toEqual(["my col"]);
    expect(p?.after.rows.map((r) => r[0])).toEqual(["10", "14"]);
  });

  it("assign shows blanks for re (pandas eval has no re)", () => {
    const p = peek({
      type: "assign",
      column: "hit",
      expr: "re.search('a', city)",
    } as never);
    expect(p?.after.rows[0]).toEqual(["—"]);
  });

  it("assign neutralizes injected globals per row", () => {
    const p = peek({
      type: "assign",
      column: "hit",
      expr: "price + fetch('https://evil.test')",
    } as never);
    expect(p?.after.rows.every((r) => r[0] === "—")).toBe(true);
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it("assign resolves a column named x (shadows nothing)", () => {
    const p = peek(
      { type: "assign", column: "doubled", expr: "x * 2" } as never,
      [{ x: 5 }, { x: 7 }],
    );
    expect(p?.after.rows.map((r) => r[0])).toEqual(["10", "14"]);
  });

  it("apply returns originals on syntax errors like the backend", () => {
    const p = peek({
      type: "apply",
      column: "price",
      func: "x +",
    } as never);
    expect(p?.after.rows.map((r) => r[0])).toEqual([
      "10",
      "30",
      "20",
      "40",
      "50",
    ]);
  });

  it("returns null without rows", () => {
    expect(peek({ type: "drop", column: "city" } as never, [])).toBeNull();
  });
});
