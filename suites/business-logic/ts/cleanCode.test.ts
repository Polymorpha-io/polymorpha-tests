import { describe, it, expect } from "vitest";
import { cleanCodeFor, cleanCodeAreas } from "@polymorpha/business-logic";

/**
 * [POLY-CELLS] Golden tests for the cleaning reference map.
 * Law: every area renders pandas for complete fields; incomplete fields
 * and unknown areas degrade to honest comments.
 */

describe("cleanCodeFor", () => {
  it("covers the cleaning area inventory", () => {
    for (const a of [
      "missing",
      "missingIndicator",
      "outlier",
      "scaling",
      "encoding",
      "dedupe",
      "sampling",
      "stringClean",
      "typeConvert",
      "rowFilter",
      "categoryMap",
      "math",
      "bin",
      "dateExtract",
      "derived",
      "lagLead",
      "interaction",
      "bucket",
      "columns",
    ]) {
      expect(cleanCodeAreas(), `missing builder: ${a}`).toContain(a);
    }
  });

  it("representative snippets contain their canonical calls", () => {
    expect(
      cleanCodeFor("missing", { column: "a", strategy: "median" }).code,
    ).toContain(".fillna(");
    expect(
      cleanCodeFor("missing", { column: "a", strategy: "drop" }).code,
    ).toContain("dropna(");
    expect(
      cleanCodeFor("outlier", { column: "a", method: "iqr", action: "remove" })
        .code,
    ).toContain("q1, q3");
    expect(
      cleanCodeFor("scaling", { column: "a", method: "zscore" }).code,
    ).toContain(".mean()");
    expect(
      cleanCodeFor("encoding", { column: "a", type: "onehot" }).code,
    ).toContain("get_dummies");
    expect(cleanCodeFor("dedupe", {}).code).toContain("drop_duplicates(");
    expect(
      cleanCodeFor("rowFilter", { column: "a", operator: "gt", value: 3 }).code,
    ).toContain("df = df[");
    expect(
      cleanCodeFor("rowFilter", {
        column: "a",
        operator: "in",
        values: ["x"],
      }).code,
    ).toContain(".isin(");
    expect(cleanCodeFor("math", { column: "a", fn: "log" }).code).toContain(
      "np.log(",
    );
    expect(cleanCodeFor("bucket", { column: "a", n: 5 }).code).toContain(
      '"Other"',
    );
  });

  it("incomplete fields and unknown areas degrade honestly", () => {
    expect(cleanCodeFor("missing", {}).code).toContain(
      "no standalone snippet for 'missing'",
    );
    expect(cleanCodeFor("bogus-area", {}).code).toContain(
      "no standalone snippet for 'bogus-area'",
    );
  });
});
