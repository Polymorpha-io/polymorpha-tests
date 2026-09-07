import { test, expect, type Page } from "@playwright/test";
import { csvPath } from "@mocks/paths";

/**
 * Combine experience — merge/concat/join integrity (DATA-099, G20/G22).
 *
 * Uses generic fixtures (mixed.csv + unicode.csv share text key `name`;
 * mixed.age is numeric) with Promise-free sequential flows; concurrency is
 * covered by g18-concurrency.spec.ts.
 *
 * Covers: empty-session merge hint, Source-tab second-file import, merge
 * success count banner (left + right → kept), missing-key Apply block,
 * concat axis-1 positional block, join copy honesty.
 */

async function dismissDisclaimer(page: Page) {
  const accept = page.getByRole("button", { name: /I understand, continue/i });
  try {
    await accept.waitFor({ state: "visible", timeout: 10_000 });
    await accept.click();
    await expect(accept)
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  } catch {}
}

async function uploadFirst(page: Page) {
  await page.goto("/");
  await dismissDisclaimer(page);
  const datasetInput = page
    .locator(
      'input[type="file"][accept=".csv,.xlsx"], input[type="file"][accept*=".csv"]',
    )
    .first();
  const fallback = page.locator('input[type="file"]').first();
  const target = (await datasetInput.count()) > 0 ? datasetInput : fallback;
  await target.setInputFiles(csvPath("mixed"));
  const modeller = page.getByRole("heading", {
    name: /mixed\.csv · Data Modeller/i,
  });
  await expect(modeller).toBeVisible({ timeout: 90_000 });
}

async function openCombineCard(page: Page, name: string | RegExp) {
  await page.getByRole("tab", { name: "Combine" }).click();
  await page.getByRole("button", { name }).first().click();
}

test.describe("combine experience", () => {
  test("merge without a second dataset explains itself", async ({ page }) => {
    await uploadFirst(page);
    await openCombineCard(page, /Merge/);
    const dialog = page.getByRole("dialog", { name: "Merge Datasets" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByText(/No other datasets in this session/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("merge mixed + unicode on name keeps honest counts", async ({
    page,
  }) => {
    await uploadFirst(page);
    // Second file via the Source tab hidden input (single import path).
    await page.getByRole("tab", { name: "Source" }).click();
    const fileInput = page.locator(
      '.modeller-inspector-body input[type="file"]',
    );
    await fileInput.setInputFiles(csvPath("unicode"));
    await expect(
      page.locator(".modeller-source-card", { hasText: "unicode.csv" }),
    ).toBeVisible({ timeout: 60_000 });

    await openCombineCard(page, /Merge/);
    const dialog = page.getByRole("dialog", { name: "Merge Datasets" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog
      .locator("select")
      .first()
      .selectOption({ label: /unicode\.csv/ });
    await dialog.locator("select").nth(1).selectOption("name");
    const apply = dialog.getByRole("button", { name: "Apply" });
    await expect(apply).toBeEnabled({ timeout: 15_000 });
    await apply.click();
    // Backend count delta banner — real counts, never fabricated (G30).
    await expect(page.getByText(/rows kept\./)).toBeVisible({
      timeout: 90_000,
    });
  });

  test("merge with a key missing on the right blocks Apply", async ({
    page,
  }) => {
    await uploadFirst(page);
    await page.getByRole("tab", { name: "Source" }).click();
    await page
      .locator('.modeller-inspector-body input[type="file"]')
      .setInputFiles(csvPath("unicode"));
    await expect(
      page.locator(".modeller-source-card", { hasText: "unicode.csv" }),
    ).toBeVisible({ timeout: 60_000 });

    await openCombineCard(page, /Merge/);
    const dialog = page.getByRole("dialog", { name: "Merge Datasets" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog
      .locator("select")
      .first()
      .selectOption({ label: /unicode\.csv/ });
    // `age` exists left (mixed.csv) but not right (unicode.csv).
    await dialog.locator("select").nth(1).selectOption("age");
    await expect(
      dialog.getByText(/Right dataset has no column "age"/),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("concat axis-1 with unequal rows blocks Apply", async ({ page }) => {
    await uploadFirst(page);
    await page.getByRole("tab", { name: "Source" }).click();
    await page
      .locator('.modeller-inspector-body input[type="file"]')
      .setInputFiles(csvPath("unicode"));
    await expect(
      page.locator(".modeller-source-card", { hasText: "unicode.csv" }),
    ).toBeVisible({ timeout: 60_000 });

    await openCombineCard(page, /Stack rows/);
    const dialog = page.getByRole("dialog", { name: "Concat Datasets" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog
      .locator("select")
      .first()
      .selectOption({ label: /unicode\.csv/ });
    await dialog.getByText(/Columns \(axis 1/).click();
    await expect(dialog.getByText(/positionally/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("join modal states the column contract", async ({ page }) => {
    await uploadFirst(page);
    await openCombineCard(page, /Lookup join/);
    const dialog = page.getByRole("dialog", { name: "Join Datasets" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByText(/single shared key required on both sides/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
