import { BuilderColumns } from "./builder/BuilderColumns";
import { BuilderLayout } from "./builder/BuilderLayout";
import { BuilderNav, FormatToggle } from "./builder/builderShared";
import type { ReportBuilderProps } from "./builder/builderShared";
import { BuilderSections } from "./builder/BuilderSections";
import { BuilderTests } from "./builder/BuilderTests";
import { BuilderVisuals } from "./builder/BuilderVisuals";

export function ReportBuilder(props: ReportBuilderProps) {
  const {
    activeBuilderSection,
    setActiveBuilderSection,
    outputFormat,
    setOutputFormat,
    canExportDOCX,
  } = props;
  return (
    <div className="ep-customizer">
      <div className="ep-customizer-header">
        <h3>Report Builder</h3>
        <p>
          Toggle sections on or off to create the perfect report for your needs.
        </p>
        <FormatToggle
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          canExportDOCX={canExportDOCX}
        />
      </div>

      <div className="ep-builder-layout">
        <BuilderNav
          activeBuilderSection={activeBuilderSection}
          setActiveBuilderSection={setActiveBuilderSection}
        />
        <div className="ep-builder-content">
          {/* Columns */}
          {activeBuilderSection === "columns" && <BuilderColumns {...props} />}

          {/* Sections */}
          {activeBuilderSection === "sections" && (
            <BuilderSections {...props} />
          )}

          {/* Statistical Tests */}
          {activeBuilderSection === "tests" && <BuilderTests {...props} />}

          {/* Visuals */}
          {activeBuilderSection === "visuals" && <BuilderVisuals {...props} />}

          {/* PDF Layout */}
          {activeBuilderSection === "layout" && <BuilderLayout {...props} />}
        </div>
      </div>
    </div>
  );
}
