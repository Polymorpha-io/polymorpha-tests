import { describe, it, expect } from "vitest";
import { CLEAN_CARDS } from "@/components/NotebookWorkbench/palettes/cleanCards";
import { ANALYSE_CARDS } from "@/components/NotebookWorkbench/palettes/analyseCards";
import { EXPORT_CARDS } from "@/components/NotebookWorkbench/palettes/exportCards";
import type {
  PaletteCard,
  PaletteSnippetCtx,
} from "@/components/NotebookWorkbench/palettes/PaletteSheet";

/**
 * Guards the tTest-class bug (`# comment` eating a closing paren,
 * stray `\"` in emitted code): every generated snippet must be
 * bracket-balanced after stripping strings + comments. Full `ast.parse`
 * runs in CI-free audit scripts; this is the fast in-suite tripwire.
 */
function stripNoise(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  let triple = false;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (triple && src.startsWith(quote.repeat(3), i)) {
        quote = null;
        triple = false;
        i += 3;
        continue;
      }
      if (!triple && ch === quote) {
        quote = null;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "#" ) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src.startsWith('"""', i) || src.startsWith("'''", i)) {
      quote = ch;
      triple = true;
      i += 3;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      triple = false;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function checkBalance(code: string, id: string): void {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: Array<{ ch: string; line: number }> = [];
  const lines = code.split("\n");
  lines.forEach((line, li) => {
    for (const ch of line) {
      if (ch === "(" || ch === "[" || ch === "{") {
        stack.push({ ch, line: li + 1 });
      } else if (pairs[ch]) {
        const top = stack.pop();
        expect(
          top?.ch,
          `${id}: line ${li + 1} closes ${ch} but opened ${top?.ch ?? "nothing"} (opened line ${top?.line ?? "?"})`,
        ).toBe(pairs[ch]);
      }
    }
  });
  expect(
    stack,
    `${id}: unclosed ${stack.map((s) => `${s.ch}@${s.line}`).join(", ")}`,
  ).toEqual([]);
}

const CTX: PaletteSnippetCtx = {
  columns: ["age", "city", "price"],
  numeric: ["age", "price"],
  categorical: ["city"],
  fileBase: "test",
};

const EMPTY_CTX: PaletteSnippetCtx = {
  columns: [],
  numeric: [],
  categorical: [],
  fileBase: "test",
};

const SETS: Record<string, PaletteCard[]> = {
  analyse: ANALYSE_CARDS,
  clean: CLEAN_CARDS,
  export: EXPORT_CARDS,
};

describe.each(Object.entries(SETS))("%s snippet syntax", (_stage, cards) => {
  it("emits bracket-balanced Python (comments/strings excluded)", () => {
    for (const card of cards) {
      const defaults: Record<string, string> = {};
      for (const f of card.fields ?? []) {
        if (f.kind === "column") defaults[f.key] = CTX.columns[0];
        else if (f.kind === "columnValue") defaults[f.key] = "A";
        else if (f.kind === "select")
          defaults[f.key] = f.default ?? f.options?.[0] ?? "";
        else if (f.kind === "number")
          defaults[f.key] = f.default ?? String(f.min ?? 3);
        else defaults[f.key] = "";
      }
      for (const values of [defaults, {}]) {
        for (const ctx of [CTX, EMPTY_CTX]) {
          const out = card.build(values, ctx);
          checkBalance(stripNoise(out), `${card.id}`);
        }
      }
    }
  });
});
