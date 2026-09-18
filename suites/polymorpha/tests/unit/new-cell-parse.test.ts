import { describe, it, expect } from "vitest";
import { stepToPython } from "@polymorpha/business-logic";
import {
  parseNewCell,
  exampleForFamily,
  describeParsedCell,
  truncateRunOutput,
  NEW_CELL_FAMILIES,
} from "@/lib/newCellParse";

const SAMPLES: Array<{ family: string; config: Record<string, unknown> }> = [
  { family: "sort", config: { type: "sort", by: ["price"], ascending: true } },
  { family: "query", config: { type: "query", expr: 'region == "EU"' } },
  { family: "getDummies", config: { type: "getDummies", columns: ["region"] } },
  {
    family: "group",
    config: {
      type: "group",
      groupByCols: ["region"],
      aggregations: [
        { newColumn: "avg_price", operation: "mean", targetColumn: "price" },
      ],
    },
  },
  {
    family: "merge",
    config: { type: "merge", leftOn: "id", rightOn: "id", how: "inner" },
  },
];

describe("parseNewCell", () => {
  it("round-trips generated templates back to their family (auto)", () => {
    for (const { family, config } of SAMPLES) {
      const code = stepToPython(config).code;
      const parsed = parseNewCell(code, "auto");
      expect(parsed.ok, `${family} should parse`).toBe(true);
      if (parsed.ok) expect(parsed.family).toBe(family);
    }
  });

  it("rejects blank and foreign code without touching data", () => {
    expect(parseNewCell("   ", "auto").ok).toBe(false);
    const foreign = parseNewCell("import os\nos.system('rm -rf /')\n", "auto");
    expect(foreign.ok).toBe(false);
  });

  it("points non-matching code at the code-cell path (no dead-end)", () => {
    const miss = parseNewCell("print('hello')\n", "auto");
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error).toContain("code cell");
    const explicit = parseNewCell("print('hello')\n", "sort");
    expect(explicit.ok).toBe(false);
    if (!explicit.ok) expect(explicit.error).toContain("code cell");
  });

  it("honors an explicit family and rejects cross-family code", () => {
    const sortCode = stepToPython(SAMPLES[0].config).code;
    expect(parseNewCell(sortCode, "sort").ok).toBe(true);
    expect(parseNewCell(sortCode, "query").ok).toBe(false);
  });

  it("covers exactly the codec-editable families with examples", () => {
    expect([...NEW_CELL_FAMILIES].sort()).toEqual([
      "getDummies",
      "group",
      "merge",
      "query",
      "sort",
    ]);
    for (const family of NEW_CELL_FAMILIES) {
      const example = exampleForFamily(family);
      expect(example.length, `${family} needs an example`).toBeGreaterThan(0);
      expect(parseNewCell(example, family).ok, `${family} example parses`).toBe(
        true,
      );
    }
  });

  it("describes and exemplifies families", () => {
    expect(NEW_CELL_FAMILIES).not.toContain("note");
    expect(exampleForFamily("sort")).toContain("sort");
    const parsed = parseNewCell(stepToPython(SAMPLES[0].config).code, "auto");
    if (parsed.ok) {
      expect(describeParsedCell(parsed.family, parsed.config)).toContain(
        "Sort",
      );
    }
    const merged = parseNewCell(stepToPython(SAMPLES[4].config).code, "auto");
    if (merged.ok) {
      expect(describeParsedCell(merged.family, merged.config)).toContain(
        "Merge",
      );
    }
  });

  it("caps Run output before persist, passes short text through", () => {
    expect(truncateRunOutput(null)).toBeNull();
    expect(truncateRunOutput("   ")).toBeNull();
    expect(truncateRunOutput("hello\n")).toBe("hello\n");
    const long = "x".repeat(9_000);
    const capped = truncateRunOutput(long);
    expect(capped!.length).toBeLessThan(long.length);
    expect(capped).toContain("truncated");
  });
});
