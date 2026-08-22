import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { useDataStore } from "@/store/useDataStore";
import { cleaningPanelDeps } from "../../../generators/mocks";
import { presets } from "../../../generators/dataset";
import { makeCleaningConfig } from "../../../generators/cleaning";
import { hydrateStores, resetStores } from "../../../generators/store";
import { renderCleaningPanelAtStep } from "../../../generators/render";

vi.mock("@/lib/stats/descriptive", () => cleaningPanelDeps.descriptive());
vi.mock("@/lib/stats/recommendations", () =>
  cleaningPanelDeps.recommendations(),
);
vi.mock("@/lib/stats/api", () => cleaningPanelDeps.api());

describe("Missing Values Data Quality", () => {
  const dataset = presets.missing();

  beforeEach(() => {
    resetStores();
    hydrateStores({
      dataset,
      config: makeCleaningConfig(dataset),
      step: "clean",
    });
  });

  it("renders missing values step heading after navigation", async () => {
    await renderCleaningPanelAtStep({
      step: "Missing values",
      group: "Data quality",
    });
    expect(
      screen.getByRole("heading", { name: /Missing values/i, level: 3 }),
    ).toBeInTheDocument();
  });

  it("lists every column from the dataset in the missing-values step", async () => {
    await renderCleaningPanelAtStep({
      step: "Missing values",
      group: "Data quality",
    });
    for (const col of dataset.columns) {
      expect(screen.getAllByText(col.name).length).toBeGreaterThan(0);
    }
  });

  it("starts from the default config (strategy none for every column)", async () => {
    await renderCleaningPanelAtStep({
      step: "Missing values",
      group: "Data quality",
    });
    const config = useDataStore.getState().cleaningConfig;
    expect(config).not.toBeNull();
    for (const col of dataset.columns) {
      expect(config!.missing[col.name]?.strategy).toBe("none");
    }
  });
});
