import { describe, expect, it } from "vitest";
import rawManifest from "../../data/books/manifest.json";
import rawRegistry from "../../data/knowledge/source-records.json";
import {
  validateBookGraphCorpus,
  validateBookGraphFile,
  type BookGraphFile,
  type BookGraphManifest,
} from "./book-graph-schema";

const rawBookModules = import.meta.glob("../../data/books/S*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function diskCorpus() {
  const manifest = rawManifest as BookGraphManifest;
  const files = new Map<string, unknown>();
  for (const [modulePath, rawFile] of Object.entries(rawBookModules)) {
    files.set(modulePath.replace("../../data/books/", ""), rawFile);
  }
  return { manifest, files };
}

const extractor = {
  actorId: "worker:extractor",
  capturedAt: "2026-08-22T12:00:00Z",
  artifactSha256: "1".repeat(64),
};
const evidenceReview = {
  actorId: "reviewer:independent",
  reviewedAt: "2026-08-22T13:00:00Z",
  evidenceSha256: "1".repeat(64),
  note: "Independently checked against the exact source unit.",
};
const reviewedEvidence = {
  status: "reviewed" as const,
  sourceUnitIds: ["unit-1"],
  locator: "page 1",
  captureAudit: extractor,
  independentReview: evidenceReview,
  note: "Exact source evidence fixture.",
};

function reviewedGraphFixture(): BookGraphFile {
  const { files } = diskCorpus();
  const placeholder = structuredClone(files.get("S0001/level-1.json")) as BookGraphFile;
  placeholder.exactEdition = {
    editionId: "fixture-edition",
    label: "Exact fixture edition",
    publicationYear: 2024,
    publisher: "Fixture Press",
    stableLocator: "isbn:fixture",
    sourceFormat: "pdf",
    accessKind: "owned-copy",
    licenseSpdx: null,
    licenseUrl: null,
    licenseNote: "License review is pending for this exact edition.",
    sourceRepository: null,
    sourceRevision: null,
    artifactSha256: "a".repeat(64),
    unitManifestSha256: "b".repeat(64),
    sourceUnitKind: "page",
  };
  placeholder.sourceUnits = [{
    id: "unit-1",
    ordinal: 1,
    label: "Page 1",
    locator: "page 1",
    contentSha256: "1".repeat(64),
  }];
  placeholder.unitInventories = [{
    sourceUnitId: "unit-1",
    theoremNodeIds: ["theorem-1"],
    supportNodeIds: ["definition-1"],
    theoremFreeAttestation: false,
    evidence: structuredClone(reviewedEvidence),
  }];
  placeholder.graph.nodes = [
    {
      id: "definition-1",
      nodeClass: "support",
      kind: "definition",
      sourceLabel: "Definition 1",
      sourceXmlId: "definition-1",
      sourceLocator: "page 1",
      title: "Fixture definition",
      normalizedStatement: "A fixture object is defined.",
      sourceTextSha256: "2".repeat(64),
      evidence: structuredClone(reviewedEvidence),
    },
    {
      id: "theorem-1",
      nodeClass: "theorem-like",
      kind: "theorem",
      sourceLabel: "Theorem 1",
      sourceXmlId: "theorem-1",
      sourceLocator: "page 1",
      title: "Fixture theorem",
      normalizedStatement: "Every fixture object has the fixture property.",
      sourceTextSha256: "3".repeat(64),
      evidence: structuredClone(reviewedEvidence),
    },
  ];
  placeholder.graph.directDependencies = [{
    id: "dependency-1",
    dependentNodeId: "theorem-1",
    prerequisite: { type: "node", id: "definition-1" },
    role: "definition",
    rationale: "The theorem uses the fixture definition.",
    evidence: structuredClone(reviewedEvidence),
  }];
  placeholder.graph.proofRoutes = [{
    id: "route-1",
    theoremNodeId: "theorem-1",
    routeKind: "source-proof",
    dependencyIds: ["dependency-1"],
    summary: "Apply the fixture definition directly.",
    evidence: structuredClone(reviewedEvidence),
  }];
  placeholder.extractionState = {
    status: "reviewed",
    extractionAudit: {
      actorId: "worker:extractor",
      completedAt: "2026-08-22T12:00:00Z",
      artifactSha256: "d".repeat(64),
      sourceUnitCount: 1,
      unitInventoryCount: 1,
    },
    independentReview: {
      actorId: "reviewer:extraction",
      reviewedAt: "2026-08-22T13:00:00Z",
      evidenceSha256: "d".repeat(64),
      note: "Source-unit extraction independently reviewed.",
    },
    note: "Fixture extraction is complete.",
  };
  placeholder.graphState = {
    status: "reviewed-complete",
    graphAudit: {
      actorId: "worker:graph",
      completedAt: "2026-08-22T14:00:00Z",
      artifactSha256: "e".repeat(64),
      nodeCount: 2,
      externalInputCount: 0,
      directDependencyCount: 1,
      proofRouteCount: 1,
      referenceCount: 0,
    },
    independentReview: {
      actorId: "reviewer:graph",
      reviewedAt: "2026-08-22T15:00:00Z",
      evidenceSha256: "e".repeat(64),
      note: "The complete graph was independently reviewed.",
    },
    note: "Fixture graph is complete.",
  };
  return placeholder;
}

describe("one Phase-I dependency graph file per source component", () => {
  it("covers all 688 source rows and all 717 actual book or volume components exactly once", () => {
    const { manifest, files } = diskCorpus();
    const validated = validateBookGraphCorpus(rawRegistry, manifest, files);

    expect(validated.registry.records).toHaveLength(688);
    expect(validated.manifest.sourceRecordCount).toBe(688);
    expect(validated.manifest.componentFileCount).toBe(717);
    expect(validated.manifest.entries).toHaveLength(717);
    expect(validated.filesByPath).toHaveLength(717);
    expect(validated.manifest.summary).toEqual({
      exactEditionResolvedCount: 1,
      awaitingEditionCount: 716,
      reviewedExtractionCount: 0,
      reviewedCompleteGraphCount: 0,
      sourceUnitCount: 109,
      inventoriedSourceUnitCount: 109,
      reviewedSourceUnitCount: 0,
      theoremNodeCount: 38,
      unroutedTheoremCount: 35,
      supportNodeCount: 74,
      dependencyCount: 3,
      reviewedDependencyCount: 0,
      unresolvedReferenceCount: 0,
    });
    expect(validated.filesByPath.get("S0001/level-1.json")?.identity.bookGraphId).toBe("S0001:level-1");
    expect(validated.filesByPath.get("S0074/volume-3.json")?.identity.componentLabel).toBe("Volume 3");
    const pilot = validated.filesByPath.get("S0060/complete-source.json");
    expect(pilot?.exactEdition).not.toBeNull();
    expect(pilot?.extractionState.status).toBe("extracted");
    expect(pilot?.graphState.status).toBe("extracted");
    expect([...validated.filesByPath.entries()].filter(([path]) => path !== "S0060/complete-source.json").every(([, file]) => (
      file.exactEdition === null
      && file.extractionState.status === "awaiting-edition"
      && file.graphState.status === "not-started"
    ))).toBe(true);
  });

  it("rejects missing, extra, unsafe, or identity-mismatched component files", () => {
    const { manifest, files } = diskCorpus();

    const missing = new Map(files);
    missing.delete("S0001/level-1.json");
    expect(() => validateBookGraphCorpus(rawRegistry, manifest, missing)).toThrow(/one-to-one/i);

    const extra = new Map(files);
    extra.set("S9999/extra.json", structuredClone(files.get("S0001/level-1.json")));
    expect(() => validateBookGraphCorpus(rawRegistry, manifest, extra)).toThrow(/one-to-one/i);

    const unsafeManifest = structuredClone(manifest);
    if (!unsafeManifest.entries[0]) throw new Error("missing manifest fixture");
    unsafeManifest.entries[0].path = "../escape.json";
    expect(() => validateBookGraphCorpus(rawRegistry, unsafeManifest, files)).toThrow();

    const mismatched = new Map(files);
    const wrongIdentity = structuredClone(files.get("S0001/level-1.json")) as BookGraphFile;
    wrongIdentity.identity.componentLabel = "Wrong component";
    mismatched.set("S0001/level-1.json", wrongIdentity);
    expect(() => validateBookGraphCorpus(rawRegistry, manifest, mismatched)).toThrow(/immutable identity/i);

    const staleMetrics = structuredClone(manifest);
    if (!staleMetrics.entries[0]) throw new Error("missing manifest metric fixture");
    staleMetrics.entries[0].theoremNodeCount = 1;
    staleMetrics.summary.theoremNodeCount = 1;
    expect(() => validateBookGraphCorpus(rawRegistry, staleMetrics, files)).toThrow(/manifest metrics are stale/i);
  });
});

describe("book dependency graph integrity", () => {
  it("accepts a fully evidenced and independently reviewed graph", () => {
    expect(validateBookGraphFile(reviewedGraphFixture()).graphState.status).toBe("reviewed-complete");
  });

  it("requires every reviewed theorem to have a reviewed route or root attestation", () => {
    const missingRoute = reviewedGraphFixture();
    missingRoute.graph.proofRoutes = [];
    if (!missingRoute.graphState.graphAudit) throw new Error("missing graph audit fixture");
    missingRoute.graphState.graphAudit.proofRouteCount = 0;
    expect(() => validateBookGraphFile(missingRoute)).toThrow(/route or root attestation/i);

    const root = reviewedGraphFixture();
    root.graph.directDependencies = [];
    root.graph.proofRoutes[0] = {
      id: "route-1",
      theoremNodeId: "theorem-1",
      routeKind: "root-attestation",
      dependencyIds: [],
      summary: "The source explicitly treats this theorem as a root fact.",
      evidence: structuredClone(reviewedEvidence),
    };
    if (!root.graphState.graphAudit) throw new Error("missing graph audit fixture");
    root.graphState.graphAudit.directDependencyCount = 0;
    expect(validateBookGraphFile(root).graph.proofRoutes[0]?.routeKind).toBe("root-attestation");
  });

  it("does not permit an extracted graph before source extraction", () => {
    const prematureGraph = reviewedGraphFixture();
    prematureGraph.extractionState = {
      status: "queued",
      extractionAudit: null,
      independentReview: null,
      note: "Source extraction is queued.",
    };
    prematureGraph.graphState.status = "extracted";
    prematureGraph.graphState.independentReview = null;
    expect(() => validateBookGraphFile(prematureGraph)).toThrow(/before source extraction/i);
  });

  it("requires a reviewed inventory decision for every immutable source unit", () => {
    const missingUnitDecision = reviewedGraphFixture();
    missingUnitDecision.sourceUnits.push({
      id: "unit-2",
      ordinal: 2,
      label: "Page 2",
      locator: "page 2",
      contentSha256: "4".repeat(64),
    });
    if (!missingUnitDecision.extractionState.extractionAudit) throw new Error("missing extraction audit fixture");
    missingUnitDecision.extractionState.extractionAudit.sourceUnitCount = 2;
    expect(() => validateBookGraphFile(missingUnitDecision)).toThrow(/cover every source unit/i);

    const inconsistentTheoremFreeDecision = reviewedGraphFixture();
    const inventory = inconsistentTheoremFreeDecision.unitInventories[0];
    if (!inventory) throw new Error("missing source-unit inventory fixture");
    inventory.theoremFreeAttestation = true;
    expect(() => validateBookGraphFile(inconsistentTheoremFreeDecision)).toThrow(/theorem-free attestation/i);

    const unreviewedUnitDecision = reviewedGraphFixture();
    const unreviewedInventory = unreviewedUnitDecision.unitInventories[0];
    if (!unreviewedInventory) throw new Error("missing source-unit inventory fixture");
    unreviewedUnitDecision.unitInventories[0] = {
      ...structuredClone(unreviewedInventory),
      evidence: {
        status: "captured",
        sourceUnitIds: ["unit-1"],
        locator: "page 1",
        captureAudit: structuredClone(extractor),
        independentReview: null,
        note: "Captured but not reviewed.",
      },
    };
    expect(() => validateBookGraphFile(unreviewedUnitDecision)).toThrow(/inventory lacks independent review/i);
  });

  it("requires evidence review to be independent and bound to the captured artifact", () => {
    const sameActor = reviewedGraphFixture();
    const route = sameActor.graph.proofRoutes[0];
    if (!route || route.evidence.status !== "reviewed") throw new Error("missing reviewed route fixture");
    route.evidence.independentReview.actorId = route.evidence.captureAudit.actorId;
    expect(() => validateBookGraphFile(sameActor)).toThrow(/independent review/i);

    const stale = reviewedGraphFixture();
    const staleRoute = stale.graph.proofRoutes[0];
    if (!staleRoute || staleRoute.evidence.status !== "reviewed") throw new Error("missing reviewed route fixture");
    staleRoute.evidence.independentReview.evidenceSha256 = "f".repeat(64);
    expect(() => validateBookGraphFile(stale)).toThrow(/review is stale/i);
  });

  it("enforces unique IDs, referential integrity, and no self or duplicate dependencies", () => {
    const duplicateId = reviewedGraphFixture();
    const route = duplicateId.graph.proofRoutes[0];
    if (!route) throw new Error("missing route fixture");
    route.id = "dependency-1";
    expect(() => validateBookGraphFile(duplicateId)).toThrow(/entity ID/i);

    const missingReference = reviewedGraphFixture();
    const dependency = missingReference.graph.directDependencies[0];
    if (!dependency) throw new Error("missing dependency fixture");
    dependency.prerequisite.id = "missing-node";
    expect(() => validateBookGraphFile(missingReference)).toThrow(/missing prerequisite/i);

    const self = reviewedGraphFixture();
    const selfDependency = self.graph.directDependencies[0];
    if (!selfDependency) throw new Error("missing dependency fixture");
    selfDependency.prerequisite.id = "theorem-1";
    expect(() => validateBookGraphFile(self)).toThrow(/self-dependency/i);

    const duplicate = reviewedGraphFixture();
    const firstDependency = duplicate.graph.directDependencies[0];
    const firstRoute = duplicate.graph.proofRoutes[0];
    if (!firstDependency || !firstRoute || !duplicate.graphState.graphAudit) throw new Error("missing graph fixture");
    duplicate.graph.directDependencies.push({ ...structuredClone(firstDependency), id: "dependency-2" });
    firstRoute.dependencyIds.push("dependency-2");
    duplicate.graphState.graphAudit.directDependencyCount = 2;
    expect(() => validateBookGraphFile(duplicate)).toThrow(/duplicates a direct dependency/i);
  });

  it("retains proof and statement xrefs explicitly until they resolve", () => {
    const unresolved = reviewedGraphFixture();
    unresolved.graph.references.push({
      id: "reference-1",
      ownerNodeId: "theorem-1",
      basis: "proof-xref",
      ref: "missing-result",
      context: "The source proof invokes an unresolved result label.",
      locator: "page 1, proof of Theorem 1",
      resolution: {
        status: "unresolved",
        note: "No matching xml:id or source label was found.",
      },
      evidence: structuredClone(reviewedEvidence),
    });
    unresolved.graphState.status = "building";
    unresolved.graphState.graphAudit = null;
    unresolved.graphState.independentReview = null;
    expect(validateBookGraphFile(unresolved).graph.references[0]?.resolution.status).toBe("unresolved");

    const falselyComplete = structuredClone(unresolved);
    falselyComplete.graphState = {
      status: "reviewed-complete",
      graphAudit: {
        actorId: "worker:graph",
        completedAt: "2026-08-22T14:00:00Z",
        artifactSha256: "e".repeat(64),
        nodeCount: 2,
        externalInputCount: 0,
        directDependencyCount: 1,
        proofRouteCount: 1,
        referenceCount: 1,
      },
      independentReview: {
        actorId: "reviewer:graph",
        reviewedAt: "2026-08-22T15:00:00Z",
        evidenceSha256: "e".repeat(64),
        note: "The graph was independently reviewed.",
      },
      note: "Invalid complete fixture with an unresolved xref.",
    };
    expect(() => validateBookGraphFile(falselyComplete)).toThrow(/remains unresolved/i);

    const resolved = reviewedGraphFixture();
    resolved.graph.references.push({
      id: "reference-1",
      ownerNodeId: "theorem-1",
      basis: "proof-xref",
      ref: "definition-1",
      context: "The source proof invokes Definition 1.",
      locator: "page 1, proof of Theorem 1",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "definition-1" },
        directDependencyId: "dependency-1",
        note: "Resolved by exact source xml:id.",
      },
      evidence: structuredClone(reviewedEvidence),
    });
    if (!resolved.graphState.graphAudit) throw new Error("missing graph audit fixture");
    resolved.graphState.graphAudit.referenceCount = 1;
    expect(validateBookGraphFile(resolved).graph.references[0]?.resolution.status).toBe("resolved");
  });
});
