import { describe, it, expect } from "vitest";
import {
  buildMergeSnippet,
  mergeNotebookDatasets,
  shouldRegisterPointer,
  varNameForFile,
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

describe("varNameForFile", () => {
  it("sanitizes stems and dedupes against taken names", () => {
    const taken = new Set(["df"]);
    expect(varNameForFile("sales-2024.csv", taken)).toBe("sales_2024");
    expect(varNameForFile("sales-2024.csv", taken)).toBe("sales_2024_2");
  });
});

describe("buildMergeSnippet", () => {
  it("returns empty for fewer than two frames", () => {
    expect(buildMergeSnippet([])).toBe("");
    expect(
      buildMergeSnippet([
        { varName: "df", fileName: "a.csv", needsLoad: false },
      ]),
    ).toBe("");
  });

  it("merges two live frames on the shared column", () => {
    const code = buildMergeSnippet(
      [
        { varName: "df", fileName: "sales.csv", needsLoad: false },
        { varName: "df2", fileName: "churn.csv", needsLoad: false },
      ],
      { df: ["id", "amount"], df2: ["id", "churned"] },
    );
    expect(code).toContain('pd.merge(df, df2, how="inner", on="id")');
    expect(code).toContain("print(merged.head().to_string())");
    expect(code).toContain("print(merged.shape)");
    expect(code).not.toContain("read_csv");
  });

  it("binds workspace files via read_csv and marks unknown keys TODO", () => {
    const code = buildMergeSnippet([
      { varName: "df", fileName: "sales.csv", needsLoad: false },
      { varName: "churn", fileName: "churn.csv", needsLoad: true },
    ]);
    expect(code).toContain('churn = pd.read_csv("churn.csv")');
    expect(code).toContain("TODO: replace with the join key");
  });

  it("chains three frames", () => {
    const code = buildMergeSnippet(
      [
        { varName: "a", fileName: "a.csv", needsLoad: false },
        { varName: "b", fileName: "b.csv", needsLoad: false },
        { varName: "c", fileName: "c.csv", needsLoad: false },
      ],
      { a: ["id"], b: ["id"], c: ["id"] },
    );
    expect(code).toContain("pd.merge(a, b,");
    expect(code).toContain("pd.merge(merged, c,");
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
