import { describe, it, expect } from "vitest";
import {
  buildDatasetRows,
  shouldRegisterPointer,
} from "@/components/NotebookWorkbench/useNotebookDatasets";
import {
  judgeOperandKeys,
  originLabel,
} from "@/components/NotebookWorkbench/frames/datasetGroups";
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

describe("buildDatasetRows (variables vs files)", () => {
  it("keeps cards disjoint: a cell-used workspace file is one file row + provenance, never a twin", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("sales.csv", 690, 8),
      totalRowCount: 690,
    });
    const rows = buildDatasetRows({
      notebookIds: ["up1"],
      notebookTitles: { up1: "sales.csv" },
      workspaceDatasets: [
        wsMeta("up1", "sales.csv", 690, 8),
        wsMeta("up3", "churn.csv", 90, 3),
      ],
      sessionVars,
      combineExtras: [],
    });
    // Exactly one variable row (df) and two file rows — no dual membership.
    const variableRows = rows.filter((r) => r.kind === "variable");
    const fileRows = rows.filter((r) => r.kind === "file");
    expect(variableRows.map((r) => r.varName)).toEqual(["df"]);
    expect(fileRows.map((r) => r.fileName).sort()).toEqual([
      "churn.csv",
      "sales.csv",
    ]);
    // Provenance, not duplication: the file row knows the notebook used it.
    const sales = fileRows.find((r) => r.fileName === "sales.csv");
    expect(sales).toMatchObject({
      inNotebook: true,
      inWorkspace: true,
      loaded: false,
      varName: null,
    });
  });

  it("file rows: pointer schema marks them ready; failures carry loadFailed", () => {
    const rows = buildDatasetRows({
      notebookIds: [],
      workspaceDatasets: [
        wsMeta("up1", "attached.csv", 90, 3),
        wsMeta("up2", "failed.csv", 90, 3),
        wsMeta("up3", "pending.csv", 90, 3),
        { ...wsMeta("up9", "gone.csv"), hasStorage: false, missing: true },
      ],
      sessionVars: [],
      combineExtras: [
        {
          fileName: "attached.csv",
          rowCount: 90,
          columns: [{ name: "c0", type: "numeric", detectedType: "numeric" }],
          head: [],
        },
      ],
      failedUploadIds: ["up2"],
    });
    expect(rows.find((r) => r.fileName === "attached.csv")).toMatchObject({
      loaded: true,
      mergeable: true,
      rows: 90,
      cols: 1,
      loadFailed: false,
    });
    expect(rows.find((r) => r.fileName === "failed.csv")).toMatchObject({
      loaded: false,
      loadFailed: true,
    });
    expect(rows.find((r) => r.fileName === "pending.csv")).toMatchObject({
      loaded: false,
      loadFailed: false,
    });
    expect(rows.find((r) => r.fileName === "gone.csv")).toMatchObject({
      missing: true,
      loaded: false,
      mergeable: false,
      rows: 100,
    });
  });

  it("variable rows: kernel frames, artifacts, and schema'd imports", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("df.csv", 10, 2),
      totalRowCount: 10,
      combineExtras: [
        {
          fileName: "Training.csv",
          rowCount: 4920,
          columns: [
            { name: "c0", type: "numeric", detectedType: "numeric" },
            { name: "c1", type: "string", detectedType: "string" },
          ],
          head: [],
        },
        { fileName: "NoSchema.csv", rowCount: 5 },
      ],
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
        {
          name: "df_ghost",
          type: "DataFrame",
          detail: "restored",
          stage: "",
          frame: { rows: 10, cols: 2, columns: ["c0", "c1"], head: [] },
        },
      ],
      kernelVarsStale: true,
    });
    const rows = buildDatasetRows({
      notebookIds: [],
      workspaceDatasets: [],
      sessionVars,
      combineExtras: [],
    });
    const vars = rows.filter((r) => r.kind === "variable");
    // Live kernel frames + restored stale snapshot + schema'd import.
    const df2 = vars.find((r) => r.varName === "df2");
    expect(df2).toMatchObject({
      loaded: true,
      stale: true,
      mergeable: false,
      rows: 150,
    });
    expect(df2?.columns).toEqual(["c0", "c1", "c2", "c3"]);
    const training = vars.find((r) => r.fileName === "Training.csv");
    expect(training).toMatchObject({
      loaded: true,
      mergeable: true,
      rows: 4920,
    });
    expect(training?.columns).toEqual(["c0", "c1"]);
    // Schema-less pointer: never mergeable, counts stay measured.
    const noSchema = vars.find((r) => r.fileName === "NoSchema.csv");
    expect(noSchema).toMatchObject({
      loaded: false,
      mergeable: false,
      rows: 5,
    });
  });

  it("surfaces out/cleaned as variable rows (artifacts of cells)", () => {
    const sessionVars = buildVariables({
      ...EMPTY_SNAP,
      raw: dataset("df.csv", 10, 2),
      totalRowCount: 10,
      hasAppliedSteps: true,
      computedHead: dataset("df.csv", 8, 2),
      cleaned: dataset("df.csv", 7, 2),
    });
    const rows = buildDatasetRows({
      notebookIds: [],
      workspaceDatasets: [],
      sessionVars,
    });
    const vars = rows.filter((r) => r.kind === "variable");
    expect(vars.map((r) => r.varName)).toEqual(["df", "out", "cleaned"]);
    expect(vars.find((r) => r.varName === "out")).toMatchObject({
      loaded: true,
      mergeable: true,
      rows: 8,
    });
  });

  it("never fabricates counts for unknown datasets", () => {
    const rows = buildDatasetRows({
      notebookIds: ["ghost-id"],
      sessionVars: [],
      combineExtras: [],
    });
    const ghost = rows.find((r) => r.uploadId === "ghost-id");
    expect(ghost?.rows).toBeNull();
    expect(ghost?.cols).toBeNull();
    expect(ghost?.kind).toBe("file");
  });
});

describe("originLabel", () => {
  it("reports both/notebook/workspace/session provenance", () => {
    const base = {
      key: "k",
      kind: "file" as const,
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

describe("judgeOperandKeys", () => {
  const base = {
    how: "inner",
    rightPicked: true,
    keyChosen: true,
    leftKind: null,
    rightKind: null,
    dtypeCovered: false,
  };
  const ctx = (over: Partial<typeof base>) => ({
    ...base,
    ...over,
  });

  it("R0 cross: keys unused — quiet", () => {
    expect(
      judgeOperandKeys(
        ctx({ how: "cross", rightPicked: false, keyChosen: false }),
      ),
    ).toBeNull();
  });

  it("R1 no right operand: info", () => {
    const hint = judgeOperandKeys(
      ctx({ rightPicked: false, keyChosen: false }),
    );
    expect(hint?.level).toBe("info");
    expect(hint?.msg).toMatch(/Pick a right operand/);
  });

  it("R5 right picked, no key: warn", () => {
    const hint = judgeOperandKeys(ctx({ keyChosen: false }));
    expect(hint?.level).toBe("warn");
    expect(hint?.msg).toMatch(/Pick a key column/);
  });

  it("R3 key dtype mismatch: error (dormant while modals preflight-banner it)", () => {
    const hint = judgeOperandKeys(
      ctx({ leftKind: "numeric", rightKind: "text" }),
    );
    expect(hint?.level).toBe("error");
    expect(hint?.msg).toMatch(
      /Key type mismatch: left is numeric, right is text/,
    );
  });

  it("R3 skipped when the modal banners dtype itself", () => {
    expect(
      judgeOperandKeys(
        ctx({ leftKind: "numeric", rightKind: "text", dtypeCovered: true }),
      ),
    ).toBeNull();
  });

  it("quiet: compatible kinds, null/mixed kinds, no kinds", () => {
    expect(
      judgeOperandKeys(ctx({ leftKind: "numeric", rightKind: "numeric" })),
    ).toBeNull();
    expect(
      judgeOperandKeys(ctx({ leftKind: "null", rightKind: "numeric" })),
    ).toBeNull();
    expect(
      judgeOperandKeys(ctx({ leftKind: "mixed", rightKind: "text" })),
    ).toBeNull();
    expect(judgeOperandKeys(ctx())).toBeNull();
  });
});
