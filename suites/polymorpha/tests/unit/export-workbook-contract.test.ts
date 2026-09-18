import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildExcelWorkbook, EXCEL_FREQ_CAP } from "@polymorpha/business-logic";
import { generateExcelBlob } from "@/features/export/lib/ExportService";
import type { Dataset, StatsResults } from "@/types";

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

function makeResults(freqEntries = 2): StatsResults {
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
        entries: Array.from({ length: freqEntries }, (_, i) => ({
          value: `v${i}`,
          count: 1,
          pct: 1,
        })),
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

/** Cell address of a header label in a json_to_sheet worksheet. */
function cellOf(
  ws: XLSX.WorkSheet,
  header: string,
  dataRowIndex: number,
): XLSX.CellObject | null {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const head = grid[0] as unknown[];
  const col = head.indexOf(header);
  if (col < 0) return null;
  return ws[XLSX.utils.encode_cell({ r: dataRowIndex + 1, c: col })] ?? null;
}

describe("export workbook contract (G15 library builder)", () => {
  it("opens with Summary cover, then Cleaned Data; skips empty suites", () => {
    const wb = buildExcelWorkbook(makeDataset(), makeResults());
    expect(wb.SheetNames[0]).toBe("Summary");
    expect(wb.SheetNames[1]).toBe("Cleaned Data");
    expect(wb.SheetNames).toContain("Descriptive");
    expect(wb.SheetNames).toContain("Frequencies");
    // Empty suites produce no sheet (old "Test Results" bucket is gone —
    // per-family sheets replace it; see finding #6).
    expect(wb.SheetNames).not.toContain("T-Tests");
    expect(wb.SheetNames).not.toContain("Test Results");
    expect(wb.SheetNames).not.toContain("Summary Stats");
  });

  it("omits Cleaned Data when includeCleaned is false, keeps Summary first", () => {
    const wb = buildExcelWorkbook(makeDataset(), makeResults(), {
      includeCleaned: false,
    });
    expect(wb.SheetNames[0]).toBe("Summary");
    expect(wb.SheetNames).not.toContain("Cleaned Data");
  });

  it("writes real numeric cells (safe to sum/sort/filter)", () => {
    const wb = buildExcelWorkbook(makeDataset(), makeResults());
    const ws = wb.Sheets["Descriptive"];
    const mean = cellOf(ws, "Mean", 0);
    expect(mean?.t).toBe("n");
    expect(mean?.v).toBe(35);
    const count = cellOf(ws, "Count", 0);
    expect(count?.t).toBe("n");
  });

  it(`caps Frequencies at EXCEL_FREQ_CAP (${EXCEL_FREQ_CAP})`, () => {
    const wb = buildExcelWorkbook(
      makeDataset(),
      makeResults(EXCEL_FREQ_CAP + 5),
    );
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Frequencies"]);
    expect(rows.length).toBe(EXCEL_FREQ_CAP);
  });

  it("generateExcelBlob produces a non-empty xlsx blob", async () => {
    const blob = await generateExcelBlob({
      cleaned: makeDataset(),
      results: makeResults(),
      fileBaseName: "demo",
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
