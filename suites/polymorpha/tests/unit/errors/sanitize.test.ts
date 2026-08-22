import { describe, it, expect } from "vitest";
import { sanitizeStatsError, canonicalAction } from "@/lib/errors/sanitize";

describe("sanitizeStatsError", () => {
  it("redacts row dumps with Unsupported action", () => {
    const raw =
      "Validation error: [{'type': 'value_error', 'loc': (), 'msg': \"Value error, Unsupported action 'tostMean'. Supported: ['tost']\", 'input': {'action': 'tostMean', 'rows': [{'Artist Name': 'Drake', 'Total Streams': 123}]}}]";
    const out = sanitizeStatsError(raw);
    expect(out).not.toContain("Drake");
    expect(out).not.toContain("'rows'");
    expect(out).not.toContain("Supported:");
    expect(out).toContain("TOST Equivalence");
    expect(out).toContain("tostMean");
  });

  it("redacts generic row payload", () => {
    const raw = "Validation error: {'rows': [{'a': 1}, 'a{': 2}]} some other";
    const out = sanitizeStatsError(raw);
    expect(out).not.toContain("'rows'");
    expect(out).toContain("Request failed");
  });

  it("hides Supported list for unknown action", () => {
    const raw = "Value error, Unsupported action 'fooBar'. Supported: ['a','b']";
    const out = sanitizeStatsError(raw);
    expect(out).not.toContain("Supported");
    expect(out).toContain("fooBar");
  });

  it("truncates long messages", () => {
    const raw = "a".repeat(600);
    const out = sanitizeStatsError(raw);
    expect(out.length).toBeLessThanOrEqual(501); // 500 + …
    expect(out.endsWith("…")).toBe(true);
  });

  it("passes through friendly messages", () => {
    const raw = "This test (TOST Equivalence) is temporarily unavailable. Please retry. (ref: tostMean)";
    expect(sanitizeStatsError(raw)).toBe(raw);
  });

  it("canonicalAction maps tostMean -> tost", () => {
    expect(canonicalAction("tostMean")).toBe("tost");
    expect(canonicalAction("mann-whitney")).toBe("mannWhitney");
    expect(canonicalAction("anova")).toBe("anova");
  });
});
