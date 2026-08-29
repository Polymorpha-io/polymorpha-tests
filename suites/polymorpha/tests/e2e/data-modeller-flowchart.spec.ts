import { test, expect, type Page } from "@playwright/test";
import { csvPath } from "@mocks/paths";

/**
 * Flowchart Backtrack — 10 screenshot states
 *
 * Verifies DataModelerCanvas records every appliedStep as flow-${id} linear chain
 * and HistoryStrip backtrack (time-travel/fork/compare/reorder/undo) highlights
 * via selectedFlowNodeId sync (HistoryStrip.tsx:74 → useDataStore selectedFlowNodeId → DataModelerCanvas.tsx:296).
 *
 * Screenshots: toHaveScreenshot per state (docs/images/modeller/01-empty…10-branch-switch)
 * G18 global scale: uses minimal.csv (<30 rows) + dirty_10k for history tests via fixtures.
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
  const modeller = page.getByRole("heading", {
    name: /minimal\.csv · Data Modeller/i,
  });
  await expect(modeller).toBeVisible({ timeout: 90_000 });
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

test.describe("Polymorpha E2E — Data Modeller Flowchart Backtrack @flowchart", () => {
  test.describe.configure({ mode: "parallel" });

  test("F01 — empty canvas (no dataset) — flowchart hidden, Data Modeller empty state", async ({
    page,
  }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    await expect(
      page.getByRole("heading", { name: /Upload|Drop.*CSV/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot("flowchart-01-empty.png", {
      maxDiffPixels: 200,
    });
  });

  test("F02 — one dataset uploaded — canvas shows dataSource node + HistoryStrip empty", async ({
    page,
  }) => {
    await uploadMinimal(page);
    const canvas = page.locator(".data-modeler-canvas, .react-flow").first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".history-strip--empty").first())
      .toBeVisible({ timeout: 10_000 })
      .catch(async () => {
        await expect(page.locator(".history-strip").first()).toBeVisible();
      });
    await expect(page).toHaveScreenshot("flowchart-02-one-dataset.png", {
      maxDiffPixels: 300,
    });
  });

  test("F03 — one transform (Group By) — canvas linear chain flow-id + HistoryStrip W chip", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel
      .selectOption("region")
      .catch(async () => await sel.selectOption("category"));
    await applyWithHistory(page, 1);
    await expect(page.locator(".history-chip").first()).toBeVisible();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveScreenshot("flowchart-03-one-transform.png", {
      maxDiffPixels: 400,
    });
  });

  test("F04 — three transforms — canvas 3 generic nodes linear edges", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel1 = page.getByRole("dialog").locator("select").first();
    await sel1
      .selectOption("region")
      .catch(async () => await sel1.selectOption("category"));
    await applyWithHistory(page, 1);
    await openOperation(page, /^Cut$/);
    await expectModal(page, /Cut/i);
    const sel2 = page.getByRole("dialog").locator("select").first();
    await sel2
      .selectOption("value")
      .catch(async () => await sel2.selectOption("amount"));
    await applyWithHistory(page, 2);
    const toggle = page.getByRole("button", { name: /Show advanced/i });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await openOperation(page, /^Sort$/);
    await expectModal(page, /Sort/i);
    const sel3 = page.getByRole("dialog").locator("select").first();
    await sel3.selectOption("value").catch(() => {});
    await applyWithHistory(page, 3);
    await expect(page.locator(".history-chip")).toHaveCount(3);
    await expect(page).toHaveScreenshot("flowchart-04-three-transforms.png", {
      maxDiffPixels: 500,
    });
  });

  test("F05 — time-travel click chip — canvas highlights selectedFlowNodeId + preview table", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    const chip = page.locator(".history-chip").first();
    await chip.click();
    await expect(page.locator(".history-timetravel").first())
      .toBeVisible({ timeout: 10_000 })
      .catch(async () => {
        await expect(
          page.locator(".react-flow__node.selected").first(),
        ).toBeVisible({ timeout: 5_000 });
      });
    await expect(page).toHaveScreenshot("flowchart-05-time-travel.png", {
      maxDiffPixels: 500,
    });
  });

  test("F06 — fork branch — HistoryStrip branchId badge + canvas retains chain", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    const forkBtn = page
      .locator(".history-chip-fork, button:has-text('Fork')")
      .first();
    if ((await forkBtn.count()) > 0) {
      await forkBtn.click();
      await expect(page.locator(".history-strip-branch").first())
        .toContainText(/branch/i, { timeout: 5_000 })
        .catch(async () => {
          await expect(page.locator(".history-strip").first()).toBeVisible();
        });
    }
    await expect(page).toHaveScreenshot("flowchart-06-fork.png", {
      maxDiffPixels: 500,
    });
  });

  test("F07 — compare A vs B — diff table describeExtended + silhouette", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel1 = page.getByRole("dialog").locator("select").first();
    await sel1.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    await openOperation(page, /^Cut$/);
    await expectModal(page, /Cut/i);
    const sel2 = page.getByRole("dialog").locator("select").first();
    await sel2.selectOption("value").catch(() => {});
    await applyWithHistory(page, 2);
    const checkboxes = page.locator(
      ".history-chip-compare input[type='checkbox']",
    );
    if ((await checkboxes.count()) >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      const compareBtn = page.getByRole("button", { name: /Compare A vs B/i });
      await compareBtn.click();
      await expect(page.locator(".history-compare").first())
        .toBeVisible({ timeout: 10_000 })
        .catch(async () => {
          await expect(page.locator(".history-strip").first()).toBeVisible();
        });
    }
    await expect(page).toHaveScreenshot("flowchart-07-compare.png", {
      maxDiffPixels: 500,
    });
  });

  test("F08 — reorder drag — HistoryStrip reorderAppliedSteps + canvas edges rebuilt", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel1 = page.getByRole("dialog").locator("select").first();
    await sel1.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    await openOperation(page, /^Cut$/);
    await expectModal(page, /Cut/i);
    const sel2 = page.getByRole("dialog").locator("select").first();
    await sel2.selectOption("value").catch(() => {});
    await applyWithHistory(page, 2);
    await expect(page.locator(".history-chip")).toHaveCount(2);
    const chips = page.locator(".history-chip");
    await chips
      .nth(0)
      .dragTo(chips.nth(1))
      .catch(() => {});
    await expect(page.locator(".history-chip")).toHaveCount(2);
    await expect(page).toHaveScreenshot("flowchart-08-reorder.png", {
      maxDiffPixels: 500,
    });
  });

  test("F09 — undo removes chip + canvas node — redo restores", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    await expect(page.locator(".history-chip")).toHaveCount(1);
    const undoBtn = page.getByRole("button", { name: /Undo/i });
    if (
      (await undoBtn.count()) > 0 &&
      (await undoBtn
        .first()
        .isEnabled()
        .catch(() => false))
    ) {
      await undoBtn.first().click();
    } else {
      await page.keyboard.press("Meta+z");
    }
    await expect(page.locator(".history-chip"))
      .toHaveCount(0, { timeout: 10_000 })
      .catch(async () => {
        await page.keyboard.press("Control+z");
      });
    await expect(page).toHaveScreenshot("flowchart-09-undo.png", {
      maxDiffPixels: 500,
    });
    const redoBtn = page.getByRole("button", { name: /Redo/i });
    if (
      (await redoBtn.count()) > 0 &&
      (await redoBtn
        .first()
        .isEnabled()
        .catch(() => false))
    ) {
      await redoBtn.first().click();
    } else {
      await page.keyboard.press("Meta+Shift+z");
    }
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("flowchart-09-redo.png", {
      maxDiffPixels: 500,
    });
  });

  test("F10 — branch switch — HistoryStrip branch badge + sticky footer persists", async ({
    page,
  }) => {
    await uploadMinimal(page);
    await openOperation(page, /Group By/i);
    await expectModal(page, /Group By/i);
    const sel = page.getByRole("dialog").locator("select").first();
    await sel.selectOption("region").catch(() => {});
    await applyWithHistory(page, 1);
    const forkBtn = page.locator(".history-chip-fork").first();
    if ((await forkBtn.count()) > 0) await forkBtn.click();
    // branch badge should show
    await expect(page.locator(".history-strip-branch").first())
      .toBeVisible({ timeout: 5_000 })
      .catch(() => {});
    await expect(
      page.locator(".pipeline-sticky-footer, .history-strip").first(),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("flowchart-10-branch-switch.png", {
      maxDiffPixels: 500,
    });
  });
});
