import { describe, it, expect } from "vitest";
import {
  mergeNotebookDatasets,
  shouldRegisterPointer,
} from "@/components/NotebookWorkbench/useNotebookDatasets";
import { originLabel } from "@/components/NotebookWorkbench/NotebookDatasetsSection";
import type { WorkspaceDatasetMeta } from "@/components/NotebookWorkbench/useNotebookDatasets";
import { buildVariables } from "@/components/NotebookWorkbench/variables";
import type { Dataset } from "@/types";

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

function wsMeta(
  uploadId: string,
  fileName: string,
  rowCount = 100,
  colCount = 4,
): WorkspaceDatasetMeta {
  return {
    uploadId,
    fileName,
    rowCount,
    colCount,
    storageRef: `users/u/workspaces/w/datasets/${uploadId}/data.csv`,
    hasStorage: true,
  };
}

const EMPTY_SNAP = {
  raw: null,
  combineExtras: [],
  computedHead: null,
  hasAppliedSteps: false,
  cleaned: null,
  totalRowCount: null,
  kernelVars: [],
};

describe("mergeNotebookDatasets", () => {
  it("merges notebook + workspace + session, deduped by uploadId", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("sales.csv", 690, 8),
      totalRowCount: 690,
    });
    const rows = mergeNotebookDatasets({
      notebookIds: ["up1", "up2"],
      notebookTitles: { up1: "sales.csv" },
      workspaceDatasets: [
        wsMeta("up1", "sales.csv", 690, 8),
        wsMeta("up3", "churn.csv", 90, 3),
      ],
      sessionVars,
      activeUploadId: "up1",
    });
    const byFile = new Map(rows.map((r) => [r.fileName, r]));
    // up1: both notebook + workspace, live as df.
    expect(byFile.get("sales.csv")).toMatchObject({
      inNotebook: true,
      inWorkspace: true,
      loaded: true,
      mergeable: true,
      varName: "df",
    });
    // up2: notebook-only, unknown counts, not mergeable.
    const nbOnly = rows.find((r) => r.uploadId === "up2");
    expect(nbOnly).toMatchObject({
      inNotebook: true,
      inWorkspace: false,
      rows: null,
      mergeable: false,
    });
    // up3: workspace-only, mergeable via storage.
    expect(byFile.get("churn.csv")).toMatchObject({
      inNotebook: false,
      inWorkspace: true,
      loaded: false,
      mergeable: true,
      rows: 90,
    });
    // Sort: both → notebook-only → workspace-only.
    expect(rows.map((r) => r.fileName)).toEqual([
      "sales.csv",
      "up2",
      "churn.csv",
    ]);
  });

  it("marks missing uploads unmergeable and keeps counts truthful", () => {
    const rows = mergeNotebookDatasets({
      notebookIds: [],
      workspaceDatasets: [
        { ...wsMeta("up9", "gone.csv"), hasStorage: false, missing: true },
      ],
      sessionVars: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      missing: true,
      loaded: false,
      mergeable: false,
      rows: 100,
    });
  });

  it("lists session-only kernel frames (df2) for merging", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("df.csv", 10, 2),
      totalRowCount: 10,
      kernelVars: [
        {
          name: "df2",
          type: "DataFrame",
          detail: "150 rows × 4 cols",
          stage: "model",
          frame: {
            rows: 150,
            cols: 4,
            columns: ["c0", "c1", "c2", "c3"],
            head: [{ c0: 1 }],
          },
        },
      ],
    });
    const rows = mergeNotebookDatasets({
      notebookIds: [],
      workspaceDatasets: [],
      sessionVars,
    });
    const df2 = rows.find((r) => r.varName === "df2");
    expect(df2).toMatchObject({ loaded: true, mergeable: true, rows: 150 });
    expect(df2?.columns).toEqual(["c0", "c1", "c2", "c3"]);
  });

  it("does not duplicate the active df when a row already links it", () => {
    // Notebook row links the kernel `df` via the activeUploadId fallback;
    // the session-only loop must not re-emit it under its pseudo-fileName
    // (the kernel name), which produced the `df` notebook + `df` session twin.
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("df.csv", 10, 2),
      totalRowCount: 10,
      kernelVars: [
        {
          name: "df",
          type: "DataFrame",
          detail: "10 rows × 2 cols",
          stage: "stats",
          frame: {
            rows: 10,
            cols: 2,
            columns: ["c0", "c1"],
            head: [{ c0: 1 }],
          },
        },
      ],
    });
    const rows = mergeNotebookDatasets({
      notebookIds: ["up1"],
      notebookTitles: { up1: "df.csv" },
      workspaceDatasets: [],
      sessionVars,
      activeUploadId: "up1",
    });
    const dfRows = rows.filter((r) => r.varName === "df");
    expect(dfRows).toHaveLength(1);
    expect(dfRows[0]).toMatchObject({ inNotebook: true, loaded: true });
    expect(rows.some((r) => r.key === "session:df")).toBe(false);
  });

  it("surfaces out/cleaned as session rows (registry removal parity)", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("df.csv", 10, 2),
      totalRowCount: 10,
      hasAppliedSteps: true,
      computedHead: dataset("df.csv", 8, 2),
      cleaned: dataset("df.csv", 7, 2),
    });
    const rows = mergeNotebookDatasets({
      notebookIds: [],
      workspaceDatasets: [],
      sessionVars,
    });
    expect(rows.map((r) => r.varName)).toEqual(["df", "out", "cleaned"]);
    expect(rows.find((r) => r.varName === "out")).toMatchObject({
      loaded: true,
      mergeable: true,
      rows: 8,
    });
  });

  it("never fabricates counts for unknown datasets", () => {
    const rows = mergeNotebookDatasets({
      notebookIds: ["ghost-id"],
      sessionVars: [],
    });
    expect(rows[0].rows).toBeNull();
    expect(rows[0].cols).toBeNull();
  });
});

describe("originLabel", () => {
  it("reports both/notebook/workspace/session provenance", () => {
    const base = {
      key: "k",
      uploadId: "",
      fileName: "f.csv",
      varName: null,
      rows: null,
      cols: null,
      columns: [],
      storageRef: "",
      hasStorage: false,
      missing: false,
      loaded: false,
      mergeable: false,
    };
    expect(originLabel({ ...base, inNotebook: true, inWorkspace: true })).toBe(
      "notebook+workspace",
    );
    expect(originLabel({ ...base, inNotebook: true, inWorkspace: false })).toBe(
      "notebook",
    );
    expect(originLabel({ ...base, inNotebook: false, inWorkspace: true })).toBe(
      "workspace",
    );
    expect(
      originLabel({ ...base, inNotebook: false, inWorkspace: false }),
    ).toBe("session");
  });
});

describe("shouldRegisterPointer", () => {
  const A = "users/u/workspaces/w/datasets/a/data.csv";
  const B = "users/u/workspaces/w/datasets/b/data.csv";

  it("registers into an empty list", () => {
    expect(shouldRegisterPointer([], "a.csv", A)).toBe(true);
  });

  it("skips the same file at the same path", () => {
    expect(
      shouldRegisterPointer(
        [{ fileName: "a.csv", storagePath: A }],
        "a.csv",
        A,
      ),
    ).toBe(false);
  });

  it("registers a distinct file that shares a name", () => {
    expect(
      shouldRegisterPointer(
        [{ fileName: "a.csv", storagePath: A }],
        "a.csv",
        B,
      ),
    ).toBe(true);
  });

  it("skips when neither side has a path to distinguish by", () => {
    expect(shouldRegisterPointer([{ fileName: "a.csv" }], "a.csv", B)).toBe(
      false,
    );
    expect(
      shouldRegisterPointer(
        [{ fileName: "a.csv", storagePath: A }],
        "a.csv",
        "",
      ),
    ).toBe(false);
  });
});
