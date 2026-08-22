import type {
  CorrelationMatrix,
  DescriptiveStats,
  FrequencyTable,
  NormalityResult,
} from "@/types";

import { CHART_COLORS } from "@/lib/palette";
export { CHART_COLORS };

/* Re-export canonical test catalog from business-logic (G15 single source) */
export type {
  MainTab,
  ChartType,
  VisMode,
  TestKey,
  TestGroup,
  TestHighlight,
} from "@polymorpha/business-logic";
export {
  TEST_GROUPS,
  TEST_META,
  EMPTY_TEST_SELECTION,
  ADVANCED_TEST_KEYS,
  ANALYSE_TAB_META,
  skewClass,
  corrClass,
  formatColumnLabel,
  humanizeColumnType,
} from "@polymorpha/business-logic";

/* Local helpers that remain in app (not in BL) */
export function isLikelyIdentifierColumn(
  label: string,
  values: unknown[],
): boolean {
  const normalized = label.trim().toLowerCase();
  if (
    /(^|[_\s-])(id|uuid|guid|identifier|recordid|record_id|rowid|row_id|index)([_\s-]|$)/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (values.length < 3) return false;
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== "",
  );
  if (present.length < 3) return false;
  const unique = new Set(present.map((value) => String(value))).size;
  const uniqueRatio = unique / present.length;
  if (uniqueRatio >= 0.98) {
    const idHintPattern =
      /(^|[_\s-])(key|code|no|num|number|seq|serial|pk|fk|ref|hash|token)([_\s-]|$)/;
    const endsWithId = /id$/i.test(normalized);
    return idHintPattern.test(normalized) || endsWithId;
  }
  return false;
}

/* Computed data type */
export interface ComputedStats {
  descriptive: DescriptiveStats[];
  frequencies: FrequencyTable[];
  correlation: CorrelationMatrix | null;
  normality: NormalityResult[];
  numericCols: string[];
  catCols: string[];
}
