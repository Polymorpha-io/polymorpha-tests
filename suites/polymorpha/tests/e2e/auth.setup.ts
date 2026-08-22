import { test as setup } from "@playwright/test";
import { signInWithTestAccount } from "./helpers";

/**
 * One-time sign-in for auth-gated specs. Saves the authenticated context
 * (cookies + localStorage — the Firebase session) to `tests/.auth/user.json`,
 * which the auth-gated specs reuse via storageState.
 *
 * Uses the dedicated E2E email/password account — fully automatable and
 * headless (no Google bot detection, no 2FA). Re-runs on every invocation so
 * the saved session never goes stale; the whole flow takes a few seconds.
 */
setup(
  "sign in with the E2E test account and save storage state",
  async ({ page }) => {
    await signInWithTestAccount(page);
    await page
      .getByRole("heading", { name: "Your Workspaces" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await page.context().storageState({ path: "tests/.auth/user.json" });
  },
);
