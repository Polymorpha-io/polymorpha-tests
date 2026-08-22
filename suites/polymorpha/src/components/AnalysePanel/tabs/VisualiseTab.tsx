import React, { useMemo, useState, useEffect } from "react";
import "./VisualiseTab.css";
import type { Dataset } from "@/types";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import { formatColumnLabel, CHART_COLORS } from "@/components/AnalysePanel/analyseHelpers";
import {
  computeDescriptive,
  computeFrequency,
} from "@/lib/stats/descriptive";
import { useDataStore } from "@/store/useDataStore";
import { useShallow } from "zustand/react/shallow";
import { useExportStore } from "@/features/export/store/useExportStore";

import { BarChart } from "@/components/Charts/BarChart";
import { PieChart } from "@/components/Charts/PieChart";
import { LineChart } from "@/components/Charts/LineChart";
import { ScatterChart } from "@/components/Charts/ScatterChart";
import { BoxPlot } from "@/components/Charts/BoxPlot";
import { AreaChart } from "@/components/Charts/AreaChart";
import { ViolinChart } from "@/components/Charts/ViolinChart";
import { CategoryBarChart } from "@/components/Charts/CategoryBarChart";
import { BubbleChart } from "@/components/Charts/BubbleChart";
import { ContourChart } from "@/components/Charts/ContourChart";
import { RenderSafeChart } from "@/components/Charts/RenderSafeChart";

type ChartType = "bar" | "pie" | "line" | "area" | "violin" | "box" | "catbar";
type BivariateChartType = "scatter" | "bubble" | "contour" | "box";
type VisMode = "univariate" | "bivariate";

const PALETTE_NAMES = [
  "Royal Blue",
  "Amber Gold",
  "Crimson Red",
  "Violet",
  "Cyan Teal",
  "Magenta Rose",
  "Olive Green",
  "Burnt Orange",
  "Chestnut",
  "Charcoal",
] as const;

interface Props {
  cleaned: Dataset;
  computed: ComputedStats;
  canAdvancedCharts: boolean;
  canChartCustomization?: boolean;
  allCorrPairs: { colA: string; colB: string; r: number; label: string }[];
  onError: (msg: string) => void;
}

export function VisualiseTab({
  cleaned,
  computed,
  canAdvancedCharts,
  canChartCustomization = true,
  allCorrPairs,
  onError,
}: Props) {
  const { cart, addToCart, removeFromCart } = useDataStore(
    useShallow((s) => ({
      cart: s.cart,
      addToCart: s.addToCart,
      removeFromCart: s.removeFromCart,
    })),
  );
  const { includedVisualKeys, setIncludedVisualKeys, preferences, setPreferences } =
    useExportStore(
      useShallow((s) => ({
        includedVisualKeys: s.includedVisualKeys,
        setIncludedVisualKeys: s.setIncludedVisualKeys,
        preferences: s.preferences,
        setPreferences: s.setPreferences,
      })),
    );

  const [visMode, setVisMode] = React.useState<VisMode>("bivariate");
  const [selectedCol, setSelectedCol] = React.useState("");
  const [selectedCol2, setSelectedCol2] = React.useState("");
  const [chartType, setChartType] = React.useState<ChartType>("bar");
  const [bivChartType, setBivChartType] =
    React.useState<BivariateChartType>("scatter");
  const [colorOverride, setColorOverride] = React.useState<string>("");

  const top3pairs = allCorrPairs.slice(0, 3);

  const [addedFlash, setAddedFlash] = React.useState(false);

  const allCols = [
    ...cleaned.columns.filter((c) => c.type === "numeric"),
    ...cleaned.columns.filter((c) => c.type === "categorical"),
  ];

  // Pick the most analytically interesting default column (highest abs skewness, skip likely IDs)
  const defaultCol = useMemo(() => {
    const numCols = cleaned.columns.filter((c) => c.type === "numeric");
    if (numCols.length === 0) return allCols[0];
    let best = numCols[0];
    let bestScore = -1;
    for (const c of numCols) {
      const vals = cleaned.rows
        .map((r) => r[c.name])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));
      if (vals.length < 5) continue;
      // Skip likely sequential IDs (very low coefficient of variation or name contains 'id')
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const std = Math.sqrt(
        vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length,
      );
      const cv = mean !== 0 ? std / Math.abs(mean) : 0;
      const isLikelyId =
        c.name.toLowerCase().includes("id") ||
        (cv < 0.4 && vals.length > 50 && std / vals.length < 0.5);
      if (isLikelyId) continue;
      // Score by abs skewness (more interesting distributions)
      const n = vals.length;
      const skew =
        n > 2 ? vals.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n : 0;
      const score = Math.abs(skew) + cv * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }, [cleaned]);

  const col =
    allCols.find((c) => c.name === selectedCol) || defaultCol || allCols[0];
  const isNumeric = col?.type === "numeric";
  const numData = isNumeric
    ? cleaned.rows
        .map((r) => r[col.name])
        .filter((v): v is number => typeof v === "number" && !isNaN(v))
    : [];
  const [freqEntries, setFreqEntries] = useState<
    Array<{ value: string; count: number; pct: number }>
  >([]);
  useEffect(() => {
    if (!col || isNumeric) {
      setFreqEntries([]);
      return;
    }
    computeFrequency(cleaned.rows, col.name).then((ft) =>
      setFreqEntries(ft.entries),
    );
  }, [col, isNumeric, cleaned.rows]);
  const freqData = freqEntries;
  const availableTypes: ChartType[] = isNumeric
    ? ["bar", "line", "area", "box", "violin"]
    : ["pie", "catbar"];
  const effectiveType = availableTypes.includes(chartType)
    ? chartType
    : availableTypes[0];
  const colorIdx = col ? allCols.indexOf(col) % CHART_COLORS.length : 0;
  const color = CHART_COLORS[colorIdx];
  const activeColor = colorOverride || color;

  // Stats for the selected column
  const [colStats, setColStats] = useState<
    import("@/types").DescriptiveStats | null
  >(null);
  useEffect(() => {
    if (!col || !isNumeric || numData.length === 0) {
      setColStats(null);
      return;
    }
    computeDescriptive(cleaned.rows, col.name).then(setColStats);
  }, [col, isNumeric, cleaned.rows]);

  // Insight for the selected column
  const colInsight = useMemo(() => {
    if (!colStats) return null;
    const sk = Math.abs(colStats.skewness);
    if (sk > 2)
      return {
        level: "warning" as const,
        text: `Highly skewed (${colStats.skewness.toFixed(2)}) — consider log transform or non-parametric tests`,
      };
    if (sk > 1)
      return {
        level: "warning" as const,
        text: `Moderately skewed — consider non-parametric tests`,
      };
    const missingPct =
      ((cleaned.rows.length - colStats.count) / cleaned.rows.length) * 100;
    if (missingPct > 20)
      return {
        level: "warning" as const,
        text: `${missingPct.toFixed(0)}% missing values — check imputation strategy`,
      };
    if (colStats.std === 0)
      return {
        level: "info" as const,
        text: "Zero variance — this column is constant",
      };
    return null;
  }, [colStats, cleaned.rows.length]);

  // Bivariate
  const col2 = allCols.find((c) => c.name === selectedCol2) ?? allCols[1];
  const pairKind = (() => {
    if (!col || !col2) return null;
    if (col.type === "numeric" && col2.type === "numeric")
      return "num-num" as const;
    if (col.type === "numeric" && col2.type === "categorical")
      return "num-cat" as const;
    if (col.type === "categorical" && col2.type === "numeric")
      return "cat-num" as const;
    return "unsupported" as const;
  })();
  const effectiveBivType: BivariateChartType | "unsupported" =
    pairKind === "num-num"
      ? bivChartType
      : pairKind === "num-cat" || pairKind === "cat-num"
        ? "box"
        : "unsupported";

  const pairedScatter = (() => {
    if (pairKind !== "num-num") return { x: [] as number[], y: [] as number[] };
    const x: number[] = [],
      y: number[] = [];
    for (const r of cleaned.rows) {
      const vx = r[col.name],
        vy = r[col2.name];
      if (
        typeof vx === "number" &&
        !isNaN(vx) &&
        typeof vy === "number" &&
        !isNaN(vy)
      ) {
        x.push(vx);
        y.push(vy);
      }
    }
    return { x, y };
  })();

  const boxGroups = (() => {
    if (pairKind !== "num-cat" && pairKind !== "cat-num") return [];
    const catCol = pairKind === "num-cat" ? col2 : col;
    const numCol = pairKind === "num-cat" ? col : col2;
    if (!catCol || !numCol) return [];
    const groupMap = new Map<string, number[]>();
    for (const r of cleaned.rows) {
      const cat = String(r[catCol.name] ?? "");
      const num = r[numCol.name];
      if (typeof num !== "number" || isNaN(num)) continue;
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(num);
    }
    return [...groupMap.entries()].map(([label, values]) => ({
      label,
      values,
    }));
  })();

  const visualCartItem = React.useMemo(() => {
    if (!col) return null;
    if (visMode === "univariate") {
      return {
        id: `visual-${effectiveType}-${col.name}`,
        label: `${formatColumnLabel(col.name)} (${effectiveType})`,
      };
    }
    if (!col2) return null;
    if (effectiveBivType === "unsupported") return null;
    const ordered = [col.name, col2.name].sort((a, b) => a.localeCompare(b));
    return {
      id: `visual-${effectiveBivType}-${ordered[0]}-${ordered[1]}`,
      label: `${formatColumnLabel(col.name)} vs ${formatColumnLabel(col2.name)} (${effectiveBivType})`,
    };
  }, [col, col2, visMode, effectiveType, effectiveBivType]);

  const exportVisualKey = React.useMemo(() => {
    const chartTypeToPrefix: Record<string, string> = {
      histogram: "hist",
      bar: "bar",
      pie: "pie",
      scatter: "scatter",
      bubble: "scatter",
      contour: "scatter",
      violin: "box",
      box: "box",
      area: "hist",
      line: "hist",
    };
    if (!col) return null;
    if (visMode === "univariate") {
      const prefix = chartTypeToPrefix[effectiveType] ?? effectiveType;
      return `${prefix}:${col.name}`;
    }
    if (!col2 || effectiveBivType === "unsupported") return null;
    const baseType = effectiveBivType;
    if (col && col2) {
      const ordered = [col.name, col2.name].sort((a, b) => a.localeCompare(b));
      const prefix =
        baseType === "box" ? "gbox" : (chartTypeToPrefix[baseType] ?? baseType);
      return `${prefix}:${ordered[0]}__${ordered[1]}`;
    }
    return null;
  }, [col, col2, visMode, effectiveType, effectiveBivType]);

  const isCurrentVisualInCart =
    !!visualCartItem && cart.some((item) => item.id === visualCartItem.id);
  const isCurrentVisualInExport = !!exportVisualKey && includedVisualKeys.includes(exportVisualKey);

  if (!col) return null;

  return (
    <div className="analyse-tab-body">
      {/* Mode toggle */}
      <div className="vis-mode-toggle">
        <button
          className={`vis-mode-btn${visMode === "univariate" ? " active" : ""}`}
          onClick={() => setVisMode("univariate")}
        >
          Single column
        </button>
        <button
          className={`vis-mode-btn${visMode === "bivariate" ? " active" : ""}${!canAdvancedCharts ? " is-locked" : ""}`}
          onClick={() => {
            if (!canAdvancedCharts) {
              onError(
                "Bivariate charts (scatter, bubble, contour, box) are available on Member and Premium plans.",
              );
              return;
            }
            setVisMode("bivariate");
          }}
          disabled={!canAdvancedCharts}
        >
          Compare two columns
        </button>
      </div>

      {!canAdvancedCharts && (
        <p className="warning-msg">
          Advanced charts are locked on Free. Upgrade to Member or Premium to
          unlock scatter, bubble, contour, and box plots.
        </p>
      )}

      {/* Strongest relationships */}
      {visMode === "bivariate" && top3pairs.length > 0 && (
        <div className="strongest-pairs">
          <span className="sp-label">Strongest pairs:</span>
          {top3pairs.map((p) => (
            <button
              key={p.label}
              className="sp-chip"
              onClick={() => {
                setSelectedCol(p.colA);
                setSelectedCol2(p.colB);
              }}
            >
              {formatColumnLabel(p.colA)} & {formatColumnLabel(p.colB)}
              <span
                className={`sp-r${Math.abs(p.r) >= 0.7 ? " sp-r--high" : ""}`}
              >
                r={p.r.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="vis-chart-card">
        <div className="chart-controls">
          <div className="ctrl-group">
            <label>
              {visMode === "bivariate" ? "X axis / Primary" : "Column"}
            </label>
            <select
              value={col.name}
              onChange={(e) => {
                setSelectedCol(e.target.value);
                const next = allCols.find((c) => c.name === e.target.value);
                setChartType(next?.type === "categorical" ? "pie" : "bar");
                setBivChartType("scatter");
              }}
            >
              {computed.numericCols.length > 0 && (
                <optgroup label="Numeric">
                  {cleaned.columns
                    .filter((c) => c.type === "numeric")
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {computed.catCols.length > 0 && (
                <optgroup label="Categorical">
                  {cleaned.columns
                    .filter((c) => c.type === "categorical")
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {visMode === "univariate" && isNumeric && (
            <div className="ctrl-group">
              <label>Chart type</label>
              <select
                value={effectiveType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
              >
                <option value="bar">Histogram</option>
                <option value="line" disabled={!canAdvancedCharts}>
                  Distribution curve{!canAdvancedCharts ? " 🔒" : ""}
                </option>
                <option value="area">Area distribution</option>
                <option value="box">Box plot</option>
                <option value="violin" disabled={!canAdvancedCharts}>
                  Violin plot{!canAdvancedCharts ? " 🔒" : ""}
                </option>
              </select>
            </div>
          )}

          {canChartCustomization && (
            <div className="ctrl-group">
              <label>Color</label>
              <select
                value={activeColor}
                onChange={(e) => setColorOverride(e.target.value)}
              >
                {CHART_COLORS.map((paletteColor, idx) => (
                  <option key={paletteColor} value={paletteColor}>
                    {PALETTE_NAMES[idx] ?? `Color ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {visMode === "univariate" && !isNumeric && (
            <div className="ctrl-group">
              <label>Chart type</label>
              <select
                value={effectiveType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
              >
                <option value="pie">Pie</option>
                <option value="catbar">Category bar</option>
              </select>
            </div>
          )}

          {visMode === "bivariate" && (
            <div className="ctrl-group">
              <label>Y axis / Secondary</label>
              <select
                value={col2?.name ?? ""}
                onChange={(e) => setSelectedCol2(e.target.value)}
              >
                {computed.numericCols.length > 0 && (
                  <optgroup label="Numeric">
                    {cleaned.columns
                      .filter((c) => c.type === "numeric")
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {computed.catCols.length > 0 && (
                  <optgroup label="Categorical">
                    {cleaned.columns
                      .filter((c) => c.type === "categorical")
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {visMode === "bivariate" && pairKind === "num-num" && (
            <div className="ctrl-group">
              <label>Chart type</label>
              <select
                value={bivChartType}
                onChange={(e) =>
                  setBivChartType(e.target.value as BivariateChartType)
                }
              >
                <option value="scatter">Scatter</option>
                <option value="bubble">Bubble</option>
                <option value="contour">Density contour</option>
              </select>
            </div>
          )}

          {colInsight && (
            <div
              className={`vis-insight-pill vis-insight-pill--${colInsight.level}`}
            >
              <span className="vis-insight-icon">
                {colInsight.level === "warning" ? "⚠" : "ℹ"}
              </span>
              {colInsight.text}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="chart-body chart-body--full">
          {visMode === "univariate" && (
            <RenderSafeChart dataset={cleaned} chartType={effectiveType || "bar"} mapping={{ x: col.name }}>
              {effectiveType === "bar" && isNumeric && (
                <BarChart
                  data={numData}
                  label={col.name}
                  color={activeColor}
                  height={300}
                  hideLabel
                  subtitle={`${cleaned.rows.length} rows · ${cleaned.rows.length - numData.length} missing (${(((cleaned.rows.length - numData.length) / cleaned.rows.length) * 100).toFixed(1)}%)`}
                />
              )}
              {effectiveType === "pie" && !isNumeric && (
                <PieChart entries={freqData} label={col.name} />
              )}
              {effectiveType === "catbar" && !isNumeric && (
                <CategoryBarChart
                  entries={freqData}
                  label={col.name}
                  color={activeColor}
                  height={320}
                />
              )}
              {effectiveType === "line" && isNumeric && (
                <LineChart
                  data={numData}
                  label={col.name}
                  color={activeColor}
                  height={300}
                />
              )}
              {effectiveType === "area" && isNumeric && (
                <AreaChart
                  data={numData}
                  label={col.name}
                  color={activeColor}
                  height={300}
                />
              )}
              {effectiveType === "violin" && isNumeric && (
                <ViolinChart
                  data={numData}
                  label={col.name}
                  color={activeColor}
                  height={320}
                />
              )}
              {effectiveType === "box" && isNumeric && (
                <BoxPlot
                  groups={[{ label: col.name, values: numData }]}
                  yLabel={col.name}
                  xLabel=""
                  height={320}
                />
              )}
            </RenderSafeChart>
          )}
          {visMode === "bivariate" && (
            <RenderSafeChart 
              dataset={cleaned} 
              chartType={effectiveBivType || "scatter"} 
              mapping={{ x: col.name, y: col2?.name || "" }}
            >
              {effectiveBivType === "scatter" && (
                <ScatterChart
                  xData={pairedScatter.x}
                  yData={pairedScatter.y}
                  xLabel={col.name}
                  yLabel={col2!.name}
                  color={activeColor}
                  height={300}
                />
              )}
              {effectiveBivType === "bubble" && (
                <BubbleChart
                  xData={pairedScatter.x}
                  yData={pairedScatter.y}
                  xLabel={col.name}
                  yLabel={col2!.name}
                  color={activeColor}
                  height={320}
                />
              )}
              {effectiveBivType === "contour" && (
                <ContourChart
                  xData={pairedScatter.x}
                  yData={pairedScatter.y}
                  xLabel={col.name}
                  yLabel={col2!.name}
                  height={320}
                />
              )}
              {effectiveBivType === "box" && boxGroups.length > 0 && (
                <BoxPlot
                  groups={boxGroups}
                  yLabel={pairKind === "num-cat" ? col.name : col2!.name}
                  xLabel={pairKind === "num-cat" ? col2!.name : col.name}
                  height={300}
                />
              )}
              {effectiveBivType === "unsupported" && (
                <p className="empty-msg">
                  Select one numeric and one categorical column, or two numeric
                  columns.
                </p>
              )}
            </RenderSafeChart>
          )}
        </div>

        {/* Stats summary below chart (univariate numeric only) */}
        {visMode === "univariate" && colStats && (
          <div className="vis-stats-row">
            <div className="vis-stat">
              <span className="vis-stat-label">N</span>
              <span className="vis-stat-value">
                {colStats.count.toLocaleString()}
              </span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Mean</span>
              <span className="vis-stat-value">{colStats.mean.toFixed(2)}</span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Median</span>
              <span className="vis-stat-value">
                {colStats.median.toFixed(2)}
              </span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Std Dev</span>
              <span className="vis-stat-value">{colStats.std.toFixed(2)}</span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Min</span>
              <span className="vis-stat-value">{colStats.min}</span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Max</span>
              <span className="vis-stat-value">{colStats.max}</span>
            </div>
            <div className="vis-stat">
              <span className="vis-stat-label">Skewness</span>
              <span className="vis-stat-value">
                {colStats.skewness.toFixed(3)}
              </span>
            </div>
          </div>
        )}

        <div className="vis-chart-footer">
          {visualCartItem && (
            <button
              className={`btn-ghost btn-sm vis-cart-toggle${isCurrentVisualInExport || isCurrentVisualInCart ? " vis-cart-toggle--active" : ""}`}
              onClick={() => {
                if (!visualCartItem || !exportVisualKey) return;
                // Toggle new export store (single source) + keep cart in sync for legacy
                const inExport = includedVisualKeys.includes(exportVisualKey);
                if (inExport) {
                  setIncludedVisualKeys(
                    includedVisualKeys.filter((k) => k !== exportVisualKey),
                  );
                  if (isCurrentVisualInCart) removeFromCart(visualCartItem.id);
                  // also track color removal
                  const colors = { ...preferences.visualKeyColors };
                  delete colors[exportVisualKey];
                  setPreferences({ visualKeyColors: colors });
                  return;
                }
                setIncludedVisualKeys([...includedVisualKeys, exportVisualKey]);
                // color bookkeeping
                setPreferences({
                  visualKeyColors: {
                    ...preferences.visualKeyColors,
                    [exportVisualKey]: activeColor,
                  },
                  includeVisuals: true,
                });
                // legacy cart keep for backward compat during rollout
                if (!isCurrentVisualInCart)
                  addToCart({
                    id: visualCartItem.id,
                    type: "visual",
                    label: visualCartItem.label,
                    meta: {
                      visMode,
                      chartType:
                        visMode === "univariate"
                          ? effectiveType
                          : effectiveBivType,
                      colA: col.name,
                      colB: visMode === "bivariate" ? col2?.name : undefined,
                      color: activeColor,
                    },
                  });
                setAddedFlash(true);
                setTimeout(() => setAddedFlash(false), 1800);
              }}
            >
              {isCurrentVisualInExport || isCurrentVisualInCart
                ? "Remove from PDF Export"
                : "Add to PDF Export"}
            </button>
          )}
          {addedFlash && (
            <span className="vis-added-flash">Added to PDF Export</span>
          )}
        </div>
      </div>
    </div>
  );
}
