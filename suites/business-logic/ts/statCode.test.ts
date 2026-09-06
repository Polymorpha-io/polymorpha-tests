import { describe, it, expect } from "vitest";
import { statCodeForTest, statCodeKeys } from "@polymorpha/business-logic";
import { TEST_META } from "@polymorpha/business-logic";

/**
 * [POLY-CELLS] Golden tests for the stat reference map.
 * Law: every canonical TestKey resolves to a real snippet (no fallback),
 * unknown keys degrade to an honest comment.
 */

describe("statCodeForTest", () => {
  it("covers every canonical TestKey", () => {
    const keys = statCodeKeys();
    for (const k of Object.keys(TEST_META)) {
      expect(keys, `missing builder: ${k}`).toContain(k);
      const s = statCodeForTest(k, { columns: ["a", "b"] });
      // 'holistic' is an omnibus overview, not a single procedure.
      if (k === "holistic") {
        expect(s.code, `${k}: honest overview`).toContain(
          "no standalone snippet",
        );
        continue;
      }
      expect(s.code, `${k}: real snippet`).not.toContain(
        "no standalone snippet",
      );
    }
  });

  it("representative snippets contain their canonical calls", () => {
    expect(
      statCodeForTest("anova", { columns: ["grp", "val"] }).code,
    ).toContain("f_oneway");
    expect(statCodeForTest("tTest", { columns: ["val"] }).code).toContain(
      "ttest_1samp",
    );
    expect(
      statCodeForTest("tukeyHSD", { columns: ["grp", "val"] }).code,
    ).toContain("pairwise_tukeyhsd");
    expect(statCodeForTest("multipletests", {}).code).toContain(
      "multipletests",
    );
    expect(
      statCodeForTest("partialCorrelation", { columns: ["x", "y", "z"] }).code,
    ).toContain("partial_corr");
    expect(
      statCodeForTest("partialCorrelation", { columns: ["x", "y", "z"] })
        .requires ?? "",
    ).toMatch(/pingouin/);
    expect(
      statCodeForTest("regression", { columns: ["y", "x1"] }).code,
    ).toContain("ols(");
    expect(statCodeForTest("mcnemar", { columns: ["a", "b"] }).code).toContain(
      "mcnemar",
    );
  });

  it("unknown keys degrade honestly", () => {
    const s = statCodeForTest("bogus-key", {});
    expect(s.code).toContain("no standalone snippet for 'bogus-key'");
  });
});
