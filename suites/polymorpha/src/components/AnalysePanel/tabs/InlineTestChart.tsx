import type { Dataset } from "@/types";
import { Plot } from "@/components/Charts/LazyPlot";
import { RenderSafeChart } from "@/components/Charts/RenderSafeChart";

export type VizChartType = "auto" | "scatter" | "box" | "histogram";

interface InlineTestChartProps {
  cleaned: Dataset;
  colA: string;
  colB?: string;
  chartType?: VizChartType;
}

export function InlineTestChart({
  cleaned,
  colA,
  colB,
  chartType = "auto",
}: InlineTestChartProps) {
  const colAMeta = cleaned.columns.find((c) => c.name === colA);
  const colBMeta = colB
    ? cleaned.columns.find((c) => c.name === colB)
    : undefined;

  // Edge case: column not found
  if (!colAMeta)
    return (
      <p className="tests-viz-error">Column "{colA}" not found in dataset.</p>
    );
  if (colB && !colBMeta)
    return (
      <p className="tests-viz-error">Column "{colB}" not found in dataset.</p>
    );

  const valuesA = cleaned.rows
    .map((r) => r[colA])
    .filter((v) => v != null && v !== "");
  const colAType = colAMeta.type;
  const colBType = colBMeta?.type;

  // Edge case: no data
  if (valuesA.length === 0)
    return <p className="tests-viz-error">No data available for "{colA}".</p>;
  if (valuesA.length < 2)
    return (
      <p className="tests-viz-error">
        Not enough data points to visualize (need at least 2).
      </p>
    );

  const textColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--text")
      .trim() || "#1e293b";

  // Determine effective chart type
  let effective: "scatter" | "box" | "histogram";
  if (chartType === "auto") {
    if (colB && colAType === "numeric" && colBType === "numeric")
      effective = "scatter";
    else if (colB && (colAType === "categorical" || colBType === "categorical"))
      effective = "box";
    else effective = "histogram";
  } else {
    effective = chartType;
  }

  if (effective === "scatter" && colB) {
    const valuesB = cleaned.rows
      .map((r) => r[colB])
      .filter((v) => v != null && v !== "");
    if (valuesB.length < 2)
      return (
        <p className="tests-viz-error">
          Not enough data in "{colB}" for scatter plot.
        </p>
      );
    const numA = valuesA.map(Number).filter((v) => !isNaN(v));
    const numB = valuesB.map(Number).filter((v) => !isNaN(v));
    if (numA.length < 2 || numB.length < 2)
      return (
        <p className="tests-viz-error">
          Columns must contain numeric data for scatter plot.
        </p>
      );
    return (
      <RenderSafeChart dataset={cleaned} chartType="scatter" mapping={{ x: colA, y: colB }}>
        <Plot
          data={[
            {
              x: numA,
              y: numB,
              type: "scatter",
              mode: "markers",
              marker: { size: 5, opacity: 0.6 },
            },
          ]}
          layout={{
            xaxis: { title: colA },
            yaxis: { title: colB },
            margin: { t: 20, b: 40, l: 50, r: 20 },
            height: 260,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: textColor },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </RenderSafeChart>
    );
  }

  if (effective === "box" && colB) {
    const groupCol = colAType === "categorical" ? colA : colB;
    const numCol = colAType === "numeric" ? colA : colB;
    const groups = [
      ...new Set(cleaned.rows.map((r) => String(r[groupCol] ?? ""))),
    ].filter(Boolean);
    if (groups.length === 0)
      return (
        <p className="tests-viz-error">No groups found in "{groupCol}".</p>
      );
    if (groups.length > 50)
      return (
        <p className="tests-viz-error">
          Too many groups ({groups.length}) to display box plot. Try a column
          with fewer categories.
        </p>
      );
    const traces = groups.map((g) => ({
      y: cleaned.rows
        .filter((r) => String(r[groupCol]) === g)
        .map((r) => Number(r[numCol]))
        .filter((v) => !isNaN(v)),
      type: "box" as const,
      name: g,
    }));
    if (traces.every((t) => t.y.length === 0))
      return (
        <p className="tests-viz-error">
          No numeric data found in "{numCol}" for the groups.
        </p>
      );
    return (
      <RenderSafeChart dataset={cleaned} chartType="box" mapping={{ x: groupCol, y: numCol }}>
        <Plot
          data={traces}
          layout={{
            margin: { t: 20, b: 40, l: 50, r: 20 },
            height: 260,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: textColor },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </RenderSafeChart>
    );
  }

  // Histogram fallback
  if (colAType === "categorical") {
    // Frequency bar chart for categorical
    const counts: Record<string, number> = {};
    for (const v of valuesA) {
      const s = String(v);
      counts[s] = (counts[s] || 0) + 1;
    }
    const labels = Object.keys(counts);
    if (labels.length > 100)
      return (
        <p className="tests-viz-error">
          Too many unique values ({labels.length}) to chart.
        </p>
      );
    return (
      <RenderSafeChart dataset={cleaned} chartType="bar" mapping={{ x: colA }}>
        <Plot
          data={[
            {
              x: labels,
              y: labels.map((l) => counts[l]),
              type: "bar",
              marker: { opacity: 0.7 },
            },
          ]}
          layout={{
            xaxis: { title: colA },
            yaxis: { title: "Count" },
            margin: { t: 20, b: 40, l: 50, r: 20 },
            height: 260,
            barcornerradius: 3,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: textColor },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </RenderSafeChart>
    );
  }

  const numericA = valuesA.map(Number).filter((v) => !isNaN(v));
  if (numericA.length < 2)
    return (
      <p className="tests-viz-error">
        Not enough numeric values in "{colA}" for histogram.
      </p>
    );

  return (
    <RenderSafeChart dataset={cleaned} chartType="histogram" mapping={{ x: colA }}>
      <Plot
        data={[{ x: numericA, type: "histogram", marker: { opacity: 0.7 } }]}
        layout={{
          xaxis: { title: colA },
          margin: { t: 20, b: 40, l: 50, r: 20 },
          height: 260,
          barcornerradius: 3,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: textColor },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </RenderSafeChart>
  );
}
