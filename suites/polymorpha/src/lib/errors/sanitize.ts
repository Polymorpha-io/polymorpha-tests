/**
 * sanitize — central frontend error sanitization (prevents row/column leakage).
 * Exhaustively strips any occurrence of row payloads, Supported lists, or raw
 * Pydantic dumps before errors reach the UI or are joined into toasts.
 */

const FRIENDLY_UNSUPPORTED: Record<string, string> = {
  tostMean: "TOST Equivalence",
  tost: "TOST Equivalence",
  tostProportion: "TOST Proportion",
  kendallTau: "Kendall's Tau",
  kendall_tau: "Kendall's Tau",
  twoWayAnova: "Two-way ANOVA",
  repeatedAnova: "Repeated Measures ANOVA",
  partialCorrelation: "Partial Correlation",
  pointBiserial: "Point-biserial",
  logisticRegression: "Logistic Regression",
  ridgeRegression: "Ridge Regression",
  lassoRegression: "Lasso Regression",
  mcnemar: "McNemar",
  gofChisquare: "Goodness-of-fit Chi-square",
  friedman: "Friedman",
  binomial: "Binomial Test",
};

/** Canonical alias map — mirrors backend _ACTION_ALIASES. */
export const ACTION_ALIASES: Record<string, string> = {
  tostMean: "tost",
  tostProportion: "tost",
  "mann-whitney": "mannWhitney",
  kendall_tau: "kendallTau",
  gof_chisquare: "gofChisquare",
  gofchisquare: "gofChisquare",
  two_way_anova: "twoWayAnova",
  repeated_anova: "repeatedAnova",
  partial_correlation: "partialCorrelation",
  point_biserial: "pointBiserial",
  logistic_regression: "logisticRegression",
  ridge_regression: "ridgeRegression",
  lasso_regression: "lassoRegression",
};

export function canonicalAction(action: string): string {
  return ACTION_ALIASES[action] ?? action;
}

function stripRowLike(msg: string): string | null {
  const lower = msg.toLowerCase();
  // Heuristic: any dump that contains a row payload or full Pydantic `input` echo
  if (
    lower.includes("'rows'") ||
    lower.includes('"rows"') ||
    lower.includes("'input'") ||
    lower.includes('"input"') ||
    lower.includes("artist name") ||
    lower.includes("total streams") ||
    lower.includes("lead streams") ||
    lower.includes("'loc':") ||
    lower.includes('"loc":')
  ) {
    // If it also mentions Unsupported action, return a friendly mapping instead of blank
    const unsupported = msg.match(/Unsupported action '([^']+)'/i);
    if (unsupported) {
      const act = unsupported[1];
      const friendly = FRIENDLY_UNSUPPORTED[act] ?? act;
      return `This test (${friendly}) is temporarily unavailable. Please try a different variable or retry. (ref: ${act})`;
    }
    return "Request failed due to invalid input. Please check your selected columns and retry.";
  }
  return null;
}

function stripSupportedList(msg: string): string {
  // Remove the internal `Supported: [...]` enumeration entirely
  if (msg.includes("Supported:")) {
    const m = msg.match(/Unsupported action '([^']+)'/);
    if (m) {
      const act = m[1];
      const friendly = FRIENDLY_UNSUPPORTED[act] ?? act;
      return `This test (${friendly}) is temporarily unavailable. Please try a different variable or retry. (ref: ${act})`;
    }
    return "This test is temporarily unavailable. Please retry.";
  }
  return msg;
}

function stripPydanticArtifacts(msg: string): string {
  // Remove `Value error, ` prefix and Python repr noise
  let out = msg;
  if (out.startsWith("Value error, ")) out = out.slice("Value error, ".length);
  // Collapse `Validation error: [...]` brackets noise
  out = out.replace(/^Validation error:\s*/i, "");
  // Remove any `{'type': 'value_error', ...}` dumps that slipped through
  if (out.startsWith("[{'type'") || out.startsWith("{'type'")) {
    const rowLike = stripRowLike(out);
    if (rowLike) return rowLike;
    return "Invalid request. Please check your selected columns and retry.";
  }
  return out;
}

/**
 * Sanitize any error message that might contain row dumps or internal
 * Supported lists. Safe to call on any string (including already-friendly ones).
 */
export function sanitizeStatsError(raw: unknown): string {
  let msg: string;
  if (raw instanceof Error) msg = raw.message;
  else if (typeof raw === "string") msg = raw;
  else if (raw == null) msg = "Unknown error. Please retry.";
  else msg = String(raw);

  msg = msg.trim();
  if (!msg) return "Request failed. Please retry.";

  // 1. Row-like payload → replace entirely
  const rowStripped = stripRowLike(msg);
  if (rowStripped) return truncate(rowStripped, 500);

  // 2. Supported list → friendly
  msg = stripSupportedList(msg);
  const rowStripped2 = stripRowLike(msg);
  if (rowStripped2 && rowStripped2 !== msg) return truncate(rowStripped2, 500);

  // 3. Pydantic artifacts
  msg = stripPydanticArtifacts(msg);

  // 4. Generic cleanup: collapse whitespace, cap length
  msg = msg.replace(/\s+/g, " ").trim();
  return truncate(msg, 500);
}

function truncate(msg: string, max: number): string {
  if (msg.length <= max) return msg;
  return msg.slice(0, max).trim() + "…";
}

/** Sanitize error for Pipeline processing stage (may contain cleaning diff details). */
export function sanitizeProcessError(raw: unknown): string {
  return sanitizeStatsError(raw);
}
