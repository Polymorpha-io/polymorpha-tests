import type { Dispatch, SetStateAction } from "react";
import type { TTestType } from "@/types";
import type {
  ComputedStats,
  TestKey,
} from "@/components/AnalysePanel/analyseHelpers";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";

export interface TestConfigCardProps {
  activeTestKey: TestKey;
  computed: ComputedStats;
  categoricalCols: string[];
  corrMethod: "pearson" | "spearman";
  setCorrMethod: Dispatch<SetStateAction<"pearson" | "spearman">>;
  corrColA: string;
  setTestCol1: Dispatch<SetStateAction<string>>;
  corrColB: string;
  setTestCol2: Dispatch<SetStateAction<string>>;
  tType: TTestType;
  setTType: Dispatch<SetStateAction<TTestType>>;
  displayTCol1: string;
  setTCol1: Dispatch<SetStateAction<string>>;
  displayTCol2: string;
  setTCol2: Dispatch<SetStateAction<string>>;
  tMu: number;
  setTMu: Dispatch<SetStateAction<number>>;
  displayAnovaY: string;
  setAnovaY: Dispatch<SetStateAction<string>>;
  displayAnovaGroup: string;
  setAnovaGroup: Dispatch<SetStateAction<string>>;
  displayTwoWayY?: string;
  setTwoWayY?: Dispatch<SetStateAction<string>>;
  displayTwoWayGroupA?: string;
  setTwoWayGroupA?: Dispatch<SetStateAction<string>>;
  displayTwoWayGroupB?: string;
  setTwoWayGroupB?: Dispatch<SetStateAction<string>>;
  displayRegY: string;
  setRegY: Dispatch<SetStateAction<string>>;
  displayRegX: string[];
  setRegX: Dispatch<SetStateAction<string[]>>;
  displayVifCols: string[];
  setVifCols: Dispatch<SetStateAction<string[]>>;
  displayMwGroupCol: string;
  setMwGroupCol: Dispatch<SetStateAction<string>>;
  setMwG1: Dispatch<SetStateAction<string>>;
  setMwG2: Dispatch<SetStateAction<string>>;
  displayMwCol: string;
  setMwCol: Dispatch<SetStateAction<string>>;
  displayMwGroups: string[];
  displayMwG1: string;
  setMwG1Value: Dispatch<SetStateAction<string>>;
  displayMwG2: string;
  setMwG2Value: Dispatch<SetStateAction<string>>;
  displayKwGroup: string;
  setKwGroup: Dispatch<SetStateAction<string>>;
  displayKwCol: string;
  setKwCol: Dispatch<SetStateAction<string>>;
  displayChiCol1: string;
  setChiCol1: Dispatch<SetStateAction<string>>;
  displayChiCol2: string;
  setChiCol2: Dispatch<SetStateAction<string>>;
  displayFisherCol1: string;
  setFisherCol1: Dispatch<SetStateAction<string>>;
  displayFisherCol2: string;
  setFisherCol2: Dispatch<SetStateAction<string>>;
}

export function TestConfigCard(props: TestConfigCardProps) {
  const {
    activeTestKey,
    computed,
    categoricalCols,
    corrMethod,
    setCorrMethod,
    corrColA,
    setTestCol1,
    corrColB,
    setTestCol2,
    tType,
    setTType,
    displayTCol1,
    setTCol1,
    displayTCol2,
    setTCol2,
    tMu,
    setTMu,
    displayAnovaY,
    setAnovaY,
    displayAnovaGroup,
    setAnovaGroup,
    displayRegY,
    setRegY,
    displayRegX,
    setRegX,
    displayVifCols,
    setVifCols,
    displayMwGroupCol,
    setMwGroupCol,
    setMwG1,
    setMwG2,
    displayMwCol,
    setMwCol,
    displayMwGroups,
    displayMwG1,
    setMwG1Value,
    displayMwG2,
    setMwG2Value,
    displayKwGroup,
    setKwGroup,
    displayKwCol,
    setKwCol,
    displayChiCol1,
    setChiCol1,
    displayChiCol2,
    setChiCol2,
    displayFisherCol1,
    setFisherCol1,
    displayFisherCol2,
    setFisherCol2,
  } = props;

  const renderField = (
    label: string,
    control: React.ReactNode,
    className = "",
  ) => (
    <label className={`test-field${className ? ` ${className}` : ""}`}>
      <span className="test-field-label">{label}</span>
      {control}
    </label>
  );

  const wrapMethodVariables = (children: React.ReactNode, hint?: string) => (
    <div className="test-variable-block">
      <div className="test-variable-block-head">
        <p className="test-variable-block-kicker">Method variables</p>
        {hint && <p className="clean-hint-line">{hint}</p>}
      </div>
      {children}
    </div>
  );

  switch (activeTestKey) {
    case "correlation":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Correlation method",
            <select
              value={corrMethod}
              onChange={(e) =>
                setCorrMethod(e.target.value as "pearson" | "spearman")
              }
            >
              <option value="pearson">Pearson</option>
              <option value="spearman">Spearman</option>
            </select>,
          )}
          {renderField(
            "Numeric variable A",
            <select
              value={corrColA}
              onChange={(e) => setTestCol1(e.target.value)}
            >
              <option value="">Select numeric variable</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Numeric variable B",
            <select
              value={corrColB}
              onChange={(e) => setTestCol2(e.target.value)}
            >
              <option value="">Select numeric variable</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
            "test-field--span-2",
          )}
        </div>,
        "Choose the exact pair and correlation method for this result.",
      );
    case "tTest":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "t-test type",
            <select
              value={tType}
              onChange={(e) => setTType(e.target.value as TTestType)}
            >
              <option value="one-sample">One-sample</option>
              <option value="independent">Independent</option>
              <option value="paired">Paired</option>
            </select>,
          )}
          {renderField(
            "Primary numeric variable",
            <select
              value={displayTCol1}
              onChange={(e) => setTCol1(e.target.value)}
            >
              <option value="">Select numeric variable</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {tType !== "one-sample"
            ? renderField(
                "Comparison numeric variable",
                <select
                  value={displayTCol2}
                  onChange={(e) => setTCol2(e.target.value)}
                >
                  <option value="">Select comparison variable</option>
                  {computed.numericCols.map((c) => (
                    <option key={c} value={c}>
                      {formatColumnLabel(c)}
                    </option>
                  ))}
                </select>,
                "test-field--span-2",
              )
            : renderField(
                "Reference mean (mu)",
                <input
                  type="number"
                  value={tMu}
                  onChange={(e) => setTMu(Number(e.target.value))}
                  placeholder="Enter reference mean"
                />,
                "test-field--span-2",
              )}
        </div>,
        "Set the t-test mode first, then map the variables that belong to that mode.",
      );
    case "anova":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Response variable",
            <select
              value={displayAnovaY}
              onChange={(e) => setAnovaY(e.target.value)}
            >
              <option value="">Select numeric response</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Grouping factor",
            <select
              value={displayAnovaGroup}
              onChange={(e) => setAnovaGroup(e.target.value)}
            >
              <option value="">Select categorical factor</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "ANOVA needs one numeric response and one categorical grouping factor.",
      );
    case "regression":
      return wrapMethodVariables(
        <div className="test-controls test-controls--stack">
          {renderField(
            "Target variable",
            <select
              value={displayRegY}
              onChange={(e) => setRegY(e.target.value)}
            >
              <option value="">Select target variable</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Predictor variables",
            <div className="reg-predictor-picker">
              {computed.numericCols
                .filter((c) => c !== displayRegY)
                .map((c) => (
                  <label key={c} className="reg-predictor-option">
                    <input
                      type="checkbox"
                      checked={displayRegX.includes(c)}
                      onChange={(e) =>
                        setRegX(
                          e.target.checked
                            ? Array.from(new Set([...displayRegX, c]))
                            : displayRegX.filter((value) => value !== c),
                        )
                      }
                    />
                    <span>{formatColumnLabel(c)}</span>
                  </label>
                ))}
            </div>,
          )}
        </div>,
        "Pick one numeric target, then select one or more numeric predictors for the model.",
      );
    case "vif":
      return wrapMethodVariables(
        <div className="test-controls test-controls--stack">
          {renderField(
            "Predictor variables",
            <div className="reg-predictor-picker">
              {computed.numericCols.map((c) => (
                <label key={c} className="reg-predictor-option">
                  <input
                    type="checkbox"
                    checked={displayVifCols.includes(c)}
                    onChange={(e) =>
                      setVifCols(
                        e.target.checked
                          ? Array.from(new Set([...displayVifCols, c]))
                          : displayVifCols.filter((value) => value !== c),
                      )
                    }
                  />
                  <span>{formatColumnLabel(c)}</span>
                </label>
              ))}
            </div>,
          )}
        </div>,
        "Select 2 or more numeric predictors to check for multicollinearity (VIF > 5 = flagged).",
      );
    case "mannWhitney":
      return wrapMethodVariables(
        <>
          <div className="test-controls">
            {renderField(
              "Grouping column",
              <select
                value={displayMwGroupCol}
                onChange={(e) => {
                  setMwGroupCol(e.target.value);
                  setMwG1("");
                  setMwG2("");
                }}
              >
                <option value="">Select group column</option>
                {categoricalCols.map((c) => (
                  <option key={c} value={c}>
                    {formatColumnLabel(c)}
                  </option>
                ))}
              </select>,
            )}
            {renderField(
              "Numeric variable",
              <select
                value={displayMwCol}
                onChange={(e) => setMwCol(e.target.value)}
              >
                <option value="">Select numeric variable</option>
                {computed.numericCols.map((c) => (
                  <option key={c} value={c}>
                    {formatColumnLabel(c)}
                  </option>
                ))}
              </select>,
            )}
          </div>
          <div className="test-controls">
            {renderField(
              "Group 1",
              <select
                value={displayMwG1}
                onChange={(e) => setMwG1Value(e.target.value)}
              >
                <option value="">Select first group</option>
                {displayMwGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>,
            )}
            {renderField(
              "Group 2",
              <select
                value={displayMwG2}
                onChange={(e) => setMwG2Value(e.target.value)}
              >
                <option value="">Select second group</option>
                {displayMwGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>,
            )}
          </div>
        </>,
        "Map the grouping column first, then choose the exact two categories to compare.",
      );
    case "kruskal":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Grouping column",
            <select
              value={displayKwGroup}
              onChange={(e) => setKwGroup(e.target.value)}
            >
              <option value="">Select group column</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Numeric variable",
            <select
              value={displayKwCol}
              onChange={(e) => setKwCol(e.target.value)}
            >
              <option value="">Select numeric variable</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "Use one numeric outcome and one categorical grouping column with 3 or more groups.",
      );
    case "chiSquare":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Categorical variable A",
            <select
              value={displayChiCol1}
              onChange={(e) => setChiCol1(e.target.value)}
            >
              <option value="">Select categorical variable</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Categorical variable B",
            <select
              value={displayChiCol2}
              onChange={(e) => setChiCol2(e.target.value)}
            >
              <option value="">Select categorical variable</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "Choose the two categorical variables whose association you want to test.",
      );
    case "fisher":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Categorical variable A",
            <select
              value={displayFisherCol1}
              onChange={(e) => setFisherCol1(e.target.value)}
            >
              <option value="">Select categorical variable</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Categorical variable B",
            <select
              value={displayFisherCol2}
              onChange={(e) => setFisherCol2(e.target.value)}
            >
              <option value="">Select categorical variable</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "Both columns must have exactly 2 categories. For larger tables use chi-square.",
      );
    case "welchAnova":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Response variable",
            <select
              value={displayAnovaY}
              onChange={(e) => setAnovaY(e.target.value)}
            >
              <option value="">Select numeric response</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Grouping factor",
            <select
              value={displayAnovaGroup}
              onChange={(e) => setAnovaGroup(e.target.value)}
            >
              <option value="">Select categorical factor</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "Welch's ANOVA does not assume equal variances across groups. Use when Levene's test is significant.",
      );
    case "levene":
      return wrapMethodVariables(
        <div className="test-controls">
          {renderField(
            "Response variable",
            <select
              value={displayAnovaY}
              onChange={(e) => setAnovaY(e.target.value)}
            >
              <option value="">Select numeric response</option>
              {computed.numericCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
          {renderField(
            "Grouping factor",
            <select
              value={displayAnovaGroup}
              onChange={(e) => setAnovaGroup(e.target.value)}
            >
              <option value="">Select categorical factor</option>
              {categoricalCols.map((c) => (
                <option key={c} value={c}>
                  {formatColumnLabel(c)}
                </option>
              ))}
            </select>,
          )}
        </div>,
        "Tests whether groups have equal variances (homoscedasticity assumption). Non-significant p means equal variances.",
      );
  }
}
