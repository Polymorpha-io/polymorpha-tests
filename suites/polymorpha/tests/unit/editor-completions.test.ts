import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCellSuggestions,
  ensureCellCompletions,
  resolveCellDocs,
  setCompletionContext,
  __resetCompletionSingletonForTests,
  type CellSuggestion,
  type ModelLike,
  type PositionLike,
} from "@/lib/editorCompletions";

const monacoStub = {
  languages: {
    CompletionItemKind: {
      Variable: 1,
      Field: 2,
      Method: 3,
      Property: 4,
      Snippet: 5,
      Value: 6,
      Text: 7,
    },
    CompletionItemInsertTextRule: { InsertAsSnippet: 1 },
    registerCompletionItemProvider: vi.fn(),
  },
} as unknown as Parameters<typeof ensureCellCompletions>[0];

/** Minimal single-line model: word regex mirrors Monaco's default word
 *  pattern; range reads are honored (clamped past EOL like Monaco) so
 *  prefix + ahead-peek tests exercise real spans. */
function stubModel(line: string, _column?: number): ModelLike {
  return {
    getWordUntilPosition: (pos: PositionLike) => {
      const before = line.slice(0, pos.column - 1);
      const m = /[A-Za-z_][A-Za-z0-9_]*$/.exec(before);
      const word = m ? m[0] : "";
      return {
        word,
        startColumn: pos.column - word.length,
        endColumn: pos.column,
      };
    },
    getValueInRange: (range) => {
      const start = Math.max(0, range.startColumn - 1);
      const end = Math.max(start, range.endColumn - 1);
      return line.slice(start, Math.min(end, line.length));
    },
  };
}

const at = (line: string, column?: number): PositionLike => ({
  lineNumber: 1,
  column: column ?? line.length + 1,
});

function labels(sugs: Array<{ label: string }>): string[] {
  return sugs.map((s) => s.label);
}

beforeEach(() => {
  setCompletionContext({ columns: [], kernelVars: [] });
  __resetCompletionSingletonForTests();
  vi.mocked(monacoStub.languages.registerCompletionItemProvider).mockClear();
});

describe("completion singleton", () => {
  it("registers once no matter how many editors mount", () => {
    ensureCellCompletions(monacoStub);
    ensureCellCompletions(monacoStub);
    ensureCellCompletions(monacoStub);
    expect(
      monacoStub.languages.registerCompletionItemProvider,
    ).toHaveBeenCalledTimes(1);
  });
});

describe("suggestion memo", () => {
  it("reuses the previous list for an unchanged cursor + context", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const model = stubModel("df[", 4);
    const pos = at("df[", 4);
    const first = buildCellSuggestions(monacoStub, model, pos);
    const second = buildCellSuggestions(monacoStub, model, pos);
    expect(second).toBe(first);
  });

  it("rebuilds after the context changes", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const model = stubModel("", 1);
    const pos = at("", 1);
    const first = buildCellSuggestions(monacoStub, model, pos);
    setCompletionContext({ columns: ["price", "city"], kernelVars: [] });
    const second = buildCellSuggestions(monacoStub, model, pos);
    expect(second).not.toBe(first);
    expect(second.map((s) => s.label)).toContain("city");
  });
});

describe("suggestion list", () => {
  it("never repeats a label (provider stacking + data dupes)", () => {
    setCompletionContext({
      columns: ["price", "price", "city", "city", "price"],
      kernelVars: [{ name: "df2", type: "DataFrame", detail: "", stage: "m" }],
    });
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel("df[", 4),
      at("df[", 4),
    );
    const seen = labels(sugs);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.filter((l) => l === "price")).toHaveLength(1);
  });

  it("orders df first, then columns, kernel vars, snippets", () => {
    setCompletionContext({
      columns: ["zebra"],
      kernelVars: [{ name: "mydf", type: "DataFrame", detail: "", stage: "m" }],
    });
    const sugs = buildCellSuggestions(monacoStub, stubModel("", 1), at("", 1));
    const order = labels(sugs);
    expect(order[0]).toBe("df");
    expect(order.indexOf("zebra")).toBeGreaterThan(0);
    expect(order.indexOf("mydf")).toBeGreaterThan(order.indexOf("zebra"));
    expect(order[order.length - 1]).toMatch(/^snippet: /);
  });

  it("keeps exact kernel names without rewording", () => {
    setCompletionContext({
      columns: [],
      kernelVars: [
        { name: "df2", type: "DataFrame", detail: "150 rows", stage: "m" },
        { name: "alpha", type: "float64", detail: "0.5", stage: "m" },
      ],
    });
    const sugs = buildCellSuggestions(monacoStub, stubModel("", 1), at("", 1));
    expect(labels(sugs)).toContain("df2");
    expect(labels(sugs)).toContain("alpha");
    // A kernel `df` must not duplicate the canonical `df`.
    const withDf = buildCellSuggestions(
      monacoStub,
      stubModel("", 1),
      at("", 1),
    );
    expect(withDf.filter((s) => s.label === "df")).toHaveLength(1);
  });

  it("quotes non-identifier columns so inserts always parse", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    const bare = buildCellSuggestions(
      monacoStub,
      stubModel("df[", 4),
      at("df[", 4),
    );
    const item = bare.find((s) => s.label === "my col");
    // After `df[` the quoted name completes to valid `df["my col"]`.
    expect(item?.insertText).toBe('"my col"');
    // Inside quotes the bare name is already correct.
    const quoted = buildCellSuggestions(
      monacoStub,
      stubModel('df["my ', 7),
      at('df["my ', 7),
    );
    expect(quoted.find((s) => s.label === "my col")?.insertText).toBe("my col");
  });

  it("switches to the pandas catalog after df-dot", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel("df.", 4),
      at("df.", 4),
    );
    const order = labels(sugs);
    expect(order).toContain("head");
    expect(order).toContain("groupby");
    expect(order).not.toContain("df");
    expect(order).not.toContain("price");
    const head = sugs.find((s) => s.label === "head");
    expect(head?.detail).toContain("head(");
  });

  it("ignores dots on unknown receivers", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel("foo.", 5),
      at("foo.", 5),
    );
    expect(labels(sugs)).toContain("df");
    expect(labels(sugs)).toContain("price");
  });

  it("caps wide frames with a visible notice", () => {
    setCompletionContext({
      columns: Array.from({ length: 250 }, (_, i) => `c${i}`),
      kernelVars: [],
    });
    const sugs = buildCellSuggestions(monacoStub, stubModel("", 1), at("", 1));
    expect(sugs.filter((s) => s.label === "c0")).toHaveLength(1);
    expect(sugs.some((s) => s.label.includes("more columns"))).toBe(true);
  });

  it("gives every item matchable filter text (monaco#3231)", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    const sugs = buildCellSuggestions(monacoStub, stubModel("", 1), at("", 1));
    for (const s of sugs) {
      expect(s.filterText.length).toBeGreaterThan(0);
      expect(s.sortText.length).toBeGreaterThan(0);
    }
  });
});

describe("provider wiring (triggers, incomplete, resolve)", () => {
  function registeredProvider() {
    ensureCellCompletions(monacoStub);
    const calls = vi.mocked(monacoStub.languages.registerCompletionItemProvider)
      .mock.calls;
    expect(calls).toHaveLength(1);
    return calls[0][1];
  }

  function provide(
    provider: ReturnType<typeof registeredProvider>,
    model: ModelLike,
    pos: PositionLike,
  ): { suggestions: CellSuggestion[]; incomplete?: boolean } {
    const fn = provider.provideCompletionItems as unknown as (
      model: ModelLike,
      position: PositionLike,
    ) => { suggestions: CellSuggestion[]; incomplete?: boolean };
    return fn(model, pos);
  }

  it("registers dot/bracket triggers with lazy resolve + incomplete lists", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const provider = registeredProvider();
    // Quotes re-arm mid-string and fight the prefix filter — out.
    expect(provider.triggerCharacters).toEqual([".", "["]);
    expect(typeof provider.resolveCompletionItem).toBe("function");
    const out = provide(provider, stubModel("df.", 4), at("df.", 4));
    // Context-dependent list: the client must re-query, not filter cached.
    expect(out.incomplete).toBe(true);
    expect(out.suggestions.map((s) => s.label)).toContain("head");
  });

  it("fails open with an empty list when the model throws", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const provider = registeredProvider();
    const broken = {
      getWordUntilPosition: () => {
        throw new Error("boom");
      },
      getValueInRange: () => {
        throw new Error("boom");
      },
    } as unknown as ModelLike;
    const out = provide(provider, broken, at("df.", 4));
    expect(out.suggestions).toEqual([]);
    expect(out.incomplete).toBe(true);
  });
});

describe("resolveCellDocs", () => {
  it("re-attaches column docs to bare items", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    expect(resolveCellDocs({ label: "price" }).documentation).toContain(
      "price",
    );
  });

  it("re-attaches catalog docs", () => {
    expect(resolveCellDocs({ label: "head" }).documentation).toContain(
      "First n rows",
    );
  });

  it("leaves unknown labels and existing docs alone", () => {
    const bare = { label: "nope-missing" };
    expect(resolveCellDocs(bare)).toBe(bare);
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const full = { label: "price", documentation: "custom" };
    expect(resolveCellDocs(full).documentation).toBe("custom");
  });
});

describe("context short-circuit", () => {
  it("keeps the memo when identical context is pushed again", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const model = stubModel("df[", 4);
    const pos = at("df[", 4);
    const first = buildCellSuggestions(monacoStub, model, pos);
    // Same content, fresh arrays (multi-cell mounts push identical data):
    // no version bump, memo survives.
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    expect(buildCellSuggestions(monacoStub, model, pos)).toBe(first);
  });
});

describe("string acceptance ranges", () => {
  it("spans the partial name and swallows the typed closing", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    const line = 'df["my col"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 8),
      at(line, 8),
    );
    const item = sugs.find((s) => s.label === "my col");
    // Covers `my col"]`: accept rewrites exactly the half-typed name and
    // parks the caret before the closing (`df["my col"|]`).
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 13 });
    expect(item?.insertText).toBe('my col$0"]');
    expect(item?.insertTextRules).toBe(1);
  });

  it("keeps the quoted insert without a closing ahead", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel("df[", 4),
      at("df[", 4),
    );
    expect(sugs.find((s) => s.label === "my col")?.insertText).toBe('"my col"');
  });

  it("extends over trailing identifier text", () => {
    setCompletionContext({ columns: ["price"], kernelVars: [] });
    const line = 'df["pri"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 7),
      at(line, 7),
    );
    const item = sugs.find((s) => s.label === "price");
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 10 });
    expect(item?.insertText).toBe('price$0"]');
  });

  it("spans hyphenated headers", () => {
    setCompletionContext({ columns: ["my-col"], kernelVars: [] });
    const line = 'df["my-col"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 8),
      at(line, 8),
    );
    const item = sugs.find((s) => s.label === "my-col");
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 13 });
    expect(item?.insertText).toBe('my-col$0"]');
    expect(item?.insertTextRules).toBe(1);
  });

  it("spans dotted headers", () => {
    setCompletionContext({ columns: ["sales.2024"], kernelVars: [] });
    const line = 'df["sales.2024"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 15),
      at(line, 15),
    );
    const item = sugs.find((s) => s.label === "sales.2024");
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 17 });
    expect(item?.insertText).toBe('sales.2024$0"]');
  });

  it("spans a mid-name cursor before a space", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    const line = 'df["my col"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 7),
      at(line, 7),
    );
    const item = sugs.find((s) => s.label === "my col");
    // Without the forward space scan the range would end at the cursor
    // and accept would duplicate (`my my col col`).
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 13 });
    expect(item?.insertText).toBe('my col$0"]');
  });

  it("spans a long header past the old 16-char lookahead", () => {
    const header = "very_long_column_name_for_revenue";
    setCompletionContext({ columns: [header], kernelVars: [] });
    // Cursor mid-name with the full `"]` closing far ahead.
    const line = `df["${header}"]`;
    const col = 5 + 10;
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, col),
      at(line, col),
    );
    const item = sugs.find((s) => s.label === header);
    expect(item?.range).toMatchObject({
      startColumn: 5,
      endColumn: line.length + 1,
    });
    expect(item?.insertText).toBe(`${header}$0"]`);
  });

  it("escapes snippet syntax in headers when a closing is typed", () => {
    setCompletionContext({ columns: ["$price"], kernelVars: [] });
    const line = 'df["$price"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 8),
      at(line, 8),
    );
    const item = sugs.find((s) => s.label === "$price");
    expect(item?.insertText).toBe('\\$price$0"]');
    expect(item?.insertTextRules).toBe(1);
  });

  it("spans special-char headers backward from a mid-name cursor", () => {
    setCompletionContext({ columns: ["$price"], kernelVars: [] });
    // Cursor after `$pr`: without `$` in the scan class the range would
    // cover only `pr` and accept would duplicate the `$`.
    const line = 'df["$pr"]';
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 8),
      at(line, 8),
    );
    const item = sugs.find((s) => s.label === "$price");
    expect(item?.range).toMatchObject({ startColumn: 5, endColumn: 10 });
    expect(item?.insertText).toBe('\\$price$0"]');
  });

  it("quotes non-identifiers when only a bracket is typed ahead", () => {
    setCompletionContext({ columns: ["my col"], kernelVars: [] });
    // `df[|]`: the closing `]` is pre-typed but the name needs quotes —
    // completing bare would produce invalid `df[my col]`.
    const line = "df[]";
    const sugs = buildCellSuggestions(
      monacoStub,
      stubModel(line, 4),
      at(line, 4),
    );
    const item = sugs.find((s) => s.label === "my col");
    expect(item?.insertText).toBe('"my col"$0]');
  });
});
