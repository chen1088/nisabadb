import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  importerStateFor,
  licenseSubjectSha256,
  proposalSubjectSha256,
  resolutionStateFor,
  sourcePinSha256,
  sourceResolutionManifestSchema,
  validateSourceResolutionRecord,
} from "./book-source-resolution-schema.mjs";
import { validateGraphResolutionPair } from "./book-source-files.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repositoryRoot, "scripts", "book-source-files.mjs");
const manifestPath = path.join(repositoryRoot, "data", "book-sources", "manifest.json");
const graphManifestPath = path.join(repositoryRoot, "data", "books", "manifest.json");

const administrator = "github:chen1088";
const fixtureSubjectContext = {
  sourceSetRevision: "fixture-source-set",
  bookGraphId: "S0001:complete-source",
};

function proposalHash(proposal, context = fixtureSubjectContext) {
  return proposalSubjectSha256(proposal, context);
}

function licenseHash(proposal, context = fixtureSubjectContext) {
  return licenseSubjectSha256(proposal, context);
}

function exactEdition() {
  return {
    editionId: "fixture-edition",
    label: "Fixture Mathematics, exact edition",
    publicationYear: 2026,
    publisher: "Fixture Press",
    stableLocator: `https://example.com/fixture/revision/${"1".repeat(40)}`,
    sourceFormat: "pretext-xml",
    accessKind: "open",
    licenseSpdx: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenseNote: "Candidate license metadata from the pinned source.",
    sourceRepository: "https://example.com/fixture.git",
    sourceRevision: "1".repeat(40),
    artifactSha256: "a".repeat(64),
    unitManifestSha256: "b".repeat(64),
    sourceUnitKind: "source-file",
  };
}

function candidateRecord() {
  const proposal = {
    kind: "exact-edition",
    id: "fixture-edition",
    edition: exactEdition(),
    licenseAssessment: {
      status: "candidate",
      distributionClass: "review-required",
      administrativeReview: null,
      note: "Distribution remains pending review.",
    },
    proposalAudit: {
      actorId: "worker:fixture",
      proposedAt: "2026-08-27T12:00:00Z",
      subjectSha256: "",
      note: "Candidate exact-edition proposal.",
    },
    administrativeReview: null,
  };
  proposal.proposalAudit.subjectSha256 = proposalHash(proposal);
  return {
    schemaVersion: "1.0.0",
    sourceSetRevision: "fixture-source-set",
    bookGraphId: "S0001:complete-source",
    leads: [],
    proposals: [proposal],
    selectedProposalId: null,
    blockers: [],
    importerAssessments: [{
      id: "assessment-fixture",
      proposalId: proposal.id,
      adapterId: "fixture-importer",
      outcome: "candidate-produced",
      sourcePinSha256: sourcePinSha256(proposal.edition),
      extractionArtifactSha256: "c".repeat(64),
      graphArtifactSha256: "d".repeat(64),
      assessedBy: "fixture-importer",
      assessedAt: "2026-08-27T12:30:00Z",
      note: "A schema-valid candidate was produced without review.",
    }],
  };
}

function validate(record) {
  return validateSourceResolutionRecord(record, {
    expectedBookGraphId: "S0001:complete-source",
    sourceSetRevision: "fixture-source-set",
    administratorActorIds: [administrator],
  });
}

function candidateGraph(record) {
  return {
    identity: { bookGraphId: record.bookGraphId },
    exactEdition: structuredClone(record.proposals[0].edition),
    extractionState: {
      status: "extracted",
      extractionAudit: {
        actorId: "fixture-importer",
        completedAt: "2026-08-27T12:30:00Z",
        artifactSha256: "c".repeat(64),
      },
    },
    graphState: {
      status: "extracted",
      graphAudit: {
        actorId: "fixture-importer",
        completedAt: "2026-08-27T12:30:00Z",
        artifactSha256: "d".repeat(64),
      },
    },
  };
}

describe("book-source resolution workflow", () => {
  it("keeps an exact edition and compatible importer as candidate work until approval", () => {
    const record = validate(candidateRecord());
    expect(resolutionStateFor(record)).toBe("candidate-exact-edition");
    expect(importerStateFor(record)).toBe("candidate-produced");
  });

  it("rejects a stale proposal subject hash", () => {
    const record = candidateRecord();
    record.proposals[0].edition.label = "Changed after proposal";
    expect(() => validate(record)).toThrow(/proposal audit is stale/u);
  });

  it("rejects replaying a proposal or approval into another component", () => {
    const replayed = candidateRecord();
    replayed.bookGraphId = "S0002:complete-source";
    expect(() => validateSourceResolutionRecord(replayed, {
      expectedBookGraphId: replayed.bookGraphId,
      sourceSetRevision: replayed.sourceSetRevision,
      administratorActorIds: [administrator],
    })).toThrow(/proposal audit is stale/u);
  });

  it("requires an approved proposal before selection", () => {
    const record = candidateRecord();
    record.selectedProposalId = "fixture-edition";
    expect(() => validate(record)).toThrow(/without administrative approval/u);
  });

  it("enforces the administrator allowlist and independent review", () => {
    const unauthorized = candidateRecord();
    unauthorized.proposals[0].administrativeReview = {
      actorId: "reviewer:not-admin",
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: proposalHash(unauthorized.proposals[0]),
      note: "Unauthorized fixture approval.",
    };
    unauthorized.selectedProposalId = "fixture-edition";
    expect(() => validate(unauthorized)).toThrow(/not an authorized administrator/u);

    const selfReviewed = candidateRecord();
    selfReviewed.proposals[0].proposalAudit.actorId = administrator;
    selfReviewed.proposals[0].administrativeReview = {
      actorId: administrator,
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: proposalHash(selfReviewed.proposals[0]),
      note: "Non-independent fixture approval.",
    };
    selfReviewed.selectedProposalId = "fixture-edition";
    expect(() => validate(selfReviewed)).toThrow(/lacks independent administrative review/u);
  });

  it("derives verified state only from an independently approved selected proposal", () => {
    const record = candidateRecord();
    record.proposals[0].administrativeReview = {
      actorId: administrator,
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: proposalHash(record.proposals[0]),
      note: "Independent exact-edition approval.",
    };
    record.selectedProposalId = "fixture-edition";
    const validated = validate(record);
    expect(resolutionStateFor(validated)).toBe("verified-exact-edition");
  });

  it("keeps license authorization separate and hash-bound", () => {
    const invalidCandidate = candidateRecord();
    invalidCandidate.proposals[0].licenseAssessment.distributionClass = "open-derived-data";
    expect(() => validate(invalidCandidate)).toThrow(/candidate license cannot authorize distribution/u);

    const verified = candidateRecord();
    verified.proposals[0].licenseAssessment.status = "verified";
    verified.proposals[0].licenseAssessment.distributionClass = "open-derived-data";
    verified.proposals[0].licenseAssessment.administrativeReview = {
      actorId: administrator,
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: licenseHash(verified.proposals[0]),
      note: "Independent license and distribution approval.",
    };
    expect(() => validate(verified)).not.toThrow();
    verified.proposals[0].licenseAssessment.distributionClass = "metadata-only";
    expect(() => validate(verified)).toThrow(/license review is stale/u);
  });

  it("requires blocker state and resolution to agree", () => {
    const record = candidateRecord();
    record.blockers.push({
      id: "license-conflict",
      proposalId: "fixture-edition",
      domain: "license",
      code: "license-conflict",
      state: "open",
      opened: {
        actorId: "worker:fixture",
        recordedAt: "2026-08-27T12:00:00Z",
        evidenceLocator: record.proposals[0].edition.stableLocator,
        evidenceSha256: record.proposals[0].edition.artifactSha256,
        note: "Two source locations state different license versions.",
      },
      resolution: {
        actorId: administrator,
        resolvedAt: "2026-08-27T13:00:00Z",
        evidenceSha256: "e".repeat(64),
        note: "This resolution conflicts with the open state.",
      },
    });
    expect(() => validate(record)).toThrow(/blocker state and resolution disagree/u);
  });

  it("binds a produced candidate assessment to the exact source pin and audit hashes", () => {
    const record = candidateRecord();
    record.importerAssessments[0].sourcePinSha256 = "f".repeat(64);
    expect(() => validate(record)).toThrow(/candidate-produced assessment has stale hashes/u);
  });

  it("does not let a reviewed graph outrun exact-edition verification", () => {
    const record = validate(candidateRecord());
    const graph = candidateGraph(record);
    expect(() => validateGraphResolutionPair(record.bookGraphId, graph, record)).not.toThrow();
    graph.graphState.status = "reviewed-complete";
    expect(() => validateGraphResolutionPair(record.bookGraphId, graph, record))
      .toThrow(/reviewed graph requires its exact edition/u);
  });

  it("requires a stored graph to match the selected approved edition", () => {
    const record = candidateRecord();
    const graph = candidateGraph(record);
    const replacement = structuredClone(record.proposals[0]);
    replacement.id = "replacement-edition";
    replacement.edition.editionId = replacement.id;
    replacement.edition.artifactSha256 = "e".repeat(64);
    replacement.proposalAudit.subjectSha256 = proposalHash(replacement);
    replacement.administrativeReview = {
      actorId: administrator,
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: proposalHash(replacement),
      note: "Independent replacement-edition approval.",
    };
    record.proposals.push(replacement);
    record.selectedProposalId = replacement.id;
    const validated = validate(record);
    expect(() => validateGraphResolutionPair(record.bookGraphId, graph, validated))
      .toThrow(/does not match its selected source resolution/u);
  });

  it("matches the current graph audit when older importer assessments are retained", () => {
    const record = candidateRecord();
    record.importerAssessments.unshift({
      ...structuredClone(record.importerAssessments[0]),
      id: "assessment-fixture-older",
      extractionArtifactSha256: "e".repeat(64),
      graphArtifactSha256: "f".repeat(64),
      assessedAt: "2026-08-27T11:30:00Z",
    });
    const validated = validate(record);
    expect(() => validateGraphResolutionPair(
      validated.bookGraphId,
      candidateGraph(validated),
      validated,
    )).not.toThrow();
  });

  it("derives importer readiness from the selected proposal rather than rejected or superseded history", () => {
    const record = candidateRecord();
    const replacement = structuredClone(record.proposals[0]);
    replacement.id = "replacement-edition";
    replacement.edition.editionId = replacement.id;
    replacement.edition.artifactSha256 = "e".repeat(64);
    replacement.proposalAudit.subjectSha256 = proposalHash(replacement);
    replacement.administrativeReview = {
      actorId: administrator,
      actorRole: "administrator",
      reviewedAt: "2026-08-27T13:00:00Z",
      decision: "approved",
      subjectSha256: proposalHash(replacement),
      note: "Independent replacement-edition approval.",
    };
    record.proposals.push(replacement);
    record.selectedProposalId = replacement.id;
    expect(importerStateFor(validate(record))).toBe("not-assessed");
  });
});

describe("committed-shape book-source corpus", () => {
  it("covers all components sparsely and cross-checks every populated graph", () => {
    const output = execFileSync(process.execPath, [cliPath, "--check"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    expect(output).toMatch(/Book-source resolution data valid/u);

    const manifest = sourceResolutionManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
    const graphManifest = JSON.parse(fs.readFileSync(graphManifestPath, "utf8"));
    const graphEntries = graphManifest.entries.filter(({ artifactPath }) => artifactPath !== null);
    expect(manifest.componentCount).toBe(717);
    expect(manifest.entries).toHaveLength(717);
    expect(graphEntries).toHaveLength(0);
    expect(manifest.entries.filter(({ graphArtifactPath }) => graphArtifactPath !== null)).toHaveLength(0);
    expect(manifest.resolutionRecordCount).toBe(5);
    expect(manifest.summary.candidateExactEditionCount).toBe(5);
    expect(manifest.summary.verifiedExactEditionCount).toBe(0);
    expect(manifest.summary.importerCandidateProducedCount).toBe(5);
    expect(manifest.summary.blockedComponentCount).toBe(2);
    expect(manifest.summary.unresolvedComponentCount
      + manifest.summary.candidateExactEditionCount
      + manifest.summary.verifiedExactEditionCount
      + manifest.summary.candidateDuplicateCount
      + manifest.summary.verifiedDuplicateCount).toBe(717);
    expect(manifest.entries.filter(({ resolutionPath }) => resolutionPath !== null))
      .toHaveLength(manifest.resolutionRecordCount);
    expect(manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0091:complete-source"))
      .toMatchObject({
        resolutionPath: "S0091/complete-source.json",
        resolutionState: "candidate-exact-edition",
        importerState: "candidate-produced",
      });
    expect(manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0321:complete-source"))
      .toMatchObject({
        resolutionPath: "S0321/complete-source.json",
        resolutionState: "candidate-exact-edition",
        importerState: "candidate-produced",
        openBlockerDomains: [],
      });
    expect(manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0060:complete-source")?.openBlockerDomains)
      .toContain("license");
    expect(manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0164:complete-source")?.openBlockerDomains)
      .toContain("license");
  });
});
