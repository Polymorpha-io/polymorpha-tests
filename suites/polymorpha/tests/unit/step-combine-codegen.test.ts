import { describe, it, expect } from "vitest";
import { stepToPython, pythonToStep } from "@polymorpha/business-logic";

/** Right-operand binding for the combine templates: the canonical
 *  `df`/`other` pair previously had nothing binding `other` at runtime —
 *  pasted merge cells NameError'd. The op records the picked operand
 *  (kernel var alias or loaded file) and the template emits the binding. */
describe("combine templates: right-operand binding", () => {
  it("aliases a picked kernel frame in the merge template", () => {
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightVarName: "df_cxbrfdubpbtq9rqomlhr_modified",
      rightDatasetName: "df_cxbrfdubpbtq9rqomlhr_modified",
    } as never);
    expect(code).toContain("other = df_cxbrfdubpbtq9rqomlhr_modified");
    expect(code).toContain(
      'df = pd.merge(df, other, left_on="id", right_on="id", how="inner")',
    );
    // The binding executes in the cell prologue; the canonical statement is
    // byte-identical so the codec still recognizes the family.
  });

  it("re-reads a picked file in the merge template", () => {
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightDatasetName: "churn.csv",
    } as never);
    expect(code).toContain('other = pd.read_csv("churn.csv")');
  });

  it("keeps the runtime comment when no operand is recorded (backward compat)", () => {
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
    } as never);
    expect(code).toContain("# 'other' is the second dataset at runtime");
    expect(code).not.toContain("read_csv");
  });

  it("round-trips a merge cell with a kernel-var binding", () => {
    const code = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightVarName: "df2",
      rightDatasetName: "df2",
    } as never).code;
    const parsed = pythonToStep(code, { type: "merge" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config["rightVarName"]).toBe("df2");
      expect(parsed.config["rightDatasetName"]).toBeUndefined();
      // Regenerating from the parsed config is stable.
      expect(stepToPython(parsed.config as never).code).toBe(code);
    }
  });

  it("round-trips a merge cell with a file binding", () => {
    const code = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightDatasetName: "churn.csv",
    } as never).code;
    const parsed = pythonToStep(code, { type: "merge" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config["rightDatasetName"]).toBe("churn.csv");
      expect(parsed.config["rightVarName"]).toBeUndefined();
    }
  });

  it("binds join (right) and concat/append (other) operands", () => {
    const join = stepToPython({
      type: "join",
      on: "id",
      how: "inner",
      rightVarName: "df2",
    } as never).code;
    expect(join).toContain("right = df2");
    const concat = stepToPython({
      type: "concat",
      axis: 0,
      rightDatasetName: "more.csv",
    } as never).code;
    expect(concat).toContain('other = pd.read_csv("more.csv")');
    const append = stepToPython({
      type: "append",
      rightVarName: "df2",
    } as never).code;
    expect(append).toContain("other = df2");
  });

  it("never emits an unvalidated identifier as an alias", () => {
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightVarName: "os.system('rm')",
      rightDatasetName: "safe.csv",
    } as never);
    // Invalid identifier falls back to the recorded file binding.
    expect(code).toContain('other = pd.read_csv("safe.csv")');
  });
});
