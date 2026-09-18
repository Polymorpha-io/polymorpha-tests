import { describe, expect, it } from "vitest";
import { getAffectedColumns } from "@/lib/affectedColumns";
import type { DataOperationStepConfig } from "@/types";

describe("getAffectedColumns", () => {
  it("returns the target column for single-column ops (price example)", () => {
    expect(
      getAffectedColumns({
        type: "apply",
        column: "price",
        func: "x * 2",
      } as never),
    ).toEqual(["price"]);
    expect(
      getAffectedColumns({
        type: "assign",
        column: "total",
        expr: "a",
      } as never),
    ).toEqual(["total"]);
    expect(getAffectedColumns({ type: "sort", by: "price" } as never)).toEqual([
      "price",
    ]);
  });

  it("prefers the new name for renames and date outputs", () => {
    expect(
      getAffectedColumns({
        type: "rename",
        column: "price",
        newName: "cost",
      } as DataOperationStepConfig),
    ).toEqual(["cost", "price"]);
    expect(
      getAffectedColumns({
        type: "dateDiff",
        startCol: "a",
        endCol: "b",
        newColumn: "days",
      } as never),
    ).toEqual(["days", "a", "b"]);
  });

  it("returns keys for merge/join and groups for group-by", () => {
    expect(
      getAffectedColumns({
        type: "merge",
        on: "id",
        leftKey: "id",
        rightKey: "id",
      } as never),
    ).toEqual(["id"]);
    expect(getAffectedColumns({ type: "join", on: "id" } as never)).toEqual([
      "id",
    ]);
    expect(
      getAffectedColumns({
        type: "group",
        groupByCols: ["region"],
        aggregations: [{ newColumn: "n", operation: "count" }],
      } as never),
    ).toEqual(["n", "region"]);
  });

  it("returns [] for row-only ops and unknown shapes (never throws)", () => {
    expect(getAffectedColumns({ type: "concat", axis: 0 } as never)).toEqual(
      [],
    );
    expect(getAffectedColumns({ type: "query", expr: "x" } as never)).toEqual(
      [],
    );
    expect(getAffectedColumns(null)).toEqual([]);
    expect(getAffectedColumns({} as never)).toEqual([]);
  });
});
