import { describe, expect, it } from "vitest";
// Regression-lock the frozen Phase-II prototype only; Phase-I book graphs are
// validated independently in book-graph.test.ts and books:check.
import rawLedger from "../../data/knowledge/coverage-ledger.json";
import rawRegistry from "../../data/knowledge/source-records.json";
import rawVerificationPolicy from "../../data/knowledge/verification-policy.json";
import { knowledgeBook, knowledgeNodes } from "./knowledge";
import {
  assertLegacyPhaseTwoMappingComplete,
  deriveLegacyPhaseTwoCoverageSummary,
  validateLegacyPhaseTwoCoverage,
} from "./source-coverage-schema";

const targetContext = {
  knowledgeNodes: knowledgeNodes.map((node) => ({ id: node.id, contentSha256: node.contentSha256 })),
  knowledgeEdition: knowledgeBook.edition,
};
const adminReview = {
  actorId: "github:chen1088",
  actorRole: "administrator" as const,
  reviewedAt: "2026-08-22T00:00:00Z",
  evidenceSha256: "a".repeat(64),
  note: "Administrator-reviewed fixture.",
};
const extractionAudit = {
  actorId: "worker:fixture",
  extractedAt: "2026-08-21T00:00:00Z",
  artifactSha256: "d".repeat(64),
};
const proposalAudit = {
  actorId: "worker:fixture",
  proposedAt: "2026-08-21T00:00:00Z",
  artifactSha256: "9".repeat(64),
};

function validatedFixture() {
  return validateLegacyPhaseTwoCoverage(rawRegistry, rawLedger, rawVerificationPolicy, targetContext);
}

function addResolvedEdition() {
  const valid = validatedFixture();
  const registry = structuredClone(valid.registry);
  const ledger = structuredClone(valid.ledger);
  const sourceRecord = registry.records[1];
  if (!sourceRecord) throw new Error("missing source record fixture");
  sourceRecord.resolutionState = "resolved-editions";
  sourceRecord.editionIds = ["edition-one"];
  sourceRecord.resolutionProposalAudit = proposalAudit;
  sourceRecord.resolutionReview = adminReview;
  ledger.editions.push({
    id: "edition-one",
    sourceRecordId: "S0002",
    sourceComponentId: "complete-source",
    label: "Exact fixture edition",
    year: 2020,
    stableLocator: "isbn:fixture",
    artifactSha256: "b".repeat(64),
    unitManifestSha256: "c".repeat(64),
    scopeUnitKind: "page",
    sourceUnits: [{ id: "unit-1", ordinal: 1, locator: "page 1", contentSha256: "e".repeat(64) }],
    inventoryState: "indexing",
    extractionAudit: null,
    administrativeReview: null,
    auditNote: "Fixture edition.",
  });
  return { registry, ledger };
}

function scannedSegment(inventoryResult: { kind: "explicit-none"; theoremOccurrenceIds: []; reason: string } | { kind: "occurrences-found"; theoremOccurrenceIds: string[] }) {
  return {
    id: "segment-one",
    editionId: "edition-one",
    sequence: 0,
    locator: "page 1",
    sourceUnitIds: ["unit-1"],
    coverageState: "reviewed" as const,
    inventoryResult,
    sourceEvidence: {
      editionArtifactSha256: "b".repeat(64),
      unitManifestSha256: "c".repeat(64),
      extractionArtifactSha256: "d".repeat(64),
      evidenceLocator: "artifact://fixture/segment-one",
    },
    extractionAudit,
    administrativeReview: adminReview,
    note: "Fixture scan.",
  };
}

describe("frozen Phase-II source-to-Knowledge mapping prototype", () => {
  it("preserves and fingerprint-locks the agreed source list row for row", () => {
    const { registry, ledger } = validatedFixture();
    expect(registry.records).toHaveLength(688);
    expect(registry.families).toHaveLength(31);
    expect(registry.records[0]?.title).toMatch(/Beast Academy/i);
    expect(registry.records[0]?.requiredEditionComponents).toHaveLength(5);
    expect(registry.records.find((record) => record.id === "S0074")?.requiredEditionComponents).toHaveLength(3);
    expect(registry.records.at(-1)?.title).toMatch(/Handbook of Mathematics/i);
    expect(new Set(registry.records.map((record) => record.rawCitation)).size)
      .toBe(registry.records.length);

    expect(registry.approvedManifestSha256)
      .toBe("e92d2d91cc02fb2f980be5ed5d63605b8359c12f7d07d1ddef430d0cc672909a");

    const summary = deriveLegacyPhaseTwoCoverageSummary(registry, ledger);
    expect(summary).toEqual({
      sourceRecords: 688,
      resolvedRecords: 0,
      completeRecords: 0,
      editions: 0,
      completeEditions: 0,
      theoremOccurrences: 0,
      classifiedOccurrences: 0,
      terminalOccurrences: 0,
      verifiedMappings: 0,
      verifiedResiduals: 0,
      unresolvedOccurrences: 0,
      sourceUniverseComplete: false,
    });
    expect(() => assertLegacyPhaseTwoMappingComplete(registry, ledger)).toThrow(/0\/688/);
  });

  it("cannot call an administratively reviewed empty inventory complete", () => {
    const { registry, ledger } = addResolvedEdition();
    const edition = ledger.editions[0];
    if (!edition) throw new Error("missing edition fixture");
    edition.inventoryState = "audited-complete";
    edition.extractionAudit = extractionAudit;
    edition.administrativeReview = adminReview;
    ledger.scanSegments.push(scannedSegment({
      kind: "explicit-none",
      theoremOccurrenceIds: [],
      reason: "The extractor claims no theorem-like result exists.",
    }));
    expect(() => validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext))
      .toThrow(/empty theorem inventory/i);
  });

  it("cannot resolve a multi-volume row with only one declared volume", () => {
    const valid = validatedFixture();
    const registry = structuredClone(valid.registry);
    const ledger = structuredClone(valid.ledger);
    const sourceRecord = registry.records[0];
    if (!sourceRecord) throw new Error("missing multi-volume fixture");
    sourceRecord.resolutionState = "resolved-editions";
    sourceRecord.editionIds = ["beast-level-one"];
    sourceRecord.resolutionProposalAudit = proposalAudit;
    sourceRecord.resolutionReview = adminReview;
    ledger.editions.push({
      id: "beast-level-one",
      sourceRecordId: "S0001",
      sourceComponentId: "level-1",
      label: "Level 1 only",
      year: 2020,
      stableLocator: "isbn:fixture",
      artifactSha256: "b".repeat(64),
      unitManifestSha256: "c".repeat(64),
      scopeUnitKind: "page",
      sourceUnits: [{ id: "unit-1", ordinal: 1, locator: "page 1", contentSha256: "e".repeat(64) }],
      inventoryState: "not-started",
      extractionAudit: null,
      administrativeReview: null,
      auditNote: "Incomplete volume fixture.",
    });
    expect(() => validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext))
      .toThrow(/every required component/i);
  });

  it("rejects a verified core disposition that points nowhere", () => {
    const { registry, ledger } = addResolvedEdition();
    ledger.scanSegments.push(scannedSegment({ kind: "occurrences-found", theoremOccurrenceIds: ["occurrence-one"] }));
    ledger.theoremOccurrences.push({
      id: "occurrence-one",
      editionId: "edition-one",
      segmentId: "segment-one",
      sourceUnitId: "unit-1",
      kind: "theorem",
      sourceLabel: "Theorem 1",
      locator: "page 1",
      normalizedTitle: "Fixture theorem",
      normalizedClaim: "An independently rewritten fixture claim.",
      decisionStatus: "verified",
      disposition: "rewritten-core",
      targetCanonicalClaimIds: [],
      targetResidualArtifactIds: [],
      relation: null,
      reason: "Invalid fixture with no target.",
      decisionAudit: proposalAudit,
      administrativeReview: adminReview,
    });
    expect(() => validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext))
      .toThrow(/mapped disposition without a canonical target/i);
  });

  it("requires exact one-segment membership for every theorem occurrence", () => {
    const { registry, ledger } = addResolvedEdition();
    const edition = ledger.editions[0];
    if (!edition) throw new Error("missing edition fixture");
    edition.sourceUnits.push({ id: "unit-2", ordinal: 2, locator: "page 2", contentSha256: "f".repeat(64) });
    ledger.scanSegments.push(scannedSegment({ kind: "occurrences-found", theoremOccurrenceIds: ["occurrence-one"] }));
    ledger.scanSegments.push({
      ...scannedSegment({ kind: "occurrences-found", theoremOccurrenceIds: ["occurrence-one"] }),
      id: "segment-two",
      sequence: 1,
      locator: "page 2",
      sourceUnitIds: ["unit-2"],
    });
    ledger.theoremOccurrences.push({
      id: "occurrence-one",
      editionId: "edition-one",
      segmentId: "segment-one",
      sourceUnitId: "unit-1",
      kind: "theorem",
      sourceLabel: "Theorem 1",
      locator: "page 1",
      normalizedTitle: "Fixture theorem",
      normalizedClaim: "An independently rewritten fixture claim.",
      decisionStatus: "unclassified",
      disposition: "unclassified",
      targetCanonicalClaimIds: [],
      targetResidualArtifactIds: [],
      relation: null,
      reason: "Awaiting comparison.",
      decisionAudit: null,
      administrativeReview: null,
    });
    expect(() => validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext))
      .toThrow(/exact membership list/i);
  });

  it("rejects a source row that resolves to somebody else's edition", () => {
    const { registry, ledger } = addResolvedEdition();
    const edition = ledger.editions[0];
    if (!edition) throw new Error("missing edition fixture");
    edition.sourceRecordId = "S0003";
    expect(() => validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext))
      .toThrow(/edition owned by that source row/i);
  });

  it("allows completion only through a current Knowledge target and independent admin review", () => {
    const registry = {
      schemaVersion: "1.1.0",
      updatedAt: "2026-08-22",
      sourceSetName: "Single-source completion fixture",
      sourceSetRevision: "fixture-r1",
      approvedRecordCount: 1,
      approvedManifestSha256: "1".repeat(64),
      provenance: "Fixture provenance.",
      coverageTarget: "Every result receives a terminal target.",
      families: [{ id: "F01", number: 1, title: "Fixture branch" }],
      records: [{
        id: "S0001",
        ordinal: 1,
        title: "Fixture Mathematics",
        authorLine: "Ada Example",
        rawCitation: "Fixture Mathematics — Ada Example",
        familyId: "F01",
        requiredEditionComponents: [{ id: "complete-source", label: "Complete fixture source" }],
        resolutionState: "resolved-editions",
        editionIds: ["edition-one"],
        duplicateOfRecordId: null,
        duplicateEvidence: null,
        resolutionProposalAudit: proposalAudit,
        resolutionReview: adminReview,
      }],
    };
    const ledger = {
      schemaVersion: "1.1.0",
      updatedAt: "2026-08-22",
      inventoryPolicyVersion: "fixture-v1",
      inventoryPolicy: "Inventory every theorem-like result.",
      editions: [{
        id: "edition-one",
        sourceRecordId: "S0001",
        sourceComponentId: "complete-source",
        label: "Exact fixture edition",
        year: 2020,
        stableLocator: "isbn:fixture",
        artifactSha256: "b".repeat(64),
        unitManifestSha256: "c".repeat(64),
        scopeUnitKind: "page",
        sourceUnits: [{ id: "unit-1", ordinal: 1, locator: "page 1", contentSha256: "e".repeat(64) }],
        inventoryState: "audited-complete",
        extractionAudit,
        administrativeReview: adminReview,
        auditNote: "Complete fixture.",
      }],
      scanSegments: [scannedSegment({ kind: "occurrences-found", theoremOccurrenceIds: ["occurrence-one"] })],
      canonicalClaims: [{
        id: "C000001",
        title: "Fixture canonical claim",
        normalizedStatement: "The normalized fixture theorem.",
        hypothesisKeys: [],
        conclusionKey: "fixture-conclusion",
        status: "reviewed",
        prerequisiteClaimIds: [],
        knowledgeTargets: [{
          knowledgeNodeId: "K01",
          knowledgeEdition: knowledgeBook.edition,
          knowledgeContentSha256: knowledgeNodes.find((node) => node.id === "K01")?.contentSha256 ?? "",
        }],
        proposalAudit,
        administrativeReview: adminReview,
      }],
      residualArtifacts: [],
      theoremOccurrences: [{
        id: "occurrence-one",
        editionId: "edition-one",
        segmentId: "segment-one",
        sourceUnitId: "unit-1",
        kind: "theorem",
        sourceLabel: "Theorem 1",
        locator: "page 1",
        normalizedTitle: "Fixture theorem",
        normalizedClaim: "The independently rewritten fixture theorem.",
        decisionStatus: "verified",
        disposition: "rewritten-core",
        targetCanonicalClaimIds: ["C000001"],
        targetResidualArtifactIds: [],
        relation: "exact",
        reason: "The hypotheses and conclusion agree after normalization.",
        decisionAudit: proposalAudit,
        administrativeReview: adminReview,
      }],
    };
    const validated = validateLegacyPhaseTwoCoverage(registry, ledger, rawVerificationPolicy, targetContext);
    expect(assertLegacyPhaseTwoMappingComplete(validated.registry, validated.ledger)).toMatchObject({
      completeRecords: 1,
      terminalOccurrences: 1,
      verifiedMappings: 1,
      sourceUniverseComplete: true,
    });
  });
});
