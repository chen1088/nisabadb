/// <reference types="node" />

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import rawManifest from "../../data/books/manifest.json";
import rawRegistry from "../../data/knowledge/source-records.json";
// @ts-expect-error The Node-only storage codec is intentionally maintained as an ESM JavaScript module.
import { readBookGraphFileSync } from "../../scripts/book-graph-codec.mjs";
import {
  validateBookGraphCorpus,
  validateBookGraphFile,
  validateBookGraphIndex,
  validateBookGraphManifestEntry,
  type BookGraphFile,
  type BookGraphManifest,
} from "./book-graph-schema";

function readDiskBookGraph(relativePath: string) {
  const filePath = path.join(process.cwd(), "data", "books", ...relativePath.split("/"));
  return readBookGraphFileSync(filePath);
}

const localCandidatePaths = [
  "S0060/complete-source.json",
  "S0091/complete-source.json",
  "S0164/complete-source.json",
  "S0262/complete-source.json",
  "S0321/complete-source.json",
];

function readLocalCandidateGraphs() {
  return new Map<string, BookGraphFile>(localCandidatePaths.flatMap((relativePath) => {
    const filePath = path.join(process.cwd(), "data", "books", ...relativePath.split("/"));
    return fs.existsSync(filePath)
      ? [[relativePath, readBookGraphFileSync(filePath) as BookGraphFile] as const]
      : [];
  }));
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
  const record = rawRegistry.records[0];
  const component = record?.requiredEditionComponents[0];
  if (!record || !component) throw new Error("missing source-registry fixture identity");

  return {
    schemaVersion: "1.0.0",
    phase: "source-dependency-graph",
    identity: {
      bookGraphId: `${record.id}:${component.id}`,
      sourceSetRevision: rawRegistry.sourceSetRevision,
      sourceRecordId: record.id,
      sourceOrdinal: record.ordinal,
      familyId: record.familyId,
      sourceTitle: record.title,
      sourceAuthorLine: record.authorLine,
      sourceRawCitation: record.rawCitation,
      componentId: component.id,
      componentLabel: component.label,
    },
    exactEdition: {
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
    },
    sourceUnits: [{
      id: "unit-1",
      ordinal: 1,
      label: "Page 1",
      locator: "page 1",
      contentSha256: "1".repeat(64),
    }],
    unitInventories: [{
      sourceUnitId: "unit-1",
      theoremNodeIds: ["theorem-1"],
      supportNodeIds: ["definition-1"],
      sourceArtifactNodeIds: [],
      theoremFreeAttestation: false,
      evidence: structuredClone(reviewedEvidence),
    }],
    graph: {
      nodes: [
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
      ],
      externalInputs: [],
      directDependencies: [{
        id: "dependency-1",
        dependentNodeId: "theorem-1",
        prerequisite: { type: "node", id: "definition-1" },
        role: "definition",
        rationale: "The theorem uses the fixture definition.",
        evidence: structuredClone(reviewedEvidence),
      }],
      proofRoutes: [{
        id: "route-1",
        theoremNodeId: "theorem-1",
        routeKind: "source-proof",
        dependencyIds: ["dependency-1"],
        summary: "Apply the fixture definition directly.",
        evidence: structuredClone(reviewedEvidence),
      }],
      references: [],
    },
    extractionState: {
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
    },
    graphState: {
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
    },
  };
}

function manifestWithReviewedFixture() {
  const manifest = structuredClone(rawManifest) as BookGraphManifest;
  const entry = manifest.entries[0];
  const file = reviewedGraphFixture();
  if (!entry) throw new Error("missing manifest entry for present-artifact fixture");
  Object.assign(entry, {
    artifactPath: `${entry.sourceRecordId}/${entry.componentId}.json`,
    extractionStatus: "reviewed",
    graphStatus: "reviewed-complete",
    exactEditionResolved: true,
    sourceUnitCount: 1,
    inventoriedSourceUnitCount: 1,
    reviewedSourceUnitCount: 1,
    theoremNodeCount: 1,
    unroutedTheoremCount: 0,
    dependencyPendingTheoremCount: 0,
    supportNodeCount: 1,
    sourceArtifactNodeCount: 0,
    dependencyCount: 1,
    reviewedDependencyCount: 1,
    unresolvedReferenceCount: 0,
  });
  manifest.artifactCount = 1;
  manifest.summary = {
    exactEditionResolvedCount: 1,
    awaitingEditionCount: 716,
    reviewedExtractionCount: 1,
    reviewedCompleteGraphCount: 1,
    sourceUnitCount: 1,
    inventoriedSourceUnitCount: 1,
    reviewedSourceUnitCount: 1,
    theoremNodeCount: 1,
    unroutedTheoremCount: 0,
    dependencyPendingTheoremCount: 0,
    supportNodeCount: 1,
    sourceArtifactNodeCount: 0,
    dependencyCount: 1,
    reviewedDependencyCount: 1,
    unresolvedReferenceCount: 0,
  };
  return { manifest, entry, file };
}

describe("one Phase-I dependency graph identity per source component", () => {
  it("covers all 688 source rows and all 717 actual book or volume components exactly once", () => {
    const validated = validateBookGraphIndex(rawRegistry, rawManifest);
    const rawArtifacts = new Map<string, unknown>();
    for (const entry of validated.manifest.entries) {
      if (entry.artifactPath !== null) {
        rawArtifacts.set(entry.artifactPath, readDiskBookGraph(entry.artifactPath));
      }
    }
    const corpus = validateBookGraphCorpus(rawRegistry, rawManifest, rawArtifacts);
    const populatedFiles = corpus.filesByPath;
    const localCandidateFiles = readLocalCandidateGraphs();
    const awaitingComponentCount = validated.manifest.entries
      .filter(({ artifactPath }) => artifactPath === null).length;

    expect(validated.registry.records).toHaveLength(688);
    expect(validated.manifest.schemaVersion).toBe("1.2.0");
    expect(validated.manifest.sourceRecordCount).toBe(688);
    expect(validated.manifest.componentCount).toBe(717);
    expect(validated.manifest.artifactCount).toBe(0);
    expect(validated.manifest.entries).toHaveLength(717);
    expect(new Set(validated.manifest.entries.map(({ bookGraphId }) => bookGraphId)).size).toBe(717);
    expect(validated.manifest.summary).toEqual({
      exactEditionResolvedCount: 0,
      awaitingEditionCount: 717,
      reviewedExtractionCount: 0,
      reviewedCompleteGraphCount: 0,
      sourceUnitCount: 0,
      inventoriedSourceUnitCount: 0,
      reviewedSourceUnitCount: 0,
      theoremNodeCount: 0,
      unroutedTheoremCount: 0,
      dependencyPendingTheoremCount: 0,
      supportNodeCount: 0,
      sourceArtifactNodeCount: 0,
      dependencyCount: 0,
      reviewedDependencyCount: 0,
      unresolvedReferenceCount: 0,
    });
    expect(validated.manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0001:level-1")?.artifactPath)
      .toBeNull();
    expect(validated.manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0074:volume-3")?.componentLabel)
      .toBe("Volume 3");
    expect(populatedFiles).toHaveLength(0);
    expect(awaitingComponentCount).toBe(717);
    const pilot = localCandidateFiles.get("S0060/complete-source.json");
    if (pilot) {
      expect(pilot.exactEdition).not.toBeNull();
      expect(pilot.extractionState.status).toBe("extracted");
      expect(pilot.graphState.status).toBe("extracted");
      expect(pilot.graph.nodes.filter((node) => node.nodeClass === "support")).toHaveLength(72);
    }
    const rejectedBook = validated.manifest.entries.find(({ bookGraphId }) => bookGraphId === "S0002:complete-source");
    expect(rejectedBook?.artifactPath).toBeNull();
    expect(rejectedBook?.exactEditionResolved).toBe(false);
    expect(rejectedBook?.theoremNodeCount).toBe(0);
    expect(rejectedBook?.extractionStatus).toBe("awaiting-edition");
    expect(rejectedBook?.graphStatus).toBe("not-started");
    const densestBook = localCandidateFiles.get("S0262/complete-source.json");
    if (densestBook) {
    expect(densestBook?.exactEdition?.sourceFormat).toBe("latex");
    expect(densestBook?.sourceUnits).toHaveLength(116);
    expect(densestBook?.graph.nodes).toHaveLength(16288);
    expect(densestBook?.graph.nodes.filter((node) => node.nodeClass === "theorem-like")).toHaveLength(13157);
    expect(densestBook?.graph.nodes.filter((node) => node.nodeClass === "support")).toHaveLength(1894);
    expect(densestBook?.graph.nodes.filter((node) => node.nodeClass === "source-artifact")).toHaveLength(1237);
    expect(densestBook?.graph.nodes.filter((node) => node.kind === "claim")).toHaveLength(26);
    const mathematicalKindCounts = densestBook?.graph.nodes
      .filter(({ nodeClass }) => nodeClass !== "source-artifact")
      .reduce<Record<string, number>>((counts, { kind }) => ({
        ...counts,
        [kind]: (counts[kind] ?? 0) + 1,
      }), {});
    const sourceArtifactKindCounts = densestBook?.graph.nodes
      .filter(({ nodeClass }) => nodeClass === "source-artifact")
      .reduce<Record<string, number>>((counts, { kind }) => ({
        ...counts,
        [kind]: (counts[kind] ?? 0) + 1,
      }), {});
    expect(mathematicalKindCounts).toEqual({
      lemma: 12587,
      proposition: 330,
      theorem: 214,
      definition: 1739,
      claim: 26,
      assumption: 134,
      construction: 21,
    });
    expect(sourceArtifactKindCounts).toEqual({
      section: 572,
      equation: 171,
      remark: 370,
      example: 119,
      remarks: 3,
      item: 2,
    });
    expect(densestBook?.graph.nodes).toContainEqual(expect.objectContaining({
      id: "tag-0f0k",
      nodeClass: "theorem-like",
      kind: "claim",
      sourceXmlId: "algebra-item-cauchy-binet",
    }));
    expect(densestBook?.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "tag-0gqt",
        nodeClass: "theorem-like",
        kind: "claim",
        sourceXmlId: "stacks-cohomology-item-hom-restriction",
      }),
      expect.objectContaining({
        id: "tag-06w6",
        nodeClass: "theorem-like",
        kind: "claim",
        sourceXmlId: "stacks-sheaves-equation-pushforward",
      }),
      expect.objectContaining({
        id: "tag-0880",
        nodeClass: "support",
        kind: "construction",
      }),
      expect.objectContaining({
        id: "tag-0f9z",
        nodeClass: "support",
        kind: "construction",
        sourceXmlId: "chow-remark-restriction-bivariant",
        evidence: expect.objectContaining({
          note: expect.stringContaining("Tag 0B76"),
        }),
      }),
    ]));
    expect(densestBook?.extractionState.note).toContain("1237 exact proof-referenced raw source artifact");
    expect(densestBook?.extractionState.note).toContain("1033 remark");
    expect(densestBook?.graph.nodes.some(({ id }) => (
      ["tag-0a53", "tag-0a57", "tag-0a58", "tag-0a59", "tag-0a5a"].includes(id)
    ))).toBe(false);
    expect(densestBook?.graph.nodes.every((node) => /^tag-[a-z0-9]{4}$/u.test(node.id))).toBe(true);
    expect(densestBook?.graph.nodes.some((node) => (
      node.nodeClass !== "source-artifact"
      && (node.kind === "example" || node.kind === "calculation" || node.kind === "algorithm")
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
    expect(densestBook?.graph.directDependencies).toHaveLength(38904);
    expect(densestBook?.graph.directDependencies.filter(({ prerequisite }) => (
      prerequisite.type === "node"
      && densestBook.graph.nodes.find(({ id }) => id === prerequisite.id)?.nodeClass === "source-artifact"
    ))).toHaveLength(2435);
    expect(densestBook?.graph.directDependencies).toContainEqual(expect.objectContaining({
      id: "dep-tag-07dq-to-tag-0f0k",
      dependentNodeId: "tag-07dq",
      prerequisite: { type: "node", id: "tag-0f0k" },
      role: "logical",
    }));
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
    expect(densestBook?.graph.directDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependentNodeId: "tag-0grd",
        prerequisite: { type: "node", id: "tag-0gqt" },
      }),
      expect.objectContaining({
        dependentNodeId: "tag-06w6",
        prerequisite: { type: "node", id: "tag-004b" },
      }),
      expect.objectContaining({
        dependentNodeId: "tag-075b",
        prerequisite: { type: "node", id: "tag-06w6" },
      }),
      expect.objectContaining({
        dependentNodeId: "tag-0883",
        prerequisite: { type: "node", id: "tag-0880" },
        role: "construction",
      }),
      expect.objectContaining({
        dependentNodeId: "tag-0guc",
        prerequisite: { type: "node", id: "tag-0f9z" },
        role: "construction",
      }),
    ]));
    expect(densestBook?.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.type === "node" && prerequisite.id === "tag-0f9z")
      .map(({ dependentNodeId }) => dependentNodeId)
      .sort()).toEqual([
        "tag-0fau",
        "tag-0fbk",
        "tag-0fbt",
        "tag-0fc1",
        "tag-0fca",
        "tag-0feb",
        "tag-0ff2",
        "tag-0guc",
        "tag-0gud",
      ]);
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
      ["tag-0bb4", ["tag-0262"]],
      ["tag-06qz", ["tag-0262"]],
      ["tag-07sk", ["tag-0262"]],
      ["tag-0duj", ["tag-0262"]],
      ["tag-09cn", ["tag-07jw"]],
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
      ...["tag-0bb4", "tag-06qz", "tag-07sk", "tag-0duj"].map((owner) => (
        [owner, "spaces-section-presentations"] as const
      )),
      ["tag-09cn", "algebra-section-snake"],
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
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-0bb4")
      ?.evidence.note).toContain("omits the precise formulation and proof of the functoriality");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-07sk")
      ?.evidence.note).toContain("omits details that R' is of finite presentation over R");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-09cn")
      ?.evidence.note).toContain("excluded example for the free-module case");
    expect(densestBook?.graph.proofRoutes).toHaveLength(13201);
    expect(densestBook?.graph.proofRoutes.filter(({ theoremNodeId }) => (
      theoremNodeId === "tag-0f0k"
    ))).toEqual([
      expect.objectContaining({
        routeKind: "source-proof",
        dependencyIds: [],
        evidence: expect.objectContaining({
          note: expect.stringContaining("not a root attestation"),
        }),
      }),
    ]);
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-07dq")
      ?.dependencyIds).toContain("dep-tag-07dq-to-tag-0f0k");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-06w6")
      ?.dependencyIds).toContain("dep-tag-06w6-to-tag-004b");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-075b")
      ?.evidence.note).toContain("commutes with restriction maps");
    for (const theoremNodeId of ["tag-073n", "tag-075g", "tag-07at"]) {
      expect(densestBook?.graph.proofRoutes
        .find((route) => route.theoremNodeId === theoremNodeId)
        ?.evidence.note).not.toContain("commutes with restriction maps");
    }
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-0gqt")
      ?.evidence.note).toContain("c = d composed with Q");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-06cw")
      ?.evidence.note).toContain("final commutativity verification");
    expect(densestBook?.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === "tag-0evf")
      ?.evidence.note).toContain("affine-cover argument");
    expect(densestBook?.graph.proofRoutes.some(({ theoremNodeId }) => (
      theoremNodeId === "tag-0f9z"
    ))).toBe(false);
    const routedTheoremNodeIds = new Set(densestBook?.graph.proofRoutes.map(({ theoremNodeId }) => (
      theoremNodeId
    )));
    expect(densestBook?.graph.nodes.filter(({ id, nodeClass }) => (
      nodeClass === "theorem-like" && !routedTheoremNodeIds.has(id)
    ))).toHaveLength(0);
    const dependencyById = new Map(densestBook?.graph.directDependencies.map((dependency) => (
      [dependency.id, dependency] as const
    )));
    const nodeById = new Map(densestBook?.graph.nodes.map((node) => [node.id, node] as const));
    const dependencyRoutedTheoremNodeIds = new Set(densestBook?.graph.proofRoutes
      .filter((route) => route.routeKind === "root-attestation" || route.dependencyIds.some((id) => {
        const dependency = dependencyById.get(id);
        if (!dependency) return false;
        return dependency.prerequisite.type === "external-input"
          || nodeById.get(dependency.prerequisite.id)?.nodeClass !== "source-artifact";
      }))
      .map(({ theoremNodeId }) => theoremNodeId));
    expect(densestBook?.graph.nodes.filter(({ id, nodeClass }) => (
      nodeClass === "theorem-like" && !dependencyRoutedTheoremNodeIds.has(id)
    ))).toHaveLength(1883);
    expect(densestBook?.graph.proofRoutes.filter((route) => route.routeKind === "alternate-proof"))
      .toHaveLength(44);
    expect(densestBook?.graph.references.every((reference) => (
      ["proof-xref", "proof-citation"].includes(reference.basis)
    ))).toBe(true);
    expect(densestBook?.graph.references.filter((reference) => reference.basis === "proof-xref"))
      .toHaveLength(2435);
    expect(densestBook?.graph.references.filter((reference) => (
      reference.basis === "proof-xref" && reference.resolution.status === "unresolved"
    ))).toHaveLength(0);
    expect(densestBook?.graph.references.some(({ ownerNodeId, ref }) => (
      ownerNodeId === "tag-07dq" && ref === "algebra-item-cauchy-binet"
    ))).toBe(false);
    const etaleGoalNondependencies = [
      ["tag-0a5b", "etale-cohomology-item-base-change-prime-to-p"],
      ["tag-0a5b", "etale-cohomology-item-surjective"],
      ["tag-0a5b", "etale-cohomology-item-finite-proper"],
      ["tag-0a5b", "etale-cohomology-item-base-change-proper"],
      ["tag-0a5d", "etale-cohomology-item-surjective"],
      ["tag-0gja", "etale-cohomology-item-vanishing"],
      ["tag-0gja", "etale-cohomology-item-surjective"],
      ["tag-03sc", "etale-cohomology-item-vanishing"],
      ["tag-03sc", "etale-cohomology-item-surjective"],
    ];
    for (const [ownerNodeId, ref] of etaleGoalNondependencies) {
      expect(densestBook?.graph.references.some((reference) => (
        reference.ownerNodeId === ownerNodeId && reference.ref === ref
      ))).toBe(false);
    }
    expect(new Map([
      "spaces-properties-section-points",
      "stacks-properties-section-points",
      "stacks-properties-section-properties-morphisms",
      "spaces-section-presentations",
      "algebra-section-snake",
    ].map((ref) => [
      ref,
      densestBook?.graph.references.filter((reference) => (
        reference.basis === "proof-xref" && reference.ref === ref
      )).length,
    ]))).toEqual(new Map([
      ["spaces-properties-section-points", 0],
      ["stacks-properties-section-points", 0],
      ["stacks-properties-section-properties-morphisms", 24],
      ["spaces-section-presentations", 0],
      ["algebra-section-snake", 0],
    ]));
    expect(densestBook?.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "tag-09cn",
      basis: "proof-xref",
      ref: "algebra-example-derivations-and-differential-operators",
      locator: "algebra.tex:L34869",
      resolution: expect.objectContaining({
        status: "resolved",
        target: { type: "node", id: "tag-09cm" },
        directDependencyId: "dep-tag-09cn-to-tag-09cm",
      }),
    }));
    expect(densestBook?.graph.nodes).toContainEqual(expect.objectContaining({
      id: "tag-09cm",
      nodeClass: "source-artifact",
      kind: "example",
    }));
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
    }
    const openLogicBook = localCandidateFiles.get("S0321/complete-source.json");
    if (openLogicBook) {
    expect(openLogicBook.exactEdition).toMatchObject({
      label: "The Open Logic Text — Complete Build",
      sourceRepository: "https://github.com/OpenLogicProject/OpenLogic",
      sourceRevision: "1e960beff9ed7835bf3e3f1335e21af3439cd107",
      sourceFormat: "latex",
      licenseSpdx: "CC-BY-4.0",
      artifactSha256: "9215bbb42456d4e6b24d7f630dbf0e8442728b969da63129f30e419bec336353",
    });
    expect(openLogicBook.sourceUnits).toHaveLength(694);
    expect(openLogicBook.unitInventories).toHaveLength(694);
    expect(openLogicBook.unitInventories.filter(({ theoremFreeAttestation }) => theoremFreeAttestation))
      .toHaveLength(378);
    expect(openLogicBook.graph.nodes).toHaveLength(1463);
    expect(openLogicBook.graph.nodes.filter(({ nodeClass }) => nodeClass === "theorem-like"))
      .toHaveLength(786);
    expect(openLogicBook.graph.nodes.filter(({ nodeClass }) => nodeClass === "support"))
      .toHaveLength(522);
    expect(openLogicBook.graph.nodes.filter(({ nodeClass }) => nodeClass === "source-artifact"))
      .toHaveLength(155);
    expect(openLogicBook.graph.nodes.filter(({ kind }) => kind === "theorem")).toHaveLength(182);
    expect(openLogicBook.graph.nodes.filter(({ kind }) => kind === "proposition")).toHaveLength(410);
    expect(openLogicBook.graph.nodes.filter(({ kind }) => kind === "lemma")).toHaveLength(121);
    expect(openLogicBook.graph.nodes.filter(({ kind }) => kind === "corollary")).toHaveLength(73);
    expect(openLogicBook.graph.directDependencies).toHaveLength(700);
    expect(openLogicBook.graph.proofRoutes).toHaveLength(693);
    expect(openLogicBook.graph.references).toHaveLength(892);
    expect(openLogicBook.graph.references.filter(({ resolution }) => resolution.status === "unresolved"))
      .toHaveLength(18);
    expect(openLogicBook.graph.references).toContainEqual(expect.objectContaining({
      basis: "proof-xref",
      ref: "sfr:siz:red:prob:nat-nat",
      resolution: expect.objectContaining({
        status: "unresolved",
        note: expect.stringContaining("ambiguous"),
      }),
    }));
    expect(openLogicBook.extractionState.status).toBe("extracted");
    expect(openLogicBook.graphState.status).toBe("extracted");
    }
    const linearAlgebraBook = localCandidateFiles.get("S0091/complete-source.json");
    if (linearAlgebraBook) {
    expect(linearAlgebraBook?.exactEdition).toMatchObject({
      sourceRepository: "https://github.com/davidaustinm/ula",
      sourceRevision: "a895a539d9972bde1cc85aea5e9516fc7b0f4b25",
      sourceFormat: "pretext-xml",
      licenseSpdx: "CC-BY-4.0",
    });
    expect(linearAlgebraBook?.sourceUnits).toHaveLength(78);
    expect(linearAlgebraBook?.sourceUnits.some((unit) => unit.locator.includes("/prefigure/")))
      .toBe(false);
    expect(linearAlgebraBook?.extractionState.note).toContain(
      "382 embedded XML asset include(s) beneath PreFigure were excluded",
    );
    expect(linearAlgebraBook?.extractionState.note).toContain(
      "44d498baef12f7d3898cee1984f524c1a70c0f4a39c18c73bc6bd23fc8664ec3",
    );
    expect(linearAlgebraBook?.graph.nodes.filter((node) => node.nodeClass === "theorem-like"))
      .toHaveLength(65);
    expect(linearAlgebraBook?.graph.nodes.filter((node) => node.nodeClass === "support"))
      .toHaveLength(38);
    expect(linearAlgebraBook?.graph.nodes.some((node) => node.sourceLocator.includes("/prefigure/")))
      .toBe(false);
    expect(linearAlgebraBook?.graph.directDependencies).toHaveLength(0);
    expect(linearAlgebraBook?.graph.proofRoutes).toHaveLength(0);
    }
    const algebraBook = localCandidateFiles.get("S0164/complete-source.json");
    if (algebraBook) {
    expect(algebraBook?.exactEdition).toMatchObject({
      label: "Abstract Algebra: Theory and Applications, Annual Edition 2026",
      publicationYear: 2026,
      sourceRepository: "https://github.com/twjudson/aata",
      sourceRevision: "043274d5dead03ff007a461ffe4c2b8477be1248",
      licenseSpdx: null,
      licenseUrl: null,
      licenseNote: expect.stringMatching(/multiple distinct license markers.*GFDL-1\.2-or-later.*GFDL-1\.3-or-later/i),
    });
    expect(algebraBook?.sourceUnits).toHaveLength(32);
    expect(algebraBook?.graph.nodes.filter((node) => node.nodeClass === "theorem-like"))
      .toHaveLength(277);
    expect(algebraBook?.graph.nodes.filter((node) => node.nodeClass === "support"))
      .toHaveLength(71);
    expect(algebraBook?.graph.directDependencies).toHaveLength(70);
    expect(algebraBook?.graph.references.filter((reference) => reference.resolution.status === "unresolved"))
      .toHaveLength(21);
    }
    expect(populatedFiles).toHaveLength(0);
    expect(awaitingComponentCount).toBe(717);
  });

  it("rejects component and artifact count drift", () => {
    const { registry, manifest } = validateBookGraphIndex(rawRegistry, rawManifest);
    const absentEntry = manifest.entries.find(({ artifactPath }) => artifactPath === null);
    if (!absentEntry) throw new Error("missing absent-artifact manifest fixture");

    const missing = structuredClone(manifest);
    missing.entries.pop();
    expect(() => validateBookGraphIndex(rawRegistry, missing)).toThrow(/cover every required component/i);

    const extra = structuredClone(manifest);
    extra.componentCount += 1;
    extra.entries.push({
      ...structuredClone(absentEntry),
      bookGraphId: "S9999:extra",
      sourceRecordId: "S9999",
      sourceOrdinal: 9999,
      componentId: "extra",
      componentLabel: "Extra component",
    });
    expect(() => validateBookGraphIndex(rawRegistry, extra)).toThrow(/cover every required component/i);

    const artifactCountDrift = structuredClone(manifest);
    artifactCountDrift.artifactCount += 1;
    expect(() => validateBookGraphIndex(rawRegistry, artifactCountDrift)).toThrow(/artifact count is stale/i);

    const componentCountDrift = structuredClone(manifest);
    componentCountDrift.componentCount -= 1;
    expect(() => validateBookGraphIndex(rawRegistry, componentCountDrift)).toThrow(/cover every required component/i);

    void registry;
  });

  it("rejects unsafe, duplicate, or noncanonical artifact paths", () => {
    const { manifest } = validateBookGraphIndex(rawRegistry, rawManifest);
    const firstPresent = manifest.entries[0];
    const secondPresent = manifest.entries[1];
    if (!firstPresent || !secondPresent) throw new Error("missing manifest fixtures");

    const unsafeManifest = structuredClone(manifest);
    const unsafeEntry = unsafeManifest.entries.find(({ bookGraphId }) => bookGraphId === firstPresent.bookGraphId);
    if (!unsafeEntry) throw new Error("missing unsafe-path fixture entry");
    unsafeEntry.artifactPath = "../escape.json";
    unsafeManifest.artifactCount = 1;
    expect(() => validateBookGraphIndex(rawRegistry, unsafeManifest)).toThrow();

    const noncanonicalManifest = structuredClone(manifest);
    const noncanonicalEntry = noncanonicalManifest.entries.find(({ bookGraphId }) => bookGraphId === firstPresent.bookGraphId);
    if (!noncanonicalEntry) throw new Error("missing noncanonical-path fixture entry");
    noncanonicalEntry.artifactPath = `${noncanonicalEntry.sourceRecordId}/wrong-component.json`;
    noncanonicalManifest.artifactCount = 1;
    expect(() => validateBookGraphIndex(rawRegistry, noncanonicalManifest)).toThrow(/canonical artifact path/i);

    const duplicatePathManifest = structuredClone(manifest);
    const firstDuplicateEntry = duplicatePathManifest.entries.find(({ bookGraphId }) => (
      bookGraphId === firstPresent.bookGraphId
    ));
    const duplicateEntry = duplicatePathManifest.entries.find(({ bookGraphId }) => bookGraphId === secondPresent.bookGraphId);
    if (!firstDuplicateEntry || !duplicateEntry) throw new Error("missing duplicate-path fixture entry");
    firstDuplicateEntry.artifactPath = `${firstDuplicateEntry.sourceRecordId}/${firstDuplicateEntry.componentId}.json`;
    duplicateEntry.artifactPath = firstDuplicateEntry.artifactPath;
    duplicatePathManifest.artifactCount = 2;
    expect(() => validateBookGraphIndex(rawRegistry, duplicatePathManifest)).toThrow(/artifact path/i);
  });

  it("rejects absent-artifact state or metric drift and refuses to validate a missing artifact", () => {
    const { registry, manifest } = validateBookGraphIndex(rawRegistry, rawManifest);
    const absentEntry = manifest.entries.find(({ artifactPath }) => artifactPath === null);
    if (!absentEntry) throw new Error("missing absent-artifact manifest fixture");

    const metricDrift = structuredClone(manifest);
    const metricEntry = metricDrift.entries.find(({ bookGraphId }) => bookGraphId === absentEntry.bookGraphId);
    if (!metricEntry) throw new Error("missing null-metric fixture entry");
    metricEntry.theoremNodeCount = 1;
    expect(() => validateBookGraphIndex(rawRegistry, metricDrift)).toThrow(/absent book graph artifact/i);

    const stateDrift = structuredClone(manifest);
    const stateEntry = stateDrift.entries.find(({ bookGraphId }) => bookGraphId === absentEntry.bookGraphId);
    if (!stateEntry) throw new Error("missing null-state fixture entry");
    stateEntry.extractionStatus = "queued";
    expect(() => validateBookGraphIndex(rawRegistry, stateDrift)).toThrow(/absent book graph artifact/i);

    expect(() => validateBookGraphManifestEntry(registry, absentEntry, reviewedGraphFixture()))
      .toThrow(/no book graph artifact/i);
  });

  it("validates only present artifacts and rejects identity, metric, or file-set drift", () => {
    const fixture = manifestWithReviewedFixture();
    const { registry, manifest } = validateBookGraphIndex(rawRegistry, fixture.manifest);
    const presentEntry = manifest.entries.find(({ artifactPath }) => artifactPath !== null);
    if (!presentEntry || presentEntry.artifactPath === null) throw new Error("missing present-artifact manifest fixture");
    const presentFile = fixture.file;

    const wrongIdentity = structuredClone(presentFile) as BookGraphFile;
    wrongIdentity.identity.componentLabel = "Wrong component";
    expect(() => validateBookGraphManifestEntry(registry, presentEntry, wrongIdentity))
      .toThrow(/immutable identity/i);

    const staleMetrics = structuredClone(presentEntry);
    staleMetrics.theoremNodeCount += 1;
    expect(() => validateBookGraphManifestEntry(registry, staleMetrics, presentFile))
      .toThrow(/manifest metrics are stale/i);

    const rawArtifacts = new Map<string, unknown>([[presentEntry.artifactPath, presentFile]]);
    expect(validateBookGraphCorpus(rawRegistry, manifest, rawArtifacts).filesByPath.size)
      .toBe(manifest.artifactCount);

    rawArtifacts.delete(presentEntry.artifactPath);
    expect(() => validateBookGraphCorpus(rawRegistry, manifest, rawArtifacts))
      .toThrow(/present artifacts/i);
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

    const rawEmptyRoute = reviewedGraphFixture();
    rawEmptyRoute.graph.directDependencies = [];
    rawEmptyRoute.graph.proofRoutes[0] = {
      id: "route-1",
      theoremNodeId: "theorem-1",
      routeKind: "source-proof",
      dependencyIds: [],
      summary: "The raw source proof contains no explicit resolved cross-reference.",
      evidence: structuredClone(reviewedEvidence),
    };
    if (!rawEmptyRoute.graphState.graphAudit) throw new Error("missing graph audit fixture");
    rawEmptyRoute.graphState.graphAudit.directDependencyCount = 0;
    rawEmptyRoute.graphState.status = "extracted";
    rawEmptyRoute.graphState.independentReview = null;
    expect(validateBookGraphFile(rawEmptyRoute).graph.proofRoutes[0]?.dependencyIds).toEqual([]);

    rawEmptyRoute.graphState.status = "reviewed-complete";
    rawEmptyRoute.graphState.independentReview = {
      actorId: "reviewer:graph",
      reviewedAt: "2026-08-22T15:00:00Z",
      evidenceSha256: "e".repeat(64),
      note: "The graph was reviewed but no root decision was supplied.",
    };
    expect(() => validateBookGraphFile(rawEmptyRoute)).toThrow(/route or root attestation/i);
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

  it("keeps raw source artifacts separate from mathematical support nodes", () => {
    const file = reviewedGraphFixture();
    const inventory = file.unitInventories[0];
    const route = file.graph.proofRoutes[0];
    const audit = file.graphState.graphAudit;
    if (!inventory || !route || !audit) throw new Error("missing source-artifact fixture state");

    file.graph.nodes.push({
      id: "artifact-section-1",
      nodeClass: "source-artifact",
      kind: "section",
      sourceLabel: "Section artifact 1",
      sourceXmlId: "section-artifact-1",
      sourceLocator: "page 1",
      title: "Referenced source section",
      normalizedStatement: "The source proof imports this section as a whole.",
      sourceTextSha256: "4".repeat(64),
      evidence: structuredClone(reviewedEvidence),
    });
    inventory.sourceArtifactNodeIds.push("artifact-section-1");
    file.graph.directDependencies.push({
      id: "dependency-source-artifact-1",
      dependentNodeId: "theorem-1",
      prerequisite: { type: "node", id: "artifact-section-1" },
      role: "source-reference",
      rationale: "The original proof cites the aggregate source section.",
      evidence: structuredClone(reviewedEvidence),
    });
    route.dependencyIds.push("dependency-source-artifact-1");
    file.graph.references.push({
      id: "reference-source-artifact-1",
      ownerNodeId: "theorem-1",
      basis: "proof-xref",
      ref: "section-artifact-1",
      context: "Use the referenced section.",
      locator: "page 1",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "artifact-section-1" },
        directDependencyId: "dependency-source-artifact-1",
        note: "Resolved to a raw source artifact pending mathematical decomposition.",
      },
      evidence: structuredClone(reviewedEvidence),
    });
    audit.nodeCount = 3;
    audit.directDependencyCount = 2;
    audit.referenceCount = 1;

    expect(() => validateBookGraphFile(file)).toThrow(/reviewed graph still contains raw source artifacts/i);

    file.graphState.status = "extracted";
    file.graphState.independentReview = null;
    file.graphState.note = "The extracted graph retains a raw source artifact pending mathematical decomposition.";
    const validated = validateBookGraphFile(file);
    expect(validated.graph.nodes.filter(({ nodeClass }) => nodeClass === "support")).toHaveLength(1);
    expect(validated.graph.nodes.filter(({ nodeClass }) => nodeClass === "source-artifact"))
      .toHaveLength(1);
    const kindCounts = validated.graph.nodes
      .filter(({ nodeClass }) => nodeClass !== "source-artifact")
      .reduce<Record<string, number>>((counts, { kind }) => ({
        ...counts,
        [kind]: (counts[kind] ?? 0) + 1,
      }), {});
    const sourceArtifactKindCounts = validated.graph.nodes
      .filter(({ nodeClass }) => nodeClass === "source-artifact")
      .reduce<Record<string, number>>((counts, { kind }) => ({
        ...counts,
        [kind]: (counts[kind] ?? 0) + 1,
      }), {});
    expect(kindCounts).toEqual({ definition: 1, theorem: 1 });
    expect(sourceArtifactKindCounts).toEqual({ section: 1 });
    expect({
      theoremCount: validated.graph.nodes.filter(({ nodeClass }) => nodeClass === "theorem-like").length,
      supportCount: validated.graph.nodes.filter(({ nodeClass }) => nodeClass === "support").length,
      sourceArtifactCount: validated.graph.nodes.filter(({ nodeClass }) => nodeClass === "source-artifact").length,
    }).toEqual({ theoremCount: 1, supportCount: 1, sourceArtifactCount: 1 });
    expect(validated.graphState.graphAudit).toMatchObject({
      nodeCount: 3,
      directDependencyCount: 2,
      referenceCount: 1,
    });

    const misclassifiedInventory = structuredClone(file);
    misclassifiedInventory.unitInventories[0]?.supportNodeIds.push("artifact-section-1");
    misclassifiedInventory.unitInventories[0]?.sourceArtifactNodeIds.splice(0);
    expect(() => validateBookGraphFile(misclassifiedInventory)).toThrow(/non-support node/i);
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
