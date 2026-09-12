import { describe, expect, it } from "vitest";
import { computeGetDummiesPeek } from "@/components/DataPreview/modeller/getDummiesPeek";

const ROWS = [
  { city: "Paris", price: 10 },
  { city: "London", price: 20 },
  { city: "Paris", price: 30 },
  { city: "Rome", price: 40 },
  { city: "London", price: 50 },
  { city: "Paris", price: 60 },
];

describe("computeGetDummiesPeek", () => {
  it("builds verbatim headers with prefix sep, 5-row cap", () => {
    const peek = computeGetDummiesPeek(ROWS, "city", "_", false);
    expect(peek?.headers).toEqual(["city_Paris", "city_London", "city_Rome"]);
    expect(peek?.before).toEqual([
      "Paris",
      "London",
      "Paris",
      "Rome",
      "London",
    ]);
    expect(peek?.matrix[0]).toEqual(["1", "0", "0"]);
    expect(peek?.matrix[1]).toEqual(["0", "1", "0"]);
    expect(peek?.shownRows).toBe(5);
    expect(peek?.previewRowCount).toBe(6);
  });

  it("dropFirst drops the first-seen category (all-zero row)", () => {
    const peek = computeGetDummiesPeek(ROWS, "city", "_", true);
    expect(peek?.droppedFirst).toBe("Paris");
    expect(peek?.headers).toEqual(["city_London", "city_Rome"]);
    expect(peek?.matrix[0]).toEqual(["0", "0"]);
  });

  it("honors a custom prefix separator", () => {
    const peek = computeGetDummiesPeek(ROWS, "city", "-", false);
    expect(peek?.headers).toEqual(["city-Paris", "city-London", "city-Rome"]);
  });

  it("caps visible dummy columns with moreCount", () => {
    const peek = computeGetDummiesPeek(ROWS, "city", "_", false, 5, 2);
    expect(peek?.headers).toEqual(["city_Paris", "city_London"]);
    expect(peek?.moreCount).toBe(1);
    expect(peek?.matrix[0]).toEqual(["1", "0"]);
  });

  it("defaults to 3 visible dummy columns", () => {
    const rows = [...ROWS, { city: "Oslo", price: 70 }];
    const peek = computeGetDummiesPeek(rows, "city", "_", false);
    expect(peek?.headers).toEqual(["city_Paris", "city_London", "city_Rome"]);
    expect(peek?.moreCount).toBe(1);
  });

  it("encodes null as an all-zero row shown as —", () => {
    const peek = computeGetDummiesPeek(
      [{ city: null }, { city: "Paris" }],
      "city",
      "_",
      false,
    );
    expect(peek?.before).toEqual(["—", "Paris"]);
    expect(peek?.matrix[0]).toEqual(["0"]);
    expect(peek?.matrix[1]).toEqual(["1"]);
  });

  it("returns null for empty rows or unknown column", () => {
    expect(computeGetDummiesPeek([], "city", "_", false)).toBeNull();
    expect(computeGetDummiesPeek(ROWS, "nope", "_", false)).toBeNull();
    expect(computeGetDummiesPeek(null, "city", "_", false)).toBeNull();
  });
});
