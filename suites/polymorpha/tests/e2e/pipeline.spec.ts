import { test, expect } from "@playwright/test";
import { uploadCsv, goToCleaning, continueTo } from "./helpers";

test.describe("Polymorpha E2E — Full Pipeline", () => {
  // ── App Load ───────────────────────────────────────────────────────
  test("loads the main application UI", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Polymorpha/i);
    await expect(
      page.getByRole("heading", { name: /Clean, analyse, and export/i }),
    ).toBeVisible();
  });

  // ── Upload & Parse ─────────────────────────────────────────────────
  test("uploads and parses a CSV file", async ({ page }) => {
    await uploadCsv(page, "mixed");

    // Row values render in the Data Modeller grid
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Charlie")).toBeVisible();
  });

  // ── Missing Values Detection ───────────────────────────────────────
  test("detects missing values in the cleaning step", async ({ page }) => {
    await uploadCsv(page, "missing");
    await goToCleaning(page);

    await page.getByRole("tab", { name: "Processing" }).click();
    await page.getByRole("button", { name: "Data quality" }).click();
    await expect(
      page.getByRole("button", { name: "Missing values", exact: true }),
    ).toBeVisible();
  });

  // ── Outlier Detection ──────────────────────────────────────────────
  test("detects outliers in the cleaning step", async ({ page }) => {
    await uploadCsv(page, "outliers");
    await goToCleaning(page);

    await page.getByRole("tab", { name: "Processing" }).click();
    await page.getByRole("button", { name: "Data quality" }).click();
    await expect(
      page.getByRole("button", { name: "Outliers", exact: true }),
    ).toBeVisible();
  });

  // ── Descriptive Statistics ─────────────────────────────────────────
  test("computes descriptive statistics", async ({ page }) => {
    await uploadCsv(page, "correlation");
    await goToCleaning(page);

    // Apply the default cleaning and land on the Analyse step
    await continueTo(page, /Continue to Analyse/i);

    await expect(
      page.getByRole("button", { name: /Statistical tests/i }),
    ).toBeVisible();
    await expect(page.getByText(/rows/i).first()).toBeVisible();
  });

  // ── Unicode / Non-ASCII ────────────────────────────────────────────
  test("handles non-ASCII text correctly", async ({ page }) => {
    await uploadCsv(page, "unicode");

    // Latin-1 supplementary chars, Cyrillic, CJK
    await expect(page.getByText("Jürgen")).toBeVisible();
    await expect(page.getByText("Москва")).toBeVisible();
    await expect(page.getByText("東京")).toBeVisible();
  });

  // ── Degenerate / Edge Cases ────────────────────────────────────────
  test("handles degenerate datasets without crashing", async ({ page }) => {
    await uploadCsv(page, "degenerate");

    await expect(
      page.getByRole("heading", { name: "degenerate.csv · Data Modeller" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save & Continue/i }),
    ).toBeVisible();
  });

  // ── Large Dataset ──────────────────────────────────────────────────
  test("handles a 100-row dataset", async ({ page }) => {
    await uploadCsv(page, "large");

    await expect(
      page.getByRole("heading", { name: "large.csv · Data Modeller" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save & Continue/i }),
    ).toBeVisible();
  });

  // ── Single Row ─────────────────────────────────────────────────────
  test("handles single-row dataset", async ({ page }) => {
    await uploadCsv(page, "single_row");

    await expect(page.getByText("uptime")).toBeVisible();
    await expect(page.getByText("99.9")).toBeVisible();
  });
});
