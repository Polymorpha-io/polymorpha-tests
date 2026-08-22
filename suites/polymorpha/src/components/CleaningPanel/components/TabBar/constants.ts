export const TAB_ID = {
  data: "data",
  workflow: "workflow",
} as const;

export type TabId = (typeof TAB_ID)[keyof typeof TAB_ID];
