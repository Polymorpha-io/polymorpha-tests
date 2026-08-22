export function formatDate(d: Date | string | number | unknown): string {
  try {
    const date = d instanceof Date ? d : new Date(d as string | number);
    if (isNaN(date.getTime())) return String(d ?? "");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(d ?? "");
  }
}
