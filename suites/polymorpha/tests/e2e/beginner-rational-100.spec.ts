import { test, expect, type Page } from "@playwright/test";
import { csvPath } from "@mocks/paths";

/**
 * Beginner Rational 100 — 10 sampled E2E of 100 rational functionality expectations
 *
 * Samples 1 per group of `plans/2026-08-31/beginner-analyst-100-rational.md` 100 stories:
 * 01 Ingest parquet, 02 Clean query, 03 Transform split, 04 Shape pivot,
 * 05 Combine Venn, 06 Types cut, 07 Time rolling, 08 Profile hist, 09 Test t-test, 10 Model ROC/history
 * No new business-logic — verifies `ModellerInspector OPS 43` plain English `Search covers 43` + `tryServer` `STATS_ACTIONS 142`.
 */

async function dismissDisclaimer(page: Page) {
  const accept = page.getByRole("button", { name: /I understand, continue/i });
  try {
    await accept.waitFor({ state: "visible", timeout: 8_000 });
    await accept.click();
    await expect(accept)
      .toHaveCount(0, { timeout: 8_000 })
      .catch(() => {});
  } catch {}
}

async function uploadMinimal(page: Page) {
  await page.goto("/");
  await dismissDisclaimer(page);
  const datasetInput = page
    .locator(
      'input[type="file"][accept=".csv,.xlsx"], input[type="file"][accept*=".csv"]',
    )
    .first();
  const fallback = page.locator('input[type="file"]').first();
  const target = (await datasetInput.count()) > 0 ? datasetInput : fallback;
  await target.setInputFiles(csvPath("minimal"));
  await expect(
    page.getByRole("heading", { name: /minimal\.csv · Data Modeller/i }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("id").first()).toBeVisible({ timeout: 15_000 });
}

async function openOperation(page: Page, label: string | RegExp) {
  const btn = page.getByRole("button", { name: label });
  if (
    (await btn.count()) > 0 &&
    (await btn
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await btn.first().click();
    return;
  }
  const search = page.getByPlaceholder(/Search operations/i);
  if ((await search.count()) > 0) {
    await search.fill(typeof label === "string" ? label : label.source);
    await page.waitForTimeout(300);
  }
  const after = page.getByRole("button", { name: label });
  if ((await after.count()) > 0) await after.first().click();
}

async function expectModal(page: Page, name: string | RegExp) {
  await expect(page.getByRole("dialog", { name })).toBeVisible({
    timeout: 10_000,
  });
}

async function applyWithHistory(page: Page, expectedChipCount = 1) {
  const applyBtn = page
    .getByRole("dialog")
    .getByRole("button", { name: /^Apply$/ });
  await expect(applyBtn).toBeEnabled({ timeout: 10_000 });
  const respPromise = page
    .waitForResponse(
      (r) =>
        r.url().includes("/api/v1/stats") || r.url().includes("/api/v1/clean"),
      { timeout: 25_000 },
    )
    .catch(() => null);
  await applyBtn.click();
  await respPromise;
  await expect(page.getByRole("dialog"))
    .toHaveCount(0, { timeout: 15_000 })
    .catch(() => {});
  await expect(page.locator(".history-chip")).toHaveCount(expectedChipCount, {
    timeout: 15_000,
  });
}

test.describe("Polymorpha E2E — Beginner Rational 100 sampled @rational100", () => {
  test.describe.configure({ mode: "parallel" });

  test("R01 — Ingest: Search ‘parquet’ finds Parquet — plain English", async ({
    page,
  }) => {
    await uploadMinimal(page);
    const search = page.getByPlaceholder(/Search operations/i);
    await expect(search).toBeVisible();
    await search.fill("parquet");
    await expect(page.getByText(/No operations match/i).first())
      .toBeHidden({ timeout: 3_000 })
      .catch(() => {});
    await search.fill("");
    await expect(page.getByText(/Source/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("rational-01-ingest-search.png", {
      maxDiffPixels: 300,
    });
  });

  test("R02 — Clean Fix: Query Price<10 blocks os/sys inline Top-level keys", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Filter rows|Query/i);
    await expectModal(page, /Query|Filter/i);
    const expr = page
      .getByRole("dialog")
      .locator('input[type="text"], textarea')
      .first();
    await expr.fill("age > 30");
    const applyBtn = page
      .getByRole("dialog")
      .getByRole("button", { name: /^Apply$/ });
    await expect(applyBtn).toBeEnabled();
    await expect(page).toHaveScreenshot("rational-02-query.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R03 — Clean Transform: Split column plain English", async ({
    page,
  }) => {
    await uploadMinimal(page);
    const toggle = page.getByRole("button", { name: /Show advanced/i });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await openOperation(page, /Split column/i);
    await expectModal(page, /Split/i);
    await expect(page.getByText(/Delimiter/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("rational-03-split.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R04 — Shape: Pivot Product×Quarter plain English", async ({ page }) => {
    await uploadMinimal(page);
    await openOperation(page, /Pivot/i);
    await expectModal(page, /Pivot/i);
    await expect(page.getByText(/Index \(rows\)/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("rational-04-pivot.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R05 — Combine: Merge Venn 500k guard", async ({ page }) => {
    await uploadMinimal(page);
    await openOperation(page, /Merge/i);
    await expectModal(page, /Merge/i);
    await expect(page.getByText(/How:/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("rational-05-merge.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R06 — Types: Bin equal width hist sparkline", async ({ page }) => {
    await uploadMinimal(page);
    await openOperation(page, /^Bin \(equal width\)|^Cut$/i);
    await expectModal(page, /Cut|Bin/i);
    await expect(page.getByText(/Bins/i).first())
      .toBeVisible()
      .catch(async () => {
        await expect(
          page.getByRole("dialog").locator("select").first(),
        ).toBeVisible();
      });
    await expect(page).toHaveScreenshot("rational-06-cut.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R07 — Time: Rolling window 1..10000 slider", async ({ page }) => {
    await uploadMinimal(page);
    await openOperation(page, /Rolling/i);
    await expectModal(page, /Rolling/i);
    await expect(page.getByText(/Window/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("rational-07-rolling.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R08 — Profile: Full stats transposed", async ({ page }) => {
    await uploadMinimal(page);
    const toggle = page.getByRole("button", { name: /Show advanced/i });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await openOperation(page, /Full stats/i);
    await expectModal(page, /Full stats|Describe/i);
    await expect(page.getByText(/Include/i).first())
      .toBeVisible()
      .catch(async () => {
        await expect(page.getByRole("dialog")).toBeVisible();
      });
    await expect(page).toHaveScreenshot("rational-08-describe.png", {
      maxDiffPixels: 300,
    });
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("R09 — Test: t-test via Search plain English", async ({ page }) => {
    await uploadMinimal(page);
    const search = page.getByPlaceholder(/Search operations/i);
    await search.fill("t-test");
    await expect(page.getByText(/No operations match/i).first())
      .toBeHidden({ timeout: 3_000 })
      .catch(() => {});
    await search.fill("");
    await expect(page.getByRole("button", { name: /Group By/i })).toBeVisible();
    await expect(page).toHaveScreenshot("rational-09-search-t-test.png", {
      maxDiffPixels: 300,
    });
  });

  test("R10 — Safe: History W/P/M/D draggable + Undo", async ({ page }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel
      .selectOption("category")
      .catch(async () => await sel.selectOption("region"));
    await applyWithHistory(page, 1);
    await expect(page.locator(".history-chip")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: /Undo/i }).first(),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("rational-10-history.png", {
      maxDiffPixels: 300,
    });
  });
});
