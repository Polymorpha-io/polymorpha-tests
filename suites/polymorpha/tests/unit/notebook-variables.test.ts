import { describe, it, expect, beforeEach } from "vitest";
import {
  buildVariables,
  clearNotebookKernelVars,
  loadNotebookKernelVars,
  sanitizeVarName,
  saveNotebookKernelVars,
} from "@/components/NotebookWorkbench/variables";
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

describe("sanitizeVarName", () => {
  it("strips extensions and non-identifier chars", () => {
    expect(sanitizeVarName("sales-2024.csv")).toBe("sales_2024");
    expect(sanitizeVarName("test1.csv")).toBe("test1");
    expect(sanitizeVarName("9lives.xlsx")).toBe("_9lives");
  });
});

describe("buildVariables", () => {
  it("registers df first, then imports, out, cleaned", () => {
    const vars = buildVariables({
      raw: dataset("df.csv", 690, 14),
      combineExtras: [
        { fileName: "test1.csv", rowCount: 120 },
        { fileName: "test3.csv", rowCount: 5000 },
      ],
      computedHead: dataset("df.csv", 512, 14),
      hasAppliedSteps: true,
      cleaned: dataset("df.csv", 498, 13),
      totalRowCount: 690,
      kernelVars: [],
    });
    expect(vars.map((v) => v.name)).toEqual([
      "df",
      "test1",
      "test3",
      "out",
      "cleaned",
    ]);
    expect(vars.every((v) => v.kind === "DataFrame")).toBe(true);
    expect(vars[1]).toMatchObject({ rows: 120, cols: null, live: false });
    expect(vars[3]).toMatchObject({ rows: 512, cols: 14, live: true });
  });

  it("dedupes colliding stems and skips the upload base", () => {
    const vars = buildVariables({
      raw: dataset("test1.csv", 10, 2),
      combineExtras: [
        { fileName: "test1.csv", rowCount: 10 },
        { fileName: "test1 (1).csv", rowCount: 5 },
      ],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 10,
      kernelVars: [],
    });
    expect(vars.map((v) => v.name)).toEqual(["df", "test1_1_"]);
  });

  it("keeps the live peek on reserved-name collision (out.csv import)", () => {
    const head = dataset("df.csv", 512, 14);
    const vars = buildVariables({
      raw: dataset("df.csv", 690, 14),
      combineExtras: [{ fileName: "out.csv", rowCount: 3 }],
      computedHead: head,
      hasAppliedSteps: true,
      cleaned: null,
      totalRowCount: 690,
      kernelVars: [],
    });
    expect(vars.map((v) => v.name)).toEqual(["df", "out", "out_2"]);
    const modelVar = vars.find((v) => v.source === "model");
    // The peek follows the dataset reference, not the hardcoded name.
    expect(modelVar?.liveDataset).toBe(head);
  });
});

describe("buildVariables kernel variables", () => {
  const irisFrame = {
    name: "df2",
    type: "DataFrame",
    detail: "150 rows × 4 cols",
    stage: "model",
    frame: {
      rows: 150,
      cols: 4,
      columns: ["sepal_length", "sepal_width", "petal_length", "petal_width"],
      head: [
        {
          sepal_length: 5.1,
          sepal_width: 3.5,
          petal_length: 1.4,
          petal_width: 0.2,
        },
      ],
    },
  };

  it("lists kernel DataFrames under exact names, drops scalars", () => {
    const vars = buildVariables({
      raw: dataset("df.csv", 10, 2),
      combineExtras: [],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 10,
      kernelVars: [
        irisFrame,
        { name: "alpha", type: "float64", detail: "0.45", stage: "model" },
      ],
    });
    expect(vars.map((v) => v.name)).toEqual(["df", "df2"]);
    const frame = vars.find((v) => v.name === "df2");
    expect(frame).toMatchObject({
      kind: "DataFrame",
      source: "kernel",
      rows: 150,
      cols: 4,
      live: true,
      stage: "model",
    });
    expect(frame?.liveDataset?.columns.map((c) => c.name)).toEqual([
      "sepal_length",
      "sepal_width",
      "petal_length",
      "petal_width",
    ]);
    expect(frame?.liveDataset?.rows).toHaveLength(1);
    // Scalars never enter the DataFrame-only lane.
    expect(vars.find((v) => v.name === "alpha")).toBeUndefined();
    expect(vars.every((v) => v.kind === "DataFrame")).toBe(true);
  });

  it("prefers the kernel entry on name collision (fresher truth)", () => {
    const vars = buildVariables({
      raw: dataset("df.csv", 10, 2),
      combineExtras: [],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 10,
      kernelVars: [
        {
          name: "df",
          type: "DataFrame",
          detail: "8 rows × 2 cols",
          stage: "clean",
          frame: {
            rows: 8,
            cols: 2,
            columns: ["c0", "c1"],
            head: [{ c0: 1, c1: 2 }],
          },
        },
      ],
    });
    expect(vars.map((v) => v.name)).toEqual(["df"]);
    expect(vars[0]).toMatchObject({ source: "kernel", rows: 8 });
  });

  it("skips nameless entries without dropping the registry", () => {
    const vars = buildVariables({
      raw: dataset("df.csv", 10, 2),
      combineExtras: [],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 10,
      kernelVars: [{ name: "", type: "int", detail: "1", stage: "x" }],
    });
    expect(vars.map((v) => v.name)).toEqual(["df"]);
  });

  it("marks kernel rows stale only when the snapshot is stale", () => {
    const snap = {
      raw: dataset("df.csv", 10, 2),
      combineExtras: [],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 10,
    };
    const fresh = buildVariables({ ...snap, kernelVars: [irisFrame] });
    expect(fresh.find((v) => v.name === "df2")?.stale).toBe(false);
    const stale = buildVariables({
      ...snap,
      kernelVars: [irisFrame],
      kernelVarsStale: true,
    });
    expect(stale.find((v) => v.name === "df2")?.stale).toBe(true);
  });
});

describe("kernel snapshot persistence", () => {
  const entry = {
    name: "df2",
    type: "DataFrame",
    detail: "150 rows × 4 cols",
    stage: "model",
    frame: {
      rows: 150,
      cols: 4,
      columns: ["sepal_length", "sepal_width", "petal_length", "petal_width"],
      head: [{ sepal_length: 5.1, sepal_width: 3.5 }],
    },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips save/load and scopes by workspace + notebook", () => {
    saveNotebookKernelVars("ws1", "nb-a", [entry]);
    expect(loadNotebookKernelVars("ws1", "nb-a")).toEqual([entry]);
    // Different notebook: no leakage.
    expect(loadNotebookKernelVars("ws1", "nb-b")).toBeNull();
    // Same notebook, other workspace: no leakage.
    expect(loadNotebookKernelVars("ws2", "nb-a")).toBeNull();
  });

  it("deletes the snapshot on clear (restart rotates the namespace)", () => {
    saveNotebookKernelVars("ws1", "nb-a", [entry]);
    clearNotebookKernelVars("ws1", "nb-a");
    expect(loadNotebookKernelVars("ws1", "nb-a")).toBeNull();
  });

  it("never throws on corrupt input; returns null for empty", () => {
    localStorage.setItem("polymorpha.nb.kernelvars.v2::ws1::nb-a", "{oops");
    expect(loadNotebookKernelVars("ws1", "nb-a")).toBeNull();
    localStorage.setItem("polymorpha.nb.kernelvars.v2::ws1::nb-a", "[]");
    expect(loadNotebookKernelVars("ws1", "nb-a")).toBeNull();
    localStorage.setItem(
      "polymorpha.nb.kernelvars.v2::ws1::nb-a",
      JSON.stringify([{ name: 42 }, null, entry]),
    );
    expect(loadNotebookKernelVars("ws1", "nb-a")).toEqual([entry]);
  });

  it("caps the snapshot at 50 entries and trims oversized fields", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      name: `v${i}`,
      type: "int",
      detail: "d".repeat(500),
      stage: "",
    }));
    saveNotebookKernelVars("ws1", "nb-a", many);
    const loaded = loadNotebookKernelVars("ws1", "nb-a");
    expect(loaded).toHaveLength(50);
    expect(loaded?.[0].detail).toHaveLength(120);
  });
});
