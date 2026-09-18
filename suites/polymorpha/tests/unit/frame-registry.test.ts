import { describe, it, expect } from "vitest";
import {
  F,
  frameCode,
} from "@/components/NotebookWorkbench/palettes/cardFields";
import {
  wsSlug,
  fileSlug,
  varName,
  dedupedVarNames,
  resolveKernelName,
  buildFrameOptions,
  type SessionFrameInfo,
} from "@/components/NotebookWorkbench/frames/frameRegistry";
import type { DatasetVariable } from "@/components/NotebookWorkbench/variables";

/** Backend parity pins — docstring examples from execute.py. */
describe("slug parity with the backend", () => {
  it("slugs workspace names like _ws_slug", () => {
    expect(wsSlug("Marketing Analysis")).toBe("marketing_analysis");
  });
  it("slugs file names like _file_slug", () => {
    expect(fileSlug("sales.csv")).toBe("sales");
  });
  it("builds var names like _var_name", () => {
    expect(varName("marketing", "sales")).toBe("df_marketing_sales");
  });
  it("does not collapse repeats (backend has no + quantifier)", () => {
    expect(wsSlug("a  b")).toBe("a__b");
  });
  it("prefixes leading digits and lowercases", () => {
    expect(wsSlug("2024 Sales")).toBe("t_2024_sales");
  });
  it("dedups like _dedup_slugs (workspace suffix on full repeat)", () => {
    expect(
      dedupedVarNames([
        { workspaceName: "Marketing Analysis", fileName: "sales.csv" },
        { workspaceName: "Marketing Analysis", fileName: "sales.csv" },
      ]),
    ).toEqual(["df_marketing_analysis_sales", "df_marketing_analysis_2_sales"]);
  });
  it("dedups the workspace slug when the same file repeats (backend behavior)", () => {
    // Backend _dedup_slugs bumps the workspace counter first, so a repeated
    // file lands under ws_2 — the file-suffix branch only fires on an exact
    // ws_final+fs repeat. Pin the real behavior, not the assumed one.
    expect(
      dedupedVarNames([
        { workspaceName: "ws", fileName: "sales.csv" },
        { workspaceName: "ws", fileName: "Sales.csv" },
      ]),
    ).toEqual(["df_ws_sales", "df_ws_2_sales"]);
  });
});

function liveVar(name: string, fileName: string): DatasetVariable {
  return {
    name,
    kind: "DataFrame",
    rows: 2,
    cols: 2,
    source: "upload",
    fileName,
    live: true,
    liveDataset: {
      fileName,
      uploadedAt: new Date(0),
      columns: [
        { name: "age", type: "numeric", detectedType: "numeric" },
        { name: "city", type: "categorical", detectedType: "categorical" },
      ],
      rows: [
        { age: 1, city: "a" },
        { age: 2, city: "b" },
      ],
    },
    format: "csv",
  };
}

describe("frameCode", () => {
  const K = "df_ws_sales";
  it("is byte-identical for bare df", () => {
    const code = 'print(df.shape)\ndf["a"].head()';
    expect(frameCode(code, "df")).toBe(code);
  });
  it("rewrites bare df tokens", () => {
    expect(frameCode("print(df.shape)", K)).toBe("print(df_ws_sales.shape)");
    expect(frameCode('df["a"].head()\ndf.head()', K)).toBe(
      'df_ws_sales["a"].head()\ndf_ws_sales.head()',
    );
  });
  it("leaves longer identifiers and attributes alone", () => {
    expect(frameCode("df2.head()\ndfx = 1\nx.df", K)).toBe(
      "df2.head()\ndfx = 1\nx.df",
    );
  });
  it("skips comments but rewrites code on the same line set", () => {
    expect(frameCode("# use df here\ndf.head()", K)).toBe(
      "# use df here\ndf_ws_sales.head()",
    );
  });
  it("skips plain string literals", () => {
    expect(frameCode('name = "df"\ndf.head()', K)).toBe(
      'name = "df"\ndf_ws_sales.head()',
    );
  });
  it("rewrites inside f-string interpolations, not literal parts", () => {
    expect(frameCode('print(f"Rows: {len(df):,} of df")', K)).toBe(
      'print(f"Rows: {len(df_ws_sales):,} of df")',
    );
  });
  it("ignores invalid kernel names (never emits garbage identifiers)", () => {
    const code = "df.head()";
    expect(frameCode(code, "")).toBe(code);
    expect(frameCode(code, "df-1")).toBe(code);
  });
  it("F(ctx) defaults to df without a frame", () => {
    expect(
      F({ columns: [], numeric: [], categorical: [], fileBase: "t" }),
    ).toBe("df");
    expect(
      F({
        columns: [],
        numeric: [],
        categorical: [],
        fileBase: "t",
        frame: { laneName: "out", kernelName: K },
      }),
    ).toBe(K);
  });
});

describe("resolveKernelName", () => {
  const opt = {
    laneName: "df",
    kind: "live" as const,
    fileName: "sales.csv",
    source: "upload" as const,
  };
  it("emits bare df for single-attached sessions", () => {
    const session: SessionFrameInfo = {
      attached: [{ workspaceName: "ws", fileName: "sales.csv" }],
      kernelNames: [],
    };
    expect(resolveKernelName(opt, session)).toBe("df");
  });
  it("emits the mirrored df_ws_file for multi-attached sessions", () => {
    const session: SessionFrameInfo = {
      attached: [
        { workspaceName: "ws", fileName: "sales.csv" },
        { workspaceName: "ws", fileName: "costs.csv" },
      ],
      kernelNames: [],
    };
    const mirrored = new Map([["sales.csv", "df_ws_sales"]]);
    expect(resolveKernelName(opt, session, mirrored)).toBe("df_ws_sales");
  });
  it("trusts kernel truth over a drifted mirror", () => {
    const session: SessionFrameInfo = {
      attached: [
        { workspaceName: "ws", fileName: "sales.csv" },
        { workspaceName: "ws", fileName: "costs.csv" },
      ],
      kernelNames: ["df_ws_sales_2"],
    };
    const mirrored = new Map([["sales.csv", "df_ws_sales"]]);
    expect(resolveKernelName(opt, session, mirrored)).toBe("df_ws_sales_2");
  });
  it("kernel-head options keep their exact kernel name", () => {
    const session: SessionFrameInfo = { attached: [], kernelNames: [] };
    expect(
      resolveKernelName(
        { ...opt, laneName: "df2", kind: "kernel-head" },
        session,
      ),
    ).toBe("df2");
  });
});

describe("buildFrameOptions", () => {
  const session: SessionFrameInfo = {
    attached: [{ workspaceName: "ws", fileName: "sales.csv" }],
    kernelNames: [],
  };
  it("builds a live option with real columns", () => {
    const [opt] = buildFrameOptions([liveVar("df", "sales.csv")], session);
    expect(opt.kernelName).toBe("df");
    expect(opt.kind).toBe("live");
    expect(opt.columns.map((c) => c.name)).toEqual(["age", "city"]);
    expect(opt.disabledReason).toBeUndefined();
  });
  it("disables pointer-only entries instead of fabricating columns", () => {
    const pointer: DatasetVariable = {
      ...liveVar("sales_2023", "sales-2023.csv"),
      live: false,
      liveDataset: null,
      cols: null,
      source: "import",
    };
    const [opt] = buildFrameOptions([pointer], session);
    expect(opt.kind).toBe("pointer");
    expect(opt.disabledReason).toMatch(/Load first/);
    expect(opt.columns).toEqual([]);
  });
  it("disables restored (stale) kernel frames until a Run re-measures", () => {
    const stale: DatasetVariable = {
      ...liveVar("df2", "df2"),
      source: "kernel",
      stale: true,
    };
    const [opt] = buildFrameOptions([stale], session);
    expect(opt.kind).toBe("pointer");
    expect(opt.disabledReason).toMatch(/Restored snapshot/);
    expect(opt.columns).toEqual([]);
  });
  it("skips non-DataFrame entries", () => {
    const scalar: DatasetVariable = {
      ...liveVar("n", "sales.csv"),
      kind: "scalar",
    };
    expect(buildFrameOptions([scalar], session)).toEqual([]);
  });
});
