import { z } from "zod";

export const statementKindSchema = z.enum([
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "definition",
  "notation",
  "imported-result",
]);

export const routeTypeSchema = z.enum([
  "source-faithful",
  "compressed-source",
  "pedagogical",
  "alternative",
  "formalization-friendly",
  "historical",
]);

export const verificationStatusSchema = z.enum([
  "statement-only",
  "formalization-drafted",
  "conditional-formalization",
  "kernel-checked",
  "axiom-audited",
  "human-formal-alignment-pending",
  "alignment-reviewed",
  "fully-certified",
]);

export const sourceLocationSchema = z.object({
  type: z.enum(["paper", "manuscript", "lean", "repository", "metadata-provider"]),
  label: z.string().min(1),
  url: z.url().optional(),
  locator: z.string().min(1),
  version: z.string().min(1),
  repository: z.string().min(1).optional(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
  file: z.string().min(1).optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
});

export const formalDeclarationSchema = z.object({
  repository: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{40}$/i),
  file: z.string().min(1),
  name: z.string().min(1),
  lineStart: z.number().int().positive(),
  kernelChecks: z.boolean(),
  hasSorry: z.boolean(),
  hasAdmit: z.boolean(),
  usesExternalInput: z.boolean(),
  axiomFootprint: z.array(z.string().min(1)),
  auditNote: z.string().min(1),
});

export const proofStepSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  dependencyRefs: z.array(z.string().min(1)),
  formalDeclarationRefs: z.array(z.string().min(1)),
});

export const proofRouteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: routeTypeSchema,
  conceptualCost: z.enum(["low", "moderate", "high", "specialist"]),
  dependencies: z.array(z.string().min(1)),
  status: z.enum(["complete", "proof-idea", "proof-not-yet-distilled"]),
  proof: z.string().min(1),
  steps: z.array(proofStepSchema),
  sourceAttribution: z.string().min(1),
  verificationStatus: verificationStatusSchema,
  formalAlignment: z.enum(["not-applicable", "pending", "partial", "reviewed"]),
});

export const contributorSchema = z.object({
  distillers: z.array(z.string().min(1)),
  mathematicalReviewers: z.array(z.string().min(1)),
  formalizers: z.array(z.string().min(1)),
  alignmentReviewers: z.array(z.string().min(1)),
});

export const modificationRecordSchema = z.object({
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  contributors: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
});

export const statementSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  paperId: z.string().min(1),
  localLabel: z.string().min(1),
  globalStatementId: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
  kind: statementKindSchema,
  title: z.string().min(1),
  section: z.string().min(1),
  importance: z.enum(["hero", "major", "normal", "minor"]),
  exactStatement: z.string().min(1),
  sourceStatement: z.string().min(1).optional(),
  statementNote: z.string().min(1).optional(),
  idea: z.string().min(1),
  proofRoutes: z.array(proofRouteSchema),
  dependencies: z.array(z.string().min(1)),
  sourceLocations: z.array(sourceLocationSchema).min(1),
  formalDeclarations: z.array(formalDeclarationSchema),
  formalStatus: verificationStatusSchema,
  formalAlignment: z.enum(["not-applicable", "pending", "partial", "reviewed"]),
  contributors: contributorSchema,
  version: z.string().min(1),
  modificationHistory: z.array(modificationRecordSchema).min(1),
  tags: z.array(z.string().min(1)),
  intuition: z.string().optional(),
  examples: z.array(z.string().min(1)).optional(),
  nonExamples: z.array(z.string().min(1)).optional(),
  equivalenceCluster: z.string().min(1).optional(),
});

export const identifierSchema = z.object({
  doi: z.string().min(1).optional(),
  arxiv: z.string().min(1).optional(),
  openAlex: z.string().min(1).optional(),
  semanticScholar: z.string().min(1).optional(),
  isbn: z.string().min(1).optional(),
  internal: z.string().min(1).optional(),
});

export const paperSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  date: z.string().min(1),
  venue: z.string().min(1),
  status: z.enum(["gold", "provisional"]),
  identifiers: identifierSchema,
  sourceLinks: z.array(z.object({ label: z.string().min(1), url: z.url() })),
  contributionSummary: z.string().min(1),
  abstract: z.string().optional(),
  abstractLicense: z.string().optional(),
  importProvenance: z.array(z.object({
    provider: z.string().min(1),
    retrievedAt: z.iso.datetime(),
    recordId: z.string().min(1),
  })).min(1),
  license: z.object({ metadata: z.string().min(1), fullText: z.string().min(1) }),
  rewriteStatus: z.enum(["gold-distillation", "partial-distillation", "metadata-only"]),
  theoremExtractionStatus: z.enum(["complete", "partial", "not-started"]),
  formalizationStatus: verificationStatusSchema,
  citationCoverage: z.object({
    outgoingFound: z.number().int().nonnegative(),
    outgoingResolved: z.number().int().nonnegative(),
    incomingFound: z.number().int().nonnegative(),
    incomingResolved: z.number().int().nonnegative(),
    incomingStatus: z.enum(["complete", "provider-visible-only", "target-unindexed", "queued", "identifier-unresolved"]),
    providerSearchesAttempted: z.number().int().nonnegative(),
    recursiveClosureComplete: z.boolean(),
    note: z.string().min(1),
  }),
  version: z.string().min(1),
  modificationHistory: z.array(modificationRecordSchema).min(1),
  featured: z.boolean(),
  graph: z.object({
    mainRoot: z.string().optional(),
    paperRoots: z.array(z.string()),
    views: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      roots: z.array(z.string().min(1)),
      initiallyExpanded: z.array(z.string().min(1)),
    })),
  }),
});

export const citationEdgeSchema = z.object({
  id: z.string().min(1),
  citingPaperId: z.string().min(1),
  citedPaperId: z.string().min(1),
  discoveredFromPaperId: z.string().min(1),
  discoveryDirection: z.enum(["outgoing", "incoming"]),
  provenance: z.array(z.object({
    provider: z.string().min(1),
    providerRecordId: z.string().min(1),
    retrievedAt: z.iso.datetime(),
    evidenceUrl: z.url().optional(),
  })).min(1),
  confidence: z.enum(["exact-id", "provider-linked", "manual-reviewed", "uncertain"]),
});

export const ingestionQueueItemSchema = z.object({
  paperId: z.string().min(1),
  state: z.enum(["queued", "metadata-fetched", "neighbors-fetched", "blocked", "complete-direct-neighborhood"]),
  nextTasks: z.array(z.enum(["resolve-identifiers", "fetch-outgoing", "fetch-incoming", "deduplicate", "review-match"])),
  attempts: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  lastError: z.string().optional(),
  unresolvedProviderIds: z.array(z.string().regex(/^W\d+$/)).optional(),
});

function normalizeCorpusIdentifier(kind: string, value: string) {
  switch (kind) {
    case "openAlex":
      return value.replace(/^https?:\/\/(?:api\.)?openalex\.org\/(?:works\/)?/i, "")
        .replace(/^openalex:/i, "").split(/[/?#]/, 1)[0]?.toUpperCase();
    case "doi":
      return value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "").toLowerCase();
    case "arxiv":
      return value.replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, "")
        .replace(/^arxiv:\s*/i, "").replace(/\.pdf$/i, "")
        .replace(/v\d+$/i, "").toLowerCase();
    case "isbn":
      return value.replace(/^isbn(?:-1[03])?:?\s*/i, "").replace(/[\s-]/g, "").toUpperCase();
    default:
      return value.toLowerCase();
  }
}

export const corpusSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.iso.datetime(),
  papers: z.array(paperSchema),
  statements: z.array(statementSchema),
  citationEdges: z.array(citationEdgeSchema),
  ingestionQueue: z.array(ingestionQueueItemSchema),
}).superRefine((corpus, context) => {
  const paperIds = new Set<string>();
  const statementIds = new Set<string>();
  const globalIds = new Set<string>();
  const stableIdentifierOwners = new Map<string, string>();

  for (const paper of corpus.papers) {
    if (paperIds.has(paper.id)) {
      context.addIssue({ code: "custom", message: `Duplicate paper ID: ${paper.id}` });
    }
    paperIds.add(paper.id);
    for (const [kind, value] of Object.entries(paper.identifiers)) {
      if (!value) continue;
      const key = `${kind}:${normalizeCorpusIdentifier(kind, value)}`;
      const owner = stableIdentifierOwners.get(key);
      if (owner && owner !== paper.id) {
        context.addIssue({ code: "custom", message: `Duplicate stable identifier ${key} on papers ${owner} and ${paper.id}` });
      } else {
        stableIdentifierOwners.set(key, paper.id);
      }
    }
    const coverage = paper.citationCoverage;
    if (coverage.outgoingResolved > coverage.outgoingFound ||
        coverage.incomingResolved > coverage.incomingFound) {
      context.addIssue({ code: "custom", message: `Paper ${paper.id} has citation coverage resolved above found` });
    }
    if (coverage.incomingStatus === "complete" && coverage.incomingResolved !== coverage.incomingFound) {
      context.addIssue({ code: "custom", message: `Paper ${paper.id} claims complete incoming coverage with unresolved records` });
    }
    if (coverage.recursiveClosureComplete &&
        (coverage.outgoingResolved !== coverage.outgoingFound ||
          coverage.incomingResolved !== coverage.incomingFound ||
          coverage.incomingStatus !== "complete")) {
      context.addIssue({ code: "custom", message: `Paper ${paper.id} has an impossible recursive citation-closure claim` });
    }
  }

  for (const statement of corpus.statements) {
    if (statementIds.has(statement.id)) {
      context.addIssue({ code: "custom", message: `Duplicate statement ID: ${statement.id}` });
    }
    if (globalIds.has(statement.globalStatementId)) {
      context.addIssue({ code: "custom", message: `Duplicate global statement ID: ${statement.globalStatementId}` });
    }
    statementIds.add(statement.id);
    globalIds.add(statement.globalStatementId);
    if (!paperIds.has(statement.paperId)) {
      context.addIssue({ code: "custom", message: `Statement ${statement.id} has missing paper ${statement.paperId}` });
    }
  }

  for (const statement of corpus.statements) {
    if (Boolean(statement.sourceStatement) !== Boolean(statement.statementNote)) {
      context.addIssue({
        code: "custom",
        message: `${statement.id} must pair preserved source wording with a statement audit note`,
      });
    }

    for (const dependency of statement.dependencies) {
      if (!statementIds.has(dependency)) {
        context.addIssue({ code: "custom", message: `${statement.id} has missing dependency ${dependency}` });
      }
      if (dependency === statement.id) {
        context.addIssue({ code: "custom", message: `${statement.id} depends on itself` });
      }
    }

    const routeDependencyUnion = new Set(statement.proofRoutes.flatMap((route) => route.dependencies));
    if (statement.proofRoutes.length > 0 &&
        (routeDependencyUnion.size !== new Set(statement.dependencies).size ||
          statement.dependencies.some((dependency) => !routeDependencyUnion.has(dependency)))) {
      context.addIssue({ code: "custom", message: `${statement.id} top-level dependencies must equal the union of route dependencies` });
    }

    const routeIds = new Set<string>();
    for (const route of statement.proofRoutes) {
      if (routeIds.has(route.id)) {
        context.addIssue({ code: "custom", message: `${statement.id} has duplicate proof route ID ${route.id}` });
      }
      routeIds.add(route.id);

      const routeDependencies = new Set(route.dependencies);
      for (const dependency of route.dependencies) {
        if (!statementIds.has(dependency)) {
          context.addIssue({ code: "custom", message: `${statement.id}/${route.id} has missing route dependency ${dependency}` });
        }
      }
      const stepIds = new Set<string>();
      for (const step of route.steps) {
        if (stepIds.has(step.id)) {
          context.addIssue({
            code: "custom",
            message: `${statement.id}/${route.id} has duplicate proof step ID ${step.id}`,
          });
        }
        stepIds.add(step.id);

        for (const dependency of step.dependencyRefs) {
          if (!routeDependencies.has(dependency)) {
            context.addIssue({ code: "custom", message: `${statement.id}/${route.id}/${step.id} uses undeclared proof reference ${dependency}` });
          }
        }
        const declarationNames = new Set(statement.formalDeclarations.map((declaration) => declaration.name));
        for (const declaration of step.formalDeclarationRefs) {
          if (!declarationNames.has(declaration)) {
            context.addIssue({ code: "custom", message: `${statement.id}/${route.id}/${step.id} uses undeclared formal reference ${declaration}` });
          }
        }
      }
      if (route.status === "complete") {
        const usedDependencies = new Set(route.steps.flatMap((step) => step.dependencyRefs));
        for (const dependency of route.dependencies) {
          if (!usedDependencies.has(dependency)) {
            context.addIssue({ code: "custom", message: `${statement.id}/${route.id} displays unused dependency ${dependency}` });
          }
        }
      }

      if (route.verificationStatus === "fully-certified") {
        const impossible = route.status !== "complete" ||
          route.formalAlignment !== "reviewed" ||
          statement.formalStatus !== "fully-certified" ||
          statement.formalAlignment !== "reviewed" ||
          statement.formalDeclarations.length === 0 ||
          statement.formalDeclarations.some((declaration) =>
            !declaration.kernelChecks || declaration.hasSorry || declaration.hasAdmit ||
            declaration.usesExternalInput || declaration.axiomFootprint.length > 0);
        if (impossible) {
          context.addIssue({
            code: "custom",
            message: `${statement.id}/${route.id} has an impossible fully-certified route state`,
          });
        }
      }
    }

    if (["theorem", "lemma", "proposition", "corollary", "imported-result"].includes(statement.kind) && statement.proofRoutes.length === 0) {
      context.addIssue({ code: "custom", message: `${statement.id} is theorem-like but has no proof route` });
    }

    if (statement.formalStatus === "fully-certified") {
      const impossible = statement.formalAlignment !== "reviewed" || statement.formalDeclarations.length === 0 ||
        statement.formalDeclarations.some((declaration) => !declaration.kernelChecks || declaration.hasSorry || declaration.hasAdmit || declaration.usesExternalInput || declaration.axiomFootprint.length > 0);
      if (impossible) {
        context.addIssue({ code: "custom", message: `${statement.id} has an impossible fully-certified state` });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const statementById = new Map(corpus.statements.map((statement) => [statement.id, statement]));
  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycle = [...path.slice(cycleStart), id];
      const cluster = statementById.get(id)?.equivalenceCluster;
      const reviewed = cluster && cycle.every((cycleId) => statementById.get(cycleId)?.equivalenceCluster === cluster);
      if (!reviewed) {
        context.addIssue({ code: "custom", message: `Unreviewed dependency cycle: ${cycle.join(" -> ")}` });
      }
      return;
    }
    visiting.add(id);
    const statement = statementById.get(id);
    statement?.dependencies.forEach((dependency) => visit(dependency, [...path, id]));
    visiting.delete(id);
    visited.add(id);
  };
  corpus.statements.forEach((statement) => visit(statement.id, []));

  for (const paper of corpus.papers) {
    for (const root of [paper.graph.mainRoot, ...paper.graph.paperRoots, ...paper.graph.views.flatMap((view) => [...view.roots, ...view.initiallyExpanded])].filter(Boolean) as string[]) {
      if (!statementIds.has(root)) {
        context.addIssue({ code: "custom", message: `Paper ${paper.id} graph references missing statement ${root}` });
      }
    }
  }

  const citationIds = new Set<string>();
  const citationEndpoints = new Set<string>();
  for (const edge of corpus.citationEdges) {
    if (citationIds.has(edge.id)) {
      context.addIssue({ code: "custom", message: `Duplicate citation edge ID: ${edge.id}` });
    }
    citationIds.add(edge.id);
    const endpoints = `${edge.citingPaperId}\u0000${edge.citedPaperId}`;
    if (citationEndpoints.has(endpoints)) {
      context.addIssue({ code: "custom", message: `Duplicate citation endpoint pair: ${edge.citingPaperId} -> ${edge.citedPaperId}` });
    }
    citationEndpoints.add(endpoints);
    if (edge.citingPaperId === edge.citedPaperId) {
      context.addIssue({ code: "custom", message: `Citation ${edge.id} is a self-citation edge` });
    }
    if (!paperIds.has(edge.citingPaperId) || !paperIds.has(edge.citedPaperId)) {
      context.addIssue({ code: "custom", message: `Citation ${edge.id} has a missing paper endpoint` });
    }
    if (!paperIds.has(edge.discoveredFromPaperId)) {
      context.addIssue({ code: "custom", message: `Citation ${edge.id} has a missing discovery source` });
    }
    const expectedDiscoverySource = edge.discoveryDirection === "outgoing"
      ? edge.citingPaperId
      : edge.citedPaperId;
    if (edge.discoveredFromPaperId !== expectedDiscoverySource) {
      context.addIssue({ code: "custom", message: `Citation ${edge.id} has an inconsistent discovery direction` });
    }
  }

  const queuePaperIds = new Set<string>();
  const queueByPaperId = new Map<string, typeof corpus.ingestionQueue[number]>();
  for (const item of corpus.ingestionQueue) {
    if (queuePaperIds.has(item.paperId)) {
      context.addIssue({ code: "custom", message: `Duplicate queue item for paper ${item.paperId}` });
    }
    queuePaperIds.add(item.paperId);
    queueByPaperId.set(item.paperId, item);
    if (!paperIds.has(item.paperId)) {
      context.addIssue({ code: "custom", message: `Queue item references missing paper ${item.paperId}` });
    }
    if (item.state === "complete-direct-neighborhood" &&
        (item.nextTasks.length > 0 || (item.unresolvedProviderIds?.length ?? 0) > 0)) {
      context.addIssue({ code: "custom", message: `Complete queue item ${item.paperId} still has unresolved work` });
    }
    if ((item.unresolvedProviderIds?.length ?? 0) > 0 && !item.nextTasks.includes("fetch-outgoing")) {
      context.addIssue({ code: "custom", message: `Queue item ${item.paperId} retains unresolved provider IDs without an outgoing retry` });
    }
  }

  for (const paper of corpus.papers) {
    if (paper.citationCoverage.recursiveClosureComplete &&
        queueByPaperId.get(paper.id)?.state !== "complete-direct-neighborhood") {
      context.addIssue({ code: "custom", message: `Paper ${paper.id} claims recursive closure without a completed direct-neighborhood queue item` });
    }
  }
});

export type Corpus = z.infer<typeof corpusSchema>;
export type Paper = z.infer<typeof paperSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type ProofRoute = z.infer<typeof proofRouteSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export function validateCorpus(input: unknown): Corpus {
  return corpusSchema.parse(input);
}
