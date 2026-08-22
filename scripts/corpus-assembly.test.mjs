import { describe, expect, it } from "vitest";
import { assembleCorpus } from "./corpus-assembly.mjs";

const TARGET_ID = "target-paper";

function paper({ id, status, identifiers }) {
  return {
    id,
    status,
    identifiers,
    title: `${id} title`,
    sourceLinks: [],
    importProvenance: [],
    modificationHistory: [],
    citationCoverage: {
      outgoingFound: 0,
      outgoingResolved: 0,
      incomingFound: 0,
      incomingResolved: 0,
      incomingStatus: "queued",
      providerSearchesAttempted: 0,
      recursiveClosureComplete: false,
      note: "Citation worker state",
    },
  };
}

function statement(id, paperId, globalStatementId = `${paperId}.${id.toLowerCase()}`) {
  return { id, paperId, globalStatementId };
}

function fixture() {
  const primaryPaper = paper({
    id: "primary-paper",
    status: "gold",
    identifiers: { internal: "primary-record" },
  });
  const provisional = {
    ...paper({
      id: TARGET_ID,
      status: "provisional",
      identifiers: { doi: "10.1000/target" },
    }),
    contributionSummary: "Metadata only",
    sourceLinks: [{ label: "DOI", url: "https://doi.org/10.1000/target" }],
    importProvenance: [{
      provider: "Crossref",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      recordId: "10.1000/target",
    }],
    modificationHistory: [{
      version: "metadata-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      contributors: ["Metadata worker"],
      summary: "Created metadata record.",
    }],
  };
  const otherPaper = paper({
    id: "other-paper",
    status: "provisional",
    identifiers: { openAlex: "W200" },
  });
  const edge = { id: "citation-primary-target" };
  const queueItem = { paperId: TARGET_ID, state: "metadata-fetched" };
  const goldStatement = statement("TARGET_S01_T01", TARGET_ID);
  const goldPack = {
    paper: {
      id: TARGET_ID,
      status: "gold",
      identifiers: {
        doi: "https://doi.org/10.1000/TARGET",
        arxiv: "2401.00001v2",
      },
      title: "Reviewed gold title",
      contributionSummary: "Theorem-level distillation",
      rewriteStatus: "partial-distillation",
      sourceLinks: [
        { label: "DOI", url: "https://doi.org/10.1000/target" },
        { label: "arXiv", url: "https://arxiv.org/abs/2401.00001" },
      ],
      importProvenance: [{
        provider: "arXiv source audit",
        retrievedAt: "2026-02-01T00:00:00.000Z",
        recordId: "2401.00001v2",
      }],
      modificationHistory: [{
        version: "gold-1",
        timestamp: "2026-02-01T00:00:00.000Z",
        contributors: ["Distiller"],
        summary: "Promoted to gold.",
      }],
      citationCoverage: {
        outgoingFound: 999,
        note: "A gold pack must not own citation coverage",
      },
    },
    statements: [goldStatement],
  };

  return {
    input: {
      schemaVersion: "1.0.0",
      generatedAt: "2026-02-02T00:00:00.000Z",
      primaryPapers: [primaryPaper],
      primaryStatements: [statement("PRIMARY_S01_T01", primaryPaper.id)],
      neighborhood: {
        papers: [provisional, otherPaper],
        citationEdges: [edge],
        ingestionQueue: [queueItem],
      },
      goldPacks: [goldPack],
    },
    provisional,
    edge,
    queueItem,
  };
}

describe("assembleCorpus", () => {
  it("promotes a self-contained provisional citation seed into its primary gold paper", () => {
    const { input } = fixture();
    const primary = input.primaryPapers[0];
    const provisionalSeed = {
      ...paper({ id: primary.id, status: "provisional", identifiers: {} }),
      sourceLinks: [{ label: "Citation audit", url: "https://example.com/citation-audit" }],
      importProvenance: [{
        provider: "author-manuscript citation audit",
        retrievedAt: "2026-01-01T00:00:00.000Z",
        recordId: primary.id,
      }],
      modificationHistory: [{
        version: "citation-audit-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        contributors: ["Citation auditor"],
        summary: "Created the citation seed.",
      }],
      citationCoverage: {
        ...primary.citationCoverage,
        outgoingFound: 17,
        outgoingResolved: 17,
      },
    };
    input.neighborhood.papers.unshift(provisionalSeed);

    const result = assembleCorpus(input);
    const assembledPrimary = result.papers.find((item) => item.id === primary.id);

    expect(result.papers.filter((item) => item.id === primary.id)).toHaveLength(1);
    expect(assembledPrimary).toMatchObject({
      status: "gold",
      identifiers: primary.identifiers,
      citationCoverage: provisionalSeed.citationCoverage,
    });
    expect(assembledPrimary.sourceLinks).toHaveLength(1);
    expect(assembledPrimary.importProvenance).toHaveLength(1);
    expect(assembledPrimary.modificationHistory).toHaveLength(1);
  });

  it("promotes a provisional paper in place and preserves citation-worker state", () => {
    const { input, provisional, edge, queueItem } = fixture();
    const result = assembleCorpus(input);

    expect(result.papers.map((item) => item.id)).toEqual([
      "primary-paper",
      TARGET_ID,
      "other-paper",
    ]);
    const promoted = result.papers[1];
    expect(promoted).toMatchObject({
      id: TARGET_ID,
      status: "gold",
      title: "Reviewed gold title",
      contributionSummary: "Theorem-level distillation",
      identifiers: {
        doi: "10.1000/target",
        arxiv: "2401.00001v2",
      },
      citationCoverage: provisional.citationCoverage,
    });
    expect(promoted.sourceLinks).toHaveLength(2);
    expect(promoted.importProvenance).toHaveLength(2);
    expect(promoted.modificationHistory).toHaveLength(2);
    expect(result.statements.map((item) => item.id)).toEqual([
      "PRIMARY_S01_T01",
      "TARGET_S01_T01",
    ]);
    expect(result.citationEdges).toEqual([edge]);
    expect(result.ingestionQueue).toEqual([queueItem]);
    expect(input.neighborhood.papers[0].status).toBe("provisional");
  });

  it("requires an exact provisional paper ID even when an identifier matches", () => {
    const { input } = fixture();
    input.goldPacks[0].paper.id = "renamed-target";
    input.goldPacks[0].statements = [];

    expect(() => assembleCorpus(input)).toThrow(/exact ID/i);
  });

  it("rejects a gold pack that changes an existing stable identifier", () => {
    const { input } = fixture();
    input.goldPacks[0].paper.identifiers.doi = "10.1000/different";

    expect(() => assembleCorpus(input)).toThrow(/conflicts.*doi identifier/i);
  });

  it("rejects stable identifiers owned by a different paper", () => {
    const { input } = fixture();
    input.goldPacks[0].paper.identifiers.openAlex = "https://openalex.org/W200";

    expect(() => assembleCorpus(input)).toThrow(/stable identifier collision/i);
  });

  it("rejects paper and statement ID collisions", () => {
    const duplicatePaper = fixture().input;
    duplicatePaper.primaryPapers.push({ ...duplicatePaper.neighborhood.papers[0] });
    expect(() => assembleCorpus(duplicatePaper)).toThrow(/duplicate paper ID/i);

    const duplicateStatement = fixture().input;
    duplicateStatement.goldPacks[0].statements[0].id = "PRIMARY_S01_T01";
    expect(() => assembleCorpus(duplicateStatement)).toThrow(/duplicate statement ID/i);
  });

  it("requires pack statements to use their paper and canonical global namespace", () => {
    const wrongPaper = fixture().input;
    wrongPaper.goldPacks[0].statements[0].paperId = "other-paper";
    expect(() => assembleCorpus(wrongPaper)).toThrow(/must belong to target-paper/i);

    const wrongNamespace = fixture().input;
    wrongNamespace.goldPacks[0].statements[0].globalStatementId = "other-paper.s01-t01";
    expect(() => assembleCorpus(wrongNamespace)).toThrow(/global namespace/i);
  });
});
