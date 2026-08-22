/**
 * Anonymous usage tracking.
 * POSTs to /api/track (Cloudflare Worker) which captures IP/geo server-side.
 * Uses a persistent visitor ID stored in localStorage.
 */

import { readStorageValue, writeStorageValue } from "./storage";

const VISITOR_KEY = "ss_vid";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getVisitorId(): string {
  let vid = readStorageValue(VISITOR_KEY);
  if (!vid || !UUID_RE.test(vid)) {
    vid = crypto.randomUUID();
    writeStorageValue(VISITOR_KEY, vid);
  }
  return vid;
}

function getUtmParams(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}

async function logEvent(
  type: "upload" | "download" | "pageview",
  meta?: Record<string, unknown>,
) {
  try {
    const vid = getVisitorId();
    const payload: Record<string, unknown> = {
      type,
      vid,
      referrer: document.referrer || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      locale: navigator.language || "",
      path: window.location.pathname,
      utm: getUtmParams(),
    };
    if (meta && Object.keys(meta).length > 0) {
      payload.meta = meta;
    }
    // Fire and forget — don't await in the UI thread
    navigator.sendBeacon("/api/track", JSON.stringify(payload));
  } catch {
    // Silent fail — tracking should never break the app
  }
}

export function trackUpload(rows?: number, cols?: number, colNames?: string[]) {
  logEvent("upload", { rows, cols, colNames });
}

export function trackDownload(format?: string) {
  logEvent("download", { format });
}

export function trackPageview() {
  logEvent("pageview");
}
