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

  it("emits concat kwargs outside the frame list (pre-existing bug fixed)", () => {
    const { code } = stepToPython({
      type: "concat",
      axis: 0,
      join: "inner",
      ignoreIndex: true,
      rightVarName: "df2",
    } as never);
    expect(code).toContain(
      'df = pd.concat([df, other], axis=0, join="inner", ignore_index=True)',
    );
  });
});

describe("combine templates: left-operand choice (POLY-NB-OPERANDS)", () => {
  it("rebinds df to a chosen kernel frame before the canonical merge", () => {
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      leftVarName: "out",
      rightDatasetName: "churn.csv",
    } as never);
    // Right binding first, then the left rebinding, then the canonical
    // statement (byte-stable).
    expect(code).toBe(
      "# join source: unknown source\n" +
        'other = pd.read_csv("churn.csv")\n' +
        "df = out\n" +
        'df = pd.merge(df, other, left_on="id", right_on="id", how="inner")',
    );
  });

  it("snapshots the original df before rebinding when right IS df (swap)", () => {
    // Left = out, right = the active frame itself: `other = df` must alias
    // the OLD df — a left-first order would collapse both operands to out.
    const { code } = stepToPython({
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "left",
      leftVarName: "out",
      rightVarName: "df",
    } as never);
    const otherLine = code.indexOf("other = df");
    const rebindLine = code.indexOf("df = out");
    expect(otherLine).toBeGreaterThanOrEqual(0);
    expect(rebindLine).toBeGreaterThan(otherLine);
    expect(code).toContain(
      'df = pd.merge(df, other, left_on="id", right_on="id", how="left")',
    );
  });

  it("re-reads a chosen left file", () => {
    const { code } = stepToPython({
      type: "concat",
      axis: 0,
      leftDatasetName: "a.csv",
      rightVarName: "df2",
    } as never);
    expect(code).toBe(
      'other = df2\ndf = pd.read_csv("a.csv")\ndf = pd.concat([df, other], axis=0)',
    );
  });

  it("skips the rebinding when the chosen left is df itself", () => {
    const base = {
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightVarName: "df2",
    } as never;
    const withDfLeft = stepToPython({
      ...base,
      leftVarName: "df",
    } as never).code;
    expect(withDfLeft).toBe(stepToPython(base).code);
  });

  it("emits byte-identical code when no left operand is recorded (backward compat)", () => {
    const legacy = {
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      rightDatasetName: "x.csv",
    } as never;
    // Old configs (no left fields at all) must produce exactly the
    // pre-left-choice emission.
    expect(stepToPython(legacy).code).toBe(
      "# join source: unknown source\n" +
        'other = pd.read_csv("x.csv")\n' +
        'df = pd.merge(df, other, left_on="id", right_on="id", how="inner")',
    );
  });

  it("round-trips a merge cell with a left kernel-var binding", () => {
    const config = {
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      leftVarName: "out",
      rightVarName: "df2",
      rightDatasetName: "df2",
    } as never;
    const { code } = stepToPython(config);
    const parsed = pythonToStep(code, config);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config["leftVarName"]).toBe("out");
      expect(parsed.config["leftDatasetName"]).toBeUndefined();
      expect(parsed.config["rightVarName"]).toBe("df2");
      // Regenerating from the parsed config is byte-stable.
      expect(stepToPython(parsed.config as never).code).toBe(code);
    }
  });

  it("round-trips a merge cell with a left file binding", () => {
    const config = {
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      leftDatasetName: "a.csv",
      rightDatasetName: "b.csv",
    } as never;
    const { code } = stepToPython(config);
    const parsed = pythonToStep(code, config);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config["leftDatasetName"]).toBe("a.csv");
      expect(parsed.config["leftVarName"]).toBeUndefined();
      expect(stepToPython(parsed.config as never).code).toBe(code);
    }
  });

  it("recovers a hand-edited left/right binding swap", () => {
    // A user reordering the two binding lines still parses fully.
    const canonical =
      'df = pd.merge(df, other, left_on="id", right_on="id", how="inner")';
    const swapped = `df = out\nother = df2\n${canonical}`;
    const parsed = pythonToStep(swapped, {
      type: "merge",
      leftOn: "id",
      rightOn: "id",
      how: "inner",
      leftVarName: "stale",
    } as never);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.config["leftVarName"]).toBe("out");
      expect(parsed.config["rightVarName"]).toBe("df2");
    }
  });

  it("binds the left operand in join and append templates", () => {
    const join = stepToPython({
      type: "join",
      on: "id",
      how: "outer",
      leftVarName: "out",
      rightVarName: "df2",
    } as never).code;
    expect(join).toBe(
      'right = df2\ndf = out\ndf = df.merge(right, on="id", how="outer", suffixes=("_x", "_y"))',
    );
    const append = stepToPython({
      type: "append",
      leftDatasetName: "a.csv",
      rightVarName: "df2",
    } as never).code;
    expect(append).toBe(
      '# join source: unknown source\nother = df2\ndf = pd.read_csv("a.csv")\ndf = pd.concat([df, other], ignore_index=True)',
    );
  });
});
