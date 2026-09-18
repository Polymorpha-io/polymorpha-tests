import { describe, expect, it } from "vitest";
import {
  RECIPE_MAX_ENTRIES,
  appendRecipeEntry,
  shortHash,
} from "@/lib/recipe/recipe";
import type { RecipeEntry } from "@/lib/recipe/recipe";

function makeEntry(
  overrides: Partial<RecipeEntry> = {},
): Parameters<typeof appendRecipeEntry>[1] {
  return {
    action: "groupBy",
    params: { by: ["region"] },
    contentHash: "hash-a",
    ...overrides,
  };
}

describe("appendRecipeEntry", () => {
  it("starts a chain with null prevHash and generated id/ts", () => {
    const next = appendRecipeEntry([], makeEntry());
    expect(next).toHaveLength(1);
    expect(next[0].prevHash).toBeNull();
    expect(next[0].id).toBeTruthy();
    expect(next[0].ts).toBeGreaterThan(0);
  });

  it("threads prevHash from the head and never mutates input", () => {
    const first = appendRecipeEntry([], makeEntry({ contentHash: "h1" }));
    const second = appendRecipeEntry(first, makeEntry({ contentHash: "h2" }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(second[1].prevHash).toBe("h1");
    expect(second[0]).toEqual(first[0]);
  });

  it("copies params so later caller mutation cannot rewrite history", () => {
    const params = { by: ["region"] };
    const next = appendRecipeEntry([], makeEntry({ params }));
    params.by.push("year");
    expect(next[0].params).toEqual({ by: ["region"] });
  });

  it("evicts oldest past the cap while keeping the hash reference", () => {
    let entries: RecipeEntry[] = [];
    for (let i = 0; i < RECIPE_MAX_ENTRIES + 5; i++) {
      entries = appendRecipeEntry(entries, makeEntry({ contentHash: `h${i}` }));
    }
    expect(entries).toHaveLength(RECIPE_MAX_ENTRIES);
    // Oldest kept is h5; its prevHash still points at evicted h4.
    expect(entries[0].contentHash).toBe("h5");
    expect(entries[0].prevHash).toBe("h4");
  });
});

describe("shortHash", () => {
  it("returns the first 8 characters", () => {
    expect(shortHash("a3f9c1e2b4d6")).toBe("a3f9c1e2");
  });
});
