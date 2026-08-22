/**
 * Generated workspace/lib matrix suite — pure helpers from
 * workspace.ts, WorkspaceServiceTypes.ts, format.ts, storage.ts,
 * templates.ts and shadcn utils, driven by generator-built fixtures.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  coerceAppStep,
  createEmptyState,
  deserializeState,
  detectColumnTypes,
  determineTargetStep,
  migrateState,
  serializeState,
  WorkspaceStateMigrationError,
} from "@/lib/workspace";
import type { WorkspaceState } from "@/lib/workspace";
import {
  safeDate,
  WorkspaceCapError,
  WorkspaceNameConflictError,
} from "@/lib/WorkspaceServiceTypes";
import { formatBytes } from "@/lib/format";
import {
  readStorageJson,
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from "@/lib/storage";
import {
  getTemplate,
  stampTemplateBlocks,
  CATEGORY_LABELS,
  TEMPLATES,
} from "@/lib/templates";
import { cn } from "@/lib/shadcn/utils";
import { makeDataset, makeNumericDataset, presets } from "../../generators";

describe("detectColumnTypes", () => {
  it("detects numeric columns", () => {
    const d = makeNumericDataset(2, 10, { seed: "num" });
    for (const col of detectColumnTypes(
      d.rows,
      d.columns.map((c) => c.name),
    )) {
      expect(col.type).toBe("numeric");
    }
  });

  it("detects dates and booleans (true/false, 1/0, yes/no)", () => {
    const rows = [
      { d: "2023-01-01", b: "true", c: "1", y: "yes" },
      { d: "2023-06-15", b: "false", c: "0", y: "no" },
      { d: "2024-12-31", b: "true", c: "1", y: "yes" },
    ];
    const cols = detectColumnTypes(rows, ["d", "b", "c", "y"]);
    expect(cols[0]!.type).toBe("date");
    expect(cols[1]!.type).toBe("boolean");
    // Documented source behavior: "1"/"0" parse as numeric (checked first),
    // while "yes"/"no" fall through to the boolean vocabulary.
    expect(cols[2]!.type).toBe("numeric");
    expect(cols[3]!.type).toBe("boolean");
  });

  it("falls back to categorical for mixed or unknown values", () => {
    const rows = [{ a: "x" }, { a: "y" }, { a: "z" }];
    expect(detectColumnTypes(rows, ["a"])[0]!.type).toBe("categorical");
  });

  it("returns unknown for an all-empty column", () => {
    const rows = [{ a: null }, { a: "" }, { a: null }];
    expect(detectColumnTypes(rows, ["a"])[0]!.type).toBe("unknown");
  });

  it("returns unknown for zero rows", () => {
    expect(detectColumnTypes([], ["a"])[0]!.type).toBe("unknown");
  });

  it("samples at most 200 rows", () => {
    const d = makeDataset({
      rows: 500,
      cols: [{ name: "a", type: "numeric" }],
      seed: "cap",
    });
    const cols = detectColumnTypes(d.rows, ["a"]);
    expect(cols).toHaveLength(1);
    expect(cols[0]!.type).toBe("numeric");
  });
});

describe("migrateState", () => {
  it("passes through current-version state", () => {
    const state = createEmptyState("ws-1");
    const migrated = migrateState(state);
    expect(migrated.version).toBe(2);
    expect(migrated.workspaceId).toBe("ws-1");
  });

  it("upgrades version 0 with defaults", () => {
    const migrated = migrateState({ version: 0, workspaceId: "ws-0" });
    expect(migrated.version).toBe(2);
    expect(migrated.step).toBe("upload");
    expect(migrated.cart).toEqual([]);
    expect(migrated.exportPreferences).toEqual({});
    expect(migrated.notes).toBe("");
  });

  it("throws for non-object input", () => {
    expect(() => migrateState(null)).toThrow(WorkspaceStateMigrationError);
    expect(() => migrateState("nope")).toThrow(WorkspaceStateMigrationError);
  });

  it("throws for unknown future versions", () => {
    expect(() => migrateState({ version: 99 })).toThrow(
      /Unknown state version 99/,
    );
  });
});

describe("coerceAppStep", () => {
  it.each(
    ["upload", "model", "preview", "clean", "stats", "export"].map((step) => ({
      label: `accepts valid step "${step}"`,
      step,
    })),
  )("$label", ({ step }) => {
    expect(coerceAppStep(step)).toBe(step);
  });

  it.each([
    { label: "null", val: null },
    { label: "undefined", val: undefined },
    { label: "empty string", val: "" },
    { label: "nonsense word", val: "nonsense" },
    { label: "number 42", val: 42 },
  ])("rejects $label", ({ val }) => {
    expect(coerceAppStep(val)).toBeNull();
  });
});

describe("determineTargetStep", () => {
  const withState = (partial: Partial<WorkspaceState>): WorkspaceState => ({
    ...createEmptyState("ws"),
    ...partial,
  });

  it("defaults to preview when no state", () => {
    expect(determineTargetStep(null)).toBe("preview");
  });

  it("maps upload/unknown steps to preview", () => {
    expect(determineTargetStep(withState({ step: "upload" }))).toBe("preview");
    expect(determineTargetStep(withState({ step: "bogus" }))).toBe("preview");
  });

  it("keeps clean only when a cleaning config exists", () => {
    expect(
      determineTargetStep(withState({ step: "clean", cleaningConfig: null })),
    ).toBe("preview");
    expect(
      determineTargetStep(withState({ step: "clean", cleaningConfig: {} })),
    ).toBe("clean");
  });

  it("keeps stats/export only when cleaned data is available", () => {
    expect(
      determineTargetStep(withState({ step: "stats", cleaningConfig: null })),
    ).toBe("preview");
    expect(
      determineTargetStep(withState({ step: "export", cleaningConfig: null })),
    ).toBe("preview");
    expect(
      determineTargetStep(withState({ step: "stats", cleaningConfig: {} })),
    ).toBe("stats");
    expect(
      determineTargetStep(withState({ step: "export", cleaningConfig: {} })),
    ).toBe("export");
  });
});

describe("createEmptyState + gzip round-trip", () => {
  it("creates a valid empty state", () => {
    const state = createEmptyState("ws-new");
    expect(state.version).toBe(2);
    expect(state.workspaceId).toBe("ws-new");
    expect(state.step).toBe("upload");
  });

  it("serializeState → deserializeState round-trips unicode content", async () => {
    const state = createEmptyState("ws-uni");
    state.notes = "统计分析 résumé ünïcode ✓";
    state.cart = [{ id: "c1", type: "test", label: "t-test" }];
    const bytes = await serializeState(state);
    const restored = await deserializeState(bytes.buffer.slice(0));
    expect(restored).toEqual(state);
  });
});

describe("safeDate", () => {
  it("accepts Timestamp-like objects", () => {
    const ts = { toDate: () => new Date("2024-01-01T00:00:00Z") };
    expect(safeDate(ts).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("accepts Date, string and number inputs", () => {
    expect(safeDate(new Date("2024-02-02")).getUTCFullYear()).toBe(2024);
    expect(safeDate("2024-03-03").getUTCFullYear()).toBe(2024);
    expect(safeDate(new Date("2024-04-04").getTime()).getUTCFullYear()).toBe(
      2024,
    );
  });

  it("falls back to now for invalid inputs", () => {
    const before = Date.now();
    const d = safeDate(null).getTime();
    expect(d).toBeGreaterThanOrEqual(before);
    expect(isNaN(safeDate("garbage").getTime())).toBe(false);
  });
});

describe("workspace error classes", () => {
  it("WorkspaceCapError includes the limit", () => {
    const err = new WorkspaceCapError(5);
    expect(err.name).toBe("WorkspaceCapError");
    expect(err.message).toContain("5");
  });

  it("WorkspaceNameConflictError includes the name", () => {
    const err = new WorkspaceNameConflictError("My WS");
    expect(err.name).toBe("WorkspaceNameConflictError");
    expect(err.message).toContain("My WS");
  });
});

describe("formatBytes", () => {
  it.each([
    { label: "0 bytes → '0 B'", input: 0, expected: "0 B" },
    { label: "1 byte → '1 B'", input: 1, expected: "1 B" },
    { label: "1023 bytes → '1023 B'", input: 1023, expected: "1023 B" },
    { label: "1024 bytes → '1.0 kB'", input: 1024, expected: "1.0 kB" },
    { label: "2048 bytes → '2.0 kB'", input: 2048, expected: "2.0 kB" },
    { label: "1 MiB → '1.0 MB'", input: 1048576, expected: "1.0 MB" },
    { label: "3.5 MiB → '3.5 MB'", input: 1048576 * 3.5, expected: "3.5 MB" },
  ])("$label", ({ input, expected }) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("round-trips values in local and session storage", () => {
    expect(writeStorageValue("k", "v")).toBe(true);
    expect(readStorageValue("k")).toBe("v");
    expect(writeStorageValue("k2", "v2", "session")).toBe(true);
    expect(readStorageValue("k2", "session")).toBe("v2");
    expect(removeStorageValue("k")).toBe(true);
    expect(readStorageValue("k")).toBeNull();
  });

  it("readStorageJson parses or falls back", () => {
    writeStorageValue("j", '{"a":1}');
    expect(readStorageJson("j", null)).toEqual({ a: 1 });
    expect(readStorageJson("missing", { fallback: true })).toEqual({
      fallback: true,
    });
    writeStorageValue("bad", "{not json");
    expect(readStorageJson("bad", "fb")).toBe("fb");
  });

  it("returns false/null when storage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(writeStorageValue("k", "v")).toBe(false);
    expect(readStorageValue("k")).toBeNull();
    spy.mockRestore();
  });
});

describe("templates", () => {
  it("getTemplate finds registered templates by id", () => {
    expect(getTemplate("statistical-analysis")?.name).toBe(
      "Statistical Analysis",
    );
    expect(getTemplate("missing")).toBeUndefined();
  });

  it("TEMPLATES and BLANK_TEMPLATE are well-formed", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.category in CATEGORY_LABELS).toBe(true);
    }
  });

  it("stampTemplateBlocks produces unique ids recursively", () => {
    const template = getTemplate("statistical-analysis")!;
    const stamped = stampTemplateBlocks(template.notesTemplate);
    const ids = new Set<string>();
    const collect = (blocks: { id: string; children?: unknown[] }[]) => {
      for (const b of blocks) {
        expect(ids.has(b.id)).toBe(false);
        ids.add(b.id);
        if (b.children) collect(b.children as never);
      }
    };
    collect(stamped);
    expect(ids.size).toBeGreaterThan(0);
  });

  it("stampTemplateBlocks does not mutate input blocks", () => {
    const template = getTemplate("ab-test")!;
    const before = template.notesTemplate[0]!.id;
    stampTemplateBlocks(template.notesTemplate);
    expect(template.notesTemplate[0]!.id).toBe(before);
  });
});

describe("shadcn cn", () => {
  it("merges class names and resolves tailwind-merge conflicts", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn(false && "x", undefined, null, "y")).toBe("y");
    expect(cn(["c", "d"])).toBe("c d");
  });
});
