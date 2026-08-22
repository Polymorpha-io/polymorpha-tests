import React from "react";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import {
  formatColumnLabel,
  skewClass,
} from "@/components/AnalysePanel/analyseHelpers";
import { testNormality, type NormalityMethod } from "@/lib/stats/normality";
import { useDataStore } from "@/store/useDataStore";
import type { NormalityResult } from "@/types";
import type { Recommendation } from "@polymorpha/business-logic";

interface Props {
  computed: ComputedStats;
  recommendations?: Recommendation[];
}

function shapeDescription(skew: number, kurtosis: number): string {
  const absSkew = Math.abs(skew);
  let shape: string;
  if (absSkew < 0.5) shape = "approximately symmetric";
  else if (absSkew < 1)
    shape = skew > 0 ? "moderately right-skewed" : "moderately left-skewed";
  else shape = skew > 0 ? "highly right-skewed" : "highly left-skewed";

  if (kurtosis > 3) shape += ", leptokurtic (heavy tails)";
  else if (kurtosis < -1) shape += ", platykurtic (light tails)";
  else shape += ", mesokurtic";

  return shape;
}

export function NormalityTab({ computed, recommendations = [] }: Props) {
  const cleaned = useDataStore((s) => s.cleaned);
  const [method, setMethod] = React.useState<NormalityMethod>("auto");
  const skewRecs = recommendations.filter((r) =>
    String(r?.id ?? "").startsWith("rec_skew"),
  );
  const [zoomedCol, setZoomedCol] = React.useState<string | null>(null);
  const [overrideNormality, setOverrideNormality] = React.useState<
    NormalityResult[] | null
  >(null);

  React.useEffect(() => {
    if (!cleaned || method === "auto") {
      setOverrideNormality(null);
      return;
    }
    let cancelled = false;
    Promise.all(
      computed.numericCols.map((col) =>
        testNormality(cleaned.rows, col, method),
      ),
    )
      .then((results) => {
        if (!cancelled) setOverrideNormality(results);
      })
      .catch(() => {
        if (!cancelled) setOverrideNormality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cleaned, method, computed.numericCols]);

  const normality: NormalityResult[] = overrideNormality ?? computed.normality;

  const nonNormal = normality.filter((n) => !n.isNormal);
  const zoomedItem = zoomedCol
    ? normality.find((n) => n.column === zoomedCol)
    : null;

  return (
    <section className="analyse-section-card">
      <div className="normality-method-bar">
        <label className="normality-method-label">Test method</label>
        <select
          className="normality-method-select"
          value={method}
          onChange={(e) => setMethod(e.target.value as NormalityMethod)}
        >
          <option value="auto">Auto (best for sample size)</option>
          <option value="shapiro-wilk">Shapiro-Wilk (parametric)</option>
          <option value="lilliefors">Lilliefors (non-parametric)</option>
        </select>
      </div>
      <div className="table-scroll">
        <p className="normality-test-note">
          Test used:{" "}
          {normality.length > 0 &&
          normality.every((n) => String(n.test) === String(normality[0].test))
            ? String(normality[0].test)
            : "Mixed (Shapiro-Wilk / Lilliefors)"}
        </p>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Statistic</th>
              <th>p-value</th>
              <th>Skewness</th>
              <th>Kurtosis</th>
              <th>Normal?</th>
            </tr>
          </thead>
          <tbody>
            {normality.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-msg">
                  No normality data. Numeric columns may be missing or
                  computation pending.
                </td>
              </tr>
            ) : (
              normality.map((n) => {
                const colLabel = String(n.column ?? "unknown");
                const statFinite =
                  typeof n.statistic === "number" &&
                  Number.isFinite(n.statistic);
                const pFinite =
                  typeof n.pValue === "number" && Number.isFinite(n.pValue);
                const skewFinite =
                  typeof n.skewness === "number" && Number.isFinite(n.skewness);
                const kurtFinite =
                  typeof n.kurtosis === "number" && Number.isFinite(n.kurtosis);
                return (
                  <tr key={colLabel}>
                    <td>{formatColumnLabel(colLabel)}</td>
                    <td>{statFinite ? n.statistic.toFixed(4) : "N/A"}</td>
                    <td>{pFinite ? n.pValue.toFixed(4) : "N/A"}</td>
                    <td className={skewFinite ? skewClass(n.skewness) : ""}>
                      {skewFinite ? n.skewness.toFixed(3) : "N/A"}
                    </td>
                    <td className={kurtFinite ? skewClass(n.kurtosis) : ""}>
                      {kurtFinite ? n.kurtosis.toFixed(3) : "N/A"}
                    </td>
                    <td className={n.isNormal ? "normal-yes" : "normal-no"}>
                      {n.isNormal ? "Yes" : "No"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Gaussian overlay histograms */}
      <div className="normality-charts">
        {normality
          .filter((n) => n.histogram)
          .map((n, idx) => {
            const h = n.histogram!;
            const maxCount = Math.max(...h.counts, 1);
            const nBins = h.counts.length;
            const svgW = 220;
            const svgH = 100;
            const barW = svgW / nBins;
            const gaussPts: string[] = [];
            for (let i = 0; i <= 40; i++) {
              const x =
                h.binEdges[0] + (i / 40) * (h.binEdges[nBins] - h.binEdges[0]);
              const z = (x - h.mean) / (h.std || 1);
              const pdf =
                Math.exp(-0.5 * z * z) /
                ((h.std || 1) * Math.sqrt(2 * Math.PI));
              const totalArea =
                h.counts.reduce((a: number, b: number) => a + b, 0) *
                ((h.binEdges[nBins] - h.binEdges[0]) / nBins);
              const yPx = svgH - ((pdf * totalArea) / maxCount) * svgH;
              gaussPts.push(`${(i / 40) * svgW},${Math.max(0, yPx)}`);
            }
            const NORMALITY_COLORS = [
              "#3b82f6",
              "#8b5cf6",
              "#06b6d4",
              "#f59e0b",
              "#10b981",
              "#ec4899",
              "#6366f1",
              "#14b8a6",
            ];
            return (
              <div
                key={n.column}
                className="normality-chart-card"
                onClick={() => setZoomedCol(n.column)}
                title="Click to enlarge"
                style={
                  {
                    "--norm-color":
                      NORMALITY_COLORS[idx % NORMALITY_COLORS.length],
                  } as React.CSSProperties
                }
              >
                <span className="normality-chart-label">
                  {formatColumnLabel(n.column)}
                </span>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="normality-svg">
                  {h.counts.map((c: number, i: number) => (
                    <rect
                      key={i}
                      x={i * barW}
                      y={svgH - (c / maxCount) * svgH}
                      width={barW - 1}
                      height={(c / maxCount) * svgH}
                      fill="var(--norm-color, var(--primary))"
                      opacity="0.4"
                      rx="2"
                    />
                  ))}
                  <polyline
                    points={gaussPts.join(" ")}
                    fill="none"
                    stroke="var(--destructive)"
                    strokeWidth="1.5"
                  />
                </svg>
                <span
                  className={`normality-verdict ${n.isNormal ? "normal-yes" : "normal-no"}`}
                >
                  {n.isNormal ? "Normal" : "Non-normal"}
                </span>
              </div>
            );
          })}
      </div>

      <div className="insight-panel">
        <h4 className="insight-panel-title">Interpretation</h4>
        <ul className="insight-panel-list">
          {skewRecs.length > 0 ? (
            skewRecs.map((rec) => (
              <li key={String(rec.id)}>
                <strong>{String(rec.reason ?? "")}</strong>{" "}
                {String(rec.action ?? "")}
              </li>
            ))
          ) : (
            <li>
              No extreme skewness detected. Distributions appear reasonably
              symmetric, making parametric tests more viable.
            </li>
          )}
          <li>
            {nonNormal.length} of {normality.length} numeric column
            {normality.length !== 1 ? "s are" : " is"} non-normal (p &lt; 0.05)
            according to formal testing.
          </li>
          {nonNormal.length > 0 && (
            <li>
              For non-normal variables, use rank-based alternatives:
              Mann-Whitney U instead of t-test, Kruskal-Wallis instead of ANOVA,
              and Spearman instead of Pearson correlation.
            </li>
          )}
        </ul>
      </div>

      {/* Zoom modal */}
      {zoomedItem &&
        zoomedItem.histogram &&
        (() => {
          const h = zoomedItem.histogram!;
          const maxCount = Math.max(...h.counts, 1);
          const nBins = h.counts.length;
          const svgW = 600;
          const svgH = 300;
          const barW = svgW / nBins;
          const gaussPts: string[] = [];
          for (let i = 0; i <= 80; i++) {
            const x =
              h.binEdges[0] + (i / 80) * (h.binEdges[nBins] - h.binEdges[0]);
            const z = (x - h.mean) / (h.std || 1);
            const pdf =
              Math.exp(-0.5 * z * z) / ((h.std || 1) * Math.sqrt(2 * Math.PI));
            const totalArea =
              h.counts.reduce((a: number, b: number) => a + b, 0) *
              ((h.binEdges[nBins] - h.binEdges[0]) / nBins);
            const yPx = svgH - ((pdf * totalArea) / maxCount) * svgH;
            gaussPts.push(`${(i / 80) * svgW},${Math.max(0, yPx)}`);
          }
          const NORMALITY_COLORS = [
            "#3b82f6",
            "#8b5cf6",
            "#06b6d4",
            "#f59e0b",
            "#10b981",
            "#ec4899",
            "#6366f1",
            "#14b8a6",
          ];
          const zoomedIdx = normality.findIndex(
            (n) => n.column === zoomedItem.column,
          );
          const zoomColor =
            NORMALITY_COLORS[
              (zoomedIdx >= 0 ? zoomedIdx : 0) % NORMALITY_COLORS.length
            ];
          return (
            <div
              className="normality-zoom-backdrop"
              onClick={() => setZoomedCol(null)}
            >
              <div
                className="normality-zoom-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="normality-zoom-head">
                  <h3>
                    {formatColumnLabel(String(zoomedItem.column ?? "unknown"))}{" "}
                    Normality Check
                  </h3>
                  <button
                    className="modal-close-icon"
                    aria-label="Close normality details"
                    onClick={() => setZoomedCol(null)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="normality-zoom-svg"
                >
                  {h.counts.map((c: number, i: number) => (
                    <rect
                      key={i}
                      x={i * barW}
                      y={svgH - (c / maxCount) * svgH}
                      width={barW - 1}
                      height={(c / maxCount) * svgH}
                      fill={zoomColor}
                      opacity="0.5"
                      rx="2"
                    />
                  ))}
                  <polyline
                    points={gaussPts.join(" ")}
                    fill="none"
                    stroke="var(--destructive)"
                    strokeWidth="2.5"
                  />
                </svg>
                <div className="normality-zoom-stats">
                  <span>
                    <strong>Test:</strong>{" "}
                    {String(zoomedItem.test ?? "Unknown")}
                  </span>
                  <span>
                    <strong>Statistic:</strong>{" "}
                    {typeof zoomedItem.statistic === "number" &&
                    Number.isFinite(zoomedItem.statistic)
                      ? zoomedItem.statistic.toFixed(4)
                      : "N/A"}
                  </span>
                  <span>
                    <strong>p-value:</strong>{" "}
                    {typeof zoomedItem.pValue === "number" &&
                    Number.isFinite(zoomedItem.pValue)
                      ? zoomedItem.pValue.toFixed(4)
                      : "N/A"}
                  </span>
                  <span>
                    <strong>Skewness:</strong>{" "}
                    {typeof zoomedItem.skewness === "number" &&
                    Number.isFinite(zoomedItem.skewness)
                      ? zoomedItem.skewness.toFixed(3)
                      : "N/A"}
                  </span>
                  <span>
                    <strong>Kurtosis:</strong>{" "}
                    {typeof zoomedItem.kurtosis === "number" &&
                    Number.isFinite(zoomedItem.kurtosis)
                      ? zoomedItem.kurtosis.toFixed(3)
                      : "N/A"}
                  </span>
                  <span
                    className={zoomedItem.isNormal ? "normal-yes" : "normal-no"}
                  >
                    <strong>
                      {zoomedItem.isNormal ? "Normal" : "Non-normal"}
                    </strong>
                  </span>
                </div>
                <p className="normality-zoom-shape">
                  {shapeDescription(zoomedItem.skewness, zoomedItem.kurtosis)}
                </p>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
