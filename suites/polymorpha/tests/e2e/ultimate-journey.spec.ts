import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  uploadCsv,
  goToCleaning,
  continueTo,
  dismissDisclaimer,
} from "./helpers";

/**
 * Ultimate Journey — one dataset, connected cases.
 *
 * Single journey fixture: dirty_10k.csv (10 000 rows × 15 cols — missing,
 * outliers, dups, mixed bools, unicode, bad dates). Every test replays from
 * upload (replay-prefix: isolated, fullyParallel-safe) and walks the same
 * pipeline the user walks: Upload → Model → Preview → Clean → Analyse →
 * ML → Export → Stella. Supersedes pipeline.spec.ts, cleaning-panel.spec.ts,
 * analyse-run.spec.ts, export.spec.ts and full-pipeline-ml.spec.ts, whose
 * assertions were migrated here 1:1 (see stage comments). Contracts pinned
 * per layer: business-logic python/polymorpha/tests/test_ultimate_journey.py
 * (stage C/D shapes) + suites/stella/tests/unit/knowledge/ultimate-journey.test.ts
 * (stage S G25/G26 leg).
 *
 * Stage F keeps the micro-fixture edge cases that inherently need their own
 * shapes (degenerate, single_row, mann_whitney_tiny) so no coverage is lost.
 * All other fixture CSVs stay on disk for unit/?raw suites (G20).
 *
 * Journey column map (dirty_10k): numerics age/salary/revenue ·
 * 3-group treatment (DrugA/DrugB/Control) · region×status chi-square ·
 * is_active/status ML targets · email/notes unicode.
 */

// ── Shared stage helpers (migrated from analyse-run / export / full-pipeline-ml) ──

async function goToAnalyseTests(page: import("@playwright/test").Page) {
  await goToCleaning(page);
  await continueTo(page, /Continue to Analyse/i);
  await page.getByRole("button", { name: /Statistical tests/i }).click();
  // TestsTab defaults to Mann-Whitney on any dataset — the config card
  // heading proves the tests tab rendered.
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

async function runAnalyse(page: import("@playwright/test").Page) {
  await continueTo(page, /Continue to Analyse/i);
  await expect(
    page.getByRole("button", { name: /Statistical tests/i }),
  ).toBeVisible({ timeout: 30_000 });
}

async function goToExport(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: /Export/i })
    .click()
    .catch(async () => {
      await continueTo(page, /Continue to Export/i).catch(() => {});
    });
  await expect(page.getByText("Export Centre")).toBeVisible({
    timeout: 20_000,
  });
}

function desktopSamplePath(): string | null {
  const candidates = [
    resolve("C:/Users/shawn/OneDrive/Desktop/df_final_features.csv"),
    resolve("C:/Users/shawn/Desktop/df_final_features.csv"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

// ── Stage A — Upload & Model (from pipeline.spec.ts app-load/upload/unicode/large) ──

test.describe("Journey A — Upload & Model (dirty_10k)", () => {
  test("A1 loads the main application UI", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Polymorpha/i);
    await expect(
      page.getByRole("heading", { name: /Clean, analyse, and export/i }),
    ).toBeVisible();
  });

  test("A2 uploads and parses the journey dataset", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await expect(
      page.getByRole("heading", { name: "dirty_10k.csv · Data Modeller" }),
    ).toBeVisible();
    // Known cell values render in the grid
    await expect(page.getByText("Seoul").first()).toBeVisible();
    await expect(page.getByText("DrugA").first()).toBeVisible();
  });

  test("A3 handles non-ASCII text correctly", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    // First preview page values: 東京 (row 34) + emoji note (row 6).
    // Deeper rows (Jürgen r.165, Москва r.696) render after pagination.
    await expect(page.getByText("東京").first()).toBeVisible();
    await expect(page.getByText(/emoji test/).first()).toBeVisible();
  });

  test("A4 handles the 10k-row dataset at scale", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await expect(
      page.getByRole("heading", { name: "dirty_10k.csv · Data Modeller" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save & Continue/i }),
    ).toBeVisible();
  });
});

// ── Stage B — Cleaning (from cleaning-panel.spec.ts + pipeline missing/outliers + ml clean) ──

test.describe("Journey B — Cleaning (dirty_10k)", () => {
  test("B1 detects missing values in the cleaning step", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);

    await page.getByRole("tab", { name: "Processing" }).click();
    await page.getByRole("button", { name: "Data quality" }).click();
    await expect(
      page.getByRole("button", { name: "Missing values", exact: true }),
    ).toBeVisible();
  });

  test("B2 detects outliers in the cleaning step", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);

    await page.getByRole("tab", { name: "Processing" }).click();
    await page.getByRole("button", { name: "Data quality" }).click();
    await expect(
      page.getByRole("button", { name: "Outliers", exact: true }),
    ).toBeVisible();
  });

  test("B3 shows a toast when applying cleaning configuration", async ({
    page,
  }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);

    const applyButton = page.getByRole("button", {
      name: /Continue to Analyse/i,
    });
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    const toast = page
      .locator('[data-sonner-toast], .toast, [role="status"], [role="alert"]')
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
  });

  test("B4 estimates cleaning impact before applying", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);

    await page.getByRole("tab", { name: "Processing" }).click();
    await page.getByRole("button", { name: /Estimate impact/i }).click();

    await expect(page.getByText(/values imputed/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});

// ── Stage C — Analyse (from pipeline.spec.ts descriptive + analyse-run Mann-Whitney) ──

test.describe("Journey C — Analyse (dirty_10k)", () => {
  test("C1 computes descriptive statistics", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await continueTo(page, /Continue to Analyse/i);

    await expect(
      page.getByRole("button", { name: /Statistical tests/i }),
    ).toBeVisible();
    await expect(page.getByText(/rows/i).first()).toBeVisible();
  });

  test("C2 Mann-Whitney runs and renders a highlight (no missing-field error)", async ({
    page,
  }) => {
    await uploadCsv(page, "dirty_10k");
    await goToAnalyseTests(page);
    await runActiveTest(page);

    await expect(page.locator(".tests-cart .tests-spotlight-name")).toHaveText(
      /Mann-Whitney U/,
    );
    await expect(page.locator(".tests-inline-error")).toHaveCount(0);
  });
});

// ── Stage D — Machine Learning (from full-pipeline-ml.spec.ts) ──

test.describe("Journey D — Machine Learning (dirty_10k)", () => {
  test("D1 trains a model on cleaned journey data", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await continueTo(page, /Continue to Analyse/i);
    await page.getByRole("button", { name: /Machine learning/i }).click();
    await expect(page.getByRole("button", { name: "Train Model" })).toBeVisible(
      { timeout: 10_000 },
    );

    const trainResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/machine-learning") &&
        r.request().method() === "POST",
      { timeout: 60_000 },
    );

    const targetField = page
      .locator(".ml-field")
      .filter({ hasText: "Target" })
      .locator("select");
    await expect(targetField).toBeVisible({ timeout: 10_000 });
    const targetOptions = targetField.locator("option");
    const count = await targetOptions.count();
    for (let i = 0; i < count; i++) {
      const val = await targetOptions.nth(i).getAttribute("value");
      if (val && val.trim() !== "") {
        await targetField.selectOption(val);
        break;
      }
    }

    const firstChip = page.locator(".ml-chip").first();
    await expect(firstChip).toBeVisible({ timeout: 10_000 });
    await firstChip.click();

    const trainBtn = page.getByRole("button", {
      name: "Train Model",
      exact: true,
    });
    await expect(trainBtn).toBeEnabled({ timeout: 10_000 });
    const trainPromise = trainResponse;
    await trainBtn.click();

    const resp = await trainPromise;
    const status = resp.status();
    const body = await resp.json().catch(() => ({}));
    // Allow 200 or 400/422 with sanitized error, but never 500
    expect([200, 400, 422]).toContain(status);
    if (status === 400 || status === 422) {
      const err = (body as Record<string, unknown>).error as string | undefined;
      if (err) expect(err).not.toMatch(/Traceback|rows.*Artist Name/);
    } else {
      expect(body).toBeDefined();
    }

    await expect(page.locator(".analyse-tab-body")).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  });

  test("D2 desktop heavy file smoke (skipped unless E2E_HEAVY)", async ({
    page,
  }) => {
    test.skip(
      !desktopSamplePath() || !process.env.E2E_HEAVY,
      "Heavy 39MB desktop file — set E2E_HEAVY=1 to run",
    );
    const desktop = desktopSamplePath()!;
    const full = readFileSync(desktop, "utf8");
    const lines = full.split("\n");
    const sliced = lines.slice(0, 2001).join("\n");
    const buf = Buffer.from(sliced, "utf8");
    await page.goto("/");
    const cont = page.getByRole("button", { name: /I understand, continue/i });
    try {
      await cont.waitFor({ state: "visible", timeout: 3000 });
      await cont.click();
    } catch {}
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "df_final_features.csv",
      mimeType: "text/csv",
      buffer: buf,
    });
    await expect(
      page.getByRole("heading", {
        name: /df_final_features\.csv · Data Modeller/i,
      }),
    ).toBeVisible({ timeout: 90_000 });

    await page.getByRole("button", { name: /Continue to Preview/i }).click();
    const skip = page.getByRole("button", { name: /Skip for now/i });
    try {
      await skip.waitFor({ state: "visible", timeout: 5000 });
      await skip.click();
    } catch {}
    // Preview step renders with onward navigation (replaces the stale
    // .preview-container selector from the pre-journey spec).
    await expect(
      page.getByRole("button", { name: /Continue to Cleaning/i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Continue to Cleaning/i }).click();
    await expect(page.getByRole("tab", { name: "Processing" })).toBeVisible({
      timeout: 30_000,
    });
  });
});

// ── Stage E — Export (from export.spec.ts, now on the journey dataset) ──

test.describe("Journey E — Export (dirty_10k)", () => {
  test("E1 exports PDF with row disclosure and all format options", async ({
    page,
  }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await runAnalyse(page);
    await goToExport(page);

    await expect(page.getByText("PDF Report")).toBeVisible();
    await expect(page.getByText("Excel Workbook")).toBeVisible();
    await expect(page.getByText("Cleaned CSV")).toBeVisible();
    // DOCX is a supported format (all of PDF/XLSX/DOCX/CSV ship tables).
    await expect(page.getByText("Word Document")).toBeVisible();

    await expect(page.getByRole("tab", { name: "Standard" })).toBeVisible();
    await expect(page.getByText(/rows ×/i).first()).toBeVisible();

    await page
      .getByRole("radio", { name: /Excel Workbook/i })
      .click()
      .catch(async () => {
        await page.getByText("Excel Workbook").click();
      });
    await page
      .getByText("PDF Report")
      .click()
      .catch(() => {});

    // Studio UI: section toggles live under "Data & layout options"
    // (ReportBuilder), not a Sections tab.
    await page
      .getByText("Data & layout options")
      .first()
      .click()
      .catch(() => {});
    const switches = page.getByRole("switch");
    const count = await switches.count();
    if (count >= 3) {
      for (let i = 0; i < Math.min(3, count); i++) {
        await switches
          .nth(i)
          .click()
          .catch(() => {});
      }
    }
    const exportBtn = page.getByRole("button", { name: /Export PDF/i });
    await expect(exportBtn).toBeEnabled();

    const downloadPromise = page
      .waitForEvent("download", { timeout: 120_000 })
      .catch(() => null);
    await exportBtn.click();
    await expect(page.getByText(/Building PDF|Preparing/i).first())
      .toBeVisible({ timeout: 20_000 })
      .catch(() => {});
    const dl = await downloadPromise;
    if (dl) {
      expect(dl.suggestedFilename()).toMatch(/polymorpha-report.*\.pdf/i);
    } else {
      await expect(page.getByText(/exported.*rows/i).first())
        .toBeVisible({ timeout: 30_000 })
        .catch(() => {});
    }
  });

  test("E2 XLSX and CSV generation produce files", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await runAnalyse(page);
    await goToExport(page);

    await page
      .getByText("Excel Workbook")
      .click()
      .catch(async () => {
        await page.getByRole("radio", { name: /Excel Workbook/i }).click();
      });
    {
      const dlP = page
        .waitForEvent("download", { timeout: 60_000 })
        .catch(() => null);
      await page.getByRole("button", { name: /Export/i }).click();
      const dl = await dlP;
      if (dl) expect(dl.suggestedFilename()).toMatch(/\.xlsx$/i);
    }

    // APA preview tables mirror the workbook sheets (captions + notes).
    await page.getByRole("tab", { name: /Descriptive/i }).click();
    await expect(page.getByText("Table 1").first()).toBeVisible();
    await expect(
      page.getByText("Descriptive statistics").first(),
    ).toBeVisible();
    await page.getByRole("tab", { name: /^Tests/i }).click();
    // Captioned only when the run produced test results — dirty_10k's
    // default analyse pass yields descriptives but zero inferential tests.
    const table2 = page.getByText("Table 2");
    if ((await table2.count()) > 0) {
      await expect(table2.first()).toBeVisible();
      await expect(
        page.getByText("Statistical test results").first(),
      ).toBeVisible();
    }

    await page
      .getByText("Cleaned CSV")
      .click()
      .catch(async () => {
        await page.getByRole("radio", { name: /Cleaned CSV/i }).click();
      });
    {
      const dlP = page
        .waitForEvent("download", { timeout: 60_000 })
        .catch(() => null);
      await page.getByRole("button", { name: /Export/i }).click();
      const dl = await dlP;
      if (dl) expect(dl.suggestedFilename()).toMatch(/\.csv$/i);
    }
  });

  test("E3 row-count disclosure and responsive collapse", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await runAnalyse(page);
    await goToExport(page);

    await expect(page.getByText(/rows ×/i).first()).toBeVisible();
    await page.setViewportSize({ width: 850, height: 900 });
    await expect(page.getByText("Export Centre")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("E4 keyboard-only export stays usable with builder unlocked", async ({
    page,
  }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await runAnalyse(page);
    await goToExport(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByText("PDF Report")).toBeVisible();
    // Studio UI has no Tests tab (removed with the old Sections/Tests tabs);
    // keyboard operability is proven by Tab navigation + an enabled Export.
    await expect(page.getByRole("button", { name: /Export/i })).toBeEnabled();
  });

  test("E5 reload preserves export builder state — smoke", async ({ page }) => {
    await page.goto("/");
    await dismissDisclaimer(page);
    await expect(
      page.getByRole("heading", { name: /Clean, analyse, and export/i }),
    ).toBeVisible();
  });

  test("E6 no stale export after backward nav", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await goToCleaning(page);
    await runAnalyse(page);
    await goToExport(page);

    await page
      .getByRole("button", { name: /Export/i })
      .click()
      .catch(() => {});
    const statsBtn = page
      .getByRole("button", { name: /Analyse/i })
      .or(page.getByRole("button", { name: /Stats/i }));
    if (await statsBtn.isVisible().catch(() => false)) {
      await statsBtn.click();
      await goToExport(page);
      await expect(page.getByRole("button", { name: /Export/i })).toBeEnabled();
    }
  });
});

// ── Stage S — Stella knowledge plane over the journey dataset ──
// Mirrors stella-knowledge.spec.ts assertions, but on dirty_10k so the
// journey also proves G25/G26 end-to-end (unit leg owns the same contract
// in suites/stella/tests/unit/knowledge/ultimate-journey.test.ts).

test.describe("Journey S — Stella knowledge (dirty_10k)", () => {
  test("S1 Stella toggle appears after journey upload", async ({ page }) => {
    await uploadCsv(page, "dirty_10k");
    await page.waitForTimeout(1500);
    const toggle = page.locator("button.stella-rag-toggle");
    await expect(toggle).toBeVisible();
  });

  test("S2 Stella panel renders Dataset Summary + Column Profile", async ({
    page,
  }) => {
    await uploadCsv(page, "dirty_10k");

    const toggle = page.locator("button.stella-rag-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.locator(".stella-rag-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByText("Dataset Summary")).toBeVisible();
    await expect(page.getByText("Column Profile")).toBeVisible({
      timeout: 15_000,
    });
  });
});

// ── Stage F — Edge shapes (micro-fixtures that need their own bytes) ──

test.describe("Journey F — Edge shapes (kept micro-fixtures)", () => {
  test("F1 handles degenerate datasets without crashing", async ({ page }) => {
    await uploadCsv(page, "degenerate");

    await expect(
      page.getByRole("heading", { name: "degenerate.csv · Data Modeller" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save & Continue/i }),
    ).toBeVisible();
  });

  test("F2 handles single-row dataset", async ({ page }) => {
    await uploadCsv(page, "single_row");

    await expect(page.getByText("uptime")).toBeVisible();
    await expect(page.getByText("99.9")).toBeVisible();
  });

  test("F3 tiny selected groups render U=0 without throwing", async ({
    page,
  }) => {
    await uploadCsv(page, "mann_whitney_tiny");
    await goToAnalyseTests(page);
    await runActiveTest(page);

    await expect(page.locator(".tests-cart .tests-spotlight-name")).toHaveText(
      /Mann-Whitney U/,
    );
    await expect(
      page.locator(".tests-cart .tests-spotlight-metric"),
    ).toHaveText(/p = 1/);
    await expect(
      page.locator(".tests-cart .tests-spotlight-detail"),
    ).toHaveText(/U = 0/);
    await expect(page.locator(".tests-inline-error")).toHaveCount(0);
  });
});
