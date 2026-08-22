import React, { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { CHART_COLORS } from "@/lib/palette";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface PieChartProps {
  entries: { value: string | number; count: number }[];
  label: string;
  maxSlices?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export function PieChart({ entries, label, maxSlices = 8 }: PieChartProps) {
  const total = entries.reduce((s, e) => s + e.count, 0);

  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, maxSlices);
  const restCount = sorted.slice(maxSlices).reduce((s, e) => s + e.count, 0);
  const slices =
    restCount > 0 ? [...shown, { value: "Other", count: restCount }] : shown;

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        labels: slices.map((s) => String(s.value)),
        values: slices.map((s) => s.count),
        type: "pie" as const,
        hole: 0.4,
        marker: { colors: CHART_COLORS.slice(0, slices.length) },
        textinfo: "label+percent",
        textposition: "outside",
        hovertemplate:
          "%{label}<br>Count: %{value}<br>%{percent}<extra></extra>",
        sort: false,
      },
    ],
    [slices],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height: 340,
        showlegend: true,
        legend: {
          orientation: "h" as const,
          y: -0.12,
          x: 0.5,
          xanchor: "center" as const,
          font: { size: 11 },
        },
        margin: { t: 24, r: 24, b: 60, l: 24 },
      }),
    [themeKey],
  );

  if (total === 0) return null;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">{label}</div>
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height: 340 }}
      />
    </div>
  );
}
