import { createHash } from "node:crypto";
import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/u);
const bookGraphIdSchema = z.string().regex(/^S\d{4}:[a-z0-9][a-z0-9-]*$/u);
const sourceRecordIdSchema = z.string().regex(/^S\d{4}$/u);
const resolutionPathSchema = z.string().regex(/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u);

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortForCanonicalJson(value[key])]),
    );
  }
  return value;
}

export function canonicalSubjectJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function canonicalPrettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Subject(value) {
  return createHash("sha256").update(canonicalSubjectJson(value)).digest("hex");
}

const observationSchema = z.object({
  actorId: z.string().min(1),
  recordedAt: z.iso.datetime(),
  evidenceLocator: z.string().min(1),
  evidenceSha256: sha256Schema.nullable(),
  note: z.string().min(1),
}).strict();

const proposalAuditSchema = z.object({
  actorId: z.string().min(1),
  proposedAt: z.iso.datetime(),
  subjectSha256: sha256Schema,
  note: z.string().min(1),
}).strict();

const administrativeDecisionSchema = z.object({
  actorId: z.string().min(1),
  actorRole: z.literal("administrator"),
  reviewedAt: z.iso.datetime(),
  decision: z.enum(["approved", "rejected"]),
  subjectSha256: sha256Schema,
  note: z.string().min(1),
}).strict();

export const exactEditionSnapshotSchema = z.object({
  editionId: stableIdSchema,
  label: z.string().min(1),
  publicationYear: z.number().int().min(1400).max(2200).nullable(),
  publisher: z.string().min(1).nullable(),
  stableLocator: z.string().min(1),
  sourceFormat: z.enum([
    "pdf",
    "html",
    "pretext-xml",
    "pressbooks-wxr",
    "latex",
    "epub",
    "scanned-images",
    "other",
  ]),
  accessKind: z.enum([
    "open",
    "public-domain",
    "licensed",
    "owned-copy",
    "library-access",
    "citation-only",
  ]),
  licenseSpdx: z.string().min(1).nullable(),
  licenseUrl: z.url().nullable(),
  licenseNote: z.string().min(1),
  sourceRepository: z.url().nullable(),
  sourceRevision: z.string().min(1).nullable(),
  artifactSha256: sha256Schema,
  unitManifestSha256: sha256Schema,
  sourceUnitKind: z.enum(["page", "chapter", "section", "source-file", "web-node"]),
}).strict().superRefine((edition, context) => {
  if ((edition.sourceRepository === null) !== (edition.sourceRevision === null)) {
    context.addIssue({
      code: "custom",
      message: "An exact-edition repository and revision must be recorded together",
    });
  }
  if (edition.sourceRepository !== null && !/^[a-f0-9]{40,64}$/u.test(edition.sourceRevision)) {
    context.addIssue({
      code: "custom",
      message: "A repository-backed exact edition requires a full immutable commit revision",
    });
  }
});

const licenseAssessmentSchema = z.object({
  status: z.enum(["candidate", "verified"]),
  distributionClass: z.enum([
    "review-required",
    "metadata-only",
    "open-derived-data",
    "restricted-derived-data",
  ]),
  administrativeReview: administrativeDecisionSchema.nullable(),
  note: z.string().min(1),
}).strict();

const exactEditionProposalSchema = z.object({
  kind: z.literal("exact-edition"),
  id: stableIdSchema,
  edition: exactEditionSnapshotSchema,
  licenseAssessment: licenseAssessmentSchema,
  proposalAudit: proposalAuditSchema,
  administrativeReview: administrativeDecisionSchema.nullable(),
}).strict();

const duplicateComponentProposalSchema = z.object({
  kind: z.literal("duplicate-component"),
  id: stableIdSchema,
  targetBookGraphId: bookGraphIdSchema,
  evidenceLocator: z.string().min(1),
  evidenceSha256: sha256Schema,
  reason: z.string().min(1),
  proposalAudit: proposalAuditSchema,
  administrativeReview: administrativeDecisionSchema.nullable(),
}).strict();

export const resolutionProposalSchema = z.discriminatedUnion("kind", [
  exactEditionProposalSchema,
  duplicateComponentProposalSchema,
]);

const sourceLeadSchema = z.object({
  id: stableIdSchema,
  locator: z.string().min(1),
  claimedRole: z.enum([
    "possible-official-source",
    "possible-edition-page",
    "possible-download",
    "catalog-record",
    "other",
  ]),
  disposition: z.enum(["unassessed", "promoted", "rejected"]),
  promotedProposalId: stableIdSchema.nullable(),
  observation: observationSchema,
}).strict();

const blockerResolutionSchema = z.object({
  actorId: z.string().min(1),
  resolvedAt: z.iso.datetime(),
  evidenceSha256: sha256Schema.nullable(),
  note: z.string().min(1),
}).strict();

const resolutionBlockerSchema = z.object({
  id: stableIdSchema,
  proposalId: stableIdSchema.nullable(),
  domain: z.enum(["identity", "acquisition", "license", "importer"]),
  code: z.enum([
    "edition-ambiguous",
    "source-not-found",
    "authentication-required",
    "paywall",
    "manual-scan-required",
    "license-unclear",
    "license-conflict",
    "redistribution-restricted",
    "format-unsupported",
    "corrupt-source",
    "adapter-needed",
    "other",
  ]),
  state: z.enum(["open", "resolved"]),
  opened: observationSchema,
  resolution: blockerResolutionSchema.nullable(),
}).strict();

const importerAssessmentSchema = z.object({
  id: stableIdSchema,
  proposalId: stableIdSchema,
  adapterId: stableIdSchema,
  outcome: z.enum([
    "not-tested",
    "candidate-produced",
    "incompatible",
    "needs-adapter",
    "candidate-output-rejected",
  ]),
  sourcePinSha256: sha256Schema.nullable(),
  extractionArtifactSha256: sha256Schema.nullable(),
  graphArtifactSha256: sha256Schema.nullable(),
  assessedBy: z.string().min(1),
  assessedAt: z.iso.datetime(),
  note: z.string().min(1),
}).strict();

export const sourceResolutionRecordSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  sourceSetRevision: z.string().min(1),
  bookGraphId: bookGraphIdSchema,
  leads: z.array(sourceLeadSchema),
  proposals: z.array(resolutionProposalSchema),
  selectedProposalId: stableIdSchema.nullable(),
  blockers: z.array(resolutionBlockerSchema),
  importerAssessments: z.array(importerAssessmentSchema),
}).strict();

const resolutionStateSchema = z.enum([
  "unresolved",
  "candidate-exact-edition",
  "verified-exact-edition",
  "candidate-duplicate",
  "verified-duplicate",
]);

const importerStateSchema = z.enum([
  "not-assessed",
  "candidate-produced",
  "incompatible",
  "needs-adapter",
  "candidate-output-rejected",
]);

const sourceResolutionManifestEntrySchema = z.object({
  bookGraphId: bookGraphIdSchema,
  sourceRecordId: sourceRecordIdSchema,
  sourceOrdinal: z.number().int().positive(),
  componentId: stableIdSchema,
  componentLabel: z.string().min(1),
  resolutionPath: resolutionPathSchema.nullable(),
  resolutionState: resolutionStateSchema,
  selectedProposalId: stableIdSchema.nullable(),
  leadCount: z.number().int().nonnegative(),
  proposalCount: z.number().int().nonnegative(),
  openBlockerDomains: z.array(z.enum(["identity", "acquisition", "license", "importer"])),
  importerState: importerStateSchema,
  graphArtifactPath: z.string().regex(/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u).nullable(),
}).strict();

export const sourceResolutionManifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  sourceSetRevision: z.string().min(1),
  sourceRecordCount: z.number().int().positive(),
  componentCount: z.number().int().positive(),
  resolutionRecordCount: z.number().int().nonnegative(),
  summary: z.object({
    unresolvedComponentCount: z.number().int().nonnegative(),
    candidateExactEditionCount: z.number().int().nonnegative(),
    verifiedExactEditionCount: z.number().int().nonnegative(),
    candidateDuplicateCount: z.number().int().nonnegative(),
    verifiedDuplicateCount: z.number().int().nonnegative(),
    blockedComponentCount: z.number().int().nonnegative(),
    importerCandidateProducedCount: z.number().int().nonnegative(),
  }).strict(),
  entries: z.array(sourceResolutionManifestEntrySchema),
}).strict();

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function boundResolutionContext(context) {
  if (!context
    || typeof context.sourceSetRevision !== "string"
    || context.sourceSetRevision.length === 0
    || typeof context.bookGraphId !== "string"
    || !/^S\d{4}:[a-z0-9][a-z0-9-]*$/u.test(context.bookGraphId)) {
    throw new Error("A proposal/review subject requires its source-set revision and book graph ID");
  }
  return {
    sourceSetRevision: context.sourceSetRevision,
    bookGraphId: context.bookGraphId,
  };
}

export function proposalSubject(proposal, context) {
  const binding = boundResolutionContext(context);
  if (proposal.kind === "exact-edition") {
    return {
      ...binding,
      kind: proposal.kind,
      id: proposal.id,
      edition: proposal.edition,
    };
  }
  return {
    ...binding,
    kind: proposal.kind,
    id: proposal.id,
    targetBookGraphId: proposal.targetBookGraphId,
    evidenceLocator: proposal.evidenceLocator,
    evidenceSha256: proposal.evidenceSha256,
    reason: proposal.reason,
  };
}

export function proposalSubjectSha256(proposal, context) {
  return sha256Subject(proposalSubject(proposal, context));
}

export function licenseSubject(proposal, context) {
  if (proposal.kind !== "exact-edition") throw new Error("Only an exact-edition proposal has a license subject");
  return {
    ...boundResolutionContext(context),
    editionId: proposal.edition.editionId,
    stableLocator: proposal.edition.stableLocator,
    accessKind: proposal.edition.accessKind,
    licenseSpdx: proposal.edition.licenseSpdx,
    licenseUrl: proposal.edition.licenseUrl,
    licenseNote: proposal.edition.licenseNote,
    distributionClass: proposal.licenseAssessment.distributionClass,
  };
}

export function licenseSubjectSha256(proposal, context) {
  return sha256Subject(licenseSubject(proposal, context));
}

export function sourcePinSubject(edition) {
  return {
    stableLocator: edition.stableLocator,
    sourceRepository: edition.sourceRepository,
    sourceRevision: edition.sourceRevision,
    artifactSha256: edition.artifactSha256,
  };
}

export function sourcePinSha256(edition) {
  return sha256Subject(sourcePinSubject(edition));
}

function validateAdministrativeDecision(review, proposal, administrators, context, label) {
  if (!review) return;
  if (!administrators.has(review.actorId)) {
    throw new Error(`${label} reviewer is not an authorized administrator`);
  }
  if (review.actorId === proposal.proposalAudit.actorId) {
    throw new Error(`${label} lacks independent administrative review`);
  }
  if (review.subjectSha256 !== proposalSubjectSha256(proposal, context)) {
    throw new Error(`${label} administrative review is stale`);
  }
}

export function validateSourceResolutionRecord(
  rawRecord,
  {
    expectedBookGraphId,
    sourceSetRevision,
    administratorActorIds = [],
  },
) {
  const record = sourceResolutionRecordSchema.parse(rawRecord);
  if (record.bookGraphId !== expectedBookGraphId) {
    throw new Error(`${record.bookGraphId} does not match expected component ${expectedBookGraphId}`);
  }
  if (record.sourceSetRevision !== sourceSetRevision) {
    throw new Error(`${record.bookGraphId} targets a stale source-set revision`);
  }

  unique(record.leads.map(({ id }) => id), `${record.bookGraphId} lead ID`);
  const proposalIds = unique(record.proposals.map(({ id }) => id), `${record.bookGraphId} proposal ID`);
  unique(record.blockers.map(({ id }) => id), `${record.bookGraphId} blocker ID`);
  unique(record.importerAssessments.map(({ id }) => id), `${record.bookGraphId} importer-assessment ID`);
  const administrators = new Set(administratorActorIds);
  const subjectContext = {
    sourceSetRevision: record.sourceSetRevision,
    bookGraphId: record.bookGraphId,
  };

  const approvedProposals = [];
  for (const proposal of record.proposals) {
    if (proposal.proposalAudit.subjectSha256 !== proposalSubjectSha256(proposal, subjectContext)) {
      throw new Error(`${record.bookGraphId}:${proposal.id} proposal audit is stale`);
    }
    validateAdministrativeDecision(
      proposal.administrativeReview,
      proposal,
      administrators,
      subjectContext,
      `${record.bookGraphId}:${proposal.id}`,
    );
    if (proposal.administrativeReview?.decision === "approved") approvedProposals.push(proposal);

    if (proposal.kind === "exact-edition") {
      if (proposal.id !== proposal.edition.editionId) {
        throw new Error(`${record.bookGraphId}:${proposal.id} must use its exact edition ID`);
      }
      const licenseReview = proposal.licenseAssessment.administrativeReview;
      if (proposal.licenseAssessment.status === "candidate") {
        if (licenseReview !== null || proposal.licenseAssessment.distributionClass !== "review-required") {
          throw new Error(`${record.bookGraphId}:${proposal.id} candidate license cannot authorize distribution`);
        }
      } else {
        if (!licenseReview || licenseReview.decision !== "approved") {
          throw new Error(`${record.bookGraphId}:${proposal.id} verified license lacks approval`);
        }
        if (!administrators.has(licenseReview.actorId)) {
          throw new Error(`${record.bookGraphId}:${proposal.id} license reviewer is not an authorized administrator`);
        }
        if (licenseReview.actorId === proposal.proposalAudit.actorId) {
          throw new Error(`${record.bookGraphId}:${proposal.id} license review is not independent`);
        }
        if (licenseReview.subjectSha256 !== licenseSubjectSha256(proposal, subjectContext)) {
          throw new Error(`${record.bookGraphId}:${proposal.id} license review is stale`);
        }
      }
    } else if (proposal.targetBookGraphId === record.bookGraphId) {
      throw new Error(`${record.bookGraphId}:${proposal.id} cannot duplicate itself`);
    }
  }

  if (approvedProposals.length > 1) {
    throw new Error(`${record.bookGraphId} has more than one approved resolution proposal`);
  }
  if (approvedProposals.length === 0 && record.selectedProposalId !== null) {
    throw new Error(`${record.bookGraphId} selects a proposal without administrative approval`);
  }
  if (approvedProposals.length === 1 && record.selectedProposalId !== approvedProposals[0].id) {
    throw new Error(`${record.bookGraphId} must select its one approved resolution proposal`);
  }

  for (const lead of record.leads) {
    if (lead.disposition === "promoted") {
      if (!lead.promotedProposalId || !proposalIds.has(lead.promotedProposalId)) {
        throw new Error(`${record.bookGraphId}:${lead.id} promoted lead lacks its proposal`);
      }
    } else if (lead.promotedProposalId !== null) {
      throw new Error(`${record.bookGraphId}:${lead.id} non-promoted lead names a proposal`);
    }
  }

  for (const blocker of record.blockers) {
    if ((blocker.state === "resolved") !== (blocker.resolution !== null)) {
      throw new Error(`${record.bookGraphId}:${blocker.id} blocker state and resolution disagree`);
    }
    if (blocker.proposalId !== null && !proposalIds.has(blocker.proposalId)) {
      throw new Error(`${record.bookGraphId}:${blocker.id} blocker names a missing proposal`);
    }
  }

  for (const assessment of record.importerAssessments) {
    const proposal = record.proposals.find(({ id }) => id === assessment.proposalId);
    if (!proposal || proposal.kind !== "exact-edition") {
      throw new Error(`${record.bookGraphId}:${assessment.id} importer assessment lacks an exact-edition proposal`);
    }
    if (assessment.outcome === "candidate-produced") {
      if (assessment.sourcePinSha256 !== sourcePinSha256(proposal.edition)
        || assessment.extractionArtifactSha256 === null
        || assessment.graphArtifactSha256 === null) {
        throw new Error(`${record.bookGraphId}:${assessment.id} candidate-produced assessment has stale hashes`);
      }
    } else if (assessment.outcome === "not-tested") {
      if (assessment.sourcePinSha256 !== null
        || assessment.extractionArtifactSha256 !== null
        || assessment.graphArtifactSha256 !== null) {
        throw new Error(`${record.bookGraphId}:${assessment.id} untested assessment carries result hashes`);
      }
    }
  }

  return record;
}

export function resolutionStateFor(record) {
  if (record.selectedProposalId !== null) {
    const selected = record.proposals.find(({ id }) => id === record.selectedProposalId);
    if (!selected) throw new Error(`${record.bookGraphId} selects a missing proposal`);
    return selected.kind === "exact-edition" ? "verified-exact-edition" : "verified-duplicate";
  }
  const activeProposals = record.proposals.filter(({ administrativeReview }) => (
    administrativeReview?.decision !== "rejected"
  ));
  if (activeProposals.some(({ kind }) => kind === "exact-edition")) return "candidate-exact-edition";
  if (activeProposals.some(({ kind }) => kind === "duplicate-component")) return "candidate-duplicate";
  return "unresolved";
}

export function importerStateFor(record) {
  const relevantProposalIds = record.selectedProposalId === null
    ? new Set(record.proposals
      .filter(({ administrativeReview }) => administrativeReview?.decision !== "rejected")
      .map(({ id }) => id))
    : new Set([record.selectedProposalId]);
  const outcomes = new Set(record.importerAssessments
    .filter(({ proposalId }) => relevantProposalIds.has(proposalId))
    .map(({ outcome }) => outcome));
  if (outcomes.has("candidate-produced")) return "candidate-produced";
  if (outcomes.has("candidate-output-rejected")) return "candidate-output-rejected";
  if (outcomes.has("needs-adapter")) return "needs-adapter";
  if (outcomes.has("incompatible")) return "incompatible";
  return "not-assessed";
}

export function expectedSourceComponents(registry) {
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.records)) {
    throw new Error("Source registry has no records array");
  }
  const expected = [];
  const seen = new Set();
  registry.records.forEach((record, index) => {
    if (!/^S\d{4}$/u.test(record?.id) || record.ordinal !== index + 1) {
      throw new Error("Source registry record identity/order is invalid");
    }
    if (!Array.isArray(record.requiredEditionComponents) || record.requiredEditionComponents.length === 0) {
      throw new Error(`${record.id} has no required edition components`);
    }
    for (const component of record.requiredEditionComponents) {
      if (!/^[a-z0-9][a-z0-9-]*$/u.test(component?.id) || typeof component.label !== "string" || !component.label) {
        throw new Error(`${record.id} has an invalid required edition component`);
      }
      const bookGraphId = `${record.id}:${component.id}`;
      if (seen.has(bookGraphId)) throw new Error(`Duplicate source component: ${bookGraphId}`);
      seen.add(bookGraphId);
      expected.push({
        bookGraphId,
        sourceRecordId: record.id,
        sourceOrdinal: record.ordinal,
        componentId: component.id,
        componentLabel: component.label,
        canonicalResolutionPath: `${record.id}/${component.id}.json`,
      });
    }
  });
  return expected;
}

export function administratorActorIds(verificationPolicy) {
  if (verificationPolicy?.requireIndependentAdministrativeReview !== true
    || !Array.isArray(verificationPolicy.administrators)
    || verificationPolicy.administrators.length === 0) {
    throw new Error("Verification policy does not require an administrator allowlist");
  }
  return unique(
    verificationPolicy.administrators.map(({ actorId }) => actorId),
    "administrator actor ID",
  );
}
