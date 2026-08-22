import { useDataStore } from "@/store/useDataStore";

export const visualLabelFromKey = (key: string) => {
  if (key === "heatmap:global") return "Correlation heatmap";
  const [kind, payload] = key.split(":");
  if (!kind || !payload) return key;
  const pairKinds: Record<string, string> = {
    scatter: "Scatter",
    gbox: "Grouped box",
  };
  const singleKinds: Record<string, string> = {
    hist: "Histogram",
    box: "Box plot",
    qq: "Q-Q plot",
    bar: "Bar chart",
    pie: "Pie chart",
  };
  if (payload.includes("__")) {
    const [a, b] = payload.split("__");
    return `${pairKinds[kind] ?? kind} - ${a} x ${b}`;
  }
  return `${singleKinds[kind] ?? kind} - ${payload}`;
};

export function descriptiveRowsFromResults(
  results: NonNullable<ReturnType<typeof useDataStore.getState>["results"]>,
) {
  return results.descriptive.map((d) => ({
    Column: d.column,
    Count: d.count,
    Missing: d.missing,
    "Missing %": d.missingPct.toFixed(2),
    Mean: Number.isNaN(d.mean) ? "" : d.mean.toFixed(4),
    Median: Number.isNaN(d.median) ? "" : d.median.toFixed(4),
    "Std Dev": Number.isNaN(d.std) ? "" : d.std.toFixed(4),
    Min: Number.isNaN(d.min) ? "" : d.min,
    Max: Number.isNaN(d.max) ? "" : d.max,
    Q1: Number.isNaN(d.q1) ? "" : d.q1.toFixed(4),
    Q3: Number.isNaN(d.q3) ? "" : d.q3.toFixed(4),
    Skewness: Number.isNaN(d.skewness) ? "" : d.skewness.toFixed(4),
    Kurtosis: Number.isNaN(d.kurtosis) ? "" : d.kurtosis.toFixed(4),
  }));
}

export function testRowsFromResults(
  results: NonNullable<ReturnType<typeof useDataStore.getState>["results"]>,
) {
  const rows: Record<string, unknown>[] = [];
  for (const t of results.tTests) {
    rows.push({
      Test: `t-test (${t.type})`,
      "Variable 1": t.column1,
      "Variable 2": t.column2 ?? "",
      Statistic: `t = ${t.t.toFixed(3)}`,
      df: t.df,
      "p-value": t.pValue.toFixed(4),
      "Effect size": `d = ${t.cohensD.toFixed(3)}`,
      Significant: t.significant ? "Yes" : "No",
    });
  }
  for (const a of results.anova) {
    rows.push({
      Test: "One-way ANOVA",
      "Variable 1": a.responseVar,
      "Variable 2": a.factor,
      Statistic: `F(${a.dfBetween}, ${a.dfWithin}) = ${a.F.toFixed(3)}`,
      df: `${a.dfBetween}, ${a.dfWithin}`,
      "p-value": a.pValue.toFixed(4),
      "Effect size": `η² = ${a.etaSquared.toFixed(3)}`,
      Significant: a.significant ? "Yes" : "No",
    });
  }
  return rows;
}
