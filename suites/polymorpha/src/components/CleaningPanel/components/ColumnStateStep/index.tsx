import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type ColumnStateStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
};

interface ColumnStateRow {
  name: string;
  detectedType: string;
  currentType: string;
  renameTo: string;
  missingStrategy: string;
  outlierMethod: string;
  scaleMethod: string;
  remove: boolean;
}

export function ColumnStateStep({ raw, cleaningConfig }: ColumnStateStepProps) {
  const effectiveType = (columnName: string) =>
    cleaningConfig.typeOverrides.find(
      (override) => override.columnName === columnName,
    )?.type ??
    raw.columns.find((column) => column.name === columnName)?.type ??
    "unknown";

  const currentColumnState: ColumnStateRow[] = raw.columns.map((column) => ({
    name: column.name,
    detectedType: column.detectedType,
    currentType: effectiveType(column.name),
    renameTo:
      cleaningConfig.renameColumns.find((rule) => rule.from === column.name)
        ?.to ?? column.name,
    missingStrategy: cleaningConfig.missing[column.name]?.strategy ?? "none",
    outlierMethod: cleaningConfig.outliers[column.name]?.method ?? "none",
    scaleMethod: cleaningConfig.scaling[column.name]?.method ?? "none",
    remove: cleaningConfig.removeColumns.includes(column.name),
  }));

  return (
    <div className="clean-step-panel">
      <h3>Column state</h3>
      <p className="clean-hint-line">
        Overview of all columns and their current processing configuration.
      </p>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Detected</th>
              <th>Current</th>
              <th>Rename</th>
              <th>Missing</th>
              <th>Outlier</th>
              <th>Scale</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {currentColumnState.map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.detectedType}</td>
                <td>{column.currentType}</td>
                <td>{column.renameTo}</td>
                <td>{column.missingStrategy}</td>
                <td>{column.outlierMethod}</td>
                <td>{column.scaleMethod}</td>
                <td>{column.remove ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
