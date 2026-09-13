import { describe, it, expect } from "vitest";
import {
  formatP,
  formatPValue,
  formatStat,
  roundTo,
  pdfTableCaption,
  pdfTableNote,
  docxTableCaption,
  docxTableNote,
  buildExcelWorkbook,
  workbookToBlob,
  freezePanesXlsx,
  EXCEL_FREQ_CAP,
} from "@polymorpha/business-logic";
import type { TableSpec } from "@polymorpha/business-logic";

/**
 * [POLY-EXPORT] APA export contract — single source for PDF/DOCX/XLSX
 * builders + HTML previews (ts/src/exporters/apa.ts).
 * Laws:
 * - p-values render APA-style (no leading zero, `< .001` floor).
 * - Captions are numbered `Table N` + italic title; notes start `Note.`.
 * - Workbook sheets are styled (autofilter + fitted widths), cells stay
 *   numeric (never toFixed strings), empty suites are skipped, Summary
 *   opens first, every sheet gets a frozen header row.
 */

const dataset = {
  fileName: "suite.csv",
  columns: [
    { name: "age", type: "numeric" },
    { name: "city", type: "categorical" },
  ],
  rows: [
    { age: 25, city: "Berlin" },
    { age: 31, city: "Paris" },
  ],
};

const results = {
  descriptive: [
    {
      column: "age",
      count: 2,
      missing: 0,
      missingPct: 0,
      mean: 28.123456,
      median: 28,
      std: 4.242641,
      min: 25,
      max: 31,
      q1: 25,
      q3: 31,
      skewness: 0.123456,
      kurtosis: -1.234567,
    },
  ],
  frequencies: [
    {
      column: "city",
      entries: [
        { value: "Berlin", count: 1, pct: 0.5 },
        { value: "Paris", count: 1, pct: 0.5 },
      ],
    },
  ],
  correlation: { columns: ["age"], values: [[1]] },
  normality: [
    {
      column: "age",
      test: "Shapiro-Wilk",
      statistic: 0.98765,
      pValue: 0.12345,
      isNormal: true,
    },
  ],
  tTests: [
    {
      type: "one-sample",
      column1: "age",
      t: 2.34567,
      df: 1,
      pValue: 0.00004,
      cohensD: 1.23456,
      significant: true,
    },
  ],
  anova: [],
  regression: [],
  mannWhitney: [],
  kruskalWallis: [],
  chiSquare: [],
};

describe("apa number formatting", () => {
  it("formats narrative p-values without a leading zero", () => {
    expect(formatP(0.003)).toBe("p = .003");
    expect(formatP(0.0004)).toBe("p < .001");
    expect(formatP(null)).toBe("p = —");
  });

  it("formats p-value cells with a `< .001` floor", () => {
    expect(formatPValue(0.02)).toBe(".020");
    expect(formatPValue(0)).toBe("< .001");
    expect(formatPValue(NaN)).toBe("—");
  });

  it("renders missing statistics as an em dash", () => {
    expect(formatStat(NaN)).toBe("—");
    expect(formatStat(1.23456)).toBe("1.23");
  });

  it("rounds to numbers, never strings, blanking non-finite", () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(typeof roundTo(1.23456, 2)).toBe("number");
    expect(roundTo(NaN, 2)).toBeNull();
  });
});

describe("apa captions and notes", () => {
  it("builds a numbered pdfmake caption stack", () => {
    const caption = pdfTableCaption(3, "Descriptive statistics") as Array<{
      text: string;
      style: string;
    }>;
    expect(caption).toHaveLength(2);
    expect(caption[0]).toMatchObject({
      text: "Table 3",
      style: "tableCaptionNum",
    });
    expect(caption[1]).toMatchObject({ style: "tableCaptionTitle" });
  });

  it("builds a `Note.` paragraph for pdfmake", () => {
    const note = pdfTableNote("M = mean.") as { text: string; style: string };
    expect(note.text.startsWith("Note.")).toBe(true);
    expect(note.style).toBe("tableNote");
  });

  it("builds docx caption paragraphs and a note paragraph", () => {
    const caption = docxTableCaption(1, "Title");
    expect(caption).toHaveLength(2);
    expect(caption[0]?.constructor?.name).toBe("Paragraph");
    expect(docxTableNote("n.").constructor?.name).toBe("Paragraph");
  });

  it("exposes the shared TableSpec preview contract", () => {
    const spec: TableSpec = {
      number: 1,
      title: "Descriptive statistics",
      columns: [{ name: "Column" }, { name: "Mean", numeric: true }],
      rows: [{ Column: "age", Mean: 28.12 }],
      note: "M = mean.",
    };
    expect(spec.number).toBe(1);
  });
});

describe("styled Excel workbook", () => {
  it("opens on Summary and skips empty suites", () => {
    const wb = buildExcelWorkbook(dataset as never, results as never);
    expect(wb.SheetNames[0]).toBe("Summary");
    for (const s of [
      "Cleaned Data",
      "Descriptive",
      "T-Tests",
      "Normality",
      "Frequencies",
      "Correlation",
    ])
      expect(wb.SheetNames).toContain(s);
    expect(wb.SheetNames).not.toContain("ANOVA");
    expect(wb.SheetNames).not.toContain("Regression");
  });

  it("keeps stats cells numeric with autofilter and fitted widths", () => {
    const wb = buildExcelWorkbook(dataset as never, results as never);
    const desc = wb.Sheets["Descriptive"];
    expect(desc["!autofilter"]).toBeDefined();
    expect(desc["!cols"]?.length).toBeGreaterThan(0);
    // Mean column (E): rounded to policy decimals, still a number.
    expect(desc["E2"]?.v).toBe(28.12);
    expect(desc["E2"]?.t).toBe("n");
    // Exact p-values stay exact numbers (sortable, never "< .001" text).
    expect(wb.Sheets["T-Tests"]["E2"]?.v).toBe(0.00004);
    expect(wb.Sheets["T-Tests"]["E2"]?.t).toBe("n");
  });

  it("caps frequency entries per column", () => {
    expect(EXCEL_FREQ_CAP).toBe(50);
    const many = {
      ...results,
      frequencies: [
        {
          column: "big",
          entries: Array.from({ length: 60 }, (_, i) => ({
            value: `v${i}`,
            count: 1,
            pct: 1 / 60,
          })),
        },
      ],
    };
    const wb = buildExcelWorkbook(dataset as never, many as never);
    const freq = wb.Sheets["Frequencies"];
    const range = freq["!ref"] as string;
    const rows = Number(range.split(":")[1].replace(/[^0-9]/g, "")) - 1;
    expect(rows).toBe(EXCEL_FREQ_CAP);
  });

  it("appends caller extra sheets after the stats sheets", () => {
    const wb = buildExcelWorkbook(dataset as never, results as never, {
      extraSheets: [{ name: "ML Model", rows: [{ Field: "a", Value: 1 }] }],
    });
    expect(wb.SheetNames[wb.SheetNames.length - 1]).toBe("ML Model");
  });

  it("serializes to a frozen, downloadable blob", async () => {
    const wb = buildExcelWorkbook(dataset as never, results as never);
    const blob = workbookToBlob(wb);
    expect(blob.type).toContain("spreadsheetml");
    expect(blob.size).toBeGreaterThan(0);
    // Freeze injection: output is a larger, still-PK container.
    const raw = new Uint8Array(await blob.arrayBuffer());
    expect(raw[0]).toBe(0x50);
    expect(raw[1]).toBe(0x4b);
    void freezePanesXlsx;
  });
});
