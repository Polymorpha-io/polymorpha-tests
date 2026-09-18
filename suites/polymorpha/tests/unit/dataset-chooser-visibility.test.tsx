import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaletteSheet } from "@/components/NotebookWorkbench/palettes/PaletteSheet";
import type { FrameOption } from "@/components/NotebookWorkbench/frames/frameRegistry";
import { ModellerInspector } from "@/components/DataPreview/modeller/ModellerInspector";
import type { Column, Dataset, Row } from "@/types";

const CTX = { columns: [], numeric: [], categorical: [], fileBase: "t" };

function renderSheet(extra?: object) {
  const noop = vi.fn();
  return render(
    <PaletteSheet
      open
      accent="#000"
      title="Test op"
      description="desc"
      detail="detail"
      snippet="df.head()"
      fields={[]}
      values={{}}
      ctx={CTX}
      onField={noop}
      onClose={noop}
      onPaste={noop}
      {...extra}
    />,
  );
}

const FRAME: FrameOption = {
  laneName: "df",
  kernelName: "df",
  fileName: "sales.csv",
  rows: 4600,
  cols: 18,
  source: "upload",
} as unknown as FrameOption;

describe("dataset chooser is always visible", () => {
  it("shows the graceful empty state with zero frames (never nothing)", () => {
    renderSheet({ frames: [], onFrameChange: vi.fn() });
    expect(screen.getByText(/No datasets yet/)).toBeInTheDocument();
  });

  it("shows the picker with one frame", () => {
    renderSheet({
      frames: [FRAME],
      frameKernelName: "df",
      onFrameChange: vi.fn(),
    });
    expect(
      screen.getByRole("combobox", {
        name: "Dataset to apply this functionality to",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sales\.csv/)).toBeInTheDocument();
  });

  it("fails inline (not silent) when no picker handler exists", () => {
    renderSheet({});
    expect(screen.getByText(/Dataset picker unavailable/)).toBeInTheDocument();
  });
});

const COLUMNS = [
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

describe("modeller inspector names its working dataset", () => {
  it("always shows Working on with file and shape", () => {
    render(
      <ModellerInspector
        orderedColumns={COLUMNS}
        previewRows={ROWS}
        fileName="sales.csv"
        workspaceContext={{ datasets: [] } as never}
        extraDatasets={[]}
        allAvailableDatasets={[SESSION]}
        datasets={[SESSION]}
      />,
    );
    const strip = screen.getByText(/Working on/);
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).toContain("sales.csv");
    expect(strip.textContent).toContain("2 rows × 2 cols");
  });
});
