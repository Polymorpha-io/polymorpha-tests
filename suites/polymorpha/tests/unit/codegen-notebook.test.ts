import { describe, expect, it } from "vitest";
import { notebookToJson, recipeToNotebook } from "@/lib/codegen/notebook";
import type { DataOperationStepConfig } from "@/types/operations";

const STEPS = [
  { type: "query", expr: "sales > 0" },
  {
    type: "note",
    cellKind: "clean",
    inputStepId: null,
    summary: "Removed negatives",
  },
] as unknown as DataOperationStepConfig[];

describe("recipeToNotebook", () => {
  it("produces valid nbformat 4.5 JSON with markdown + code cells", () => {
    const doc = recipeToNotebook("sales.csv", STEPS);
    expect(doc.nbformat).toBe(4);
    expect(doc.nbformat_minor).toBe(5);
    expect(doc.metadata.kernelspec.name).toBe("python3");
    // header md + load code + step1 md + step1 code + note md + footer code
    expect(doc.cells).toHaveLength(6);
    expect(doc.cells[0].cell_type).toBe("markdown");
    expect(doc.cells[1].cell_type).toBe("code");
    expect(doc.cells[4].cell_type).toBe("markdown");
    expect(doc.cells[4].source.join("")).toContain("Removed negatives");
    const roundTrip = JSON.parse(notebookToJson(doc)) as typeof doc;
    expect(roundTrip.cells).toHaveLength(6);
    for (const cell of roundTrip.cells) {
      expect(cell.execution_count).toBeNull();
      expect(Array.isArray(cell.source)).toBe(true);
    }
  });

  it("handles an empty recipe with load and footer cells only", () => {
    const doc = recipeToNotebook("empty.csv", []);
    expect(doc.cells).toHaveLength(3);
    expect(notebookToJson(doc)).toContain("empty.csv");
  });
});
