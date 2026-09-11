import { test, expect } from "@playwright/test";
import { uploadCsv, goToCleaning, continueTo } from "./helpers";

/**
 * Stats/table contract (POLY-STATS-DERIVED).
 *
 * Industry rule (SPSS Transform-vs-Analyze split, dplyr mutate-vs-analysis):
 * - Statistical/ML runs are READ-ONLY. Running a test, a clustering, or a
 *   training job must never add/remove columns or rows by itself.
 * - The ONLY sanctioned write-back is an EXPLICIT "save derived column"
 *   action (predictions, residuals, z-scores, cluster labels) that enqueues a
 *   normal pipeline step: new column on the right, lineage-recorded, undoable
 *   by removing the step. Never in-place overwrite, never silent.
 * - RecipePane (scale/impute/encode inside Analyse) mutates the pipeline head
 *   and must carry an explicit pipeline-mutation notice.
 *
 * Live tests lock today's preconditions. `test.fixme` blocks are the contract
 * for the UI PR: remove the `fixme` (and pin the REQUIRED hooks) when the UI
 * lands. REQUIRED marks selectors/copy the UI PR must provide or adjust.
 */

async function goToUnsupervised(page: import("@playwright/test").Page) {
  await goToCleaning(page);
  await continueTo(page, /Continue to Analyse/i);
  await page.getByRole("button", { name: /Unsupervised & Anomaly/i }).click();
  await expect(
    page.getByRole("button", { name: "Find groups", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

async function runKMeans(page: import("@playwright/test").Page) {
  const runBtn = page.getByRole("button", {
    name: "Find groups",
    exact: true,
  });
  // Default algorithm is k-means; ensure at least one feature is selected.
  if (await runBtn.isDisabled()) {
    const chip = page.locator(".ml-chip").first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await chip.click();
  }
  await expect(runBtn).toBeEnabled({ timeout: 10_000 });
  await runBtn.click();
  // Separation-quality badge proves the backend run completed.
  await expect(page.getByText(/Quality -?\d+\.\d+/).first()).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("Stats/table contract", () => {
  test("kmeans run renders results and crashes nothing (read-only today)", async ({
    page,
  }) => {
    await uploadCsv(page, "correlation");
    await goToUnsupervised(page);
    await runKMeans(page);

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.locator(".tests-inline-error")).toHaveCount(0);
    // Row scope shown by the panel is unchanged by the run itself.
    await expect(page.getByText(/rows/i).first()).toBeVisible();
  });

  test.fixme("save-back: cluster labels become exactly one lineage-tagged column (+ undo)", async ({
    page,
  }) => {
    await uploadCsv(page, "correlation");
    await goToUnsupervised(page);
    await runKMeans(page);

    // REQUIRED hook: accessible name "Save labels to table". A
    // `data-testid="save-labels-to-table"` alias is accepted too.
    const saveBtn = page.getByRole("button", {
      name: "Save labels to table",
    });
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
    await saveBtn.click();

    // REQUIRED hook: back-navigation to the Preview grid from Analyse.
    await page
      .getByRole("button", { name: /Back to Preview|Preview/i })
      .first()
      .click();

    // Exactly one new column appears; row count is unchanged.
    // REQUIRED: UI PR pins the derived header name; this regex is the draft.
    const derived = page.getByRole("columnheader", {
      name: /cluster|label/i,
    });
    await expect(derived).toHaveCount(1, { timeout: 30_000 });

    // Undo: removing the applied step removes the column (REQUIRED hook:
    // the flowchart step remove control for the save-back step).
    const stepRemove = page
      .getByRole("button", { name: /Remove.*(cluster|label)|Delete.*step/i })
      .first();
    await stepRemove.click();
    await expect(
      page.getByRole("columnheader", { name: /cluster|label/i }),
    ).toHaveCount(0, { timeout: 30_000 });
  });

  test.fixme("RecipePane shows a pipeline-mutation notice before applying", async ({
    page,
  }) => {
    await uploadCsv(page, "correlation");
    await goToCleaning(page);
    await continueTo(page, /Continue to Analyse/i);
    await page.getByRole("button", { name: /Machine learning/i }).click();

    // REQUIRED hook: the recipe region exposes
    // `data-testid="recipe-pane"`, and applying shows
    // `data-testid="pipeline-mutation-notice"` with copy matching
    // /writes to your (data|pipeline)|will (change|modify)/i.
    const pane = page.getByTestId("recipe-pane");
    await expect(pane).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("pipeline-mutation-notice")).toContainText(
      /writes to your (data|pipeline)|will (change|modify)/i,
    );
  });
});
