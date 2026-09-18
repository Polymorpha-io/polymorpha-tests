import { describe, expect, it } from "vitest";
import { countUniqueValues } from "@/lib/uniqueValues";

const ROWS = [
  { city: "Paris" },
  { city: "Paris" },
  { city: "London" },
  { city: null },
  { city: "" },
  { city: "   " },
];

describe("countUniqueValues", () => {
  it("counts values and buckets N/A variants separately", () => {
    const r = countUniqueValues(ROWS, "city");
    expect(r.total).toBe(6);
    expect(r.uniqueCount).toBe(2);
    expect(r.shown[0]).toMatchObject({ value: "Paris", count: 2 });
    expect(r.nullCount).toBe(1);
    expect(r.emptyCount).toBe(1);
    expect(r.wsCount).toBe(1);
  });

  it("flags padding, case collisions and singletons", () => {
    const rows = [
      { c: "Male" },
      { c: "male" },
      { c: " Male " },
      ...Array.from({ length: 8 }, () => ({ c: "Male" })),
    ];
    const r = countUniqueValues(rows, "c");
    const byValue = new Map(r.shown.map((e) => [e.value, e]));
    expect(byValue.get("Male")?.caseCollision).toBe(true);
    expect(byValue.get("male")?.caseCollision).toBe(true);
    expect(byValue.get(" Male ")?.padded).toBe(true);
    expect(byValue.get("male")?.rare).toBe(true);
    expect(byValue.get("Male")?.rare).toBe(false);
  });

  it("caps the list and reports the remainder", () => {
    const rows = ["a", "b", "c", "d"].map((v) => ({ c: v }));
    const r = countUniqueValues(rows, "c", 2);
    expect(r.shown).toHaveLength(2);
    expect(r.more).toBe(2);
    expect(r.uniqueCount).toBe(4);
  });

  it("returns empty for missing rows or column (never throws)", () => {
    expect(countUniqueValues(null, "c").total).toBe(0);
    expect(countUniqueValues([], "c").shown).toEqual([]);
    expect(countUniqueValues(ROWS, "").total).toBe(0);
  });
});
