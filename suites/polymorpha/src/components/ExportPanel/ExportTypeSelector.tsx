import type { ExportType } from "./types";

interface ExportTypeSelectorProps {
  selectedType: ExportType;
  setSelectedType: (type: ExportType) => void;
  generating: boolean;
}

export function ExportTypeSelector(props: ExportTypeSelectorProps) {
  const { selectedType, setSelectedType, generating } = props;
  return (
    <div className="ep-type-selector">
      <h3>Choose Export Type</h3>
      <div className="ep-type-grid">
        <button
          className={`ep-type-card${selectedType === "basic" ? " ep-type-card--active" : ""}`}
          onClick={() => setSelectedType("basic")}
          disabled={generating}
        >
          <span className="ep-type-icon">{"\uD83D\uDCCB"}</span>
          <span className="ep-type-copy">
            <span className="ep-type-label">Basic Summary</span>
            <span className="ep-type-desc">Quick overview, descriptive only</span>
          </span>
        </button>
        <button
          className={`ep-type-card${selectedType === "statistical" ? " ep-type-card--active" : ""}`}
          onClick={() => setSelectedType("statistical")}
          disabled={generating}
        >
          <span className="ep-type-icon">{"\uD83D\uDCCA"}</span>
          <span className="ep-type-copy">
            <span className="ep-type-label">Text Report</span>
            <span className="ep-type-desc">Tables and statistics only</span>
          </span>
        </button>
        <button
          className={`ep-type-card${selectedType === "premium" ? " ep-type-card--active" : ""}`}
          onClick={() => setSelectedType("premium")}
          disabled={generating}
        >
          <span className="ep-type-icon">{"\uD83D\uDCC4"}</span>
          <span className="ep-type-copy">
            <span className="ep-type-label">Full Report</span>
            <span className="ep-type-desc">Complete analysis with visuals</span>
          </span>
        </button>
        <button
          className={`ep-type-card${selectedType === "excel" ? " ep-type-card--active" : ""}`}
          onClick={() => setSelectedType("excel")}
          disabled={generating}
        >
          <span className="ep-type-icon">{"\uD83D\uDCD7"}</span>
          <span className="ep-type-copy">
            <span className="ep-type-label">Excel Workbook</span>
            <span className="ep-type-desc">Data + stats in 3 tabs</span>
          </span>
        </button>
        <button
          className={`ep-type-card${selectedType === "csv" ? " ep-type-card--active" : ""}`}
          onClick={() => setSelectedType("csv")}
          disabled={generating}
        >
          <span className="ep-type-icon">{"\uD83D\uDCCB"}</span>
          <span className="ep-type-copy">
            <span className="ep-type-label">Cleaned CSV</span>
            <span className="ep-type-desc">Ready-to-share dataset</span>
          </span>
        </button>
      </div>
    </div>
  );
}
