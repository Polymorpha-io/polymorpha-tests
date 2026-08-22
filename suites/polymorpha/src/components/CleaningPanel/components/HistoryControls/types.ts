import type { CleaningDiff } from "@/types";

export type ImpactSummaryItem = {
  id: string;
  value?: string;
  label: string;
  detail?: string;
};

export type ImpactSummary = {
  estimated: boolean;
  items: readonly ImpactSummaryItem[];
};

export type ImpactDiff = Partial<CleaningDiff>;

export type StepPreview = {
  rowsRemoved: number;
  valuesImputed: number;
  outliersHandled: number;
  columnsRemoved: number;
  diff?: ImpactDiff;
};

export type BuildImpactSummaryInput = {
  diff?: ImpactDiff | null;
  stepPreview?: StepPreview | null;
  totalRows: number;
  totalCells: number;
};
