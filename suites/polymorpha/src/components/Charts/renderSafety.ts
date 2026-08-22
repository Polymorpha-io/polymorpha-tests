import { validationRules as rules } from "@polymorpha/business-logic";
import type { Dataset } from "@/types";

export interface RenderSafetyResult {
  isSafe: boolean;
  warnings: string[];
  blocks: string[];
}

type ValidationRule = (typeof rules)[keyof typeof rules];

/**
 * Phase 3: Render-Safety Checks
 *
 * Prevents UI crashes and browser freezes by intercepting edge cases
 * specific to rendering (e.g. overplotting, extreme cardinality).
 */
export function checkRenderSafety(
  chartType: string,
  dataset: Dataset,
  mapping: Record<string, string>,
): RenderSafetyResult {
  const result: RenderSafetyResult = { isSafe: true, warnings: [], blocks: [] };

  // Find matching chart rule in catalog based on exact match or keyword inclusion
  const ruleKey = (Object.keys(rules) as Array<keyof typeof rules>).find(
    (k) => {
      const rule = rules[k] as ValidationRule;
      return (
        rule.category === "Charts" &&
        (k.toLowerCase().includes(chartType.toLowerCase()) ||
          chartType
            .toLowerCase()
            .includes(k.split("/")[0].trim().toLowerCase()))
      );
    },
  );

  const rule: ValidationRule | null = ruleKey
    ? (rules[ruleKey] as ValidationRule)
    : null;

  const constraints = rule 
    ? [...(rule.data_quality_edge_cases || []), ...(rule.algorithmic_edge_cases || [])].join(' ').toLowerCase()
    : '';

  const { rows } = dataset;
  const n = rows.length;

  // 1. Overplotting / Massive Data (Scatter, Line)
  if (constraints.includes('overplotting') || constraints.includes('millions of points')) {
    if (n > 50000) {
      result.warnings.push(`Warning: Attempting to render ${n.toLocaleString()} points. This may cause browser lag. Consider sampling or binning.`);
    }
    if (n > 500000) {
      result.blocks.push(`Block: Cannot render ${n.toLocaleString()} points due to browser memory limits. Please sample the data.`);
      result.isSafe = false;
    }
  }

  // 2. High Cardinality (Bar, Pie, Box Plot categories)
  const categoryCol = mapping['category'] || mapping['x'];
  if (categoryCol && constraints.includes('100+ categories')) {
    const uniqueVals = new Set(rows.map(r => r[categoryCol]).filter(v => v !== null && v !== undefined));
    if (uniqueVals.size > 100) {
      result.warnings.push(`Warning: Column '${categoryCol}' has ${uniqueVals.size} distinct categories. The chart will be unreadable. Consider grouping into 'Other'.`);
    }
    if (uniqueVals.size > 500) {
      result.blocks.push(`Block: Cannot render ${uniqueVals.size} distinct categories on the axis.`);
      result.isSafe = false;
    }
  }

  // 3. Negative sizes (Bubble chart)
  const sizeCol = mapping['size'];
  if (sizeCol && constraints.includes('negative bubble sizes')) {
    const hasNegative = rows.some(r => typeof r[sizeCol] === 'number' && (r[sizeCol] as number) < 0);
    if (hasNegative) {
      result.blocks.push(`Block: Size column '${sizeCol}' contains negative values, which cannot be rendered as bubble sizes.`);
      result.isSafe = false;
    }
  }

  // 4. Heatmap/Contour specific
  if (chartType.toLowerCase().includes('heatmap') || chartType.toLowerCase().includes('contour')) {
    if (constraints.includes('uniform values')) {
      const zCol = mapping['z'];
      if (zCol) {
        const firstVal = rows[0]?.[zCol];
        const isUniform = rows.every(r => r[zCol] === firstVal);
        if (isUniform && rows.length > 0) {
          result.warnings.push(`Warning: All values in '${zCol}' are identical. Colormap interpolation will fail.`);
        }
      }
    }
  }

  return result;
}
