import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useDataStore } from "@/store/useDataStore";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import type { Dataset } from "@/types";

// Monaco never loads under jsdom: plain stub (same contract as the
// notebook-pane suite — value in, onChange out).
vi.mock("@/components/DataPreview/CellEditorLazy", () => ({
  LazyCellEditor: ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (next: string) => void;
    label: string;
  }) => (
    <textarea
      data-testid="cell-editor-stub"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/lib/stats/api", () => ({
  callExecuteApi: vi.fn(),
  getDownloadUrlCached: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// Spy the blanket Monaco disposal: the real module stays (per-cell disposal
// paths keep working), only the global kill-switch is observed.
vi.mock("@/components/DataPreview/CellCodeEditor", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/DataPreview/CellCodeEditor")
    >();
  return { ...actual, disposeAllCellModels: vi.fn() };
});

import { NotebookWorkbench } from "@/components/NotebookWorkbench/NotebookWorkbench";

function dataset(): Dataset {
  return {
    fileName: "df.csv",
    uploadedAt: new Date(0),
    columns: [
      {
        name: "c0",
        type: "unknown" as const,
        detectedType: "unknown" as const,
      },
    ],
    rows: [{ c0: 1 }],
  };
}

function seed() {
  localStorage.clear();
  useDataStore.setState({
    raw: dataset(),
    rawHash: "test-hash",
    totalRowCount: 1,
    storagePath: "users/u1/df.csv",
    uploadId: "up1",
    workspaceId: "ws1",
    kernelVars: [],
    appliedSteps: [],
    pastSteps: [],
    futureSteps: [],
    computedHead: null,
    cleaned: null,
    combineExtras: [],
    historyEpoch: 0,
  } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
}

function renderWorkbench() {
  return render(<NotebookWorkbench stepPanel={<div />} palette={null} />);
}

beforeEach(() => {
  seed();
});

describe("NotebookWorkbench hideable notebook lane", () => {
  it("hides the notebook via the toolbar, showing the rail and persisting", () => {
    renderWorkbench();
    // The pane is mounted while its toolbar hide button is present.
    expect(
      screen.getByRole("button", { name: "Hide notebook lane" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show notebook lane" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide notebook lane" }));
    expect(
      screen.queryByRole("button", { name: "Hide notebook lane" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show notebook lane" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.NOTEBOOK_LEFT)).toBe("1");
  });

  it("restores the notebook via the rail and persists", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Hide notebook lane" }));
    fireEvent.click(screen.getByRole("button", { name: "Show notebook lane" }));
    expect(
      screen.getByRole("button", { name: "Hide notebook lane" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.NOTEBOOK_LEFT)).toBe("0");
  });

  it("starts hidden when persistence says so", () => {
    localStorage.setItem(STORAGE_KEYS.NOTEBOOK_LEFT, "1");
    renderWorkbench();
    expect(
      screen.queryByRole("button", { name: "Hide notebook lane" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show notebook lane" }),
    ).toBeInTheDocument();
  });

  it("preserves cell edits across a hide/show round-trip", () => {
    renderWorkbench();
    fireEvent.change(screen.getByTestId("cell-editor-stub"), {
      target: { value: "x = 1  # edited" },
    });
    // Unmount flushes trailing keystroke writes synchronously.
    fireEvent.click(screen.getByRole("button", { name: "Hide notebook lane" }));
    fireEvent.click(screen.getByRole("button", { name: "Show notebook lane" }));
    expect(
      (screen.getByTestId("cell-editor-stub") as HTMLTextAreaElement).value,
    ).toBe("x = 1  # edited");
  });
});

describe("NotebookWorkbench workspace notebooks", () => {
  it("creates a second notebook that starts empty and switches back", () => {
    renderWorkbench();
    const select = screen.getByRole("combobox", {
      name: "Active notebook",
    }) as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    // Mark the main notebook so leakage is visible.
    fireEvent.change(screen.getByTestId("cell-editor-stub"), {
      target: { value: "x = 1  # main-only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ New" }));
    const afterCreate = screen.getByRole("combobox", {
      name: "Active notebook",
    }) as HTMLSelectElement;
    expect(afterCreate.options).toHaveLength(2);
    // Fresh notebook: no cells at all — no leaked edit, no step migration.
    expect(
      screen.queryByDisplayValue("x = 1  # main-only"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-editor-stub")).not.toBeInTheDocument();
    // Switch back: the main notebook is intact (value read off the mounted
    // editor, same as the hide/show round-trip test below).
    fireEvent.change(afterCreate, {
      target: { value: afterCreate.options[0].value },
    });
    expect(
      (screen.getByTestId("cell-editor-stub") as HTMLTextAreaElement).value,
    ).toBe("x = 1  # main-only");
  });

  it("never blanket-disposes Monaco models on notebook switch", async () => {
    // Warm the real editor chunk transform first, so a removed fire-and-forget
    // import can't hide behind slow cold-transform timing below.
    const editorMod = await import("@/components/DataPreview/CellCodeEditor");
    renderWorkbench();
    fireEvent.change(screen.getByTestId("cell-editor-stub"), {
      target: { value: "print(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ New" }));
    // Let any fire-and-forget dynamic import settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(vi.mocked(editorMod.disposeAllCellModels)).not.toHaveBeenCalled();
    // The typed code was flushed to the outgoing notebook (nothing blanked it).
    expect(localStorage.getItem("polymorpha.nb.cells.v2::ws1::main")).toContain(
      "print(1)",
    );
  });

  it("renames the active notebook", () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Notebook name"), {
      target: { value: "EDA" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      (
        screen.getByRole("combobox", {
          name: "Active notebook",
        }) as HTMLSelectElement
      ).options[0].text,
    ).toBe("EDA");
  });

  it("deletes a notebook only after confirm and keeps at least one", () => {
    renderWorkbench();
    // Single notebook: delete is disabled (a workspace keeps one).
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "+ New" }));
    const del = screen.getByRole("button", { name: "Delete" });
    expect(del).not.toBeDisabled();
    fireEvent.click(del);
    // Two-step arm: first click arms, second confirms.
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    const select = screen.getByRole("combobox", {
      name: "Active notebook",
    }) as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
