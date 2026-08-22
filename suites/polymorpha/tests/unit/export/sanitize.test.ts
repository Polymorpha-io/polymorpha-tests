import { describe, it, expect } from "vitest";
import {
  sanitizeFileName,
  buildExportFileName,
} from "@/features/export/lib/sanitize";

describe("sanitizeFileName", () => {
  it("returns dataset fallback for empty", () => {
    expect(sanitizeFileName("")).toBe("dataset");
    expect(sanitizeFileName("   ")).toBe("dataset");
  });
  it("NFKC normalizes and strips forbidden chars", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f<g>h|i"j')).toBe(
      "a-b-c-d-e-f-g-h-i-j",
    );
  });
  it("replaces leading dots", () => {
    expect(sanitizeFileName("...hidden")).toBe("-hidden");
    expect(sanitizeFileName(".")).toBe("dataset");
  });
  it("caps at 200 chars", () => {
    const long = "a".repeat(300);
    expect(sanitizeFileName(long).length).toBe(200);
  });
  it("handles unicode NFKC", () => {
    const s = sanitizeFileName("Jürgen-東京 Москва");
    expect(s.length).toBeGreaterThan(5);
    expect(s).not.toContain("/");
  });
  it("rejects reserved Windows names", () => {
    expect(sanitizeFileName("CON")).toBe("_CON");
    expect(sanitizeFileName("aux")).toBe("_aux");
  });
  it("trims trailing dots/spaces", () => {
    expect(sanitizeFileName("report. ")).toBe("report");
  });
});

describe("buildExportFileName", () => {
  it("prefixes and preserves ext", () => {
    expect(buildExportFileName("my data", "pdf")).toBe(
      "polymorpha-report-my data.pdf",
    );
    expect(buildExportFileName("base", ".xlsx")).toBe(
      "polymorpha-report-base.xlsx",
    );
  });
});
