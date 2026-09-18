import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ModellerInspector } from "@/components/DataPreview/modeller/ModellerInspector";
import type { Dataset } from "@/types";

const SESSION: Dataset = {
  fileName: "sales.csv",
  columns: [
    { name: "region", type: "string", detectedType: "string" },
    { name: "revenue", type: "numeric", detectedType: "numeric" },
  ],
  rows: [
    { region: "EMEA", revenue: 10 },
    { region: "APAC", revenue: 20 },
  ],
  uploadedAt: new Date("2026-01-01"),
} as unknown as Dataset;

const WORKSPACE_META = {
  uploadId: "w1",
  fileName: "costs.csv",
  rowCount: 50,
  colCount: 3,
  storageRef: "users/u/workspaces/w/datasets/w1/data.csv",
};

function renderSource(
  opts: {
    onLoadWorkspaceDataset?: (d: typeof WORKSPACE_META) => Promise<boolean>;
  } = {},
) {
  return render(
    <ModellerInspector
      orderedColumns={[]}
      previewRows={[]}
      fileName="sales.csv"
      workspaceContext={{ datasets: [WORKSPACE_META] } as never}
      extraDatasets={[]}
      allAvailableDatasets={[SESSION]}
      datasets={[SESSION]}
      onLoadWorkspaceDataset={opts.onLoadWorkspaceDataset}
    />,
  );
}

function openSourceTab() {
  fireEvent.click(screen.getByRole("tab", { name: "Source" }));
}

describe("Source dataset peek Sheet", () => {
  it("starts closed on the Source tab", () => {
    renderSource();
    openSourceTab();
    expect(screen.getByText("sales.csv")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("peeks a session dataset: columns + sample rows", () => {
    renderSource();
    openSourceTab();
    const [sessionPeek] = screen.getAllByRole("button", { name: "Peek" });
    fireEvent.click(sessionPeek);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Each column renders twice: once as a chip, once as a table header.
    expect(screen.getAllByText("region")).toHaveLength(2);
    expect(screen.getAllByText("revenue")).toHaveLength(2);
    expect(screen.getByText("EMEA")).toBeInTheDocument();
  });

  it("peeks an unloaded workspace dataset: metadata, no fabricated rows", () => {
    renderSource();
    openSourceTab();
    const [, workspacePeek] = screen.getAllByRole("button", { name: "Peek" });
    fireEvent.click(workspacePeek);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/50 rows × 3 cols/)).toBeInTheDocument();
    expect(screen.getByText(/not loaded yet/)).toBeInTheDocument();
    expect(screen.queryByText("EMEA")).not.toBeInTheDocument();
  });

  it("loads from the workspace peek and closes", async () => {
    const onLoad = vi.fn(async () => true);
    renderSource({ onLoadWorkspaceDataset: onLoad });
    openSourceTab();
    const [, workspacePeek] = screen.getAllByRole("button", { name: "Peek" });
    fireEvent.click(workspacePeek);
    fireEvent.click(screen.getByRole("button", { name: /Load costs\.csv/ }));
    expect(onLoad).toHaveBeenCalledWith(WORKSPACE_META);
    await screen.findByRole("tab", { name: "Source" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closing the Sheet returns to the navigator", () => {
    renderSource();
    openSourceTab();
    const [sessionPeek] = screen.getAllByRole("button", { name: "Peek" });
    fireEvent.click(sessionPeek);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
