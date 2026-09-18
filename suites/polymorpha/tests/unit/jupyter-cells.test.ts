import { describe, it, expect } from "vitest";
import {
  applyMarkdownFormat,
  attachedDatasetSource,
  attachUploadedDataset,
  buildExecuteDatasetRef,
  cellsToIpynb,
  cellsToPython,
  detectBoundMethod,
  diffLines,
  duplicateJupyterCell,
  extractFirstCodeBlock,
  fixMatchesCell,
  hasCodeFence,
  loadNotebookDataset,
  mergeJupyterCells,
  migrateStepsToCells,
  isEchoChange,
  newJupyterCell,
  notebookCellsKeyV2,
  notebookDatasetKeyV2,
  notebookSeqKeyV2,
  notebookWorkspaceOf,
  parseErrorHints,
  purgeLegacyNotebookCache,
  sanitizeScopeSegment,
  saveNotebookDataset,
  sessionIdForDataset,
  sessionIdForNotebook,
  splitJupyterCell,
  splitStderrHintLines,
  staleDatasetOf,
  truncateCellOutput,
  unifyStagedCells,
} from "@/lib/jupyterCell";
import type { DataOperationStep } from "@/types";

function sortStep(): DataOperationStep {
  return {
    id: "step_1",
    description: "Sort age",
    config: { type: "sort", by: ["age"], ascending: true },
  } as unknown as DataOperationStep;
}

function codeNoteStep(): DataOperationStep {
  return {
    id: "step_2",
    description: "Code print",
    config: {
      type: "note",
      cellKind: "code",
      code: "print(df.shape)",
      stdout: "100 rows",
    },
    mutating: false,
  } as unknown as DataOperationStep;
}

describe("jupyter cells", () => {
  it("creates blank unrunnable-count cells (null until first Run)", () => {
    const cell = newJupyterCell("print(1)");
    expect(cell.executionCount).toBeNull();
    expect(cell.status).toBe("idle");
    expect(cell.stdout).toBeNull();
  });

  it("migrates an empty log to a single attached-dataset cell", () => {
    const cells = migrateStepsToCells([], "sales.csv");
    expect(cells).toHaveLength(1);
    expect(cells[0].source).toContain("sales.csv");
    // Runnable in the kernel: no bare local read_csv that can only 404.
    expect(cells[0].source).not.toMatch(/^df = pd\.read_csv/m);
    expect(cells[0].source).toContain("df.head()");
  });

  it("sizes the attached cell when stats are known", () => {
    const source = attachedDatasetSource("sales.csv", { rows: 100, cols: 5 });
    expect(source).toContain("100 rows");
    expect(source).toContain("df.head()");
    // Stdout-only backend: default cell must print (bare expr stays silent).
    expect(source).toContain("print(df.head()");
  });

  it("builds the execute manifest ref verbatim", () => {
    const ref = buildExecuteDatasetRef({
      uploadId: "u1",
      fileName: "sales.csv",
      storagePath: "users/x/sales.csv",
      downloadUrl: "https://example/sales.csv",
      workspaceId: "w1",
      workspaceName: "Shop",
    });
    expect(ref).toEqual({
      uploadId: "u1",
      fileName: "sales.csv",
      storagePath: "users/x/sales.csv",
      downloadUrl: "https://example/sales.csv",
      workspaceId: "w1",
      workspaceName: "Shop",
    });
  });

  it("migrates mutating steps to code and code notes verbatim", () => {
    const cells = migrateStepsToCells([sortStep(), codeNoteStep()], "df.csv");
    expect(cells).toHaveLength(3);
    expect(cells[1].source).toContain("sort");
    expect(cells[2].source).toBe("print(df.shape)");
    expect(cells[2].stdout).toBe("100 rows");
  });

  it("serializes cells to runnable python and nbformat 4.5", () => {
    const cells = migrateStepsToCells([sortStep()], "df.csv");
    const py = cellsToPython(cells, "df.csv");
    expect(py).toContain("sort");
    const ipynb = JSON.parse(
      cellsToIpynb(cells, "df.csv", {
        fileName: "df.csv",
        exportedAt: "2026-09-14T00:00:00Z",
        rowCount: 2,
        packages: {},
        packagesUnknown: true,
      }),
    );
    expect(ipynb.nbformat).toBe(4);
    expect(ipynb.cells[1].cell_type).toBe("code");
    expect(ipynb.cells[1].execution_count).toBeNull();
  });

  it("caps cell output, passes short text through, never fabricates", () => {
    expect(truncateCellOutput(null)).toBeNull();
    expect(truncateCellOutput("   ")).toBeNull();
    expect(truncateCellOutput("hello\n")).toBe("hello\n");
    const capped = truncateCellOutput("x".repeat(9_000));
    expect(capped).toContain("truncated");
  });

  it("unifies per-stage cell lists in stage order, deduped by source", () => {
    const key = (s: string) => `polymorpha.nb.cells.v1::${s}::u.csv::k`;
    const mk = (source: string) => ({ ...newJupyterCell(source), source });
    localStorage.setItem(
      key("clean"),
      JSON.stringify([mk("print(2)"), mk("print(1)")]),
    );
    localStorage.setItem(key("model"), JSON.stringify([mk("print(1)")]));
    localStorage.setItem(key("stats"), JSON.stringify([]));
    try {
      const cells = unifyStagedCells("u.csv", "k");
      // model first, then clean's novel cell; duplicate print(1) dropped.
      expect(cells.map((c) => c.source)).toEqual(["print(1)", "print(2)"]);
      // Old stage keys are preserved for rollback.
      expect(localStorage.getItem(key("model"))).not.toBeNull();
      expect(localStorage.getItem(key("clean"))).not.toBeNull();
    } finally {
      localStorage.removeItem(key("model"));
      localStorage.removeItem(key("clean"));
      localStorage.removeItem(key("stats"));
    }
  });

  it("unifies to empty when no stage keys exist", () => {
    expect(unifyStagedCells("nothing.csv", "k")).toEqual([]);
  });

  it("keeps one session per dataset content, restartable via salt", () => {
    expect(sessionIdForDataset("a.csv")).toBe(sessionIdForDataset("a.csv"));
    expect(sessionIdForDataset("a.csv")).not.toBe(sessionIdForDataset("b.csv"));
    expect(sessionIdForDataset("a.csv")).not.toBe(
      sessionIdForDataset("a.csv", "restarted"),
    );
    // Same file name, different content → different namespaces (review #3).
    expect(sessionIdForDataset("a.csv", "", "hash1")).not.toBe(
      sessionIdForDataset("a.csv", "", "hash2"),
    );
    expect(sessionIdForDataset("a.csv", "", "hash1")).toBe(
      sessionIdForDataset("a.csv", "", "hash1"),
    );
  });

  it("scopes notebook keys by workspace, never by file", () => {
    expect(notebookCellsKeyV2("ws1", "main")).toBe(
      "polymorpha.nb.cells.v2::ws1::main",
    );
    expect(notebookSeqKeyV2("ws1", "main")).toBe(
      "polymorpha.nb.cells.seq.v2::ws1::main",
    );
    // Same file in two workspaces → different keys (the reported leak).
    expect(notebookCellsKeyV2("wsA", "main")).not.toBe(
      notebookCellsKeyV2("wsB", "main"),
    );
    // Two notebooks in one workspace → different keys.
    expect(notebookCellsKeyV2("ws1", "a")).not.toBe(
      notebookCellsKeyV2("ws1", "b"),
    );
    // Null workspace falls back to the ephemeral guest scope.
    expect(notebookWorkspaceOf(null)).toBe("guest");
    expect(notebookCellsKeyV2(null, null)).toBe(
      "polymorpha.nb.cells.v2::guest::main",
    );
    // Scope segments never smuggle the `::` separator into keys.
    expect(sanitizeScopeSegment("a::b", "main")).not.toContain("::");
  });

  it("scopes dataset pointers by workspace+notebook and round-trips", () => {
    expect(notebookDatasetKeyV2("ws1", "nb-a")).toBe(
      "polymorpha.nb.dataset.v2::ws1::nb-a",
    );
    expect(notebookDatasetKeyV2("ws1", "nb-a")).not.toBe(
      notebookDatasetKeyV2("ws1", "nb-b"),
    );
    expect(notebookDatasetKeyV2(null, null)).toBe(
      "polymorpha.nb.dataset.v2::guest::main",
    );
    const ptr = {
      uploadId: "up1",
      fileName: "sales.csv",
      storagePath: "users/u1/sales.csv",
    };
    saveNotebookDataset("ws1", "nb-a", ptr);
    expect(loadNotebookDataset("ws1", "nb-a")).toEqual(ptr);
    // Other notebooks are unaffected.
    expect(loadNotebookDataset("ws1", "nb-b")).toBeNull();
  });

  it("flags only executed code cells whose outputs came from another dataset", () => {
    const base = {
      id: "c1",
      cell_type: "code" as const,
      executionCount: 3,
      ranFileName: "old.csv",
    };
    expect(staleDatasetOf(base, "df.csv")).toBe("old.csv");
    // Same dataset, unknown, or pure-Python provenance never flags.
    expect(staleDatasetOf(base, "old.csv")).toBeNull();
    expect(
      staleDatasetOf({ ...base, ranFileName: undefined }, "df.csv"),
    ).toBeNull();
    expect(staleDatasetOf({ ...base, ranFileName: "" }, "df.csv")).toBeNull();
    // Markdown and never-ran cells never flag.
    expect(
      staleDatasetOf({ ...base, cell_type: "markdown" }, "df.csv"),
    ).toBeNull();
    expect(
      staleDatasetOf({ ...base, executionCount: null }, "df.csv"),
    ).toBeNull();
  });

  it("treats corrupt or empty dataset pointers as absent (global fallback)", () => {
    localStorage.setItem("polymorpha.nb.dataset.v2::ws1::nb-a", "{not json");
    expect(loadNotebookDataset("ws1", "nb-a")).toBeNull();
    localStorage.setItem(
      "polymorpha.nb.dataset.v2::ws1::nb-a",
      JSON.stringify({ uploadId: "up1", storagePath: "users/u1/x.csv" }),
    );
    expect(loadNotebookDataset("ws1", "nb-a")).toBeNull();
    localStorage.setItem(
      "polymorpha.nb.dataset.v2::ws1::nb-a",
      JSON.stringify({ uploadId: "", fileName: "", storagePath: "" }),
    );
    expect(loadNotebookDataset("ws1", "nb-a")).toBeNull();
    expect(loadNotebookDataset("ws1", "never-saved")).toBeNull();
  });

  it("purges legacy file-scoped keys once and keeps workspace keys", () => {
    localStorage.setItem("polymorpha.nb.cells.v1::a.csv::h", "[1]");
    localStorage.setItem("polymorpha.nb.cells.v1::model::a.csv::h", "[2]");
    localStorage.setItem("polymorpha.nb.cells.seq.v1::a.csv::h", "3");
    localStorage.setItem("polymorpha.nb.cells.v2::ws1::main", "[4]");
    expect(purgeLegacyNotebookCache()).toBe(3);
    expect(localStorage.getItem("polymorpha.nb.cells.v1::a.csv::h")).toBeNull();
    expect(
      localStorage.getItem("polymorpha.nb.cells.v1::model::a.csv::h"),
    ).toBeNull();
    expect(
      localStorage.getItem("polymorpha.nb.cells.seq.v1::a.csv::h"),
    ).toBeNull();
    expect(localStorage.getItem("polymorpha.nb.cells.v2::ws1::main")).toBe(
      "[4]",
    );
    // Second call is a marker-guarded no-op.
    localStorage.setItem("polymorpha.nb.cells.v1::b.csv::h", "[5]");
    expect(purgeLegacyNotebookCache()).toBe(0);
    expect(localStorage.getItem("polymorpha.nb.cells.v1::b.csv::h")).toBe(
      "[5]",
    );
    localStorage.clear();
  });

  it("detects editor echo (mount/model resync re-emitting current source)", () => {
    expect(isEchoChange("print(1)", "print(1)")).toBe(true);
    expect(isEchoChange("print(1)", "print(2)")).toBe(false);
    // A blank-model echo against real code is still an echo (absorb it —
    // callers compare live source, so this never fires for genuine edits).
    expect(isEchoChange("print(1)", "")).toBe(false);
  });

  it("keeps one kernel session per workspace notebook", () => {
    expect(sessionIdForNotebook("ws1", "main")).toBe(
      sessionIdForNotebook("ws1", "main"),
    );
    // Byte-identical datasets in two workspaces → different namespaces.
    expect(sessionIdForNotebook("wsA", "main")).not.toBe(
      sessionIdForNotebook("wsB", "main"),
    );
    expect(sessionIdForNotebook("ws1", "a")).not.toBe(
      sessionIdForNotebook("ws1", "b"),
    );
    expect(sessionIdForNotebook("ws1", "main", "restarted")).not.toBe(
      sessionIdForNotebook("ws1", "main"),
    );
  });

  it("defaults new cells to code with null duration", () => {
    const cell = newJupyterCell("print(1)");
    expect(cell.cell_type).toBe("code");
    expect(cell.durationMs).toBeNull();
    expect(newJupyterCell("# Notes", "markdown").cell_type).toBe("markdown");
  });

  it("migrates note summaries to markdown cells", () => {
    const cells = migrateStepsToCells(
      [
        {
          id: "step_9",
          description: "Findings",
          config: {
            type: "note",
            summary: "Prices skew high.",
          },
        } as unknown as DataOperationStep,
      ],
      "df.csv",
    );
    expect(cells).toHaveLength(2);
    expect(cells[1].cell_type).toBe("markdown");
    expect(cells[1].source).toContain("Prices skew high.");
  });

  it("exports markdown cells as markdown (ipynb) and jupytext (.py)", () => {
    const cells = [
      newJupyterCell("print(1)"),
      newJupyterCell("# Title", "markdown"),
    ];
    const ipynb = JSON.parse(
      cellsToIpynb(cells, "df.csv", {
        fileName: "df.csv",
        exportedAt: "2026-09-14T00:00:00Z",
        rowCount: 2,
        packages: {},
        packagesUnknown: true,
      }),
    );
    expect(ipynb.cells[2].cell_type).toBe("markdown");
    expect(ipynb.cells[2].source.join("")).toContain("# Title");
    expect(ipynb.cells[1].cell_type).toBe("code");
    const py = cellsToPython(cells, "df.csv");
    expect(py).toContain("# %% [markdown]");
    expect(py).toContain("print(1)");
  });
});

describe("attachUploadedDataset", () => {
  const base = {
    fileName: "modified_data.csv",
    storagePath: "users/u1/modified_data.csv",
    uploadId: "up1",
    workspaceId: "ws1",
    resolveUrl: async (p: string) => `https://signed.example/${p}`,
  };

  it("builds a single-dataset manifest so the kernel preloads df", async () => {
    const out = await attachUploadedDataset(base);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.datasets).toHaveLength(1);
    expect(out.datasets[0]).toMatchObject({
      fileName: "modified_data.csv",
      storagePath: "users/u1/modified_data.csv",
      downloadUrl: "https://signed.example/users/u1/modified_data.csv",
      uploadId: "up1",
      workspaceId: "ws1",
      workspaceName: "ws1",
    });
  });

  it("passes an empty manifest with no dataset loaded (pure-Python runs)", async () => {
    const out = await attachUploadedDataset({ ...base, fileName: "" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.datasets).toEqual([]);
  });

  it("fails inline with no storage copy", async () => {
    const out = await attachUploadedDataset({ ...base, storagePath: null });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toContain("no storage copy");
    expect(out.error).toContain("modified_data.csv");
  });

  it("fails inline when URL signing fails", async () => {
    const out = await attachUploadedDataset({
      ...base,
      resolveUrl: async () => {
        throw new Error("permission-denied");
      },
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toContain("Could not attach dataset");
    expect(out.error).toContain("permission-denied");
  });
});

describe("splitStderrHintLines", () => {
  it("splits backend hint lines from the traceback head", () => {
    const { head, hints } = splitStderrHintLines(
      "KeyError: 'species'\nAvailable columns: a, Species\nDid you mean: Species?",
    );
    expect(head).toBe("KeyError: 'species'");
    expect(hints).toEqual([
      "Available columns: a, Species",
      "Did you mean: Species?",
    ]);
  });

  it("returns text untouched when there are no hint lines", () => {
    const stderr = 'Traceback (most recent call last):\n  File "<string>"';
    expect(splitStderrHintLines(stderr)).toEqual({ head: stderr, hints: [] });
  });

  it("handles hint-only output with an empty head", () => {
    const { head, hints } = splitStderrHintLines("Did you mean: df2?");
    expect(head).toBe("");
    expect(hints).toEqual(["Did you mean: df2?"]);
  });
});

describe("mergeJupyterCells", () => {
  it("joins code sources top-down and resets to an unrun cell", () => {
    const a = {
      ...newJupyterCell("x = 1"),
      stdout: "old",
      executionCount: 3,
      status: "ok" as const,
    };
    const b = newJupyterCell("print(x)");
    const merged = mergeJupyterCells(a, b, "code");
    expect(merged.source).toBe("x = 1\nprint(x)");
    expect(merged.cell_type).toBe("code");
    expect(merged.executionCount).toBeNull();
    expect(merged.status).toBe("idle");
    expect(merged.stdout).toBeNull();
    expect(merged.dirty).toBe(true);
    expect(merged.id).not.toBe(a.id);
    expect(merged.id).not.toBe(b.id);
  });

  it("joins markdown with a blank line", () => {
    const merged = mergeJupyterCells(
      newJupyterCell("# Title", "markdown"),
      newJupyterCell("Body text.", "markdown"),
      "markdown",
    );
    expect(merged.source).toBe("# Title\n\nBody text.");
    expect(merged.dirty).toBe(false);
  });

  it("keeps the focused type on mixed merges", () => {
    const code = newJupyterCell("x = 1");
    const md = newJupyterCell("# Note", "markdown");
    expect(mergeJupyterCells(code, md, "markdown").cell_type).toBe("markdown");
    expect(mergeJupyterCells(code, md, "code").cell_type).toBe("code");
    expect(mergeJupyterCells(code, md, "code").source).toBe("x = 1\n# Note");
  });

  it("skips empty sides instead of padding blank lines", () => {
    const merged = mergeJupyterCells(
      newJupyterCell(""),
      newJupyterCell("print(1)"),
      "code",
    );
    expect(merged.source).toBe("print(1)");
  });
});

describe("splitJupyterCell", () => {
  it("splits at the offset with the head keeping its id", () => {
    const cell = newJupyterCell("line1\nline2");
    const parts = splitJupyterCell(cell, 5);
    expect(parts).not.toBeNull();
    const [head, tail] = parts!;
    expect(head.source).toBe("line1");
    expect(tail.source).toBe("\nline2");
    expect(head.id).toBe(cell.id);
    expect(tail.id).not.toBe(cell.id);
    expect(head.executionCount).toBeNull();
    expect(tail.executionCount).toBeNull();
  });

  it("marks a clean executed head dirty (its outputs were cleared)", () => {
    const cell = {
      ...newJupyterCell("x = 1"),
      executionCount: 2,
      status: "ok" as const,
      stdout: "1",
      dirty: false,
    };
    const [head] = splitJupyterCell(cell, 5)!;
    expect(head.stdout).toBeNull();
    expect(head.dirty).toBe(true);
  });

  it("returns null for empty sources and clamps wild offsets", () => {
    expect(splitJupyterCell(newJupyterCell(""), 3)).toBeNull();
    expect(splitJupyterCell(newJupyterCell("   "), 3)).toBeNull();
    const [headNeg] = splitJupyterCell(newJupyterCell("ab"), -99)!;
    expect(headNeg.source).toBe("");
    const [, tailHuge] = splitJupyterCell(newJupyterCell("ab"), 999)!;
    expect(tailHuge.source).toBe("");
  });
});

describe("duplicateJupyterCell", () => {
  it("copies source and type with a fresh unrun identity", () => {
    const cell = {
      ...newJupyterCell("print(1)"),
      executionCount: 4,
      status: "ok" as const,
      stdout: "1",
    };
    const copy = duplicateJupyterCell(cell);
    expect(copy.source).toBe("print(1)");
    expect(copy.cell_type).toBe("code");
    expect(copy.id).not.toBe(cell.id);
    expect(copy.executionCount).toBeNull();
    expect(copy.stdout).toBeNull();
    expect(copy.status).toBe("idle");
  });
});

describe("applyMarkdownFormat", () => {
  it("bolds a selection and toggles back off", () => {
    const once = applyMarkdownFormat("hello world", 6, 11, "bold");
    expect(once.text).toBe("hello **world**");
    expect([once.selStart, once.selEnd]).toEqual([8, 13]);
    const twice = applyMarkdownFormat(once.text, 6, 15, "bold");
    expect(twice.text).toBe("hello world");
  });

  it("selects placeholders for quick replacement on empty selections", () => {
    const bold = applyMarkdownFormat("hi", 2, 2, "bold");
    expect(bold.text).toBe("hi**bold**");
    // The placeholder is selected (link's `url` convention), not collapsed.
    expect(bold.text.slice(bold.selStart, bold.selEnd)).toBe("bold");
    const link = applyMarkdownFormat("", 0, 0, "link");
    expect(link.text).toBe("[text](url)");
    // The `url` part is selected for quick replacement.
    expect(link.text.slice(link.selStart, link.selEnd)).toBe("url");
  });

  it("wraps bold with italic instead of eating a star", () => {
    const wrapped = applyMarkdownFormat("**bold**", 0, 8, "italic");
    expect(wrapped.text).toBe("***bold***");
    expect(wrapped.text.slice(wrapped.selStart, wrapped.selEnd)).toBe(
      "**bold**",
    );
    // Longer star runs keep the generic toggle (strips exactly one star).
    const toggled = applyMarkdownFormat("***bold***", 0, 10, "italic");
    expect(toggled.text).toBe("**bold**");
    const plain = applyMarkdownFormat("*italic*", 0, 8, "italic");
    expect(plain.text).toBe("italic");
  });

  it("fences multi-line code and inlines single-line", () => {
    const fenced = applyMarkdownFormat("a\nb", 0, 3, "code");
    expect(fenced.text).toBe("```\na\nb\n```");
    const inline = applyMarkdownFormat("x", 0, 1, "code");
    expect(inline.text).toBe("`x`");
  });

  it("toggles lists and quotes per line, skipping blanks", () => {
    const listed = applyMarkdownFormat("a\n\nb", 0, 4, "list");
    expect(listed.text).toBe("- a\n\n- b");
    const unlisted = applyMarkdownFormat(listed.text, 0, 9, "list");
    expect(unlisted.text).toBe("a\n\nb");
    const quoted = applyMarkdownFormat("a\nb", 0, 3, "quote");
    expect(quoted.text).toBe("> a\n> b");
  });

  it("starts a list or quote on a wholly blank range", () => {
    const list = applyMarkdownFormat("", 0, 0, "list");
    expect(list.text).toBe("- ");
    expect([list.selStart, list.selEnd]).toEqual([2, 2]);
    const quote = applyMarkdownFormat("a\n\n", 2, 3, "quote");
    expect(quote.text).toBe("a\n> \n");
  });

  it("inserts, strips, and swaps headings", () => {
    const h1 = applyMarkdownFormat("Title", 0, 5, "h1");
    expect(h1.text).toBe("# Title");
    const stripped = applyMarkdownFormat(h1.text, 0, 7, "h1");
    expect(stripped.text).toBe("Title");
    const swapped = applyMarkdownFormat(h1.text, 0, 7, "h2");
    expect(swapped.text).toBe("## Title");
  });
});

describe("parseErrorHints", () => {
  it("parses the KeyError shape with columns and suggestions", () => {
    const parsed = parseErrorHints(
      "KeyError: 'Salary'\nAvailable columns: price, bedrooms, sqft_lot\nDid you mean: price?",
    );
    expect(parsed).toEqual({
      missing: "Salary",
      kind: "key",
      title: "KeyError: 'Salary'",
      columns: ["price", "bedrooms", "sqft_lot"],
      variables: [],
      suggestions: ["price"],
    });
  });

  it("parses the NameError shape and strips the (+N more) suffix", () => {
    const parsed = parseErrorHints(
      "NameError: name 'df_sales' is not defined\nAvailable variables: df, df2 (+1 more)\n",
    );
    expect(parsed?.missing).toBe("df_sales");
    expect(parsed?.kind).toBe("name");
    expect(parsed?.variables).toEqual(["df", "df2"]);
  });

  it("prefers the error line over traceback noise for the title", () => {
    const parsed = parseErrorHints(
      "Traceback (most recent call last):\n  File \"<string>\", line 1\nKeyError: 'Salary'\nAvailable columns: price",
    );
    expect(parsed?.title).toBe("KeyError: 'Salary'");
    expect(parsed?.missing).toBe("Salary");
  });

  it("returns null when nothing is parseable", () => {
    expect(parseErrorHints("TypeError: unhashable type\n")).toBeNull();
    expect(parseErrorHints("")).toBeNull();
  });
});

describe("detectBoundMethod", () => {
  it("flags print(df.info) and bare df.head", () => {
    expect(detectBoundMethod("print(df.info)")).toEqual({
      dotted: "df.info",
      call: "df.info()",
    });
    expect(detectBoundMethod("df.head")).toEqual({
      dotted: "df.head",
      call: "df.head()",
    });
  });

  it("ignores real calls, plain attributes, and comments", () => {
    expect(detectBoundMethod("print(df.info())")).toBeNull();
    expect(detectBoundMethod("print(df.shape)")).toBeNull();
    expect(detectBoundMethod("x = df.columns")).toBeNull();
    expect(detectBoundMethod("# use df.info here")).toBeNull();
  });
});

describe("extractFirstCodeBlock", () => {
  it("extracts a python fence", () => {
    expect(
      extractFirstCodeBlock(
        "Fixed:\n```python\nprint(df.head())\ndf.info()\n```\nWrapped head.",
      ),
    ).toBe("print(df.head())\ndf.info()");
  });

  it("extracts a plain fence and returns null without one", () => {
    expect(extractFirstCodeBlock("```\nprint(1)\n```")).toBe("print(1)");
    expect(extractFirstCodeBlock("just prose, no code")).toBeNull();
    expect(extractFirstCodeBlock("```python\n   \n```")).toBeNull();
  });

  it("matches language tags case-insensitively", () => {
    expect(extractFirstCodeBlock("```Python\nprint(x)\n```")).toBe("print(x)");
    expect(extractFirstCodeBlock("```PY\nprint(x)\n```")).toBe("print(x)");
    expect(hasCodeFence("```Python\nprint(x)\n```")).toBe(true);
    // Non-python tags stay out by design: a ```text traceback must never
    // reach a cell, even though its lines look non-empty.
    expect(
      extractFirstCodeBlock(
        '```text\nTraceback (most recent call last):\n  File "<stdin>", line 1\n```',
      ),
    ).toBeNull();
  });

  it("tolerates a reply cut off before the closing fence", () => {
    expect(
      extractFirstCodeBlock("Fixed:\n```python\nprint(df.head())\ndf.info()"),
    ).toBe("print(df.head())\ndf.info()");
    expect(extractFirstCodeBlock("Fixed:\n```python\n   ")).toBeNull();
  });

  it("rejects a fence with no executable code (prose must never reach a cell)", () => {
    // Exact screenshot repro: summary-only fence.
    expect(
      extractFirstCodeBlock(
        "```python\nChanged: Wrapped df.head() output in print() and called df.info() directly.\n```",
      ),
    ).toBeNull();
    expect(
      extractFirstCodeBlock("```python\n# just a comment\n# another\n```"),
    ).toBeNull();
    // Degenerate backend output: the literal word `undefined` is no-code.
    expect(extractFirstCodeBlock("```python\nundefined\n```")).toBeNull();
    expect(
      extractFirstCodeBlock(
        "```python\nundefined\n```\nChanged: replaced invalid print.",
      ),
    ).toBeNull();
    // Empty fence (model put the fix in the Changed: prose instead).
    expect(extractFirstCodeBlock("```python\n```")).toBeNull();
    expect(extractFirstCodeBlock("```python\n   \n```")).toBeNull();
  });

  it("detects fenced blocks even when unusable (retry signal)", () => {
    expect(hasCodeFence("```python\nprint(x)\n```")).toBe(true);
    expect(hasCodeFence("```python\n```")).toBe(true);
    expect(hasCodeFence("```\nanything\n```")).toBe(true);
    // Single-line fences count (retry trigger, never a direct write).
    expect(hasCodeFence("```python print(x) ```")).toBe(true);
    expect(hasCodeFence("no fence here, just prose")).toBe(false);
    expect(hasCodeFence("inline `code` only")).toBe(false);
    expect(hasCodeFence("")).toBe(false);
  });

  it("extracts a whole-message single-line fence (compact replies)", () => {
    expect(extractFirstCodeBlock("```python print(x) ```")).toBe("print(x)");
    expect(extractFirstCodeBlock("```print(y)```")).toBe("print(y)");
    // Inline mentions inside prose must NOT extract (retry path instead).
    expect(
      extractFirstCodeBlock("Try ```python print(x)``` instead of that."),
    ).toBeNull();
    // Single-line Changed-only and undefined fences still reject.
    expect(extractFirstCodeBlock("```python Changed: fixed it ```")).toBeNull();
    expect(extractFirstCodeBlock("```python undefined ```")).toBeNull();
  });

  it("strips Changed: lines but keeps real code verbatim", () => {
    expect(
      extractFirstCodeBlock(
        "```python\nprint(df.head().to_string())\ndf.info()\nChanged: wrapped head, called info bare.\n```",
      ),
    ).toBe("print(df.head().to_string())\ndf.info()");
    expect(
      extractFirstCodeBlock(
        "```python\n# show the head\nprint(df.head())\n```",
      ),
    ).toBe("# show the head\nprint(df.head())");
  });
});

describe("fixMatchesCell", () => {
  it("accepts fixes sharing identifiers (glue names count)", () => {
    expect(fixMatchesCell("print(df.head())\ndf.info()", "df.head()")).toBe(
      true,
    );
    expect(fixMatchesCell("print(price)", "print(Salary)")).toBe(true);
    expect(fixMatchesCell("print()", "print")).toBe(true);
  });

  it("rejects hallucinated fixes with zero overlap (screenshot repro)", () => {
    // Bare `print` cell "fixed" with prompt-parroted `df.info()`.
    expect(fixMatchesCell("df.info()", "print")).toBe(false);
    expect(fixMatchesCell("import os", "print")).toBe(false);
  });

  it("is case-sensitive and lenient on identifier-free sources", () => {
    expect(fixMatchesCell("DF.info()", "print")).toBe(false);
    expect(fixMatchesCell("x = 1", "1/0")).toBe(true);
    expect(fixMatchesCell("", "")).toBe(true);
  });
});

describe("diffLines", () => {
  it("marks changed lines as del/add around shared context", () => {
    // GNU-diff grouping: removals before additions within a hunk.
    expect(
      diffLines("df.head()\nprint(df.info)", "print(df.head())\ndf.info()"),
    ).toEqual([
      { type: "del", text: "df.head()" },
      { type: "del", text: "print(df.info)" },
      { type: "add", text: "print(df.head())" },
      { type: "add", text: "df.info()" },
    ]);
    expect(diffLines("a\nx\nb", "a\ny\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "x" },
      { type: "add", text: "y" },
      { type: "same", text: "b" },
    ]);
  });

  it("handles identical, empty, and append-only sources", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
    expect(diffLines("", "")).toEqual([{ type: "same", text: "" }]);
    expect(diffLines("a", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
    ]);
  });
});
