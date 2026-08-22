import { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface ViolinChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
}

export function ViolinChart({
  data,
  label,
  color,
  height = 320,
}: ViolinChartProps) {
  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        y: data,
        type: "violin" as const,
        name: label,
        box: { visible: true },
        meanline: { visible: true },
        points: "suspectedoutliers" as const,
        marker: { color: resolvedColor },
        fillcolor: `${resolvedColor}40`,
        line: { color: resolvedColor },
        hovertemplate: `${label}: %{y:.2f}<extra></extra>`,
      },
    ],
    [data, label, resolvedColor],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: { showticklabels: false },
        yaxis: { title: { text: label, standoff: 8 } },
        showlegend: false,
      }),
    [height, label, themeKey],
  );

  if (data.length < 2) return <p className="empty-msg">Not enough data</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">{label} violin distribution</div>
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
