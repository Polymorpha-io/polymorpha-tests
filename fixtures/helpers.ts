/**
 * In-memory CSV fixtures for tests. Uses Vite ?raw imports to load CSV
 * files from tests/mocks/ at build time, then parses them into Dataset objects.
 *
 * Usage:
 *   import { fixtures } from "@mocks/helpers";
 *   const { raw } = fixtures.missing; // or just `fixtures.missing`
 */

import minimalCsv from "./minimal.csv?raw";
import mixedCsv from "./mixed.csv?raw";
import missingCsv from "./missing.csv?raw";
import outliersCsv from "./outliers.csv?raw";
import datesAndTextCsv from "./dates_and_text.csv?raw";
import anovaCsv from "./anova.csv?raw";
import correlationCsv from "./correlation.csv?raw";
import skewedCsv from "./skewed.csv?raw";
import duplicatesCsv from "./duplicates.csv?raw";

import type { Dataset, ColumnType } from "@/types";

// ── CSV parser ──────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { cells.push(cell.trim()); cell = ""; }
      else { cell += ch; }
    }
  }
  cells.push(cell.trim());
  return cells;
}

// ── Type detection ───────────────────────────────────────────────────

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function detectColumnType(samples: string[]): ColumnType {
  const nonEmpty = samples.filter((s) => s !== "");
  if (nonEmpty.length === 0) return "unknown";
  let numeric = 0, date = 0, bool = 0;
  for (const s of nonEmpty) {
    if (!isNaN(Number(s)) && s !== "") numeric++;
    if (ISO_DATE_RE.test(s)) date++;
    if (s === "true" || s === "false") bool++;
  }
  const r = (n: number) => n / nonEmpty.length;
  if (r(numeric) >= 0.9) return "numeric";
  if (r(date) >= 0.9) return "date";
  if (r(bool) >= 0.9) return "boolean";
  return "categorical";
}

function coerceValue(raw: string, type: ColumnType): unknown {
  if (raw === "") return null;
  if (type === "numeric") { const n = Number(raw); return isNaN(n) ? raw : n; }
  if (type === "boolean") return raw === "true";
  return raw;
}

// ── Build Dataset from CSV text ─────────────────────────────────────

function buildDataset(csvText: string, fileName: string): Dataset {
  const { headers, rows: rawRows } = parseCSV(csvText);
  const columns = headers.map((header, ci) => {
    const samples = rawRows.map((r) => r[ci] ?? "");
    const type = detectColumnType(samples);
    return { name: header, type, detectedType: type };
  });
  const rows = rawRows.map((rawRow) => {
    const row: Record<string, unknown> = {};
    headers.forEach((h, ci) => {
      row[h] = coerceValue(rawRow[ci] ?? "", columns[ci].type);
    });
    return row;
  });
  return { fileName, uploadedAt: new Date("2026-07-27T12:00:00Z"), columns, rows };
}

// ── Pre-built fixtures ──────────────────────────────────────────────

export const fixtures = {
  minimal: buildDataset(minimalCsv, "minimal.csv"),
  mixed: buildDataset(mixedCsv, "mixed.csv"),
  missing: buildDataset(missingCsv, "missing.csv"),
  outliers: buildDataset(outliersCsv, "outliers.csv"),
  dates_and_text: buildDataset(datesAndTextCsv, "dates_and_text.csv"),
  anova: buildDataset(anovaCsv, "anova.csv"),
  correlation: buildDataset(correlationCsv, "correlation.csv"),
  skewed: buildDataset(skewedCsv, "skewed.csv"),
  duplicates: buildDataset(duplicatesCsv, "duplicates.csv"),
} as const;
