import { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface BubbleChartProps {
  xData: number[];
  yData: number[];
  xLabel: string;
  yLabel: string;
  color?: string;
  height?: number;
}

export function BubbleChart({
  xData,
  yData,
  xLabel,
  yLabel,
  color,
  height = 320,
}: BubbleChartProps) {
  const n = Math.min(xData.length, yData.length);

  const x = xData.slice(0, n);
  const y = yData.slice(0, n);

  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const yMean = y.reduce((sum, v) => sum + v, 0) / y.length;
  const sizes = y.map((v) => 8 + Math.min(28, Math.abs(v - yMean) * 0.35));

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        x,
        y,
        type: "scatter" as const,
        mode: "markers" as const,
        marker: {
          size: sizes,
          color: resolvedColor,
          opacity: 0.5,
          line: { color: resolvedColor, width: 1 },
        },
        hovertemplate: `${xLabel}: %{x:.2f}<br>${yLabel}: %{y:.2f}<extra></extra>`,
        name: "Bubbles",
      },
    ],
    [x, y, sizes, resolvedColor, xLabel, yLabel],
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
    return <p className="empty-msg">Not enough data to plot bubbles</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">Bubble chart</div>
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
