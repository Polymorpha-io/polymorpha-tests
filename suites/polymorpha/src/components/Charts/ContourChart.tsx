import { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface ContourChartProps {
  xData: number[];
  yData: number[];
  xLabel: string;
  yLabel: string;
  height?: number;
}

export function ContourChart({
  xData,
  yData,
  xLabel,
  yLabel,
  height = 320,
}: ContourChartProps) {
  const n = Math.min(xData.length, yData.length);

  const x = xData.slice(0, n);
  const y = yData.slice(0, n);

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        x,
        y,
        type: "histogram2dcontour" as const,
        colorscale: "Blues" as const,
        reversescale: false,
        showscale: true,
        ncontours: 15,
        hovertemplate: `${xLabel}: %{x:.2f}<br>${yLabel}: %{y:.2f}<extra></extra>`,
        contours: { coloring: "heatmap" as const },
      },
      {
        x,
        y,
        type: "scatter" as const,
        mode: "markers" as const,
        marker: { color: "#1d4ed8", size: 4, opacity: 0.3 },
        hoverinfo: "skip" as const,
        showlegend: false,
      },
    ],
    [x, y, xLabel, yLabel],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: { title: { text: xLabel, standoff: 8 } },
        yaxis: { title: { text: yLabel, standoff: 8 } },
        showlegend: false,
      }),
    [height, xLabel, yLabel, themeKey],
  );

  if (n < 2)
    return <p className="empty-msg">Not enough data for contour plot</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">Density contour</div>
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
