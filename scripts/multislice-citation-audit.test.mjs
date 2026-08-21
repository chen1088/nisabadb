import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  citationEdgeSchema,
  ingestionQueueItemSchema,
  paperSchema,
} from "../src/data/schema.ts";
import {
  eligibleQueueItems,
  integrateOpenAlexNeighborhood,
} from "./citation-lib.mjs";
import { mergeAuditIntoSnapshot } from "./citation-snapshot-lib.mjs";
import {
  mergeMultisliceCitationAuditIntoSnapshot,
  MULTISLICE_PAPER_ID,
  validateMultisliceCitationAudit,
} from "./multislice-citation-audit-lib.mjs";

const directAudit = JSON.parse(await readFile(
  resolve("data/citations/direct-neighborhood-audit.json"),
  "utf8",
));
const multisliceAudit = JSON.parse(await readFile(
  resolve("data/citations/multislice-neighborhood-audit.json"),
  "utf8",
));

function reviewedSnapshot() {
  const baseline = mergeAuditIntoSnapshot(directAudit);
  return mergeMultisliceCitationAuditIntoSnapshot(multisliceAudit, baseline);
}

describe("reviewed multislice citation audit", () => {
  it("locks the independent source and provider counts", () => {
    expect(validateMultisliceCitationAudit(multisliceAudit)).toBe(multisliceAudit);
    expect(multisliceAudit.outgoing).toHaveLength(48);
    expect(new Set(multisliceAudit.outgoing.map((record) => record.bibKey)).size).toBe(48);
    expect(multisliceAudit.incoming).toHaveLength(28);
    expect(new Set(multisliceAudit.incoming.map((record) => record.openAlex)).size).toBe(28);
    expect(multisliceAudit.providerGaps.unresolvedReferencedWorkIds).toHaveLength(23);
    expect(multisliceAudit.outgoing.filter((record) =>
      record.identifiers.doi && record.doiEvidence !== "reviewed-existing-record"))
      .toHaveLength(20);
  });

  it("materializes 48 outgoing and 28 non-XPAC incoming endpoints with only two reviewed reuses", () => {
    const baseline = mergeAuditIntoSnapshot(directAudit);
    const { snapshot, stats } = mergeMultisliceCitationAuditIntoSnapshot(
      multisliceAudit,
      baseline,
    );
    const seed = snapshot.papers.find((paper) => paper.id === MULTISLICE_PAPER_ID);
    const outgoing = snapshot.citationEdges.filter((edge) =>
      edge.citingPaperId === MULTISLICE_PAPER_ID &&
      edge.provenance.some((entry) => entry.provider === "arXiv source bibliography"));
    const incoming = snapshot.citationEdges.filter((edge) =>
      edge.citedPaperId === MULTISLICE_PAPER_ID &&
      edge.provenance.some((entry) => entry.provider === "OpenAlex version-family via W3207594656"));
    const queueItem = snapshot.ingestionQueue.find((item) => item.paperId === MULTISLICE_PAPER_ID);

    expect(stats).toMatchObject({
      papersAdded: 74,
      edgesAdded: 76,
      outgoingEndpoints: 48,
      incomingEndpoints: 28,
      reviewedExistingPaperReuses: 2,
    });
    expect(snapshot.papers).toHaveLength(baseline.papers.length + 74);
    expect(outgoing).toHaveLength(48);
    expect(new Set(outgoing.map((edge) => edge.citedPaperId)).size).toBe(48);
    expect(incoming).toHaveLength(28);
    expect(new Set(incoming.map((edge) => edge.citingPaperId)).size).toBe(28);
    expect(seed.citationCoverage).toMatchObject({
      outgoingFound: 48,
      outgoingResolved: 48,
      incomingFound: 28,
      incomingResolved: 28,
      incomingStatus: "provider-visible-only",
      recursiveClosureComplete: false,
    });
    expect(seed.citationCoverage.note).toContain("FOCS identity W3207594656");
    expect(queueItem).toMatchObject({
      state: "neighbors-fetched",
      nextTasks: ["deduplicate", "review-match"],
    });
    expect(queueItem).not.toHaveProperty("unresolvedProviderIds");
    expect(eligibleQueueItems(snapshot).map((item) => item.paperId)).not.toContain(MULTISLICE_PAPER_ID);

    const outgoingTargets = new Set(outgoing.map((edge) => edge.citedPaperId));
    expect(outgoingTargets).toContain("ellis-friedgut-pilpel-2011-intersecting-families-permutations");
    expect(outgoingTargets).toContain("odonnell-2014-analysis-boolean-functions");
    expect(snapshot.papers.filter((paper) =>
      paper.id === "ellis-friedgut-pilpel-2011-intersecting-families-permutations")).toHaveLength(1);
    expect(snapshot.papers.filter((paper) =>
      paper.id === "odonnell-2014-analysis-boolean-functions")).toHaveLength(1);
    expect(snapshot.papers.find((paper) =>
      paper.id === "odonnell-2014-analysis-boolean-functions")?.importProvenance)
      .not.toContainEqual(expect.objectContaining({
        provider: "Crossref reference metadata",
        retrievedAt: multisliceAudit.auditAsOf,
      }));

    for (const paper of snapshot.papers) expect(paperSchema.parse(paper)).toEqual(paper);
    for (const edge of snapshot.citationEdges) expect(citationEdgeSchema.parse(edge)).toEqual(edge);
    for (const item of snapshot.ingestionQueue) expect(ingestionQueueItemSchema.parse(item)).toEqual(item);
  });

  it("is idempotent and never merges provider-version duplicates by title", () => {
    const first = reviewedSnapshot().snapshot;
    const second = mergeMultisliceCitationAuditIntoSnapshot(multisliceAudit, first);

    expect(second.stats.papersAdded).toBe(0);
    expect(second.stats.edgesAdded).toBe(0);
    expect(second.snapshot.papers).toHaveLength(first.papers.length);
    expect(second.snapshot.citationEdges).toHaveLength(first.citationEdges.length);
    expect(second.snapshot.ingestionQueue).toHaveLength(first.ingestionQueue.length);
    expect(second.snapshot.papers.some((paper) => paper.identifiers.openAlex === "W4281885517")).toBe(true);
    expect(second.snapshot.papers.some((paper) => paper.identifiers.openAlex === "W4412543997")).toBe(true);
    expect(second.snapshot.papers.some((paper) => paper.identifiers.openAlex === "W4316652390")).toBe(true);
    expect(second.snapshot.papers.some((paper) => paper.identifiers.openAlex === "W7132832390")).toBe(false);
  });

  it("prevents a generic OpenAlex refresh from replacing 48 or adding unmatched outgoing records", () => {
    const { snapshot } = reviewedSnapshot();
    const retrievedAt = "2026-08-21T22:00:00.000Z";
    const seedWork = {
      id: "https://openalex.org/W4413142925",
      ids: {
        openalex: "https://openalex.org/W4413142925",
        doi: "https://doi.org/10.1016/j.aim.2025.110460",
      },
      doi: "https://doi.org/10.1016/j.aim.2025.110460",
      display_name: "An invariance principle for the multi-slice, with applications",
      publication_date: "2025-11-01",
      type: "article",
      authorships: ["Mark Braverman", "Subhash Khot", "Noam Lifshitz", "Dor Minzer"]
        .map((display_name) => ({ author: { display_name } })),
      referenced_works: ["https://openalex.org/W990000001", "https://openalex.org/W990000002"],
    };
    const exactEndpoint = {
      id: "https://openalex.org/W990000001",
      ids: {
        openalex: "https://openalex.org/W990000001",
        doi: "https://doi.org/10.1090/S0002-9947-1986-0857448-8",
      },
      doi: "https://doi.org/10.1090/S0002-9947-1986-0857448-8",
      display_name: "Provider spelling of the exact DOI endpoint",
      publication_date: "1986-01-01",
      type: "article",
      authorships: [{ author: { display_name: "Noga Alon" } }],
    };
    const unmatchedContainer = {
      id: "https://openalex.org/W990000002",
      ids: { openalex: "https://openalex.org/W990000002" },
      display_name: "Proceedings container returned for a cited article",
      publication_date: "2019-01-01",
      type: "book",
      authorships: [{ author: { display_name: "Unknown editor" } }],
    };

    const refreshed = integrateOpenAlexNeighborhood(snapshot, {
      paperId: MULTISLICE_PAPER_ID,
      seed: { work: seedWork, url: seedWork.id, retrievedAt },
      outgoing: [exactEndpoint, unmatchedContainer]
        .map((work) => ({ work, url: work.id, retrievedAt })),
      incoming: [],
      completedAt: "2026-08-21T22:05:00.000Z",
    });
    const seed = refreshed.snapshot.papers.find((paper) => paper.id === MULTISLICE_PAPER_ID);
    const queueItem = refreshed.snapshot.ingestionQueue.find((item) => item.paperId === MULTISLICE_PAPER_ID);
    const resolvedEndpointQueue = refreshed.snapshot.ingestionQueue.find((item) =>
      item.paperId === "alon-frankl-lovasz-1986-chromatic-kneser-hypergraphs");

    expect(seed.citationCoverage).toMatchObject({
      outgoingFound: 48,
      outgoingResolved: 48,
      incomingFound: 28,
      incomingResolved: 28,
      recursiveClosureComplete: false,
    });
    expect(refreshed.stats.providerOutgoingRecordsSkipped).toBe(1);
    expect(refreshed.snapshot.papers.some((paper) => paper.identifiers.openAlex === "W990000002")).toBe(false);
    expect(queueItem).toMatchObject({
      state: "neighbors-fetched",
      nextTasks: ["deduplicate", "review-match"],
    });
    expect(resolvedEndpointQueue).toMatchObject({
      state: "metadata-fetched",
      nextTasks: ["fetch-outgoing", "fetch-incoming", "deduplicate"],
    });
  });
});
