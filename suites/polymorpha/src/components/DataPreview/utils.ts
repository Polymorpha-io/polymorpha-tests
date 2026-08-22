import type { ColumnType } from "@/types";
import { Columns } from "@/constants/schema";
import { ValidCols } from "./constants";

/**
 * Safely coerces an arbitrary string (or null/undefined) into a known
 * {@link ColumnType}.
 *
 * @remarks
 * Used to normalize column type identifiers coming from external sources
 * (e.g. parsed CSV headers, persisted snapshots, or user overrides) into the
 * closed set of supported types. Matching is case-insensitive and the
 * canonical lower-case identifier is always returned. `null`, `undefined`,
 * empty, or otherwise unrecognized values fall back to {@link Columns.Unknown}
 * rather than throwing, so callers can always rely on a valid
 * {@link ColumnType} being returned.
 *
 * @example
 * ```typescript
 * toColumnType("numeric");     // "numeric"
 * toColumnType("Numeric");     // "numeric"
 * toColumnType("categorical"); // "categorical"
 * toColumnType("made-up");     // "unknown"
 * toColumnType(null);          // "unknown"
 * ```
 *
 * @param type - The raw type string to validate and coerce.
 * @returns The matching {@link ColumnType}, or {@link Columns.Unknown} if the
 *   value is not part of the supported column types.
 *
 * @see {@link Columns} for the set of valid column type identifiers.
 */
export function toColumnType(type: string | null | undefined): ColumnType {
  if (type == null) {
    return Columns.Unknown;
  }

  const normalized = type.toLowerCase();
  return ValidCols.has(normalized as ColumnType)
    ? (normalized as ColumnType)
    : Columns.Unknown;
}
