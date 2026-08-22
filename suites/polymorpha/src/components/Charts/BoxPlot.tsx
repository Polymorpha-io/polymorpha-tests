import React, { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { CHART_COLORS } from "@/lib/palette";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface BoxGroup {
  label: string;
  values: number[];
}
interface BoxPlotProps {
  groups: BoxGroup[];
  yLabel: string;
  xLabel?: string;
  height?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export function BoxPlot({
  groups,
  yLabel,
  xLabel,
  height = 300,
}: BoxPlotProps) {
  const validGroups = groups.filter((g) => g.values.length > 0);

  const traces: Plotly.Data[] = useMemo(
    () =>
      validGroups.map((g, i) => ({
        y: g.values,
        type: "box" as const,
        name: g.label.length > 20 ? g.label.slice(0, 19) + "…" : g.label,
        marker: {
          color: CHART_COLORS[i % CHART_COLORS.length],
          outliercolor: CHART_COLORS[i % CHART_COLORS.length],
        },
        boxpoints: "outliers" as const,
        jitter: 0.3,
        pointpos: -1.8,
        hovertemplate: "%{y:.2f}<extra>%{fullData.name}</extra>",
      })),
    [validGroups],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        yaxis: { title: { text: yLabel, standoff: 8 } },
        xaxis: { title: { text: xLabel ?? "Group", standoff: 8 } },
        showlegend: validGroups.length > 1,
        legend: {
          orientation: "h" as const,
          y: 1.08,
          x: 0.5,
          xanchor: "center" as const,
          font: { size: 11 },
        },
      }),
    [height, yLabel, xLabel, validGroups.length, themeKey],
  );

  if (validGroups.length === 0)
    return <p className="empty-msg">No data to display</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">
        {yLabel} by {xLabel ?? "group"}
      </div>
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
