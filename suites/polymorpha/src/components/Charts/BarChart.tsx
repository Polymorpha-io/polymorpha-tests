import React, { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface BarChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
  bins?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  hideLabel?: boolean;
  subtitle?: string;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function BarChart({
  data,
  label,
  color,
  height = 300,
  bins,
  hideLabel,
  subtitle,
}: BarChartProps) {
  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const mean = useMemo(
    () => (data.length > 0 ? data.reduce((s, v) => s + v, 0) / data.length : 0),
    [data],
  );
  const med = useMemo(() => median(data), [data]);
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: { title: { text: label, standoff: 8 } },
        yaxis: { title: { text: "Count", standoff: 8 } },
        bargap: 0.06,
        shapes: [
          {
            type: "line",
            x0: mean,
            x1: mean,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: { color: "#f97316", width: 2, dash: "dash" },
          },
          {
            type: "line",
            x0: med,
            x1: med,
            y0: 0,
            y1: 1,
            yref: "paper",
            line: { color: "#16a34a", width: 2, dash: "dot" },
          },
        ],
        annotations: [
          {
            x: mean,
            y: 1,
            yref: "paper",
            text: `Mean: ${mean.toFixed(2)}`,
            showarrow: false,
            yanchor: "bottom",
            font: { size: 11, color: "#f97316" },
          },
          {
            x: med,
            y: 0.94,
            yref: "paper",
            text: `Median: ${med.toFixed(2)}`,
            showarrow: false,
            yanchor: "bottom",
            font: { size: 11, color: "#16a34a" },
          },
        ],
        showlegend: false,
      }),
    [height, label, mean, med, themeKey],
  );

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        x: data,
        type: "histogram" as const,
        nbinsx: bins,
        marker: {
          color: resolvedColor,
          opacity: 0.78,
          line: { color: resolvedColor, width: 1 },
        },
        hovertemplate: "%{x:.2f}<br>Count: %{y}<extra></extra>",
      },
    ],
    [data, bins, resolvedColor],
  );

  if (data.length === 0) return <p className="empty-msg">No data</p>;

  return (
    <div className="plotly-chart-wrap">
      {!hideLabel && (
        <div className="svg-chart-label">{label} distribution</div>
      )}
      {subtitle && <div className="svg-chart-subtitle">{subtitle}</div>}
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height }}
      />
    </div>
  );
}
