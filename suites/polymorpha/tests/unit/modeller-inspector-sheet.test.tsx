import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ModellerInspector } from "@/components/DataPreview/modeller/ModellerInspector";
import { useDataStore } from "@/store/useDataStore";
import { DatasetInventoryContext } from "@/components/NotebookWorkbench/datasetInventoryContext";
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

describe("ModellerInspector op Sheet Apply-to + code equivalence", () => {
  beforeEach(() => {
    useDataStore.setState({ appliedSteps: [] });
  });

  /** Seed the frame registry: upload base `df` + one kernel frame `df2`
   *  (fresh, measured) so the picker offers a real second target. */
  function renderSeeded(
    opts: {
      onPasteCodeCell?: (code: string, label: string) => void;
    } = {},
  ) {
    useDataStore.setState({
      raw: SESSION,
      totalRowCount: 2,
      activeFrameName: null,
      kernelVars: [
        {
          name: "df2",
          type: "DataFrame",
          detail: "2 rows × 2 cols",
          stage: "model",
          frame: {
            rows: 2,
            cols: 2,
            columns: ["age", "city"],
            head: [{ age: 30, city: "Lima" }],
          },
        },
      ],
      kernelVarsStale: false,
    } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
    return renderWorkbench(opts);
  }

  /** The equivalence <pre> (scoped — the modal's animated showcase also
   *  contains `sort_values` text, so document-wide queries are ambiguous). */
  function equivalencePre(): HTMLPreElement {
    return document.querySelector(".op-sheet-body .wb-sheet-preview")!;
  }

  it("offers 'Apply to' frames with a live code equivalence preview", async () => {
    renderSeeded({ onPasteCodeCell: vi.fn() });
    openSortSheet();
    const picker = screen.getByLabelText(
      "Dataset to apply this functionality to",
    );
    expect(
      within(picker).getByRole("option", { name: "df" }),
    ).toBeInTheDocument();
    expect(
      within(picker).getByRole("option", { name: "df2" }),
    ).toBeInTheDocument();
    // Defaults to the modeller's own view (df, no applied steps) and
    // resolves the equivalence once the modal reports its draft.
    expect(picker).toHaveValue("df");
    await waitFor(() =>
      expect(equivalencePre().textContent).toMatch(/df\.sort_values/),
    );
  });

  it("picking a frame rewrites the equivalence + pasted code to its kernel variable", async () => {
    const onPaste = vi.fn();
    renderSeeded({ onPasteCodeCell: onPaste });
    openSortSheet();
    await waitFor(() =>
      expect(equivalencePre().textContent).toMatch(/df\.sort_values/),
    );
    fireEvent.change(
      screen.getByLabelText("Dataset to apply this functionality to"),
      { target: { value: "df2" } },
    );
    await waitFor(() =>
      expect(equivalencePre().textContent).toMatch(/df2\.sort_values/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onPaste).toHaveBeenCalledTimes(1);
    const [code] = onPaste.mock.calls[0];
    // Header names the chosen dataset; body runs against its kernel name.
    expect(code).toContain("# Dataset: df2 (2 rows × 2 cols) → df2");
    expect(code).toContain("df2.sort_values");
    // Paste-only: still no transforming step.
    expect(useDataStore.getState().appliedSteps.length).toBe(0);
  });
});

describe("Combine-op sheets: no focuser, equivalence rebound, operand expander", () => {
  beforeEach(() => {
    useDataStore.setState({ appliedSteps: [] });
  });

  const DS2: Dataset = {
    fileName: "df2",
    columns: [
      { name: "date", type: "string", detectedType: "string" },
      { name: "value", type: "numeric", detectedType: "numeric" },
    ] as unknown as Column[],
    rows: [{ date: "2026-01-01", value: 1 }] as unknown as Row[],
    uploadedAt: new Date("2026-01-02"),
  } as unknown as Dataset;

  const kernelRow = {
    key: "u-df2",
    uploadId: "u-df2",
    fileName: "df2",
    varName: "df2",
    rows: 1,
    cols: 2,
    columns: ["date", "value"],
    storageRef: "",
    hasStorage: false,
    missing: false,
    inNotebook: true,
    inWorkspace: false,
    loaded: true,
    mergeable: true,
  };

  /** Workbench + inventory provider (merge operands) + a second dataset. */
  function renderMergeReady(
    opts: {
      onPasteCodeCell?: (code: string, label: string) => void;
    } = {},
  ) {
    useDataStore.setState({
      raw: SESSION,
      totalRowCount: 2,
      activeFrameName: null,
      kernelVars: [],
      kernelVarsStale: false,
    } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
    return render(
      <DatasetInventoryContext.Provider
        value={{
          rows: [kernelRow],
          loading: false,
          loadPointer: vi.fn().mockResolvedValue({ ok: true }),
          loadingUploadId: null,
          lineageWarning: null,
          autoLoadWarning: null,
        }}
      >
        <ModellerInspector
          orderedColumns={COLUMNS}
          previewRows={ROWS}
          fileName="sales.csv"
          workspaceContext={{ datasets: [] } as never}
          extraDatasets={[]}
          allAvailableDatasets={[SESSION, DS2]}
          datasets={[SESSION]}
          kernelVarNames={["df2"]}
          onPasteCodeCell={opts.onPasteCodeCell}
        />
      </DatasetInventoryContext.Provider>,
    );
  }

  function openMerge() {
    fireEvent.click(screen.getByRole("tab", { name: "Combine" }));
    fireEvent.click(screen.getByRole("button", { name: /Merge/ }));
  }

  it("omits the Apply-to focuser on merge (no single target frame)", () => {
    renderMergeReady({ onPasteCodeCell: vi.fn() });
    openMerge();
    expect(
      screen.queryByLabelText("Dataset to apply this functionality to"),
    ).toBeNull();
    // Exactly ONE inventory expander — the operand pickers' own.
    expect(
      screen.getAllByRole("button", { name: /all dataframes/i }),
    ).toHaveLength(1);
    // Code equivalence stays (bound to the modal's left operand).
    expect(
      document.querySelector(".op-sheet-body .wb-sheet-preview"),
    ).not.toBeNull();
  });

  it("keeps the focuser on single-frame ops (explode)", () => {
    renderMergeReady({ onPasteCodeCell: vi.fn() });
    fireEvent.click(screen.getByRole("tab", { name: "Structure" }));
    fireEvent.click(screen.getByRole("button", { name: /Explode/ }));
    expect(
      screen.getByLabelText("Dataset to apply this functionality to"),
    ).toBeDefined();
  });

  it("hints to pick a right operand when no other dataset exists", () => {
    renderWorkbench({ onPasteCodeCell: vi.fn() });
    fireEvent.click(screen.getByRole("tab", { name: "Combine" }));
    fireEvent.click(screen.getByRole("button", { name: /Merge/ }));
    expect(screen.getByText(/Pick a right operand/)).toBeDefined();
  });

  it("join sheet: clearing the key warns to pick a shared key", () => {
    renderMergeReady({ onPasteCodeCell: vi.fn() });
    fireEvent.click(screen.getByRole("tab", { name: "Combine" }));
    fireEvent.click(screen.getByRole("button", { name: /Lookup join/ }));
    const on = screen
      .getByText("On (shared column):")
      .closest(".form-group")!
      .querySelector("select") as HTMLSelectElement;
    fireEvent.change(on, { target: { value: "" } });
    expect(screen.getByText(/Pick a key column/)).toBeDefined();
  });

  it("side toggle: rows fill Right by default, Left when toggled (collision swaps)", async () => {
    renderMergeReady({ onPasteCodeCell: vi.fn() });
    openMerge();
    fireEvent.click(
      screen.getAllByRole("button", { name: /all dataframes/i })[0],
    );
    const left = screen.getByLabelText("Left dataset") as HTMLSelectElement;
    const right = screen.getByLabelText("Right dataset") as HTMLSelectElement;
    // MergeModal auto-picks the first other dataset as the default right.
    expect(right).toHaveValue("df2");
    // Default side: Right — clicking the df2 row is a harmless re-pick.
    fireEvent.click(screen.getByRole("button", { name: /df2/ }));
    await waitFor(() => expect(right).toHaveValue("df2"));
    // Switch to Left and pick the same row — collision swaps the sides.
    fireEvent.click(screen.getByRole("radio", { name: "Left" }));
    fireEvent.click(screen.getByRole("button", { name: /df2/ }));
    await waitFor(() => expect(left).toHaveValue("df2"));
    expect(right).toHaveValue("sales.csv");
    // In-use marker renders on the row (df2 now holds the left slot).
    expect(screen.getByText("✓ left")).toBeInTheDocument();
  });
});
