import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertPrivateCandidateDestinationSync,
  checkPublicBookGraphBoundarySync,
  trackedBookGraphPayloadPathsSync,
} from "./book-graph-publication-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("raw book-graph Git boundary", () => {
  it("tracks no raw graph index or shard", () => {
    expect([...checkPublicBookGraphBoundarySync(repositoryRoot)]).toEqual([]);
    expect([...trackedBookGraphPayloadPathsSync(repositoryRoot)]).toEqual([]);
  });

  it("requires importer destinations to be canonical, ignored, and untracked", () => {
    const candidate = path.join(repositoryRoot, "data", "books", "S9999", "complete-source.json");
    expect(assertPrivateCandidateDestinationSync(repositoryRoot, candidate))
      .toBe("data/books/S9999/complete-source.json");
    expect(() => assertPrivateCandidateDestinationSync(
      repositoryRoot,
      path.join(repositoryRoot, "data", "books", "manifest.json"),
    )).toThrow(/canonical private-cache storage/u);
  });
});
