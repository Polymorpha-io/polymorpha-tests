import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModellerInspector } from "@/components/DataPreview/modeller/ModellerInspector";
import { useDataStore } from "@/store/useDataStore";
import type { Column, Dataset, Row } from "@/types";

const COLUMNS: Column[] = [
  { name: "age", type: "numeric", detectedType: "numeric" },
  { name: "city", type: "string", detectedType: "string" },
] as unknown as Column[];

const ROWS: Row[] = [
  { age: 30, city: "Lima" },
  { age: 25, city: "Oslo" },
] as unknown as Row[];

const SESSION: Dataset = {
  fileName: "sales.csv",
  columns: COLUMNS,
  rows: ROWS,
  uploadedAt: new Date("2026-01-01"),
} as unknown as Dataset;

function renderWorkbench(
  opts: {
    onPasteCodeCell?: (code: string, label: string) => void;
  } = {},
) {
  return render(
    <ModellerInspector
      orderedColumns={COLUMNS}
      previewRows={ROWS}
      fileName="sales.csv"
      workspaceContext={{ datasets: [] } as never}
      extraDatasets={[]}
      allAvailableDatasets={[SESSION]}
      datasets={[SESSION]}
      onPasteCodeCell={opts.onPasteCodeCell}
    />,
  );
}

function openSortSheet() {
  fireEvent.click(screen.getByRole("tab", { name: "Clean" }));
  fireEvent.click(screen.getByRole("button", { name: /Sort rows/ }));
}

describe("ModellerInspector op Sheet (workbench)", () => {
  beforeEach(() => {
    useDataStore.setState({ appliedSteps: [] });
  });

  it("clicking an op opens the detail Sheet without pasting a cell", () => {
    const onPaste = vi.fn();
    renderWorkbench({ onPasteCodeCell: onPaste });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openSortSheet();
    // Sheet (right panel detail) opens; nothing is pasted on click.
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
    expect(screen.getByText("Sort (multi-col + dir)")).toBeInTheDocument();
    expect(onPaste).not.toHaveBeenCalled();
  });

  it("Apply pastes an editable code cell and records no step", async () => {
    const onPaste = vi.fn();
    renderWorkbench({ onPasteCodeCell: onPaste });
    const before = useDataStore.getState().appliedSteps.length;
    openSortSheet();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onPaste).toHaveBeenCalledTimes(1);
    const [code, label] = onPaste.mock.calls[0];
    expect(code).toContain("sort_values");
    expect(code).toContain("age");
    expect(label).toContain("Sort by age");
    // Paste-only: the store gains no transforming step.
    expect(useDataStore.getState().appliedSteps.length).toBe(before);
    // Sheet closes after Apply.
    await waitFor(() =>
      expect(
        screen.queryByText("Sort (multi-col + dir)"),
      ).not.toBeInTheDocument(),
    );
  });

  it("standalone Apply still records a step (no paste host)", () => {
    renderWorkbench();
    const before = useDataStore.getState().appliedSteps.length;
    openSortSheet();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(useDataStore.getState().appliedSteps.length).toBe(before + 1);
  });
});
