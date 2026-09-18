import { describe, it, expect } from "vitest";
import { toColumnType } from "@/components/DataPreview/utils";
import { Columns } from "@/constants/schema";

describe("toColumnType", () => {
  it("returns the same type for a known column type", () => {
    expect(toColumnType("numeric")).toBe("numeric");
    expect(toColumnType("categorical")).toBe("categorical");
    expect(toColumnType("date")).toBe("date");
    expect(toColumnType("boolean")).toBe("boolean");
  });

  it("returns unknown for an unrecognized type string", () => {
    expect(toColumnType("made-up")).toBe(Columns.Unknown);
  });

  it("returns unknown for an empty string", () => {
    expect(toColumnType("")).toBe(Columns.Unknown);
  });

  it("is case-insensitive for known types", () => {
    expect(toColumnType("Numeric")).toBe("numeric");
    expect(toColumnType("CATEGORICAL")).toBe("categorical");
    expect(toColumnType("Date")).toBe("date");
    expect(toColumnType("Boolean")).toBe("boolean");
  });

  it("returns unknown for null", () => {
    expect(toColumnType(null)).toBe(Columns.Unknown);
  });

  it("returns unknown for undefined", () => {
    expect(toColumnType(undefined)).toBe(Columns.Unknown);
  });

  it("treats the unknown type itself as valid", () => {
    expect(toColumnType("unknown")).toBe("unknown");
  });
});
