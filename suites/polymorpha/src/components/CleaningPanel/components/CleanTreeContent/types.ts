import type { ReactNode } from "react";
import type { CleaningConfig, Column, Dataset } from "@/types";
import type { CleanStepId } from "@/components/CleaningPanel/types";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import type { RowGateWarning } from "@/components/CleaningPanel/components/RowGateStep";
import type { DuplicateLiveCount } from "@/components/CleaningPanel/components/DuplicatesStep";
import type {
  MissingColumnEntry,
  MissingFillPreview,
} from "@/components/CleaningPanel/components/MissingStep";
import type { OutlierLiveCount } from "@/components/CleaningPanel/components/OutlierStep";

export type {
  MissingColumnEntry,
  MissingFillPreview,
} from "@/components/CleaningPanel/components/MissingStep";
export type { OutlierLiveCount } from "@/components/CleaningPanel/components/OutlierStep";

export type Step__RowGateProps = {
  warning: RowGateWarning;
};

export type Step__MissingProps = {
  showResolved: boolean;
  onToggleShowResolved: () => void;
  columns: MissingColumnEntry[];
  highAttentionCount: number;
  activeColumn: MissingColumnEntry | null;
  activeColumnName: string;
  onFocusColumn: (columnName: string) => void;
  fillPreview: MissingFillPreview;
};

export type Step__OutlierProps = {
  candidates: Column[];
  skipped: Column[];
  activeColumn: Column | null;
  activeColumnName: string;
  onFocusColumn: (columnName: string) => void;
  liveCount: OutlierLiveCount;
};

export type Step__DuplicatesProps = {
  liveCount: DuplicateLiveCount;
};

export type Step__ColumnsProps = {
  activeColumn: Column | null;
  activeColumnName: string;
  onFocusColumn: (columnName: string) => void;
};

export type Step__ExploreProps = {
  data: Dataset | null;
  computed: ComputedStats | null;
};

export type CleanTreeContentProps = {
  activeStep: CleanStepId;
  raw: Dataset;
  cleaned: Dataset | null;
  cleaningConfig: CleaningConfig;
  configuredSteps: Set<CleanStepId>;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  numericColumns: Column[];

  step__rowGate: Step__RowGateProps;
  step__missing: Step__MissingProps;
  step__outlier: Step__OutlierProps;
  step__duplicates: Step__DuplicatesProps;
  step__columns: Step__ColumnsProps;
  step__explore: Step__ExploreProps;
};
