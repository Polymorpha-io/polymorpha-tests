import { test, expect } from "@playwright/test";
import { uploadCsv, goToCleaning, continueTo } from "./helpers";

/**
 * Analyse → Run regression tests (POLY: "missing required field U" bug).
 *
 * Covers:
 *  - A normal Mann-Whitney run renders a result highlight with no validation error.
 *  - A dataset with >= 4 total rows but < 4 values in the selected groups
 *    (previously produced "missing required field U") now renders U=0.000 +
 *    p=1.0 instead of throwing.
 */
async function goToAnalyseTests(page: import("@playwright/test").Page) {
  await goToCleaning(page);
  await continueTo(page, /Continue to Analyse/i);
  await page.getByRole("button", { name: /Statistical tests/i }).click();
  // The default active test is Mann-Whitney — its config card heading proves
  // the tests tab rendered.
  await expect(
    page.getByRole("heading", { name: "Mann-Whitney U", exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

async function runActiveTest(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Run", exact: true }).click();
  // Wait for the desktop Selection cart spotlight to fill in.
  await expect(page.locator(".tests-cart .tests-spotlight-item")).toHaveCount(
    1,
    { timeout: 60_000 },
  );
}

test.describe("Analyse Run — response contract", () => {
  test("Mann-Whitney runs and renders a highlight (no missing-field error)", async ({
    page,
  }) => {
    await uploadCsv(page, "mann_whitney");
    await goToAnalyseTests(page);

    await runActiveTest(page);

    await expect(page.locator(".tests-cart .tests-spotlight-name")).toHaveText(
      /Mann-Whitney U/,
    );
    // The regression error must not appear.
    await expect(page.locator(".tests-inline-error")).toHaveCount(0);
  });

  test("tiny selected groups render U=0 without throwing", async ({ page }) => {
    await uploadCsv(page, "mann_whitney_tiny");
    await goToAnalyseTests(page);

    await runActiveTest(page);

    await expect(page.locator(".tests-cart .tests-spotlight-name")).toHaveText(
      /Mann-Whitney U/,
    );
    // Degenerate result: p=1.0, statistic emitted as 0.000 by the backend.
    await expect(
      page.locator(".tests-cart .tests-spotlight-metric"),
    ).toHaveText(/p = 1/);
    await expect(
      page.locator(".tests-cart .tests-spotlight-detail"),
    ).toHaveText(/U = 0/);
    await expect(page.locator(".tests-inline-error")).toHaveCount(0);
  });
});
