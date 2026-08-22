/**
 * sanitizeFileName — deterministic, filesystem-safe basename for exports.
 * Policy per design doc section 7:
 * - NFKC normalize Unicode
 * - Strip path separators \/: and forbidden <>:"|?*
 * - Replace leading dots with "-"
 * - Cap at 200 chars (preserve meaning, not extension)
 * - Trim whitespace, fallback to "dataset"
 */
const FORBIDDEN_RE = /[\\/:*?"<>|]/g;
const CONTROL_RE = /[\x00-\x1F\x7F]/g;

export function sanitizeFileName(input: string): string {
  if (!input || input.trim().length === 0) return "dataset";
  let base = input.normalize("NFKC").trim();
  base = base.replace(FORBIDDEN_RE, "-");
  base = base.replace(CONTROL_RE, "");
  // Collapse repeated dashes and spaces
  base = base.replace(/\s+/g, " ").trim();
  // Leading dots → "-"
  base = base.replace(/^\.+/, "-");
  if (base.length === 0) return "dataset";
  if (/^-+$/.test(base)) return "dataset";
  // Remove trailing dots/spaces (Windows)
  base = base.replace(/[. ]+$/, "");
  if (base.length === 0) return "dataset";
  if (/^-+$/.test(base)) return "dataset";
  if (base.length > 200) base = base.slice(0, 200).trimEnd();
  if (base.length === 0) return "dataset";
  // Prevent reserved names (Windows)
  const reserved = new Set([
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ]);
  if (reserved.has(base.toUpperCase())) return `_${base}`;
  return base;
}

export function buildExportFileName(
  sanitizedBase: string,
  ext: string,
  prefix = "polymorpha-report",
): string {
  const base = sanitizeFileName(sanitizedBase);
  const cleanExt = ext.replace(/^\./, "").toLowerCase();
  return `${prefix}-${base}.${cleanExt}`;
}
