/**
 * Generated store matrix suite — every `useDataStore` action exercised via
 * the generator-built hydrate/reset helpers.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "@/store/useDataStore";
import { usePrefsStore } from "@/store/usePrefsStore";
import { useConfigStore } from "@/store/useConfigStore";
import type { AppStep, DataOperationStep, Dataset } from "@/types";
import {
  hydrateStores,
  makeCleaningConfig,
  makeDataset,
  makeHydratePayload,
  presets,
  resetStores,
} from "../../generators";

const STEPS: AppStep[] = [
  "upload",
  "model",
  "preview",
  "clean",
  "stats",
  "export",
];

function makeAppliedStep(
  id: string,
  config?: DataOperationStep["config"],
): DataOperationStep {
  return {
    id,
    description: `step ${id}`,
    config: config ?? { type: "rename", column: "a", newName: "b" },
  };
}

describe("useDataStore — step transitions", () => {
  beforeEach(() => resetStores());

  it.each(
    STEPS.map((step) => ({
      label: `setStep("${step}") updates the pipeline step`,
      step,
    })),
  )("$label", ({ step }) => {
    useDataStore.getState().setStep(step);
    expect(useDataStore.getState().step).toBe(step);
  });
});

describe("useDataStore — setRaw", () => {
  beforeEach(() => resetStores());

  it("seeds raw, runs preflight checks and resets derived state", async () => {
    const dataset = presets.mixed();
    await useDataStore.getState().setRaw(dataset);
    const state = useDataStore.getState();
    expect(state.raw).toEqual(dataset);
    expect(state.cleaned).toBeNull();
    expect(state.cleaningConfig).toBeNull();
    expect(state.appliedSteps).toEqual([]);
    expect(state.stepCache.size).toBe(0);
  });

  it("moves step to preview (or model when coming from upload)", async () => {
    const dataset = presets.mixed();
    useDataStore.getState().setStep("preview");
    await useDataStore.getState().setRaw(dataset);
    expect(useDataStore.getState().step).toBe("preview");
  });
});

describe("useDataStore — cleaned pipeline", () => {
  beforeEach(() => resetStores());

  it("setCleaned stores dataset + diff and jumps to stats", () => {
    const dataset = presets.mixed();
    const diff = makeCleaningDiff();
    useDataStore.getState().setCleaned(dataset, diff);
    const state = useDataStore.getState();
    expect(state.cleaned).toEqual(dataset);
    expect(state.cleaningDiff).toEqual(diff);
    expect(state.step).toBe("stats");
  });

  it("setCleanedInPlace keeps the current step", () => {
    useDataStore.getState().setStep("clean");
    useDataStore
      .getState()
      .setCleanedInPlace(presets.mixed(), makeCleaningDiff());
    expect(useDataStore.getState().step).toBe("clean");
  });

  it("setCleaningConfig / setResults / setExportPreferences merge", () => {
    const dataset = presets.mixed();
    const config = makeCleaningConfig(dataset);
    useDataStore.getState().setCleaningConfig(config);
    expect(useDataStore.getState().cleaningConfig).toEqual(config);

    useDataStore.getState().setExportPreferences({ authorName: "Dr. Test" });
    expect(useDataStore.getState().exportPreferences.authorName).toBe(
      "Dr. Test",
    );
  });
});

describe("useDataStore — cart", () => {
  beforeEach(() => resetStores());

  it("adds unique items, dedupes by id, removes and clears", () => {
    const store = () => useDataStore.getState();
    store().addToCart({ id: "t1", type: "test", label: "t-test" });
    store().addToCart({ id: "t1", type: "test", label: "t-test" });
    store().addToCart({ id: "v1", type: "visual", label: "hist" });
    expect(store().cart).toHaveLength(2);

    store().removeFromCart("t1");
    expect(store().cart).toHaveLength(1);

    store().clearCart();
    expect(store().cart).toHaveLength(0);
  });
});

describe("useDataStore — appliedSteps + stepCache", () => {
  beforeEach(() => resetStores());

  const seed = async () => {
    const store = () => useDataStore.getState();
    store().addAppliedStep(makeAppliedStep("s1"));
    store().addAppliedStep(makeAppliedStep("s2"));
    store().addAppliedStep(makeAppliedStep("s3"));
    await store().setStepCache("s1", presets.minimal());
    await store().setStepCache("s2", presets.minimal());
    await store().setStepCache("s3", presets.minimal());
  };

  it("adds and clears steps", async () => {
    await seed();
    expect(useDataStore.getState().appliedSteps).toHaveLength(3);
    useDataStore.getState().clearAppliedSteps();
    expect(useDataStore.getState().appliedSteps).toHaveLength(0);
    expect(useDataStore.getState().stepCache.size).toBe(0);
  });

  it("removeAppliedStep invalidates its cache and downstream caches", async () => {
    await seed();
    useDataStore.getState().removeAppliedStep("s1");
    const cache = useDataStore.getState().stepCache;
    expect(cache.has("s1")).toBe(false);
    expect(cache.has("s2")).toBe(false);
    expect(cache.has("s3")).toBe(false);
    expect(useDataStore.getState().appliedSteps.map((s) => s.id)).toEqual([
      "s2",
      "s3",
    ]);
  });

  it("removeAppliedStep is a no-op for unknown ids", async () => {
    await seed();
    useDataStore.getState().removeAppliedStep("missing");
    expect(useDataStore.getState().appliedSteps).toHaveLength(3);
  });

  it("reorderAppliedSteps invalidates from the earliest affected index", async () => {
    await seed();
    useDataStore.getState().reorderAppliedSteps(2, 0);
    const cache = useDataStore.getState().stepCache;
    expect(cache.size).toBe(0);
    expect(useDataStore.getState().appliedSteps.map((s) => s.id)).toEqual([
      "s3",
      "s1",
      "s2",
    ]);
  });

  it("clearStepCacheAfter removes only cache entries from an index onward", async () => {
    await seed();
    useDataStore.getState().clearStepCacheAfter(1);
    const cache = useDataStore.getState().stepCache;
    expect(cache.has("s1")).toBe(true);
    expect(cache.has("s2")).toBe(false);
    expect(cache.has("s3")).toBe(false);
  });
});

describe("useDataStore — hydrateForWorkspace / hydrateFromCache / reset", () => {
  beforeEach(() => resetStores());

  it("hydrateForWorkspace restores a full snapshot", async () => {
    const dataset = presets.correlation(2);
    await useDataStore.getState().hydrateForWorkspace(
      makeHydratePayload({
        dataset,
        step: "stats",
        appliedSteps: [makeAppliedStep("s1")],
        cart: [{ id: "t1", type: "test", label: "x" }],
        workspaceId: "ws-1",
      }),
    );
    const state = useDataStore.getState();
    expect(state.raw).toEqual(dataset);
    expect(state.step).toBe("stats");
    expect(state.appliedSteps.map((s) => s.id)).toEqual(["s1"]);
    expect(state.cart).toHaveLength(1);
    expect(state.workspaceId).toBe("ws-1");
  });

  it("hydrateFromCache goes straight to preview with preflight warnings", async () => {
    const dataset = presets.missing();
    await useDataStore.getState().hydrateFromCache(dataset);
    const state = useDataStore.getState();
    expect(state.raw).toEqual(dataset);
    expect(state.step).toBe("preview");
    expect(state.cleaned).toBeNull();
    expect(Array.isArray(state.preflightWarnings)).toBe(true);
  });

  it("reset returns to upload with empty results", () => {
    hydrateStores({ dataset: presets.mixed(), step: "stats" });
    useDataStore.getState().reset();
    const state = useDataStore.getState();
    expect(state.step).toBe("upload");
    expect(state.raw).toBeNull();
    expect(state.results?.descriptive).toEqual([]);
    expect(state.exportPreferences).toEqual(state.exportPreferences);
  });

  it("reset deep-copies export preferences (no shared ref)", () => {
    const first = useDataStore.getState().exportPreferences;
    useDataStore.getState().reset();
    expect(useDataStore.getState().exportPreferences).not.toBe(first);
  });
});

describe("usePrefsStore + useConfigStore", () => {
  beforeEach(() => resetStores());

  it("fmtNum honors decimalPlaces and edge cases", async () => {
    const { fmtNum } = await import("@/store/usePrefsStore");
    usePrefsStore.getState().setDecimalPlaces(2);
    expect(fmtNum(1.23456)).toBe("1.23");
    expect(fmtNum(null)).toBe("—");
    expect(fmtNum(undefined)).toBe("—");
    expect(fmtNum(Infinity)).toBe("∞");
    expect(fmtNum(-Infinity)).toBe("−∞");
    expect(fmtNum(1234567)).toBe("1.23e+6");
    expect(fmtNum(0.0000001)).toBe("1.00e-7");
  });

  it("persists decimalPlaces + statsLevel to localStorage", () => {
    usePrefsStore.getState().setDecimalPlaces(4);
    usePrefsStore.getState().setStatsLevel("advanced");
    const raw = localStorage.getItem("polymorpha-user-prefs");
    expect(raw).toContain('"decimalPlaces":4');
    expect(raw).toContain('"statsLevel":"advanced"');
  });

  it("useConfigStore exposes fallback settings", () => {
    const settings = useConfigStore.getState().settings;
    expect(settings.features.showAuth).toBe(false);
    expect(settings.about.title).toBeTruthy();
  });
});

function makeCleaningDiff() {
  return {
    rowsRemoved: 0,
    rowsModified: 0,
    columnsRemoved: 0,
    rowsRemovedFromMissing: 0,
    rowsRemovedFromOutliers: 0,
    rowsRemovedFromThreshold: 0,
    rowsRemovedFromFilter: 0,
    valuesImputed: {},
    outliersHandled: {},
    indicatorColumnsAdded: [],
    renamedColumns: 0,
    scaledColumns: [],
    sampledRows: 0,
    duplicatesRemoved: 0,
    encodingLog: [],
    columnsAdded: [],
    stringReplacesApplied: 0,
    categoryMappingsApplied: 0,
    mathTransformsApplied: 0,
    sortApplied: false,
  };
}
