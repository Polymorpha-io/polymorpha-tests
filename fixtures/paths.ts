import { resolve } from "path";
import { fileURLToPath } from "url";

/** E2E needs real filesystem paths for uploads — alias entries resolve via tsconfig `@mocks/*`. */
export function csvPath(name: string): string {
  const dir = resolve(fileURLToPath(import.meta.url), "..");
  return resolve(dir, `${name}.csv`);
}