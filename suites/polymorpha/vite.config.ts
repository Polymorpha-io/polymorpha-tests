import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.VITEST || process.env.DISABLE_CLOUDFLARE
      ? []
      : [cloudflare()]),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mocks": path.resolve(__dirname, "tests/mocks"),
    },
  },
  server: {
    // Wrangler :8787 is primary via .\dev.ps1 (dev.ps1:254 npx wrangler dev --port 8787, T7).
    // Vite proxy below is fallback only when running `npm run dev` without Wrangler — keep in sync with src/worker.ts:61 getApiUpstream.
    // E2E uses Vite :5173 fallback via playwright.config.ts:35 webServer; do not hard-code 127.0.0.1:8787 in specs.
    proxy: {
      "/api/v1/proxy": {
        target: "http://localhost",
        changeOrigin: true,
        // @ts-ignore: vite's http-proxy typings don't include router but it works
        router: (req: any) => {
          try {
            const urlParam = new URL(
              req.url || "/",
              `http://localhost`,
            ).searchParams.get("url");
            if (urlParam) {
              return new URL(urlParam).origin;
            }
          } catch (e) {
            // fallback
          }
          return "http://localhost";
        },
        rewrite: (path) => {
          try {
            const urlParam = new URL(path, `http://localhost`).searchParams.get(
              "url",
            );
            if (urlParam) {
              const targetUrl = new URL(urlParam);
              return targetUrl.pathname + targetUrl.search;
            }
          } catch (e) {
            // fallback
          }
          return path;
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept", "application/json, text/csv, */*");
            proxyReq.setHeader("User-Agent", "Polymorpha-Ingestion/1.0");
          });
        },
      },
      "/api/v1/stats": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/v1/machine-learning": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/v1/parse": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/v1/clean": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/v1/execute": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  define: {
    // plotly.js references Node's `global` — polyfill it for the browser
    global: "{}",
  },
  css: {
    transformer: "postcss",
    postcss: {
      plugins: [
        {
          postcssPlugin: "resolve-media-css-vars",
          Once(root) {
            root.walkAtRules("media", (rule) => {
              rule.params = rule.params
                .replace(/var\(--bp-xs\)/g, "480px")
                .replace(/var\(--bp-sm\)/g, "640px")
                .replace(/var\(--bp-md\)/g, "768px")
                .replace(/var\(--bp-lg\)/g, "1024px")
                .replace(/var\(--bp-xl\)/g, "1280px");
            });
          },
        },
      ],
    },
  },
  optimizeDeps: {
    exclude: ["monaco-editor"],
  },
  build: {
    sourcemap: false,
    // Heavy vendor chunks are intentional: charts ~9MB (Plotly) + monaco ~3.8MB + pdf ~1.3MB are
    // isolated via manualChunks. Raise limit above them so build is warning-free while still
    // catching accidental growth in the main index chunk (~1.9MB).
    chunkSizeWarningLimit: 10000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("react-dom") ||
            id.includes("react-router-dom") ||
            id.includes("react-plotly.js") ||
            /node_modules[\\/]react[\\/]/.test(id)
          )
            return "react";
          if (id.includes("firebase")) return "firebase";
          if (id.includes("plotly.js")) return "charts";
          if (id.includes("pdfmake")) return "pdf";
          if (id.includes("docx")) return "docx";
          if (id.includes("xlsx")) return "excel";
          if (id.includes("katex")) return "katex";
          if (id.includes("monaco-editor")) return "monaco";
          if (id.includes("ag-grid")) return "ag-grid";
          if (id.includes("@xenova") || id.includes("transformers"))
            return "transformers";
          if (id.includes("@xyflow")) return "xyflow";
          return undefined;
        },
      },
      onwarn(warning, handler) {
        if (
          warning.code === "MISSING_EXPORT" &&
          warning.message.includes("ViewLayout")
        )
          return;
        handler(warning);
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/api/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    reporters: ["default"],
  },
});
