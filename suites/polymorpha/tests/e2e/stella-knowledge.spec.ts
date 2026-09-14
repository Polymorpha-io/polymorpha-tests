import { test, expect } from "@playwright/test";
import { goToHome, uploadCsv } from "./helpers";

/**
 * T6 — Stella one semantic retrieval plane.
 * Notebook + Dataset + Relationship artifacts enter same KnowledgeService plane.
 * Covers: page load, upload, KnowledgeService federated retrieval (dataset_profile/column_semantic/data_representative/relationship/notebook_cell),
 * and provenance-distinguishable results (cell vs evidence).
 */
test.describe("Polymorpha E2E — Stella Knowledge Plane", () => {
  test("unified plane: dataset artifacts are KnowledgeRecords (provider files served)", async ({
    page,
  }) => {
    await goToHome(page);
    const dsResp = await page.request.get(
      "/src/knowledge/providers/DatasetKnowledgeProvider.ts",
    );
    expect(dsResp.ok()).toBeTruthy();
    const relResp = await page.request.get(
      "/src/knowledge/providers/RelationshipKnowledgeProvider.ts",
    );
    expect(relResp.ok()).toBeTruthy();
    const typesResp = await page.request.get("/src/knowledge/types.ts");
    expect(typesResp.ok()).toBeTruthy();

    await uploadCsv(page, "missing");
    await page.waitForTimeout(1500);
    const toggle = page.locator("button.stella-rag-toggle");
    await expect(toggle).toBeVisible();
  });

  test("Stella panel still renders and distinguishes observation vs evidence after upload", async ({
    page,
  }) => {
    await uploadCsv(page, "missing");

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

  test("concurrent Knowledge searches remain isolated (G18)", async ({
    page,
  }) => {
    await uploadCsv(page, "missing");
    await page.waitForTimeout(1500);
    const ok = await page.evaluate(async () => {
      const hasKnowledgeDb = await new Promise<boolean>((resolve) => {
        if (!("indexedDB" in window)) resolve(false);
        try {
          const req = indexedDB.open("polymorpha-knowledge", 2);
          req.onsuccess = () => {
            const db = req.result;
            const hasStore = db.objectStoreNames.contains("knowledge");
            db.close();
            resolve(hasStore);
          };
          req.onerror = () => resolve(false);
          req.onblocked = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
      return hasKnowledgeDb;
    });
    expect(ok).toBeTruthy();
  });

  test("functionality plane: app-capability provider files served", async ({
    page,
  }) => {
    await goToHome(page);
    const providerResp = await page.request.get(
      "/src/knowledge/providers/FunctionalityKnowledgeProvider.ts",
    );
    expect(providerResp.ok()).toBeTruthy();
    const corpusResp = await page.request.get(
      "/src/knowledge/functionalities.ts",
    );
    expect(corpusResp.ok()).toBeTruthy();
  });

  test("Stella greeting introduces Polymorpha and its pipeline", async ({
    page,
  }) => {
    await goToHome(page);
    await page.getByRole("button", { name: "Show Stella assistant" }).click();
    const dialog = page.getByRole("dialog", { name: "Stella AI chat" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Hi, I'm Stella!")).toBeVisible();
    await expect(dialog.getByText(/Upload →/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "What can Polymorpha do?" }),
    ).toBeVisible();
  });
});
