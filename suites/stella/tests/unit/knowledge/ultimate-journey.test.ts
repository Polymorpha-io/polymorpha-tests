/**
 * Ultimate-journey leg — Stella knowledge plane over the journey dataset.
 *
 * Mirrors suites/polymorpha/tests/e2e/ultimate-journey.spec.ts Stage S: the
 * same dirty-like shape the E2E journey uploads (numerics salary/age +
 * categorical treatment, with missing) must enter the single semantic
 * retrieval plane as dataset_profile + one column_semantic vector per
 * column (G25), retrievable via KnowledgeService.search (G26).
 *
 * Uses the library injection path (setInput) — the G26-correct caller
 * contract — so the test pins the stella library, not app store wiring.
 * Retrieval asserts use kind/column filters with an empty query so they
 * exercise the consumer boundary deterministically without depending on
 * embedding-model downloads.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { knowledgeStore } from "@/knowledge/KnowledgeStore";
import { datasetKnowledgeProvider } from "@/knowledge/providers/DatasetKnowledgeProvider";
import { knowledgeService } from "@/knowledge/KnowledgeService";

interface JourneyRow {
  salary: number | null;
  age: number;
  treatment: string;
}

function makeJourneyRows(): JourneyRow[] {
  const treatments = ["DrugA", "DrugB", "Control"];
  return Array.from({ length: 40 }, (_, i) => ({
    salary: i % 10 === 0 ? null : 30000 + i * 1000 + (i % 7),
    age: 20 + (i % 45),
    treatment: treatments[i % treatments.length],
  }));
}

function injectJourneyFrame(uploadId: string) {
  datasetKnowledgeProvider.setInput({
    ragDatasets: new Map(),
    activeUploadId: uploadId,
    dataState: {
      raw: {
        rows: makeJourneyRows(),
        columns: [
          { name: "salary", type: "numeric" },
          { name: "age", type: "numeric" },
          { name: "treatment", type: "categorical" },
        ],
        fileName: "dirty_10k.csv",
      },
      uploadId,
      objective: null,
    },
  });
}

function injectDoneProfile(uploadId: string, hash: string) {
  const perColumn = [
    {
      name: "salary",
      type: "numeric",
      detectedType: "numeric",
      unique: 36,
      cardinalityRatio: 0.9,
      missing: 4,
      missingPct: 10,
      mean: 49500,
      median: 49000,
      std: 11500,
      skewness: 0.1,
    },
    {
      name: "age",
      type: "numeric",
      detectedType: "numeric",
      unique: 40,
      cardinalityRatio: 1,
      missing: 0,
      missingPct: 0,
      mean: 39.5,
      median: 39.5,
      std: 12,
      skewness: 0,
    },
  ];
  const map = new Map();
  map.set(uploadId, {
    profile: {
      dataset: {
        rows: 40,
        cols: 3,
        format: "csv",
        columnCountByType: { numeric: 2, categorical: 1 },
        duplicateRows: 0,
        duplicatePct: 0,
        emptyRows: 0,
        emptyCols: 0,
        constantCols: [],
      },
      perColumn,
      missing: null,
      duplicate: null,
      quality: null,
    },
    status: {
      dataset: "done",
      perColumn: "done",
      missing: "done",
      duplicate: "done",
      quality: "done",
    },
    isProfiling: false,
    hash,
  });
  datasetKnowledgeProvider.setInput({
    ragDatasets: map as never,
    activeUploadId: uploadId,
    dataState: {
      raw: {
        rows: makeJourneyRows(),
        columns: [
          { name: "salary", type: "numeric" },
          { name: "age", type: "numeric" },
          { name: "treatment", type: "categorical" },
        ],
        fileName: "dirty_10k.csv",
      },
      uploadId,
      objective: null,
    },
  });
}

beforeEach(async () => {
  datasetKnowledgeProvider.setInput(null);
  await knowledgeStore.clear().catch(() => {});
});

describe("Ultimate journey — knowledge plane over journey dataset (G25/G26)", () => {
  it("header-only journey frame yields one column vector per column, nulls tolerated", async () => {
    const ws = "ws-journey";
    injectJourneyFrame("up-journey");

    const recs = await datasetKnowledgeProvider.provide(ws);
    const colRecs = recs.filter((r) => r.kind === "column_semantic");
    expect(colRecs.map((r) => r.provenance.columns?.[0]).sort()).toEqual([
      "age",
      "salary",
      "treatment",
    ]);
  });

  it("completed rag profile upgrades the salary column vector with its mean", async () => {
    const ws = "ws-journey-profile";
    injectDoneProfile("up-journey-profile", "hjourneyprofile");

    const recs = await datasetKnowledgeProvider.provide(ws);
    await knowledgeStore.putMany(recs);
    const salaryRec = recs.find(
      (r) =>
        r.kind === "column_semantic" &&
        r.provenance.columns?.includes("salary"),
    );
    expect(salaryRec).toBeDefined();
    expect(salaryRec!.metadata.profileStatus).toBe("complete");
    expect(salaryRec!.text).toContain("49500");
  });

  it("search retrieves journey column + profile via kind/column filters (G26 boundary)", async () => {
    const ws = "ws-journey-search";
    injectDoneProfile("up-journey-search", "hjourneysearch");

    const recs = await datasetKnowledgeProvider.provide(ws);
    await knowledgeStore.putMany(recs);

    const colRes = await knowledgeService.search("", {
      workspaceId: ws,
      limit: 5,
      kinds: ["column_semantic"],
      column: "salary",
    } as never);
    expect(
      colRes.some(
        (r) =>
          r.record.kind === "column_semantic" &&
          r.record.provenance.columns?.includes("salary"),
      ),
    ).toBe(true);

    const dsRes = await knowledgeService.search("", {
      workspaceId: ws,
      limit: 5,
      kinds: ["dataset_profile"],
    } as never);
    expect(dsRes.length).toBeGreaterThanOrEqual(1);
  });
});
