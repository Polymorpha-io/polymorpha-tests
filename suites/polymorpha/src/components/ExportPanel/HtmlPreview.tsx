import React from "react";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import {
  computeColStyles,
  findBarColumns,
  flattenPdfText,
  getBarLineClass,
  getCellStyle,
  getMarginStyle,
  mapPdfStyle,
  parseBarColumns,
  renderPdfText,
} from "./htmlPreviewUtils";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function CheckItem({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ep-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ep-check-box">
        {checked && (
          <svg viewBox="0 0 12 12" width="12" height="12">
            <polyline
              points="2,6 5,9 10,3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="ep-check-text">
        <span className="ep-check-label">{label}</span>
        {desc && <span className="ep-check-desc">{desc}</span>}
      </span>
    </label>
  );
}

const FONT_MAP: Record<string, string> = {
  Roboto: "'Roboto', 'Segoe UI', sans-serif",
  Helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  Times: "'Times New Roman', Times, Georgia, serif",
  Courier: "'Courier New', Courier, monospace",
};

export function HtmlDocPreview({
  docDef,
}: {
  docDef: TDocumentDefinitions | null;
}) {
  const doc = docDef as unknown as UnknownRecord | null;

  const rawContent = isRecord(doc) ? doc.content : undefined;
  const content: unknown[] = Array.isArray(rawContent) ? rawContent : [];

  const defaultStyleRaw = isRecord(doc) ? doc.defaultStyle : undefined;
  const defaultStyleRecord = isRecord(defaultStyleRaw)
    ? defaultStyleRaw
    : undefined;
  const fontNameRaw = defaultStyleRecord?.font;
  const fontName = typeof fontNameRaw === "string" ? fontNameRaw : "Roboto";
  const fontFamily = FONT_MAP[fontName] ?? FONT_MAP.Roboto;
  const hasFooter = typeof doc?.footer === "function";

  // Split content into pages at pageBreak: 'before' boundaries
  const pages: unknown[][] = [[]];
  for (const node of content) {
    if (isRecord(node) && node.pageBreak === "before") {
      pages.push([{ ...node, pageBreak: undefined }]);
    } else {
      pages[pages.length - 1].push(node);
    }
  }

  const rawStyles = isRecord(doc) ? doc.styles : undefined;
  const styles: Record<string, UnknownRecord> | undefined = isRecord(rawStyles)
    ? (rawStyles as Record<string, UnknownRecord>)
    : undefined;
  const totalPages = pages.length;

  const getBar = (kind: "header" | "footer", pageNum: number) => {
    const factory = isRecord(doc) ? doc[kind] : undefined;
    if (typeof factory !== "function") return null;
    try {
      const barFactory = factory as unknown as (
        currentPage: number,
        pageCount: number,
      ) => unknown;
      const barDef = barFactory(pageNum, totalPages);
      const cols = findBarColumns(barDef);
      if (cols && Array.isArray(cols)) {
        const parsed = parseBarColumns(cols);
        if (parsed.left.length || parsed.right.length) return parsed;
      }
      const text = flattenPdfText(barDef, 0, new WeakSet<object>()).trim();
      if (text) return { left: [text], right: [] };
    } catch {
      /* ignore */
    }
    return null;
  };

  return (
    <div className="ep-html-pages" style={{ fontFamily }}>
      {pages.map((pageContent, pageIdx) => {
        const pageNum = pageIdx + 1;
        const header = getBar("header", pageNum);
        const footer = hasFooter ? getBar("footer", pageNum) : null;
        return (
          <div className="ep-html-page" key={`page-${pageIdx}`}>
            {header && (
              <div className="ep-html-header-bar">
                <div className="ep-html-bar-copy ep-html-header-left">
                  {header.left.map((line: string, idx: number) => (
                    <span
                      key={`hdr-l-${idx}`}
                      className={`ep-html-bar-line ${getBarLineClass("header", "left", idx, line)}`}
                    >
                      {line}
                    </span>
                  ))}
                </div>
                <div className="ep-html-bar-copy ep-html-header-right">
                  {header.right.map((line: string, idx: number) => (
                    <span
                      key={`hdr-r-${idx}`}
                      className={`ep-html-bar-line ${getBarLineClass("header", "right", idx, line)}`}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="ep-html-page-body">
              {pageContent.map((node: unknown, i: number) => (
                <HtmlDocNode
                  key={`p${pageIdx}-n${i}`}
                  node={node}
                  styles={styles}
                />
              ))}
            </div>
            <div className="ep-html-footer-bar">
              {footer ? (
                <>
                  <div className="ep-html-bar-copy ep-html-footer-left">
                    {footer.left.map((line: string, idx: number) => (
                      <span
                        key={`ftr-l-${idx}`}
                        className={`ep-html-bar-line ${getBarLineClass("footer", "left", idx, line)}`}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                  <div className="ep-html-bar-copy ep-html-footer-right">
                    {footer.right.map((line: string, idx: number) => (
                      <span
                        key={`ftr-r-${idx}`}
                        className={`ep-html-bar-line ${getBarLineClass("footer", "right", idx, line)}`}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span></span>
                  <span>
                    {pageNum} / {totalPages}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type HtmlDocNodeProps = {
  node: unknown;
  styles?: Record<string, UnknownRecord>;
  depth?: number;
  seen?: WeakSet<object>;
};

export function HtmlDocNode({
  node,
  styles,
  depth = 0,
  seen,
}: HtmlDocNodeProps): React.ReactElement | null {
  if (node == null) return null;

  if (depth > 32) {
    return null;
  }

  const sharedSeen = seen ?? new WeakSet<object>();
  if (isRecord(node)) {
    if (sharedSeen.has(node)) {
      return null;
    }
    sharedSeen.add(node);
  }

  // Resolve margin: node-level margin > style-level margin > fallback
  const nodeRecord = isRecord(node) ? node : undefined;
  const nodeMargin: unknown = nodeRecord?.margin;
  const styleKey: string | undefined =
    nodeRecord && typeof nodeRecord.style === "string"
      ? nodeRecord.style
      : undefined;
  const styleMargin: unknown =
    styleKey && styles?.[styleKey] ? styles[styleKey].margin : undefined;
  const resolvedMargin: unknown = nodeMargin ?? styleMargin ?? undefined;
  const marginStyle = getMarginStyle(resolvedMargin);

  if (typeof node === "string") {
    return <p className="ep-html-text">{node}</p>;
  }

  if (Array.isArray(node)) {
    return (
      <>
        {node.map((n: unknown, i: number) => (
          <HtmlDocNode
            key={`arr-${i}`}
            node={n}
            styles={styles}
            depth={depth + 1}
            seen={sharedSeen}
          />
        ))}
      </>
    );
  }

  if (nodeRecord && nodeRecord.stack !== undefined) {
    const rawStack = nodeRecord.stack;
    const stack: unknown[] = Array.isArray(rawStack) ? rawStack : [];
    return (
      <div className="ep-html-stack" style={marginStyle}>
        {stack.map((n: unknown, i: number) => (
          <HtmlDocNode
            key={`stack-${i}`}
            node={n}
            styles={styles}
            depth={depth + 1}
            seen={sharedSeen}
          />
        ))}
      </div>
    );
  }

  if (nodeRecord && nodeRecord.columns !== undefined) {
    const rawCols = nodeRecord.columns;
    const cols: unknown[] = Array.isArray(rawCols) ? rawCols : [];
    const gap =
      typeof nodeRecord.columnGap === "number" ? nodeRecord.columnGap : 10;
    const colStyle: React.CSSProperties = {
      ...marginStyle,
      display: "flex",
      alignItems: "center",
      gap: `${gap}px`,
      flexWrap: "wrap",
    };
    return (
      <div className="ep-html-columns" style={colStyle}>
        {cols.map((n: unknown, i: number) => {
          const colRec = isRecord(n) ? n : undefined;
          const widthVal = colRec?.width;
          const flex =
            widthVal === "*"
              ? "1 1 auto"
              : widthVal === "auto" || typeof widthVal === "number"
                ? "0 0 auto"
                : undefined;
          return (
            <div key={`col-${i}`} style={{ flex }}>
              <HtmlDocNode
                node={n}
                styles={styles}
                depth={depth + 1}
                seen={sharedSeen}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (nodeRecord && nodeRecord.ul !== undefined) {
    const rawItems = nodeRecord.ul;
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];
    return (
      <ul className="ep-html-list" style={marginStyle}>
        {items.map((n: unknown, i: number) => (
          <li key={`ul-${i}`}>
            <HtmlDocNode
              node={n}
              styles={styles}
              depth={depth + 1}
              seen={sharedSeen}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (nodeRecord && nodeRecord.ol !== undefined) {
    const rawItems = nodeRecord.ol;
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];
    return (
      <ol className="ep-html-list" style={marginStyle}>
        {items.map((n: unknown, i: number) => (
          <li key={`ol-${i}`}>
            <HtmlDocNode
              node={n}
              styles={styles}
              depth={depth + 1}
              seen={sharedSeen}
            />
          </li>
        ))}
      </ol>
    );
  }

  if (nodeRecord && isRecord(nodeRecord.table)) {
    const tableRec = nodeRecord.table;
    const rawBody = tableRec.body;
    if (Array.isArray(rawBody)) {
      const body: unknown[] = rawBody;
      const widths: unknown = tableRec.widths;
      const firstRow = body[0];
      const colCount = Array.isArray(firstRow) ? firstRow.length : 0;
      const dense = colCount > 6;

      // Translate pdfmake widths to CSS col styles
      const colStyles = computeColStyles(widths, colCount);

      // Large tables: show first 25 rows then indicator
      const MAX_PREVIEW_ROWS = 25;
      const truncated = body.length > MAX_PREVIEW_ROWS + 1; // +1 for header
      const displayBody: unknown[] = truncated
        ? body.slice(0, MAX_PREVIEW_ROWS + 1)
        : body;

      return (
        <div
          className={`ep-html-table-wrap${dense ? " ep-table-dense" : ""}`}
          style={marginStyle}
        >
          <table className="ep-html-table" style={colStyles.tableStyle}>
            {colStyles.colGroup}
            <tbody>
              {displayBody.map((row: unknown, rIdx: number) => (
                <tr key={`r-${rIdx}`}>
                  {(Array.isArray(row) ? row : []).map(
                    (cell: unknown, cIdx: number) => {
                      const cellStyle = getCellStyle(cell);
                      return rIdx === 0 ? (
                        <th key={`c-${rIdx}-${cIdx}`} style={cellStyle}>
                          {flattenPdfText(cell, 0, new WeakSet<object>())}
                        </th>
                      ) : (
                        <td key={`c-${rIdx}-${cIdx}`} style={cellStyle}>
                          {flattenPdfText(cell, 0, new WeakSet<object>())}
                        </td>
                      );
                    },
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && (
            <div className="ep-html-table-truncated">
              [{body.length - MAX_PREVIEW_ROWS - 1} more rows in PDF]
            </div>
          )}
        </div>
      );
    }
  }

  if (nodeRecord && nodeRecord.canvas !== undefined) {
    // Distinguish title separator (thick) from section separators (thin)
    const canvasVal = nodeRecord.canvas;
    const line: unknown = Array.isArray(canvasVal) ? canvasVal[0] : null;
    const lineRec = isRecord(line) ? line : undefined;
    const lineWidth = lineRec?.lineWidth;
    const isTitle = typeof lineWidth === "number" && lineWidth > 1;
    return (
      <hr
        className={`ep-html-canvas-line${isTitle ? "" : " ep-html-canvas-line--section"}`}
        style={marginStyle}
      />
    );
  }

  if (nodeRecord && nodeRecord.svg !== undefined) {
    const svgVal = nodeRecord.svg;
    const fitRaw = nodeRecord.fit;
    const fit = Array.isArray(fitRaw) && fitRaw.length >= 2 ? fitRaw : null;
    const widthRaw = nodeRecord.width;
    const explicitWidth = typeof widthRaw === "number" ? widthRaw : null;
    const isInlineLogo = explicitWidth !== null && explicitWidth <= 40;
    const fit0 = fit ? (fit[0] as number) : undefined;
    const fit1 = fit ? (fit[1] as number) : undefined;
    const svgStyle: React.CSSProperties = {
      ...marginStyle,
      maxWidth: fit
        ? `${String(fit0)}px`
        : explicitWidth
          ? `${String(explicitWidth)}px`
          : "100%",
      width: fit
        ? "100%"
        : explicitWidth
          ? `${String(explicitWidth)}px`
          : "100%",
      aspectRatio: fit ? `${String(fit0)} / ${String(fit1)}` : undefined,
      overflow: "hidden",
    };
    return (
      <div
        className={isInlineLogo ? "" : "ep-html-svg"}
        style={svgStyle}
        dangerouslySetInnerHTML={{ __html: String(svgVal) }}
      />
    );
  }

  if (nodeRecord && nodeRecord.image !== undefined) {
    const imageVal = nodeRecord.image;
    const src = typeof imageVal === "string" ? imageVal : "";
    if (!src) return null;
    const fitRaw = nodeRecord.fit;
    const fit = Array.isArray(fitRaw) && fitRaw.length >= 2 ? fitRaw : null;
    const fit0 = fit ? (fit[0] as number) : undefined;
    const fit1 = fit ? (fit[1] as number) : undefined;
    const imgStyle: React.CSSProperties = {
      width: fit ? `${String(fit0)}px` : undefined,
      maxWidth: "100%",
      aspectRatio: fit ? `${String(fit0)} / ${String(fit1)}` : undefined,
      height: "auto",
      display: "block",
      margin: "0 auto",
      objectFit: "contain",
    };
    return (
      <div className="ep-html-image" style={marginStyle}>
        <img src={src} alt="Export visual" style={imgStyle} />
      </div>
    );
  }

  if (nodeRecord && Object.prototype.hasOwnProperty.call(nodeRecord, "text")) {
    const textVal: unknown = nodeRecord.text;
    const text = renderPdfText(textVal, 0, new WeakSet<object>());
    const cls = mapPdfStyle(nodeRecord.style as string | undefined);
    const textStyle: React.CSSProperties = { ...marginStyle };
    // Propagate inline font-size overrides from pdfmake nodes
    if (typeof nodeRecord.fontSize === "number")
      textStyle.fontSize = `${String(nodeRecord.fontSize)}px`;
    if (nodeRecord.bold) textStyle.fontWeight = 700;
    if (nodeRecord.italics) textStyle.fontStyle = "italic";
    if (typeof nodeRecord.color === "string")
      textStyle.color = nodeRecord.color;
    if (typeof nodeRecord.alignment === "string")
      textStyle.textAlign =
        nodeRecord.alignment as React.CSSProperties["textAlign"];
    return (
      <div className={`ep-html-text ${cls}`} style={textStyle}>
        {text}
      </div>
    );
  }

  return null;
}
