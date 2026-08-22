import type { CLEAN_STEPS } from "./constants";

export type CleanStepId = (typeof CLEAN_STEPS)[keyof typeof CLEAN_STEPS];

export type DetectedIssueSeverity = "high" | "medium" | "low";

export type DetectedIssue = {
  step: CleanStepId;
  label: string;
  severity: DetectedIssueSeverity;
};

export type CleanTreeNode = {
  id: CleanStepId;
  label: string;
};

export type CleanTreeGroup = {
  group: string;
  items: CleanTreeNode[];
  configurable?: boolean;
};
