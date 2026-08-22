import {
  BarChart2,
  Database,
  Download,
  Eye,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { AppStep } from "@/types";

export type StepperStep = {
  id: AppStep;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const STEPS_ID = {
  upload: "upload",
  model: "model",
  preview: "preview",
  clean: "clean",
  stats: "stats",
  export: "export",
} as const satisfies Record<AppStep, AppStep>;

export const STEPS_LABEL = {
  [STEPS_ID.upload]: "Upload",
  [STEPS_ID.model]: "Data Modeller",
  [STEPS_ID.preview]: "Preview",
  [STEPS_ID.clean]: "Process",
  [STEPS_ID.stats]: "Analyse",
  [STEPS_ID.export]: "Export",
} as const satisfies Record<AppStep, string>;

export const STEPS_ICON = {
  [STEPS_ID.upload]: Upload,
  [STEPS_ID.model]: Database,
  [STEPS_ID.preview]: Eye,
  [STEPS_ID.clean]: Sparkles,
  [STEPS_ID.stats]: BarChart2,
  [STEPS_ID.export]: Download,
} as const satisfies Record<AppStep, LucideIcon>;

export const STEPS_DESCRIPTION = {
  [STEPS_ID.upload]: "Add your CSV or Excel file",
  [STEPS_ID.model]: "Shape and map your column types",
  [STEPS_ID.preview]: "Review your data before processing",
  [STEPS_ID.clean]: "Clean missing values and outliers",
  [STEPS_ID.stats]: "Run statistics and explore results",
  [STEPS_ID.export]: "Download your report or dataset",
} as const satisfies Record<AppStep, string>;

export const STEPS = {
  [STEPS_ID.upload]: {
    id: STEPS_ID.upload,
    label: STEPS_LABEL[STEPS_ID.upload],
    description: STEPS_DESCRIPTION[STEPS_ID.upload],
    icon: STEPS_ICON[STEPS_ID.upload],
  },
  [STEPS_ID.model]: {
    id: STEPS_ID.model,
    label: STEPS_LABEL[STEPS_ID.model],
    description: STEPS_DESCRIPTION[STEPS_ID.model],
    icon: STEPS_ICON[STEPS_ID.model],
  },
  [STEPS_ID.preview]: {
    id: STEPS_ID.preview,
    label: STEPS_LABEL[STEPS_ID.preview],
    description: STEPS_DESCRIPTION[STEPS_ID.preview],
    icon: STEPS_ICON[STEPS_ID.preview],
  },
  [STEPS_ID.clean]: {
    id: STEPS_ID.clean,
    label: STEPS_LABEL[STEPS_ID.clean],
    description: STEPS_DESCRIPTION[STEPS_ID.clean],
    icon: STEPS_ICON[STEPS_ID.clean],
  },
  [STEPS_ID.stats]: {
    id: STEPS_ID.stats,
    label: STEPS_LABEL[STEPS_ID.stats],
    description: STEPS_DESCRIPTION[STEPS_ID.stats],
    icon: STEPS_ICON[STEPS_ID.stats],
  },
  [STEPS_ID.export]: {
    id: STEPS_ID.export,
    label: STEPS_LABEL[STEPS_ID.export],
    description: STEPS_DESCRIPTION[STEPS_ID.export],
    icon: STEPS_ICON[STEPS_ID.export],
  },
} as const satisfies Record<AppStep, StepperStep>;

export const STEP_ORDER = [
  STEPS_ID.upload,
  STEPS_ID.model,
  STEPS_ID.preview,
  STEPS_ID.clean,
  STEPS_ID.stats,
  STEPS_ID.export,
] as const satisfies readonly AppStep[];

export const STEP_INDEX: Record<AppStep, number> = STEP_ORDER.reduce(
  (acc, id, idx) => {
    acc[id] = idx;
    return acc;
  },
  {} as Record<AppStep, number>,
);
