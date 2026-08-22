import { useMemo } from "react";
import { Plot } from "./LazyPlot";
import type { CorrelationMatrix } from "@/types";
import { baseLayout, plotlyConfig } from "./plotlyDefaults";

export type CorrelationHeatmapPalette = "ocean" | "sunset" | "forest" | "slate";

interface HeatmapChartProps {
  matrix: CorrelationMatrix;
  palette?: CorrelationHeatmapPalette;
}

const HEATMAP_COLORSCALES: Record<
  CorrelationHeatmapPalette,
  [number, string][]
> = {
  ocean: [
    [0, "#c62828"],
    [0.5, "#f8fafc"],
    [1, "#1565c0"],
  ],
  sunset: [
    [0, "#8b1e3f"],
    [0.5, "#fff7ed"],
    [1, "#d97706"],
  ],
  forest: [
    [0, "#9a3412"],
    [0.5, "#f8fafc"],
    [1, "#166534"],
  ],
  slate: [
    [0, "#7f1d1d"],
    [0.5, "#f8fafc"],
    [1, "#0f766e"],
  ],
};

export function HeatmapChart({ matrix, palette = "ocean" }: HeatmapChartProps) {
  if (
    !matrix ||
    !Array.isArray(matrix.columns) ||
    !Array.isArray(matrix.values)
  )
    return null;
  const columns = matrix.columns.map((c) => String(c));
  const values = matrix.values.map((row) =>
    Array.isArray(row)
      ? row.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN))
      : [],
  );
  const N = columns.length;

  // Mask diagonal with NaN for cleaner display
  const maskedValues = useMemo(
    () => values.map((row, i) => row.map((v, j) => (i === j ? NaN : v))),
    [values],
  );

  // Build text matrix for annotations
  const textValues = useMemo(
    () =>
      values.map((row, i) =>
        row.map((v, j) => {
          if (i === j) return "—";
          if (typeof v !== "number" || !Number.isFinite(v)) return "";
          return v.toFixed(2);
        }),
      ),
    [values],
  );

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 760;

  const traces: Plotly.Data[] = useMemo(
    () => [
      {
        z: maskedValues,
        x: columns,
        y: columns,
        type: "heatmap" as const,
        colorscale: HEATMAP_COLORSCALES[palette],
        zmin: -1,
        zmax: 1,
        text: textValues as unknown as Plotly.PlotData["text"],
        texttemplate: isMobile ? "" : "%{text}",
        hovertemplate: "%{y} × %{x}<br>r = %{z:.3f}<extra></extra>",
        colorbar: {
          title: { text: "r", side: "right" } as Partial<Plotly.ColorBarTitle>,
          tickvals: [-1, 0, 1],
          len: 0.6,
          thickness: isMobile ? 10 : 18,
          xpad: isMobile ? 4 : 8,
        },
        showscale: true,
      },
    ],
    [maskedValues, columns, textValues, palette, isMobile],
  );

  const cellSize = isMobile
    ? Math.min(40, Math.max(24, Math.floor(320 / N)))
    : Math.min(64, Math.max(36, Math.floor(720 / N)));
  const h = isMobile
    ? Math.max(240, N * cellSize + 80)
    : Math.max(360, N * cellSize + 150);
  const themeKey =
    document.documentElement.getAttribute("data-theme") ?? "light";

  const layout = useMemo(
    () =>
      baseLayout({
        height: h,
        xaxis: {
          tickangle: -45,
          side: "bottom",
          tickfont: { size: isMobile ? 8 : 11 },
        } as Partial<Plotly.Layout["xaxis"]>,
        yaxis: {
          autorange: "reversed" as const,
          tickfont: { size: isMobile ? 8 : 11 },
        } as Partial<Plotly.Layout["yaxis"]>,
        margin: isMobile
          ? { t: 10, r: 40, b: 60, l: 60 }
          : { t: 20, r: 74, b: 86, l: 96 },
      }),
    [h, themeKey, isMobile],
  );

  if (N < 2) return null;

  return (
    <div className="plotly-chart-wrap">
      <Plot
        data={traces}
        layout={layout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height: h }}
      />
    </div>
  );
}
