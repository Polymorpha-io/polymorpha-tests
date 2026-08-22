/**
 * htmlPreviewUtils — pdfmake → HTML rendering helpers for HtmlPreview.
 */
import type { ReactElement } from "react";
import React from "react";

type PdfNode = unknown;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function hasProp(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function getBarLineClass(
  kind: "header" | "footer",
  side: "left" | "right",
  idx: number,
  line: string,
): string {
  const upperLine = line.trim().toUpperCase();
  if (upperLine.startsWith("POLYMORPHA")) {
    return "ep-html-bar-line--kicker";
  }
  if (kind === "header" && side === "left") {
    return idx === 0
      ? "ep-html-bar-line--headline"
      : "ep-html-bar-line--secondary";
  }
  if (kind === "header" && side === "right") {
    return idx === 0
      ? "ep-html-bar-line--page ep-html-bar-line--page-dark"
      : idx === 1
        ? "ep-html-bar-line--primary"
        : "ep-html-bar-line--muted";
  }
  if (kind === "footer" && side === "left") {
    return idx === 1
      ? "ep-html-bar-line--primary"
      : "ep-html-bar-line--secondary";
  }
  return idx === 0 ? "ep-html-bar-line--page" : "ep-html-bar-line--muted";
}

export function findBarColumns(node: PdfNode): unknown[] | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBarColumns(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(node)) return null;
  if (Array.isArray(node.columns)) return node.columns as unknown[];
  if (Array.isArray(node.stack)) return findBarColumns(node.stack);
  return null;
}

export function parseBarColumns(cols: unknown[]): {
  left: string[];
  right: string[];
} {
  const left: string[] = [];
  const right: string[] = [];
  for (const col of cols) {
    const rec = isRecord(col) ? col : null;
    if (rec && rec.width === "*" && !rec.text && !rec.stack) continue;
    const lines = extractBarLines(col);
    if (!lines.length) continue;
    if (
      rec?.alignment === "right" ||
      (rec !== null &&
        Array.isArray(rec.stack) &&
        (rec.stack as unknown[]).every(
          (item: unknown) => isRecord(item) && item.alignment === "right",
        ))
    ) {
      right.push(...lines);
    } else {
      left.push(...lines);
    }
  }
  return { left, right };
}

export function extractBarLines(node: PdfNode): string[] {
  if (node == null) return [];
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"
  ) {
    const text = String(node).trim();
    return text ? [text] : [];
  }
  if (Array.isArray(node)) {
    const text = (node as unknown[])
      .map((item: unknown) =>
        flattenPdfText(item, 0, new WeakSet<object>()).trim(),
      )
      .filter(Boolean)
      .join(" ")
      .trim();
    return text ? [text] : [];
  }
  if (isRecord(node)) {
    if (Array.isArray(node.stack)) {
      return (node.stack as unknown[]).flatMap((item: unknown) =>
        extractBarLines(item),
      );
    }
    if (hasProp(node, "text")) {
      const text = flattenPdfText(node.text, 0, new WeakSet<object>()).trim();
      return text ? [text] : [];
    }
  }
  return [];
}

/** Convert pdfmake margin [left, top, right, bottom] to React inline style */
export function getMarginStyle(
  margin: unknown,
): React.CSSProperties | undefined {
  if (!margin) return undefined;
  if (Array.isArray(margin)) {
    const arr = margin as unknown[];
    if (arr.length === 4) {
      const [left, top, right, bottom] = arr as [
        unknown,
        unknown,
        unknown,
        unknown,
      ];
      if (left === 0 && top === 0 && right === 0 && bottom === 0)
        return undefined;
      return {
        marginLeft: left as number,
        marginTop: top as number,
        marginRight: right as number,
        marginBottom: bottom as number,
      };
    }
    if (arr.length === 2) {
      const [h, v] = arr as [unknown, unknown];
      if (h === 0 && v === 0) return undefined;
      return {
        marginLeft: h as number,
        marginTop: v as number,
        marginRight: h as number,
        marginBottom: v as number,
      };
    }
  }
  if (typeof margin === "number" && margin !== 0) {
    return { margin };
  }
  return undefined;
}

export function renderPdfText(
  text: PdfNode,
  depth: number,
  seen: WeakSet<object>,
): React.ReactNode {
  if (text == null) return "";
  if (depth > 24) return "";
  if (typeof text === "string" || typeof text === "number") return String(text);

  if (typeof text === "object" && text !== null) {
    if (seen.has(text)) return "";
    seen.add(text);
  }

  if (Array.isArray(text)) {
    return (text as unknown[]).map((chunk: unknown, i: number) => {
      if (typeof chunk === "string" || typeof chunk === "number")
        return <span key={`t-${i}`}>{String(chunk)}</span>;
      if (isRecord(chunk) && hasProp(chunk, "text")) {
        const inner = renderPdfText(chunk.text, depth + 1, seen);
        if (chunk.bold && chunk.italics)
          return (
            <strong key={`t-${i}`}>
              <em>{inner}</em>
            </strong>
          );
        if (chunk.bold) return <strong key={`t-${i}`}>{inner}</strong>;
        if (chunk.italics) return <em key={`t-${i}`}>{inner}</em>;
        return <span key={`t-${i}`}>{inner}</span>;
      }
      return <span key={`t-${i}`}>{String(chunk ?? "")}</span>;
    });
  }
  if (isRecord(text) && hasProp(text, "text")) {
    return renderPdfText(text.text, depth + 1, seen);
  }
  return String(text as string);
}

export function flattenPdfText(
  node: PdfNode,
  depth: number,
  seen: WeakSet<object>,
): string {
  if (node == null) return "";
  if (depth > 24) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null) {
    if (seen.has(node)) return "";
    seen.add(node);
  }
  if (Array.isArray(node))
    return (node as unknown[])
      .map((item: unknown) => flattenPdfText(item, depth + 1, seen))
      .join(" ");
  if (isRecord(node)) {
    if (hasProp(node, "text"))
      return flattenPdfText(node.text, depth + 1, seen);
    if (hasProp(node, "stack"))
      return flattenPdfText(node.stack, depth + 1, seen);
  }
  return "";
}

export function mapPdfStyle(style: unknown): string {
  switch (style) {
    case "pretitle":
      return "ep-html-pretitle";
    case "title":
      return "ep-html-title";
    case "subtitle":
      return "ep-html-subtitle";
    case "sectionHeader":
      return "ep-html-section";
    case "subHeader":
      return "ep-html-subheader";
    case "meta":
      return "ep-html-meta";
    case "narrative":
      return "ep-html-narrative";
    default:
      return "";
  }
}

/** Translate pdfmake widths array to CSS colgroup + table-layout */
export function computeColStyles(
  widths: unknown,
  colCount: number,
): { tableStyle: React.CSSProperties; colGroup: ReactElement | null } {
  if (!Array.isArray(widths) || widths.length === 0) {
    return { tableStyle: { tableLayout: "auto" }, colGroup: null };
  }

  const ws = widths as unknown[];
  // Count star (*) columns for flex distribution
  const starCount = ws.filter((w: unknown) => w === "*").length;
  const totalFixed = ws.reduce((sum: number, w: unknown) => {
    if (typeof w === "number") return sum + w;
    return sum;
  }, 0);
  // Available space for stars (499.28pt content width as reference)
  const availableForStars = Math.max(0, 499 - totalFixed);
  const starWidth = starCount > 0 ? availableForStars / starCount : 0;

  const cols = ws.map((w: unknown, i: number) => {
    let style: React.CSSProperties = {};
    if (typeof w === "number") {
      style = { width: `${w}px` };
    } else if (w === "*") {
      style = { width: `${starWidth}px` };
    }
    // 'auto' → no explicit width
    return <col key={`col-${i}`} style={style} />;
  });

  // Pad if widths array is shorter than actual columns
  while (cols.length < colCount) {
    cols.push(<col key={`col-${cols.length}`} />);
  }

  return {
    tableStyle: {
      tableLayout: ws.some((w: unknown) => typeof w === "number")
        ? "fixed"
        : "auto",
    } as React.CSSProperties,
    colGroup: <colgroup>{cols}</colgroup>,
  };
}

/** Extract inline cell styling from pdfmake cell objects */
export function getCellStyle(cell: unknown): React.CSSProperties | undefined {
  if (cell == null || !isRecord(cell)) return undefined;
  const style: React.CSSProperties = {};
  if (cell.fontSize) style.fontSize = `${String(cell.fontSize)}px`;
  if (cell.bold) style.fontWeight = 700;
  if (cell.italics) style.fontStyle = "italic";
  if (cell.color) style.color = cell.color as string;
  if (cell.alignment)
    style.textAlign = cell.alignment as React.CSSProperties["textAlign"];
  if (cell.fillColor) style.background = cell.fillColor as string;
  return Object.keys(style).length > 0 ? style : undefined;
}
