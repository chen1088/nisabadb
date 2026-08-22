import { z } from "zod";

// The registry schema in this module remains authoritative. The edition/claim/
// residual ledger below is a frozen Phase-II mapping prototype; it is not the
// Phase-I source-graph completion gate. Active book graphs are validated by
// book-graph-schema.ts.

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const administrativeReviewSchema = z.object({
  actorId: z.string().min(1),
  actorRole: z.literal("administrator"),
  reviewedAt: z.iso.datetime(),
  evidenceSha256: sha256Schema,
  note: z.string().min(1),
});

export const extractionAuditSchema = z.object({
  actorId: z.string().min(1),
  extractedAt: z.iso.datetime(),
  artifactSha256: sha256Schema,
});

export const proposalAuditSchema = z.object({
  actorId: z.string().min(1),
  proposedAt: z.iso.datetime(),
  artifactSha256: sha256Schema,
});

export const verificationPolicySchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  updatedAt: z.iso.date(),
  policyRevision: z.string().min(1),
  requireIndependentAdministrativeReview: z.literal(true),
  administrators: z.array(z.object({
    actorId: z.string().min(1),
    displayName: z.string().min(1),
  })).min(1),
});

export const sourceResolutionStateSchema = z.enum([
  "unresolved",
  "resolved-editions",
  "duplicate-record",
]);

export const sourceRecordSchema = z.object({
  id: z.string().regex(/^S\d{4}$/),
  ordinal: z.number().int().positive(),
  title: z.string().min(1),
  authorLine: z.string().min(1),
  rawCitation: z.string().min(1),
  familyId: z.string().regex(/^F\d{2}$/),
  requiredEditionComponents: z.array(z.object({
    id: stableIdSchema,
    label: z.string().min(1),
  })).min(1),
  resolutionState: sourceResolutionStateSchema,
  editionIds: z.array(stableIdSchema),
  duplicateOfRecordId: z.string().regex(/^S\d{4}$/).nullable(),
  duplicateEvidence: z.string().min(1).nullable(),
  resolutionProposalAudit: proposalAuditSchema.nullable(),
  resolutionReview: administrativeReviewSchema.nullable(),
});

export const sourceRegistrySchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  updatedAt: z.iso.date(),
  sourceSetName: z.string().min(1),
  sourceSetRevision: z.string().min(1),
  approvedRecordCount: z.number().int().positive(),
  approvedManifestSha256: sha256Schema,
  provenance: z.string().min(1),
  coverageTarget: z.string().min(1),
  families: z.array(z.object({
    id: z.string().regex(/^F\d{2}$/),
    number: z.number().int().positive(),
    title: z.string().min(1),
  })).min(1),
  records: z.array(sourceRecordSchema).min(1),
});

export const editionInventoryStateSchema = z.enum([
  "not-started",
  "indexing",
  "extracted",
  "audited-complete",
  "blocked",
]);

export const sourceUnitSchema = z.object({
  id: stableIdSchema,
  ordinal: z.number().int().positive(),
  locator: z.string().min(1),
  contentSha256: sha256Schema,
});

export const sourceEditionSchema = z.object({
  id: stableIdSchema,
  sourceRecordId: z.string().regex(/^S\d{4}$/),
  sourceComponentId: stableIdSchema,
  label: z.string().min(1),
  year: z.number().int().min(1400).max(2200).nullable(),
  stableLocator: z.string().min(1),
  artifactSha256: sha256Schema,
  unitManifestSha256: sha256Schema,
  scopeUnitKind: z.enum(["page", "section", "web-node"]),
  sourceUnits: z.array(sourceUnitSchema).min(1),
  inventoryState: editionInventoryStateSchema,
  extractionAudit: extractionAuditSchema.nullable(),
  administrativeReview: administrativeReviewSchema.nullable(),
  auditNote: z.string().min(1),
});

const pendingInventoryResultSchema = z.object({
  kind: z.literal("pending"),
  theoremOccurrenceIds: z.tuple([]),
});

const foundInventoryResultSchema = z.object({
  kind: z.literal("occurrences-found"),
  theoremOccurrenceIds: z.array(stableIdSchema).min(1),
});

const emptyInventoryResultSchema = z.object({
  kind: z.literal("explicit-none"),
  theoremOccurrenceIds: z.tuple([]),
  reason: z.string().min(1),
});

export const segmentInventoryResultSchema = z.discriminatedUnion("kind", [
  pendingInventoryResultSchema,
  foundInventoryResultSchema,
  emptyInventoryResultSchema,
]);

export const sourceEvidenceSchema = z.object({
  editionArtifactSha256: sha256Schema,
  unitManifestSha256: sha256Schema,
  extractionArtifactSha256: sha256Schema,
  evidenceLocator: z.string().min(1),
});

export const scanSegmentSchema = z.object({
  id: stableIdSchema,
  editionId: stableIdSchema,
  sequence: z.number().int().nonnegative(),
  locator: z.string().min(1),
  sourceUnitIds: z.array(stableIdSchema).min(1),
  coverageState: z.enum(["queued", "scanned", "reviewed"]),
  inventoryResult: segmentInventoryResultSchema,
  sourceEvidence: sourceEvidenceSchema.nullable(),
  extractionAudit: extractionAuditSchema.nullable(),
  administrativeReview: administrativeReviewSchema.nullable(),
  note: z.string().min(1),
});

export const theoremKindSchema = z.enum([
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "claim",
  "named-result",
  "exercise-result",
]);

export const theoremDispositionSchema = z.enum([
  "unclassified",
  "rewritten-core",
  "equivalent-to-core",
  "alternate-proof",
  "bridge",
  "specialist-extension",
  "historical-or-corrected",
  "unresolved",
]);

export const knowledgeTargetSchema = z.object({
  knowledgeNodeId: z.string().regex(/^K\d{2,6}$/),
  knowledgeEdition: z.string().min(1),
  knowledgeContentSha256: sha256Schema,
});

export const canonicalClaimSchema = z.object({
  id: z.string().regex(/^C\d{6}$/),
  title: z.string().min(1),
  normalizedStatement: z.string().min(1),
  hypothesisKeys: z.array(z.string().min(1)),
  conclusionKey: z.string().min(1),
  status: z.enum(["candidate", "reviewed", "disputed"]),
  prerequisiteClaimIds: z.array(z.string().regex(/^C\d{6}$/)),
  knowledgeTargets: z.array(knowledgeTargetSchema),
  proposalAudit: proposalAuditSchema.nullable(),
  administrativeReview: administrativeReviewSchema.nullable(),
});

export const residualArtifactSchema = z.object({
  id: stableIdSchema,
  title: z.string().min(1),
  normalizedStatement: z.string().min(1),
  disposition: z.enum(["specialist-extension", "historical-or-corrected"]),
  reason: z.string().min(1),
  status: z.enum(["candidate", "reviewed", "disputed"]),
  proposalAudit: proposalAuditSchema.nullable(),
  administrativeReview: administrativeReviewSchema.nullable(),
});

export const theoremOccurrenceSchema = z.object({
  id: stableIdSchema,
  editionId: stableIdSchema,
  segmentId: stableIdSchema,
  sourceUnitId: stableIdSchema,
  kind: theoremKindSchema,
  sourceLabel: z.string().min(1),
  locator: z.string().min(1),
  normalizedTitle: z.string().min(1),
  normalizedClaim: z.string().min(1),
  decisionStatus: z.enum(["unclassified", "proposed", "verified", "disputed"]),
  disposition: theoremDispositionSchema,
  targetCanonicalClaimIds: z.array(z.string().regex(/^C\d{6}$/)),
  targetResidualArtifactIds: z.array(stableIdSchema),
  relation: z.enum(["exact", "source-stronger", "source-weaker", "overlapping"]).nullable(),
  reason: z.string().min(1),
  decisionAudit: proposalAuditSchema.nullable(),
  administrativeReview: administrativeReviewSchema.nullable(),
});

export const legacyPhaseTwoCoverageLedgerSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  updatedAt: z.iso.date(),
  inventoryPolicyVersion: z.string().min(1),
  inventoryPolicy: z.string().min(1),
  editions: z.array(sourceEditionSchema),
  scanSegments: z.array(scanSegmentSchema),
  canonicalClaims: z.array(canonicalClaimSchema),
  residualArtifacts: z.array(residualArtifactSchema),
  theoremOccurrences: z.array(theoremOccurrenceSchema),
});

export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
export type LegacyPhaseTwoCoverageLedger = z.infer<typeof legacyPhaseTwoCoverageLedgerSchema>;
export type VerificationPolicy = z.infer<typeof verificationPolicySchema>;

export type CoverageTargetContext = {
  knowledgeNodes: ReadonlyArray<{ id: string; contentSha256: string }>;
  knowledgeEdition: string;
};

function unique(values: readonly string[], label: string): Set<string> {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function validateAdministrator(
  review: z.infer<typeof administrativeReviewSchema> | null,
  administrators: Set<string>,
  label: string,
) {
  if (!review || !administrators.has(review.actorId)) {
    throw new Error(`${label} lacks an authorized administrative review`);
  }
}

function mappedDisposition(disposition: z.infer<typeof theoremDispositionSchema>) {
  return ["rewritten-core", "equivalent-to-core", "alternate-proof", "bridge"].includes(disposition);
}

function residualDisposition(disposition: z.infer<typeof theoremDispositionSchema>) {
  return ["specialist-extension", "historical-or-corrected"].includes(disposition);
}

export function validateLegacyPhaseTwoCoverage(
  rawRegistry: unknown,
  rawLedger: unknown,
  rawVerificationPolicy: unknown,
  targetContext: CoverageTargetContext,
): { registry: SourceRegistry; ledger: LegacyPhaseTwoCoverageLedger; verificationPolicy: VerificationPolicy } {
  const registry = sourceRegistrySchema.parse(rawRegistry);
  const ledger = legacyPhaseTwoCoverageLedgerSchema.parse(rawLedger);
  const verificationPolicy = verificationPolicySchema.parse(rawVerificationPolicy);
  const administrators = unique(
    verificationPolicy.administrators.map((administrator) => administrator.actorId),
    "administrator actor ID",
  );
  const knowledgeNodeHashById = new Map(
    targetContext.knowledgeNodes.map((node) => [node.id, node.contentSha256]),
  );
  const familyIds = unique(registry.families.map((family) => family.id), "source family ID");
  const recordIds = unique(registry.records.map((record) => record.id), "source record ID");
  const editionIds = unique(ledger.editions.map((edition) => edition.id), "source edition ID");
  const segmentIds = unique(ledger.scanSegments.map((segment) => segment.id), "scan segment ID");
  unique(ledger.theoremOccurrences.map((occurrence) => occurrence.id), "theorem occurrence ID");
  const claimIds = unique(ledger.canonicalClaims.map((claim) => claim.id), "canonical claim ID");
  const residualIds = unique(ledger.residualArtifacts.map((artifact) => artifact.id), "residual artifact ID");

  if (registry.approvedRecordCount !== registry.records.length) {
    throw new Error("The approved source record count does not match the manifest");
  }

  registry.records.forEach((record, index) => {
    const expectedId = `S${String(index + 1).padStart(4, "0")}`;
    if (record.ordinal !== index + 1 || record.id !== expectedId) {
      throw new Error(`${record.id} breaks the approved source-record order`);
    }
    if (!familyIds.has(record.familyId)) throw new Error(`${record.id} has missing family ${record.familyId}`);
    unique(record.editionIds, `${record.id} edition relation`);
    const requiredComponentIds = unique(
      record.requiredEditionComponents.map((component) => component.id),
      `${record.id} required edition component`,
    );

    if (record.resolutionState === "unresolved") {
      if (record.editionIds.length || record.duplicateOfRecordId || record.duplicateEvidence || record.resolutionProposalAudit || record.resolutionReview) {
        throw new Error(`${record.id} is unresolved but already carries resolution data`);
      }
    }
    if (record.resolutionState === "resolved-editions") {
      if (record.editionIds.length !== requiredComponentIds.size || record.duplicateOfRecordId || record.duplicateEvidence || !record.resolutionProposalAudit) {
        throw new Error(`${record.id} must resolve every required component to exactly one edition`);
      }
      validateAdministrator(record.resolutionReview, administrators, record.id);
      if (record.resolutionReview?.actorId === record.resolutionProposalAudit.actorId) {
        throw new Error(`${record.id} source resolution must be independently reviewed`);
      }
      const resolvedComponentIds = new Set<string>();
      for (const editionId of record.editionIds) {
        const edition = ledger.editions.find((candidate) => candidate.id === editionId);
        if (!edition || edition.sourceRecordId !== record.id) {
          throw new Error(`${record.id} must resolve to an edition owned by that source row`);
        }
        if (!requiredComponentIds.has(edition.sourceComponentId) || resolvedComponentIds.has(edition.sourceComponentId)) {
          throw new Error(`${record.id} has a missing or duplicate edition component`);
        }
        resolvedComponentIds.add(edition.sourceComponentId);
      }
    }
    if (record.resolutionState === "duplicate-record") {
      if (record.editionIds.length || !record.duplicateOfRecordId || record.duplicateOfRecordId === record.id || !record.duplicateEvidence || !record.resolutionProposalAudit) {
        throw new Error(`${record.id} has an invalid duplicate resolution`);
      }
      if (!recordIds.has(record.duplicateOfRecordId)) throw new Error(`${record.id} names a missing duplicate target`);
      validateAdministrator(record.resolutionReview, administrators, record.id);
      if (record.resolutionReview?.actorId === record.resolutionProposalAudit.actorId) {
        throw new Error(`${record.id} duplicate resolution must be independently reviewed`);
      }
    }
  });

  for (const record of registry.records) {
    if (record.resolutionState !== "duplicate-record") continue;
    const visited = new Set<string>([record.id]);
    let targetId = record.duplicateOfRecordId;
    while (targetId) {
      if (visited.has(targetId)) throw new Error(`Duplicate source cycle includes ${targetId}`);
      visited.add(targetId);
      const target = registry.records.find((candidate) => candidate.id === targetId);
      if (!target) throw new Error(`${record.id} has a missing duplicate target`);
      if (target.resolutionState === "resolved-editions") break;
      if (target.resolutionState !== "duplicate-record") {
        throw new Error(`${record.id} must ultimately duplicate a resolved source row`);
      }
      targetId = target.duplicateOfRecordId;
    }
  }

  for (const edition of ledger.editions) {
    const owner = registry.records.find((record) => record.id === edition.sourceRecordId);
    if (!owner || owner.resolutionState !== "resolved-editions" || !owner.editionIds.includes(edition.id)) {
      throw new Error(`${edition.id} is not owned by its resolved source row`);
    }
    const unitIds = unique(edition.sourceUnits.map((unit) => unit.id), `${edition.id} source unit ID`);
    edition.sourceUnits.forEach((unit, index) => {
      if (unit.ordinal !== index + 1) throw new Error(`${edition.id} source-unit manifest loses order`);
    });
    const segments = ledger.scanSegments.filter((segment) => segment.editionId === edition.id);
    const occurrences = ledger.theoremOccurrences.filter((occurrence) => occurrence.editionId === edition.id);

    if (edition.inventoryState === "audited-complete") {
      if (!edition.extractionAudit || !segments.length) throw new Error(`${edition.id} cannot be complete without extraction evidence`);
      if (!occurrences.length) throw new Error(`${edition.id} cannot be complete with an empty theorem inventory`);
      validateAdministrator(edition.administrativeReview, administrators, edition.id);
      if (edition.administrativeReview?.actorId === edition.extractionAudit.actorId) {
        throw new Error(`${edition.id} must be independently reviewed`);
      }
      const sequenceIds = [...segments]
        .sort((left, right) => left.sequence - right.sequence)
        .map((segment) => segment.sequence);
      if (sequenceIds.some((sequence, index) => sequence !== index)) {
        throw new Error(`${edition.id} scan segments lose sequence order`);
      }
      if (segments.some((segment) => segment.coverageState !== "reviewed")) {
        throw new Error(`${edition.id} has unreviewed scan segments`);
      }
      const coveredUnits = segments.flatMap((segment) => segment.sourceUnitIds);
      unique(coveredUnits, `${edition.id} scanned source unit`);
      if (coveredUnits.length !== unitIds.size || coveredUnits.some((unitId) => !unitIds.has(unitId))) {
        throw new Error(`${edition.id} scan does not exactly cover its immutable unit manifest`);
      }
      if (occurrences.some((occurrence) => !isLegacyPhaseTwoTerminalOccurrence(occurrence, ledger))) {
        throw new Error(`${edition.id} has theorem occurrences without verified terminal dispositions`);
      }
    }
  }

  for (const segment of ledger.scanSegments) {
    if (!editionIds.has(segment.editionId)) throw new Error(`${segment.id} has missing edition`);
    const edition = ledger.editions.find((candidate) => candidate.id === segment.editionId);
    if (!edition) continue;
    const unitIds = new Set(edition.sourceUnits.map((unit) => unit.id));
    unique(segment.sourceUnitIds, `${segment.id} source unit relation`);
    if (segment.sourceUnitIds.some((unitId) => !unitIds.has(unitId))) {
      throw new Error(`${segment.id} cites a source unit outside its edition manifest`);
    }

    const declaredOccurrenceIds = segment.inventoryResult.theoremOccurrenceIds;
    unique(declaredOccurrenceIds, `${segment.id} occurrence relation`);
    const actualOccurrenceIds = ledger.theoremOccurrences
      .filter((occurrence) => occurrence.segmentId === segment.id)
      .map((occurrence) => occurrence.id);
    if (declaredOccurrenceIds.length !== actualOccurrenceIds.length
      || declaredOccurrenceIds.some((id) => !actualOccurrenceIds.includes(id))) {
      throw new Error(`${segment.id} theorem inventory is not an exact membership list`);
    }

    if (segment.coverageState === "queued") {
      if (segment.inventoryResult.kind !== "pending" || segment.sourceEvidence || segment.extractionAudit || segment.administrativeReview) {
        throw new Error(`${segment.id} queued state carries premature audit evidence`);
      }
    } else {
      if (segment.inventoryResult.kind === "pending" || !segment.sourceEvidence || !segment.extractionAudit) {
        throw new Error(`${segment.id} scanned state lacks a positive or explicit-none inventory attestation`);
      }
      if (segment.sourceEvidence.editionArtifactSha256 !== edition.artifactSha256
        || segment.sourceEvidence.unitManifestSha256 !== edition.unitManifestSha256) {
        throw new Error(`${segment.id} evidence does not match its immutable edition manifest`);
      }
      if (segment.extractionAudit.artifactSha256 !== segment.sourceEvidence.extractionArtifactSha256) {
        throw new Error(`${segment.id} extraction audit does not match its evidence artifact`);
      }
    }
    if (segment.coverageState === "reviewed") {
      validateAdministrator(segment.administrativeReview, administrators, segment.id);
      if (segment.administrativeReview?.actorId === segment.extractionAudit?.actorId) {
        throw new Error(`${segment.id} must be independently reviewed`);
      }
    } else if (segment.administrativeReview) {
      throw new Error(`${segment.id} is not reviewed but carries an administrative approval`);
    }
  }

  for (const claim of ledger.canonicalClaims) {
    unique(claim.prerequisiteClaimIds, `${claim.id} prerequisite relation`);
    unique(claim.knowledgeTargets.map((target) => target.knowledgeNodeId), `${claim.id} Knowledge target`);
    for (const target of claim.knowledgeTargets) {
      const currentContentSha256 = knowledgeNodeHashById.get(target.knowledgeNodeId);
      if (!currentContentSha256) throw new Error(`${claim.id} has missing Knowledge node ${target.knowledgeNodeId}`);
      if (target.knowledgeEdition !== targetContext.knowledgeEdition) throw new Error(`${claim.id} points to a stale Knowledge edition`);
      if (target.knowledgeContentSha256 !== currentContentSha256) throw new Error(`${claim.id} points to stale Knowledge content`);
    }
    if (claim.status === "reviewed") {
      if (!claim.knowledgeTargets.length || !claim.proposalAudit) throw new Error(`${claim.id} reviewed claim has no proposed Knowledge target`);
      validateAdministrator(claim.administrativeReview, administrators, claim.id);
      if (claim.administrativeReview?.actorId === claim.proposalAudit.actorId) {
        throw new Error(`${claim.id} must be independently reviewed`);
      }
    } else if (claim.administrativeReview) {
      throw new Error(`${claim.id} is not reviewed but carries an administrative approval`);
    }
  }

  for (const artifact of ledger.residualArtifacts) {
    if (artifact.status === "reviewed") {
      if (!artifact.proposalAudit) throw new Error(`${artifact.id} reviewed residual has no proposal audit`);
      validateAdministrator(artifact.administrativeReview, administrators, artifact.id);
      if (artifact.administrativeReview?.actorId === artifact.proposalAudit.actorId) {
        throw new Error(`${artifact.id} must be independently reviewed`);
      }
    }
    else if (artifact.administrativeReview) throw new Error(`${artifact.id} is not reviewed but carries an administrative approval`);
  }

  for (const occurrence of ledger.theoremOccurrences) {
    if (!editionIds.has(occurrence.editionId)) throw new Error(`${occurrence.id} has missing edition`);
    if (!segmentIds.has(occurrence.segmentId)) throw new Error(`${occurrence.id} has missing scan segment`);
    const segment = ledger.scanSegments.find((candidate) => candidate.id === occurrence.segmentId);
    if (!segment || segment.editionId !== occurrence.editionId || !segment.sourceUnitIds.includes(occurrence.sourceUnitId)) {
      throw new Error(`${occurrence.id} has a missing or mismatched source unit and scan segment`);
    }
    for (const claimId of occurrence.targetCanonicalClaimIds) {
      if (!claimIds.has(claimId)) throw new Error(`${occurrence.id} has missing canonical claim ${claimId}`);
    }
    for (const artifactId of occurrence.targetResidualArtifactIds) {
      if (!residualIds.has(artifactId)) throw new Error(`${occurrence.id} has missing residual artifact ${artifactId}`);
    }
    const hasClaims = occurrence.targetCanonicalClaimIds.length > 0;
    if (hasClaims !== Boolean(occurrence.relation)) {
      throw new Error(`${occurrence.id} must pair canonical targets with a mapping relation`);
    }
    if (mappedDisposition(occurrence.disposition) && !hasClaims) {
      throw new Error(`${occurrence.id} has a mapped disposition without a canonical target`);
    }
    if (residualDisposition(occurrence.disposition) && !occurrence.targetResidualArtifactIds.length) {
      throw new Error(`${occurrence.id} has a residual disposition without a residual artifact`);
    }
    if (residualDisposition(occurrence.disposition) && hasClaims) {
      throw new Error(`${occurrence.id} residual disposition cannot also claim a canonical mapping`);
    }
    if ((occurrence.disposition === "unclassified" || occurrence.disposition === "unresolved")
      && (hasClaims || occurrence.targetResidualArtifactIds.length)) {
      throw new Error(`${occurrence.id} unresolved disposition cannot carry terminal targets`);
    }
    const leavesUnmatchedMathematics = occurrence.relation === "source-stronger" || occurrence.relation === "overlapping";
    if (mappedDisposition(occurrence.disposition) && leavesUnmatchedMathematics && !occurrence.targetResidualArtifactIds.length) {
      throw new Error(`${occurrence.id} stronger or overlapping mapping must retain its unmatched mathematics`);
    }
    if (mappedDisposition(occurrence.disposition) && !leavesUnmatchedMathematics && occurrence.targetResidualArtifactIds.length) {
      throw new Error(`${occurrence.id} exact or source-weaker mapping has an extraneous residual target`);
    }
    if (occurrence.decisionStatus === "verified") {
      if (!occurrence.decisionAudit) throw new Error(`${occurrence.id} verified disposition has no proposal audit`);
      validateAdministrator(occurrence.administrativeReview, administrators, occurrence.id);
      if (occurrence.administrativeReview?.actorId === occurrence.decisionAudit.actorId) {
        throw new Error(`${occurrence.id} disposition must be independently reviewed`);
      }
      if (!isLegacyPhaseTwoTerminalOccurrence(occurrence, ledger)) throw new Error(`${occurrence.id} lacks a verified terminal target`);
    } else if (occurrence.administrativeReview) {
      throw new Error(`${occurrence.id} is not verified but carries an administrative approval`);
    }
  }

  const claimPrerequisites = new Map(ledger.canonicalClaims.map((claim) => [claim.id, claim.prerequisiteClaimIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitClaim = (id: string) => {
    if (visiting.has(id)) throw new Error(`Canonical claim cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisiteId of claimPrerequisites.get(id) ?? []) {
      if (!claimIds.has(prerequisiteId)) throw new Error(`${id} has missing prerequisite claim ${prerequisiteId}`);
      visitClaim(prerequisiteId);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const claimId of claimIds) visitClaim(claimId);

  return { registry, ledger, verificationPolicy };
}

export function isLegacyPhaseTwoTerminalOccurrence(
  occurrence: LegacyPhaseTwoCoverageLedger["theoremOccurrences"][number],
  ledger: LegacyPhaseTwoCoverageLedger,
) {
  if (occurrence.decisionStatus !== "verified") return false;
  if (mappedDisposition(occurrence.disposition)) {
    const claimsAreTerminal = occurrence.targetCanonicalClaimIds.length > 0
      && occurrence.targetCanonicalClaimIds.every((claimId) => {
        const claim = ledger.canonicalClaims.find((candidate) => candidate.id === claimId);
        return claim?.status === "reviewed" && claim.knowledgeTargets.length > 0;
      });
    if (!claimsAreTerminal) return false;
    if (occurrence.relation === "source-stronger" || occurrence.relation === "overlapping") {
      return occurrence.targetResidualArtifactIds.length > 0
        && occurrence.targetResidualArtifactIds.every((artifactId) => (
          ledger.residualArtifacts.find((artifact) => artifact.id === artifactId)?.status === "reviewed"
        ));
    }
    return occurrence.targetResidualArtifactIds.length === 0;
  }
  if (residualDisposition(occurrence.disposition)) {
    return occurrence.targetResidualArtifactIds.length > 0
      && occurrence.targetResidualArtifactIds.every((artifactId) => (
        ledger.residualArtifacts.find((artifact) => artifact.id === artifactId)?.status === "reviewed"
      ));
  }
  return false;
}

function resolvedRecordIsComplete(
  record: SourceRegistry["records"][number],
  registry: SourceRegistry,
  ledger: LegacyPhaseTwoCoverageLedger,
) {
  let resolved = record;
  const seen = new Set<string>();
  while (resolved.resolutionState === "duplicate-record") {
    if (!resolved.duplicateOfRecordId || seen.has(resolved.id)) return false;
    seen.add(resolved.id);
    const target = registry.records.find((candidate) => candidate.id === resolved.duplicateOfRecordId);
    if (!target) return false;
    resolved = target;
  }
  return resolved.resolutionState === "resolved-editions"
    && resolved.editionIds.length > 0
    && resolved.editionIds.every((editionId) => (
      ledger.editions.find((edition) => edition.id === editionId)?.inventoryState === "audited-complete"
    ));
}

export function deriveLegacyPhaseTwoCoverageSummary(registry: SourceRegistry, ledger: LegacyPhaseTwoCoverageLedger) {
  const resolvedRecords = registry.records.filter((record) => record.resolutionState !== "unresolved").length;
  const completeRecords = registry.records.filter((record) => resolvedRecordIsComplete(record, registry, ledger)).length;
  const completeEditions = ledger.editions.filter((edition) => edition.inventoryState === "audited-complete").length;
  const classifiedOccurrences = ledger.theoremOccurrences.filter((occurrence) => (
    occurrence.disposition !== "unclassified" && occurrence.disposition !== "unresolved"
  )).length;
  const terminalOccurrences = ledger.theoremOccurrences.filter((occurrence) => isLegacyPhaseTwoTerminalOccurrence(occurrence, ledger)).length;
  const verifiedMappings = ledger.theoremOccurrences.filter((occurrence) => (
    isLegacyPhaseTwoTerminalOccurrence(occurrence, ledger) && mappedDisposition(occurrence.disposition)
  )).length;
  const verifiedResiduals = ledger.theoremOccurrences.filter((occurrence) => (
    isLegacyPhaseTwoTerminalOccurrence(occurrence, ledger) && residualDisposition(occurrence.disposition)
  )).length;
  const unresolvedOccurrences = ledger.theoremOccurrences.filter((occurrence) => (
    occurrence.disposition === "unresolved" || occurrence.disposition === "unclassified"
  )).length;
  return {
    sourceRecords: registry.records.length,
    resolvedRecords,
    completeRecords,
    editions: ledger.editions.length,
    completeEditions,
    theoremOccurrences: ledger.theoremOccurrences.length,
    classifiedOccurrences,
    terminalOccurrences,
    verifiedMappings,
    verifiedResiduals,
    unresolvedOccurrences,
    sourceUniverseComplete: registry.records.length > 0 && completeRecords === registry.records.length,
  };
}

export function assertLegacyPhaseTwoMappingComplete(registry: SourceRegistry, ledger: LegacyPhaseTwoCoverageLedger) {
  const summary = deriveLegacyPhaseTwoCoverageSummary(registry, ledger);
  if (!summary.sourceUniverseComplete) {
    throw new Error(`Source universe incomplete: ${summary.completeRecords}/${summary.sourceRecords} rows fully reconciled`);
  }
  return summary;
}
