import { CheckItem } from "@/components/ExportPanel/HtmlPreview";
import type { ReportBuilderProps } from "./builderShared";

export function BuilderColumns({
  exportPreferences,
  setExportPreferences,
  cleaned,
  numericCols,
  categoricalCols,
}: ReportBuilderProps) {
  return (
    <div className="ep-card">
      <div className="ep-card-head">
        <span className="ep-card-icon">{"\uD83D\uDDC2\uFE0F"}</span>
        <h4>Columns</h4>
        <span className="ep-badge">
          {exportPreferences.includedColumns === null
            ? cleaned.columns.length
            : exportPreferences.includedColumns.length}{" "}
          / {cleaned.columns.length}
        </span>
      </div>
      <div className="ep-card-body">
        <div className="ep-vis-actions ep-vis-actions--compact">
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ includedColumns: null })}
          >
            All
          </button>
          <button
            className="ep-link-btn"
            onClick={() =>
              setExportPreferences({
                includedColumns: numericCols.map((c) => c.name),
              })
            }
          >
            Numeric only
          </button>
          <button
            className="ep-link-btn"
            onClick={() =>
              setExportPreferences({
                includedColumns: categoricalCols.map((c) => c.name),
              })
            }
          >
            Categorical only
          </button>
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ includedColumns: [] })}
          >
            None
          </button>
        </div>
        <div className="ep-col-list">
          {cleaned.columns.map((col) => {
            const included =
              exportPreferences.includedColumns === null ||
              exportPreferences.includedColumns.includes(col.name);
            return (
              <CheckItem
                key={col.name}
                label={col.name}
                desc={col.type}
                checked={included}
                onChange={(v) => {
                  const current =
                    exportPreferences.includedColumns ??
                    cleaned.columns.map((c) => c.name);
                  const next = v
                    ? [...current, col.name]
                    : current.filter((n) => n !== col.name);
                  setExportPreferences({
                    includedColumns:
                      next.length === cleaned.columns.length ? null : next,
                  });
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
