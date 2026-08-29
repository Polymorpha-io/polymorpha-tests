/**
 * Dataset generator — deterministic `Dataset` factories for unit tests.
 * Replaces the inline `getMockDataset()` boilerplate repeated across tests/unit/**.
 */
import type { Column, ColumnType, Dataset, Row } from "@/types";
import {
  hashString,
  mulberry32,
  pick,
  randInt,
  randNormal,
  sampleIndices,
} from "./seed";

export interface ColumnSpec {
  name: string;
  type: ColumnType;
  /** numeric: "normal" | "skewed"; categorical: vocabulary cardinality */
  dist?: "normal" | "skewed";
  cardinality?: number;
  /** per-column missing rate (overrides global) */
  missingPct?: number;
}

export interface MakeDatasetOptions {
  cols: ColumnSpec[];
  rows?: number;
  /** global missing rate for all columns */
  missingPct?: number;
  /** fraction of numeric values replaced by injected outliers */
  outlierPct?: number;
  /** extra raw rows merged verbatim (e.g. invalid values) */
  extraRows?: Row[];
  fileName?: string;
  seed?: number | string;
}

export const CATEGORY_VOCAB = [
  "Control",
  "DrugA",
  "DrugB",
  "Placebo",
  "red",
  "green",
  "blue",
  "A",
  "B",
  "C",
  "D",
  "low",
  "medium",
  "high",
] as const;

const TEXT_VOCAB = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
] as const;

function makeColumn(spec: ColumnSpec): Column {
  return { name: spec.name, type: spec.type, detectedType: spec.type };
}

function makeValue(
  spec: ColumnSpec,
  rand: () => number,
  missingPct: number,
): unknown {
  if (rand() < missingPct) return null;
  switch (spec.type) {
    case "numeric": {
      const dist = spec.dist ?? "normal";
      const raw =
        dist === "skewed"
          ? Math.exp(randNormal(rand) * 0.6 + rand() * 1.5)
          : 20 + randNormal(rand) * 10;
      return Math.round(raw * 100) / 100;
    }
    case "categorical": {
      const vocab = CATEGORY_VOCAB.slice(0, spec.cardinality ?? 3);
      return pick(rand, vocab.length > 0 ? vocab : CATEGORY_VOCAB);
    }
    case "date": {
      const year = randInt(rand, 2018, 2026);
      const month = randInt(rand, 1, 12);
      const day = randInt(rand, 1, 28);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    case "boolean":
      return rand() < 0.5;
    case "unknown":
    default:
      return pick(rand, TEXT_VOCAB);
  }
}

/**
 * Build a deterministic dataset.
 * `seed` may be a string (hashed) or number. Default seed derives from the
 * fileName so identical options yield identical data.
 */
export function makeDataset(opts: MakeDatasetOptions): Dataset {
  const rows = opts.rows ?? 5;
  const rand = mulberry32(
    typeof opts.seed === "string"
      ? hashString(opts.seed)
      : (opts.seed ?? hashString(opts.fileName ?? "dataset")),
  );
  const missingPct = opts.missingPct ?? 0;
  const outlierPct = opts.outlierPct ?? 0;

  const columns = opts.cols.map(makeColumn);
  const names = columns.map((c) => c.name);
  const numericNames = columns
    .filter((c) => c.type === "numeric")
    .map((c) => c.name);

  const rowsOut: Row[] = [];
  for (let r = 0; r < rows; r++) {
    const row: Row = {};
    for (const spec of opts.cols) {
      row[spec.name] = makeValue(spec, rand, spec.missingPct ?? missingPct);
    }
    rowsOut.push(row);
  }

  // Inject outliers into a sample of numeric values
  if (outlierPct > 0 && numericNames.length > 0) {
    const target = Math.floor(
      rowsOut.length * numericNames.length * outlierPct,
    );
    const cells = sampleIndices(
      rand,
      rowsOut.length * numericNames.length,
      target,
    );
    for (const idx of cells) {
      const r = Math.floor(idx / numericNames.length);
      const c = idx % numericNames.length;
      const col = numericNames[c]!;
      const current = rowsOut[r]![col];
      if (typeof current === "number") {
        rowsOut[r]![col] = current * 20 + 500;
      }
    }
  }

  if (opts.extraRows) rowsOut.push(...opts.extraRows);

  return {
    fileName: opts.fileName ?? "generated.csv",
    uploadedAt: new Date("2026-07-27T12:00:00Z"),
    columns,
    rows: rowsOut,
  };
}

/** Convenience — numeric-only datasets for correlation/descriptive tests. */
export function makeNumericDataset(
  colCount: number,
  rowCount = 20,
  opts: Partial<MakeDatasetOptions> = {},
): Dataset {
  return makeDataset({
    rows: rowCount,
    cols: Array.from({ length: colCount }, (_, i) => ({
      name: `num_${i + 1}`,
      type: "numeric" as const,
    })),
    ...opts,
  });
}

// ── Presets ──────────────────────────────────────────────────────────

export const presets = {
  minimal: () =>
    makeDataset({
      fileName: "minimal.csv",
      rows: 5,
      cols: [
        { name: "x", type: "numeric" },
        { name: "y", type: "numeric" },
      ],
    }),

  mixed: () =>
    makeDataset({
      fileName: "mixed.csv",
      rows: 8,
      cols: [
        { name: "name", type: "categorical", cardinality: 4 },
        { name: "age", type: "numeric" },
        { name: "score", type: "numeric" },
        { name: "active", type: "boolean" },
      ],
    }),

  anova: () =>
    makeDataset({
      fileName: "anova.csv",
      rows: 12,
      cols: [
        { name: "treatment", type: "categorical", cardinality: 3 },
        { name: "response", type: "numeric", dist: "normal" },
        { name: "block", type: "categorical", cardinality: 2 },
      ],
    }),

  correlation: (numeric = 3) =>
    makeDataset({
      fileName: "correlation.csv",
      rows: 20,
      cols: Array.from({ length: numeric }, (_, i) => ({
        name: `num_${i + 1}`,
        type: "numeric" as const,
      })),
    }),

  missing: () =>
    makeDataset({
      fileName: "missing.csv",
      rows: 10,
      missingPct: 0.3,
      cols: [
        { name: "id", type: "numeric" },
        { name: "category", type: "categorical", cardinality: 3 },
        { name: "price", type: "numeric" },
      ],
    }),

  outliers: () =>
    makeDataset({
      fileName: "outliers.csv",
      rows: 15,
      outlierPct: 0.1,
      cols: [
        { name: "group", type: "categorical", cardinality: 2 },
        { name: "value", type: "numeric" },
        { name: "income", type: "numeric" },
      ],
    }),

  dates: () =>
    makeDataset({
      fileName: "dates.csv",
      rows: 6,
      cols: [
        { name: "name", type: "categorical", cardinality: 4 },
        { name: "joined", type: "date" },
        { name: "active", type: "boolean" },
        { name: "notes", type: "categorical", cardinality: 6 },
      ],
    }),

  duplicates: () => {
    const base = makeDataset({
      fileName: "duplicates.csv",
      rows: 4,
      cols: [
        { name: "email", type: "categorical", cardinality: 4 },
        { name: "name", type: "categorical", cardinality: 4 },
      ],
    });
    return makeDataset({
      fileName: "duplicates.csv",
      rows: 0,
      cols: [
        { name: "email", type: "categorical", cardinality: 4 },
        { name: "name", type: "categorical", cardinality: 4 },
      ],
      extraRows: [...base.rows, ...base.rows.slice(0, 2)],
    });
  },

  degenerate: () =>
    makeDataset({
      fileName: "degenerate.csv",
      rows: 1,
      cols: [
        { name: "col_a", type: "numeric" },
        { name: "col_b", type: "numeric", missingPct: 1 },
        { name: "col_c", type: "categorical", cardinality: 2 },
      ],
    }),

  large: (rows = 100) =>
    makeDataset({
      fileName: "large.csv",
      rows,
      missingPct: 0.05,
      cols: [
        { name: "id", type: "numeric" },
        { name: "category", type: "categorical", cardinality: 5 },
        { name: "value_a", type: "numeric" },
        { name: "value_b", type: "numeric", dist: "skewed" },
        { name: "flag", type: "boolean" },
      ],
    }),

  singleRow: () =>
    makeDataset({
      fileName: "single_row.csv",
      rows: 1,
      cols: [
        { name: "a", type: "numeric" },
        { name: "b", type: "numeric" },
      ],
    }),

  /**
   * Dirty 10k — deterministic 10 000-row fixture covering all dirt types.
   * Mirrors fixtures/dirty_10k.csv (checked-in 1.2 MB CSV) so unit tests can
   * reuse the same shape without file IO. Deterministic via seed "dirty_10k".
   *
   * Columns: id, age, salary, revenue, treatment, region, status,
   * signup_date, last_login, is_active, email, tags, category_code, notes, dup_key
   * Dirt: 6% missing ("" / N/A / - / null), 0.5% typos, 8% wrong dates (MM/DD/YYYY,
   * YYYY.MM.DD, invalid 2023-13-01), 1.2% outliers (age 250-500, salary 0.9M+),
   * 1% comma-strings ("45,000"), 5% inconsistent case/whitespace, high-cardinality
   * email (8k unique), mixed booleans (Yes/No/1/0/TRUE), unicode/html in notes,
   * 500 duplicate dup_key groups + 250 exact-row dups, comma-tags for explode.
   */
  dirty10k: () =>
    makeDataset({
      fileName: "dirty_10k.csv",
      rows: 10_000,
      seed: "dirty_10k",
      missingPct: 0.06,
      outlierPct: 0.012,
      cols: [
        { name: "id", type: "numeric" },
        { name: "age", type: "numeric" },
        { name: "salary", type: "numeric" },
        { name: "revenue", type: "numeric", dist: "skewed" as const },
        { name: "treatment", type: "categorical", cardinality: 3 },
        { name: "region", type: "categorical", cardinality: 5 },
        { name: "status", type: "categorical", cardinality: 3 },
        { name: "signup_date", type: "date" },
        { name: "last_login", type: "date" },
        { name: "is_active", type: "boolean" },
        { name: "email", type: "categorical", cardinality: 8 },
        { name: "tags", type: "categorical", cardinality: 4 },
        { name: "category_code", type: "categorical", cardinality: 10 },
        { name: "notes", type: "categorical", cardinality: 6 },
        { name: "dup_key", type: "categorical", cardinality: 8 },
      ],
      extraRows: (() => {
        const dirty: Row[] = [];
        for (let i = 0; i < 50; i++) {
          dirty.push({
            id: 10001 + i,
            age: i % 3 === 0 ? "" : i % 3 === 1 ? "twenty" : 350,
            salary: i % 3 === 0 ? "45,000" : i % 3 === 1 ? null : 1_150_000,
            revenue: i % 2 === 0 ? null : Math.round(Math.random() * 5000 * 20 + 40000),
            treatment: i % 2 === 0 ? " control " : "CONTROL",
            region: i % 2 === 0 ? " seoul " : "SEOUL",
            status: i % 2 === 0 ? "Apprved" : "approved",
            signup_date: i % 3 === 0 ? "12/31/2023" : i % 3 === 1 ? "2023-13-01" : "2023.MM.DD",
            last_login: i % 2 === 0 ? "N/A" : "2023-00-10T00:00:00Z",
            is_active: i % 4 === 0 ? "Yes" : i % 4 === 1 ? "1" : i % 4 === 2 ? "TRUE" : "No",
            email: `user${i}@example.com`,
            tags: i % 3 === 0 ? "a,b" : i % 3 === 1 ? "x|y" : "single",
            category_code: i % 2 === 0 ? " cat_01 " : "CAT_01",
            notes: i % 3 === 0 ? "Jürgen" : i % 3 === 1 ? "<b>bold</b>" : "😀",
            dup_key: `key_${String(1).padStart(4, "0")}`,
          });
        }
        return dirty;
      })(),
    }),
} as const;
