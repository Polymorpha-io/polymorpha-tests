import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { useDataStore } from "@/store/useDataStore";
import type { Dataset, DataOperationStep } from "@/types";

// Monaco never loads under jsdom: swap the lazy editor for a plain stub.
// Shift+Enter support is verified by wiring onApply to the Run path.
// The stub surfaces the model props as data attributes so windowing +
// model-stability assertions don't need Monaco.
vi.mock("@/components/DataPreview/CellEditorLazy", () => ({
  LazyCellEditor: ({
    value,
    onChange,
    label,
    onApply,
    modelPath,
    keepModel,
  }: {
    value: string;
    onChange: (next: string) => void;
    label: string;
    onApply?: () => void;
    modelPath?: string;
    keepModel?: boolean;
  }) => (
    <textarea
      data-testid="cell-editor-stub"
      data-model-path={modelPath ?? ""}
      data-keep-model={keepModel ? "1" : ""}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.shiftKey && e.key === "Enter") {
          e.preventDefault();
          onApply?.();
        }
      }}
    />
  ),
}));

vi.mock("@/lib/stats/api", () => ({
  callExecuteApi: vi.fn(),
  getDownloadUrlCached: vi.fn(),
}));

// Sonner toasts never paint under jsdom (no <Toaster/> mounted) — capture
// the Undo action through the mock instead of clicking it.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { toast } from "sonner";

import { callExecuteApi, getDownloadUrlCached } from "@/lib/stats/api";
import { NotebookPane } from "@/components/NotebookWorkbench/NotebookPane";
import { DatasetVariablesPane } from "@/components/NotebookWorkbench/DatasetVariablesPane";
import { DatasetInventoryContext } from "@/components/NotebookWorkbench/datasetInventoryContext";
import { useNotebookDatasets } from "@/components/NotebookWorkbench/useNotebookDatasets";
import type { NotebookDatasetRow } from "@/components/NotebookWorkbench/useNotebookDatasets";
import { useLoadWorkspacePointer } from "@/components/NotebookWorkbench/useLoadWorkspacePointer";

/** Test harness: a real inventory provider (session-only — no workspaceId)
 *  around the pane, mirroring NotebookWorkbench's provider. */
function InventoryHarness({ children }: { children: React.ReactNode }) {
  const { rows, loading, lineageWarning } = useNotebookDatasets();
  const { load, loadingUploadId } = useLoadWorkspacePointer();
  return (
    <DatasetInventoryContext.Provider
      value={{
        rows,
        loading,
        loadPointer: load,
        loadingUploadId,
        lineageWarning,
        autoLoadWarning: null,
      }}
    >
      {children}
    </DatasetInventoryContext.Provider>
  );
}

function dataset(fileName: string, rows: number, cols: number): Dataset {
  return {
    fileName,
    uploadedAt: new Date(0),
    columns: Array.from({ length: cols }, (_, i) => ({
      name: `c${i}`,
      type: "unknown" as const,
      detectedType: "unknown" as const,
    })),
    rows: Array.from({ length: rows }, (_, i) => ({ c0: i })),
  };
}

function step(
  id: string,
  execSeq: number,
  config: DataOperationStep["config"],
  description: string,
): DataOperationStep {
  return { id, execSeq, description, config };
}

const QUERY = {
  type: "query",
  expr: "c0 > 1",
} as unknown as DataOperationStep["config"];
const SORT = {
  type: "sort",
  by: ["c0"],
  ascending: true,
} as unknown as DataOperationStep["config"];

function seed() {
  localStorage.clear();
  useDataStore.setState({
    raw: dataset("df.csv", 10, 2),
    rawHash: "test-hash",
    totalRowCount: 10,
    storagePath: "users/u1/df.csv",
    uploadId: "up1",
    workspaceId: "ws1",
    kernelVars: [],
    appliedSteps: [
      step("s1", 1, QUERY, "Query c0 > 1"),
      step("s2", 2, SORT, "Sort c0"),
    ],
    pastSteps: [],
    futureSteps: [],
    computedHead: dataset("df.csv", 8, 2),
    cleaned: null,
    combineExtras: [{ fileName: "test1.csv", rowCount: 5 }],
    historyEpoch: 0,
  } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
}

beforeEach(() => {
  seed();
  vi.mocked(callExecuteApi).mockReset();
  vi.mocked(getDownloadUrlCached).mockReset();
  vi.mocked(getDownloadUrlCached).mockResolvedValue("https://example/df.csv");
  vi.mocked(toast.success).mockClear();
});

/** Open the kebab menu of the cell currently at `index`. Only one menu
 *  is ever open, so menuitem queries stay unambiguous after re-renders. */
function openKebab(index: number) {
  fireEvent.click(
    screen.getByRole("button", { name: `Cell ${index} actions` }),
  );
}

function clickMenuItem(name: string) {
  // Kebab items carry visible shortcut hints (⇧↵/M/Y/…) that are part of the
  // accessible name — prefix-match so labels stay stable as hints evolve.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  fireEvent.click(
    screen.getByRole("menuitem", { name: new RegExp(`^${escaped}`) }),
  );
}

describe("NotebookPane freeform cells", () => {
  it("migrates the step log to one runnable cell per step plus load cell", () => {
    // Reaching assertions without a memo/update loop is the regression signal.
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Load cell + 2 migrated steps, each with a gutter Run action.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^Run cell / })).toHaveLength(
      3,
    );
    // No template split: no Apply, no Save-as-code-cell.
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save as code cell/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/3 cells/)).toBeInTheDocument();
  });

  it("keeps the same notebook when switching pipeline stages", () => {
    const { rerender } = render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const before = screen
      .getAllByTestId("cell-editor-stub")
      .map((el) => (el as HTMLTextAreaElement).value);
    expect(before).toHaveLength(3);
    rerender(
      <NotebookPane
        stage="stats"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // No reset: same cells, same sources, single unified storage key.
    expect(
      screen
        .getAllByTestId("cell-editor-stub")
        .map((el) => (el as HTMLTextAreaElement).value),
    ).toEqual(before);
    const unified = localStorage.getItem("polymorpha.nb.cells.v2::ws1::main");
    expect(unified).not.toBeNull();
    expect(
      localStorage.getItem("polymorpha.nb.cells.v1::stats::df.csv::test-hash"),
    ).toBeNull();
  });

  it("appends a pasted snippet as a new runnable cell and consumes it", () => {
    const onPendingConsumed = vi.fn();
    const { rerender } = render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={onPendingConsumed}
      />,
    );
    rerender(
      <NotebookPane
        stage="model"
        pendingSnippet={{
          text: "df = df.sort_values('c0')",
          label: "sort",
          nonce: 1,
        }}
        onPendingConsumed={onPendingConsumed}
      />,
    );
    expect(onPendingConsumed).toHaveBeenCalled();
    // Pasted cell takes focus → compact window follows it (cells 2-3 mounted).
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
    expect(document.querySelectorAll(".nb-code-peek")).toHaveLength(2);
    expect(
      screen.getByDisplayValue("df = df.sort_values('c0')"),
    ).toBeInTheDocument();
  });

  it("pastes at the end of the notebook trail even when a middle cell is focused", () => {
    const onPendingConsumed = vi.fn();
    const { rerender } = render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={onPendingConsumed}
      />,
    );
    // Focus a middle cell's editor (real DOM focus so React's onFocus
    // capture registers it), then paste from the right lane.
    const middle = screen.getAllByTestId("cell-editor-stub")[1];
    act(() => middle.focus());
    rerender(
      <NotebookPane
        stage="model"
        pendingSnippet={{
          text: "df = df.head()",
          label: "tail paste",
          nonce: 7,
        }}
        onPendingConsumed={onPendingConsumed}
      />,
    );
    // The pasted cell is the LAST trail entry — right-lane work never
    // inserts mid-trail (top-down pipeline history contract).
    const rows = document.querySelectorAll(".nb-row");
    expect(rows).toHaveLength(4);
    expect(
      within(rows[rows.length - 1] as HTMLElement).getByTestId(
        "cell-editor-stub",
      ),
    ).toHaveValue("df = df.head()");
    expect(onPendingConsumed).toHaveBeenCalled();
  });

  it("runs a cell and records output with an execution count", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "shape ok",
      stderr: "",
      exitCode: 0,
      durationMs: 5,
      variables: [
        {
          name: "df",
          type: "DataFrame",
          detail: "10 rows × 2 cols",
          rows: 10,
          cols: 2,
          columns: ["c0", "c1"],
          head: [{ c0: 1, c1: 2 }],
        },
        { name: "alpha", type: "float", detail: "0.45" },
      ],
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(screen.getByText("shape ok")).toBeInTheDocument(),
    );
    // The dataset manifest travels with every Run — an empty manifest is
    // the FileNotFoundError regression this guards against.
    expect(callExecuteApi).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "python",
        sessionId: expect.any(String),
        datasets: [
          expect.objectContaining({
            fileName: "df.csv",
            storagePath: "users/u1/df.csv",
            downloadUrl: "https://example/df.csv",
            uploadId: "up1",
            workspaceId: "ws1",
          }),
        ],
      }),
    );
    // No below-cell variables list — the middle lane owns DataFrames.
    expect(screen.queryByText(/Variables \(/)).not.toBeInTheDocument();
    expect(screen.queryByText("10 rows × 2 cols")).not.toBeInTheDocument();
    // …but the full snapshot reaches the store (frames for the lane,
    // scalars for completions).
    expect(useDataStore.getState().kernelVars).toEqual([
      expect.objectContaining({
        name: "df",
        type: "DataFrame",
        stage: "model",
        frame: expect.objectContaining({ rows: 10 }),
      }),
      expect.objectContaining({ name: "alpha", type: "float" }),
    ]);
  });

  it("records engine and renders backend hints distinctly on error", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr:
        "KeyError: 'species'\nAvailable columns: c0, Species\nDid you mean: Species?",
      exitCode: 1,
      durationMs: 3,
      engine: "warm",
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    // Hint lines render in their own emphasized block, not as traceback.
    await waitFor(() =>
      expect(
        document.querySelector(".flow-cell-errorhint"),
      ).toBeInTheDocument(),
    );
    // The hint block quotes the columns; the assist card below may quote
    // them again, so scope to the emphasized hint block.
    expect(document.querySelector(".flow-cell-errorhint")).toHaveTextContent(
      "Available columns:",
    );
    // Raw traceback keeps the verbatim line (the card title duplicates it).
    expect(
      within(screen.getByRole("alert")).getByText("KeyError: 'species'"),
    ).toBeInTheDocument();
    // Engine chip proves which backend served the Run.
    expect(screen.getByText(/· warm/)).toBeInTheDocument();
  });

  it("gates Run inline when the dataset has no storage copy (no silent NameError)", async () => {
    useDataStore.setState({ storagePath: null });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByText(/has no storage copy, so the kernel cannot load it/),
      ).toBeInTheDocument(),
    );
    expect(callExecuteApi).not.toHaveBeenCalled();
  });

  it("clears persistence when every cell is deleted (no resurrect)", () => {
    const key = "polymorpha.nb.cells.v2::ws1::main";
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    expect(localStorage.getItem(key)).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      openKebab(0);
      clickMenuItem("Delete cell");
    }
    expect(screen.queryByTestId("cell-editor-stub")).not.toBeInTheDocument();
    // Deliberate empty notebook persists as `[]` — a missing key would
    // read as "never persisted" and resurrect migrated cells on reload.
    expect(localStorage.getItem(key)).toBe("[]");
  });

  it("stays empty on reload after every cell is deleted (no resurrect)", () => {
    const key = "polymorpha.nb.cells.v2::ws1::main";
    localStorage.setItem(key, "[]");
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // No migration, no unification: zero rows, zero editors.
    expect(screen.queryByTestId("cell-editor-stub")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("migrates a legacy file-scoped notebook into the workspace scope once", () => {
    localStorage.setItem(
      "polymorpha.nb.cells.v1::df.csv::test-hash",
      JSON.stringify([
        {
          id: "legacy1",
          executionCount: null,
          cell_type: "code",
          source: 'print("legacy")',
          stdout: null,
          stderr: null,
          exitCode: null,
          status: "idle",
          dirty: false,
          durationMs: null,
          engine: null,
          variables: [],
        },
      ]),
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Legacy cells surface in the workspace notebook…
    expect(screen.getByDisplayValue('print("legacy")')).toBeInTheDocument();
    // …are copied to the v2 key…
    expect(localStorage.getItem("polymorpha.nb.cells.v2::ws1::main")).toContain(
      "legacy",
    );
    // …and the v1 source is purged on mount (one-time legacy cleanup).
    expect(
      localStorage.getItem("polymorpha.nb.cells.v1::df.csv::test-hash"),
    ).toBeNull();
  });

  it("purges all legacy file-scoped keys once, including staged variants", () => {
    localStorage.setItem(
      "polymorpha.nb.cells.v1::model::other.csv::other-hash",
      JSON.stringify([]),
    );
    localStorage.setItem(
      "polymorpha.nb.cells.seq.v1::other.csv::other-hash",
      "7",
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      localStorage.getItem(
        "polymorpha.nb.cells.v1::model::other.csv::other-hash",
      ),
    ).toBeNull();
    expect(
      localStorage.getItem("polymorpha.nb.cells.seq.v1::other.csv::other-hash"),
    ).toBeNull();
    expect(localStorage.getItem("polymorpha.nb.v1.purged.v1")).toBe("1");
  });

  it("never seeds a non-default notebook from legacy file-scoped data", () => {
    localStorage.setItem(
      "polymorpha.nb.cells.v1::df.csv::test-hash",
      JSON.stringify([
        {
          id: "legacy1",
          executionCount: 7,
          cell_type: "code",
          source: 'print("legacy")',
          stdout: null,
          stderr: null,
          exitCode: null,
          status: "idle",
          dirty: false,
          durationMs: null,
          engine: null,
          variables: [],
        },
      ]),
    );
    render(
      <NotebookPane
        stage="model"
        notebookId="nb-fresh"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Jupyter "New Notebook" parity: blank, no cloned cells, no step migration.
    expect(screen.queryByTestId("cell-editor-stub")).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('print("legacy")'),
    ).not.toBeInTheDocument();
    // The empty state persists as deliberate-empty `[]` (never resurrected).
    expect(localStorage.getItem("polymorpha.nb.cells.v2::ws1::nb-fresh")).toBe(
      "[]",
    );
  });

  it("isolates notebooks by workspace: same file, different cells", () => {
    const wsKey = "polymorpha.nb.cells.v2::ws1::main";
    localStorage.setItem(
      wsKey,
      JSON.stringify([
        {
          id: "ws1cell",
          executionCount: null,
          cell_type: "code",
          source: 'print("ws1 private")',
          stdout: null,
          stderr: null,
          exitCode: null,
          status: "idle",
          dirty: false,
          durationMs: null,
          engine: null,
          variables: [],
        },
      ]),
    );
    const { rerender } = render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      screen.getByDisplayValue('print("ws1 private")'),
    ).toBeInTheDocument();
    // Switch workspaces with the SAME dataset loaded: ws2 starts fresh —
    // ws1's code must not leak across.
    act(() => {
      useDataStore.setState({ workspaceId: "ws2" } as unknown as Partial<
        ReturnType<typeof useDataStore.getState>
      >);
    });
    rerender(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      screen.queryByDisplayValue('print("ws1 private")'),
    ).not.toBeInTheDocument();
    expect(
      localStorage.getItem("polymorpha.nb.cells.v2::ws2::main"),
    ).not.toContain("ws1 private");
    // Switch back: ws1's notebook is intact.
    act(() => {
      useDataStore.setState({ workspaceId: "ws1" } as unknown as Partial<
        ReturnType<typeof useDataStore.getState>
      >);
    });
    rerender(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      screen.getByDisplayValue('print("ws1 private")'),
    ).toBeInTheDocument();
  });

  it("isolates notebooks by notebook id within one workspace", () => {
    const aKey = "polymorpha.nb.cells.v2::ws1::nb-a";
    localStorage.setItem(
      aKey,
      JSON.stringify([
        {
          id: "acell",
          executionCount: null,
          cell_type: "code",
          source: 'print("notebook A")',
          stdout: null,
          stderr: null,
          exitCode: null,
          status: "idle",
          dirty: false,
          durationMs: null,
          engine: null,
          variables: [],
        },
      ]),
    );
    const { rerender } = render(
      <NotebookPane
        stage="model"
        notebookId="nb-a"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('print("notebook A")')).toBeInTheDocument();
    rerender(
      <NotebookPane
        stage="model"
        notebookId="nb-b"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      screen.queryByDisplayValue('print("notebook A")'),
    ).not.toBeInTheDocument();
  });

  it("keeps the notebook when switching datasets inside one workspace", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    act(() => {
      useDataStore.setState({
        raw: dataset("other.csv", 5, 1),
        rawHash: "other-hash",
        totalRowCount: 5,
        storagePath: "users/u1/other.csv",
        computedHead: dataset("other.csv", 5, 1),
      } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
    });
    // Same workspace → same notebook: cells stay (every notebook can work
    // with any of its workspace's datasets via the active dataset).
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
  });

  it("isolates anon sessions per mount so tabs never share a namespace (G18)", async () => {
    // Default auth state is signed-out (user null) → anon tab salts.
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
    const ids: Array<string | undefined> = [];
    for (let m = 0; m < 2; m++) {
      const { unmount } = render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() => expect(callExecuteApi).toHaveBeenCalledTimes(m + 1));
      ids.push(vi.mocked(callExecuteApi).mock.calls[m][0].sessionId);
      unmount();
    }
    expect(ids[0]).toEqual(expect.any(String));
    expect(ids[1]).toEqual(expect.any(String));
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("fails a Run inline when the dataset cannot be attached", async () => {
    vi.mocked(getDownloadUrlCached).mockRejectedValue(
      new Error("signed URL denied"),
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Could not attach dataset "df\.csv"/),
      ).toBeInTheDocument(),
    );
    expect(callExecuteApi).not.toHaveBeenCalled();
  });

  it("consumes no execution count when the dataset cannot be attached", async () => {
    vi.mocked(getDownloadUrlCached).mockRejectedValue(
      new Error("signed URL denied"),
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Could not attach dataset "df\.csv"/),
      ).toBeInTheDocument(),
    );
    expect(callExecuteApi).not.toHaveBeenCalled();
    // Never ran: no In[N] consumed, footer still offers the owed Run.
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText(
        /Never run.*Shift\+Enter to run/,
      ),
    ).toBeInTheDocument();
  });

  it("parks persisted running cells idle on load (reload during a Run)", () => {
    localStorage.setItem(
      "polymorpha.nb.cells.v2::ws1::main",
      JSON.stringify([
        {
          id: "stuck",
          executionCount: 4,
          cell_type: "code",
          source: 'print("hi")',
          stdout: "old output",
          stderr: null,
          exitCode: 0,
          status: "running",
          dirty: false,
          durationMs: 12,
          engine: null,
          variables: [],
        },
      ]),
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // No stuck [*]: the cell is idle with its recorded output intact,
    // so Run works again and Cancel has nothing orphaned to chase.
    expect(screen.queryByLabelText("executing")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run cell 0" }),
    ).not.toBeDisabled();
    expect(screen.getByText("old output")).toBeInTheDocument();
  });

  it("ignores mount echo after a run (no phantom dirty, no wipe)", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "shape ok",
      stderr: "",
      exitCode: 0,
      durationMs: 5,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(screen.getByText("shape ok")).toBeInTheDocument(),
    );
    const editor = screen.getAllByTestId(
      "cell-editor-stub",
    )[0] as HTMLTextAreaElement;
    const source = editor.value;
    expect(source.trim().length).toBeGreaterThan(0);
    // A Monaco remount/model resync re-emits the current source verbatim —
    // absorbing it must neither dirty the cell nor touch its source.
    fireEvent.change(editor, { target: { value: source } });
    expect(
      screen.queryByText(/Edited — Shift\+Enter to re-run/),
    ).not.toBeInTheDocument();
    expect(
      (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
        .value,
    ).toBe(source);
  });

  it("coalesces a double-click Run into one execute", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const run = screen.getByRole("button", { name: "Run cell 0" });
    fireEvent.click(run);
    fireEvent.click(run);
    // The synchronous controller claim (plus the running-status guard
    // after flush) admits exactly one execute for the burst.
    await waitFor(() => expect(callExecuteApi).toHaveBeenCalledTimes(1));
    act(() => {
      resolveRun({ stdout: "done", stderr: "", exitCode: 0 });
    });
    await waitFor(() =>
      expect(screen.getByLabelText("kernel idle")).toBeInTheDocument(),
    );
  });

  it("persists same-length structural changes synchronously (type-switch)", () => {
    const key = "polymorpha.nb.cells.v2::ws1::main";
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    openKebab(0);
    clickMenuItem("Markdown");
    // Length is unchanged (3→3): the old length compare would have
    // idle-debounced this, losing it on a fast tab-close. Read immediately.
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
      cell_type: string;
    }>;
    expect(stored).toHaveLength(3);
    expect(stored[0].cell_type).toBe("markdown");
  });

  it("aborts a deleted cell's Run so no late output lands", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    openKebab(0);
    clickMenuItem("Delete cell");
    act(() => {
      resolveRun({ stdout: "late", stderr: "", exitCode: 0 });
    });
    // The orphaned finish is id-keyed: with the cell gone it patches
    // nothing, and no second execute was ever started.
    await waitFor(() => expect(callExecuteApi).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("late")).not.toBeInTheDocument();
  });

  it("drops a late result when the dataset switches mid-Run", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    // Switch datasets mid-Run: the lane resets (cells replaced, kernel
    // vars cleared) while the old execute is still in flight.
    act(() => {
      useDataStore.setState({
        raw: dataset("other.csv", 5, 1),
        rawHash: "other-hash",
        totalRowCount: 5,
        storagePath: "users/u1/other.csv",
        computedHead: dataset("other.csv", 5, 1),
        kernelVars: [],
      } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
    });
    act(() => {
      resolveRun({
        stdout: "stale",
        stderr: "",
        exitCode: 0,
        variables: [
          {
            name: "df_old",
            type: "DataFrame",
            detail: "10 rows × 2 cols",
            rows: 10,
            cols: 2,
            columns: ["c0", "c1"],
            head: [{ c0: 1, c1: 2 }],
          },
        ],
      });
    });
    await waitFor(() => expect(callExecuteApi).toHaveBeenCalledTimes(1));
    // No stale publish: no foreign namespace in the new lane, no output
    // text, and no consumed sequence number for the new dataset.
    expect(useDataStore.getState().kernelVars).toEqual([]);
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(
      localStorage.getItem("polymorpha.nb.cells.seq.v2::ws1::main"),
    ).toBeNull();
  });

  it("restart evicts the backend namespace and clears lane variables", async () => {
    useDataStore.setState({
      kernelVars: [
        { name: "df", type: "DataFrame", detail: "", stage: "model" },
      ],
    });
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restart session" }));
    await waitFor(() =>
      expect(callExecuteApi).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "pass",
          restartSession: true,
          sessionId: expect.any(String),
        }),
      ),
    );
    expect(useDataStore.getState().kernelVars).toEqual([]);
    expect(vi.mocked(toast.success).mock.calls.flat().join(" ")).toContain(
      "kernel variables cleared",
    );
  });

  it("persists the kernel snapshot after a successful Run (fresh truth)", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
      variables: [
        {
          name: "df",
          type: "DataFrame",
          detail: "10 rows × 2 cols",
          rows: 10,
          cols: 2,
          columns: ["c0", "c1"],
          head: [{ c0: 1, c1: 2 }],
        },
      ],
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(useDataStore.getState().kernelVars).toHaveLength(1),
    );
    expect(useDataStore.getState().kernelVarsStale).toBe(false);
    const persisted = localStorage.getItem(
      "polymorpha.nb.kernelvars.v2::ws1::main",
    );
    expect(persisted).toContain('"df"');
  });

  it("does not persist the snapshot when the Run fails", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "boom",
      exitCode: 1,
      durationMs: 1,
      variables: [
        { name: "df", type: "DataFrame", detail: "", stage: "model" },
      ],
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run cell 0" }),
      ).toBeInTheDocument(),
    );
    expect(
      localStorage.getItem("polymorpha.nb.kernelvars.v2::ws1::main"),
    ).toBeNull();
  });

  it("restores the persisted snapshot on switch back (stale until re-run)", () => {
    const snapshotKey = "polymorpha.nb.kernelvars.v2::ws1::nb-a";
    localStorage.setItem(
      snapshotKey,
      JSON.stringify([
        {
          name: "df2",
          type: "DataFrame",
          detail: "150 rows × 4 cols",
          stage: "model",
          frame: {
            rows: 150,
            cols: 4,
            columns: ["a", "b"],
            head: [{ a: 1, b: 2 }],
          },
        },
      ]),
    );
    const { rerender } = render(
      <NotebookPane
        stage="model"
        notebookId="nb-a"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Mount (and every switch into nb-a) restores the snapshot, marked
    // stale — no re-run required just to see the notebook's frames again.
    expect(useDataStore.getState().kernelVars).toEqual([
      expect.objectContaining({ name: "df2" }),
    ]);
    expect(useDataStore.getState().kernelVarsStale).toBe(true);
    // Switch to nb-b (no snapshot): lane resets to empty, un-stale.
    rerender(
      <NotebookPane
        stage="model"
        notebookId="nb-b"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(useDataStore.getState().kernelVars).toEqual([]);
    expect(useDataStore.getState().kernelVarsStale).toBe(false);
    // Switch back: restored again.
    rerender(
      <NotebookPane
        stage="model"
        notebookId="nb-a"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(useDataStore.getState().kernelVars).toEqual([
      expect.objectContaining({ name: "df2" }),
    ]);
    expect(useDataStore.getState().kernelVarsStale).toBe(true);
  });

  it("restart deletes the persisted snapshot, not just the store", async () => {
    localStorage.setItem(
      "polymorpha.nb.kernelvars.v2::ws1::main",
      JSON.stringify([
        { name: "df", type: "DataFrame", detail: "", stage: "model" },
      ]),
    );
    useDataStore.setState({
      kernelVars: [
        { name: "df", type: "DataFrame", detail: "", stage: "model" },
      ],
      kernelVarsStale: true,
    });
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restart session" }));
    await waitFor(() => expect(useDataStore.getState().kernelVars).toEqual([]));
    expect(
      localStorage.getItem("polymorpha.nb.kernelvars.v2::ws1::main"),
    ).toBeNull();
    expect(useDataStore.getState().kernelVarsStale).toBe(false);
  });

  it("deletes a cell and offers Undo", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    openKebab(0);
    clickMenuItem("Delete cell");
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
    // Undo arrives as a toast action (no Toaster under jsdom): drive it
    // through the mock to prove the deleted cell is restorable.
    const calls = vi.mocked(toast.success).mock.calls;
    const undo = calls
      .map(
        ([, opts]) =>
          (opts as { action?: { onClick?: () => void } })?.action?.onClick,
      )
      .find((fn) => typeof fn === "function");
    expect(undo).toBeTypeOf("function");
    act(() => undo!());
    // Restored: 3 rows back; editor count follows the compact focus window.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getAllByTestId("cell-editor-stub").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("moves selection with j/k and marks aria-selected", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    fireEvent.keyDown(rows[0], { key: "j" });
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
    expect(rows[0]).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(rows[1], { key: "k" });
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
  });

  it("inserts a cell below with b and via the hover divider", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[0], { key: "b" });
    // 4 cells, new cell focused at 1 → compact window 0-2 mounted.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    fireEvent.click(
      screen.getByRole("button", { name: "Add cell below cell 0" }),
    );
    // 5 cells, focus at 1 → window 0-2 mounted, 2 peeks.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    expect(document.querySelectorAll(".nb-code-peek")).toHaveLength(2);
  });

  it("converts code to markdown with m and back with y", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[0], { key: "m" });
    // Markdown renders instead of the editor; gutter Run is disabled.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Run cell 0" })).toBeDisabled();
    fireEvent.keyDown(screen.getAllByRole("listitem")[0], { key: "y" });
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
  });

  it("shows In[*] and a busy kernel dot while a cell runs", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    expect(screen.getByLabelText(/kernel busy/)).toBeInTheDocument();
    act(() => {
      resolveRun({ stdout: "done", stderr: "", exitCode: 0 });
    });
    await waitFor(() =>
      expect(screen.getByLabelText("kernel idle")).toBeInTheDocument(),
    );
  });

  it("keeps edited state for keystrokes typed during a run", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    // Type while the backend works: the late finish must not clear dirty,
    // or the footer hides that the output no longer matches the source.
    fireEvent.change(screen.getAllByTestId("cell-editor-stub")[0], {
      target: { value: "print('typed mid-run')" },
    });
    act(() => {
      resolveRun({ stdout: "done", stderr: "", exitCode: 0 });
    });
    await waitFor(() => expect(screen.getByText("done")).toBeInTheDocument());
    expect(
      screen.getByText("Edited — Shift+Enter to re-run."),
    ).toBeInTheDocument();
  });

  it("collapses, copies, and clears cell output", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "shape ok",
      stderr: "",
      exitCode: 0,
      durationMs: 5,
      variables: [
        {
          name: "df",
          type: "DataFrame",
          detail: "10 rows × 2 cols",
          rows: 10,
          cols: 2,
          columns: ["c0", "c1"],
          head: [{ c0: 1, c1: 2 }],
        },
      ],
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(screen.getByText("shape ok")).toBeInTheDocument(),
    );
    openKebab(0);
    clickMenuItem("Copy output");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("shape ok"));
    fireEvent.click(screen.getByTitle("Collapse output"));
    expect(screen.queryByText("shape ok")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Expand output"));
    openKebab(0);
    clickMenuItem("Clear output");
    expect(screen.queryByText("shape ok")).not.toBeInTheDocument();
  });

  it("switches cell type through the kebab menu", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    openKebab(0);
    clickMenuItem("Markdown");
    // Editor replaced by rendered markdown; kebab focus narrows the compact
    // window to the code neighbor (cell 1).
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Run cell 0" })).toBeDisabled();
    openKebab(0);
    clickMenuItem("Code");
    // Focus on 0 → compact window 0-1 mounted.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
  });

  it("disables run and output items without source or output", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    // Seeded cells have source: runnable.
    expect(
      screen.getByRole("menuitem", { name: /^Run cell/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
    // No output recorded yet: output items disabled.
    expect(
      screen.getByRole("menuitem", { name: "Copy output" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

describe("NotebookPane editor window (perf)", () => {
  const KEY = "polymorpha.nb.cells.v2::ws1::main";

  function seedCells(n: number) {
    const cells = Array.from({ length: n }, (_, k) => ({
      id: `w${k}`,
      executionCount: null,
      cell_type: "code",
      source: `x = ${k}`,
      stdout: null,
      stderr: null,
      exitCode: null,
      status: "idle",
      dirty: false,
      durationMs: null,
      engine: null,
      variables: [],
    }));
    localStorage.setItem(KEY, JSON.stringify(cells));
  }

  function renderPane() {
    return render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
  }

  function editorPaths() {
    return screen
      .queryAllByTestId("cell-editor-stub")
      .map((el) => el.getAttribute("data-model-path"));
  }

  it("mounts at most 3 editors with 8 cells (peek elsewhere)", () => {
    seedCells(8);
    const { container } = renderPane();
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    expect(container.querySelectorAll(".nb-code-peek")).toHaveLength(5);
    // Peek shows the live source, not a placeholder.
    expect(screen.getByText("x = 7")).toBeInTheDocument();
  });

  it("clicking a peek focuses and mounts its window", () => {
    seedCells(8);
    renderPane();
    fireEvent.click(screen.getByText("x = 7"));
    // Compact window |i-7|<=1 → cells 6,7 mounted.
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
    expect(
      screen.getByRole("listitem", { name: /Cell 7 code/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("gives every editor a stable kept model URI", () => {
    seedCells(3);
    const { rerender } = renderPane();
    const before = editorPaths();
    expect(before).toHaveLength(3);
    for (const p of before) {
      expect(p).toMatch(/^inmemory:\/\/nbcell\//);
    }
    expect(new Set(before).size).toBe(3);
    expect(
      screen
        .getAllByTestId("cell-editor-stub")
        .every((el) => el.getAttribute("data-keep-model") === "1"),
    ).toBe(true);
    // Focusing another cell keeps the surviving editors on their models.
    fireEvent.click(screen.getByText("x = 2"));
    const after = editorPaths();
    expect(after.length).toBeGreaterThan(0);
    for (const p of after) expect(before).toContain(p);
  });

  it("debounces persistence across keystrokes but flushes on unmount", () => {
    vi.useFakeTimers();
    try {
      seedCells(2);
      const { unmount } = renderPane();
      const before = localStorage.getItem(KEY);
      expect(before).not.toBeNull();
      fireEvent.change(screen.getAllByTestId("cell-editor-stub")[0], {
        target: { value: "x = 0  # edited" },
      });
      // Trailing debounce: not written yet.
      expect(localStorage.getItem(KEY)).toBe(before);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(localStorage.getItem(KEY)).toContain("# edited");
      // A second keystroke then unmount flushes without waiting.
      fireEvent.change(screen.getAllByTestId("cell-editor-stub")[0], {
        target: { value: "x = 0  # edited twice" },
      });
      unmount();
      expect(localStorage.getItem(KEY)).toContain("# edited twice");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DatasetVariablesPane single-list render", () => {
  it("lists session frames in the Notebook datasets card and renders no registry", async () => {
    render(
      <InventoryHarness>
        <DatasetVariablesPane onHide={() => {}} />
      </InventoryHarness>,
    );
    const section = await screen.findByLabelText("Notebook dataframes list");
    await waitFor(() => expect(section.textContent).not.toContain("Loading"));
    // Session rows: upload df + combine extra (the df registry tabs are gone).
    expect(section.textContent).toContain("df");
    expect(section.textContent).toContain("test1");
    // The old bottom registry (tabs/detail) is removed — merge lives in the
    // right-lane op sheet.
    expect(
      screen.queryByRole("tablist", { name: "Dataset variables" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Merge/ }),
    ).not.toBeInTheDocument();
  });

  it("peeks a loaded kernel frame via the Overview popup, drops scalars", async () => {
    useDataStore.setState({
      kernelVars: [
        {
          name: "df2",
          type: "DataFrame",
          detail: "150 rows × 4 cols",
          stage: "model",
          frame: {
            rows: 150,
            cols: 4,
            columns: ["sepal_length", "sepal_width"],
            head: [{ sepal_length: 5.1, sepal_width: 3.5 }],
          },
        },
        { name: "alpha", type: "float64", detail: "0.45", stage: "model" },
      ],
      kernelVarsStale: false,
    });
    render(
      <InventoryHarness>
        <DatasetVariablesPane onHide={() => {}} />
      </InventoryHarness>,
    );
    const section = await screen.findByLabelText("Notebook dataframes list");
    await waitFor(() => expect(section.textContent).toContain("df2"));
    expect(section.textContent).not.toContain("alpha");
    // Peek opens the full overview popup (dataset dialog), not an inline tab.
    const df2Row = screen.getByText("df2").closest("li");
    expect(df2Row).not.toBeNull();
    fireEvent.click(
      within(df2Row as HTMLElement).getByRole("button", { name: "Peek" }),
    );
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
  });
});

describe("NotebookPane grouped kebab + merge/duplicate/undo", () => {
  it("groups kebab actions with shortcut hints and edit operations", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    for (const label of ["Run", "Cell type", "Edit", "Arrange", "Output"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("menuitem", { name: /^Merge with above/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Merge with below/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Split at cursor/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Duplicate cell/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Insert above/ }),
    ).toBeInTheDocument();
    // Split needs a known cursor: code cells with a mounted editor stay
    // enabled in command mode (Monaco retains the position after blur,
    // and opening the kebab always ends edit mode); markdown without an
    // open edit textarea stays disabled.
    expect(
      screen.getByRole("menuitem", { name: /^Split at cursor/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
    // Merge with above is impossible on the first cell.
    expect(
      screen.getByRole("menuitem", { name: /^Merge with above/ }),
    ).toHaveAttribute("aria-disabled", "true");
    // No run in flight: no Cancel item.
    expect(
      screen.queryByRole("menuitem", { name: /^Cancel run/ }),
    ).not.toBeInTheDocument();
  });

  it("runs Split at cursor from command mode, failing inline without Monaco", async () => {
    vi.mocked(toast.message).mockClear();
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    clickMenuItem("Split at cursor");
    // No live Monaco cursor under jsdom: graceful inline failure (G19),
    // never a crash — and no split happened. Generous timeout: the first
    // dynamic import of the real editor chunk (monaco) transforms slowly
    // under jsdom; later imports resolve from cache.
    await waitFor(
      () =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringMatching(/Click in the cell first/),
        ),
      { timeout: 15000 },
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps Split at cursor disabled for markdown outside edit mode", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    clickMenuItem("Markdown");
    // Rendered markdown (not editing): no textarea, no cursor to split at.
    openKebab(0);
    expect(
      screen.getByRole("menuitem", { name: /^Split at cursor/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("merges with above via Shift+M and restores via toolbar Undo", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    const undoBtn = screen.getByRole("button", { name: "Undo" });
    expect(undoBtn).toBeDisabled();
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[1], { key: "M" });
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
    // Merged source reads top-down: load cell first, then the step code.
    const mergedValue = (
      screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement
    ).value;
    expect(mergedValue).toContain("df.head()");
    expect(mergedValue).toContain("query");
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(3);
    expect(undoBtn).toBeDisabled();
  });

  it("merges a single-empty side per Jupyter parity", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Insert an empty cell below cell 0, then merge down into it.
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[0], { key: "b" });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    openKebab(0);
    clickMenuItem("Merge with below");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(vi.mocked(toast.success).mock.calls.flat().join(" ")).toContain(
      "Cells merged.",
    );
  });

  it("drops a late result when delete+undo retires the run", async () => {
    let resolveRun!: (v: unknown) => void;
    vi.mocked(callExecuteApi).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve as (v: unknown) => void;
      }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    // Delete mid-run, undo to restore the twin, then let the orphan land.
    openKebab(0);
    clickMenuItem("Delete cell");
    const calls = vi.mocked(toast.success).mock.calls;
    const undo = calls
      .map(
        ([, opts]) =>
          (opts as { action?: { onClick?: () => void } })?.action?.onClick,
      )
      .find((fn) => typeof fn === "function");
    act(() => undo!());
    act(() => {
      resolveRun({ stdout: "stale", stderr: "", exitCode: 0 });
    });
    // Flush the orphaned promise; the restored twin must stay clean.
    await act(async () => {});
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("never run")).toHaveLength(3);
  });

  it("merges with below through the kebab, focused type winning", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    clickMenuItem("Merge with below");
    expect(screen.getAllByTestId("cell-editor-stub")).toHaveLength(2);
  });

  it("merges a single-empty neighbor, preserving the surviving source", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Empty cell 0 merged below: Jupyter parity drops the empty half and
    // keeps the surviving source (undo restores either way — only a
    // both-empty merge is refused as a no-op).
    // NOTE: assert rows, not mounted editors — opening the kebab focuses
    // row 0 and narrows the editor window, unmounting distant editors.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    const editor0 = screen.getAllByTestId(
      "cell-editor-stub",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(editor0, { target: { value: "" } });
    openKebab(0);
    clickMenuItem("Merge with below");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
        .value,
    ).toContain("query");
  });

  it("duplicates a cell below itself through the kebab", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    openKebab(0);
    clickMenuItem("Duplicate cell");
    // Four rows; the editor window follows focus (trigger re-focus), so
    // assert rows plus the duplicated source on the two mounted editors.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const editors = screen.getAllByTestId("cell-editor-stub");
    expect((editors[0] as HTMLTextAreaElement).value).toBe(
      (editors[1] as HTMLTextAreaElement).value,
    );
  });

  it("cancels a running cell from the kebab without an execution count", async () => {
    vi.mocked(callExecuteApi).mockImplementation(
      (params) =>
        new Promise((_, reject) => {
          params.signal?.addEventListener("abort", () => {
            reject(new DOMException("Operation aborted", "AbortError"));
          });
        }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    // The abort signal travels with the Run request.
    expect(vi.mocked(callExecuteApi).mock.calls[0][0].signal).toBeInstanceOf(
      AbortSignal,
    );
    openKebab(0);
    fireEvent.click(screen.getByRole("menuitem", { name: /^Cancel run/ }));
    await waitFor(() =>
      expect(screen.getByText("Run cancelled.")).toBeInTheDocument(),
    );
    // Cancel earns no execution count (Jupyter interrupt parity).
    expect(screen.getAllByLabelText("never run")).toHaveLength(3);
  });

  it("hides assist/lint cards for cancellations (cancel is not a code problem)", async () => {
    vi.mocked(callExecuteApi).mockImplementation(
      (params) =>
        new Promise((_, reject) => {
          params.signal?.addEventListener("abort", () => {
            reject(new DOMException("Operation aborted", "AbortError"));
          });
        }) as never,
    );
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    // Source that would lint on its own (`print(df.info)` calls nothing).
    const editor = screen.getAllByTestId(
      "cell-editor-stub",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "print(df.info)" } });
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    expect(await screen.findByLabelText("executing")).toBeInTheDocument();
    openKebab(0);
    fireEvent.click(screen.getByRole("menuitem", { name: /^Cancel run/ }));
    await waitFor(() =>
      expect(screen.getByText("Run cancelled.")).toBeInTheDocument(),
    );
    // No fix card: it would imply the cancel was caused by a code problem.
    expect(
      screen.queryByRole("note", { name: /Suggested fix/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/calls nothing/)).not.toBeInTheDocument();
  });

  it("formats markdown through the toolbar while editing", () => {
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    fireEvent.keyDown(rows[0], { key: "m" });
    // Rendered markdown: double-click to edit, toolbar appears.
    const rendered = document.querySelector(".nb-markdown");
    expect(rendered).not.toBeNull();
    fireEvent.doubleClick(rendered!);
    const editor = screen.getByLabelText(
      "Markdown source for cell 0",
    ) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole("button", { name: "Bold — cell 0" }));
    expect(
      (
        screen.getByLabelText(
          "Markdown source for cell 0",
        ) as HTMLTextAreaElement
      ).value,
    ).toContain("**bold**");
  });
});

describe("NotebookPane error assist card", () => {
  function setCellSource(value: string) {
    const editor = screen.getAllByTestId(
      "cell-editor-stub",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value } });
  }

  it("shows backend hint lines as info only — no deterministic fix buttons", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr:
        "KeyError: 'Salary'\nAvailable columns: price, bedrooms\nDid you mean: price?",
      exitCode: 1,
      durationMs: 3,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    setCellSource("print(Salary)");
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    // Structured card, not just red text: title + suggestion text + AI actions.
    await waitFor(() =>
      expect(
        screen.getByRole("note", { name: "Suggested fix for cell 0" }),
      ).toBeInTheDocument(),
    );
    // AI-only rule: suggestion text stays, but no button writes code.
    expect(
      screen.queryByRole("button", { name: "Use price" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inspect columns" }),
    ).toBeInTheDocument();
    // Card title mirrors the raw first line (raw block keeps it verbatim).
    expect(
      within(
        screen.getByRole("note", { name: "Suggested fix for cell 0" }),
      ).getByText("KeyError: 'Salary'"),
    ).toBeInTheDocument();
    // Source untouched without Stella.
    expect(
      (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("print(Salary)");
  });

  it("shows the bound-method lint as info only — Stella owns the fix", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr: "TypeError: unhashable type",
      exitCode: 1,
      durationMs: 2,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    setCellSource("print(df.info)");
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(
        screen.getByRole("note", { name: "Suggested fix for cell 0" }),
      ).toBeInTheDocument(),
    );
    // AI-only rule: lint text stays for discoverability, no Apply button.
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(
      (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("print(df.info)");
  });

  it("shows the AI-fix entry for a hint-less SyntaxError (no silent popup gap)", async () => {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "",
      stderr:
        'Traceback (most recent call last):\n  File "<string>", line 1, in <module>\n    Changed: wrapped head, called info bare.\n    ^^\nSyntaxError: invalid syntax',
      exitCode: 1,
      durationMs: 2,
    });
    render(
      <NotebookPane
        stage="model"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    setCellSource("Changed: wrapped head, called info bare.");
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    // No NameError/KeyError hints and no bound-method lint — the card must
    // still appear with Fix with AI, titled by the traceback's last line.
    const card = await screen.findByRole("note", {
      name: "Suggested fix for cell 0",
    });
    expect(card).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Fix with AI" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Explain" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText("SyntaxError: invalid syntax"),
    ).toBeInTheDocument();
  });

  it("sends the traceback tail (not just the first line) in the fix prompt", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr:
          'Traceback (most recent call last):\n  File "<string>", line 1, in <module>\nSyntaxError: invalid syntax',
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(df.head())");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await screen.findByRole("note", { name: "Suggested fix for cell 0" });
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const prompt = send.mock.calls[0][0] as string;
      // First line alone ("Traceback...") once made Stella reply "NO".
      expect(prompt).toContain("Traceback (most recent call last):");
      expect(prompt).toContain("SyntaxError: invalid syntax");
      expect(prompt).toContain("print(df.head())");
      // Two-part reply shape: code in the fence, summary after it.
      expect(prompt).toContain("never leave the fence empty");
      // No copyable code example in the instructions: the model parrots
      // salient snippets into the fence instead of fixing (observed).
      expect(prompt).not.toContain("e.g. print(");
      // Fix calls run stateless (self-contained prompt; shared history only
      // blends in other cells' errors).
      expect(send.mock.calls[0][1]).toEqual({ historyLimit: 0 });
      // DataFrame cell: print rule present, code cleanly separated.
      expect(prompt).toContain("This backend only shows");
      expect(prompt).toContain("Code:\nprint(df.head())\nThis backend");
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("omits the print rule (no stray period) for non-DataFrame cells", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(x)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await screen.findByRole("note", { name: "Suggested fix for cell 0" });
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const prompt = send.mock.calls[0][0] as string;
      expect(prompt).toContain("Code:\nprint(x)\nReply in two parts");
      expect(prompt).not.toContain("This backend only shows");
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("refuses an empty cell with an honest toast instead of sending", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(x)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await screen.findByRole("note", { name: "Suggested fix for cell 0" });
      setCellSource("");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      // The send path waits up to 300ms on a closed panel — outlive it.
      await new Promise((r) => setTimeout(r, 500));
      expect(send).not.toHaveBeenCalled();
      expect(vi.mocked(toast.message).mock.calls.flat().join(" ")).toMatch(
        /empty/i,
      );
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("shows a proposal diff (not just a toast) when the cell changed before Stella's reply", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(x)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      const card = await screen.findByRole("note", {
        name: "Suggested fix for cell 0",
      });
      fireEvent.click(
        within(card).getByRole("button", { name: "Fix with AI" }),
      );
      // Edit before the reply lands: no clobber — proposal, not a write.
      setCellSource("print(x)  # edited");
      act(() => {
        useStellaStore.setState({
          messages: [
            {
              role: "assistant",
              content: "```python\nprint(y)\n```\nChanged: use y.",
            },
          ],
        });
      });
      // Proposal diff renders inline where the toast would vanish.
      await waitFor(() =>
        expect(
          within(card).getByText("Stella proposes — review, then Approve:"),
        ).toBeInTheDocument(),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe("print(x)  # edited");
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("retries once on an empty fence, then auto-applies the good reply", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockImplementation(async (content: string) => {
        const { messages } = useStellaStore.getState();
        const first = send.mock.calls.length === 1;
        useStellaStore.setState({
          messages: [
            ...messages,
            { role: "user", content },
            {
              role: "assistant",
              content: first
                ? "```python\n```\nChanged: fixed it."
                : "```python\nprint(y)\n```\nChanged: use y.",
            },
          ],
        });
      });
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(x)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await screen.findByRole("note", { name: "Suggested fix for cell 0" });
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      // Empty fence → exactly one stern retry, then the good reply lands.
      await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("asking once more"),
      );
      // Both sends are stateless fix calls.
      expect(send.mock.calls[0][1]).toEqual({ historyLimit: 0 });
      expect(send.mock.calls[1][1]).toEqual({ historyLimit: 0 });
      await waitFor(() =>
        expect(
          (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
            .value,
        ).toBe("print(y)"),
      );
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("sends the failure to Stella from Explain without closing an open panel", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [], activeCellId: null });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "KeyError: 'Salary'\nAvailable columns: price",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(Salary)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Explain" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const prompt = send.mock.calls[0][0] as string;
      expect(prompt).toContain("KeyError: 'Salary'");
      expect(prompt).toContain("print(Salary)");
      expect(useStellaStore.getState().isOpen).toBe(true);
      // Active-cell context feeds KnowledgeService.search() (G25/G26).
      expect(useStellaStore.getState().activeCellId).toBeTruthy();
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        activeCellId: null,
      });
    }
  });

  it("sends the print rule in the Fix prompt for bound-method cells", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [] });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const prompt = send.mock.calls[0][0] as string;
      expect(prompt).toContain("print(");
      expect(prompt).toContain("df.info()");
    } finally {
      send.mockRestore();
      useStellaStore.setState({ isOpen: false, messages: [] });
    }
  });

  it("omits the print rule for cells with no frame output (no contamination)", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({ isOpen: true, messages: [] });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "KeyError: 'Salary'\nAvailable columns: price, bedrooms",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(Salary)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const prompt = send.mock.calls[0][0] as string;
      expect(prompt).toContain("print(Salary)");
      expect(prompt).not.toContain("df.info()");
    } finally {
      send.mockRestore();
      useStellaStore.setState({ isOpen: false, messages: [] });
    }
  });

  it("rejects a fix that shares no identifiers with the cell (hallucination guard)", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    vi.mocked(toast.message).mockClear();
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "KeyError: 'Salary'\nAvailable columns: price, bedrooms",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(Salary)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      // Hallucinated reply: valid fence, zero overlap with the cell.
      act(() => {
        useStellaStore.setState({
          messages: [
            { role: "user", content: "Fix this notebook cell." },
            {
              role: "assistant",
              content: "```python\ndf.info()\n```\nChanged.",
            },
          ],
        });
      });
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("didn't match"),
        ),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe("print(Salary)");
      expect(
        screen.queryByRole("button", { name: "Keep & Run" }),
      ).not.toBeInTheDocument();
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("auto-runs Stella's fix reply after writing — Undo restores via toast", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    vi.mocked(toast.success).mockClear();
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockImplementation(async (content: string) => {
        // Simulate the assistant reply landing after the send.
        useStellaStore.setState({
          messages: [
            { role: "user", content },
            {
              role: "assistant",
              content:
                "```python\nprint(df.head().to_string())\ndf.info()\n```\nChanged: wrapped head, called info bare.",
            },
          ],
        });
      });
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      const runsBefore = vi.mocked(callExecuteApi).mock.calls.length;
      const editor = () =>
        screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement;
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      // Locked behavior: write lands, re-run issues on its own.
      await waitFor(() =>
        expect(editor().value).toBe("print(df.head().to_string())\ndf.info()"),
      );
      await waitFor(() =>
        expect(vi.mocked(callExecuteApi).mock.calls.length).toBeGreaterThan(
          runsBefore,
        ),
      );
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        expect.stringContaining("re-running"),
        expect.anything(),
      );
      // The re-run supersedes the review entry; recovery is the Undo action.
      expect(
        screen.queryByRole("button", { name: "Keep & Run" }),
      ).not.toBeInTheDocument();
      const undo = vi
        .mocked(toast.success)
        .mock.calls.map(
          ([, opts]) =>
            (opts as { action?: { onClick?: () => void } })?.action?.onClick,
        )
        .find((fn) => typeof fn === "function");
      expect(undo).toBeTypeOf("function");
      const callsAfterRun = vi.mocked(callExecuteApi).mock.calls.length;
      act(() => undo!());
      await waitFor(() =>
        expect(editor().value).toBe("df.head()\nprint(df.info)"),
      );
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBe(callsAfterRun);
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("writes but skips the re-run when the cell is already running", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    // Fix requests never auto-send: the test injects the reply manually.
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    let resolveRun!: (v: unknown) => void;
    const deferred = new Promise((resolve) => {
      resolveRun = resolve as (v: unknown) => void;
    }) as never;
    try {
      vi.mocked(callExecuteApi)
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "TypeError: unhashable type",
          exitCode: 1,
          durationMs: 2,
        })
        .mockReturnValue(deferred);
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      const editor = () =>
        screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement;
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      // Re-run before the reply lands: the cell is running when it arrives.
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(screen.getByLabelText("executing")).toBeInTheDocument(),
      );
      act(() => {
        useStellaStore.setState({
          messages: [
            { role: "user", content: "Fix this notebook cell." },
            {
              role: "assistant",
              content:
                "```python\nprint(df.head().to_string())\ndf.info()\n```\nChanged.",
            },
          ],
        });
      });
      // Write lands (reviewable text), but no second execute starts — the
      // in-flight Run owns its pre-await code.
      await waitFor(() =>
        expect(editor().value).toBe("print(df.head().to_string())\ndf.info()"),
      );
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBe(2);
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("uses old code"),
      );
      act(() => {
        resolveRun({ stdout: "done", stderr: "", exitCode: 0 });
      });
      await waitFor(() =>
        expect(screen.getByLabelText("kernel idle")).toBeInTheDocument(),
      );
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("blocks a second Fix with AI while one is already pending", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(x)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      vi.mocked(toast.message).mockClear();
      // Second request while the first reply is still in flight: blocked,
      // so replies can never cross into the wrong cell.
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await new Promise((r) => setTimeout(r, 150));
      expect(send).toHaveBeenCalledTimes(1);
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("already fixing"),
      );
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("Reject on a manually applied edit drops review but keeps the written code", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockImplementation(async (content: string) => {
        useStellaStore.setState({
          messages: [
            { role: "user", content },
            {
              role: "assistant",
              content: "```python\nprint(df.head())\ndf.info()\n```\nChanged.",
            },
          ],
        });
      });
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      // Auto-apply lands first with its re-run; then an edit, then manual
      // Apply writes Stella's version as a reviewable entry (no run).
      const fixed = "print(df.head())\ndf.info()";
      await waitFor(() =>
        expect(
          (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
            .value,
        ).toBe(fixed),
      );
      const runsAfterAuto = await waitFor(() => {
        const n = vi.mocked(callExecuteApi).mock.calls.length;
        // Initial run + auto-run both settled.
        expect(n).toBeGreaterThanOrEqual(2);
        return n;
      });
      setCellSource(`${fixed}\n# mine`);
      fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Keep & Run" }),
        ).toBeInTheDocument(),
      );
      // Manual Apply takes Stella's version (the # mine edit is hers to
      // lose — undo stack kept it); Reject then drops review only.
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe(fixed);
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBe(runsAfterAuto);
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "Keep & Run" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe(fixed);
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBe(runsAfterAuto);
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("Undo to revert"),
      );
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("blocks Approve when the cell changed after the proposal", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    vi.mocked(toast.message).mockClear();
    // No auto-reply: the test injects the reply after editing mid-flight.
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      const original = "df.head()\nprint(df.info)";
      const fixed = "print(df.head())\ndf.info()";
      setCellSource(original);
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      // Edit before the reply lands → reply becomes a proposal, not a write.
      setCellSource(`${original}\n# my note`);
      act(() => {
        useStellaStore.setState({
          messages: [
            { role: "user", content: "Fix this notebook cell." },
            {
              role: "assistant",
              content: `\`\`\`python\n${fixed}\n\`\`\`\nChanged.`,
            },
          ],
        });
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Approve & Run" }),
        ).toBeInTheDocument(),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe(`${original}\n# my note`);
      // Edit again after the proposal landed…
      setCellSource(`${original}\n# my note\n# more`);
      fireEvent.click(screen.getByRole("button", { name: "Approve & Run" }));
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("changed since the proposal"),
        ),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe(`${original}\n# my note\n# more`);
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("stores a proposal (not a write) when the cell was edited while Stella replied", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    vi.mocked(toast.message).mockClear();
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      // User keeps typing before the reply lands…
      setCellSource("df.head()\nprint(df.info)\n# my note");
      // …then Stella's reply arrives: no clobber — a proposal to review.
      act(() => {
        useStellaStore.setState({
          messages: [
            { role: "user", content: "Fix this notebook cell." },
            {
              role: "assistant",
              content: "```python\nprint(df.head())\ndf.info()\n```\nChanged.",
            },
          ],
        });
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Approve & Run" }),
        ).toBeInTheDocument(),
      );
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("Cell edited"),
        ),
      );
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe("df.head()\nprint(df.info)\n# my note");
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("toasts inline when Stella's reply has no code block", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    vi.mocked(toast.message).mockClear();
    const send = vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      useStellaStore.setState({
        messages: [
          { role: "user", content: "Fix this notebook cell." },
          { role: "assistant", content: "That looks fine, nothing to change." },
        ],
      });
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("had no code"),
        ),
      );
      // Fenceless refusal: no retry, single send.
      expect(send).toHaveBeenCalledTimes(1);
      expect(
        (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
          .value,
      ).toBe("df.head()\nprint(df.info)");
    } finally {
      send.mockRestore();
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("manual Apply fix lands the reply as pending — review, then Keep", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      isStreaming: false,
      streamingContent: "",
      messages: [
        { role: "user", content: "Fix this notebook cell." },
        {
          role: "assistant",
          content:
            "Fixed:\n```python\nprint(df.head().to_string())\ndf.info()\n```\nWrapped head in print; called info bare.",
        },
      ],
    });
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("df.head()\nprint(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      const before = vi.mocked(callExecuteApi).mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
      // Pending write with diff; no Run until Kept.
      await waitFor(() =>
        expect(
          (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
            .value,
        ).toBe("print(df.head().to_string())\ndf.info()"),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Keep & Run" }),
        ).toBeInTheDocument(),
      );
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBe(before);
    } finally {
      useStellaStore.setState({
        isOpen: false,
        messages: [],
        streamingContent: "",
      });
    }
  });

  it("toasts inline when there is no Stella fix to apply", async () => {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: false,
      messages: [],
      isStreaming: false,
    });
    vi.mocked(toast.message).mockClear();
    try {
      vi.mocked(callExecuteApi).mockResolvedValue({
        stdout: "",
        stderr: "TypeError: unhashable type",
        exitCode: 1,
        durationMs: 2,
      });
      render(
        <NotebookPane
          stage="model"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      setCellSource("print(df.info)");
      fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
      await waitFor(() =>
        expect(
          screen.getByRole("note", { name: "Suggested fix for cell 0" }),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("No Stella fix yet"),
      );
    } finally {
      useStellaStore.setState({ isOpen: false, messages: [] });
    }
  });
});

describe("NotebookPane pending fixes across notebook switches", () => {
  const V2 = (nb: string) => `polymorpha.nb.cells.v2::ws1::${nb}`;
  const INDEX = "polymorpha.nb.index.v1::ws1";
  const FIX_REPLY =
    "```python\nprint(df.head().to_string())\n```\nChanged: wrapped in print.";

  function mkCell(id: string, source: string, stderr: string) {
    return {
      id,
      executionCount: 1,
      cell_type: "code",
      source,
      stdout: null,
      stderr,
      exitCode: 1,
      status: "idle",
      dirty: false,
      durationMs: 2,
      engine: "local",
      variables: [],
    };
  }

  function seedNb(nb: string, cells: ReturnType<typeof mkCell>[]) {
    localStorage.setItem(V2(nb), JSON.stringify(cells));
  }

  function seedNbIndex(entries: Array<{ id: string; name: string }>) {
    localStorage.setItem(
      INDEX,
      JSON.stringify(entries.map((e, i) => ({ ...e, updatedAt: i + 1 }))),
    );
  }

  function renderNb(nb: string) {
    return render(
      <NotebookPane
        stage="model"
        notebookId={nb}
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
  }

  function nbEditorValue(): string {
    return (screen.getAllByTestId("cell-editor-stub")[0] as HTMLTextAreaElement)
      .value;
  }

  function mockRunOk() {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
  }

  async function resetStella() {
    const { useStellaStore } = await import("@/stella/store");
    useStellaStore.setState({
      isOpen: true,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
    return useStellaStore;
  }

  type StellaStore = Awaited<ReturnType<typeof resetStella>>;

  function noFixSend(useStellaStore: StellaStore) {
    return vi
      .spyOn(useStellaStore.getState(), "sendMessage")
      .mockResolvedValue(undefined);
  }

  function injectFixReply(useStellaStore: StellaStore) {
    useStellaStore.setState({
      messages: [
        { role: "user", content: "fix prompt" },
        { role: "assistant", content: FIX_REPLY },
      ],
      isStreaming: false,
      streamingContent: "",
    });
  }

  function cleanupStella(
    useStellaStore: StellaStore,
    send: { mockRestore: () => void },
  ) {
    send.mockRestore();
    useStellaStore.setState({
      isOpen: false,
      messages: [],
      isStreaming: false,
      streamingContent: "",
    });
  }

  it("holds a pending fix across a notebook switch and applies on return", async () => {
    const useStellaStore = await resetStella();
    vi.mocked(toast.message).mockClear();
    mockRunOk();
    const send = noFixSend(useStellaStore);
    try {
      seedNb("nb-a", [mkCell("acell", "df.head()", "TypeError: bad")]);
      seedNb("nb-b", [
        mkCell("bcell", "print(oops)", "NameError: name 'oops' is not defined"),
      ]);
      seedNbIndex([
        { id: "nb-a", name: "Notebook A" },
        { id: "nb-b", name: "Notebook B" },
      ]);
      const { rerender } = renderNb("nb-a");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      // Away before the reply lands.
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-b"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      expect(nbEditorValue()).toBe("print(oops)");
      // Reply lands while viewing B: held, not dropped, not written.
      injectFixReply(useStellaStore);
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("switch back"),
          expect.anything(),
        ),
      );
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining('"Notebook A"'),
        expect.anything(),
      );
      expect(nbEditorValue()).toBe("print(oops)");
      // Switch back: the held fix applies and re-runs.
      const runsBefore = vi.mocked(callExecuteApi).mock.calls.length;
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-a"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      await waitFor(() =>
        expect(nbEditorValue()).toBe("print(df.head().to_string())"),
      );
      expect(vi.mocked(callExecuteApi).mock.calls.length).toBeGreaterThan(
        runsBefore,
      );
    } finally {
      cleanupStella(useStellaStore, send);
    }
  });

  it("refuses a manual Apply in the wrong notebook instead of cross-writing", async () => {
    const useStellaStore = await resetStella();
    vi.mocked(toast.message).mockClear();
    mockRunOk();
    const send = noFixSend(useStellaStore);
    try {
      seedNb("nb-a", [mkCell("acell", "df.head()", "TypeError: bad")]);
      seedNb("nb-b", [
        mkCell("bcell", "print(oops)", "NameError: name 'oops' is not defined"),
      ]);
      seedNbIndex([
        { id: "nb-a", name: "Notebook A" },
        { id: "nb-b", name: "Notebook B" },
      ]);
      const { rerender } = renderNb("nb-a");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-b"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      injectFixReply(useStellaStore);
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("switch back"),
          expect.anything(),
        ),
      );
      // Without the guard this would write A's fix into B on the shared
      // `print` identifier — it must refuse with direction instead.
      fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        expect.stringContaining("That reply is for notebook"),
      );
      expect(nbEditorValue()).toBe("print(oops)");
      expect(localStorage.getItem(V2("nb-a"))).toContain("df.head()");
      expect(localStorage.getItem(V2("nb-a"))).not.toContain("to_string");
    } finally {
      cleanupStella(useStellaStore, send);
    }
  });

  it("names the renamed notebook in the switch-back toast and still applies", async () => {
    const useStellaStore = await resetStella();
    vi.mocked(toast.message).mockClear();
    mockRunOk();
    const send = noFixSend(useStellaStore);
    try {
      seedNb("nb-a", [mkCell("acell", "df.head()", "TypeError: bad")]);
      seedNb("nb-b", [
        mkCell("bcell", "print(oops)", "NameError: name 'oops' is not defined"),
      ]);
      seedNbIndex([
        { id: "nb-a", name: "Notebook A" },
        { id: "nb-b", name: "Notebook B" },
      ]);
      const { rerender } = renderNb("nb-a");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-b"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      // Rename A while away (what the hook's rename writes to the index).
      seedNbIndex([
        { id: "nb-a", name: "EDA" },
        { id: "nb-b", name: "Notebook B" },
      ]);
      injectFixReply(useStellaStore);
      // Live lookup: the toast carries the NEW name, and the pending is
      // kept (a rename is not a deletion).
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining('"EDA"'),
          expect.anything(),
        ),
      );
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-a"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      await waitFor(() =>
        expect(nbEditorValue()).toBe("print(df.head().to_string())"),
      );
    } finally {
      cleanupStella(useStellaStore, send);
    }
  });

  it("drops a pending fix when its notebook is deleted and frees the gate", async () => {
    const useStellaStore = await resetStella();
    vi.mocked(toast.message).mockClear();
    mockRunOk();
    const send = noFixSend(useStellaStore);
    try {
      seedNb("nb-a", [mkCell("acell", "df.head()", "TypeError: bad")]);
      seedNb("nb-b", [
        mkCell("bcell", "print(oops)", "NameError: name 'oops' is not defined"),
      ]);
      seedNb("nb-c", [mkCell("ccell", "x + 1", "TypeError: bad")]);
      seedNbIndex([
        { id: "nb-a", name: "Notebook A" },
        { id: "nb-b", name: "Notebook B" },
        { id: "nb-c", name: "Notebook C" },
      ]);
      const { rerender } = renderNb("nb-a");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-b"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      // A is deleted while away (index entry gone, like the hook's delete).
      seedNbIndex([
        { id: "nb-b", name: "Notebook B" },
        { id: "nb-c", name: "Notebook C" },
      ]);
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-c"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      await waitFor(() =>
        expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
          expect.stringContaining("was deleted"),
        ),
      );
      // Gate released: a Fix in C sends instead of blocking.
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    } finally {
      cleanupStella(useStellaStore, send);
    }
  });

  it("names the owning notebook in the in-flight gate and Discard frees it", async () => {
    const useStellaStore = await resetStella();
    vi.mocked(toast.message).mockClear();
    mockRunOk();
    const send = noFixSend(useStellaStore);
    try {
      seedNb("nb-a", [mkCell("acell", "df.head()", "TypeError: bad")]);
      seedNb("nb-b", [
        mkCell("bcell", "print(oops)", "NameError: name 'oops' is not defined"),
      ]);
      seedNbIndex([
        { id: "nb-a", name: "Notebook A" },
        { id: "nb-b", name: "Notebook B" },
      ]);
      const { rerender } = renderNb("nb-a");
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      rerender(
        <NotebookPane
          stage="model"
          notebookId="nb-b"
          pendingSnippet={null}
          onPendingConsumed={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      // Blocked synchronously (no second send) with a named, discardable toast.
      expect(send).toHaveBeenCalledTimes(1);
      const gateCall = vi
        .mocked(toast.message)
        .mock.calls.find(
          ([msg]) => typeof msg === "string" && msg.includes('"Notebook A"'),
        );
      expect(gateCall).toBeDefined();
      const action = (
        gateCall![1] as {
          action?: { label?: string; onClick?: () => void };
        }
      )?.action;
      expect(action?.label).toBe("Discard");
      act(() => action!.onClick!());
      // Gate released: Fix in B now sends.
      fireEvent.click(screen.getByRole("button", { name: "Fix with AI" }));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    } finally {
      cleanupStella(useStellaStore, send);
    }
  });
});

describe("NotebookPane per-notebook dataset pointer", () => {
  const V2 = (nb: string) => `polymorpha.nb.cells.v2::ws1::${nb}`;
  const DS = (nb: string) => `polymorpha.nb.dataset.v2::ws1::${nb}`;

  function runCell(id: string, source = "print(1)") {
    return {
      id,
      executionCount: null,
      cell_type: "code",
      source,
      stdout: null,
      stderr: null,
      exitCode: null,
      status: "idle",
      dirty: false,
      durationMs: null,
      engine: null,
      variables: [],
    };
  }

  function seedNb(nb: string, cells: ReturnType<typeof runCell>[]) {
    localStorage.setItem(V2(nb), JSON.stringify(cells));
  }

  function renderNb(nb: string) {
    return render(
      <NotebookPane
        stage="model"
        notebookId={nb}
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
  }

  function mockRunOk() {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
  }

  function setGlobalDataset(
    fileName: string,
    storagePath: string,
    uploadId: string,
  ) {
    act(() => {
      useDataStore.setState({
        raw: dataset(fileName, 5, 1),
        rawHash: `${fileName}-hash`,
        totalRowCount: 5,
        storagePath,
        uploadId,
        computedHead: dataset(fileName, 5, 1),
      } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
    });
  }

  it("runs against the notebook's remembered dataset, not the global one", async () => {
    mockRunOk();
    seedNb("nb-a", [runCell("acell")]);
    localStorage.setItem(
      DS("nb-a"),
      JSON.stringify({
        uploadId: "upX",
        fileName: "other.csv",
        storagePath: "users/u1/other.csv",
      }),
    );
    renderNb("nb-a");
    // Badge names the remembered dataset (global is df.csv).
    expect(
      screen.getByText(/Notebook dataset: other\.csv/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(vi.mocked(callExecuteApi)).toHaveBeenCalledTimes(1),
    );
    const manifest = vi.mocked(callExecuteApi).mock.calls[0][0] as unknown as {
      datasets: Array<{ fileName: string }>;
    };
    expect(manifest.datasets[0]?.fileName).toBe("other.csv");
    expect(vi.mocked(getDownloadUrlCached)).toHaveBeenCalledWith(
      "users/u1/other.csv",
    );
  });

  it("records the dataset on global move and restores it after a switch", async () => {
    seedNb("nb-a", [runCell("acell")]);
    seedNb("nb-b", [runCell("bcell")]);
    const { rerender } = renderNb("nb-a");
    // No pointer yet: follows the global dataset, no badge.
    expect(screen.queryByText(/Notebook dataset:/)).not.toBeInTheDocument();
    // Global moves while viewing A → A remembers other.csv.
    setGlobalDataset("other.csv", "users/u1/other.csv", "upX");
    await waitFor(() =>
      expect(localStorage.getItem(DS("nb-a"))).toContain("other.csv"),
    );
    const pane = (
      <NotebookPane
        stage="model"
        notebookId="nb-b"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />
    );
    rerender(pane);
    // B never recorded a pointer: follows global, no badge.
    expect(screen.queryByText(/Notebook dataset:/)).not.toBeInTheDocument();
    // Global moves back while on B (B records df.csv).
    setGlobalDataset("df.csv", "users/u1/df.csv", "up1");
    await waitFor(() =>
      expect(localStorage.getItem(DS("nb-b"))).toContain("df.csv"),
    );
    // Return to A: its other.csv pointer is restored, badged, and kept.
    rerender(
      <NotebookPane
        stage="model"
        notebookId="nb-a"
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
    expect(
      await screen.findByText(/Notebook dataset: other\.csv/),
    ).toBeInTheDocument();
    expect(localStorage.getItem(DS("nb-b"))).toContain("df.csv");
  });

  it("falls back to the global dataset when no pointer was recorded", async () => {
    mockRunOk();
    seedNb("nb-a", [runCell("acell")]);
    renderNb("nb-a");
    expect(screen.queryByText(/Notebook dataset:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(vi.mocked(callExecuteApi)).toHaveBeenCalledTimes(1),
    );
    const manifest = vi.mocked(callExecuteApi).mock.calls[0][0] as unknown as {
      datasets: Array<{ fileName: string }>;
    };
    expect(manifest.datasets[0]?.fileName).toBe("df.csv");
  });
});

describe("NotebookPane dataset-stale outputs", () => {
  const V2 = (nb: string) => `polymorpha.nb.cells.v2::ws1::${nb}`;

  function dsCell(
    id: string,
    source: string,
    extra: Record<string, unknown> = {},
  ) {
    return {
      id,
      executionCount: 1,
      cell_type: "code",
      source,
      stdout: "out\n",
      stderr: null,
      exitCode: 0,
      status: "idle",
      dirty: false,
      durationMs: 2,
      engine: "local",
      variables: [],
      ...extra,
    };
  }

  function renderNb(nb: string) {
    return render(
      <NotebookPane
        stage="model"
        notebookId={nb}
        pendingSnippet={null}
        onPendingConsumed={() => {}}
      />,
    );
  }

  function mockRunOk() {
    vi.mocked(callExecuteApi).mockResolvedValue({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
      durationMs: 1,
    });
  }

  function readCells(nb: string) {
    return JSON.parse(localStorage.getItem(V2(nb)) ?? "[]") as Array<{
      id: string;
      ranFileName?: unknown;
    }>;
  }

  it("records the dataset provenance on Run", async () => {
    mockRunOk();
    localStorage.setItem(
      V2("nb-a"),
      JSON.stringify([dsCell("acell", "print(1)")]),
    );
    const { unmount } = renderNb("nb-a");
    fireEvent.click(screen.getByRole("button", { name: "Run cell 0" }));
    await waitFor(() =>
      expect(vi.mocked(callExecuteApi)).toHaveBeenCalledTimes(1),
    );
    // Unmount flushes the debounced persist; provenance must be stored.
    unmount();
    expect(readCells("nb-a")[0]?.ranFileName).toBe("df.csv");
  });

  it("flags outputs recorded under another dataset", () => {
    localStorage.setItem(
      V2("nb-a"),
      JSON.stringify([dsCell("acell", "print(1)", { ranFileName: "old.csv" })]),
    );
    renderNb("nb-a");
    expect(
      screen.getByText("Outputs from old.csv — Shift+Enter to re-run."),
    ).toBeInTheDocument();
  });

  it("never flags unknown provenance (old persisted cells)", () => {
    // Old persisted shape: executed, but no provenance recorded.
    localStorage.setItem(
      V2("nb-a"),
      JSON.stringify([dsCell("acell", "print(1)")]),
    );
    renderNb("nb-a");
    expect(screen.queryByText(/Outputs from/)).not.toBeInTheDocument();
    // Pure-Python runs record null by construction (`runFileName || null`);
    // the pane itself requires a dataset to render (`if (!raw) return
    // null`), so the empty-provenance path is covered at the helper level.
  });

  it("re-run stale cells runs exactly the stale subset, then clears", async () => {
    mockRunOk();
    localStorage.setItem(
      V2("nb-a"),
      JSON.stringify([
        dsCell("stale", "print(1)", { ranFileName: "old.csv" }),
        dsCell("fresh", "print(2)", { ranFileName: "df.csv" }),
      ]),
    );
    renderNb("nb-a");
    fireEvent.click(screen.getByRole("button", { name: "Re-run stale cells" }));
    await waitFor(() =>
      expect(vi.mocked(callExecuteApi)).toHaveBeenCalledTimes(1),
    );
    const manifest = vi.mocked(callExecuteApi).mock.calls[0][0] as unknown as {
      code: string;
    };
    expect(manifest.code).toBe("print(1)");
    // The re-run recorded df.csv provenance: nothing stale remains.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Re-run stale cells" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("hides the re-run button when nothing is stale", () => {
    localStorage.setItem(
      V2("nb-a"),
      JSON.stringify([dsCell("acell", "print(1)", { ranFileName: "df.csv" })]),
    );
    renderNb("nb-a");
    expect(
      screen.queryByRole("button", { name: "Re-run stale cells" }),
    ).not.toBeInTheDocument();
  });
});

describe("DatasetVariablesPane two-card lane", () => {
  const varRow: NotebookDatasetRow = {
    key: "var:df",
    kind: "variable",
    uploadId: "",
    fileName: "modeled-cleaned.csv",
    varName: "df",
    rows: 4600,
    cols: 18,
    columns: [],
    storageRef: "",
    hasStorage: false,
    missing: false,
    inNotebook: true,
    inWorkspace: false,
    loaded: true,
    mergeable: true,
  };
  const fileRow: NotebookDatasetRow = {
    ...varRow,
    key: "ws-only",
    kind: "file",
    uploadId: "u-only",
    fileName: "modified_data.csv",
    varName: null,
    inNotebook: false,
    inWorkspace: true,
    loaded: false,
  };

  function renderPane(rows: NotebookDatasetRow[]) {
    return render(
      <DatasetInventoryContext.Provider
        value={{
          rows,
          loading: false,
          loadPointer: vi.fn().mockResolvedValue({ ok: true }),
          loadingUploadId: null,
          lineageWarning: null,
          autoLoadWarning: null,
          failedUploadIds: [],
        }}
      >
        <DatasetVariablesPane onHide={() => {}} />
      </DatasetInventoryContext.Provider>,
    );
  }

  it("renders a Workspace datasets card below Notebook dataframes", () => {
    renderPane([varRow, fileRow]);
    expect(screen.getByLabelText("Notebook dataframes")).toBeDefined();
    expect(screen.getByLabelText("Workspace datasets")).toBeDefined();
  });

  it("keeps cards disjoint: a variable never duplicates as a file row", () => {
    renderPane([varRow, fileRow]);
    fireEvent.click(screen.getByTitle("Expand notebook dataframes"));
    const framesList = screen.getByLabelText("Notebook dataframes list");
    const wsList = screen.getByLabelText("Workspace datasets list");
    // The kernel variable renders only in the variables card.
    expect(framesList.textContent).toContain("modeled-cleaned.csv");
    expect(wsList.textContent).not.toContain("modeled-cleaned.csv");
    // The workspace file renders only in the files card.
    expect(wsList.textContent).toContain("modified_data.csv");
    expect(framesList.textContent).not.toContain("modified_data.csv");
  });

  it("never renders a manual Load button (files open automatically)", () => {
    renderPane([varRow, fileRow]);
    expect(screen.queryByRole("button", { name: "Load" })).toBeNull();
  });

  it("keeps stale kernel rows visible but marked, out of merge claims", () => {
    const staleRow: NotebookDatasetRow = {
      ...varRow,
      key: "var:stale",
      fileName: "stale.csv",
      stale: true,
      mergeable: false,
    };
    renderPane([staleRow]);
    fireEvent.click(screen.getByTitle("Expand notebook dataframes"));
    const framesList = screen.getByLabelText("Notebook dataframes list");
    expect(framesList.textContent).toContain("stale — run to refresh");
  });
});
