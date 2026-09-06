import { describe, it, expect } from "vitest";
import {
  cleanCodeFor,
  cleanCodeAreas,
  cleaningConfigToPython,
} from "@polymorpha/business-logic";

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

describe("cleaningConfigToPython", () => {
  it("composes active sections, skips defaults", () => {
    const code = cleaningConfigToPython({
      missing: {
        age: { strategy: "median" },
        name: { strategy: "none" },
      },
      outliers: {
        price: { method: "iqr", action: "remove" },
      },
      duplicates: { enabled: true, subsetColumns: [] },
      removeColumns: ["tmp"],
      scaling: { age: { method: "zscore" } },
      encodings: { city: { type: "onehot" } },
      rowFilter: { enabled: true, column: "age", operator: "gte", value: "18" },
      mathTransforms: [{ column: "price", transform: "log" }],
      binRules: [],
      dateExtraction: [],
      derivedColumns: [],
      stringReplace: [],
      categoryMappings: [],
      lagLeadRules: [],
      interactionTerms: [],
    });
    expect(code).toContain("import pandas as pd");
    expect(code).toContain(".fillna(");
    expect(code).toContain("q1, q3");
    expect(code).toContain("drop_duplicates(");
    expect(code).toContain("drop(columns=");
    expect(code).toContain(".mean()");
    expect(code).toContain("get_dummies");
    expect(code).toContain(">= 18");
    expect(code).toContain("np.log(");
    expect(code).not.toContain('"name"');
  });

  it("empty config yields an honest comment", () => {
    expect(cleaningConfigToPython({}).split("\n")[0]).toMatch(
      /no cleaning steps/,
    );
  });
});
