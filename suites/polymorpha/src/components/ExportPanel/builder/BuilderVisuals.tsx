import type { ReportBuilderProps } from "./builderShared";

export function BuilderVisuals({
  exportPreferences,
  setExportPreferences,
  canExportVisualPDF,
  visualCandidates,
  cart,
  removeFromCart,
}: ReportBuilderProps) {
  return (
    <div className="ep-card ep-card--accent">
      <div className="ep-card-head">
        <span className="ep-card-icon">{"\uD83C\uDFA8"}</span>
        <h4>Visual Charts</h4>
        {!canExportVisualPDF && (
          <span className="export-premium-badge">Premium</span>
        )}
      </div>
      <div className="ep-card-body">
        {!canExportVisualPDF ? (
          <p className="ep-locked-msg">
            Visual charts in PDF are locked. Upgrade to Premium.
          </p>
        ) : (
          <>
            <p className="ep-vis-hint">
              Visuals added from Analyse &gt; Visualise will be included
              automatically. Go to Analyse and tick "Add to PDF Export" on any
              chart to include it here.
            </p>
            <div className="ep-vis-list">
              {visualCandidates.length === 0 ? (
                <p className="ep-vis-empty">
                  No visuals added yet. Go to Analyse &gt; Visualise and add
                  charts to your export.
                </p>
              ) : (
                visualCandidates.map((candidate) => {
                  return (
                    <label key={candidate.key} className="ep-vis-item">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={(e) => {
                          if (e.target.checked) {
                            return;
                          }
                          // Remove from cart so the sync effect doesn't re-add it
                          const cartVisual = cart.find(
                            (item) =>
                              item.type === "visual" &&
                              (() => {
                                const chartType =
                                  typeof item.meta?.chartType === "string"
                                    ? item.meta.chartType
                                    : "hist";
                                const colA =
                                  typeof item.meta?.colA === "string"
                                    ? item.meta.colA
                                    : "";
                                const colB =
                                  typeof item.meta?.colB === "string"
                                    ? item.meta.colB
                                    : "";
                                const visMode =
                                  typeof item.meta?.visMode === "string"
                                    ? item.meta.visMode
                                    : "univariate";
                                const prefixMap: Record<string, string> = {
                                  histogram: "hist",
                                  box: "box",
                                  bar: "bar",
                                  pie: "pie",
                                  scatter: "scatter",
                                  bubble: "scatter",
                                  contour: "scatter",
                                  violin: "box",
                                  heatmap: "heatmap",
                                  area: "hist",
                                  line: "hist",
                                };
                                let key: string;
                                if (colB && visMode === "bivariate") {
                                  const prefix =
                                    chartType === "box"
                                      ? "gbox"
                                      : (prefixMap[chartType] ?? chartType);
                                  const ordered = [colA, colB].sort((a, b) =>
                                    a.localeCompare(b),
                                  );
                                  key = `${prefix}:${ordered[0]}__${ordered[1]}`;
                                } else {
                                  key = `${prefixMap[chartType] ?? chartType}:${colA}`;
                                }
                                return key === candidate.key;
                              })(),
                          );
                          if (cartVisual) removeFromCart(cartVisual.id);
                          const nextKeys =
                            exportPreferences.includedVisualKeys.filter(
                              (key) => key !== candidate.key,
                            );
                          const nextVisualKeyColors = {
                            ...exportPreferences.visualKeyColors,
                          };
                          delete nextVisualKeyColors[candidate.key];
                          setExportPreferences({
                            includedVisualKeys: nextKeys,
                            visualKeyColors: nextVisualKeyColors,
                            includeVisuals:
                              nextKeys.length > 0
                                ? exportPreferences.includeVisuals
                                : false,
                          });
                        }}
                      />
                      <span
                        className="ep-vis-item-color"
                        style={{ backgroundColor: candidate.color }}
                        aria-hidden="true"
                      />
                      <span>{candidate.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
