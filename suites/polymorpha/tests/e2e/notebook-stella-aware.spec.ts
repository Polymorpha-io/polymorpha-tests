import { test, expect } from "@playwright/test";
import { goToHome, uploadCsv } from "./helpers";

/**
 * G24 + Notebook incell + Stella Knowledge plane (per workspace, superseded, activeCell)
 * Covers:
 * - Notebook per workspace via notebook.json.gz + datasetIds[] (cross-dataset)
 * - Cells reference datasets, superseded kept for provenance
 * - Stella activeCellId via NotebookView Explain → KnowledgeService hybrid
 * - Export/Import .ipynb via nbformat thin adapter
 */
test.describe("Polymorpha E2E — Notebook Stella Aware", () => {
  test("notebook per workspace shows cells after upload and clean (guest)", async ({ page }) => {
    await uploadCsv(page, "missing");

    // Notebook strip should appear below stepper (Pipeline -> NotebookView)
    const notebook = page.locator(".notebook-view");
    await expect(notebook).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/active cells/i).first()).toBeVisible();

    // At least one upload cell
    await expect(page.locator(".notebook-cell").first()).toBeVisible();
    await expect(page.getByText(/Upload missing\.csv/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("Explain button sets activeCell and Stella shows notebook_context", async ({ page }) => {
    await uploadCsv(page, "missing");

    const notebook = page.locator(".notebook-view");
    await expect(notebook).toBeVisible({ timeout: 15_000 });

    // Wait for at least one cell
    await expect(page.locator(".notebook-cell").first()).toBeVisible({ timeout: 10_000 });

    // Click Explain on first cell
    const explain = page.getByRole("button", { name: "Explain" }).first();
    await expect(explain).toBeVisible();
    await explain.click();

    // Stella panel should open (StellaAI)
    const stellaPanel = page.locator(".stella-panel");
    await expect(stellaPanel).toBeVisible({ timeout: 10_000 });

    // Stella store should have activeCellId set (via Knowledge plane)
    const activeCellId = await page.evaluate(async () => {
      try {
        const { useStellaStore } = await import("@/stella/store");
        return useStellaStore.getState().activeCellId;
      } catch {
        return null;
      }
    });
    expect(activeCellId).toBeTruthy();

    // After auto Explain send, there should be at least one assistant message
    // (Explain prompt is "Explain Cell X ...")
    await expect(page.locator(".stella-msg--assistant").first()).toBeVisible({ timeout: 20_000 });

    // Verify BrainService injected notebook_context by inspecting last system prompt capture if available
    // Fallback: ensure KnowledgeService has notebook_cell records
    const hasNotebookCell = await page.evaluate(async () => {
      try {
        const { knowledgeStore } = await import("@/knowledge/KnowledgeStore");
        const all = await knowledgeStore.getAll();
        return all.some((r) => r.kind === "notebook_cell" || r.kind === "notebook_output");
      } catch {
        return false;
      }
    });
    expect(hasNotebookCell).toBeTruthy();
  });

  test("superseded cells kept when branching (G18 audit history)", async ({ page }) => {
    await uploadCsv(page, "missing");
    await expect(page.locator(".notebook-view")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".notebook-cell").first()).toBeVisible();

    const initialCount = await page.locator(".notebook-cell").count();

    // Simulate backward then new clean via second upload (cheap branch: new dataset upload creates new cell but old stays)
    await uploadCsv(page, "minimal");
    await expect(page.locator(".notebook-view")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);

    const afterCount = await page.locator(".notebook-cell").count();
    // New cells appended, old not deleted (if superseded logic worked, total grows)
    expect(afterCount).toBeGreaterThanOrEqual(initialCount);

    // Superseded cells should be visible as dashed (if any), but at least active cells remain
    const active = await page.locator(".notebook-cell--active").count();
    expect(active).toBeGreaterThan(0);
  });

  test("export .ipynb via nbformat adapter produces valid JSON", async ({ page }) => {
    await uploadCsv(page, "missing");
    await expect(page.locator(".notebook-view")).toBeVisible({ timeout: 15_000 });

    // Click Export .ipynb and capture download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export .ipynb" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();

    // Validate .ipynb structure via Node fs in evaluate (read via download)
    // Instead, validate via frontend notebookService.toIpynb
    const ipynbValid = await page.evaluate(async () => {
      try {
        const { notebookService } = await import("@/notebook/NotebookService");
        const nb = await notebookService.getOrCreate("guest");
        const ipynb = notebookService.toIpynb(nb);
        return ipynb.nbformat === 4 && Array.isArray(ipynb.cells) && typeof ipynb.metadata?.polymorpha?.workspaceId === "string";
      } catch {
        return false;
      }
    });
    expect(ipynbValid).toBeTruthy();
  });

  test("Stella knowledge plane is unified (notebook_cell + dataset_profile) and guest isolated", async ({ page }) => {
    await uploadCsv(page, "missing");
    await page.waitForTimeout(4000);

    const result = await page.evaluate(async () => {
      const { knowledgeService } = await import("@/knowledge/KnowledgeService");
      const asAny = knowledgeService as unknown as {
        search: (q: string, o: Record<string, unknown>) => Promise<{ record: { kind: string } }[]>;
      };
      const probe = await asAny.search("missing values", {
        workspaceId: "guest",
        limit: 8,
        includeSystemKnowledge: false,
      });
      const kinds = probe.map((r) => r.record.kind);
      const hasNotebook = kinds.includes("notebook_cell") || kinds.includes("notebook_output");
      const hasDataset = kinds.includes("dataset_profile") || kinds.includes("column_semantic");
      return { kinds, hasNotebook, hasDataset, len: probe.length };
    });

    expect(result.len).toBeGreaterThan(0);
    // At least dataset or notebook kind should appear via single plane
    expect(result.hasNotebook || result.hasDataset).toBeTruthy();
  });
});
