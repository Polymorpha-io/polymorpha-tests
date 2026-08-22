import type { CleanStepId } from "@/components/CleaningPanel/types";
import type { CLEAN_TREE_NAV_VARIANT } from "@/components/CleaningPanel/constants";

export type CleanTreeNavVariant =
  (typeof CLEAN_TREE_NAV_VARIANT)[keyof typeof CLEAN_TREE_NAV_VARIANT];

export type CleanTreeNavProps = {
  activeStep: CleanStepId;
  onSelectStep: (stepId: CleanStepId) => void;
  configuredSteps: Set<CleanStepId>;
  openGroups: string[];
  onOpenGroupsChange: (groups: string[]) => void;
  variant?: CleanTreeNavVariant;
};
