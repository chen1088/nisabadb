import { z } from "zod";

const compressionAdministrativeReviewSchema = z.object({
  actorId: z.string().min(1),
  actorRole: z.literal("administrator"),
  reviewedAt: z.iso.datetime(),
  evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().min(1),
});

export const compressionStatusSchema = z.enum([
  "mapped",
  "rewriting",
  "reviewed",
  "unresolved",
]);

export const frontierStateSchema = z.enum([
  "written",
  "outlined",
  "unmapped",
]);

export const sourceInventoryStateSchema = z.enum([
  "candidate-list",
  "section-mapping",
  "reviewed-for-convergence",
]);

export const rewritePotentialSchema = z.enum(["high", "medium", "bounded"]);

export const routeReviewStateSchema = z.enum(["candidate", "reviewed"]);

export const routeEquivalenceSchema = z.enum([
  "exact",
  "assumption-dependent",
  "weaker-result",
  "stronger-result",
  "editorial-hypothesis",
]);

export const dependencyKindSchema = z.enum([
  "original",
  "minimized",
  "reinterpretation",
]);

export const routeKindSchema = z.enum([
  "canonical",
  "computational",
  "geometric",
  "probabilistic",
  "structural",
  "formal",
]);

export const residualDispositionSchema = z.enum([
  "merge-into-core",
  "bridge",
  "alternate-route",
  "specialist-extension",
  "historical-context",
  "open-editorial-question",
]);

export const compressionSourceFamilySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  branch: z.string().min(1),
  inventoryState: sourceInventoryStateSchema,
  registryBranches: z.array(z.object({
    id: z.string().regex(/^F\d{2}$/),
    title: z.string().min(1),
  })).min(1),
  representativeSources: z.array(z.object({
    sourceRecordId: z.string().regex(/^S\d{4}$/),
    citation: z.string().min(1),
  })).min(1),
  editorialUse: z.string().min(1),
});

export const compressionBandSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  clusterIds: z.array(z.string().min(1)).min(1),
});

export const compressionRouteSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  kind: routeKindSchema,
  dependencyKind: dependencyKindSchema,
  reviewState: routeReviewStateSchema,
  equivalence: routeEquivalenceSchema,
  summary: z.string().min(1),
  prerequisiteClusterIds: z.array(z.string().min(1)),
  derivedFromRouteId: z.string().min(1).optional(),
  administrativeReview: compressionAdministrativeReviewSchema.nullable(),
});

export const compressionResidualSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  disposition: residualDispositionSchema,
  reason: z.string().min(1),
  status: compressionStatusSchema,
  sourceFamilyIds: z.array(z.string().min(1)).min(1),
  administrativeReview: compressionAdministrativeReviewSchema.nullable(),
});

export const compressionClusterSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  status: compressionStatusSchema,
  frontierState: frontierStateSchema,
  rewritePotential: rewritePotentialSchema,
  sourceFamilyIds: z.array(z.string().min(1)).min(2),
  knowledgeNodeIds: z.array(z.string().min(1)),
  canonicalIdea: z.string().min(1),
  rewriteDecision: z.string().min(1),
  notationResolutions: z.array(z.object({
    concept: z.string().min(1),
    canonical: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    resolution: z.string().min(1),
  })),
  routes: z.array(compressionRouteSchema).min(1),
  residuals: z.array(compressionResidualSchema),
  unlocks: z.array(z.string().min(1)).min(1),
  administrativeReview: compressionAdministrativeReviewSchema.nullable(),
});

export const compressionProgramSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  updatedAt: z.iso.date(),
  title: z.string().min(1),
  thesis: z.string().min(1),
  rewritePolicy: z.string().min(1),
  coverageNote: z.string().min(1),
  bands: z.array(compressionBandSchema).min(1),
  sourceFamilies: z.array(compressionSourceFamilySchema).min(1),
  clusters: z.array(compressionClusterSchema).min(1),
}).superRefine((program, context) => {
  const unique = (values: readonly string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) context.addIssue({ code: "custom", message: `Duplicate ${label}: ${value}` });
      seen.add(value);
    }
    return seen;
  };

  const familyIds = unique(program.sourceFamilies.map((family) => family.id), "source family ID");
  const clusterIds = unique(program.clusters.map((cluster) => cluster.id), "compression cluster ID");
  unique(program.bands.map((band) => band.id), "compression band ID");
  unique(program.clusters.map((cluster) => cluster.slug), "compression cluster slug");

  const bandMemberships = new Map<string, number>();
  for (const band of program.bands) {
    unique(band.clusterIds, `${band.id} cluster relation`);
    for (const clusterId of band.clusterIds) {
      if (!clusterIds.has(clusterId)) {
        context.addIssue({ code: "custom", message: `${band.id} has missing cluster ${clusterId}` });
      }
      bandMemberships.set(clusterId, (bandMemberships.get(clusterId) ?? 0) + 1);
    }
  }
  for (const clusterId of clusterIds) {
    if (bandMemberships.get(clusterId) !== 1) {
      context.addIssue({ code: "custom", message: `${clusterId} must belong to exactly one band` });
    }
  }

  for (const cluster of program.clusters) {
    unique(cluster.sourceFamilyIds, `${cluster.id} source family relation`);
    unique(cluster.knowledgeNodeIds, `${cluster.id} knowledge node relation`);
    unique(cluster.routes.map((route) => route.id), `${cluster.id} route ID`);
    unique(cluster.residuals.map((residual) => residual.id), `${cluster.id} residual ID`);
    for (const familyId of cluster.sourceFamilyIds) {
      if (!familyIds.has(familyId)) {
        context.addIssue({ code: "custom", message: `${cluster.id} has missing source family ${familyId}` });
      }
    }
    for (const route of cluster.routes) {
      for (const prerequisiteId of route.prerequisiteClusterIds) {
        if (!clusterIds.has(prerequisiteId)) {
          context.addIssue({ code: "custom", message: `${cluster.id} route has missing cluster ${prerequisiteId}` });
        }
        if (prerequisiteId === cluster.id) {
          context.addIssue({ code: "custom", message: `${cluster.id} route depends on itself` });
        }
      }
      if (route.derivedFromRouteId && !cluster.routes.some((candidate) => candidate.id === route.derivedFromRouteId)) {
        context.addIssue({ code: "custom", message: `${cluster.id} route has missing parent ${route.derivedFromRouteId}` });
      }
      if (route.dependencyKind === "minimized") {
        const parent = cluster.routes.find((candidate) => candidate.id === route.derivedFromRouteId);
        if (!parent || parent.dependencyKind !== "original") {
          context.addIssue({ code: "custom", message: `${route.id} must derive from an original route` });
        }
      }
      if ((route.reviewState === "reviewed") !== Boolean(route.administrativeReview)) {
        context.addIssue({ code: "custom", message: `${route.id} review state and administrative evidence disagree` });
      }
      if (route.equivalence === "exact" && route.reviewState !== "reviewed") {
        context.addIssue({ code: "custom", message: `${route.id} cannot claim exact equivalence before review` });
      }
    }
    if (cluster.routes.filter((route) => route.kind === "canonical").length !== 1) {
      context.addIssue({ code: "custom", message: `${cluster.id} must have exactly one canonical route` });
    }
    if (cluster.routes.filter((route) => route.dependencyKind === "original").length !== 1) {
      context.addIssue({ code: "custom", message: `${cluster.id} must have exactly one original route` });
    }
    if (cluster.routes.find((route) => route.kind === "canonical")?.dependencyKind !== "minimized") {
      context.addIssue({ code: "custom", message: `${cluster.id} canonical route must be minimized` });
    }
    for (const residual of cluster.residuals) {
      for (const familyId of residual.sourceFamilyIds) {
        if (!familyIds.has(familyId)) {
          context.addIssue({ code: "custom", message: `${residual.id} has missing source family ${familyId}` });
        }
      }
      if ((residual.status === "reviewed") !== Boolean(residual.administrativeReview)) {
        context.addIssue({ code: "custom", message: `${residual.id} review state and administrative evidence disagree` });
      }
    }
    if ((cluster.status === "reviewed") !== Boolean(cluster.administrativeReview)) {
      context.addIssue({ code: "custom", message: `${cluster.id} review state and administrative evidence disagree` });
    }
  }

  const dependencies = new Map(
    program.clusters.map((cluster) => [
      cluster.id,
      [...new Set(cluster.routes.flatMap((route) => route.prerequisiteClusterIds))],
    ]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      context.addIssue({ code: "custom", message: `Compression route cycle includes ${id}` });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of clusterIds) visit(id);
});

export type CompressionProgram = z.infer<typeof compressionProgramSchema>;
export type CompressionCluster = z.infer<typeof compressionClusterSchema>;
export type CompressionResidual = z.infer<typeof compressionResidualSchema>;

export function validateCompressionProgram(value: unknown): CompressionProgram {
  return compressionProgramSchema.parse(value);
}

type RegistryCrosswalk = {
  families: Array<{ id: string; title: string }>;
  records: Array<{ id: string; rawCitation: string; familyId: string }>;
};

export function validateCompressionRegistryCrosswalk(
  program: CompressionProgram,
  registry: RegistryCrosswalk,
) {
  const registryFamilyIds = new Set(registry.families.map((family) => family.id));
  const registryFamilyTitleById = new Map(registry.families.map((family) => [family.id, family.title]));
  const recordById = new Map(registry.records.map((record) => [record.id, record]));
  const coveredFamilyIds = new Set<string>();
  for (const lens of program.sourceFamilies) {
    const lensFamilyIds = new Set(lens.registryBranches.map((branch) => branch.id));
    if (lensFamilyIds.size !== lens.registryBranches.length) {
      throw new Error(`${lens.id} repeats an intake branch`);
    }
    for (const branch of lens.registryBranches) {
      const familyId = branch.id;
      if (!registryFamilyIds.has(familyId)) throw new Error(`${lens.id} has missing intake branch ${familyId}`);
      if (branch.title !== registryFamilyTitleById.get(familyId)) throw new Error(`${lens.id} has a stale intake branch title ${familyId}`);
      coveredFamilyIds.add(familyId);
    }
    const representativeIds = new Set<string>();
    for (const representative of lens.representativeSources) {
      if (representativeIds.has(representative.sourceRecordId)) {
        throw new Error(`${lens.id} repeats representative ${representative.sourceRecordId}`);
      }
      representativeIds.add(representative.sourceRecordId);
      const record = recordById.get(representative.sourceRecordId);
      if (!record || record.rawCitation !== representative.citation) {
        throw new Error(`${lens.id} has an unregistered representative ${representative.sourceRecordId}`);
      }
      if (!lensFamilyIds.has(record.familyId)) {
        throw new Error(`${lens.id} representative ${representative.sourceRecordId} is outside its intake branches`);
      }
    }
  }
  const missingFamilies = [...registryFamilyIds].filter((familyId) => !coveredFamilyIds.has(familyId));
  if (missingFamilies.length) throw new Error(`Compression crosswalk omits intake branches: ${missingFamilies.join(", ")}`);
  return program;
}

export function validateCompressionReviewPolicy(
  program: CompressionProgram,
  policy: { administrators: Array<{ actorId: string }> },
) {
  const administratorIds = new Set(policy.administrators.map((administrator) => administrator.actorId));
  const reviews = [
    ...program.clusters.map((cluster) => ({ id: cluster.id, review: cluster.administrativeReview })),
    ...program.clusters.flatMap((cluster) => cluster.routes.map((route) => ({ id: route.id, review: route.administrativeReview }))),
    ...program.clusters.flatMap((cluster) => cluster.residuals.map((residual) => ({ id: residual.id, review: residual.administrativeReview }))),
  ];
  for (const { id, review } of reviews) {
    if (review && !administratorIds.has(review.actorId)) {
      throw new Error(`${id} has an unauthorized compression review`);
    }
  }
  return program;
}
