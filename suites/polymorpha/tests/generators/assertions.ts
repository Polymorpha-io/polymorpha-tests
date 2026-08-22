/**
 * Shared assertion oracles for generated tests — keeps expectations in one
 * place so generated suites don't re-implement the same checks.
 */
import { expect } from "vitest";
import type {
  CleaningDiff,
  CorrelationMatrix,
  Dataset,
  DescriptiveStats,
} from "@/types";

/** Assert `applyCleaningConfig` produced the expected diff shape. */
export function expectCleaningDiff(diff: CleaningDiff): void {
  expect(typeof diff.rowsRemoved).toBe("number");
  expect(typeof diff.rowsModified).toBe("number");
  expect(typeof diff.columnsRemoved).toBe("number");
  expect(Array.isArray(diff.indicatorColumnsAdded)).toBe(true);
  expect(Array.isArray(diff.encodingLog)).toBe(true);
}

/** Assert a result dataset is structurally valid (columns/rows consistent). */
export function expectValidDataset(dataset: Dataset): void {
  const names = new Set(dataset.columns.map((c) => c.name));
  for (const row of dataset.rows) {
    for (const col of dataset.columns) {
      expect(row).toHaveProperty(col.name);
    }
  }
  for (const col of dataset.columns) {
    expect(typeof col.name).toBe("string");
    expect(["numeric", "categorical", "date", "boolean", "unknown"]).toContain(
      col.type,
    );
  }
  expect(names.size).toBe(dataset.columns.length); // no duplicate column names
}

/** Assert a correlation matrix is symmetric with a unit diagonal. */
export function expectValidCorrelationMatrix(matrix: CorrelationMatrix): void {
  const n = matrix.columns.length;
  expect(matrix.values).toHaveLength(n);
  for (let i = 0; i < n; i++) {
    expect(matrix.values[i]).toHaveLength(n);
    expect(matrix.values[i]![i]).toBe(1);
    for (let j = 0; j < n; j++) {
      expect(matrix.values[i]![j]).toBeGreaterThanOrEqual(-1);
      expect(matrix.values[i]![j]).toBeLessThanOrEqual(1);
      expect(matrix.values[i]![j]).toBeCloseTo(matrix.values[j]![i]!, 6);
    }
  }
}

/** Assert a descriptive-stats result has sane invariants. */
export function expectValidDescriptive(stats: DescriptiveStats): void {
  expect(typeof stats.mean).toBe("number");
  expect(stats.count).toBeGreaterThanOrEqual(0);
  expect(stats.missingPct).toBeGreaterThanOrEqual(0);
  expect(stats.missingPct).toBeLessThanOrEqual(100);
  expect(stats.min).toBeLessThanOrEqual(stats.max);
  expect(stats.q1).toBeLessThanOrEqual(stats.q3);
  expect(stats.variance).toBeGreaterThanOrEqual(0);
}
