import { describe, expect, it } from "vitest";
import {
  buildLockedBlock,
  countWords,
  extractHeadings,
  hashReport,
  lockedSectionIds,
  parseFrontmatter,
  spliceLockedBlocks,
  splitLockedBlocks,
} from "@/features/export/model/reportDocument";
import { markdownToTex } from "@/features/export/lib/markdownToTex";
import {
  freshLockedBlocks,
  serializeReport,
} from "@/features/export/lib/markdownSerialize";
import type {
  CleaningDiff,
  Dataset,
  ExportPreferences,
  StatsResults,
} from "@/types";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";

function makeDataset(): Dataset {
  return {
    columns: [
      { name: "age", type: "numeric", detectedType: "numeric" },
      { name: "sex", type: "categorical", detectedType: "categorical" },
    ],
    rows: [
      { age: 30, sex: "M" },
      { age: 40, sex: "F" },
    ],
    fileName: "demo.csv",
    uploadedAt: new Date(),
  };
}

function makeResults(): StatsResults {
  return {
    descriptive: [
      {
        column: "age",
        count: 2,
        missing: 0,
        missingPct: 0,
        mean: 35,
        median: 35,
        std: 5,
        variance: 25,
        min: 30,
        max: 40,
        q1: 30,
        q3: 40,
        skewness: 0,
        kurtosis: 0,
      },
    ],
    frequencies: [
      {
        column: "sex",
        entries: [
          { value: "M", count: 1, pct: 50 },
          { value: "F", count: 1, pct: 50 },
        ],
      },
    ],
    correlation: null,
    normality: [],
    tTests: [],
    anova: [],
    regression: [],
    mannWhitney: [],
    kruskalWallis: [],
    chiSquare: [],
  };
}

describe("reportDocument guards", () => {
  it("splits locked blocks and lists ids in order", () => {
    const md = [
      "# Title",
      buildLockedBlock("descriptive", "| A |\n| --- |\n| 1 |"),
      "prose",
      buildLockedBlock("tests", "hello"),
    ].join("\n\n");
    expect(lockedSectionIds(md)).toEqual(["descriptive", "tests"]);
    expect(splitLockedBlocks(md)).toHaveLength(2);
  });

  it("splices fresh blocks preserving prose, never resurrecting deleted", () => {
    const original = [
      "# T",
      buildLockedBlock("descriptive", "OLD"),
      "my notes",
    ].join("\n\n");
    const edited = original.replace("my notes", "my edited notes");
    const { markdown, updated, skipped } = spliceLockedBlocks(
      edited,
      new Map([["descriptive", "NEW"], ["tests", "NEW2"]]),
    );
    expect(markdown).toContain("my edited notes");
    expect(markdown).toContain("NEW");
    expect(updated).toEqual(["descriptive"]);
    expect(skipped).toEqual(["tests"]);
  });

  it("extracts headings and counts words ignoring fences", () => {
    const md = `---\ntitle: "x"\n---\n\n# Alpha\n\nhello world\n\n\`\`\`polymorpha:descriptive\n| A |\n\`\`\`\n`;
    expect(extractHeadings(md).map((h) => h.text)).toEqual(["Alpha"]);
    expect(extractHeadings(md)[0].anchor).toBe("alpha");
    expect(countWords(md)).toBe(3); // Alpha + hello world
    expect(parseFrontmatter(md).frontmatter.title).toBe("x");
    expect(hashReport("a")).toBe(hashReport("a"));
    expect(hashReport("a")).not.toBe(hashReport("b"));
  });
});

describe("markdownSerialize", () => {
  it("seeds essentials vs complete with different sections", () => {
    const base = {
      cleaned: makeDataset(),
      raw: null,
      results: makeResults(),
      cleaningDiff: null as CleaningDiff | null,
      datasetName: "demo",
      preferences: { ...DEFAULT_EXPORT_PREFERENCES } as ExportPreferences,
    };
    const ess = serializeReport({ ...base, preset: "essentials" });
    const full = serializeReport({ ...base, preset: "complete" });
    expect(ess).toContain("## Executive Summary");
    expect(ess).not.toContain("## Correlation");
    expect(full).toContain("## Visuals");
    expect(lockedSectionIds(full)).toContain("descriptive");
  });

  it("freshLockedBlocks regenerates tables from results", () => {
    const fresh = freshLockedBlocks({
      cleaned: makeDataset(),
      raw: null,
      results: makeResults(),
      cleaningDiff: null,
      datasetName: "demo",
      preset: "standard",
      preferences: { ...DEFAULT_EXPORT_PREFERENCES },
    });
    expect(fresh.get("descriptive")).toContain("age");
  });
});

describe("markdownToTex", () => {
  it("emits preamble + sections + longtable, escaping specials", () => {
    const md = `---\ntitle: "Demo & Co"\nauthor: "A"\nlocation: ""\ndate: "2026-01-01"\nfontsize: "10pt"\ngeometry: "top=2cm"\ntoc: true\nnumber-sections: true\n---\n\n## Descriptive & More\n\nProfit is 100% & growing.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n`;
    const { tex, warnings } = markdownToTex(md);
    expect(tex).toContain("\\documentclass");
    expect(tex).toContain("\\tableofcontents");
    expect(tex).toContain("\\subsection{Descriptive \\& More}");
    expect(tex).toContain("100\\% \\& growing");
    expect(tex).toContain("\\begin{longtable}");
    expect(warnings).toEqual([]);
  });

  it("passes math through and boxes figures with a warning", () => {
    const md = `# T\n\n$p < 0.05$ significant.\n\n![hist:age](polymorpha://hist:age)\n`;
    const { tex, warnings } = markdownToTex(md);
    expect(tex).toContain("$p < 0.05$");
    expect(tex).toContain("\\caption{hist:age}");
    expect(warnings.length).toBe(1);
  });

  it("allowlist preamble values, falling back with warnings", () => {
    const md = `---\ntitle: "T"\nfontsize: "10pt; \\\\input{/etc/passwd}"\ngeometry: "top=2cm) \\\\evil"\n---\n\n# T\n`;
    const { tex, warnings } = markdownToTex(md);
    expect(tex).toContain("\\documentclass[10pt]{article}");
    expect(tex).toContain("top=2cm, bottom=2cm, left=2cm, right=2cm");
    expect(tex).not.toContain("/etc/passwd");
    expect(tex).not.toContain("evil");
    expect(warnings.length).toBe(2);
  });

  it("accepts valid custom preamble values without warnings", () => {
    const md = `---\ntitle: "T"\nfontsize: "12pt"\ngeometry: "margin=2cm"\n---\n\n# T\n`;
    const { tex, warnings } = markdownToTex(md);
    expect(tex).toContain("\\documentclass[12pt]{article}");
    expect(tex).toContain("\\usepackage[margin=2cm]{geometry}");
    expect(warnings).toEqual([]);
  });

  it("rejects degenerate geometry with a warning", () => {
    const md = `---\ntitle: "T"\ngeometry: ",,,"\n---\n\n# T\n`;
    const { tex, warnings } = markdownToTex(md);
    expect(tex).toContain("top=2cm, bottom=2cm, left=2cm, right=2cm");
    expect(warnings.length).toBe(1);
  });

  it("keeps bold with braces intact instead of splitting the command", () => {
    const { tex } = markdownToTex(`# T\n\n**a}b** and **plain**\n`);
    expect(tex).toContain("\\textbf{a\\}b}");
    expect(tex).toContain("\\textbf{plain}");
  });
});
