import { test, expect } from "@playwright/test";
import { uploadCsv, goToCleaning } from "./helpers";

test.describe("Polymorpha E2E — Cleaning Panel and Toasts", () => {
  test("shows a toast message when applying cleaning configuration", async ({
    page,
  }) => {
    await uploadCsv(page, "missing");
    await goToCleaning(page);

    // Apply the configured cleaning — lands on the Analyse step
    const applyButton = page.getByRole("button", {
      name: /Continue to Analyse/i,
    });
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    // Sonner renders custom toasts into [data-sonner-toast]
    const toast = page
      .locator('[data-sonner-toast], .toast, [role="status"], [role="alert"]')
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
  });

  test("estimates cleaning impact before applying", async ({ page }) => {
    await uploadCsv(page, "missing");
    await goToCleaning(page);

    // The redesigned panel defaults to the Data tab — open the step workflow.
    await page.getByRole("tab", { name: "Processing" }).click();

    await page.getByRole("button", { name: /Estimate impact/i }).click();

    // The step footer reports the imputation estimate
    await expect(page.getByText(/values imputed/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
