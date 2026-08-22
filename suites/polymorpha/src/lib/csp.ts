/**
 * csp — single source of truth for Content-Security-Policy and Permissions-Policy.
 * Generated into public/_headers via scripts/gen-headers.mjs and injected per-request
 * in src/worker.ts via withSecurityHeaders(). Keeps G4 (never weaken CSP) drift-proof.
 */

export const THEME_HASH = "sha256-8Zf4oJ1a8r2x+placeholderHashForThemeJs=";

export const CSP_TEMPLATE = [
  "default-src 'self'",
  `script-src 'self' 'nonce-{NONCE}' 'strict-dynamic' '${THEME_HASH}' 'wasm-unsafe-eval' https://www.googletagmanager.com`,
  "style-src 'self' 'nonce-{NONCE}' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.firebaseio.com https://*.googleapis.com",
  "connect-src 'self' https://*.cloudfunctions.net https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.googletagmanager.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
].join(", ");
