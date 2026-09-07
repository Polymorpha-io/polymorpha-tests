import { test, expect } from "@playwright/test";
import {
  uploadCsv,
  goToCleaning,
  continueTo,
  dismissDisclaimer,
} from "./helpers";

/**
 * Feature recipes record replayable flowchart cells (POLY-RECIPE).
 *
 * Regression: RecipePane used to record `type: "pipeline"` pseudo-steps that
 * exist nowhere else — replay threw `Backend unavailable for pipeline` and
 * the flowchart held an unreplayable node. Recipes now record real configs
 * (scaleFeatures/imputeFeatures/encodeFeatures/mlPipeline/drop) executed
 * through the existing ML backend.
 *
 * Backend-gated like every e2e here (needs :8787 + :8080 via dev script).
 */

async function reachRecipes(page: import("@playwright/test").Page) {
  await uploadCsv(page, "mixed");
  await dismissDisclaimer(page).catch(() => {});
  await goToCleaning(page);
  await continueTo(page, /Continue to Analyse/i);
  await page.getByRole("button", { name: /Machine learning/i }).click();
  await expect(page.getByText("Scale", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function openNotebook(page: import("@playwright/test").Page) {
  const open = page.getByRole("button", { name: /Open notebook/ });
  await open.click();
}

test.describe("feature recipes in flowchart", () => {
  test("scale records a replayable Scale cell, no backend error", async ({
    page,
  }) => {
    await reachRecipes(page);
    const card = page.locator(".recipe-card", {
      has: page.getByText("Scale", { exact: true }),
    });
    await card.locator(".recipe-chip").first().click();
    await card.getByRole("button", { name: "Apply Scale" }).click();
    await expect(card.getByText("scalerParams preview")).toBeVisible({
      timeout: 90_000,
    });
    await openNotebook(page);
    await expect(page.getByText(/Scale standard on \d+ cols/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("encode records a replayable Encode cell", async ({ page }) => {
    await reachRecipes(page);
    const card = page.locator(".recipe-card", {
      has: page.getByText("Encode", { exact: true }),
    });
    await card.locator(".recipe-chip").first().click();
    const apply = card.getByRole("button", { name: /Apply Encode/ });
    await expect(apply).toBeEnabled({ timeout: 15_000 });
    await apply.click();
    await openNotebook(page);
    await expect(page.getByText(/Encode onehot on \d+ cols/)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });
});
