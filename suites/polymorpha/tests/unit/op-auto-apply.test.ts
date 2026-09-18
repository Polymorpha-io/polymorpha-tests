import { describe, it, expect, beforeEach } from "vitest";
import { stepToPython } from "@polymorpha/business-logic";
import { useDataStore } from "@/store/useDataStore";
import {
  defaultConfigForFamily,
  tryAutoApplyOpFamily,
} from "@/components/NotebookWorkbench/opDefaults";
import {
  buildVariables,
  fileFormat,
} from "@/components/NotebookWorkbench/variables";
import { parseNewCell } from "@/lib/newCellParse";
import type { Dataset, DataOperationStep, Row } from "@/types";

function dataset(fileName: string, rows: Row[], cols: string[]): Dataset {
  return {
    fileName,
    uploadedAt: new Date(0),
    columns: cols.map((name) => ({
      name,
      type: "unknown" as const,
      detectedType: "unknown" as const,
    })),
    rows,
  };
}

const COLS = [{ name: "age" }, { name: "city" }];
const FIRST: Row = { age: 30, city: "Lima" };

function seed() {
  useDataStore.setState({
    raw: dataset("df.csv", [FIRST, { age: 40, city: "Oslo" }], ["age", "city"]),
    rawHash: "test-hash",
    totalRowCount: 2,
    appliedSteps: [],
    pastSteps: [],
    futureSteps: [],
    computedHead: null,
    cleaned: null,
    combineExtras: [],
    historyEpoch: 0,
  } as unknown as Partial<ReturnType<typeof useDataStore.getState>>);
}

beforeEach(() => {
  seed();
});

describe("defaultConfigForFamily", () => {
  it("builds runnable sort/query/getDummies defaults that round-trip", () => {
    for (const family of ["sort", "query", "getDummies"]) {
      const config = defaultConfigForFamily(family, COLS, FIRST);
      expect(config, `${family} should have a default`).not.toBeNull();
      const code = stepToPython(config!).code;
      expect(parseNewCell(code, family).ok, `${family} must round-trip`).toBe(
        true,
      );
    }
  });

  it("returns null when manual config is needed", () => {
    expect(defaultConfigForFamily("merge", COLS, FIRST)).toBeNull();
    expect(defaultConfigForFamily("group", COLS, FIRST)).toBeNull();
    expect(defaultConfigForFamily("sort", [], FIRST)).toBeNull();
    expect(defaultConfigForFamily("query", COLS, null)).toBeNull();
    // Non-identifier columns are unsafe in a query expr.
    expect(
      defaultConfigForFamily("query", [{ name: "my col" }], {
        "my col": 1,
      }),
    ).toBeNull();
  });
});

describe("tryAutoApplyOpFamily", () => {
  it("applies sort on its own and grows the step log", () => {
    expect(tryAutoApplyOpFamily("sort")).toBe(true);
    const steps = useDataStore.getState().appliedSteps as DataOperationStep[];
    expect(steps).toHaveLength(1);
    expect(steps[0].config.type).toBe("sort");
  });

  it("falls back (false, no step) for merge", () => {
    expect(tryAutoApplyOpFamily("merge")).toBe(false);
    expect(useDataStore.getState().appliedSteps).toHaveLength(0);
  });
});

describe("fileFormat", () => {
  it("reads the extension, lowercased, or empty", () => {
    expect(fileFormat("sales.CSV")).toBe("csv");
    expect(fileFormat("data.parquet")).toBe("parquet");
    expect(fileFormat("noext")).toBe("");
  });

  it("tags every registry variable", () => {
    const vars = buildVariables({
      raw: dataset("df.csv", [FIRST], ["age", "city"]),
      combineExtras: [{ fileName: "extra.Parquet", rowCount: 5 }],
      computedHead: null,
      hasAppliedSteps: false,
      cleaned: null,
      totalRowCount: 1,
    });
    expect(vars.map((v) => v.format)).toEqual(["csv", "parquet"]);
  });
});
