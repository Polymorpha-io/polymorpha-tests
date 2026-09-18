import { describe, expect, it } from "vitest";
import {
  compareBranches,
  createBranch,
  evictBranches,
  forkBranch,
  renameBranch,
  touchBranch,
} from "@/lib/recipe/branches";
import type { DataOperationStepConfig } from "@/types/operations";

function step(type: string): DataOperationStepConfig {
  return { type } as unknown as DataOperationStepConfig;
}

describe("createBranch", () => {
  it("normalizes names and defaults empty collections", () => {
    const b = createBranch({ name: "  main  clean " });
    expect(b.name).toBe("main clean");
    expect(b.steps).toEqual([]);
    expect(b.recipe).toEqual([]);
    expect(b.createdFromHash).toBeNull();
    expect(b.id).toBeTruthy();
  });

  it("rejects empty names with an inline error, never a silent default", () => {
    expect(() => createBranch({ name: "   " })).toThrow(
      "Branch name cannot be empty.",
    );
  });
});

describe("forkBranch", () => {
  it("copies steps and recipe independently and chains the hash", () => {
    const source = createBranch({
      name: "main",
      steps: [step("query")],
      recipe: [
        {
          id: "r1",
          action: "query",
          params: {},
          contentHash: "h1",
          prevHash: null,
          ts: 1,
        },
      ],
    });
    const fork = forkBranch(source, "experiment");
    expect(fork.id).not.toBe(source.id);
    expect(fork.createdFromHash).toBe("h1");
    fork.steps.push(step("sort"));
    expect(source.steps).toHaveLength(1);
  });
});

describe("renameBranch and touchBranch", () => {
  it("renames without touching steps and bumps updatedAt", () => {
    const b = createBranch({ name: "a", updatedAt: 1000 });
    const renamed = renameBranch(b, "b");
    expect(renamed.name).toBe("b");
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(b.updatedAt);
    expect(b.name).toBe("a");
  });

  it("touchBranch replaces collections by copy", () => {
    const b = createBranch({ name: "a", steps: [step("query")] });
    const touched = touchBranch(b, { steps: [step("sort")] });
    expect(touched.steps.map((s) => s.type)).toEqual(["sort"]);
    expect(b.steps.map((s) => s.type)).toEqual(["query"]);
  });
});

describe("compareBranches", () => {
  it("reports step deltas and asymmetric action sets", () => {
    const a = createBranch({ name: "a", steps: [step("query"), step("sort")] });
    const b = createBranch({
      name: "b",
      steps: [step("query"), step("group")],
    });
    const diff = compareBranches(a, b);
    expect(diff.stepCountDelta).toBe(0);
    expect(diff.onlyInA).toEqual(["sort"]);
    expect(diff.onlyInB).toEqual(["group"]);
  });
});

describe("evictBranches", () => {
  function branch(id: string, updatedAt: number) {
    return createBranch({ name: id, id, updatedAt });
  }

  it("keeps newest up to the cap and never evicts the active branch", () => {
    const branches = [
      branch("active-old", 1),
      branch("b", 2),
      branch("c", 3),
      branch("d", 4),
    ];
    const kept = evictBranches(branches, 2, "active-old");
    expect(kept.map((b) => b.id).sort()).toEqual(["active-old", "d"]);
  });

  it("returns a copy when under the cap", () => {
    const branches = [branch("a", 1)];
    const kept = evictBranches(branches, 5, null);
    expect(kept).toEqual(branches);
    expect(kept).not.toBe(branches);
  });
});
