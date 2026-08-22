/**
 * Analytics — batched anonymous tracking with sendBeacon support.
 *
 * Replaces scattered logEvent calls with a cohesive class.
 * Events are queued and flushed every 5s, or sent immediately
 * via sendBeacon for page-unload scenarios.
 */

import { readStorageValue, writeStorageValue } from "./storage";

const VISITOR_KEY = "ss_vid";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TrackingPayload {
  type: "upload" | "download" | "pageview" | "test" | "workspace-open";
  vid: string;
  referrer: string;
  screen: string;
  locale: string;
  path: string;
  utm?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export class Analytics {
  private visitorId: string;
  private queue: TrackingPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private endpoint: string;

  constructor(endpoint: string = "/api/track") {
    this.endpoint = endpoint;
    this.visitorId = this._resolveVisitorId();
  }

  /** Queue an event for batched delivery. */
  track(
    type: "upload" | "download" | "pageview" | "test" | "workspace-open",
    meta?: Record<string, unknown>,
  ): void {
    this.queue.push({
      type,
      vid: this.visitorId,
      referrer: document.referrer || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      locale: navigator.language || "",
      path: window.location.pathname,
      utm: this._getUtmParams(),
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
    });
    this._ensureFlush();
  }

  /** Fire immediately via sendBeacon (for page unload). */
  sendBeacon(
    type: "upload" | "download" | "pageview",
    meta?: Record<string, unknown>,
  ): void {
    const payload: TrackingPayload = {
      type,
      vid: this.visitorId,
      referrer: document.referrer || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      locale: navigator.language || "",
      path: window.location.pathname,
      utm: this._getUtmParams(),
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
    };
    try {
      navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
    } catch {
      /* silent */
    }
  }

  /** Destroy the flush timer (call on app teardown). */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this._flush();
  }

  // Private

  private _resolveVisitorId(): string {
    let vid = readStorageValue(VISITOR_KEY);
    if (!vid || !UUID_RE.test(vid)) {
      vid = crypto.randomUUID();
      writeStorageValue(VISITOR_KEY, vid);
    }
    return vid;
  }

  private _getUtmParams(): Record<string, string> | undefined {
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

  private _ensureFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this._flush(), 5000);
  }

  private _flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    try {
      const body =
        batch.length === 1 ? JSON.stringify(batch[0]) : JSON.stringify(batch);
      navigator.sendBeacon(this.endpoint, body);
    } catch {
      /* silent */
    }
  }
}

// Singleton — use everywhere
export const analytics = new Analytics();
