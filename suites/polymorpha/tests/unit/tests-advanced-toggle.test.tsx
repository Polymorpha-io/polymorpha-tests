import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TestsConfigPanel } from "@/components/AnalysePanel/tabs/TestsConfigPanel";
import { EMPTY_TEST_SELECTION } from "@/components/AnalysePanel/analyseHelpers";
import { CORE_TEST_KEYS } from "@/lib/taxonomy/properHomes";
import type { TestKey } from "@/components/AnalysePanel/analyseHelpers";
import type { Dataset } from "@/types";

const CLEANED: Dataset = {
  fileName: "df.csv",
  uploadedAt: new Date(0),
  columns: [
    { name: "c0", type: "numeric", detectedType: "numeric" },
    { name: "c1", type: "categorical", detectedType: "categorical" },
  ],
  rows: [{ c0: 1, c1: "a" }],
};

function renderPanel(overrides?: {
  activeTestKey?: TestKey;
  statsLevel?: "basic" | "advanced" | "professional";
  setTestError?: (e: string | null) => void;
  setActiveTestKey?: (k: TestKey) => void;
}) {
  const noop = vi.fn();
  return render(
    <TestsConfigPanel
      statsLevel={overrides?.statsLevel ?? "professional"}
      activeTestKey={overrides?.activeTestKey ?? "tTest"}
      setActiveTestKey={overrides?.setActiveTestKey ?? noop}
      setActiveTestGroup={noop}
      setTestError={overrides?.setTestError ?? noop}
      selectedTests={{ ...EMPTY_TEST_SELECTION }}
      setSelectedTests={noop}
      testHasResults={() => false}
      configCard={null}
      activeTestSummary={undefined}
      testWarnings={[]}
      testError={null}
      isRunning={false}
      currentTest=""
      activeTestCanRun={false}
      runSingleTest={noop}
      disabledReason={null}
      autoVizCols={null}
      vizModalOpen={false}
      setVizModalOpen={noop}
      vizChartType="auto"
      setVizChartType={noop}
      cleaned={CLEANED}
      testHighlights={[]}
      formulaCards={[]}
      resultRecommendations={[]}
    />,
  );
}

describe("tests advanced toggle (locked audit table)", () => {
  it("curates exactly the locked core-10", () => {
    expect([...CORE_TEST_KEYS].sort()).toEqual(
      [
        "tTest",
        "anova",
        "welchAnova",
        "mannWhitney",
        "kruskal",
        "wilcoxon",
        "chiSquare",
        "fisher",
        "correlation",
        "regression",
      ].sort(),
    );
  });

  it("lists core tests by default and hides advanced behind the toggle", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "t-test" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Friedman" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Show advanced \(\d+\)/ }),
    ).toBeInTheDocument();
  });

  it("reveals advanced tests on toggle with aria-expanded", () => {
    renderPanel();
    const toggle = screen.getByRole("button", { name: /Show advanced/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "Friedman" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Show less" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("keeps an active advanced test listed with the toggle off", () => {
    renderPanel({ activeTestKey: "friedman" });
    expect(
      screen.getByRole("button", { name: "Friedman" }),
    ).toBeInTheDocument();
  });

  it("selects a revealed advanced test with no lock (paywall removed)", () => {
    const setActiveTestKey = vi.fn();
    const setTestError = vi.fn();
    renderPanel({ setActiveTestKey, setTestError });
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/ }));
    fireEvent.click(screen.getByRole("button", { name: "Friedman" }));
    // Selects directly: no lock class, no upgrade error.
    expect(setActiveTestKey).toHaveBeenCalledWith("friedman");
    expect(setTestError).toHaveBeenCalledWith(null);
    expect(document.querySelector(".tests-sidebar-lock")).toBeNull();
  });

  it("respects the statsLevel group filter in the hidden count", () => {
    renderPanel({ statsLevel: "basic" });
    // Basic shows 3 groups; hidden = advanced within those groups only.
    const toggle = screen.getByRole("button", {
      name: /Show advanced \(\d+\)/,
    });
    expect(toggle).toBeInTheDocument();
    expect(screen.queryByText("Distribution checks")).toBeNull();
  });
});
