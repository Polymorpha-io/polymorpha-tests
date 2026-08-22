import type { StatsResults } from "@/types";
import type { Column, Dataset, ExportPreferences } from "@/types";
import type { PDFFontFamily } from "@/types";
import type { CartItem } from "@/store/useDataStore";
import type { BuilderSection, VisualCandidate } from "@/components/ExportPanel/types";

export interface ReportBuilderProps {
  activeBuilderSection: BuilderSection;
  setActiveBuilderSection: (section: BuilderSection) => void;
  outputFormat: "pdf" | "docx";
  setOutputFormat: (format: "pdf" | "docx") => void;
  canExportDOCX: boolean;
  canExportVisualPDF: boolean;
  exportPreferences: ExportPreferences;
  setExportPreferences: (updates: Partial<ExportPreferences>) => void;
  cleaned: Dataset;
  numericCols: Column[];
  categoricalCols: Column[];
  descriptiveSelection: string[] | null;
  frequencySelection: string[] | null;
  visualCandidates: VisualCandidate[];
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  totalTests: number;
  results: StatsResults;
}

export function FormatToggle({
  outputFormat,
  setOutputFormat,
  canExportDOCX,
}: {
  outputFormat: ReportBuilderProps["outputFormat"];
  setOutputFormat: ReportBuilderProps["setOutputFormat"];
  canExportDOCX: boolean;
}) {
  return (
    <div className="ep-format-toggle">
      <span className="ep-format-label">Output format:</span>
      <button
        className={`ep-fmt-btn${outputFormat === "pdf" ? " ep-fmt-btn--active" : ""}`}
        onClick={() => setOutputFormat("pdf")}
      >
        PDF
      </button>
      <button
        className={`ep-fmt-btn${outputFormat === "docx" ? " ep-fmt-btn--active" : ""}${!canExportDOCX ? " (locked)" : ""}`}
        onClick={() => {
          if (!canExportDOCX) return;
          setOutputFormat("docx");
        }}
        disabled={!canExportDOCX}
      >
        DOCX{!canExportDOCX ? " (locked)" : ""}
      </button>
    </div>
  );
}

export function BuilderNav({
  activeBuilderSection,
  setActiveBuilderSection,
}: {
  activeBuilderSection: ReportBuilderProps["activeBuilderSection"];
  setActiveBuilderSection: ReportBuilderProps["setActiveBuilderSection"];
}) {
  return (
    <div className="ep-builder-nav" role="tablist" aria-label="Export sections">
      <button
        className={`ep-builder-nav-item${activeBuilderSection === "columns" ? " active" : ""}`}
        onClick={() => setActiveBuilderSection("columns")}
      >
        Columns
      </button>
      <button
        className={`ep-builder-nav-item${activeBuilderSection === "sections" ? " active" : ""}`}
        onClick={() => setActiveBuilderSection("sections")}
      >
        Sections
      </button>
      <button
        className={`ep-builder-nav-item${activeBuilderSection === "tests" ? " active" : ""}`}
        onClick={() => setActiveBuilderSection("tests")}
      >
        Tests
      </button>
      <button
        className={`ep-builder-nav-item${activeBuilderSection === "visuals" ? " active" : ""}`}
        onClick={() => setActiveBuilderSection("visuals")}
      >
        Visuals
      </button>
      <button
        className={`ep-builder-nav-item${activeBuilderSection === "layout" ? " active" : ""}`}
        onClick={() => setActiveBuilderSection("layout")}
      >
        PDF Layout
      </button>
    </div>
  );
}

export type { PDFFontFamily };
