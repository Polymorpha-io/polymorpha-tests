import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllDatasetsExpander } from "@/components/NotebookWorkbench/frames/AllDatasetsExpander";
import {
  groupDatasetRows,
  unloadedCount,
  resolveRowPick,
} from "@/components/NotebookWorkbench/frames/datasetGroups";
import type { NotebookDatasetRow } from "@/components/NotebookWorkbench/useNotebookDatasets";

function row(over: Partial<NotebookDatasetRow>): NotebookDatasetRow {
  return {
    key: "k",
    uploadId: "u1",
    fileName: "f.csv",
    varName: null,
    rows: 100,
    cols: 5,
    columns: [],
    storageRef: "ref",
    hasStorage: true,
    missing: false,
    inNotebook: false,
    inWorkspace: true,
    loaded: false,
    mergeable: true,
    ...over,
  };
}

const loaded = row({
  key: "df",
  uploadId: "u-df",
  fileName: "a.csv",
  varName: "df",
  loaded: true,
  inNotebook: true,
});
const pointer = row({
  key: "ptr",
  uploadId: "u-ptr",
  fileName: "b.csv",
  inNotebook: true,
  inWorkspace: false,
  hasStorage: false,
  storageRef: "",
});
const workspace = row({
  key: "ws",
  uploadId: "u-ws",
  fileName: "Training.csv",
  rows: 4920,
  cols: 134,
});

describe("groupDatasetRows", () => {
  it("groups loaded → registered → workspace, omitting empty groups", () => {
    const groups = groupDatasetRows([loaded, workspace, pointer]);
    expect(groups.map((g) => g.label)).toEqual([
      "In this session",
      "Registered — attaches on next Run",
      "Workspace — not loaded",
    ]);
    expect(groups[0].rows.map((r) => r.fileName)).toEqual(["a.csv"]);
    expect(groups[1].rows.map((r) => r.fileName)).toEqual(["b.csv"]);
    expect(groups[2].rows.map((r) => r.fileName)).toEqual(["Training.csv"]);
  });

  it("counts only unloaded rows for the expander label", () => {
    expect(unloadedCount([loaded, pointer, workspace])).toBe(2);
  });
});

describe("resolveRowPick", () => {
  it("picks loaded rows by kernel var name when resolvable, else file name", () => {
    expect(resolveRowPick(loaded, ["df", "df2"], ["df", "a.csv"])).toEqual({
      kind: "pick",
      name: "df",
    });
    expect(resolveRowPick(loaded, ["df2"], ["df", "a.csv"])).toEqual({
      kind: "pick",
      name: "a.csv",
    });
  });

  it("never picks a loaded name missing from the operand list", () => {
    expect(resolveRowPick(loaded, [], ["z.csv"])).toEqual({ kind: "none" });
  });

  it("never picks stale kernel rows (G30 — namespace may have evicted)", () => {
    const stale = row({
      key: "df-stale",
      uploadId: "u-stale",
      fileName: "stale.csv",
      varName: "df",
      loaded: true,
      inNotebook: true,
      stale: true,
    });
    expect(resolveRowPick(stale, ["df"], ["df"])).toEqual({ kind: "none" });
  });

  it("loads workspace rows with storage + measured counts only (G30)", () => {
    expect(resolveRowPick(workspace, [], [])).toEqual({ kind: "load" });
    expect(
      resolveRowPick(
        row({ uploadId: "u-x", fileName: "x.csv", rows: null, cols: null }),
        [],
        [],
      ),
    ).toEqual({ kind: "none" });
    expect(
      resolveRowPick(row({ hasStorage: false, storageRef: "" }), [], []),
    ).toEqual({ kind: "none" });
    expect(resolveRowPick(row({ missing: true }), [], [])).toEqual({
      kind: "none",
    });
  });

  it("ignores registered pointers (attach on Run, not pickable)", () => {
    expect(resolveRowPick(pointer, [], [])).toEqual({ kind: "none" });
  });
});

describe("AllDatasetsExpander", () => {
  it("renders collapsed with the total count, expands on click", () => {
    const { container } = render(
      <AllDatasetsExpander rows={[loaded, workspace]} loadingUploadId={null} />,
    );
    const toggle = screen.getByRole("button", { name: /all dataframes/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // Total rows, not unloaded-only — the lane shows the same 2 rows.
    expect(toggle.textContent).toContain("(2)");
    expect(container.querySelector(".wb-datasets-expander-body")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("In this session")).toBeDefined();
    expect(screen.getByText("Workspace — not loaded")).toBeDefined();
  });

  it("whole-row pick when onPick is wired (combine modals)", () => {
    const onPick = vi.fn();
    render(
      <AllDatasetsExpander
        rows={[workspace]}
        loadingUploadId={null}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all dataframes/i }));
    // Row button's accessible name comes from its content (name + meta).
    fireEvent.click(screen.getByRole("button", { name: /training\.csv/i }));
    expect(onPick).toHaveBeenCalledWith(workspace);
  });

  it("shows a Load action instead of pick when only onLoad is wired (Apply to)", () => {
    const onLoad = vi.fn();
    render(
      <AllDatasetsExpander
        rows={[loaded, workspace]}
        loadingUploadId={null}
        onLoad={onLoad}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all dataframes/i }));
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(onLoad).toHaveBeenCalledWith(workspace);
    // Loaded rows offer Peek only where wired; here they have no action.
    expect(screen.queryByRole("button", { name: "Peek" })).toBeNull();
  });

  it("shows a per-row loading state for the in-flight upload", () => {
    render(
      <AllDatasetsExpander
        rows={[workspace]}
        loadingUploadId={workspace.uploadId}
        onLoad={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all dataframes/i }));
    expect(screen.getByText("⏳ loading")).toBeDefined();
    expect(
      (screen.getByRole("button", { name: /loading/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("marks stale kernel rows as stale instead of loaded", () => {
    const stale = row({
      key: "df-stale",
      uploadId: "u-stale",
      fileName: "stale.csv",
      varName: "df",
      loaded: true,
      inNotebook: true,
      stale: true,
    });
    render(
      <AllDatasetsExpander
        rows={[stale]}
        loadingUploadId={null}
        onLoad={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all dataframes/i }));
    expect(screen.getByText("● stale")).toBeDefined();
  });
});

describe("AllDatasetsExpander in-use markers", () => {
  function expand(
    rows: NotebookDatasetRow[],
    used?: { left?: string; right?: string },
  ) {
    render(
      <AllDatasetsExpander
        rows={rows}
        loadingUploadId={null}
        onPick={vi.fn()}
        usedLeft={used?.left}
        usedRight={used?.right}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /all dataframes/i }));
  }

  it("marks rows occupying operand slots", () => {
    expand([row({ key: "a", uploadId: "u-a", fileName: "a.csv" })], {
      left: "a.csv",
    });
    expect(screen.getByText("✓ left")).toBeDefined();
  });
});
