import { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface CategoryBarChartProps {
  entries: { value: string | number; count: number }[];
  label: string;
  color?: string;
  height?: number;
}

export function CategoryBarChart({
  entries,
  label,
  color,
  height = 320,
}: CategoryBarChartProps) {
  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const top = useMemo(
    () => [...entries].sort((a, b) => b.count - a.count).slice(0, 20),
    [entries],
  );

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        x: top.map((e) => String(e.value)),
        y: top.map((e) => e.count),
        type: "bar" as const,
        marker: { color: resolvedColor },
        hovertemplate: "%{x}<br>Count: %{y}<extra></extra>",
      },
    ],
    [top, resolvedColor],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: { title: { text: label, standoff: 8 }, tickangle: -25 },
        yaxis: { title: { text: "Count", standoff: 8 } },
        showlegend: false,
      }),
    [height, label, themeKey],
  );

  if (!entries.length) return <p className="empty-msg">No data</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">{label} frequency (top categories)</div>
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
