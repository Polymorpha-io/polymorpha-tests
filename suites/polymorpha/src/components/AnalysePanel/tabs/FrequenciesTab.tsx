import { useState } from "react";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";

import type { Recommendation } from "@polymorpha/business-logic";

interface Props {
  computed: ComputedStats;
  recommendations?: Recommendation[];
}

export function FrequenciesTab({ computed, recommendations = [] }: Props) {
  const { frequencies } = computed;
  const mlRecs = recommendations.filter((r) => r.type === "ml");
  // Track expanded state per column
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (frequencies.length === 0) {
    return (
      <section className="analyse-section-card">
        <p className="empty-msg">No categorical columns detected.</p>
      </section>
    );
  }

  const totalUniqueValues = frequencies.reduce(
    (s, ft) => s + ft.entries.length,
    0,
  );
  const highCardinality = frequencies.filter((ft) => ft.entries.length > 50);

  return (
    <section className="analyse-section-card">
      <div className="freq-tabs">
        {frequencies.map((ft) => {
          const isExpanded = expanded[ft.column] ?? false;
          const displayEntries = isExpanded
            ? ft.entries
            : ft.entries.slice(0, 8);
          const maxCount = ft.entries.length > 0 ? ft.entries[0].count : 1;
          return (
            <div key={ft.column} className="freq-card">
              <div className="freq-card-header">
                <h3 className="freq-card-title">
                  {formatColumnLabel(ft.column)}
                </h3>
                <span className="freq-card-badge">
                  {ft.entries.length} unique
                </span>
              </div>
              <div className="freq-card-body">
                {displayEntries.map((e) => (
                  <div key={e.value} className="freq-row">
                    <span className="freq-row-label" title={String(e.value)}>
                      {e.value}
                    </span>
                    <div className="freq-row-bar-track">
                      <div
                        className="freq-row-bar-fill"
                        style={{ width: `${(e.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="freq-row-count">{e.count}</span>
                    <span className="freq-row-pct">{e.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              {ft.entries.length > 8 && (
                <button
                  className="btn-ghost btn-sm freq-card-toggle"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [ft.column]: !isExpanded,
                    }))
                  }
                >
                  {isExpanded
                    ? `Show less`
                    : `Show all ${ft.entries.length} values`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="insight-panel">
        <h4 className="insight-panel-title">Interpretation</h4>
        <ul className="insight-panel-list">
          {mlRecs.length > 0 ? (
            mlRecs.map((rec) => (
              <li key={rec.id}>
                <strong>{rec.reason}</strong> {rec.action}
              </li>
            ))
          ) : (
            <li>
              No extreme class imbalances (&gt;90% majority) detected in categorical
              columns.
            </li>
          )}
          <li>
            {frequencies.length} categorical column
            {frequencies.length > 1 ? "s" : ""} with{" "}
            {totalUniqueValues.toLocaleString()} total unique values across all
            columns.
          </li>
          {highCardinality.length > 0 && (
            <li>
              {highCardinality
                .map((ft) => formatColumnLabel(ft.column))
                .join(", ")}{" "}
              ha{highCardinality.length > 1 ? "ve" : "s"} high cardinality
              (&gt;50 unique values). Consider grouping rare categories before
              modelling.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
