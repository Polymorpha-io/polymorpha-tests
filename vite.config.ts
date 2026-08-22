import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "suites/polymorpha/src"),
      "@mocks": path.resolve(__dirname, "fixtures"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./suites/polymorpha/src/test/setup.ts"],
    include: [
      "suites/polymorpha/tests/unit/**/*.test.{ts,tsx}",
      "suites/polymorpha/tests/api/**/*.test.{ts,tsx}",
      "suites/**/*.test.{ts,tsx}",
    ],
    exclude: ["suites/polymorpha/tests/e2e/**", "node_modules/**"],
  },
});
