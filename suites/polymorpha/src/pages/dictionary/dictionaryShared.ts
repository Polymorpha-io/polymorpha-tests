/**
 * Shared helpers for the public dictionary pages.
 */
import type { NavigateFunction } from "react-router-dom";
import type { DictionaryEntry } from "@polymorpha/business-logic";

type DictionaryNavState = {
  from?: string;
};

export function termUrl(term: DictionaryEntry): string {
  return `/dictionary/${term.category}/${term.id}`;
}

export function goBackOrFallback(
  navigate: NavigateFunction,
  state: unknown,
  fallback: string,
): void {
  // Attempt browser-like back: use history stack if we have internal state,
  // otherwise navigate(-1) would leave the app if the user came from an external page.
  if (
    state &&
    typeof state === "object" &&
    typeof (state as DictionaryNavState).from === "string"
  ) {
    navigate(-1);
  } else if (window.history.length > 2) {
    navigate(-1);
  } else {
    navigate(fallback, { replace: true });
  }
}

export function metricBarWidth(value: number): string {
  const safe = Math.max(0, Math.min(100, value));
  return `${safe}%`;
}
