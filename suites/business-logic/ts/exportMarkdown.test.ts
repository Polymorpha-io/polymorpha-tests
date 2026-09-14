import { describe, it, expect } from "vitest";
import {
  extractProseSections,
  mdProseToPdfmake,
  mdInlineSpans,
  stripFrontmatter,
} from "@polymorpha/business-logic";

/**
 * [POLY-EXPORT] Studio-markdown → PDF bridge contract
 * (ts/src/exporters/markdown.ts). Laws:
 * - Only user prose is extracted (frontmatter, headings L1/L2, locked
 *   auto-tables excluded); preamble attaches to the first block, trailing
 *   text to the last.
 * - Every prose block converts to pdfmake nodes — headings, lists, GFM
 *   tables (APA layout), code, quotes, figure placeholders. Nothing is
 *   dropped silently.
 */

const DOC = `---
title: "dirty_10k"
author: "me"
---

## Executive Summary

My custom intro with **bold** text.

<!-- polymorpha:locked executive-summary -->
\`\`\`polymorpha:executive-summary
| Metric | Value |
| --- | --- |
| Rows | 100 |
\`\`\`
<!-- /polymorpha:locked -->

## Descriptive Statistics

Shape notes here.

<!-- polymorpha:locked descriptive -->
\`\`\`polymorpha:descriptive
| Column | Mean |
| --- | --- |
| age | 28.12 |
\`\`\`
<!-- /polymorpha:locked -->

Trailing conclusions here.
`;

describe("extractProseSections", () => {
  it("maps preceding prose to its locked block", () => {
    const prose = extractProseSections(DOC);
    expect(prose["executive-summary"]).toContain("My custom intro");
    expect(prose["descriptive"]).toContain("Shape notes");
  });

  it("drops frontmatter, L1/L2 headings, and locked tables", () => {
    const prose = extractProseSections(DOC);
    const all = JSON.stringify(prose);
    expect(all).not.toContain('author: "me"');
    expect(all).not.toContain("## Executive");
    expect(all).not.toContain("polymorpha:executive-summary");
    expect(Object.values(prose).every((v) => v.length > 0)).toBe(true);
  });

  it("attaches trailing text to the last block", () => {
    const prose = extractProseSections(DOC);
    expect(prose["descriptive"]).toContain("Trailing conclusions");
  });

  it("filters seed instructional placeholders", () => {
    const prose = extractProseSections(
      [
        "## Frequencies",
        "",
        "_Write here. Use Regenerate stats to fill auto tables._",
        "",
        "Real user note here.",
        "",
        "<!-- polymorpha:locked frequencies -->",
        "```polymorpha:frequencies",
        "| Value | Count |",
        "| --- | --- |",
        "| a | 1 |",
        "```",
        "<!-- /polymorpha:locked -->",
      ].join("\n"),
    );
    expect(prose["frequencies"]).toBe("Real user note here.");
  });

  it("strips frontmatter standalone", () => {
    expect(stripFrontmatter("---\na: b\n---\nbody")).toBe("body");
    expect(stripFrontmatter("no frontmatter")).toBe("no frontmatter");
  });
});

describe("mdProseToPdfmake", () => {
  it("converts headings, lists, tables, quotes, figures", () => {
    const nodes = mdProseToPdfmake(
      "### Caveat\n\n- a\n- b\n\n| H1 | H2 |\n| --- | --- |\n| x | 1 |\n\n> quoted\n\n![alt](polymorpha://k)",
    );
    const kinds = nodes.map((n) => {
      const r = n as {
        ul?: unknown;
        ol?: unknown;
        table?: unknown;
        style?: string;
      };
      if (r.ul || r.ol) return "list";
      if (r.table) return "table";
      return r.style ?? "?";
    });
    expect(kinds).toEqual(["subHeader", "list", "table", "body", "body"]);
    const table = nodes[2] as {
      table: { headerRows: number; body: unknown[][] };
      layout: unknown;
    };
    expect(table.table.headerRows).toBe(1);
    expect(table.layout).toBeTruthy();
  });

  it("renders code spans and fences verbatim", () => {
    const nodes = mdProseToPdfmake(
      "Use `mean()` here.\n\n```\nraw | pipe\n```",
    );
    const flat = JSON.stringify(nodes);
    expect(flat).toContain("Courier");
    expect(flat).toContain("raw | pipe");
  });
});

describe("mdInlineSpans", () => {
  it("passes plain text through untouched", () => {
    expect(mdInlineSpans("nothing fancy")).toBe("nothing fancy");
  });

  it("marks bold, italic, links, figures", () => {
    const spans = mdInlineSpans(
      "A **big** *deal* with [link](https://x.test) and ![pic](s.png)",
    ) as Array<{ text: string; bold?: boolean; italics?: boolean }>;
    expect(spans.some((s) => s.text === "big" && s.bold)).toBe(true);
    expect(spans.some((s) => s.text === "deal" && s.italics)).toBe(true);
    expect(spans.some((s) => s.text === "link")).toBe(true);
    expect(
      spans.some(
        (s) => typeof s.text === "string" && s.text.includes("[Figure:"),
      ),
    ).toBe(true);
  });
});
