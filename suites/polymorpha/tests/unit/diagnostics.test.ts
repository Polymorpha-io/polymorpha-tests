import { describe, expect, it } from "vitest";
import {
  downsample,
  flagCooksDistance,
  flagLeverage,
  interpretDurbinWatson,
  normalQuantile,
  qqPoints,
  residualPoints,
} from "@/lib/diagnostics/diagnostics";

describe("residualPoints", () => {
  it("pairs fitted values with yTrue - yPred", () => {
    expect(residualPoints([3, 5], [1, 4])).toEqual([
      { fitted: 1, residual: 2 },
      { fitted: 4, residual: 1 },
    ]);
  });

  it("rejects mismatched, empty, or non-finite inputs inline", () => {
    expect(() => residualPoints([1], [1, 2])).toThrow("equal length");
    expect(() => residualPoints([], [])).toThrow("at least 1");
    expect(() => residualPoints([NaN], [1])).toThrow("finite");
  });
});

describe("normalQuantile", () => {
  it("maps the median to 0 and is symmetric", () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.975)).toBeCloseTo(-normalQuantile(0.025), 9);
  });

  it("matches textbook z-values through all three regions", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5);
    expect(normalQuantile(0.999)).toBeCloseTo(3.090232, 5);
  });

  it("rejects p outside (0, 1)", () => {
    expect(() => normalQuantile(0)).toThrow("in (0, 1)");
    expect(() => normalQuantile(1)).toThrow("in (0, 1)");
  });
});

describe("qqPoints", () => {
  it("sorts the sample and pairs median-rank theoretical quantiles", () => {
    const pts = qqPoints([3, 1, 2]);
    expect(pts.map((p) => p.sample)).toEqual([1, 2, 3]);
    expect(pts[1]?.theoretical).toBeCloseTo(0, 9);
    expect(pts[0]?.theoretical).toBeLessThan(0);
    expect(pts[2]?.theoretical).toBeGreaterThan(0);
  });
});

describe("downsample", () => {
  it("caps length deterministically, keeps order and the last point", () => {
    const pts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = downsample(pts, 4);
    const b = downsample(pts, 4);
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    expect(a[a.length - 1]).toBe(10);
    expect([...a].sort((x, y) => x - y)).toEqual(a);
  });

  it("copies small inputs and rejects bad caps", () => {
    const pts = [1, 2];
    const out = downsample(pts, 10);
    expect(out).toEqual(pts);
    expect(out).not.toBe(pts);
    expect(() => downsample(pts, 0)).toThrow("positive integer");
  });
});

describe("flagCooksDistance and flagLeverage", () => {
  it("flags Cook's distances above 4/(n-p)", () => {
    // n=12, p=2 → threshold 0.4
    const { threshold, flagged } = flagCooksDistance([0.1, 0.5, 0.39], 12, 2);
    expect(threshold).toBeCloseTo(0.4, 9);
    expect(flagged).toEqual([1]);
  });

  it("flags leverage above 2p/n", () => {
    // n=10, p=2 → threshold 0.4
    const { threshold, flagged } = flagLeverage([0.2, 0.41], 10, 2);
    expect(threshold).toBeCloseTo(0.4, 9);
    expect(flagged).toEqual([1]);
  });

  it("rejects degenerate n/p", () => {
    expect(() => flagCooksDistance([0.1], 2, 2)).toThrow("p < n");
    expect(() => flagLeverage([0.1], 0, 1)).toThrow("n >= 1");
  });
});

describe("interpretDurbinWatson", () => {
  it("bands the textbook regions", () => {
    expect(interpretDurbinWatson(1.0)).toBe("positive-autocorrelation");
    expect(interpretDurbinWatson(1.6)).toBe("inconclusive-low");
    expect(interpretDurbinWatson(2.0)).toBe("no-autocorrelation");
    expect(interpretDurbinWatson(2.4)).toBe("inconclusive-high");
    expect(interpretDurbinWatson(3.0)).toBe("negative-autocorrelation");
  });

  it("rejects values outside [0, 4]", () => {
    expect(() => interpretDurbinWatson(4.5)).toThrow("[0, 4]");
    expect(() => interpretDurbinWatson(NaN)).toThrow("[0, 4]");
  });
});
