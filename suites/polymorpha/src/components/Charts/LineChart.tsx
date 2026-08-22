import React, { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface LineChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export function LineChart({
  data,
  label,
  color,
  height = 300,
}: LineChartProps) {
  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const sorted = useMemo(() => [...data].sort((a, b) => a - b), [data]);

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        y: sorted,
        x: sorted.map((_, i) => i),
        type: "scatter" as const,
        mode: "lines" as const,
        fill: "tozeroy",
        fillcolor: `${resolvedColor}18`,
        line: { color: resolvedColor, width: 2, shape: "spline" as const },
        hovertemplate: "Value: %{y:.2f}<extra></extra>",
      },
    ],
    [sorted, resolvedColor],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: {
          title: { text: "Sorted index", standoff: 8 },
          showticklabels: false,
        },
        yaxis: { title: { text: label, standoff: 8 } },
        showlegend: false,
      }),
    [height, label, themeKey],
  );

  if (data.length < 2) return null;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">{label} (sorted distribution)</div>
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
