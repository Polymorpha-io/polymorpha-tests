import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CSP regression for the Stella OpenCode backend.
 *
 * The chat/fix transport fetches `http://127.0.0.1:4096` (STELLA_OPENCODE_URL)
 * from the browser; without that origin in the page CSP `connect-src` every
 * fetch throws `TypeError: Failed to fetch`, which the transport reports as
 * "OpenCode server unreachable" — even with the server up and CORS correct
 * (curl bypasses CSP, which masked this for a full session). This locks the
 * origin into the served policy so the local-only LLM feature stays usable.
 */

function csp(): string {
  const headers = readFileSync(
    resolve(__dirname, "../../public/_headers"),
    "utf-8",
  );
  const line = headers
    .split("\n")
    .find((l) => l.includes("Content-Security-Policy:"));
  if (!line) throw new Error("public/_headers has no Content-Security-Policy");
  return line;
}

describe("public/_headers CSP allows the Stella OpenCode backend", () => {
  it("connect-src contains the OpenCode server origin (127.0.0.1:4096)", () => {
    const policy = csp();
    const connect = /connect-src([^;]*);/.exec(policy)?.[1] ?? "";
    expect(connect).toContain("http://127.0.0.1:4096");
  });

  it("keeps the loopback allowance scoped — no blanket localhost scheme", () => {
    const connect = /connect-src([^;]*);/.exec(csp())?.[1] ?? "";
    // One exact origin, never a wildcard port/host that would widen the
    // page's reach into the visitor's loopback beyond the LLM endpoint.
    expect(connect).not.toMatch(/127\.0\.0\.1:(?!\*|4096)\d+/);
    expect(connect).not.toContain("http://*");
  });
});
