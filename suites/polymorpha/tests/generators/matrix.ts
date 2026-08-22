/**
 * Matrix utilities — turn enum cross-products into `describe.each` / `it.each`
 * tables. Keeps generated suites data-driven instead of hand-written.
 */
import type { ColumnType } from "@/types";

/** Cartesian product of arrays. Empty input array → [[]]. */
export function cartesian<T>(...arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((v) => [...combo, v])),
    [[]],
  );
}

export type TestCase<C extends readonly unknown[]> = {
  label: string;
  args: C;
};

/** Build labeled test cases from arrays of objects (each object becomes one case). */
export function casesFor<T extends Record<string, unknown>>(
  rows: T[],
): Array<{ label: string; args: [T] }> {
  return rows.map((row) => ({
    label: labelFor(row),
    args: [row],
  }));
}

/** Human-readable label for a test row (used by describe.each $label). */
export function labelFor(row: Record<string, unknown>): string {
  return Object.entries(row)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" | ");
}

/** Enumerate every enum value in a discriminated-union-ish object as cases. */
export function enumCases<T extends string>(
  values: readonly T[],
): Array<{ label: string; args: [T] }> {
  return values.map((v) => ({ label: v, args: [v] }));
}

/** Humanize a ColumnType for test descriptions. */
export function columnTypeLabel(t: ColumnType): string {
  switch (t) {
    case "numeric":
      return "numeric";
    case "categorical":
      return "categorical";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "unknown":
      return "unknown";
  }
}

/** Pick numeric-looking column names out of a dataset for stats params. */
export function numericColumns(
  columns: Array<{ name: string; type: ColumnType }>,
): string[] {
  return columns.filter((c) => c.type === "numeric").map((c) => c.name);
}

export function categoricalColumns(
  columns: Array<{ name: string; type: ColumnType }>,
): string[] {
  return columns.filter((c) => c.type === "categorical").map((c) => c.name);
}
