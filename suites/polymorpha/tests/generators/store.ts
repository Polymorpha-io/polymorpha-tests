/**
 * Store hydration helpers — replaces the repeated `beforeEach` boilerplate
 * (`useConfigStore.setState` + `useDataStore.setState`) in component tests.
 */
import { useConfigStore } from "@/store/useConfigStore";
import { useDataStore } from "@/store/useDataStore";
import type { HydratePayload } from "@/store/useDataStore";
import { usePrefsStore } from "@/store/usePrefsStore";
import type {
  AppStep,
  CleaningConfig,
  CleaningDiff,
  DataOperationStep,
  Dataset,
  StatsResults,
} from "@/types";

export interface HydrateStoresOptions {
  dataset: Dataset;
  config?: CleaningConfig | null;
  cleaned?: Dataset | null;
  diff?: CleaningDiff | null;
  step?: AppStep;
  appliedSteps?: DataOperationStep[];
  cart?: HydratePayload["cart"];
  uploadId?: string;
  workspaceId?: string;
  results?: StatsResults | null;
  /** `true` unlocks premium features in feature-flagged UI */
  betaAllPremium?: boolean;
  /** raw dataset preflight warnings — defaults to [] */
  preflightWarnings?: HydratePayload["preflightWarnings"];
}

/** Build a full HydratePayload for useDataStore.hydrateForWorkspace. */
export function makeHydratePayload(opts: HydrateStoresOptions): HydratePayload {
  return {
    raw: opts.dataset,
    cleaned: opts.cleaned ?? null,
    cleaningConfig: opts.config ?? null,
    cleaningDiff: opts.diff ?? null,
    results: opts.results ?? null,
    exportPreferences: {},
    cart: opts.cart ?? [],
    uploadId: opts.uploadId ?? "test-upload",
    workspaceId: opts.workspaceId ?? "test-workspace",
    step: opts.step ?? "preview",
    appliedSteps: opts.appliedSteps ?? [],
    preflightWarnings: opts.preflightWarnings,
  };
}

/** Reset data/prefs/config stores to clean defaults (call in beforeEach). */
export function resetStores(): void {
  useDataStore.getState().reset();
  usePrefsStore.getState().reset();
}

/** One-call hydration of all three stores for a component test. */
export function hydrateStores(opts: HydrateStoresOptions): void {
  resetStores();
  useConfigStore.setState({
    settings: {
      ...useConfigStore.getState().settings,
      features: {
        ...useConfigStore.getState().settings.features,
        betaAllPremium: opts.betaAllPremium ?? false,
      },
    },
  });
  const payload = makeHydratePayload(opts);
  useDataStore.getState().hydrateForWorkspace(payload);
}
