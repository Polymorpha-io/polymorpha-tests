import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import { formatColumnLabel, skewClass } from "@/components/AnalysePanel/analyseHelpers";

import type { Recommendation } from "@polymorpha/business-logic";

interface Props {
  computed: ComputedStats;
  recommendations?: Recommendation[];
  loading?: boolean;
  offline?: boolean;
}

export function DescriptiveTab({
  computed,
  recommendations = [],
  loading = false,
  offline = false,
}: Props) {
  const { descriptive } = computed;

  const cleaningRecs = recommendations.filter((r) => r.type === "cleaning");
  const testRecs = recommendations.filter((r) => r.type === "test");
  const mlRecs = recommendations.filter((r) => r.type === "ml");
  const hasAnyRecs = recommendations.length > 0;

  // Group recommendations by action to avoid repetitive lists
  const groupRecommendations = (recs: Recommendation[]) => {
    const grouped = new Map<string, Recommendation[]>();
    for (const r of recs) {
      if (!grouped.has(r.action)) {
        grouped.set(r.action, []);
      }
      grouped.get(r.action)!.push(r);
    }
    return Array.from(grouped.entries());
  };

  const summarizeReason = (recs: Recommendation[]) => {
    if (recs.length === 1) return recs[0].reason;

    const firstReason = recs[0].reason.toLowerCase();
    if (firstReason.includes("outlier")) {
      return `${recs.length} columns have significant outliers.`;
    }
    if (firstReason.includes("skew")) {
      return `${recs.length} columns are highly skewed.`;
    }
    if (firstReason.includes("missing")) {
      return `${recs.length} columns have significant missing data.`;
    }
    if (
      firstReason.includes("comparing") ||
      firstReason.includes("variables") ||
      firstReason.includes("numeric") ||
      firstReason.includes("categorical")
    ) {
      return `${recs.length} column combinations qualify for this test.`;
    }
    return `${recs.length} items share this trait.`;
  };

  const groupedCleaning = groupRecommendations(cleaningRecs);
  const groupedTest = groupRecommendations(testRecs);

  return (
    <section className="analyse-section-card">
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>N</th>
              <th>Missing %</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Std Dev</th>
              <th>Min</th>
              <th>Max</th>
              <th>Q1</th>
              <th>Q3</th>
              <th>Skewness</th>
              <th>Kurtosis</th>
            </tr>
          </thead>
          <tbody>
            {descriptive.map((d) => (
              <tr key={d.column}>
                <td>{formatColumnLabel(d.column)}</td>
                <td>{d.count}</td>
                <td>
                  {isNaN(d.missingPct) ? "N/A" : `${d.missingPct.toFixed(1)}%`}
                </td>
                <td>{isNaN(d.mean) ? "N/A" : d.mean.toFixed(3)}</td>
                <td>{isNaN(d.median) ? "N/A" : d.median.toFixed(3)}</td>
                <td>{isNaN(d.std) ? "N/A" : d.std.toFixed(3)}</td>
                <td>{isNaN(d.min) ? "N/A" : d.min}</td>
                <td>{isNaN(d.max) ? "N/A" : d.max}</td>
                <td>{isNaN(d.q1) ? "N/A" : d.q1.toFixed(3)}</td>
                <td>{isNaN(d.q3) ? "N/A" : d.q3.toFixed(3)}</td>
                <td className={skewClass(d.skewness)}>
                  {isNaN(d.skewness) ? "N/A" : d.skewness.toFixed(3)}
                </td>
                <td className={skewClass(d.kurtosis)}>
                  {isNaN(d.kurtosis) ? "N/A" : d.kurtosis.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insight panel */}
      <div className="insight-panel">
        <h4 className="insight-panel-title">Interpretation</h4>
        {loading ? (
          <p className="insight-panel-loading">Computing diagnostics from server…</p>
        ) : offline ? (
          <p className="insight-panel-offline">
            Limited diagnostics (offline) — only basic missing-value checks
            available.
          </p>
        ) : !hasAnyRecs ? (
          <p className="insight-panel-clean">
            No data quality issues detected — all columns look clean.
          </p>
        ) : (
          <ul className="insight-panel-list">
            {groupedCleaning.map(([action, recs]) => (
              <li key={`cleaning-${action}`}>
                <strong>{summarizeReason(recs)}</strong> — {action}
              </li>
            ))}
            {groupedTest.map(([action, recs]) => (
              <li key={`test-${action}`}>
                <strong>{summarizeReason(recs)}</strong> — {action}
              </li>
            ))}
            {mlRecs.map((rec) => (
              <li key={rec.id}>
                <strong>{rec.action}</strong> — {rec.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
