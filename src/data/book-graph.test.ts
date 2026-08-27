/// <reference types="node" />

import { describe, expect, it } from "vitest";
import path from "node:path";
import rawManifest from "../../data/books/manifest.json";
import rawRegistry from "../../data/knowledge/source-records.json";
// @ts-expect-error The Node-only storage codec is intentionally maintained as an ESM JavaScript module.
import { readBookGraphFileSync } from "../../scripts/book-graph-codec.mjs";
import {
  validateBookGraphFile,
  validateBookGraphIndex,
  validateBookGraphManifestEntry,
  type BookGraphFile,
} from "./book-graph-schema";

function readDiskBookGraph(relativePath: string) {
  const filePath = path.join(process.cwd(), "data", "books", ...relativePath.split("/"));
  return readBookGraphFileSync(filePath);
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
  const placeholder = structuredClone(readDiskBookGraph("S0001/level-1.json")) as BookGraphFile;
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

describe("one Phase-I dependency graph identity per source component", () => {
  it("covers all 688 source rows and all 717 actual book or volume components exactly once", () => {
    const validated = validateBookGraphIndex(rawRegistry, rawManifest);
    const populatedPaths = new Set(["S0060/complete-source.json", "S0262/complete-source.json"]);
    const populatedFiles = new Map<string, BookGraphFile>();
    let validatedComponentCount = 0;
    let awaitingComponentCount = 0;
    for (const entry of validated.manifest.entries) {
      const file = validateBookGraphManifestEntry(
        validated.registry,
        entry,
        readDiskBookGraph(entry.path),
      );
      validatedComponentCount += 1;
      if (populatedPaths.has(entry.path)) {
        populatedFiles.set(entry.path, file);
      } else if (file.exactEdition === null
        && file.extractionState.status === "awaiting-edition"
        && file.graphState.status === "not-started") {
        awaitingComponentCount += 1;
      }
    }

    expect(validated.registry.records).toHaveLength(688);
    expect(validated.manifest.sourceRecordCount).toBe(688);
    expect(validated.manifest.componentFileCount).toBe(717);
    expect(validated.manifest.entries).toHaveLength(717);
    expect(validatedComponentCount).toBe(717);
    expect(validated.manifest.summary).toEqual({
      exactEditionResolvedCount: 2,
      awaitingEditionCount: 715,
      reviewedExtractionCount: 0,
      reviewedCompleteGraphCount: 0,
      sourceUnitCount: 225,
      inventoriedSourceUnitCount: 225,
      reviewedSourceUnitCount: 0,
      theoremNodeCount: 13176,
      unroutedTheoremCount: 1928,
      supportNodeCount: 1929,
      dependencyCount: 36292,
      reviewedDependencyCount: 0,
      unresolvedReferenceCount: 2602,
    });
    expect(validated.manifest.entries.find(({ path }) => path === "S0001/level-1.json")?.bookGraphId)
      .toBe("S0001:level-1");
    expect(validated.manifest.entries.find(({ path }) => path === "S0074/volume-3.json")?.componentLabel)
      .toBe("Volume 3");
    const pilot = populatedFiles.get("S0060/complete-source.json");
    expect(pilot?.exactEdition).not.toBeNull();
    expect(pilot?.extractionState.status).toBe("extracted");
    expect(pilot?.graphState.status).toBe("extracted");
    const rejectedBook = validated.manifest.entries.find(({ path }) => path === "S0002/complete-source.json");
    expect(rejectedBook?.exactEditionResolved).toBe(false);
    expect(rejectedBook?.theoremNodeCount).toBe(0);
    expect(rejectedBook?.extractionStatus).toBe("awaiting-edition");
    expect(rejectedBook?.graphStatus).toBe("not-started");
    const densestBook = populatedFiles.get("S0262/complete-source.json");
    expect(densestBook?.exactEdition?.sourceFormat).toBe("latex");
    expect(densestBook?.sourceUnits).toHaveLength(116);
    expect(densestBook?.graph.nodes.filter((node) => node.nodeClass === "theorem-like")).toHaveLength(13138);
    expect(densestBook?.graph.nodes.filter((node) => node.nodeClass === "support")).toHaveLength(1855);
    expect(densestBook?.graph.nodes.every((node) => /^tag-[a-z0-9]{4}$/u.test(node.id))).toBe(true);
    expect(densestBook?.graph.nodes.some((node) => (
      node.kind === "example" || node.kind === "calculation" || node.kind === "algorithm"
    ))).toBe(false);
    expect(densestBook?.graph.externalInputs).toHaveLength(11);
    expect(densestBook?.graph.externalInputs).toContainEqual(expect.objectContaining({
      id: "external-zorns-lemma",
      kind: "external-theorem",
    }));
    expect(densestBook?.graph.externalInputs).toContainEqual(expect.objectContaining({
      id: "external-deligne-weight-bound",
      kind: "external-theorem",
    }));
    expect(densestBook?.graph.directDependencies).toHaveLength(36289);
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0eq8",
      prerequisite: { type: "node", id: "tag-0eq6" },
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-06ix",
      prerequisite: { type: "node", id: "tag-06im" },
      role: "definition",
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-06ix",
      prerequisite: { type: "node", id: "tag-06t6" },
      role: "definition",
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-04r9",
      prerequisite: { type: "node", id: "tag-03c6" },
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0bks",
      prerequisite: { type: "node", id: "tag-0d60" },
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-075a",
      prerequisite: { type: "node", id: "tag-021i" },
    }));
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0dga",
      prerequisite: { type: "node", id: "tag-0df6" },
    }));
    for (const ownerNodeId of ["tag-08zp", "tag-08xs"]) {
      expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
        dependentNodeId: ownerNodeId,
        prerequisite: { type: "external-input", id: "external-zorns-lemma" },
      }));
    }
    const sectionDelegationTargets = new Map([
      ["tag-03z1", ["tag-03bx", "tag-03h5", "tag-03h4"]],
      ["tag-0cfq", ["tag-03bx", "tag-03h5", "tag-03h4"]],
      ["tag-03xd", ["tag-03bx", "tag-03h5", "tag-03h4"]],
      ["tag-04p1", ["tag-03bx", "tag-03bz"]],
      ["tag-0e07", ["tag-03bu"]],
      ["tag-06u1", ["tag-04xl", "tag-04xi", "tag-04xh"]],
      ["tag-0chx", ["tag-04xl", "tag-04xi", "tag-04xh"]],
      ["tag-0512", ["tag-04xl", "tag-04xi", "tag-04xh"]],
      ["tag-0ci1", ["tag-04xl", "tag-04xi", "tag-04xh"]],
      ["tag-0ci6", ["tag-04xl", "tag-04xi", "tag-04xh"]],
      ["tag-0e86", ["tag-04xl"]],
      ["tag-04zx", ["tag-045c"]],
      ["tag-0501", ["tag-045c"]],
      ["tag-0chr", ["tag-045c"]],
      ["tag-0chv", ["tag-045c"]],
    ]);
    const sectionReferenceByOwner = new Map([
      ...["tag-03z1", "tag-0cfq", "tag-03xd", "tag-04p1", "tag-0e07"].map((owner) => (
        [owner, "spaces-properties-section-points"] as const
      )),
      ...["tag-06u1", "tag-0chx", "tag-0512", "tag-0ci1", "tag-0ci6", "tag-0e86"].map((owner) => (
        [owner, "stacks-properties-section-points"] as const
      )),
      ...["tag-04zx", "tag-0501", "tag-0chr", "tag-0chv"].map((owner) => (
        [owner, "stacks-properties-section-properties-morphisms"] as const
      )),
    ]);
    for (const [ownerNodeId, targetNodeIds] of sectionDelegationTargets) {
      const actualTargets = densestBook?.graph.directDependencies
        .filter(({ dependentNodeId, prerequisite }) => (
          dependentNodeId === ownerNodeId && prerequisite.type === "node"
        ))
        .map(({ prerequisite }) => prerequisite.id)
        .sort();
      expect(actualTargets).toEqual(expect.arrayContaining([...targetNodeIds]));
      expect(densestBook?.graph.proofRoutes
        .find(({ theoremNodeId }) => theoremNodeId === ownerNodeId)
        ?.dependencyIds).toEqual(expect.arrayContaining(
          targetNodeIds.map((targetNodeId) => `dep-${ownerNodeId}-to-${targetNodeId}`),
        ));
      expect(densestBook?.graph.references.some(({ ownerNodeId: referenceOwner, ref }) => (
        referenceOwner === ownerNodeId && ref === sectionReferenceByOwner.get(ownerNodeId)
      ))).toBe(false);
    }
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0e07",
      prerequisite: { type: "node", id: "tag-03bu" },
      role: "definition",
      rationale: expect.stringContaining("not self-contained"),
    }));
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-04p1")
      ?.evidence.note).toContain("omits the final descent verification");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-0e86")
      ?.evidence.note).toContain("open substack");
    expect(densestBook?.graph.proofRoutes).toHaveLength(11282);
    expect(densestBook?.graph.proofRoutes.filter((route) => route.routeKind === "alternate-proof"))
      .toHaveLength(40);
    expect(densestBook?.graph.references.every((reference) => (
      ["proof-xref", "proof-citation"].includes(reference.basis)
    ))).toBe(true);
    expect(densestBook?.graph.references.filter((reference) => reference.basis === "proof-xref"))
      .toHaveLength(2596);
    expect(new Map([
      "spaces-properties-section-points",
      "stacks-properties-section-points",
      "stacks-properties-section-properties-morphisms",
    ].map((ref) => [
      ref,
      densestBook?.graph.references.filter((reference) => (
        reference.basis === "proof-xref" && reference.ref === ref
      )).length,
    ]))).toEqual(new Map([
      ["spaces-properties-section-points", 0],
      ["stacks-properties-section-points", 0],
      ["stacks-properties-section-properties-morphisms", 24],
    ]));
    expect(densestBook?.graph.references.filter((reference) => reference.basis === "proof-citation"))
      .toHaveLength(19);
    expect(densestBook?.graph.references.filter((reference) => (
      reference.basis === "proof-citation" && reference.resolution.status === "resolved"
    ))).toHaveLength(13);
    expect(densestBook?.graph.references.filter((reference) => (
      reference.basis === "proof-citation" && reference.resolution.status === "unresolved"
    ))).toHaveLength(6);
    expect(densestBook?.graph.references.filter((reference) => (
      reference.basis === "proof-citation" && reference.ownerNodeId === "tag-000g"
    )).map((reference) => reference.resolution)).toEqual([
      expect.objectContaining({
        status: "resolved",
        target: { type: "external-input", id: "external-finite-formula-reflection" },
        directDependencyId: "dep-tag-000g-to-external-finite-formula-reflection",
      }),
      expect.objectContaining({
        status: "resolved",
        target: { type: "external-input", id: "external-finite-formula-reflection" },
        directDependencyId: "dep-tag-000g-to-external-finite-formula-reflection",
      }),
    ]);
    expect(densestBook?.extractionState.status).toBe("extracted");
    expect(densestBook?.graphState.status).toBe("extracted");
    expect(populatedFiles).toHaveLength(2);
    expect(awaitingComponentCount).toBe(715);
  });

  it("rejects missing, extra, unsafe, identity-mismatched, or stale manifest components", () => {
    const { registry, manifest } = validateBookGraphIndex(rawRegistry, rawManifest);
    const placeholderEntry = manifest.entries.find(({ path }) => path === "S0001/level-1.json");
    if (!placeholderEntry) throw new Error("missing placeholder manifest fixture");
    const placeholder = readDiskBookGraph(placeholderEntry.path);

    const missing = structuredClone(manifest);
    missing.entries.pop();
    expect(() => validateBookGraphIndex(rawRegistry, missing)).toThrow(/cover every required component/i);

    const extra = structuredClone(manifest);
    extra.componentFileCount += 1;
    extra.entries.push({
      ...structuredClone(placeholderEntry),
      bookGraphId: "S9999:extra",
      sourceRecordId: "S9999",
      sourceOrdinal: 9999,
      componentId: "extra",
      componentLabel: "Extra component",
      path: "S9999/extra.json",
    });
    expect(() => validateBookGraphIndex(rawRegistry, extra)).toThrow(/cover every required component/i);

    const unsafeManifest = structuredClone(manifest);
    if (!unsafeManifest.entries[0]) throw new Error("missing manifest fixture");
    unsafeManifest.entries[0].path = "../escape.json";
    expect(() => validateBookGraphIndex(rawRegistry, unsafeManifest)).toThrow();

    const wrongIdentity = structuredClone(placeholder) as BookGraphFile;
    wrongIdentity.identity.componentLabel = "Wrong component";
    expect(() => validateBookGraphManifestEntry(registry, placeholderEntry, wrongIdentity))
      .toThrow(/immutable identity/i);

    const staleMetrics = structuredClone(placeholderEntry);
    staleMetrics.theoremNodeCount = 1;
    expect(() => validateBookGraphManifestEntry(registry, staleMetrics, placeholder))
      .toThrow(/manifest metrics are stale/i);
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

  it("keeps bibliographic proof citations structurally distinct from source xrefs", () => {
    const citation = reviewedGraphFixture();
    citation.graph.references.push({
      id: "reference-citation",
      ownerNodeId: "theorem-1",
      basis: "proof-citation",
      ref: "FixtureBibKey",
      pinpoint: null,
      context: "The source proof cites the fixture bibliography.",
      locator: "page 1, proof of Theorem 1",
      resolution: {
        status: "unresolved",
        note: "The exact imported mathematical result has not been reviewed.",
      },
      evidence: structuredClone(reviewedEvidence),
    });
    citation.graphState.status = "building";
    citation.graphState.graphAudit = null;
    citation.graphState.independentReview = null;
    expect(validateBookGraphFile(citation).graph.references[0]).toMatchObject({
      basis: "proof-citation",
      pinpoint: null,
    });

    const missingPinpoint = structuredClone(citation);
    delete (missingPinpoint.graph.references[0] as { pinpoint?: string | null }).pinpoint;
    expect(() => validateBookGraphFile(missingPinpoint)).toThrow();

    const nodeTarget = reviewedGraphFixture();
    nodeTarget.graph.references.push({
      id: "reference-citation",
      ownerNodeId: "theorem-1",
      basis: "proof-citation",
      ref: "FixtureBibKey",
      pinpoint: "Theorem 2",
      context: "The source proof cites an exact external theorem.",
      locator: "page 1, proof of Theorem 1",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "definition-1" },
        directDependencyId: "dependency-1",
        note: "Invalidly resolved to a local node.",
      },
      evidence: structuredClone(reviewedEvidence),
    });
    if (!nodeTarget.graphState.graphAudit) throw new Error("missing graph audit fixture");
    nodeTarget.graphState.graphAudit.referenceCount = 1;
    expect(() => validateBookGraphFile(nodeTarget)).toThrow(/typed external input/i);
  });
});
