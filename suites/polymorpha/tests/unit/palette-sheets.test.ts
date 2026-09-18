import { describe, it, expect } from "vitest";
import { CLEAN_CARDS } from "@/components/NotebookWorkbench/palettes/cleanCards";
import { ANALYSE_CARDS } from "@/components/NotebookWorkbench/palettes/analyseCards";
import { EXPORT_CARDS } from "@/components/NotebookWorkbench/palettes/exportCards";
import {
  defaultFieldValue,
  isFieldVisible,
} from "@/components/NotebookWorkbench/palettes/PaletteSheet";
import {
  datasetHeader,
  frameCode,
  frameSnippet,
} from "@/components/NotebookWorkbench/palettes/cardFields";
import type { PaletteSnippetCtx } from "@/components/NotebookWorkbench/palettes/PaletteSheet";

const CTX: PaletteSnippetCtx = {
  columns: ["age", "city"],
  numeric: ["age"],
  categorical: ["city"],
  fileBase: "test",
};

const EMPTY_CTX: PaletteSnippetCtx = {
  columns: [],
  numeric: [],
  categorical: [],
  fileBase: "test",
};

const SETS = {
  clean: CLEAN_CARDS,
  analyse: ANALYSE_CARDS,
  export: EXPORT_CARDS,
} as const;

/** Every right-lane functionality must paste its intended code: non-empty,
 *  no "undefined" leaks, and robust to empty datasets/blank values. */
describe.each(Object.entries(SETS))("%s palette cards", (_stage, cards) => {
  it("builds non-empty code with defaults and empty values", () => {
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(
        card.detail.trim().length,
        `${card.id} needs detail`,
      ).toBeGreaterThan(0);
      // Mirror the Sheet hook: sequential realistic defaults, then blanks.
      const defaults: Record<string, string> = {};
      for (const f of card.fields ?? []) {
        defaults[f.key] = defaultFieldValue(f, CTX, defaults);
      }
      // Conditionals must resolve both ways without crashing the Sheet.
      for (const f of card.fields ?? []) {
        expect(
          () => isFieldVisible(f, defaults),
          `${card.id}/${f.key}`,
        ).not.toThrow();
        expect(
          () => isFieldVisible(f, {}),
          `${card.id}/${f.key}`,
        ).not.toThrow();
      }
      for (const values of [defaults, {}]) {
        for (const ctx of [CTX, EMPTY_CTX]) {
          const out = card.build(values, ctx);
          expect(
            out.trim().length,
            `${card.id} must build code`,
          ).toBeGreaterThan(0);
          expect(out, `${card.id} must not leak undefined`).not.toContain(
            "undefined",
          );
        }
      }
    }
  });

  it("has unique ids", () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assigns every card to a lane section", () => {
    for (const card of cards) {
      expect(
        card.group?.trim().length,
        `${card.id} needs a group`,
      ).toBeGreaterThan(0);
    }
  });

  it("frames every card build to a multi-dataset kernel name", () => {
    const K = "df_ws_sales";
    const bareDf = /(^|[^A-Za-z0-9_.'"])df([^A-Za-z0-9_]|$)/;
    for (const card of cards) {
      const defaults: Record<string, string> = {};
      for (const f of card.fields ?? []) {
        defaults[f.key] = defaultFieldValue(f, CTX, defaults);
      }
      const plain = card.build(defaults, CTX);
      const framed = frameCode(plain, K);
      // Byte-identical for bare df (today's behavior preserved).
      expect(frameCode(plain, "df"), `${card.id} df passthrough`).toBe(plain);
      expect(framed, `${card.id} must not leak undefined`).not.toContain(
        "undefined",
      );
      if (bareDf.test(plain)) {
        expect(framed, `${card.id} must aim at the frame`).toContain(K);
      }
    }
  });
});

const FRAME_CTX: PaletteSnippetCtx = {
  ...CTX,
  fileBase: "modified_data",
  frame: {
    laneName: "modified_data",
    kernelName: "df_ws_modified_data",
    fileName: "modified_data.csv",
    rows: 4600,
    cols: 18,
  },
};

describe("dataset-adaptive preview header", () => {
  it("names file, shape and kernel of the chosen dataset", () => {
    const out = frameSnippet("df.head()", FRAME_CTX);
    const [head, ...rest] = out.split("\n");
    expect(head).toBe(
      "# Dataset: modified_data.csv (4,600 rows × 18 cols) → df_ws_modified_data",
    );
    // Body aims at the chosen frame; preview is what gets pasted.
    expect(rest.join("\n")).toContain("df_ws_modified_data.head()");
  });

  it("omits the shape when stats are unknown (never fabricates)", () => {
    const out = datasetHeader({
      ...CTX,
      frame: { laneName: "out", kernelName: "out" },
    });
    expect(out).toBe("# Dataset: test → out");
    expect(out).not.toContain("undefined");
  });

  it("falls back to bare df with no frame", () => {
    expect(frameSnippet("df.head()", CTX)).toBe(
      "# Dataset: test → df\ndf.head()",
    );
  });
});
