import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CleaningPanel } from "@/components/CleaningPanel/CleaningPanel";

// Heavy children are stubbed: this suite owns the embedded/output-only
// contract (tree absent when embedded, present otherwise), not their
// internals.
vi.mock("@/components/CleaningPanel/components/DatasetIdentity", () => ({
  DatasetIdentity: () => <div data-testid="stub-identity" />,
}));
vi.mock("@/components/CleaningPanel/components/DataTable", () => ({
  DataTable: () => <div data-testid="stub-table" />,
}));
vi.mock("@/components/CleaningPanel/components/ProcessingTree", () => ({
  ProcessingTree: () => <div data-testid="stub-tree" />,
}));
vi.mock("@/components/CleaningPanel/components/TabBar", () => ({
  TabBar: () => <div data-testid="stub-tabbar" />,
}));
vi.mock("@/components/CodeCopy/CopyPythonButton", () => ({
  CopyPythonButton: () => <button>Copy Python</button>,
}));

const baseState = {
  raw: { fileName: "df.csv", columns: [], rows: [] },
  cleaningConfig: {},
  cleaned: null,
  diff: null,
  exploreSource: "after",
  setExploreSource: vi.fn(),
  activeTab: "data",
  setActiveTab: vi.fn(),
  activeStepWarnings: [],
};

vi.mock("@/components/CleaningPanel/useCleaningPanelState", () => ({
  useCleaningPanelState: () => baseState,
}));

describe("CleaningPanel embedded", () => {
  it("renders output-only without the functionality tree", () => {
    render(<CleaningPanel embedded />);
    expect(screen.getByTestId("stub-identity")).toBeInTheDocument();
    expect(screen.getByTestId("stub-table")).toBeInTheDocument();
    expect(screen.getByText("Apply changes")).toBeInTheDocument();
    expect(screen.queryByTestId("stub-tree")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stub-tabbar")).not.toBeInTheDocument();
  });

  it("keeps the full tree standalone", () => {
    render(<CleaningPanel />);
    // Clean + Explore tabs each keep a mounted tree.
    expect(screen.getAllByTestId("stub-tree").length).toBeGreaterThan(0);
    expect(screen.getByTestId("stub-tabbar")).toBeInTheDocument();
  });
});
