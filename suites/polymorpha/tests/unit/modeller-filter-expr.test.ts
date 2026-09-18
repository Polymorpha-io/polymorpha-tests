import { describe, expect, it } from "vitest";
import {
  toInListExpr,
  toOperatorExpr,
  toPandasQuery,
} from "@/components/DataPreview/dataModellerUtils";

describe("toPandasQuery value-list filters", () => {
  it("emits one `in` clause for numeric floors (no OR-chain)", () => {
    const expr = toPandasQuery("floors", new Set(["1", "2"]), "in", "numeric");
    expect(expr).toBe('floors in [1, "1", 2, "2"]');
    expect(expr).not.toContain(" or ");
  });

  it("emits `not in` for exclusion mode", () => {
    const expr = toPandasQuery(
      "floors",
      new Set(["1", "2"]),
      "notIn",
      "numeric",
    );
    expect(expr).toBe('floors not in [1, "1", 2, "2"]');
  });

  it("keeps categorical values quoted without numeric dups", () => {
    const expr = toPandasQuery(
      "city",
      new Set(["NYC", "LA"]),
      "in",
      "categorical",
    );
    expect(expr).toBe('city in ["NYC", "LA"]');
  });

  it("detects numeric-as-unknown via value probe", () => {
    const expr = toPandasQuery("floors", new Set(["1", "2"]), "in", "unknown");
    expect(expr).toBe('floors in [1, "1", 2, "2"]');
  });

  it("backtick-quotes columns with spaces", () => {
    const expr = toPandasQuery("floor count", new Set(["1"]), "in", "numeric");
    expect(expr).toBe('`floor count` in [1, "1"]');
  });

  it("escapes double quotes inside values", () => {
    const expr = toPandasQuery("city", new Set(['a"b']), "in", "categorical");
    expect(expr).toBe('city in ["a\\"b"]');
  });

  it("normalizes bare numerics (leading zeros, whitespace)", () => {
    // "001" raw would be a syntax error in df.query — emit bare 1 plus the
    // quoted original so string-typed cells still match.
    expect(toPandasQuery("floors", new Set(["001"]), "in", "numeric")).toBe(
      'floors in [1, "001"]',
    );
  });

  it("returns empty string for empty selection", () => {
    expect(toPandasQuery("floors", new Set(), "in", "numeric")).toBe("");
    expect(toPandasQuery("floors", new Set(), "notIn", "numeric")).toBe("");
  });
});

describe("toInListExpr (topN path)", () => {
  it("dedupes repeated literals", () => {
    expect(toInListExpr("floors", ["1", "1", "2"], "in", "numeric")).toBe(
      'floors in [1, "1", 2, "2"]',
    );
  });

  it("handles a single value", () => {
    expect(toInListExpr("floors", ["2"], "in", "numeric")).toBe(
      'floors in [2, "2"]',
    );
  });
});

describe("toOperatorExpr (unchanged single-value paths)", () => {
  it("quotes per numeric probe", () => {
    expect(toOperatorExpr("floors", "eq", "1", undefined, "numeric")).toBe(
      "floors == 1",
    );
    expect(toOperatorExpr("city", "eq", "NYC", undefined, "categorical")).toBe(
      'city == "NYC"',
    );
  });

  it("keeps between/isEmpty/notEmpty forms", () => {
    expect(toOperatorExpr("age", "between", "20", "30", "numeric")).toBe(
      "age >= 20 and age <= 30",
    );
    expect(toOperatorExpr("age", "isEmpty", "", undefined, "numeric")).toBe(
      '(age != age) or (age == "")',
    );
    expect(toOperatorExpr("age", "notEmpty", "", undefined, "numeric")).toBe(
      '(age == age) and (age != "")',
    );
  });
});
