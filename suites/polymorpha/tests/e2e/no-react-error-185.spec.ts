import { test, expect } from "@playwright/test";

/**
 * Smoke: page loads without React error #185 ("Maximum update depth exceeded").
 * Uses relative navigation via baseURL (playwright.config.ts:15) — do not hard-code 5173/8787.
 */
test("no react error 185", async ({ page }) => {
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", err => errors.push(err.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const html = await page.content();
  console.log("ERRORS:", errors.slice(0,3).join(" | ").slice(0,1000));
  console.log("HAS_SOMETHING_WRONG:", html.includes("Something went wrong"));
  expect(html).not.toContain("Something went wrong");
});
