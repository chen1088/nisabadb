import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourceRegistry = JSON.parse(
  readFileSync(new URL("./data/knowledge/source-records.json", import.meta.url), "utf8"),
);
const compressionProgram = JSON.parse(
  readFileSync(new URL("./src/data/compression.json", import.meta.url), "utf8"),
);
const allowedCoverageFiles = new Set([
  "source-records.json",
  "coverage-ledger.json",
  "verification-policy.json",
]);

function serveKnowledgeCoverageData() {
  const dataRoot = fileURLToPath(new URL("./data/knowledge/", import.meta.url));
  return {
    name: "serve-knowledge-coverage-data",
    configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const marker = "/_knowledge-coverage/";
        const markerIndex = pathname.indexOf(marker);
        if (markerIndex < 0) return next();
        const filename = decodeURIComponent(pathname.slice(markerIndex + marker.length));
        if (!allowedCoverageFiles.has(filename)) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(readFileSync(`${dataRoot}/${filename}`, "utf8"));
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), serveKnowledgeCoverageData()],
  define: {
    __SOURCE_RECORD_COUNT__: JSON.stringify(sourceRegistry.records.length),
    __COMPRESSION_CLUSTER_COUNT__: JSON.stringify(compressionProgram.clusters.length),
    __COMPRESSION_RESIDUAL_COUNT__: JSON.stringify(
      compressionProgram.clusters.reduce(
        (total: number, cluster: { residuals: unknown[] }) => total + cluster.residuals.length,
        0,
      ),
    ),
    __COMPRESSION_SOURCE_FAMILY_COUNT__: JSON.stringify(compressionProgram.sourceFamilies.length),
    __SOURCE_BRANCH_COUNT__: JSON.stringify(sourceRegistry.families.length),
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
