/** Shared colour constants – import instead of hard-coding hex values. */

export const CHART_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#7c2d12",
  "#1f2937",
] as const;

export const TYPE_COLORS: Record<string, string> = {
  numeric: "#0d9488",
  categorical: "#f59e0b",
  date: "#15803d",
  boolean: "#7c3aed",
  text: "#64748b",
};

export const CORR_COLORS = {
  positive: "#0d9488",
  negative: "#dc2626",
  neutral: "#94a3b8",
  diagonal: "#0f172a",
} as const;

export const STATUS_COLORS = {
  verified: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
} as const;
