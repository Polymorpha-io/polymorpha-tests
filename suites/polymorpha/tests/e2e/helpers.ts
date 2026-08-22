import { expect, type Page } from "@playwright/test";
import { csvPath } from "@mocks/paths";

/**
 * Dismiss the first-visit disclaimer modal ("Before you begin"). It mounts
 * shortly after app bootstrap, so wait for it instead of a racy one-shot
 * isVisible check — otherwise it reappears mid-flow and blocks later clicks.
 */
export async function dismissDisclaimer(page: Page): Promise<void> {
  const accept = page.getByRole("button", {
    name: /I understand, continue/i,
  });
  try {
    await accept.waitFor({ state: "visible", timeout: 10_000 });
    await accept.click();
    await expect(accept)
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  } catch {
    // Never shown (already accepted / storage restored) — fine.
  }
}

/**
 * Sign in with the dedicated E2E email/password account. Unlike the Google
 * flow this is fully automatable — headless, no 2FA, no bot detection.
 * The account is created once via the app signup; credentials are test-only.
 */
export async function signInWithTestAccount(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL ?? "polymorpha.e2e@example.com";
  const password = process.env.E2E_PASSWORD ?? "E2ePass!2026";

  await page.goto("/login");
  await dismissDisclaimer(page);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(/workspaces/, { timeout: 30_000 });
}

/** Load the home page and dismiss the first-visit disclaimer if shown. */
export async function goToHome(page: Page): Promise<void> {
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * Upload a mock CSV and wait until the Data Modeller has rendered the file.
 * The heading `<h2>{fileName} · Data Modeller</h2>` is the reliable signal
 * that parse + storage round-trip finished (step "model").
 */
export async function uploadCsv(page: Page, name: string): Promise<void> {
  await goToHome(page);
  // G25: two file inputs now exist (dataset .csv/.xlsx + notebook .ipynb); target dataset one
  const datasetInput = page
    .locator(
      'input[type="file"][accept=".csv,.xlsx"], input[type="file"][accept*=".csv"]',
    )
    .first();
  const fallback = page.locator('input[type="file"]').first();
  const target = (await datasetInput.count()) > 0 ? datasetInput : fallback;
  await target.setInputFiles(csvPath(name));
  const modeller = page.getByRole("heading", {
    name: `${name}.csv · Data Modeller`,
  });
  await expect(modeller).toBeVisible({ timeout: 60_000 });
}

/** Click the workflow toolbar's primary action by its aria-label. */
export async function continueTo(page: Page, label: RegExp): Promise<void> {
  await page.getByRole("button", { name: label }).click();
}

/**
 * The stats-level prompt appears once, on first arrival at the Preview step,
 * and only when no prefs are stored. Fresh Playwright contexts always see it.
 */
export async function dismissStatsLevelPrompt(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: /Skip for now/i });
  await expect(skip).toBeVisible({ timeout: 10_000 });
  await skip.click();
}

/** Advance from the Data Modeller to the data Preview step. */
export async function goToPreview(page: Page): Promise<void> {
  await continueTo(page, /Continue to Preview/i);
  await dismissStatsLevelPrompt(page);
}

/** Advance from the Data Modeller to the Cleaning step. */
export async function goToCleaning(page: Page): Promise<void> {
  await goToPreview(page);
  await continueTo(page, /Continue to Cleaning/i);
}
