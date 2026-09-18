import { describe, expect, it } from "vitest";
import { TEST_META } from "@polymorpha/business-logic";
import { tryItForTerm } from "@/pages/dictionary/tryItMap";

const PINNED_IDS = [
  "t-test",
  "anova",
  "welch-anova",
  "mann-whitney",
  "kruskal-wallis",
  "chi-square",
  "fisher-exact",
  "correlation",
  "linear-regression",
  "levene-test",
  "wilcoxon-signed-rank",
];

describe("tryItForTerm allowlist", () => {
  it("maps every pinned term to a real TEST_META key", () => {
    for (const id of PINNED_IDS) {
      const target = tryItForTerm(id);
      expect(target, `missing try-it entry for "${id}"`).not.toBeNull();
      expect(Object.keys(TEST_META)).toContain(target!.test);
      expect(target!.search).toContain("sample=students");
      expect(target!.search).toContain(`focus=${target!.test}`);
      expect(target!.search).toContain(`src=dictionary%3A${id}`);
    }
  });

  it("returns null for terms with no runnable equivalent (no fake mapping)", () => {
    expect(tryItForTerm("shapiro-wilk")).toBeNull();
    expect(tryItForTerm("normality-test")).toBeNull();
    expect(tryItForTerm("no-such-term")).toBeNull();
    expect(tryItForTerm("")).toBeNull();
  });
});
