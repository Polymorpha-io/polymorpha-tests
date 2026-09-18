import { describe, it, expect } from "vitest";
import { validateInput } from "@/lib/stats/api";

const rows = [
  { date: "2020-01-01", price: 100, bedrooms: 3 },
  { date: "2020-02-01", price: 200, bedrooms: 4 },
];

function assignParams(column: string, expr: string) {
  return { column, col: column, expr, value: expr };
}

describe("assign validation — new output columns", () => {
  it("new-column assign passes (pricetimesTen = price * 10)", () => {
    expect(() =>
      validateInput(
        "assign",
        rows,
        assignParams("pricetimesTen", "price * 10"),
      ),
    ).not.toThrow();
  });

  it("overwrite-existing assign still passes", () => {
    expect(() =>
      validateInput("assign", rows, assignParams("price", "price * 10")),
    ).not.toThrow();
  });

  it("typo'd source column throws naming the bad identifier", () => {
    expect(() =>
      validateInput(
        "assign",
        rows,
        assignParams("pricetimesTen", "pricee * 10"),
      ),
    ).toThrow(/pricee/);
  });

  it("empty target name is still rejected", () => {
    expect(() =>
      validateInput("assign", rows, assignParams("  ", "price * 10")),
    ).toThrow(/cannot be empty/);
  });

  it("backtick-quoted names are not flagged", () => {
    const weird = [{ "Area (cm^2)": 4, price: 100 }];
    expect(() =>
      validateInput(
        "assign",
        weird,
        assignParams("adj", "`Area (cm^2)` * price"),
      ),
    ).not.toThrow();
  });

  it("quoted string literals are not flagged as columns", () => {
    expect(() =>
      validateInput("assign", rows, assignParams("label", '"x"')),
    ).not.toThrow();
  });

  it("math builtins in expressions are not flagged", () => {
    expect(() =>
      validateInput(
        "assign",
        rows,
        assignParams("logged", "log(price) + sqrt(price)"),
      ),
    ).not.toThrow();
  });

  it("eval alias (backend assign) gets the same exemption", () => {
    expect(() =>
      validateInput("eval", rows, assignParams("pricetimesTen", "price * 10")),
    ).not.toThrow();
  });

  it("non-assign ops still reject unknown columns (no regression)", () => {
    expect(() =>
      validateInput("factorize", rows, { column: "nope", col: "nope" }),
    ).toThrow(/Column "nope" not found/);
  });
});
