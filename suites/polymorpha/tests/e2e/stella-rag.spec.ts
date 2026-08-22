import { test, expect } from "@playwright/test";
import { goToHome, uploadCsv } from "./helpers";

test.describe("Polymorpha E2E — Stella RAG Panel", () => {
  test("shows empty state when no dataset is loaded", async ({ page }) => {
    await goToHome(page);

    // The toggle should be visible even without a dataset
    const toggle = page.locator("button.stella-rag-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // The panel should open
    const panel = page.locator(".stella-rag-panel");
    await expect(panel).toBeVisible();

    // Expect empty state message
    await expect(page.getByText(/No dataset loaded\./i)).toBeVisible();
  });

  test("shows dataset summary and column profile after uploading a file", async ({
    page,
  }) => {
    await uploadCsv(page, "missing");

    // Open the RAG panel
    const toggle = page.locator("button.stella-rag-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // The panel should open and display the summary
    const panel = page.locator(".stella-rag-panel");
    await expect(panel).toBeVisible();

    await expect(page.getByText("Dataset Summary")).toBeVisible();
    await expect(page.getByText("Column Profile")).toBeVisible({ timeout: 15_000 });

    // Missing value stats should be visible because we uploaded missing.csv
    await expect(page.getByText("Missing").first()).toBeVisible();
    await expect(page.getByText("Unique").first()).toBeVisible();
  });
});