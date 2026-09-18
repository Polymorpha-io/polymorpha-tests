import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CLEAN_STEPS } from "@/components/CleaningPanel/constants";

// Host the step form in isolation: the Sheet parity contract is that the
// clicked scrub id reaches the editor surface, not the step internals.
vi.mock("@/components/CleaningPanel/components/CleanTreeContent", () => ({
  CleanTreeContent: ({ activeStep }: { activeStep: string }) => (
    <div data-testid="scrub-sheet-form">{activeStep}</div>
  ),
}));

vi.mock("@/components/CleaningPanel/useCleaningPanelState", () => ({
  useCleaningPanelState: () => ({
    raw: { rows: [], columns: [] },
    cleaned: null,
    cleaningConfig: {},
    configuredSteps: new Set<string>(),
    updateConfig: vi.fn(),
    numericColumns: [],
    rowGateProps: { warning: null },
    missingProps: {
      showResolved: false,
      onToggleShowResolved: vi.fn(),
      columns: [],
      highAttentionCount: 0,
      activeColumn: null,
      activeColumnName: "",
      onFocusColumn: vi.fn(),
      fillPreview: null,
    },
    outlierProps: {
      candidates: [],
      skipped: [],
      activeColumn: null,
      activeColumnName: "",
      onFocusColumn: vi.fn(),
      liveCount: null,
    },
    duplicatesProps: { liveCount: null },
    columnsProps: {
      activeColumn: null,
      activeColumnName: "",
      onFocusColumn: vi.fn(),
    },
    exploreProps: {
      data: null,
      computed: null,
      recommendations: [],
      recsLoading: false,
      recsOffline: false,
      allCorrPairs: [],
      warning: null,
    },
  }),
}));

import { ScrubInspectorContent } from "@/components/DataPreview/modeller/ScrubInspectorContent";

describe("Scrub Sheet parity", () => {
  it("starts closed — inspector is a pure navigator like other tabs", () => {
    render(<ScrubInspectorContent />);
    expect(
      screen.getByRole("button", { name: /Missing values/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scrub-sheet-form")).not.toBeInTheDocument();
  });

  it("clicking a card opens the right-side Sheet with that step's form", () => {
    render(<ScrubInspectorContent />);
    fireEvent.click(screen.getByRole("button", { name: /Missing values/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("scrub-sheet-form")).toHaveTextContent(
      CLEAN_STEPS.missing,
    );
  });

  it("switching cards swaps the Sheet form (close, then open another)", () => {
    render(<ScrubInspectorContent />);
    fireEvent.click(screen.getByRole("button", { name: /Missing values/ }));
    expect(screen.getByTestId("scrub-sheet-form")).toHaveTextContent(
      CLEAN_STEPS.missing,
    );
    // Modal Sheet makes the background navigator inert (same as the op
    // Sheet), so close before picking the next step.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: /Outliers/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("scrub-sheet-form")).toHaveTextContent(
      CLEAN_STEPS.outliers,
    );
  });

  it("closing the Sheet returns to the navigator", () => {
    render(<ScrubInspectorContent />);
    fireEvent.click(screen.getByRole("button", { name: /Duplicates/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
