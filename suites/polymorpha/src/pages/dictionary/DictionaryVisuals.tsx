/**
 * DictionaryVisuals — chart + visual-suggestion rendering for dictionary term pages.
 */
import type {
  DictionaryEntry,
  VisualSuggestion,
} from "@polymorpha/business-logic";
import { Plot } from "@/components/Charts/LazyPlot";

function hasSeriesData(term: DictionaryEntry): boolean {
  return !!term.visualSuggestion?.series?.some(
    (series) => (series.points?.length || 0) > 0,
  );
}

function hasTableData(term: DictionaryEntry): boolean {
  return !!term.visualSuggestion?.table?.rows?.length;
}

function visualDescription(term: DictionaryEntry): string | undefined {
  return (
    term.visualSuggestion?.description ||
    term.visualSuggestion?.annotations?.find((a) => a.text)?.text ||
    term.visualSuggestion?.title
  );
}

function isGenericVisualSuggestion(term: DictionaryEntry): boolean {
  const desc = (visualDescription(term) || "").trim();
  const isGenericCopy =
    /^a visual representation \(e\.g\., bar chart, plot, or workflow diagram\) illustrating this specific concept in action\.?$/i.test(
      desc,
    );
  const isGenericBar =
    (
      term.visualSuggestion?.chartType ||
      term.visualSuggestion?.type ||
      ""
    ).toLowerCase() === "bar";
  return (
    isGenericBar && isGenericCopy && !hasSeriesData(term) && !hasTableData(term)
  );
}

export function shouldShowVisualSuggestion(term: DictionaryEntry): boolean {
  if (!term.visualSuggestion) return false;
  if (isGenericVisualSuggestion(term)) return false;
  return !!visualDescription(term) || hasSeriesData(term) || hasTableData(term);
}

function VisualPlot({ vis }: { vis: VisualSuggestion }) {
  const chartType = (vis.chartType || vis.type || "bar").toLowerCase();
  const s = getComputedStyle(document.documentElement);
  const textColor = s.getPropertyValue("--foreground").trim() || "#0b1220";
  const textDim = s.getPropertyValue("--muted-foreground").trim() || "#475569";
  const borderColor = s.getPropertyValue("--border").trim() || "#d7e1ef";

  const data: Plotly.Data[] = (vis.series || []).map((s) => {
    const xs = s.points?.map((p) => p.x) || [];
    const ys = s.points?.map((p) => p.y) || [];

    if (chartType === "scatter") {
      return {
        x: xs,
        y: ys,
        mode: "markers",
        name: s.name || "",
        marker: { color: s.color },
      } as Plotly.Data;
    }
    if (chartType === "line") {
      return {
        x: xs,
        y: ys,
        mode: "lines+markers",
        name: s.name || "",
        line: { color: s.color },
      } as Plotly.Data;
    }
    // histogram / bar
    return {
      x: xs,
      y: ys,
      type: "bar",
      name: s.name || "",
      marker: { color: s.color },
    } as Plotly.Data;
  });

  // Reference lines as shape annotations
  const shapes: Partial<Plotly.Shape>[] = (vis.referenceLines || []).map(
    (rl) => {
      const isX = rl.axis === "x";
      return {
        type: "line",
        x0: isX ? rl.value : 0,
        x1: isX ? rl.value : 1,
        y0: isX ? 0 : rl.value,
        y1: isX ? 1 : rl.value,
        xref: isX ? "x" : "paper",
        yref: isX ? "paper" : "y",
        line: { color: "#ef4444", width: 2, dash: "dash" },
      };
    },
  );

  const annotations: Partial<Plotly.Annotations>[] = (vis.referenceLines || [])
    .filter((rl) => rl.label)
    .map((rl) => {
      const isX = rl.axis === "x";
      return {
        x: isX ? rl.value : 1,
        y: isX ? 1 : rl.value,
        xref: isX ? "x" : "paper",
        yref: isX ? "paper" : "y",
        text: rl.label,
        showarrow: false,
        font: { size: 11, color: "#ef4444" },
        yshift: 10,
      };
    });

  type LayoutWithBarRadius = Partial<Plotly.Layout> & {
    barcornerradius?: number;
  };
  const layout: LayoutWithBarRadius = {
    xaxis: {
      title: vis.xLabel ? { text: vis.xLabel } : undefined,
      gridcolor: borderColor,
      linecolor: borderColor,
      tickfont: { size: 10, color: textDim },
    },
    yaxis: {
      title: vis.yLabel ? { text: vis.yLabel } : undefined,
      gridcolor: borderColor,
      linecolor: borderColor,
      tickfont: { size: 10, color: textDim },
    },
    shapes,
    annotations,
    margin: { t: 12, b: 40, l: 50, r: 16 },
    height: 220,
    barcornerradius: 3,
    showlegend: data.length > 1,
    legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center" },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: {
      family: "Geist Variable, system-ui, sans-serif",
      size: 11,
      color: textColor,
    },
  };

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
    />
  );
}

export function VisualChart({ vis }: { vis: VisualSuggestion }) {
  const hasSeries = vis.series?.some((s) => (s.points?.length || 0) > 0);
  const hasTable = (vis.table?.rows?.length || 0) > 0;

  if (!hasSeries && !hasTable) {
    const desc =
      vis.description ||
      vis.annotations?.find((a) => a.text)?.text ||
      vis.title;
    return desc ? <p>{desc}</p> : null;
  }

  return (
    <>
      {hasSeries && <VisualPlot vis={vis} />}
      {hasTable && vis.table && (
        <table className="dict-seo-table dict-seo-visual-table">
          {vis.table.headers && vis.table.headers.length > 0 && (
            <thead>
              <tr>
                {vis.table.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {vis.table.rows!.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
