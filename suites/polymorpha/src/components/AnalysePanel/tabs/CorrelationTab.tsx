import { useState } from "react";
import "./CorrelationTab.css";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import {
  formatColumnLabel,
  corrClass,
} from "@/components/AnalysePanel/analyseHelpers";
import {
  HeatmapChart,
  type CorrelationHeatmapPalette,
} from "@/components/Charts/HeatmapChart";

import type { Recommendation } from "@polymorpha/business-logic";

interface Props {
  computed: ComputedStats;
  canAdvancedCharts: boolean;
  recommendations?: Recommendation[];
}

export function CorrelationTab({
  computed,
  canAdvancedCharts,
  recommendations = [],
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const [palette, setPalette] = useState<CorrelationHeatmapPalette>("ocean");
  const { correlation } = computed;
  const corrRecs = recommendations.filter((r) =>
    String(r?.id ?? "").startsWith("rec_corr"),
  );

  if (!correlation) {
    const hasNumericPair = (computed.numericCols?.length ?? 0) >= 2;
    return (
      <div className="analyse-tab-body analyse-tab-body--compact">
        <section className="analyse-section-card">
          <p className="empty-msg">
            {hasNumericPair
              ? "Correlation data is being computed. If this persists, try refreshing or check that numeric columns contain finite values."
              : "Need at least 2 numeric columns."}
          </p>
          {hasNumericPair && (
            <p
              className="empty-msg"
              style={{ fontSize: "0.8125rem", marginTop: 6 }}
            >
              Detected numeric columns:{" "}
              {computed.numericCols
                .map((c) => formatColumnLabel(c))
                .join(", ") || "none"}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="analyse-tab-body analyse-tab-body--compact">
      <section className="analyse-section-card">
        {canAdvancedCharts ? (
          <>
            <div className="corr-palette-row">
              <label
                htmlFor="corr-heatmap-palette"
                className="corr-palette-label"
              >
                Heatmap palette
              </label>
              <select
                id="corr-heatmap-palette"
                className="corr-palette-select"
                value={palette}
                onChange={(e) =>
                  setPalette(e.target.value as CorrelationHeatmapPalette)
                }
              >
                <option value="ocean">Ocean</option>
                <option value="sunset">Sunset</option>
                <option value="forest">Forest</option>
                <option value="slate">Slate</option>
              </select>
            </div>
            <div className="corr-heatmap-large">
              <HeatmapChart matrix={correlation} palette={palette} />
            </div>
            <div className="corr-table-toggle-row">
              <button
                className="btn-ghost btn-sm corr-table-toggle"
                onClick={() => setShowTable((v) => !v)}
              >
                {showTable ? "-- Hide table" : "+ Show numeric table"}
              </button>
            </div>
          </>
        ) : (
          <p className="warning-msg">
            Heatmap view is available on Member and Premium plans. Numeric
            correlation table is still available below.
          </p>
        )}
        {(showTable || !canAdvancedCharts) && (
          <div className="table-scroll corr-table-scroll">
            <table className="stats-table corr-table">
              <thead>
                <tr>
                  <th></th>
                  {correlation.columns.map((c) => (
                    <th key={c}>{formatColumnLabel(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation.values.map((row, i) => (
                  <tr key={correlation.columns[i]}>
                    <th>{formatColumnLabel(correlation.columns[i])}</th>
                    {row.map((v, j) => {
                      const isDiag = i === j;
                      const isFiniteNum =
                        typeof v === "number" && Number.isFinite(v);
                      return (
                        <td
                          key={j}
                          className={
                            isDiag ? "" : corrClass(isFiniteNum ? v : NaN)
                          }
                          style={{
                            background: isDiag ? "var(--primary)" : undefined,
                            color: isDiag ? "#fff" : undefined,
                            fontWeight: isDiag ? 800 : 400,
                          }}
                        >
                          {isFiniteNum ? v.toFixed(3) : "N/A"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="insight-panel">
          <h4 className="insight-panel-title">Interpretation</h4>
          <ul className="insight-panel-list">
            {corrRecs.length > 0 ? (
              corrRecs.map((rec) => (
                <li key={String(rec.id)}>
                  <strong>{String(rec.reason ?? "")}</strong>{" "}
                  {String(rec.action ?? "")}
                </li>
              ))
            ) : (
              <li>
                No extreme multicollinearity concerns (all pairwise correlations
                evaluated are below the critical threshold).
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
