import type {
  BuildImpactSummaryInput,
  ImpactSummary,
  ImpactSummaryItem,
} from "./types";

function sumValues(values?: Record<string, number>) {
  return Object.values(values ?? {}).reduce((sum, value) => sum + value, 0);
}

export function buildImpactSummary({
  diff,
  stepPreview,
  totalRows,
  totalCells,
}: BuildImpactSummaryInput): ImpactSummary {
  if (!diff && !stepPreview) {
    return { estimated: false, items: [] };
  }

  const rowsRemoved = stepPreview?.rowsRemoved ?? diff?.rowsRemoved ?? 0;
  const valuesImputed =
    stepPreview?.valuesImputed ?? sumValues(diff?.valuesImputed);
  const outliersHandled =
    stepPreview?.outliersHandled ?? sumValues(diff?.outliersHandled);
  const columnsRemoved =
    stepPreview?.columnsRemoved ?? diff?.columnsRemoved ?? 0;
  const impactDiff = stepPreview?.diff ?? diff;

  const items: ImpactSummaryItem[] = [
    {
      id: "rows-removed",
      value: String(rowsRemoved),
      label: "Rows removed",
      ...(!stepPreview && totalRows > 0
        ? { detail: `(${((rowsRemoved / totalRows) * 100).toFixed(1)}%)` }
        : {}),
    },
    {
      id: "values-imputed",
      value: String(valuesImputed),
      label: "Values imputed",
      ...(!stepPreview && totalCells > 0
        ? { detail: `(${((valuesImputed / totalCells) * 100).toFixed(1)}%)` }
        : {}),
    },
    {
      id: "outliers-handled",
      value: String(outliersHandled),
      label: "Outliers handled",
    },
    {
      id: "columns-removed",
      value: String(columnsRemoved),
      label: "Columns removed",
    },
  ];

  if (impactDiff && (impactDiff.indicatorColumnsAdded?.length ?? 0) > 0) {
    items.push({
      id: "indicator-columns-added",
      value: String(impactDiff.indicatorColumnsAdded?.length),
      label: "Indicator columns added",
    });
  }
  if (impactDiff && (impactDiff.renamedColumns ?? 0) > 0) {
    items.push({
      id: "columns-renamed",
      value: String(impactDiff.renamedColumns),
      label: "Columns renamed",
    });
  }
  if (impactDiff && (impactDiff.scaledColumns?.length ?? 0) > 0) {
    items.push({
      id: "columns-scaled",
      value: String(impactDiff.scaledColumns?.length),
      label: "Columns scaled",
    });
  }
  if (
    impactDiff &&
    (impactDiff.sampledRows ?? 0) > 0 &&
    (impactDiff.sampledRows ?? 0) < totalRows
  ) {
    items.push({
      id: "rows-sampled",
      value: String(impactDiff.sampledRows),
      label: "Rows retained after sampling",
    });
  }
  if (impactDiff && (impactDiff.duplicatesRemoved ?? 0) > 0) {
    items.push({
      id: "duplicates-removed",
      value: String(impactDiff.duplicatesRemoved),
      label: "Duplicates removed",
    });
  }
  if (impactDiff && (impactDiff.encodingLog?.length ?? 0) > 0) {
    items.push({
      id: "columns-encoded",
      value: String(impactDiff.encodingLog?.length),
      label: "Columns encoded",
    });
  }

  if (impactDiff && (impactDiff.columnsAdded?.length ?? 0) > 0) {
    items.push({
      id: "columns-added",
      value: `+${impactDiff.columnsAdded?.length}`,
      label: "Columns added",
    });
  }
  if (impactDiff && (impactDiff.stringReplacesApplied ?? 0) > 0) {
    items.push({
      id: "replacements",
      value: String(impactDiff.stringReplacesApplied),
      label: "Replacements",
    });
  }
  if (impactDiff && (impactDiff.categoryMappingsApplied ?? 0) > 0) {
    items.push({
      id: "categories-mapped",
      value: String(impactDiff.categoryMappingsApplied),
      label: "Categories mapped",
    });
  }
  if (impactDiff && (impactDiff.mathTransformsApplied ?? 0) > 0) {
    items.push({
      id: "values-transformed",
      value: String(impactDiff.mathTransformsApplied),
      label: "Values transformed",
    });
  }
  if (impactDiff?.sortApplied) {
    items.push({ id: "rows-sorted", label: "Rows sorted" });
  }

  return {
    estimated: !diff && Boolean(stepPreview),
    items,
  };
}
