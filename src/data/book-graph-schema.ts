import { z } from "zod";
import { sourceRegistrySchema, type SourceRegistry } from "./source-coverage-schema";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const sourceRecordIdSchema = z.string().regex(/^S\d{4}$/);
const familyIdSchema = z.string().regex(/^F\d{2}$/);
const relativeBookFileSchema = z.string().regex(/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/);

const captureAuditSchema = z.object({
  actorId: z.string().min(1),
  capturedAt: z.iso.datetime(),
  artifactSha256: sha256Schema,
}).strict();

const independentReviewSchema = z.object({
  actorId: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  evidenceSha256: sha256Schema,
  note: z.string().min(1),
}).strict();

const pendingEvidenceSchema = z.object({
  status: z.literal("pending"),
  sourceUnitIds: z.tuple([]),
  locator: z.null(),
  captureAudit: z.null(),
  independentReview: z.null(),
  note: z.string().min(1),
}).strict();

const capturedEvidenceSchema = z.object({
  status: z.literal("captured"),
  sourceUnitIds: z.array(stableIdSchema).min(1),
  locator: z.string().min(1),
  captureAudit: captureAuditSchema,
  independentReview: z.null(),
  note: z.string().min(1),
}).strict();

const reviewedEvidenceSchema = z.object({
  status: z.literal("reviewed"),
  sourceUnitIds: z.array(stableIdSchema).min(1),
  locator: z.string().min(1),
  captureAudit: captureAuditSchema,
  independentReview: independentReviewSchema,
  note: z.string().min(1),
}).strict();

export const graphEvidenceSchema = z.discriminatedUnion("status", [
  pendingEvidenceSchema,
  capturedEvidenceSchema,
  reviewedEvidenceSchema,
]);

export const exactEditionSchema = z.object({
  editionId: stableIdSchema,
  label: z.string().min(1),
  publicationYear: z.number().int().min(1400).max(2200).nullable(),
  publisher: z.string().min(1).nullable(),
  stableLocator: z.string().min(1),
  sourceFormat: z.enum(["pdf", "html", "pretext-xml", "latex", "epub", "scanned-images", "other"]),
  accessKind: z.enum(["open", "public-domain", "licensed", "owned-copy", "library-access", "citation-only"]),
  licenseSpdx: z.string().min(1).nullable(),
  licenseUrl: z.url().nullable(),
  licenseNote: z.string().min(1),
  sourceRepository: z.url().nullable(),
  sourceRevision: z.string().min(1).nullable(),
  artifactSha256: sha256Schema,
  unitManifestSha256: sha256Schema,
  sourceUnitKind: z.enum(["page", "chapter", "section", "source-file", "web-node"]),
}).strict();

export const bookSourceUnitSchema = z.object({
  id: stableIdSchema,
  ordinal: z.number().int().positive(),
  label: z.string().min(1),
  locator: z.string().min(1),
  contentSha256: sha256Schema,
}).strict();

export const sourceUnitInventorySchema = z.object({
  sourceUnitId: stableIdSchema,
  theoremNodeIds: z.array(stableIdSchema),
  supportNodeIds: z.array(stableIdSchema),
  theoremFreeAttestation: z.boolean(),
  evidence: graphEvidenceSchema,
}).strict();

export const theoremNodeKindSchema = z.enum([
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "claim",
  "named-result",
  "exercise-result",
]);

export const supportNodeKindSchema = z.enum([
  "definition",
  "axiom",
  "assumption",
  "notation",
  "construction",
  "algorithm",
  "example",
  "calculation",
]);

const graphNodeBase = z.object({
  id: stableIdSchema,
  sourceLabel: z.string().min(1),
  sourceXmlId: z.string().min(1).nullable(),
  sourceLocator: z.string().min(1),
  title: z.string().min(1),
  normalizedStatement: z.string().min(1),
  sourceTextSha256: sha256Schema,
  evidence: graphEvidenceSchema,
}).strict();

const theoremNodeSchema = graphNodeBase.extend({
  nodeClass: z.literal("theorem-like"),
  kind: theoremNodeKindSchema,
}).strict();

const supportNodeSchema = graphNodeBase.extend({
  nodeClass: z.literal("support"),
  kind: supportNodeKindSchema,
}).strict();

export const bookGraphNodeSchema = z.discriminatedUnion("nodeClass", [
  theoremNodeSchema,
  supportNodeSchema,
]);

export const externalInputSchema = z.object({
  id: stableIdSchema,
  kind: z.enum(["external-theorem", "axiom", "definition", "standard-fact", "citation"]),
  label: z.string().min(1),
  normalizedStatement: z.string().min(1),
  sourceTextSha256: sha256Schema.nullable(),
  sourceCitation: z.string().min(1),
  evidence: graphEvidenceSchema,
}).strict();

const prerequisiteReferenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("node"), id: stableIdSchema }).strict(),
  z.object({ type: z.literal("external-input"), id: stableIdSchema }).strict(),
]);

export const directDependencySchema = z.object({
  id: stableIdSchema,
  dependentNodeId: stableIdSchema,
  prerequisite: prerequisiteReferenceSchema,
  role: z.enum(["logical", "definition", "notation", "construction", "calculation", "citation"]),
  rationale: z.string().min(1),
  evidence: graphEvidenceSchema,
}).strict();

export const proofRouteSchema = z.object({
  id: stableIdSchema,
  theoremNodeId: stableIdSchema,
  routeKind: z.enum(["source-proof", "alternate-proof", "derivation", "root-attestation"]),
  dependencyIds: z.array(stableIdSchema),
  summary: z.string().min(1),
  evidence: graphEvidenceSchema,
}).strict();

const unresolvedReferenceResolutionSchema = z.object({
  status: z.literal("unresolved"),
  note: z.string().min(1),
}).strict();

const resolvedReferenceResolutionSchema = z.object({
  status: z.literal("resolved"),
  target: prerequisiteReferenceSchema,
  directDependencyId: stableIdSchema.nullable(),
  note: z.string().min(1),
}).strict();

export const sourceReferenceSchema = z.object({
  id: stableIdSchema,
  ownerNodeId: stableIdSchema,
  basis: z.enum(["proof-xref", "statement-xref"]),
  ref: z.string().min(1),
  context: z.string().min(1),
  locator: z.string().min(1),
  resolution: z.discriminatedUnion("status", [
    unresolvedReferenceResolutionSchema,
    resolvedReferenceResolutionSchema,
  ]),
  evidence: graphEvidenceSchema,
}).strict();

const extractionAuditSchema = z.object({
  actorId: z.string().min(1),
  completedAt: z.iso.datetime(),
  artifactSha256: sha256Schema,
  sourceUnitCount: z.number().int().nonnegative(),
  unitInventoryCount: z.number().int().nonnegative(),
}).strict();

const graphAuditSchema = z.object({
  actorId: z.string().min(1),
  completedAt: z.iso.datetime(),
  artifactSha256: sha256Schema,
  nodeCount: z.number().int().nonnegative(),
  externalInputCount: z.number().int().nonnegative(),
  directDependencyCount: z.number().int().nonnegative(),
  proofRouteCount: z.number().int().nonnegative(),
  referenceCount: z.number().int().nonnegative(),
}).strict();

export const extractionStatusSchema = z.enum(["awaiting-edition", "queued", "extracting", "extracted", "reviewed", "blocked"]);
export const graphStatusSchema = z.enum(["not-started", "building", "extracted", "reviewed-complete", "blocked"]);

const extractionStateSchema = z.object({
  status: extractionStatusSchema,
  extractionAudit: extractionAuditSchema.nullable(),
  independentReview: independentReviewSchema.nullable(),
  note: z.string().min(1),
}).strict();

const graphStateSchema = z.object({
  status: graphStatusSchema,
  graphAudit: graphAuditSchema.nullable(),
  independentReview: independentReviewSchema.nullable(),
  note: z.string().min(1),
}).strict();

export const bookGraphIdentitySchema = z.object({
  bookGraphId: z.string().regex(/^S\d{4}:[a-z0-9][a-z0-9-]*$/),
  sourceSetRevision: z.string().min(1),
  sourceRecordId: sourceRecordIdSchema,
  sourceOrdinal: z.number().int().positive(),
  familyId: familyIdSchema,
  sourceTitle: z.string().min(1),
  sourceAuthorLine: z.string().min(1),
  sourceRawCitation: z.string().min(1),
  componentId: stableIdSchema,
  componentLabel: z.string().min(1),
}).strict();

export const bookGraphFileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  phase: z.literal("source-dependency-graph"),
  identity: bookGraphIdentitySchema,
  exactEdition: exactEditionSchema.nullable(),
  sourceUnits: z.array(bookSourceUnitSchema),
  unitInventories: z.array(sourceUnitInventorySchema),
  graph: z.object({
    nodes: z.array(bookGraphNodeSchema),
    externalInputs: z.array(externalInputSchema),
    directDependencies: z.array(directDependencySchema),
    proofRoutes: z.array(proofRouteSchema),
    references: z.array(sourceReferenceSchema),
  }).strict(),
  extractionState: extractionStateSchema,
  graphState: graphStateSchema,
}).strict();

export const bookGraphManifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  sourceSetRevision: z.string().min(1),
  sourceRecordCount: z.number().int().positive(),
  componentFileCount: z.number().int().positive(),
  summary: z.object({
    exactEditionResolvedCount: z.number().int().nonnegative(),
    awaitingEditionCount: z.number().int().nonnegative(),
    reviewedExtractionCount: z.number().int().nonnegative(),
    reviewedCompleteGraphCount: z.number().int().nonnegative(),
    sourceUnitCount: z.number().int().nonnegative(),
    inventoriedSourceUnitCount: z.number().int().nonnegative(),
    reviewedSourceUnitCount: z.number().int().nonnegative(),
    theoremNodeCount: z.number().int().nonnegative(),
    unroutedTheoremCount: z.number().int().nonnegative(),
    supportNodeCount: z.number().int().nonnegative(),
    dependencyCount: z.number().int().nonnegative(),
    reviewedDependencyCount: z.number().int().nonnegative(),
    unresolvedReferenceCount: z.number().int().nonnegative(),
  }).strict(),
  entries: z.array(z.object({
    bookGraphId: z.string().regex(/^S\d{4}:[a-z0-9][a-z0-9-]*$/),
    sourceRecordId: sourceRecordIdSchema,
    sourceOrdinal: z.number().int().positive(),
    componentId: stableIdSchema,
    componentLabel: z.string().min(1),
    path: relativeBookFileSchema,
    extractionStatus: extractionStatusSchema,
    graphStatus: graphStatusSchema,
    exactEditionResolved: z.boolean(),
    sourceUnitCount: z.number().int().nonnegative(),
    inventoriedSourceUnitCount: z.number().int().nonnegative(),
    reviewedSourceUnitCount: z.number().int().nonnegative(),
    theoremNodeCount: z.number().int().nonnegative(),
    unroutedTheoremCount: z.number().int().nonnegative(),
    supportNodeCount: z.number().int().nonnegative(),
    dependencyCount: z.number().int().nonnegative(),
    reviewedDependencyCount: z.number().int().nonnegative(),
    unresolvedReferenceCount: z.number().int().nonnegative(),
  }).strict()),
}).strict();

export type BookGraphFile = z.infer<typeof bookGraphFileSchema>;
export type BookGraphManifest = z.infer<typeof bookGraphManifestSchema>;
export type BookGraphEvidence = z.infer<typeof graphEvidenceSchema>;

function unique(values: readonly string[], label: string): Set<string> {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function assertIndependentReview(
  workerId: string,
  artifactSha256: string,
  review: z.infer<typeof independentReviewSchema>,
  label: string,
) {
  if (workerId === review.actorId) throw new Error(`${label} lacks independent review`);
  if (artifactSha256 !== review.evidenceSha256) throw new Error(`${label} review is stale`);
}

function validateEvidence(evidence: BookGraphEvidence, sourceUnitIds: Set<string>, label: string) {
  unique(evidence.sourceUnitIds, `${label} evidence source-unit relation`);
  for (const sourceUnitId of evidence.sourceUnitIds) {
    if (!sourceUnitIds.has(sourceUnitId)) throw new Error(`${label} cites missing source unit ${sourceUnitId}`);
  }
  if (evidence.status === "reviewed") {
    assertIndependentReview(
      evidence.captureAudit.actorId,
      evidence.captureAudit.artifactSha256,
      evidence.independentReview,
      label,
    );
  }
}

function graphIsEmpty(graph: BookGraphFile["graph"]) {
  return graph.nodes.length === 0
    && graph.externalInputs.length === 0
    && graph.directDependencies.length === 0
    && graph.proofRoutes.length === 0
    && graph.references.length === 0;
}

function validateWorkflow(file: BookGraphFile) {
  const extraction = file.extractionState;
  const graphState = file.graphState;

  if (file.exactEdition === null) {
    if (file.sourceUnits.length !== 0 || file.unitInventories.length !== 0 || !graphIsEmpty(file.graph)) {
      throw new Error(`${file.identity.bookGraphId} has source data without an exact edition`);
    }
    if (!["awaiting-edition", "blocked"].includes(extraction.status)) {
      throw new Error(`${file.identity.bookGraphId} cannot extract before identifying an exact edition`);
    }
    if (!["not-started", "blocked"].includes(graphState.status)) {
      throw new Error(`${file.identity.bookGraphId} cannot build a graph before identifying an exact edition`);
    }
  } else {
    if (file.sourceUnits.length === 0) throw new Error(`${file.identity.bookGraphId} exact edition has no source-unit manifest`);
    if ((file.exactEdition.sourceRepository === null) !== (file.exactEdition.sourceRevision === null)) {
      throw new Error(`${file.identity.bookGraphId} exact edition must pair a source repository with its pinned revision`);
    }
    if (extraction.status === "awaiting-edition") {
      throw new Error(`${file.identity.bookGraphId} still awaits an edition after one was identified`);
    }
  }

  if (["awaiting-edition", "queued", "extracting", "blocked"].includes(extraction.status)) {
    if (extraction.extractionAudit || extraction.independentReview) {
      throw new Error(`${file.identity.bookGraphId} extraction state carries premature audit data`);
    }
  } else if (extraction.status === "extracted") {
    if (!extraction.extractionAudit || extraction.independentReview) {
      throw new Error(`${file.identity.bookGraphId} extracted state has invalid review data`);
    }
  } else {
    if (!extraction.extractionAudit || !extraction.independentReview) {
      throw new Error(`${file.identity.bookGraphId} reviewed extraction lacks audit data`);
    }
    assertIndependentReview(
      extraction.extractionAudit.actorId,
      extraction.extractionAudit.artifactSha256,
      extraction.independentReview,
      `${file.identity.bookGraphId} extraction`,
    );
  }
  if (extraction.extractionAudit?.sourceUnitCount !== undefined
    && extraction.extractionAudit.sourceUnitCount !== file.sourceUnits.length) {
    throw new Error(`${file.identity.bookGraphId} extraction audit has stale source-unit counts`);
  }
  if (extraction.extractionAudit?.unitInventoryCount !== undefined
    && extraction.extractionAudit.unitInventoryCount !== file.unitInventories.length) {
    throw new Error(`${file.identity.bookGraphId} extraction audit has stale unit-inventory counts`);
  }

  if (["not-started", "building", "blocked"].includes(graphState.status)) {
    if (graphState.graphAudit || graphState.independentReview) {
      throw new Error(`${file.identity.bookGraphId} graph state carries premature audit data`);
    }
    if (graphState.status === "not-started" && !graphIsEmpty(file.graph)) {
      throw new Error(`${file.identity.bookGraphId} not-started graph already contains entities`);
    }
  } else if (graphState.status === "extracted") {
    if (!["extracted", "reviewed"].includes(extraction.status)) {
      throw new Error(`${file.identity.bookGraphId} graph cannot be extracted before source extraction`);
    }
    if (!graphState.graphAudit || graphState.independentReview) {
      throw new Error(`${file.identity.bookGraphId} extracted graph has invalid review data`);
    }
  } else {
    if (!graphState.graphAudit || !graphState.independentReview) {
      throw new Error(`${file.identity.bookGraphId} reviewed graph lacks audit data`);
    }
    if (extraction.status !== "reviewed") {
      throw new Error(`${file.identity.bookGraphId} graph cannot be complete before extraction review`);
    }
    assertIndependentReview(
      graphState.graphAudit.actorId,
      graphState.graphAudit.artifactSha256,
      graphState.independentReview,
      `${file.identity.bookGraphId} graph`,
    );
  }
  if (graphState.status === "building"
    && !["extracting", "extracted", "reviewed"].includes(extraction.status)) {
    throw new Error(`${file.identity.bookGraphId} graph cannot be built before source extraction begins`);
  }

  if (graphState.graphAudit) {
    const counts = {
      nodeCount: file.graph.nodes.length,
      externalInputCount: file.graph.externalInputs.length,
      directDependencyCount: file.graph.directDependencies.length,
      proofRouteCount: file.graph.proofRoutes.length,
      referenceCount: file.graph.references.length,
    };
    for (const [key, count] of Object.entries(counts)) {
      if (graphState.graphAudit[key as keyof typeof counts] !== count) {
        throw new Error(`${file.identity.bookGraphId} graph audit has stale entity counts`);
      }
    }
  }
}

function assertAcyclicDependencies(file: BookGraphFile, nodeIds: Set<string>) {
  const prerequisites = new Map<string, string[]>();
  for (const nodeId of nodeIds) prerequisites.set(nodeId, []);
  for (const dependency of file.graph.directDependencies) {
    if (dependency.prerequisite.type === "node") {
      prerequisites.get(dependency.dependentNodeId)?.push(dependency.prerequisite.id);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) throw new Error(`${file.identity.bookGraphId} dependency cycle includes ${nodeId}`);
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const prerequisiteId of prerequisites.get(nodeId) ?? []) visit(prerequisiteId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const nodeId of nodeIds) visit(nodeId);
}

export function validateBookGraphFile(rawFile: unknown): BookGraphFile {
  const file = bookGraphFileSchema.parse(rawFile);
  const sourceUnitIds = unique(file.sourceUnits.map((unit) => unit.id), `${file.identity.bookGraphId} source-unit ID`);
  file.sourceUnits.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) throw new Error(`${file.identity.bookGraphId} source-unit manifest loses order`);
  });

  const allEntityIds = unique(
    [
      ...file.sourceUnits.map((unit) => unit.id),
      ...file.graph.nodes.map((node) => node.id),
      ...file.graph.externalInputs.map((input) => input.id),
      ...file.graph.directDependencies.map((dependency) => dependency.id),
      ...file.graph.proofRoutes.map((route) => route.id),
      ...file.graph.references.map((reference) => reference.id),
    ],
    `${file.identity.bookGraphId} entity ID`,
  );
  void allEntityIds;
  const nodeIds = new Set(file.graph.nodes.map((node) => node.id));
  const nodeById = new Map(file.graph.nodes.map((node) => [node.id, node]));
  const sourceUnitById = new Map(file.sourceUnits.map((unit) => [unit.id, unit]));
  const theoremNodeIds = new Set(
    file.graph.nodes.filter((node) => node.nodeClass === "theorem-like").map((node) => node.id),
  );
  const externalInputIds = new Set(file.graph.externalInputs.map((input) => input.id));
  const dependencyIds = new Set(file.graph.directDependencies.map((dependency) => dependency.id));

  const inventorySourceUnitIds = unique(
    file.unitInventories.map((inventory) => inventory.sourceUnitId),
    `${file.identity.bookGraphId} source-unit inventory`,
  );
  const inventoriedNodeIds = new Set<string>();
  for (const inventory of file.unitInventories) {
    if (!sourceUnitIds.has(inventory.sourceUnitId)) {
      throw new Error(`${file.identity.bookGraphId} inventories missing source unit ${inventory.sourceUnitId}`);
    }
    validateEvidence(inventory.evidence, sourceUnitIds, `${inventory.sourceUnitId} inventory`);
    if (inventory.evidence.sourceUnitIds.length !== 1
      || inventory.evidence.sourceUnitIds[0] !== inventory.sourceUnitId) {
      throw new Error(`${inventory.sourceUnitId} inventory evidence must cite exactly its own source unit`);
    }
    const sourceUnit = sourceUnitById.get(inventory.sourceUnitId);
    if (inventory.evidence.status !== "pending"
      && inventory.evidence.captureAudit.artifactSha256 !== sourceUnit?.contentSha256) {
      throw new Error(`${inventory.sourceUnitId} inventory evidence is stale for its source content`);
    }
    unique(inventory.theoremNodeIds, `${inventory.sourceUnitId} theorem inventory relation`);
    unique(inventory.supportNodeIds, `${inventory.sourceUnitId} support inventory relation`);
    if (inventory.theoremFreeAttestation !== (inventory.theoremNodeIds.length === 0)) {
      throw new Error(`${inventory.sourceUnitId} has an inconsistent theorem-free attestation`);
    }
    for (const nodeId of inventory.theoremNodeIds) {
      if (!theoremNodeIds.has(nodeId)) throw new Error(`${inventory.sourceUnitId} inventories missing or non-theorem node ${nodeId}`);
      if (!new Set<string>(nodeById.get(nodeId)?.evidence.sourceUnitIds ?? []).has(inventory.sourceUnitId)) {
        throw new Error(`${nodeId} inventory does not match the node's source evidence`);
      }
      if (inventoriedNodeIds.has(nodeId)) throw new Error(`${nodeId} appears in more than one source-unit inventory`);
      inventoriedNodeIds.add(nodeId);
    }
    for (const nodeId of inventory.supportNodeIds) {
      if (!nodeIds.has(nodeId) || theoremNodeIds.has(nodeId)) {
        throw new Error(`${inventory.sourceUnitId} inventories missing or non-support node ${nodeId}`);
      }
      if (!new Set<string>(nodeById.get(nodeId)?.evidence.sourceUnitIds ?? []).has(inventory.sourceUnitId)) {
        throw new Error(`${nodeId} inventory does not match the node's source evidence`);
      }
      if (inventoriedNodeIds.has(nodeId)) throw new Error(`${nodeId} appears in more than one source-unit inventory`);
      inventoriedNodeIds.add(nodeId);
    }
  }
  if (["extracted", "reviewed"].includes(file.extractionState.status)) {
    if (inventorySourceUnitIds.size !== sourceUnitIds.size) {
      throw new Error(`${file.identity.bookGraphId} extracted inventory does not cover every source unit`);
    }
    if (inventoriedNodeIds.size !== nodeIds.size) {
      throw new Error(`${file.identity.bookGraphId} extracted inventory does not assign every graph node`);
    }
    const pendingInventory = file.unitInventories.find((inventory) => inventory.evidence.status === "pending");
    if (pendingInventory) throw new Error(`${pendingInventory.sourceUnitId} inventory remains pending after extraction`);
  }
  if (file.extractionState.status === "reviewed") {
    const unreviewedInventory = file.unitInventories.find((inventory) => inventory.evidence.status !== "reviewed");
    if (unreviewedInventory) {
      throw new Error(`${unreviewedInventory.sourceUnitId} inventory lacks independent review`);
    }
  }

  for (const node of file.graph.nodes) validateEvidence(node.evidence, sourceUnitIds, node.id);
  for (const input of file.graph.externalInputs) validateEvidence(input.evidence, sourceUnitIds, input.id);

  const dependencyPairs = new Set<string>();
  for (const dependency of file.graph.directDependencies) {
    validateEvidence(dependency.evidence, sourceUnitIds, dependency.id);
    if (!nodeIds.has(dependency.dependentNodeId)) {
      throw new Error(`${dependency.id} has missing dependent node ${dependency.dependentNodeId}`);
    }
    if (dependency.prerequisite.type === "node") {
      if (!nodeIds.has(dependency.prerequisite.id)) {
        throw new Error(`${dependency.id} has missing prerequisite node ${dependency.prerequisite.id}`);
      }
      if (dependency.dependentNodeId === dependency.prerequisite.id) {
        throw new Error(`${dependency.id} is a self-dependency`);
      }
    } else if (!externalInputIds.has(dependency.prerequisite.id)) {
      throw new Error(`${dependency.id} has missing external input ${dependency.prerequisite.id}`);
    }
    const pair = `${dependency.dependentNodeId}|${dependency.prerequisite.type}|${dependency.prerequisite.id}`;
    if (dependencyPairs.has(pair)) throw new Error(`${dependency.id} duplicates a direct dependency`);
    dependencyPairs.add(pair);
  }

  const routeSignatures = new Set<string>();
  for (const route of file.graph.proofRoutes) {
    validateEvidence(route.evidence, sourceUnitIds, route.id);
    if (!theoremNodeIds.has(route.theoremNodeId)) {
      throw new Error(`${route.id} points to a missing or non-theorem node ${route.theoremNodeId}`);
    }
    unique(route.dependencyIds, `${route.id} dependency relation`);
    if (route.routeKind === "root-attestation") {
      if (route.dependencyIds.length !== 0) throw new Error(`${route.id} root attestation has dependencies`);
    } else if (route.dependencyIds.length === 0) {
      throw new Error(`${route.id} proof route has no dependencies; use a root attestation`);
    }
    for (const dependencyId of route.dependencyIds) {
      if (!dependencyIds.has(dependencyId)) throw new Error(`${route.id} cites missing dependency ${dependencyId}`);
      const dependency = file.graph.directDependencies.find((candidate) => candidate.id === dependencyId);
      if (dependency?.dependentNodeId !== route.theoremNodeId) {
        throw new Error(`${route.id} cites a dependency owned by another node`);
      }
    }
    const signature = `${route.theoremNodeId}|${route.routeKind}|${[...route.dependencyIds].sort().join(",")}`;
    if (routeSignatures.has(signature)) throw new Error(`${route.id} duplicates a proof route`);
    routeSignatures.add(signature);
  }

  const referenceSignatures = new Set<string>();
  for (const reference of file.graph.references) {
    validateEvidence(reference.evidence, sourceUnitIds, reference.id);
    if (!nodeIds.has(reference.ownerNodeId)) {
      throw new Error(`${reference.id} has missing owner node ${reference.ownerNodeId}`);
    }
    const signature = `${reference.ownerNodeId}|${reference.basis}|${reference.ref}|${reference.locator}`;
    if (referenceSignatures.has(signature)) throw new Error(`${reference.id} duplicates a source reference`);
    referenceSignatures.add(signature);
    if (reference.resolution.status === "unresolved") continue;

    const { target, directDependencyId } = reference.resolution;
    if (target.type === "node" && !nodeIds.has(target.id)) {
      throw new Error(`${reference.id} resolves to missing node ${target.id}`);
    }
    if (target.type === "external-input" && !externalInputIds.has(target.id)) {
      throw new Error(`${reference.id} resolves to missing external input ${target.id}`);
    }
    if (reference.basis === "proof-xref" && directDependencyId === null) {
      throw new Error(`${reference.id} resolved proof xref lacks a direct dependency`);
    }
    if (directDependencyId !== null) {
      const dependency = file.graph.directDependencies.find((candidate) => candidate.id === directDependencyId);
      if (!dependency) throw new Error(`${reference.id} cites missing dependency ${directDependencyId}`);
      if (dependency.dependentNodeId !== reference.ownerNodeId
        || dependency.prerequisite.type !== target.type
        || dependency.prerequisite.id !== target.id) {
        throw new Error(`${reference.id} does not match its direct dependency`);
      }
    }
  }

  assertAcyclicDependencies(file, nodeIds);
  validateWorkflow(file);

  if (file.graphState.status === "reviewed-complete") {
    if (theoremNodeIds.size === 0) throw new Error(`${file.identity.bookGraphId} reviewed graph has no theorem-like nodes`);
    const evidenceItems = [
      ...file.graph.nodes.map((node) => [node.id, node.evidence] as const),
      ...file.graph.externalInputs.map((input) => [input.id, input.evidence] as const),
      ...file.graph.directDependencies.map((dependency) => [dependency.id, dependency.evidence] as const),
      ...file.graph.proofRoutes.map((route) => [route.id, route.evidence] as const),
      ...file.graph.references.map((reference) => [reference.id, reference.evidence] as const),
    ];
    for (const [id, evidence] of evidenceItems) {
      if (evidence.status !== "reviewed") throw new Error(`${id} is not independently reviewed`);
    }
    for (const theoremNodeId of theoremNodeIds) {
      const reviewedRoutes = file.graph.proofRoutes.filter((route) => (
        route.theoremNodeId === theoremNodeId && route.evidence.status === "reviewed"
      ));
      if (reviewedRoutes.length === 0) {
        throw new Error(`${theoremNodeId} lacks a reviewed proof route or root attestation`);
      }
    }
    const unresolvedReference = file.graph.references.find((reference) => reference.resolution.status === "unresolved");
    if (unresolvedReference) {
      throw new Error(`${unresolvedReference.id} remains unresolved in a reviewed-complete graph`);
    }
    const routedDependencyIds = new Set(file.graph.proofRoutes.flatMap((route) => route.dependencyIds));
    for (const dependencyId of dependencyIds) {
      if (!routedDependencyIds.has(dependencyId)) throw new Error(`${dependencyId} is not attested by a proof route`);
    }
  }

  return file;
}

function expectedIdentity(registry: SourceRegistry, record: SourceRegistry["records"][number], component: SourceRegistry["records"][number]["requiredEditionComponents"][number]) {
  return {
    bookGraphId: `${record.id}:${component.id}`,
    sourceSetRevision: registry.sourceSetRevision,
    sourceRecordId: record.id,
    sourceOrdinal: record.ordinal,
    familyId: record.familyId,
    sourceTitle: record.title,
    sourceAuthorLine: record.authorLine,
    sourceRawCitation: record.rawCitation,
    componentId: component.id,
    componentLabel: component.label,
  };
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type ManifestEntry = BookGraphManifest["entries"][number];
type ManifestBaseEntry = Pick<ManifestEntry,
  "bookGraphId" | "sourceRecordId" | "sourceOrdinal" | "componentId" | "componentLabel" | "path">;
type ManifestMetrics = Omit<ManifestEntry, keyof ManifestBaseEntry>;

function manifestMetrics(file: BookGraphFile): ManifestMetrics {
  const routedTheoremIds = new Set(file.graph.proofRoutes.map((route) => route.theoremNodeId));
  return {
    extractionStatus: file.extractionState.status,
    graphStatus: file.graphState.status,
    exactEditionResolved: file.exactEdition !== null,
    sourceUnitCount: file.sourceUnits.length,
    inventoriedSourceUnitCount: file.unitInventories.filter((inventory) => inventory.evidence.status !== "pending").length,
    reviewedSourceUnitCount: file.unitInventories.filter((inventory) => inventory.evidence.status === "reviewed").length,
    theoremNodeCount: file.graph.nodes.filter((node) => node.nodeClass === "theorem-like").length,
    unroutedTheoremCount: file.graph.nodes.filter((node) => (
      node.nodeClass === "theorem-like" && !routedTheoremIds.has(node.id)
    )).length,
    supportNodeCount: file.graph.nodes.filter((node) => node.nodeClass === "support").length,
    dependencyCount: file.graph.directDependencies.length,
    reviewedDependencyCount: file.graph.directDependencies.filter((dependency) => dependency.evidence.status === "reviewed").length,
    unresolvedReferenceCount: file.graph.references.filter((reference) => reference.resolution.status === "unresolved").length,
  };
}

function manifestSummary(entries: readonly ManifestEntry[]): BookGraphManifest["summary"] {
  return {
    exactEditionResolvedCount: entries.filter((entry) => entry.exactEditionResolved).length,
    awaitingEditionCount: entries.filter((entry) => entry.extractionStatus === "awaiting-edition").length,
    reviewedExtractionCount: entries.filter((entry) => entry.extractionStatus === "reviewed").length,
    reviewedCompleteGraphCount: entries.filter((entry) => entry.graphStatus === "reviewed-complete").length,
    sourceUnitCount: entries.reduce((sum, entry) => sum + entry.sourceUnitCount, 0),
    inventoriedSourceUnitCount: entries.reduce((sum, entry) => sum + entry.inventoriedSourceUnitCount, 0),
    reviewedSourceUnitCount: entries.reduce((sum, entry) => sum + entry.reviewedSourceUnitCount, 0),
    theoremNodeCount: entries.reduce((sum, entry) => sum + entry.theoremNodeCount, 0),
    unroutedTheoremCount: entries.reduce((sum, entry) => sum + entry.unroutedTheoremCount, 0),
    supportNodeCount: entries.reduce((sum, entry) => sum + entry.supportNodeCount, 0),
    dependencyCount: entries.reduce((sum, entry) => sum + entry.dependencyCount, 0),
    reviewedDependencyCount: entries.reduce((sum, entry) => sum + entry.reviewedDependencyCount, 0),
    unresolvedReferenceCount: entries.reduce((sum, entry) => sum + entry.unresolvedReferenceCount, 0),
  };
}

export function validateBookGraphCorpus(
  rawRegistry: unknown,
  rawManifest: unknown,
  rawFilesByPath: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>,
): { registry: SourceRegistry; manifest: BookGraphManifest; filesByPath: Map<string, BookGraphFile> } {
  const registry = sourceRegistrySchema.parse(rawRegistry);
  const manifest = bookGraphManifestSchema.parse(rawManifest);
  const rawFiles = rawFilesByPath instanceof Map
    ? new Map(rawFilesByPath)
    : new Map(Object.entries(rawFilesByPath));

  if (manifest.sourceSetRevision !== registry.sourceSetRevision) throw new Error("Book manifest targets a stale source-set revision");
  if (manifest.sourceRecordCount !== registry.records.length) throw new Error("Book manifest source-record count is stale");

  const expected = new Map<string, {
    identity: BookGraphFile["identity"];
    entry: ManifestBaseEntry;
  }>();
  for (const record of registry.records) {
    for (const component of record.requiredEditionComponents) {
      const relativePath = `${record.id}/${component.id}.json`;
      expected.set(relativePath, {
        identity: expectedIdentity(registry, record, component),
        entry: {
          bookGraphId: `${record.id}:${component.id}`,
          sourceRecordId: record.id,
          sourceOrdinal: record.ordinal,
          componentId: component.id,
          componentLabel: component.label,
          path: relativePath,
        },
      });
    }
  }
  if (manifest.componentFileCount !== expected.size || manifest.entries.length !== expected.size) {
    throw new Error(`Book manifest does not cover every required component (${manifest.entries.length}/${expected.size})`);
  }

  unique(manifest.entries.map((entry) => entry.path), "book manifest path");
  unique(manifest.entries.map((entry) => entry.bookGraphId), "book graph ID");
  for (const entry of manifest.entries) {
    if (entry.path.includes("..") || entry.path.startsWith("/") || entry.path.includes("\\")) {
      throw new Error(`Unsafe book graph path: ${entry.path}`);
    }
    const expectedItem = expected.get(entry.path);
    const baseEntry: ManifestBaseEntry = {
      bookGraphId: entry.bookGraphId,
      sourceRecordId: entry.sourceRecordId,
      sourceOrdinal: entry.sourceOrdinal,
      componentId: entry.componentId,
      componentLabel: entry.componentLabel,
      path: entry.path,
    };
    if (!expectedItem || !sameJson(baseEntry, expectedItem.entry)) {
      throw new Error(`${entry.path} is not the exact registry component indexed by the manifest`);
    }
  }

  if (rawFiles.size !== expected.size) {
    throw new Error(`Book graph file set is not one-to-one with registry components (${rawFiles.size}/${expected.size})`);
  }
  const parsedFiles = new Map<string, BookGraphFile>();
  for (const [relativePath, rawFile] of rawFiles) {
    if (!relativeBookFileSchema.safeParse(relativePath).success || relativePath.includes("..") || relativePath.includes("\\")) {
      throw new Error(`Unsafe book graph path: ${relativePath}`);
    }
    const expectedItem = expected.get(relativePath);
    if (!expectedItem) throw new Error(`Unexpected book graph file: ${relativePath}`);
    const file = validateBookGraphFile(rawFile);
    if (!sameJson(file.identity, expectedItem.identity)) {
      throw new Error(`${relativePath} immutable identity does not match the source registry`);
    }
    const manifestEntry = manifest.entries.find((entry) => entry.path === relativePath);
    if (!manifestEntry || !sameJson(manifestMetrics(file), {
      extractionStatus: manifestEntry.extractionStatus,
      graphStatus: manifestEntry.graphStatus,
      exactEditionResolved: manifestEntry.exactEditionResolved,
      sourceUnitCount: manifestEntry.sourceUnitCount,
      inventoriedSourceUnitCount: manifestEntry.inventoriedSourceUnitCount,
      reviewedSourceUnitCount: manifestEntry.reviewedSourceUnitCount,
      theoremNodeCount: manifestEntry.theoremNodeCount,
      unroutedTheoremCount: manifestEntry.unroutedTheoremCount,
      supportNodeCount: manifestEntry.supportNodeCount,
      dependencyCount: manifestEntry.dependencyCount,
      reviewedDependencyCount: manifestEntry.reviewedDependencyCount,
      unresolvedReferenceCount: manifestEntry.unresolvedReferenceCount,
    })) {
      throw new Error(`${relativePath} manifest metrics are stale`);
    }
    parsedFiles.set(relativePath, file);
  }
  for (const relativePath of expected.keys()) {
    if (!parsedFiles.has(relativePath)) throw new Error(`Missing book graph file: ${relativePath}`);
  }
  if (!sameJson(manifest.summary, manifestSummary(manifest.entries))) {
    throw new Error("Book manifest summary is stale");
  }

  return { registry, manifest, filesByPath: parsedFiles };
}
