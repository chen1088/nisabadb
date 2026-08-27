import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyRawBookDataRequest } from "./src/data/raw-book-publication-boundary.ts";

const sourceRegistry = JSON.parse(
  readFileSync(new URL("./data/knowledge/source-records.json", import.meta.url), "utf8"),
);
const compressionProgram = JSON.parse(
  readFileSync(new URL("./src/data/compression.json", import.meta.url), "utf8"),
);
const allowedCoverageFiles = new Set([
  "source-records.json",
  "verification-policy.json",
]);
const allowedBookDataPath = /^manifest\.json$/;

function serveKnowledgeCoverageData() {
  const knowledgeDataRoot = fileURLToPath(new URL("./data/knowledge/", import.meta.url));
  const bookDataRoot = fileURLToPath(new URL("./data/books/", import.meta.url));
  return {
    name: "serve-knowledge-coverage-data",
    configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const rawBookDataStatus = classifyRawBookDataRequest(request.url ?? "/");
        if (rawBookDataStatus !== null) {
          response.statusCode = rawBookDataStatus;
          response.end(rawBookDataStatus === 400 ? "Bad request" : "Not found");
          return;
        }
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        let decodedPathname: string;
        try {
          decodedPathname = decodeURIComponent(pathname);
        } catch {
          response.statusCode = 400;
          response.end("Bad request");
          return;
        }
        const marker = "/_knowledge-coverage/";
        const markerIndex = decodedPathname.indexOf(marker);
        if (markerIndex < 0) return next();
        const requestedPath = decodedPathname.slice(markerIndex + marker.length);
        const isBookData = requestedPath.startsWith("books/");
        const bookPath = isBookData ? requestedPath.slice("books/".length) : "";
        if ((!isBookData && !allowedCoverageFiles.has(requestedPath))
          || (isBookData && !allowedBookDataPath.test(bookPath))) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }
        const dataPath = isBookData ? `${bookDataRoot}/${bookPath}` : `${knowledgeDataRoot}/${requestedPath}`;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(readFileSync(dataPath, "utf8"));
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), serveKnowledgeCoverageData()],
  define: {
    __SOURCE_RECORD_COUNT__: JSON.stringify(sourceRegistry.records.length),
    __SOURCE_COMPONENT_COUNT__: JSON.stringify(
      sourceRegistry.records.reduce(
        (total: number, record: { requiredEditionComponents: unknown[] }) => total + record.requiredEditionComponents.length,
        0,
      ),
    ),
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
