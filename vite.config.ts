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
      "@shared": path.resolve(__dirname, "suites/_shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./suites/polymorpha/src/test/setup.ts"],
    // @polymorpha/stella ships extensionless ESM (bundler-only); force it
    // through the vite pipeline instead of native node ESM resolution.
    // (Matched against resolved paths, hence no ^ anchor.)
    server: {
      deps: {
        inline: [/@polymorpha\/stella/],
      },
    },
    include: [
      "suites/polymorpha/tests/unit/**/*.test.{ts,tsx}",
      "suites/polymorpha/tests/api/**/*.test.{ts,tsx}",
      "suites/**/*.test.{ts,tsx}",
    ],
    exclude: ["suites/polymorpha/tests/e2e/**", "node_modules/**"],
  },
});
