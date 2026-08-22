import type { CleaningConfig, Column } from "@/types";
import { TYPE_COLORS } from "@/lib/palette";

export const TYPE_COLOR = TYPE_COLORS;

/** Auto-collapse sidebar when column count exceeds this threshold */
export const SIDEBAR_COLLAPSE_THRESHOLD = 30;

/** Pixel width for a column, based on header name length + type */
export function getColPx(col: Column): number {
  const minPx = col.type === "categorical" ? 110 : 80;
  const namePx = col.name.length * 7 + 28;
  return Math.max(minPx, namePx);
}

export function collectManipulatedColumns(
  config: CleaningConfig | null,
): string[] {
  if (!config) return [];

  const prioritized: string[] = [];
  const push = (name?: string) => {
    if (!name || prioritized.includes(name)) return;
    prioritized.push(name);
  };

  Object.entries(config.missing).forEach(([column, entry]) => {
    if (entry?.strategy && entry.strategy !== "none") push(column);
  });
  Object.entries(config.outliers).forEach(([column, entry]) => {
    if (entry?.method && entry.method !== "none") push(column);
  });
  config.removeColumns.forEach(push);
  config.typeOverrides.forEach((entry) => push(entry.columnName));
  Object.entries(config.scaling).forEach(([column, entry]) => {
    if (entry?.method && entry.method !== "none") push(column);
  });
  Object.entries(config.encodings).forEach(([column, entry]) => {
    if (entry?.type && entry.type !== "none") push(column);
  });
  config.renameColumns.forEach((entry) => push(entry.from));
  config.stringReplace.forEach((entry) => push(entry.column));
  config.categoryMappings.forEach((entry) => push(entry.column));
  config.mathTransforms.forEach((entry) => push(entry.column));
  config.lagLeadRules.forEach((entry) => push(entry.column));
  config.interactionTerms.forEach((entry) => {
    push(entry.columnA);
    push(entry.columnB);
  });
  config.binRules.forEach((entry) => {
    push(entry.column);
    push(`${entry.column}_bin`);
  });
  config.dateExtraction.forEach((entry) => push(entry.column));
  config.derivedColumns.forEach((entry) => push(entry.name));
  if (config.rowFilter.enabled) push(config.rowFilter.column);

  return prioritized;
}
