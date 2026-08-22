import React, { useMemo } from "react";
import { Plot } from "./LazyPlot";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

interface ScatterChartProps {
  xData: number[];
  yData: number[];
  xLabel: string;
  yLabel: string;
  color?: string;
  height?: number;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

function linearRegression(x: number[], y: number[]) {
  const n = x.length;
  if (n < 2) return { a: 0, b: 0, r2: 0, r: 0 };
  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let ssxy = 0,
    ssxx = 0,
    ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (x[i] - xMean) * (y[i] - yMean);
    ssxx += (x[i] - xMean) ** 2;
    ssyy += (y[i] - yMean) ** 2;
  }
  const b = ssxx === 0 ? 0 : ssxy / ssxx;
  const a = yMean - b * xMean;
  const r2 = ssxx === 0 || ssyy === 0 ? 0 : (ssxy * ssxy) / (ssxx * ssyy);
  const r = ssxx === 0 || ssyy === 0 ? 0 : ssxy / Math.sqrt(ssxx * ssyy);
  return { a, b, r2, r };
}

function corrStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? "Strong +" : "Strong −";
  if (abs >= 0.4) return r > 0 ? "Moderate +" : "Moderate −";
  if (abs >= 0.2) return r > 0 ? "Weak +" : "Weak −";
  return "None";
}

export function ScatterChart({
  xData,
  yData,
  xLabel,
  yLabel,
  color,
  height = 300,
}: ScatterChartProps) {
  const N = Math.min(xData.length, yData.length);

  const resolvedColor = useMemo(() => {
    if (color && !color.startsWith("var(")) return color;
    const s = getComputedStyle(document.documentElement);
    const name = color?.replace(/^var\(/, "").replace(/\)$/, "") ?? "--accent";
    return s.getPropertyValue(name).trim() || "#2563eb";
  }, [color]);

  const { a, b, r2, r } = useMemo(
    () => linearRegression(xData.slice(0, N), yData.slice(0, N)),
    [xData, yData, N],
  );
  const xMin = Math.min(...xData),
    xMax = Math.max(...xData);

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        x: xData.slice(0, N),
        y: yData.slice(0, N),
        type: "scatter" as const,
        mode: "markers" as const,
        marker: { color: resolvedColor, opacity: 0.55, size: 6 },
        hovertemplate: `${xLabel}: %{x:.2f}<br>${yLabel}: %{y:.2f}<extra></extra>`,
        name: "Data",
      },
      {
        x: [xMin, xMax],
        y: [a + b * xMin, a + b * xMax],
        type: "scatter" as const,
        mode: "lines" as const,
        line: { color: "#f97316", width: 2, dash: "dash" as const },
        name: `R²=${r2.toFixed(3)} (${corrStrength(r)})`,
        hoverinfo: "skip" as const,
      },
    ],
    [xData, yData, N, resolvedColor, xLabel, yLabel, a, b, r2, r, xMin, xMax],
  );
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height,
        xaxis: { title: { text: xLabel, standoff: 8 } },
        yaxis: { title: { text: yLabel, standoff: 8 } },
        legend: {
          orientation: "h" as const,
          y: 1.08,
          x: 0.5,
          xanchor: "center" as const,
          font: { size: 11 },
        },
      }),
    [height, xLabel, yLabel, themeKey],
  );

  if (N < 2) return <p className="empty-msg">Not enough data to scatter</p>;

  return (
    <div className="plotly-chart-wrap">
      <div className="svg-chart-label">
        {yLabel} vs {xLabel}
      </div>
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height }}
      />
      {N > 2000 && (
        <span className="chart-sample-note">
          Showing {N.toLocaleString()} points
        </span>
      )}
    </div>
  );
}
