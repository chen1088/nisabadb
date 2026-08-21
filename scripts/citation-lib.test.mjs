import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { paperSchema } from "../src/data/schema.ts";
import {
  cacheFileNameForUrl,
  createCacheEnvelope,
  eligibleQueueItems,
  findExactPaperMatch,
  integrateOpenAlexNeighborhood,
  mergeCitationEdge,
  mergePaperRecord,
  mergeQueueItem,
  openAlexWorkToPaper,
  outgoingFetchOptions,
} from "./citation-lib.mjs";
import { mergeAuditIntoSnapshot } from "./citation-snapshot-lib.mjs";

const fixture = JSON.parse(await readFile(
  resolve("data/citations/fixtures/openalex-work.json"),
  "utf8",
));
const directAudit = JSON.parse(await readFile(
  resolve("data/citations/direct-neighborhood-audit.json"),
  "utf8",
));

describe("stable-identifier deduplication", () => {
  it("deduplicates records with an exact normalized stable ID", () => {
    const existing = {
      id: "curated-paper",
      title: "A curated title",
      identifiers: { doi: "10.5555/fixture.2024.1" },
      sourceLinks: [],
      importProvenance: [],
    };
    const candidate = {
      id: "provider-paper",
      title: "A completely different provider title",
      identifiers: { doi: "https://doi.org/10.5555/FIXTURE.2024.1" },
      sourceLinks: [],
      importProvenance: [],
    };
    expect(findExactPaperMatch([existing], candidate)?.id).toBe("curated-paper");
    const merged = mergePaperRecord([existing], candidate);
    expect(merged.added).toBe(false);
    expect(merged.paperId).toBe("curated-paper");
    expect(merged.papers).toHaveLength(1);
  });

  it("never deduplicates by title alone", () => {
    const existing = {
      id: "first-paper",
      title: "The Same Title",
      identifiers: { openAlex: "W1" },
      sourceLinks: [],
      importProvenance: [],
    };
    const candidate = {
      id: "second-paper",
      title: "The Same Title",
      identifiers: { openAlex: "W2" },
      sourceLinks: [],
      importProvenance: [],
    };
    expect(findExactPaperMatch([existing], candidate)).toBeUndefined();
    expect(mergePaperRecord([existing], candidate).papers).toHaveLength(2);
  });
});

describe("OpenAlex mapping", () => {
  it("maps a provider work to a schema-compatible provisional paper", () => {
    const paper = openAlexWorkToPaper(fixture, "2026-08-21T20:00:00.000Z");
    expect(paperSchema.parse(paper)).toEqual(paper);
    expect(paper.id).toBe("openalex-w999000111");
    expect(paper.identifiers).toMatchObject({
      openAlex: "W999000111",
      doi: "10.5555/fixture.2024.1",
    });
    expect(paper.authors).toEqual(["Ada Example", "Emmy Fixture"]);
  });
});

describe("provenance-preserving merges", () => {
  it("merges duplicate endpoint edges while retaining distinct evidence", () => {
    const base = {
      id: "citation-a-b",
      citingPaperId: "a",
      citedPaperId: "b",
      discoveredFromPaperId: "a",
      discoveryDirection: "outgoing",
      provenance: [{
        provider: "OpenAlex",
        providerRecordId: "W2",
        retrievedAt: "2026-08-21T20:00:00.000Z",
        evidenceUrl: "https://api.openalex.org/works/W1",
      }],
      confidence: "provider-linked",
    };
    const second = {
      ...base,
      id: "another-id-for-the-same-edge",
      provenance: [{
        provider: "OpenAlex",
        providerRecordId: "W2",
        retrievedAt: "2026-08-22T20:00:00.000Z",
        evidenceUrl: "https://api.openalex.org/works?filter=cites:W2",
      }],
      confidence: "exact-id",
    };
    const merged = mergeCitationEdge([base], second);
    expect(merged.added).toBe(false);
    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0].provenance).toHaveLength(2);
    expect(merged.edges[0].confidence).toBe("exact-id");
  });

  it("adds queue tasks without resetting a completed item", () => {
    const candidate = {
      paperId: "paper-a",
      state: "metadata-fetched",
      nextTasks: ["fetch-incoming", "deduplicate"],
      attempts: 0,
      updatedAt: "2026-08-21T20:00:00.000Z",
    };
    const active = { ...candidate, nextTasks: ["fetch-outgoing"] };
    expect(mergeQueueItem([active], candidate).queue[0].nextTasks).toEqual([
      "fetch-outgoing",
      "fetch-incoming",
      "deduplicate",
    ]);

    const complete = { ...active, state: "complete-direct-neighborhood", nextTasks: [] };
    expect(mergeQueueItem([complete], candidate).queue[0]).toEqual(complete);
  });

  it("builds deterministic cache envelopes keyed by the exact request URL", () => {
    const url = "https://api.openalex.org/works?filter=cites%3AW123&cursor=*";
    const body = { meta: { count: 1 }, results: [fixture] };
    const envelope = createCacheEnvelope(url, "2026-08-21T20:00:00.000Z", body);
    expect(envelope).toEqual({
      url,
      retrievedAt: "2026-08-21T20:00:00.000Z",
      body,
    });
    expect(cacheFileNameForUrl(url)).toMatch(/^[0-9a-f]{64}\.json$/);
    expect(cacheFileNameForUrl(url)).toBe(cacheFileNameForUrl(url));
    expect(cacheFileNameForUrl(`${url}&page=2`)).not.toBe(cacheFileNameForUrl(url));
  });
});

describe("resumable neighborhood state", () => {
  it("refreshes only outgoing batches that previously retained unresolved IDs", () => {
    expect(outgoingFetchOptions({
      paperId: "paper-a",
      unresolvedProviderIds: ["W404000999"],
    })).toEqual({ refresh: true });
    expect(outgoingFetchOptions({
      paperId: "paper-b",
      unresolvedProviderIds: [],
    })).toEqual({ refresh: false });
    expect(outgoingFetchOptions({ paperId: "paper-c" })).toEqual({ refresh: false });
  });

  it("retains unresolved outgoing provider IDs instead of marking the item complete", () => {
    const retrievedAt = "2026-08-21T20:00:00.000Z";
    const seedWork = {
      ...fixture,
      id: "https://openalex.org/W777000111",
      ids: { ...fixture.ids, openalex: "https://openalex.org/W777000111" },
      doi: "https://doi.org/10.5555/seed.2026.1",
      title: "Seed work with one missing reference",
      referenced_works: [fixture.id, "https://openalex.org/W404000999"],
    };
    const seedPaper = openAlexWorkToPaper(seedWork, retrievedAt);
    const snapshot = {
      papers: [seedPaper],
      citationEdges: [],
      ingestionQueue: [{
        paperId: seedPaper.id,
        state: "metadata-fetched",
        nextTasks: ["fetch-outgoing", "fetch-incoming", "deduplicate"],
        attempts: 0,
        updatedAt: retrievedAt,
      }],
    };
    const result = integrateOpenAlexNeighborhood(snapshot, {
      paperId: seedPaper.id,
      seed: { work: seedWork, url: seedWork.id, retrievedAt },
      outgoing: [{ work: fixture, url: fixture.id, retrievedAt }],
      incoming: [],
      completedAt: "2026-08-21T21:00:00.000Z",
    });
    const queueItem = result.snapshot.ingestionQueue[0];
    const coverage = result.snapshot.papers.find((paper) => paper.id === seedPaper.id).citationCoverage;

    expect(coverage).toMatchObject({ outgoingFound: 2, outgoingResolved: 1 });
    expect(queueItem).toMatchObject({
      state: "metadata-fetched",
      nextTasks: ["fetch-outgoing"],
      unresolvedProviderIds: ["W404000999"],
    });
    expect(eligibleQueueItems(result.snapshot).map((item) => item.paperId)).toContain(seedPaper.id);

    const recoveredWork = {
      ...fixture,
      id: "https://openalex.org/W404000999",
      ids: {
        ...fixture.ids,
        openalex: "https://openalex.org/W404000999",
        doi: "https://doi.org/10.5555/recovered.2026.1",
      },
      doi: "https://doi.org/10.5555/recovered.2026.1",
      title: "Previously unresolved reference",
    };
    const retried = integrateOpenAlexNeighborhood(result.snapshot, {
      paperId: seedPaper.id,
      seed: { work: seedWork, url: seedWork.id, retrievedAt },
      outgoing: [{ work: recoveredWork, url: recoveredWork.id, retrievedAt }],
      incoming: [],
      completedAt: "2026-08-21T22:00:00.000Z",
    });
    expect(retried.snapshot.papers.find((paper) => paper.id === seedPaper.id)?.citationCoverage)
      .toMatchObject({ outgoingFound: 2, outgoingResolved: 2 });
    expect(retried.snapshot.ingestionQueue[0]).toMatchObject({
      state: "complete-direct-neighborhood",
      nextTasks: [],
    });
    expect(retried.snapshot.ingestionQueue[0]).not.toHaveProperty("unresolvedProviderIds");
  });

  it("merges the reviewed baseline without erasing recursive progress", () => {
    const baseline = mergeAuditIntoSnapshot(directAudit);
    expect(eligibleQueueItems(baseline)).toHaveLength(16);
    const recursivePaper = {
      ...baseline.papers[0],
      id: "openalex-w888000111",
      title: "Recursively discovered paper",
      identifiers: { openAlex: "W888000111" },
    };
    const withProgress = {
      papers: [...baseline.papers, recursivePaper],
      citationEdges: [...baseline.citationEdges, {
        id: "citation-recursive-edge",
        citingPaperId: baseline.papers[0].id,
        citedPaperId: recursivePaper.id,
        discoveredFromPaperId: baseline.papers[0].id,
        discoveryDirection: "outgoing",
        provenance: [{
          provider: "OpenAlex",
          providerRecordId: "W888000111",
          retrievedAt: directAudit.auditAsOf,
        }],
        confidence: "provider-linked",
      }],
      ingestionQueue: [...baseline.ingestionQueue, {
        paperId: recursivePaper.id,
        state: "metadata-fetched",
        nextTasks: ["fetch-outgoing"],
        attempts: 0,
        updatedAt: directAudit.auditAsOf,
      }],
    };
    const rebuilt = mergeAuditIntoSnapshot(directAudit, withProgress);
    const isbnOnly = rebuilt.ingestionQueue.find((item) =>
      item.paperId === "james-kerber-1981-representation-theory-symmetric-group");
    const isbnOnlyPaper = rebuilt.papers.find((paper) =>
      paper.id === "james-kerber-1981-representation-theory-symmetric-group");

    expect(rebuilt.papers.some((paper) => paper.id === recursivePaper.id)).toBe(true);
    expect(rebuilt.citationEdges.some((edge) => edge.id === "citation-recursive-edge")).toBe(true);
    expect(rebuilt.ingestionQueue.some((item) => item.paperId === recursivePaper.id)).toBe(true);
    expect(isbnOnly).toMatchObject({ state: "blocked", nextTasks: ["resolve-identifiers"] });
    expect(isbnOnlyPaper?.citationCoverage).toMatchObject({
      incomingStatus: "identifier-unresolved",
      recursiveClosureComplete: false,
      note: expect.stringContaining("blocked pending identifier resolution"),
    });
    expect(eligibleQueueItems(rebuilt)).toHaveLength(17);
  });

  it("preserves an existing blocked audited job during a baseline merge", () => {
    const baseline = mergeAuditIntoSnapshot(directAudit);
    const paperId = "blais-2009-testing-juntas-nearly-optimally";
    const blockedAt = "2026-08-22T10:00:00.000Z";
    const withBlockedJob = {
      ...baseline,
      ingestionQueue: baseline.ingestionQueue.map((item) => item.paperId === paperId ? {
        paperId,
        state: "blocked",
        nextTasks: ["review-match"],
        attempts: 3,
        updatedAt: blockedAt,
        lastError: "Manual identity review required.",
      } : item),
    };

    const rebuilt = mergeAuditIntoSnapshot(directAudit, withBlockedJob);
    expect(rebuilt.ingestionQueue.find((item) => item.paperId === paperId)).toEqual({
      paperId,
      state: "blocked",
      nextTasks: ["review-match"],
      attempts: 3,
      updatedAt: blockedAt,
      lastError: "Manual identity review required.",
    });
  });
});
