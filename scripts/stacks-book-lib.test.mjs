import { describe, expect, it } from "vitest";
import { extractStacksGraphFromUnits } from "./stacks-book-lib.mjs";

const capturedAt = "2026-08-23T18:00:00.000Z";
const stacksSourceRevision = "ed88ff783bcb4dd9a28518a33b028841094009cf";

const tagText = [
  "0001,algebra-definition-input",
  "0002,algebra-situation-context",
  "0003,algebra-lemma-first",
  "0004,algebra-theorem-output",
  "0005,algebra-example-worked",
  "0006,geometry-proposition-cross-file",
  "0007,algebra-equation-first",
  "0008,algebra-equation-first-proof",
  "0009,algebra-equation-output-proof",
  "0010,categories-lemma-yoneda",
  "0011,sites-equation-map-representable-into-presheaf",
  "0012,algebra-proposition-staged",
  "0013,algebra-theorem-before-boundary",
].join("\n");

const units = [
  {
    stem: "algebra",
    path: "algebra.tex",
    title: "Algebra",
    content: String.raw`
\begin{definition}
\label{definition-input}
An input is a marked object.
\end{definition}

\begin{situation}
\label{situation-context}
Assume that all objects are marked.
\end{situation}

\begin{lemma}
\label{lemma-first}
Every marked input is valid and satisfies
\begin{equation}
\label{equation-first}
1 = 1.
\end{equation}
\end{lemma}
\begin{proof}
Use Definition \ref{definition-input} in Situation \ref{situation-context}.
\begin{equation}
\label{equation-first-proof}
2 = 2.
\end{equation}
\end{proof}

\begin{example}
\label{example-worked}
This worked example must not become a graph node.
\end{example}

\begin{theorem}
\label{theorem-output}
By Lemma \ref{lemma-first}, every output is valid.
\end{theorem}
\begin{proof}[First proof]
Apply Equations \ref{equation-first} and \ref{equation-first-proof}, Proposition
\ref{geometry-proposition-cross-file}, and Example \ref{example-worked}.
Compare \cite[Lemma 2]{source-a,source-b} and again \cite[Lemma 2]{source-a},
then \cite[Theorem 3]{source-a} and \cite{source-c}.
For this proof's own displayed identity
\begin{equation}
\label{equation-output-proof}
3 = 3,
\end{equation}
see Equation \ref{equation-output-proof}.
\end{proof}
\begin{proof}[Second proof]
Apply Equation \ref{equation-first} again.
\end{proof}

\begin{proposition}
\label{proposition-staged}
The two stages agree.
\end{proposition}
\begin{proof}[Proof for a finite order thickening]
Use Definition \ref{definition-input}.
\end{proof}
\begin{proof}[Proof in general]
Use Situation \ref{situation-context}.
\end{proof}

\begin{theorem}
\label{theorem-before-boundary}
The boundary resets untargeted proof ownership.
\end{theorem}
\begin{proof}
Use Lemma \ref{lemma-first} and the identity
\ref{sites-equation-map-representable-into-presheaf}.
\end{proof}

\section{Detached prose}
\begin{proof}
This orphan block cites Proposition \ref{geometry-proposition-cross-file}.
\end{proof}
`,
  },
  {
    stem: "categories",
    path: "categories.tex",
    title: "Categories",
    content: String.raw`
\begin{lemma}
\label{lemma-yoneda}
The Yoneda result.
\end{lemma}
\begin{proof}
This is direct.
\end{proof}
`,
  },
  {
    stem: "geometry",
    path: "geometry.tex",
    title: "Geometry",
    content: String.raw`
\begin{proposition}
\label{proposition-cross-file}
Every geometric input is valid.
\end{proposition}
\begin{proof}
This is direct.
\end{proof}
`,
  },
];

describe("strict Stacks formal graph extraction", () => {
  it("includes formal definitions/results and excludes worked examples", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });

    expect(result.graph.nodes).toHaveLength(9);
    expect(result.stats.kindCounts).toEqual({
      assumption: 1,
      definition: 1,
      lemma: 2,
      proposition: 2,
      theorem: 2,
    });
    expect(result.graph.nodes.some((node) => (
      node.nodeClass !== "source-artifact" && node.kind === "example"
    ))).toBe(false);
    expect(result.graph.nodes.find(({ id }) => id === "tag-0005")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "example",
      sourceXmlId: "algebra-example-worked",
    });
    expect(result.stats).toMatchObject({
      sourceArtifactCount: 1,
      sourceArtifactKindCounts: { example: 1 },
    });
    expect(result.stats.excludedEnvironmentCounts.example).toBe(1);
    expect(result.unitInventories[0]).toMatchObject({
      theoremNodeIds: ["tag-0003", "tag-0004", "tag-0012", "tag-0013"],
      supportNodeIds: ["tag-0001", "tag-0002"],
      sourceArtifactNodeIds: ["tag-0005"],
      theoremFreeAttestation: false,
    });
  });

  it("creates only explicit proof-use edges and merges repeated citations", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const outputEdges = result.graph.directDependencies.filter((dependency) => (
      dependency.dependentNodeId === "tag-0004"
    ));

    expect(outputEdges.map((edge) => edge.prerequisite.id).sort()).toEqual([
      "tag-0003",
      "tag-0005",
      "tag-0006",
    ]);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0003",
      prerequisite: { type: "node", id: "tag-0001" },
      role: "definition",
    }));
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0003",
      prerequisite: { type: "node", id: "tag-0002" },
      role: "logical",
    }));
    expect(result.graph.proofRoutes.find((route) => route.theoremNodeId === "tag-0004")?.dependencyIds)
      .toHaveLength(3);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0004",
      prerequisite: { type: "node", id: "tag-0005" },
      role: "source-reference",
    }));
  });

  it("keeps explicit alternative proofs as separate dependency routes", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const routes = result.graph.proofRoutes.filter((route) => route.theoremNodeId === "tag-0004");

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({
      id: "route-tag-0004-source-proof",
      routeKind: "source-proof",
    });
    expect(routes[0].dependencyIds).toHaveLength(3);
    expect(routes[1]).toMatchObject({
      id: "route-tag-0004-alternate-proof-2",
      routeKind: "alternate-proof",
    });
    expect(routes[1].dependencyIds).toEqual(["dep-tag-0004-to-tag-0003"]);
    expect(routes[0].evidence.locator).not.toBe(routes[1].evidence.locator);
    expect(routes[0].evidence.captureAudit.artifactSha256)
      .not.toBe(routes[1].evidence.captureAudit.artifactSha256);
  });

  it("keeps staged special/general proofs as one conjunctive route", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const routes = result.graph.proofRoutes.filter((route) => route.theoremNodeId === "tag-0012");

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      routeKind: "source-proof",
      dependencyIds: [
        "dep-tag-0012-to-tag-0001",
        "dep-tag-0012-to-tag-0002",
      ],
    });
    expect(routes[0].evidence.locator).toContain("; ");
  });

  it("does not promote statement citations and exposes excluded proof targets", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const excludedProofReference = result.graph.references.find((reference) => (
      reference.ownerNodeId === "tag-0004" && reference.ref === "algebra-example-worked"
    ));

    expect(result.graph.references.some((reference) => reference.basis === "statement-xref")).toBe(false);
    expect(excludedProofReference).toMatchObject({
      basis: "proof-xref",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "tag-0005" },
      },
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      prerequisite: { type: "node", id: "tag-0005" },
      role: "source-reference",
    }));
  });

  it("surfaces bibliographic proof citations without inventing dependencies", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const citations = result.graph.references.filter((reference) => (
      reference.basis === "proof-citation"
    ));

    expect(citations).toHaveLength(4);
    expect(citations.map(({ ref, pinpoint }) => [ref, pinpoint])).toEqual([
      ["source-a", "Lemma 2"],
      ["source-b", "Lemma 2"],
      ["source-a", "Theorem 3"],
      ["source-c", null],
    ]);
    expect(citations.every((reference) => reference.resolution.status === "unresolved")).toBe(true);
    expect(citations.find((reference) => (
      reference.ref === "source-a" && reference.pinpoint === "Lemma 2"
    ))?.evidence.note).toContain("2 explicit proof citation occurrence(s)");
    expect(result.graph.externalInputs).toHaveLength(0);
    expect(result.stats).toMatchObject({
      proofCitationReferenceCount: 4,
      proofCitationOccurrenceCount: 5,
      distinctProofCitationKeyCount: 3,
      proofCitationOwnerCount: 1,
    });
  });

  it("rejects citation syntax that the deterministic parser cannot capture", () => {
    const malformedUnits = structuredClone(units);
    malformedUnits[0].content = malformedUnits[0].content.replace(
      String.raw`\cite[Lemma 2]{source-a,source-b}`,
      String.raw`\cite
[Lemma 2]{source-a,source-b}`,
    );

    expect(() => extractStacksGraphFromUnits(malformedUnits, tagText, { capturedAt }))
      .toThrow(/unsupported or multiline \\cite syntax/i);
  });

  it("checks captured citation keys against the pinned bibliography", () => {
    const bibliographyText = [
      "@book{source-a, title={A}}",
      "@book{source-b, title={B}}",
      "@book{source-c, title={C}}",
    ].join("\n");

    expect(extractStacksGraphFromUnits(units, tagText, { capturedAt, bibliographyText })
      .stats.distinctProofCitationKeyCount).toBe(3);
    expect(() => extractStacksGraphFromUnits(units, tagText, {
      capturedAt,
      bibliographyText: bibliographyText.replace("@book{source-c, title={C}}", ""),
    })).toThrow(/source-c is absent from my\.bib/i);
  });

  it("maps equation and item labels inside strict nodes or proofs to their formal owner", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const outputEdges = result.graph.directDependencies.filter((dependency) => (
      dependency.dependentNodeId === "tag-0004"
    ));

    expect(outputEdges.filter((edge) => edge.prerequisite.id === "tag-0003")).toHaveLength(1);
    expect(result.graph.references.some((reference) => [
      "algebra-equation-first",
      "algebra-equation-first-proof",
      "algebra-equation-output-proof",
    ].includes(reference.ref))).toBe(false);
    expect(outputEdges.some((edge) => edge.prerequisite.id === "tag-0004")).toBe(false);
  });

  it("resolves only source-audited exposition aliases to formal owners", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const boundaryEdges = result.graph.directDependencies.filter((dependency) => (
      dependency.dependentNodeId === "tag-0013"
    ));

    expect(boundaryEdges.map(({ prerequisite }) => prerequisite.id).sort()).toEqual([
      "tag-0003",
      "tag-0010",
    ]);
    expect(result.graph.references.some((reference) => (
      reference.ref === "sites-equation-map-representable-into-presheaf"
    ))).toBe(false);
  });

  it("resolves audited restatement displays to their source lemmas", () => {
    const restatementTags = [
      "02YE,groupoids-lemma-diagram",
      "03C6,groupoids-lemma-diagram-pull",
      "02VB,groupoids-lemma-restrict-groupoid",
      "04LF,more-groupoids-equation-diagram",
      "04LG,more-groupoids-equation-pull",
      "04MN,more-groupoids-equation-restriction",
      "0X01,more-groupoids-theorem-uses-restatements",
      "0X02,more-groupoids-equation-unrelated",
      "043Z,spaces-groupoids-lemma-diagram",
      "0450,spaces-groupoids-lemma-diagram-pull",
      "044B,spaces-groupoids-lemma-restrict-groupoid",
      "04P9,spaces-more-groupoids-equation-diagram",
      "0451,spaces-more-groupoids-equation-pull",
      "04RN,spaces-more-groupoids-equation-restriction",
      "0X03,spaces-more-groupoids-theorem-uses-restatements",
      "0D60,cohomology-lemma-RGamma-commutes-with-Rlim",
      "0BKR,cohomology-equation-ses-Rlim-over-U",
      "0X04,cohomology-theorem-uses-derived-limit-sequence",
      "0D6K,sites-cohomology-lemma-RGamma-commutes-with-Rlim",
      "0BKX,sites-cohomology-equation-ses-Rlim-over-U",
      "0X05,sites-cohomology-theorem-uses-derived-limit-sequence",
      "021I,topologies-lemma-morphism-big-small-etale",
      "0759,etale-cohomology-equation-compare-big-small",
      "0X06,etale-cohomology-theorem-uses-comparison",
      "0DF6,spaces-topologies-lemma-morphism-big-small-etale",
      "0DG9,spaces-more-cohomology-equation-compare-big-small",
      "0X07,spaces-more-cohomology-theorem-uses-comparison",
    ].join("\n");
    const restatementUnits = [
      {
        stem: "groupoids",
        path: "groupoids.tex",
        title: "Groupoids",
        content: String.raw`
\begin{lemma}
\label{lemma-diagram}
The groupoid diagram is cartesian.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{lemma}
\label{lemma-diagram-pull}
The pull diagram is cartesian.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{lemma}
\label{lemma-restrict-groupoid}
Restriction gives a groupoid.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
`,
      },
      {
        stem: "more-groupoids",
        path: "more-groupoids.tex",
        title: "More on Groupoids",
        content: String.raw`
We restate Groupoids, Lemmas \ref{groupoids-lemma-diagram} and
\ref{groupoids-lemma-diagram-pull} for easy reference.
\begin{equation}
\label{equation-diagram}
1 = 1
\end{equation}
\begin{equation}
\label{equation-pull}
2 = 2
\end{equation}
The restriction diagram comes from Groupoids, Lemma
\ref{groupoids-lemma-restrict-groupoid}.
\begin{equation}
\label{equation-restriction}
3 = 3
\end{equation}
\begin{equation}
\label{equation-unrelated}
4 = 4
\end{equation}
\begin{theorem}
\label{theorem-uses-restatements}
The displays apply.
\end{theorem}
\begin{proof}
Use Equations \ref{equation-diagram}, \ref{equation-pull},
\ref{equation-restriction}, and \ref{equation-unrelated}.
\end{proof}
`,
      },
      {
        stem: "spaces-groupoids",
        path: "spaces-groupoids.tex",
        title: "Groupoids in Spaces",
        content: String.raw`
\begin{lemma}
\label{lemma-diagram}
The spaces diagram is cartesian.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{lemma}
\label{lemma-diagram-pull}
The spaces pull diagram is cartesian.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{lemma}
\label{lemma-restrict-groupoid}
Restriction gives a spaces groupoid.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
`,
      },
      {
        stem: "spaces-more-groupoids",
        path: "spaces-more-groupoids.tex",
        title: "More on Groupoids in Spaces",
        content: String.raw`
We restate Groupoids in Spaces, Lemmas \ref{spaces-groupoids-lemma-diagram} and
\ref{spaces-groupoids-lemma-diagram-pull} for easy reference.
\begin{equation}
\label{equation-diagram}
1 = 1
\end{equation}
\begin{equation}
\label{equation-pull}
2 = 2
\end{equation}
The restriction diagram comes from Groupoids in Spaces, Lemma
\ref{spaces-groupoids-lemma-restrict-groupoid}.
\begin{equation}
\label{equation-restriction}
3 = 3
\end{equation}
\begin{theorem}
\label{theorem-uses-restatements}
The displays apply.
\end{theorem}
\begin{proof}
Use Equations \ref{equation-diagram}, \ref{equation-pull}, and
\ref{equation-restriction}.
\end{proof}
`,
      },
      {
        stem: "cohomology",
        path: "cohomology.tex",
        title: "Cohomology",
        content: String.raw`
\begin{lemma}
\label{lemma-RGamma-commutes-with-Rlim}
Derived global sections commute with derived limits.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{remark}
\begin{equation}
\label{equation-ses-Rlim-over-U}
0 \to 0
\end{equation}
by Lemma \ref{lemma-RGamma-commutes-with-Rlim}.
\end{remark}
\begin{theorem}
\label{theorem-uses-derived-limit-sequence}
The limit is exact.
\end{theorem}
\begin{proof}
Use Equation \ref{equation-ses-Rlim-over-U}.
\end{proof}
`,
      },
      {
        stem: "sites-cohomology",
        path: "sites-cohomology.tex",
        title: "Cohomology on Sites",
        content: String.raw`
\begin{lemma}
\label{lemma-RGamma-commutes-with-Rlim}
Derived global sections on a site commute with derived limits.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
\begin{remark}
\begin{equation}
\label{equation-ses-Rlim-over-U}
0 \to 0
\end{equation}
by Lemma \ref{lemma-RGamma-commutes-with-Rlim}.
\end{remark}
\begin{theorem}
\label{theorem-uses-derived-limit-sequence}
The site limit is exact.
\end{theorem}
\begin{proof}
Use Equation \ref{equation-ses-Rlim-over-U}.
\end{proof}
`,
      },
      {
        stem: "topologies",
        path: "topologies.tex",
        title: "Topologies",
        content: String.raw`
\begin{lemma}
\label{lemma-morphism-big-small-etale}
The big and small etale morphisms form a commutative diagram.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
`,
      },
      {
        stem: "etale-cohomology",
        path: "etale-cohomology.tex",
        title: "Etale Cohomology",
        content: String.raw`
The diagram of Topologies, Lemma
\ref{topologies-lemma-morphism-big-small-etale} gives
\begin{equation}
\label{equation-compare-big-small}
1 = 1
\end{equation}
\begin{theorem}
\label{theorem-uses-comparison}
The comparison holds.
\end{theorem}
\begin{proof}
Use Equation \ref{equation-compare-big-small}.
\end{proof}
`,
      },
      {
        stem: "spaces-topologies",
        path: "spaces-topologies.tex",
        title: "Topologies on Spaces",
        content: String.raw`
\begin{lemma}
\label{lemma-morphism-big-small-etale}
The big and small spaces etale morphisms form a commutative diagram.
\end{lemma}
\begin{proof}
Direct.
\end{proof}
`,
      },
      {
        stem: "spaces-more-cohomology",
        path: "spaces-more-cohomology.tex",
        title: "More Cohomology on Spaces",
        content: String.raw`
The diagram of Topologies on Spaces, Lemma
\ref{spaces-topologies-lemma-morphism-big-small-etale} gives
\begin{equation}
\label{equation-compare-big-small}
1 = 1
\end{equation}
\begin{theorem}
\label{theorem-uses-comparison}
The comparison holds.
\end{theorem}
\begin{proof}
Use Equation \ref{equation-compare-big-small}.
\end{proof}
`,
      },
    ];
    const result = extractStacksGraphFromUnits(restatementUnits, restatementTags, { capturedAt });
    const prerequisitesByOwner = new Map([
      ["tag-0x01", ["tag-02vb", "tag-02ye", "tag-03c6", "tag-0x02"]],
      ["tag-0x03", ["tag-043z", "tag-044b", "tag-0450"]],
      ["tag-0x04", ["tag-0d60"]],
      ["tag-0x05", ["tag-0d6k"]],
      ["tag-0x06", ["tag-021i"]],
      ["tag-0x07", ["tag-0df6"]],
    ]);

    for (const [ownerNodeId, expectedPrerequisites] of prerequisitesByOwner) {
      const actualPrerequisites = result.graph.directDependencies
        .filter((dependency) => dependency.dependentNodeId === ownerNodeId)
        .map((dependency) => dependency.prerequisite.id)
        .sort();
      expect(actualPrerequisites).toEqual(expectedPrerequisites);
    }

    const auditedAliases = new Set([
      "more-groupoids-equation-diagram",
      "more-groupoids-equation-pull",
      "more-groupoids-equation-restriction",
      "spaces-more-groupoids-equation-diagram",
      "spaces-more-groupoids-equation-pull",
      "spaces-more-groupoids-equation-restriction",
      "cohomology-equation-ses-Rlim-over-U",
      "sites-cohomology-equation-ses-Rlim-over-U",
      "etale-cohomology-equation-compare-big-small",
      "spaces-more-cohomology-equation-compare-big-small",
    ]);
    expect(result.graph.references.some(({ ref }) => auditedAliases.has(ref))).toBe(false);
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "tag-0x01",
      ref: "more-groupoids-equation-unrelated",
      resolution: expect.objectContaining({
        status: "resolved",
        target: { type: "node", id: "tag-0x02" },
      }),
    }));
    expect(result.graph.nodes.find(({ id }) => id === "tag-0x02")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "equation",
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0x01",
      prerequisite: { type: "node", id: "tag-0x02" },
      role: "source-reference",
    }));
  });

  it("does not attach an untargeted proof across a section boundary", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const boundaryEdges = result.graph.directDependencies.filter((dependency) => (
      dependency.dependentNodeId === "tag-0013"
    ));

    expect(boundaryEdges.some(({ prerequisite }) => prerequisite.id === "tag-0006")).toBe(false);
    expect(result.graph.proofRoutes.find((route) => route.theoremNodeId === "tag-0013")
      ?.evidence.locator).not.toContain("Detached prose");
  });

  it("promotes only proof-referenced sections as aggregate support dependencies", () => {
    const sectionUnits = [{
      stem: "foundations",
      path: "foundations.tex",
      title: "Foundations",
      content: String.raw`
\section{Referenced background}
\label{section-referenced-background}

\section{Unreferenced background}
\label{section-unreferenced-background}

\begin{theorem}
\label{theorem-uses-section}
The conclusion holds.
\end{theorem}
\begin{proof}
Use Section \ref{section-referenced-background}.
\end{proof}
`,
    }];
    const sectionTags = [
      "0100,foundations-section-referenced-background",
      "0101,foundations-section-unreferenced-background",
      "0102,foundations-theorem-uses-section",
    ].join("\n");

    const result = extractStacksGraphFromUnits(sectionUnits, sectionTags, { capturedAt });
    const sectionNode = result.graph.nodes.find(({ id }) => id === "tag-0100");
    const sectionDependency = result.graph.directDependencies.find(({ id }) => (
      id === "dep-tag-0102-to-tag-0100"
    ));

    expect(sectionNode).toMatchObject({
      nodeClass: "source-artifact",
      kind: "section",
      sourceXmlId: "foundations-section-referenced-background",
    });
    expect(sectionNode.evidence.note).toContain("outside the mathematical theorem/support inventory");
    expect(sectionNode.evidence.note).toContain("decomposition");
    expect(result.graph.nodes.some(({ id }) => id === "tag-0101")).toBe(false);
    expect(sectionDependency).toMatchObject({
      dependentNodeId: "tag-0102",
      prerequisite: { type: "node", id: "tag-0100" },
      role: "source-reference",
    });
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0102"))
      .toMatchObject({
        routeKind: "source-proof",
        dependencyIds: ["dep-tag-0102-to-tag-0100"],
      });
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "tag-0102",
      ref: "foundations-section-referenced-background",
      resolution: expect.objectContaining({
        status: "resolved",
        target: { type: "node", id: "tag-0100" },
      }),
    }));
    expect(result.stats).toMatchObject({
      sourceArtifactCount: 1,
      sourceArtifactKindCounts: { section: 1 },
      sourceArtifactDependencyCount: 1,
      sourceArtifactRouteCount: 1,
      unresolvedTaggedProofReferenceCount: 0,
    });
  });

  it("promotes only exact-label audited remark claims and resolves the audited Tor alias", () => {
    const claimTags = [
      "08J5,derived-remark-truncation-distinguished-triangle",
      "0AAA,derived-lemma-derived-canonical-delta-functor",
      "0AAB,derived-remark-ordinary",
      "00M5,algebra-lemma-characterize-flat",
      "00M6,algebra-remark-Tor-ring-mod-ideal",
      "0AAC,algebra-theorem-uses-tor-formula",
    ].join("\n");
    const claimUnits = [
      {
        stem: "derived",
        path: "derived.tex",
        title: "Derived Categories",
        content: String.raw`
\begin{lemma}
\label{lemma-derived-canonical-delta-functor}
Short exact sequences canonically give distinguished triangles.
\end{lemma}

\begin{remark}
\label{remark-truncation-distinguished-triangle}
We claim there is a canonical distinguished triangle. Namely, apply
Lemma \ref{lemma-derived-canonical-delta-functor}.
\end{remark}

\begin{remark}
\label{remark-ordinary}
This ordinary remark is not a theorem node.
\end{remark}
`,
      },
      {
        stem: "algebra",
        path: "algebra.tex",
        title: "Algebra",
        content: String.raw`
\begin{lemma}
\label{lemma-characterize-flat}
Flatness is characterized by injectivity after tensoring ideals.
\end{lemma}

\begin{remark}
\label{remark-Tor-ring-mod-ideal}
The proof of Lemma \ref{lemma-characterize-flat} gives the Tor formula.
\end{remark}

\begin{theorem}
\label{theorem-uses-tor-formula}
The formula has an application.
\end{theorem}
\begin{proof}
Use Remark \ref{remark-Tor-ring-mod-ideal}.
\end{proof}
`,
      },
    ];

    const result = extractStacksGraphFromUnits(claimUnits, claimTags, { capturedAt });

    expect(result.stats).toMatchObject({
      theoremCount: 4,
      curatedClaimCount: 1,
      excludedEnvironmentCounts: { remark: 2, remarks: 0 },
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-08j5")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      sourceXmlId: "derived-remark-truncation-distinguished-triangle",
    });
    expect(result.graph.nodes.some(({ sourceXmlId }) => (
      sourceXmlId === "derived-remark-ordinary"
      || sourceXmlId === "algebra-remark-Tor-ring-mod-ideal"
    ))).toBe(false);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-08j5",
      prerequisite: { type: "node", id: "tag-0aaa" },
    }));
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0aac",
      prerequisite: { type: "node", id: "tag-00m5" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-08j5")
      ?.dependencyIds).toEqual(["dep-tag-08j5-to-tag-0aaa"]);
    expect(result.graph.references.some(({ ref }) => (
      ref === "algebra-remark-Tor-ring-mod-ideal"
    ))).toBe(false);
  });

  it("resolves owner-specific named-result prose to an internal formal node", () => {
    const result = extractStacksGraphFromUnits([{
      stem: "algebra",
      path: "algebra.tex",
      title: "Algebra",
      content: String.raw`
\begin{lemma}
\label{lemma-snake}
The snake lemma.
\end{lemma}
\begin{proof}
This is direct.
\end{proof}

\begin{lemma}
\label{lemma-flat-tor-zero}
The desired Tor group vanishes.
\end{lemma}
\begin{proof}
The result follows from the snake lemma applied to the diagram.
\end{proof}
`,
    }], [
      "07JW,algebra-lemma-snake",
      "00HL,algebra-lemma-flat-tor-zero",
    ].join("\n"), { capturedAt });

    expect(result.stats).toMatchObject({
      namedResultDependencyCount: 1,
      deicticDependencyCount: 0,
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-00hl",
      prerequisite: { type: "node", id: "tag-07jw" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-00hl")
      ?.dependencyIds).toEqual(["dep-tag-00hl-to-tag-07jw"]);
  });

  it("recovers audited Nakayama, five-lemma, and 2-Yoneda invocations", () => {
    const result = extractStacksGraphFromUnits([
      {
        stem: "categories",
        path: "categories.tex",
        title: "Categories",
        content: String.raw`
\begin{lemma}
\label{lemma-yoneda-2category}
The 2-Yoneda lemma.
\end{lemma}
`,
      },
      {
        stem: "algebra",
        path: "algebra.tex",
        title: "Algebra",
        content: String.raw`
\begin{lemma}
\label{lemma-NAK}
The ordinary Nakayama lemma.
\end{lemma}
`,
      },
      {
        stem: "homology",
        path: "homology.tex",
        title: "Homology",
        content: String.raw`
\begin{lemma}
\label{lemma-five-lemma}
The five lemma.
\end{lemma}
`,
      },
      {
        stem: "stacks-properties",
        path: "stacks-properties.tex",
        title: "Properties of Stacks",
        content: String.raw`
\begin{lemma}
\label{lemma-equivalence}
The two objects are equivalent.
\end{lemma}
\begin{proof}
They are equivalent by the $2$-Yoneda lemma.
\end{proof}
`,
      },
      {
        stem: "adequate",
        path: "adequate.tex",
        title: "Adequate Modules",
        content: String.raw`
\begin{lemma}
\label{lemma-extension-adequate-key}
The natural map is an isomorphism.
\end{lemma}
\begin{proof}
This follows from the five lemma.
\end{proof}
`,
      },
      {
        stem: "dualizing",
        path: "dualizing.tex",
        title: "Dualizing Complexes",
        content: String.raw`
\begin{lemma}
\label{lemma-equivalence-finite-length}
The two modules have the same number of generators.
\end{lemma}
\begin{proof}
The conclusion follows from Nakayama's lemma.
\end{proof}
`,
      },
    ], [
      "004B,categories-lemma-yoneda-2category",
      "00DV,algebra-lemma-NAK",
      "05QB,homology-lemma-five-lemma",
      "04XF,stacks-properties-lemma-equivalence",
      "06V6,adequate-lemma-extension-adequate-key",
      "0A7P,dualizing-lemma-equivalence-finite-length",
    ].join("\n"), { capturedAt });

    expect(result.stats.namedResultDependencyCount).toBe(3);
    expect(result.graph.directDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependentNodeId: "tag-04xf",
        prerequisite: { type: "node", id: "tag-004b" },
      }),
      expect.objectContaining({
        dependentNodeId: "tag-06v6",
        prerequisite: { type: "node", id: "tag-05qb" },
      }),
      expect.objectContaining({
        dependentNodeId: "tag-0a7p",
        prerequisite: { type: "node", id: "tag-00dv" },
      }),
    ]));
    expect(result.graph.proofRoutes).toHaveLength(6);
    const emptySourceRoutes = result.graph.proofRoutes.filter(({ dependencyIds }) => (
      dependencyIds.length === 0
    ));
    expect(emptySourceRoutes).toHaveLength(3);
    expect(emptySourceRoutes.every(({ summary, evidence }) => (
      summary.includes("not a root attestation")
      && evidence.note.includes("not a root attestation")
    ))).toBe(true);
    expect(result.stats.emptySourceRouteCount).toBe(3);
  });

  it("promotes the audited long-exact-sequence prose claim with both direct prerequisites", () => {
    const rawClaim = String.raw`If $H : \mathcal{D} \to \mathcal{A}$ is a homological functor
we often write $H^n(X) = H(X[n])$ so that $H(X) = H^0(X)$.
Our discussion of TR2 above implies that a distinguished triangle
$(X, Y, Z, f, g, h)$ determines a long exact sequence
\begin{equation}
\label{equation-long-exact-cohomology-sequence}
\xymatrix@C=3pc{
H^{-1}(Z) \ar[r]^{H(h[-1])} &
H^0(X) \ar[r]^{H(f)} &
H^0(Y) \ar[r]^{H(g)} &
H^0(Z) \ar[r]^{H(h)} &
H^1(X)
}
\end{equation}
This will be called the {\it long exact sequence} associated to the
distinguished triangle and the homological functor. As indicated
we will not use any signs for the morphisms in the long exact
sequence. This has the side effect that maps in the long exact sequence
associated to the rotation (TR2) of a distinguished triangle differ
from the maps in the sequence above by some signs.`;
    const preamble = String.raw`\begin{definition}
\label{definition-triangulated-category}
A pre-triangulated category satisfies TR2.
\end{definition}

\begin{definition}
\label{definition-homological}
A homological functor sends distinguished triangles to exact sequences.
\end{definition}`;
    const preambleLines = preamble.split("\n");
    const ownerSource = [
      ["lemma-compose-delta-functor-homological", 1],
      ["lemma-homological-functor-localize", 2],
      ["lemma-homological-functor-kernel", 1],
      ["lemma-homological-functor-bounded", 1],
      ["lemma-acyclic-general", 1],
      ["lemma-pre-prepare-adjoint", 1],
    ].map(([label, occurrenceCount]) => String.raw`
\begin{lemma}
\label{${label}}
The desired assertion holds.
\end{lemma}
\begin{proof}
${Array.from({ length: occurrenceCount }, () => (
    String.raw`Use Equation \ref{equation-long-exact-cohomology-sequence}.`
  )).join(" ")}
\end{proof}`).join("\n");
    const content = [
      ...preambleLines,
      ...Array.from({ length: 276 - preambleLines.length }, () => "% audited padding"),
      ...rawClaim.split("\n"),
      ownerSource,
    ].join("\n");

    const result = extractStacksGraphFromUnits([{
      stem: "derived",
      path: "derived.tex",
      title: "Derived Categories",
      content,
    }], [
      "0145,derived-definition-triangulated-category",
      "0147,derived-definition-homological",
      "0148,derived-equation-long-exact-cohomology-sequence",
      "05SR,derived-lemma-compose-delta-functor-homological",
      "05R5,derived-lemma-homological-functor-localize",
      "05RD,derived-lemma-homological-functor-kernel",
      "05RE,derived-lemma-homological-functor-bounded",
      "05RM,derived-lemma-acyclic-general",
      "0CQQ,derived-lemma-pre-prepare-adjoint",
    ].join("\n"), { capturedAt });

    expect(result.stats).toMatchObject({
      theoremCount: 7,
      supportCount: 2,
      curatedClaimCount: 1,
      curatedClaimDependencyCount: 2,
      semanticDependencyCount: 2,
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-0148")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      title: "Long exact sequence associated to a distinguished triangle",
      sourceLocator: "derived.tex:L277-L296",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-0148")
      .map(({ prerequisite }) => prerequisite.id)
      .sort()).toEqual(["tag-0145", "tag-0147"]);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0148")
      ?.dependencyIds.sort()).toEqual([
        "dep-tag-0148-to-tag-0145",
        "dep-tag-0148-to-tag-0147",
      ]);
  });

  it("keeps the audited Cauchy-Binet claim pending while routing its exact owner", () => {
    const algebraLines = Array.from({ length: 2703 }, () => "% audited padding");
    const cauchyBinetClaim = String.raw`\label{item-cauchy-binet}
given matrices $A$ and $B$ in a ring $R$ of sizes $m \times n$ and
$n \times m$ we have $\det(AB) = \sum \det(A_S)\det({}_SB)$ in $R$ where
the sum is over subsets $S \subset \{1, \ldots, n\}$ of size $m$
and $A_S$ is the $m \times m$ submatrix of $A$ with columns
corresponding to $S$ and ${"$"}{}_SB$ is the $m \times m$ submatrix of $B$
with rows corresponding to $S$,`.split("\n");
    algebraLines.splice(281, cauchyBinetClaim.length, ...cauchyBinetClaim);

    const ownerAndProof = String.raw`\begin{lemma}
\label{lemma-matrix-left-inverse}
Let $R$ be a ring. Let $n \geq m$. Let $A$ be an
$n \times m$ matrix with coefficients in $R$. Let $J \subset R$
be the ideal generated by the $m \times m$ minors of $A$.
\begin{enumerate}
\item For any $f \in J$ there exists a $m \times n$ matrix $B$
such that $BA = f 1_{m \times m}$.
\item If $f \in R$ and $BA = f 1_{m \times m}$ for some $m \times n$ matrix
$B$, then $f^m \in J$.
\end{enumerate}
\end{lemma}

\begin{proof}
For $I \subset \{1, \ldots, n\}$ with $|I| = m$, we denote
by $E_I$ the $m \times n$ matrix of the projection
$$
R^{\oplus n} = \bigoplus\nolimits_{i \in \{1, \ldots, n\}} R
\longrightarrow \bigoplus\nolimits_{i \in I} R
$$
and set $A_I = E_I A$, i.e., $A_I$ is the $m \times m$ matrix
whose rows are the rows of $A$ with indices in $I$.
Let $B_I$ be the adjugate (transpose of
cofactor) matrix to $A_I$, i.e., such that
$A_I B_I = B_I A_I = \det(A_I) 1_{m \times m}$.
The $m \times m$ minors of $A$ are the determinants $\det A_I$
for all the $I \subset \{1, \ldots, n\}$ with $|I| = m$.
If $f \in J$ then we can write $f = \sum c_I \det(A_I)$ for some
$c_I \in R$. Set $B = \sum c_I B_I E_I$ to see that (1) holds.

\medskip\noindent
If $f 1_{m \times m} = BA$ then by the
Cauchy-Binet formula (\ref{item-cauchy-binet}) we
have $f^m = \sum b_I \det(A_I)$ where $b_I$ is the determinant
of the $m \times m$ matrix whose columns are the columns of $B$ with
indices in $I$.
\end{proof}`.split("\n");
    algebraLines.splice(2666, ownerAndProof.length, ...ownerAndProof);

    const result = extractStacksGraphFromUnits([{
      stem: "algebra",
      path: "algebra.tex",
      title: "Algebra",
      content: algebraLines.join("\n"),
    }], [
      "0F0K,algebra-item-cauchy-binet",
      "07DQ,algebra-lemma-matrix-left-inverse",
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      theoremCount: 2,
      curatedClaimCount: 1,
      directDependencyCount: 1,
      explicitProofXrefDependencyCount: 1,
      proofRouteCount: 2,
      emptySourceRouteCount: 1,
      pendingTheoremCount: 1,
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-0f0k")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      sourceXmlId: "algebra-item-cauchy-binet",
      sourceLocator: "algebra.tex:L282-L288",
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      id: "dep-tag-07dq-to-tag-0f0k",
      dependentNodeId: "tag-07dq",
      prerequisite: { type: "node", id: "tag-0f0k" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0f0k"))
      .toMatchObject({
        dependencyIds: [],
        summary: expect.stringContaining("not a root attestation"),
      });
    expect(result.graph.proofRoutes.filter(({ theoremNodeId }) => theoremNodeId === "tag-0f0k"))
      .toHaveLength(1);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-07dq")
      ?.dependencyIds).toEqual(["dep-tag-07dq-to-tag-0f0k"]);
    expect(result.graph.references).toHaveLength(0);
  });

  it("matches the pushforward claim to its exact source stem and keeps route debt owner-specific", () => {
    const pushforwardClaim = String.raw`\noindent
Let $f : \mathcal{X} \to \mathcal{Y}$ be a $1$-morphism of categories
fibred in groupoids over $(\Sch/S)_{fppf}$. Let $\mathcal{F}$
be a presheaf on $\mathcal{X}$. Let $y \in \Ob(\mathcal{Y})$.
We can compute $f_*\mathcal{F}(y)$ in the following way. Suppose that
$y$ lies over the scheme $V$ and using the $2$-Yoneda lemma think
of $y$ as a $1$-morphism. Consider the projection
$$
\text{pr} :
(\Sch/V)_{fppf} \times_{y, \mathcal{Y}} \mathcal{X}
\longrightarrow
\mathcal{X}
$$
Then we have a canonical identification
\begin{equation}
\label{equation-pushforward}
f_*\mathcal{F}(y) = \Gamma\Big(
(\Sch/V)_{fppf} \times_{y, \mathcal{Y}} \mathcal{X},
\ \text{pr}^{-1}\mathcal{F}\Big)
\end{equation}
Namely, objects of the $2$-fibre product are triples
$(h : U \to V, x, f(x) \to h^*y)$. Dropping the $h$ from the
notation we see that this is equivalent to the data of an object
$x$ of $\mathcal{X}$ and a morphism $\alpha : f(x) \to y$ of $\mathcal{Y}$.
Since $f_*\mathcal{F}(y) = \lim_{f(x) \to y} \mathcal{F}(x)$ by definition
the equality follows.`;
    const owner = (label, references) => String.raw`
\begin{lemma}
\label{${label}}
The comparison has the claimed form.
\end{lemma}
\begin{proof}
${references.map((reference) => String.raw`Use Equation \ref{${reference}}.`).join(" ")}
\end{proof}`;
    const stacksSheavesContent = [
      ...Array.from({ length: 514 }, () => "% audited padding"),
      ...pushforwardClaim.split("\n"),
      owner("lemma-compare-morphism", ["equation-pushforward"]),
      owner("lemma-base-change", ["equation-pushforward"]),
      owner("lemma-pushforward-restriction", ["equation-pushforward"]),
    ].join("\n");
    const result = extractStacksGraphFromUnits([
      {
        stem: "stacks",
        path: "stacks.tex",
        title: "Stacks",
        content: String.raw`
\begin{lemma}
\label{lemma-decoy}
This shorter stem must not inherit a stacks-sheaves curated span.
\end{lemma}
`,
      },
      {
        stem: "categories",
        path: "categories.tex",
        title: "Categories",
        content: String.raw`
\begin{lemma}
\label{lemma-yoneda-2category}
The 2-Yoneda lemma holds.
\end{lemma}
`,
      },
      {
        stem: "stacks-sheaves",
        path: "stacks-sheaves.tex",
        title: "Sheaves on Algebraic Stacks",
        content: stacksSheavesContent,
      },
      {
        stem: "stacks-cohomology",
        path: "stacks-cohomology.tex",
        title: "Cohomology of Algebraic Stacks",
        content: owner("lemma-lisse-etale-functorial", [
          "stacks-sheaves-equation-pushforward",
          "stacks-sheaves-equation-pushforward",
        ]),
      },
    ], [
      "0ZZZ,stacks-lemma-decoy",
      "004B,categories-lemma-yoneda-2category",
      "06W6,stacks-sheaves-equation-pushforward",
      "073N,stacks-sheaves-lemma-compare-morphism",
      "075B,stacks-sheaves-lemma-base-change",
      "075G,stacks-sheaves-lemma-pushforward-restriction",
      "07AT,stacks-cohomology-lemma-lisse-etale-functorial",
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      curatedClaimCount: 1,
      curatedClaimDependencyCount: 1,
      directDependencyCount: 5,
      explicitProofXrefDependencyCount: 4,
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-06w6")).toMatchObject({
      sourceXmlId: "stacks-sheaves-equation-pushforward",
      sourceLocator: "stacks-sheaves.tex:L515-L540",
      sourceTextSha256: "7a4fe6d4ea2899c8c6766624bae288b816245e5315af033ba83c7af7c73cd800",
      evidence: { sourceUnitIds: ["unit-stacks-sheaves"] },
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      id: "dep-tag-06w6-to-tag-004b",
      dependentNodeId: "tag-06w6",
      prerequisite: { type: "node", id: "tag-004b" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-06w6")
      ?.dependencyIds).toEqual(["dep-tag-06w6-to-tag-004b"]);

    const restrictionDebt = "pointwise bijection commutes with restriction maps";
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-075b")
      ?.evidence.note).toContain(restrictionDebt);
    for (const ownerTag of ["073n", "075g", "07at"]) {
      expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === `tag-${ownerTag}`)
        ?.evidence.note).not.toContain(restrictionDebt);
    }
  });

  it("keeps adjacent audited support conditions as distinct definition nodes", () => {
    const supportLines = [
      String.raw`\begin{equation}`,
      String.raw`\label{equation-bijective}`,
      String.raw`d\underline{\xi} : \text{Der}_\Lambda(R, k) \to T\mathcal{F}` + " ",
      String.raw`\text{ is bijective}`,
      String.raw`\end{equation}`,
      "and the condition",
      String.raw`\begin{equation}`,
      String.raw`\label{equation-bijective-orbits}`,
      String.raw`d\underline{\xi} : \text{Der}_\Lambda(R, k) \to T\mathcal{F}` + " ",
      String.raw`\text{ is bijective on }\text{Der}_\Lambda(k, k)\text{-orbits.}`,
      String.raw`\end{equation}`,
    ];
    const owner = (label, references) => String.raw`
\begin{lemma}
\label{${label}}
The audited condition is used.
\end{lemma}
\begin{proof}
${references.map((reference) => String.raw`Use (\ref{${reference}}).`).join(" ")}
\end{proof}`;
    const content = [
      ...Array.from({ length: 4398 }, () => "% audited padding"),
      ...supportLines,
      owner("lemma-owner-06iv", ["equation-bijective"]),
      owner("lemma-owner-06ix", [
        "equation-bijective",
        "equation-bijective",
        "equation-bijective-orbits",
      ]),
      owner("lemma-owner-06ir", ["equation-bijective-orbits"]),
      owner("lemma-owner-06t8", [
        "equation-bijective-orbits",
        "equation-bijective-orbits",
      ]),
      owner("lemma-owner-06jm", ["equation-bijective-orbits"]),
      owner("lemma-owner-06kn", ["equation-bijective-orbits"]),
    ].join("\n");

    const result = extractStacksGraphFromUnits([{
      stem: "formal-defos",
      path: "formal-defos.tex",
      title: "Formal Deformation Theory",
      content,
    }], [
      "06IM,formal-defos-equation-bijective",
      "06T6,formal-defos-equation-bijective-orbits",
      "06IV,formal-defos-lemma-owner-06iv",
      "06IX,formal-defos-lemma-owner-06ix",
      "06IR,formal-defos-lemma-owner-06ir",
      "06T8,formal-defos-lemma-owner-06t8",
      "06JM,formal-defos-lemma-owner-06jm",
      "06KN,formal-defos-lemma-owner-06kn",
    ].join("\n"), { capturedAt });

    expect(result.stats).toMatchObject({
      theoremCount: 6,
      supportCount: 2,
      curatedSupportCount: 2,
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-06im")).toMatchObject({
      nodeClass: "support",
      kind: "definition",
      sourceXmlId: "formal-defos-equation-bijective",
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-06t6")).toMatchObject({
      nodeClass: "support",
      kind: "definition",
      sourceXmlId: "formal-defos-equation-bijective-orbits",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-06ix")
      .map(({ prerequisite, role }) => [prerequisite.id, role])
      .sort()).toEqual([
        ["tag-06im", "definition"],
        ["tag-06t6", "definition"],
      ]);
  });

  it("promotes audited equation-labelled support spans with complete owner inventories", () => {
    const owner = (label, target, occurrenceCount) => [
      String.raw`\begin{lemma}`,
      String.raw`\label{${label}}`,
      "The audited support span is used.",
      String.raw`\end{lemma}`,
      String.raw`\begin{proof}`,
      Array.from({ length: occurrenceCount }, () => (
        String.raw`Use Equation \ref{${target}}.`
      )).join(" "),
      String.raw`\end{proof}`,
    ].join("\n");
    const atLine = (startLine, rawSpan) => [
      ...Array.from({ length: startLine - 1 }, () => "% audited padding"),
      ...rawSpan.split("\n"),
    ].join("\n");
    const supportCases = [
      {
        tag: "0F6J",
        stem: "more-etale",
        localLabel: "equation-formal-sum",
        kind: "construction",
        title: "Finite formal-sum presentation of f_{p!}F(V)",
        locator: "more-etale.tex:L811-L846",
        hash: "4bbbf03c3bafcc55c0b366d044c3f6c8afc4efbf0afe39eb674bd47a944c5089",
        owners: { "0F6P": 2, "0F6Q": 1, "0F5J": 2, "0F79": 2 },
      },
      {
        tag: "0FZC",
        stem: "functors",
        localLabel: "equation-FM-QCoh",
        kind: "construction",
        title: "Kernel-transform functor on quasi-coherent modules",
        locator: "functors.tex:L817-L834",
        hash: "5986ee8ab6736f8b0f471dae31ed6cf12e0ff584ebf665d7286047c4f79c8bf2",
        owners: { "0FZD": 2, "0FZH": 2, "0FZN": 1, "0FZR": 1 },
      },
      {
        tag: "0AL4",
        stem: "restricted",
        localLabel: "equation-C-prime",
        kind: "definition",
        title: "I-adically complete algebras with finite-type reduction",
        locator: "restricted.tex:L107-L118",
        hash: "3b2e77c46f505201b0dd5b7b870349ad251080846f31d2cca5780b74f467df10",
        owners: { "0GAF": 1, "0ALM": 1, "0GCK": 1, "0AQL": 1 },
      },
      {
        tag: "08S4",
        stem: "defos",
        localLabel: "equation-to-solve",
        kind: "definition",
        title: "Square-zero ring deformation problem",
        locator: "defos.tex:L35-L55",
        hash: "79b3461325c58a9904db6772e826e6df4e4459be40177c83f6bd401826cbf039",
        owners: { "08S7": 1, "0GPT": 1, "0GPX": 1, "08S6": 1 },
      },
      {
        tag: "08U7",
        stem: "defos",
        localLabel: "equation-to-solve-ringed-spaces",
        kind: "definition",
        title: "Square-zero ringed-space deformation problem",
        locator: "defos.tex:L1704-L1736",
        hash: "0cdc51e61c5afc65448ac7eb344799a2ccdda74f45ecca546b96c207f858f1e0",
        owners: { "08UC": 1, "0GPZ": 1, "0GQ3": 1, "0D14": 1 },
      },
      {
        tag: "0E29",
        stem: "dualizing",
        localLabel: "equation-base-change",
        kind: "construction",
        title: "Canonical base-change map for trivial duality",
        locator: "dualizing.tex:L2441-L2476",
        hash: "93febbd4a788e3ab3a0e3c1d994af5892d503b4242363192e8591a52f6b8d6cd",
        owners: { "0E2A": 1, "0BZN": 1, "0BZR": 1, "0E2M": 1 },
      },
      {
        tag: "05NN",
        stem: "injectives",
        localLabel: "equation-compare",
        kind: "construction",
        title: "Comparison map from a colimit of morphism sets",
        locator: "injectives.tex:L54-L71",
        hash: "bf72cf5bfda8a4e1bf93dc9aa6b243774a6b1610d4502b73da6f95352b61f575",
        owners: { "05NR": 2, "05NT": 1, "079F": 1 },
      },
    ];
    const moreEtale = String.raw`\medskip\noindent
Let $f : X \to Y$ be a locally quasi-finite morphism of schemes.
Let $\mathcal{F}$ be an abelian sheaf on $X_\etale$. Given $V$ in
$Y_\etale$ denote $X_V = X \times_Y V$ the base change. We are going
to consider the group of finite formal sums
\begin{equation}
\label{equation-formal-sum}
s = \sum\nolimits_{i = 1, \ldots, n} (Z_i, s_i)
\end{equation}
where $Z_i \subset X_V$ is a locally closed subscheme such that the
morphism $Z_i \to V$ is finite\footnote{Since $f$ is locally quasi-finite,
the morphism $Z_i \to V$ is finite if and only if it is proper.}
and where $s_i \in H_{Z_i}(\mathcal{F})$. Here, as in
Section \ref{section-growing}, we set
$$
H_{Z_i}(\mathcal{F}) =
\{s_i \in \mathcal{F}(U_i) \mid \text{Supp}(s_i) \subset Z_i\}
$$
where $U_i \subset X_V$ is an open subscheme containing $Z_i$ as a
closed subscheme. We are going to consider these formal sums modulo the
following relations
\begin{enumerate}
\item
\label{item-sum}
$(Z, s) + (Z, s') = (Z, s + s')$,
\item
\label{item-sub}
$(Z, s) = (Z', s)$ if $Z \subset Z'$.
\end{enumerate}
Observe that the second relation makes sense: since $Z \to V$ is finite
and $Z' \to V$ is separated, the inclusion $Z \to Z'$ is closed and we
can use the map discussed in (\ref{item-inclusion}).

\medskip\noindent
Let us denote $f_{p!}\mathcal{F}(V)$ the quotient of the abelian
group of formal sums (\ref{equation-formal-sum}) by these relations.`;
    const functorsExample = String.raw`\begin{example}
\label{example-functor-quasi-coherent}
Let $R$ be a ring. Let $X$ and $Y$ be
schemes over $R$ with $X$ quasi-compact and quasi-separated.
Let $\mathcal{K}$ be a quasi-coherent $\mathcal{O}_{X \times_R Y}$-module.
Then we can consider the functor
\begin{equation}
\label{equation-FM-QCoh}
F : \QCoh(\mathcal{O}_X) \longrightarrow \QCoh(\mathcal{O}_Y),\quad
\mathcal{F} \longmapsto
\text{pr}_{2, *}(\text{pr}_1^*\mathcal{F}
\otimes_{\mathcal{O}_{X \times_R Y}} \mathcal{K})
\end{equation}
The morphism $\text{pr}_2$ is quasi-compact and quasi-separated
(Schemes, Lemmas \ref{schemes-lemma-quasi-compact-preserved-base-change}
and \ref{schemes-lemma-separated-permanence}). Hence pushforward along
this morphism preserves quasi-coherent modules, see
Schemes, Lemma \ref{schemes-lemma-push-forward-quasi-coherent}.
Moreover, our functor is $R$-linear and commutes with arbitrary direct sums,
see Cohomology of Schemes, Lemma \ref{coherent-lemma-colimit-cohomology}.
\end{example}`;
    const restricted = String.raw`Let $\mathcal{C}'$ be the category
\begin{equation}
\label{equation-C-prime}
\mathcal{C}' =
\left\{
\begin{matrix}
A\text{-algebras }B\text{ which are }I\text{-adically complete}\\
\text{such that }B/IB\text{ is of finite type over }A/I
\end{matrix}
\right\}
\end{equation}
Morphisms in $\mathcal{C}'$ are $A$-algebra maps. There is a functor`;
    const ringDeformation = String.raw`\noindent
In this section we use the naive cotangent complex to do a little bit
of deformation theory. We start with a surjective ring map $A' \to A$
whose kernel is an ideal $I$ of square zero. Moreover we assume
given a ring map $A \to B$, a $B$-module $N$, and an $A$-module map
$c : I \to N$. In this section we ask ourselves whether we can find
the question mark fitting into the following diagram
\begin{equation}
\label{equation-to-solve}
\vcenter{
\xymatrix{
0 \ar[r] & N \ar[r] & {?} \ar[r] & B \ar[r] & 0 \\
0 \ar[r] & I \ar[u]^c \ar[r] & A' \ar[u] \ar[r] & A \ar[u] \ar[r] & 0
}
}
\end{equation}
and moreover how unique the solution is (if it exists). More precisely,
we look for a surjection of $A'$-algebras $B' \to B$ whose kernel is
an ideal of square zero and is
identified with $N$ such that $A' \to B'$ induces the given map $c$.
We will say $B'$ is a {\it solution} to (\ref{equation-to-solve}).`;
    const ringedSpaceDeformation = String.raw`\noindent
In this section we use the naive cotangent complex to do a little bit
of deformation theory. We start with a first order thickening
$t : (S, \mathcal{O}_S) \to (S', \mathcal{O}_{S'})$ of ringed spaces.
We denote $\mathcal{J} = \Ker(t^\sharp)$ and we
identify the underlying topological spaces of $S$ and $S'$.
Moreover we assume given a morphism of ringed spaces
$f : (X, \mathcal{O}_X) \to (S, \mathcal{O}_S)$, an $\mathcal{O}_X$-module
$\mathcal{G}$, and an $f$-map $c : \mathcal{J} \to \mathcal{G}$
of sheaves of modules (Sheaves, Definition \ref{sheaves-definition-f-map}
and Section \ref{sheaves-section-ringed-spaces-functoriality-modules}).
In this section we ask ourselves whether we can find
the question mark fitting into the following diagram
\begin{equation}
\label{equation-to-solve-ringed-spaces}
\vcenter{
\xymatrix{
0 \ar[r] & \mathcal{G} \ar[r] & {?} \ar[r] & \mathcal{O}_X \ar[r] & 0 \\
0 \ar[r] & \mathcal{J} \ar[u]^c \ar[r] & \mathcal{O}_{S'} \ar[u] \ar[r] &
\mathcal{O}_S \ar[u] \ar[r] & 0
}
}
\end{equation}
(where the vertical arrows are $f$-maps)
and moreover how unique the solution is (if it exists). More precisely,
we look for a first order thickening
$i : (X, \mathcal{O}_X) \to (X', \mathcal{O}_{X'})$
and a morphism of thickenings $(f, f')$ as in
(\ref{equation-morphism-thickenings})
where $\Ker(i^\sharp)$ is identified with $\mathcal{G}$
such that $(f')^\sharp$ induces the given map $c$.
We will say $X'$ is a {\it solution} to
(\ref{equation-to-solve-ringed-spaces}).`;
    const dualizing = String.raw`\noindent
In this section we consider a cocartesian square of rings
$$
\xymatrix{
A \ar[r]_\alpha & A' \\
R \ar[u]^\varphi \ar[r]^\rho & R' \ar[u]_{\varphi'}
}
$$
In other words, we have $A' = A \otimes_R R'$. If $A$ and $R'$
are {\bf tor independent over} $R$ then there is a canonical base change map
\begin{equation}
\label{equation-base-change}
R\Hom(A, K) \otimes_A^\mathbf{L} A'
\longrightarrow
R\Hom(A', K \otimes_R^\mathbf{L} R')
\end{equation}
in $D(A')$ functorial for $K$ in $D(R)$. Namely, by the adjointness
of Lemma \ref{lemma-right-adjoint} such an arrow is the same thing as a map
$$
\varphi'_*\left(R\Hom(A, K) \otimes_A^\mathbf{L} A'\right)
\longrightarrow
K \otimes_R^\mathbf{L} R'
$$
in $D(R')$ where $\varphi'_* : D(A') \to D(R')$ is the restriction functor.
We may apply
More on Algebra, Lemma \ref{more-algebra-lemma-base-change-comparison}
to the left hand side to get that this is the same thing as a map
$$
\varphi_*(R\Hom(A, K)) \otimes_R^\mathbf{L} R'
\longrightarrow
K \otimes_R^\mathbf{L} R'
$$
in $D(R')$ where $\varphi_* : D(A) \to D(R)$ is the restriction functor.
For this we can choose $can \otimes^\mathbf{L} \text{id}_{R'}$
where $can : \varphi_*(R\Hom(A, K)) \to K$ is the
counit of the adjunction between $R\Hom(A, -)$ and $\varphi_*$.`;
    const injectives = String.raw`\medskip\noindent
We begin with a few set theoretic remarks.
Let $\{B_{\beta}\}_{\beta \in \alpha}$ be an inductive system of
objects in some category $\mathcal{C}$, indexed by
an ordinal $\alpha$. Assume that $\colim_{\beta \in \alpha} B_\beta$
exists in $\mathcal{C}$. If $A$ is an object of $\mathcal{C}$, then there is a
natural map
\begin{equation}
\label{equation-compare}
\colim_{\beta \in \alpha} \Mor_\mathcal{C}(A, B_\beta)
\longrightarrow
\Mor_\mathcal{C}(A, \colim_{\beta \in \alpha} B_\beta).
\end{equation}
because if one is given a map $A \to B_\beta$ for some $\beta$, one
naturally gets a map from $A$  into the colimit by composing with
$B_\beta \to \colim_{\beta \in \alpha} B_\alpha$.
Note that the left colimit is one of sets! In general, (\ref{equation-compare})
is neither injective or surjective.`;
    const firstDefos = atLine(35, ringDeformation).split("\n");
    const baseUnits = [
      { stem: "more-etale", content: atLine(811, moreEtale) },
      { stem: "functors", content: atLine(815, functorsExample) },
      { stem: "restricted", content: atLine(107, restricted) },
      {
        stem: "defos",
        content: [
          ...firstDefos,
          ...Array.from({ length: 1703 - firstDefos.length }, () => "% audited padding"),
          ...ringedSpaceDeformation.split("\n"),
        ].join("\n"),
      },
      { stem: "dualizing", content: atLine(2441, dualizing) },
      { stem: "injectives", content: atLine(54, injectives) },
      { stem: "duality", content: "" },
    ];
    const ownerEntries = supportCases.flatMap((supportCase) => (
      Object.entries(supportCase.owners).map(([tag, occurrenceCount]) => ({
        tag,
        occurrenceCount,
        stem: tag === "0E2M" ? "duality" : supportCase.stem,
        label: `lemma-owner-${tag.toLowerCase()}`,
        target: tag === "0E2M"
          ? `${supportCase.stem}-${supportCase.localLabel}`
          : supportCase.localLabel,
      }))
    ));
    const fixtureUnits = baseUnits.map((unit) => ({
      ...unit,
      path: `${unit.stem}.tex`,
      title: unit.stem,
      content: [
        unit.content,
        ...ownerEntries.filter(({ stem }) => stem === unit.stem)
          .map(({ label, target, occurrenceCount }) => owner(label, target, occurrenceCount)),
      ].filter(Boolean).join("\n"),
    }));
    const result = extractStacksGraphFromUnits(fixtureUnits, [
      ...supportCases.map(({ tag, stem, localLabel }) => `${tag},${stem}-${localLabel}`),
      "0FZB,functors-example-functor-quasi-coherent",
      ...ownerEntries.map(({ tag, stem, label }) => `${tag},${stem}-${label}`),
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      theoremCount: 27,
      supportCount: 7,
      curatedSupportCount: 7,
      directDependencyCount: 27,
      explicitProofXrefDependencyCount: 27,
      excludedEnvironmentCounts: expect.objectContaining({ example: 0 }),
    });
    for (const supportCase of supportCases) {
      const supportId = `tag-${supportCase.tag.toLowerCase()}`;
      expect(result.graph.nodes.find(({ id }) => id === supportId)).toMatchObject({
        nodeClass: "support",
        kind: supportCase.kind,
        title: supportCase.title,
        sourceLocator: supportCase.locator,
        sourceTextSha256: supportCase.hash,
      });
      expect(result.graph.directDependencies
        .filter(({ prerequisite }) => prerequisite.id === supportId)
        .map(({ dependentNodeId, role, evidence }) => [
          dependentNodeId,
          role,
          evidence.note.match(/^\d+/u)?.[0],
        ])
        .sort()).toEqual(Object.entries(supportCase.owners)
          .map(([tag, count]) => [
            `tag-${tag.toLowerCase()}`,
            supportCase.kind,
            String(count),
          ])
          .sort());
      expect(result.graph.directDependencies.some(({ dependentNodeId }) => (
        dependentNodeId === supportId
      ))).toBe(false);
      expect(result.graph.proofRoutes.some(({ theoremNodeId }) => theoremNodeId === supportId))
        .toBe(false);
    }
    expect(result.graph.nodes.find(({ id }) => id === "tag-0fzc")?.evidence.note)
      .toContain("surrounding example remains excluded");
    expect(result.graph.nodes.find(({ id }) => id === "tag-0f6j")?.evidence.note)
      .toMatch(/0F71.*0F6H.*02LS/u);
    expect(result.graph.nodes.find(({ id }) => id === "tag-08u7")?.evidence.note)
      .toMatch(/008J.*0094.*08L0/u);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0f6p")
      ?.evidence.note).toContain("geometric-point and residue-field");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0fzd")
      ?.evidence.note).toContain("fully faithfulness");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0gck")
      ?.evidence.note).toContain("base-change-for-derived-Hom");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-08uc")
      ?.evidence.note).toContain("obstruction class");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0fzr")
      ?.evidence.note).not.toContain("fully faithfulness");
  });

  it("promotes the extension-by-zero sections claim with explicit and semantic prerequisites", () => {
    const claim = String.raw`\noindent
Note that we have in the situation of
Definition \ref{definition-localize-ringed-site} we have
\begin{equation}
\label{equation-map-lower-shriek-OU-into-module}
\Hom_\mathcal{O}(j_{U!}\mathcal{O}_U, \mathcal{F}) =
\Hom_{\mathcal{O}_U}(\mathcal{O}_U, j_U^*\mathcal{F}) =
\mathcal{F}(U)
\end{equation}
for every $\mathcal{O}$-module $\mathcal{F}$. Namely, the first equality
holds by the adjointness of $j_{U!}$ and $j_U^*$ and the second because
$\Hom_{\mathcal{O}_U}(\mathcal{O}_U, j_U^*\mathcal{F}) =
j_U^*\mathcal{F}(U/U) = \mathcal{F}|_U(U/U) = \mathcal{F}(U)$.`;
    const owner = (label, target) => String.raw`\begin{lemma}
\label{${label}}
The represented-sections identity has the asserted consequence.
\end{lemma}
\begin{proof}
Use Equation \ref{${target}}.
\end{proof}`;
    const prefix = String.raw`\begin{definition}
\label{definition-localize-ringed-site}
The localization of a ringed site at $U$ is fixed.
\end{definition}
\begin{lemma}
\label{lemma-extension-by-zero}
Extension by zero is left adjoint to restriction.
\end{lemma}`.split("\n");
    const sitesModulesOwners = {
      "0934": "lemma-owner-0934",
      "0G1W": "lemma-owner-0g1w",
      "0936": "lemma-owner-0936",
    };
    const sitesModulesContent = [
      ...prefix,
      ...Array.from({ length: 2144 - prefix.length }, () => "% audited padding"),
      ...claim.split("\n"),
      ...Object.values(sitesModulesOwners).map((label) => (
        owner(label, "equation-map-lower-shriek-OU-into-module")
      )),
    ].join("\n");
    const result = extractStacksGraphFromUnits([
      {
        stem: "sites-modules",
        path: "sites-modules.tex",
        title: "Modules on Sites",
        content: sitesModulesContent,
      },
      {
        stem: "sites-cohomology",
        path: "sites-cohomology.tex",
        title: "Cohomology on Sites",
        content: owner(
          "lemma-owner-0g21",
          "sites-modules-equation-map-lower-shriek-OU-into-module",
        ),
      },
    ], [
      "04IX,sites-modules-definition-localize-ringed-site",
      "03DI,sites-modules-lemma-extension-by-zero",
      "0G1V,sites-modules-equation-map-lower-shriek-OU-into-module",
      ...Object.entries(sitesModulesOwners)
        .map(([tag, label]) => `${tag},sites-modules-${label}`),
      "0G21,sites-cohomology-lemma-owner-0g21",
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.graph.nodes.find(({ id }) => id === "tag-0g1v")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      title: "Sections represented by extension-by-zero of the structure module",
      sourceLocator: "sites-modules.tex:L2145-L2157",
      sourceTextSha256: "433c4b00fa7a5dea5cb4a1ea87cf422eb3193a5f92be9bff0c6c1e2e86f282b8",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-0g1v")
      .map(({ prerequisite, role }) => [prerequisite.id, role])
      .sort()).toEqual([
        ["tag-03di", "logical"],
        ["tag-04ix", "definition"],
      ]);
    expect(result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === "tag-0g1v")
      .map(({ dependentNodeId }) => dependentNodeId)
      .sort()).toEqual(["tag-0934", "tag-0936", "tag-0g1w", "tag-0g21"]);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0g1v"))
      .toMatchObject({
        dependencyIds: ["dep-tag-0g1v-to-tag-04ix", "dep-tag-0g1v-to-tag-03di"],
      });
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0g1v")
      ?.evidence.note).toContain("mutually inverse");
    expect(result.stats).toMatchObject({
      curatedClaimCount: 1,
      curatedClaimDependencyCount: 1,
      explicitProofXrefDependencyCount: 5,
      directDependencyCount: 6,
    });
    expect(result.graph.references).toHaveLength(0);
  });

  it("promotes the exact bivariant restriction remark without retaining it as excluded", () => {
    const restrictionRemark = String.raw`\begin{remark}
\label{remark-restriction-bivariant}
Let $(S, \delta)$ be as in Situation \ref{situation-setup}. Let $X \to Y$
and $Y' \to Y$ be morphisms of schemes locally of finite type over $S$.
Let $X' = Y' \times_Y X$. Then there is an obvious restriction map
$$
A^p(X \to Y) \longrightarrow A^p(X' \to Y'),\quad
c \longmapsto res(c)
$$
obtained by viewing a scheme $Y''$ locally of finite type over $Y'$
as a scheme locally of finite type over $Y$ and setting
$res(c) \cap \alpha'' = c \cap \alpha''$ for any $\alpha'' \in \CH_k(Y'')$.
This restriction operation is compatible with compositions in an
obvious manner.
\end{remark}`;
    const owner = (label) => String.raw`
\begin{lemma}
\label{${label}}
The construction is compatible with the desired operation.
\end{lemma}
\begin{proof}
Use Remark \ref{remark-restriction-bivariant}.
\end{proof}`;
    const ownerLabelsByTag = {
      "0GUC": "lemma-envelope-bivariant",
      "0GUD": "lemma-defined-by-envelope",
      "0FAU": "lemma-localized-chern-pre-independent",
      "0FBK": "lemma-construction-gysin",
      "0FEB": "lemma-relation-normal-cones",
      "0FF2": "lemma-lci-gysin-well-defined",
      "0FBT": "proposition-compute-bivariant",
      "0FC1": "lemma-associative",
      "0FCA": "lemma-associative-dim-1",
    };
    const content = [
      ...Array.from({ length: 6182 }, () => "% audited padding"),
      ...restrictionRemark.split("\n"),
      String.raw`\begin{remark}
\label{remark-unpromoted-control}
This ordinary remark remains outside the graph.
\end{remark}`,
      ...Object.values(ownerLabelsByTag).map(owner),
    ].join("\n");
    const result = extractStacksGraphFromUnits([{
      stem: "chow",
      path: "chow.tex",
      title: "Chow Homology and Bivariant Classes",
      content,
    }], [
      "0F9Z,chow-remark-restriction-bivariant",
      ...Object.entries(ownerLabelsByTag).map(([tag, label]) => `${tag},chow-${label}`),
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      theoremCount: 9,
      supportCount: 1,
      curatedSupportCount: 1,
      directDependencyCount: 9,
      explicitProofXrefDependencyCount: 9,
      excludedEnvironmentCounts: expect.objectContaining({ remark: 1 }),
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-0f9z")).toMatchObject({
      nodeClass: "support",
      kind: "construction",
      sourceLocator: "chow.tex:L6183-L6197",
      sourceTextSha256: "888b71fcbbfdd0c9ed4e4e74893942ee244047c458f34d73dea9fad14d118046",
    });
    expect(result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === "tag-0f9z")
      .map(({ dependentNodeId, role }) => [dependentNodeId, role])
      .sort()).toEqual(Object.keys(ownerLabelsByTag)
        .map((tag) => [`tag-${tag.toLowerCase()}`, "construction"])
        .sort());
    expect(result.graph.proofRoutes.some(({ theoremNodeId }) => theoremNodeId === "tag-0f9z"))
      .toBe(false);
    expect(result.graph.nodes.some(({ sourceXmlId }) => (
      sourceXmlId === "chow-remark-unpromoted-control"
    ))).toBe(false);
  });

  it("promotes the audited successive-blowup reduction with its complete owner inventory", () => {
    const claim = String.raw`\begin{remark}
\label{remark-successive-blowups}
Let $S$ be a quasi-compact and quasi-separated scheme. Let $f : X \to S$
be a morphism of schemes. Let $\mathcal{F}$ be a quasi-coherent module on $X$.
Let $U \subset S$ be a quasi-compact open subscheme. Given a $U$-admissible
blowup $S' \to S$ we denote $X'$ the strict transform of $X$ and $\mathcal{F}'$
the strict transform of $\mathcal{F}$ which we think of as a quasi-coherent
module on $X'$ (via Divisors, Lemma \ref{divisors-lemma-strict-transform}).
Let $P$ be a property of $\mathcal{F}/X/S$ which is stable under strict
transform (as above) for $U$-admissible blowups. The general problem in
this section is: Show (under auxiliary conditions on $\mathcal{F}/X/S$)
there exists a $U$-admissible blowup $S' \to S$
such that the strict transform $\mathcal{F}'/X'/S'$ has $P$.

\medskip\noindent
The general strategy will be to use that a composition of
$U$-admissible blowups is a $U$-admissible blowup, see
Divisors, Lemma \ref{divisors-lemma-composition-admissible-blowups}.
In fact, we will make use of the more precise
Divisors, Lemma \ref{divisors-lemma-composition-finite-type-blowups}
and combine it with
Divisors, Lemma \ref{divisors-lemma-strict-transform-composition-blowups}.
The result is that it suffices to find a sequence of $U$-admissible
blowups
$$
S = S_0 \leftarrow S_1 \leftarrow \ldots \leftarrow S_n
$$
such that, setting $\mathcal{F}_0 = \mathcal{F}$ and $X_0 = X$ and setting
$\mathcal{F}_i/X_i$ equal to the strict transform of
$\mathcal{F}_{i - 1}/X_{i - 1}$, we
arrive at $\mathcal{F}_n/X_n/S_n$ with property $P$.

\medskip\noindent
In particular, choose a finite type quasi-coherent sheaf of ideals
$\mathcal{I} \subset \mathcal{O}_S$ such that $V(\mathcal{I}) = S \setminus U$,
see Properties, Lemma \ref{properties-lemma-quasi-coherent-finite-type-ideals}.
Let $S' \to S$ be the blowup in $\mathcal{I}$ and let $E \subset S'$
be the exceptional divisor (Divisors, Lemma
\ref{divisors-lemma-blowing-up-gives-effective-Cartier-divisor}).
Then we see that we've reduced the
problem to the case where there exists an effective Cartier divisor
$D \subset S$ whose support is $X \setminus U$. In particular we may
assume $U$ is scheme theoretically dense in $S$
(Divisors, Lemma \ref{divisors-lemma-complement-effective-Cartier-divisor}).

\medskip\noindent
Suppose that $P$ is local on $S$: If $S = \bigcup S_i$ is a finite open
covering by quasi-compact opens and $P$ holds for
$\mathcal{F}_{S_i}/X_{S_i}/S_i$ then $P$ holds for $\mathcal{F}/X/S$.
In this case the general problem above is local on $S$ as well, i.e.,
if given $s \in S$ we can find a quasi-compact open neighbourhood $W$ of $s$
such that the problem for $\mathcal{F}_W/X_W/W$ is solvable, then the
problem is solvable for $\mathcal{F}/X/S$. This follows from
Divisors, Lemmas \ref{divisors-lemma-extend-admissible-blowups} and
\ref{divisors-lemma-dominate-admissible-blowups}.
\end{remark}`;
    const formalLemma = (label) => String.raw`\begin{lemma}
\label{${label}}
The audited prerequisite holds.
\end{lemma}`;
    const owner = (environment, label, occurrenceCount) => String.raw`
\begin{${environment}}
\label{${label}}
The reduction gives the desired result.
\end{${environment}}
\begin{proof}
${Array.from({ length: occurrenceCount }, () => (
    String.raw`Use Remark \ref{remark-successive-blowups}.`
  )).join(" ")}
\end{proof}`;
    const ownerLabelsByTag = {
      "0811": ["lemma", "lemma-flatten-module-pre", 3],
      "0814": ["lemma", "lemma-flatten-module-etale-localize", 2],
      "0815": ["theorem", "theorem-flatten-module", 1],
      "081R": ["lemma", "lemma-flat-after-blowing-up", 1],
      "081S": ["lemma", "lemma-zariski-after-blowup", 1],
      "081T": ["lemma", "lemma-dominate-modification-by-blowup", 1],
      "0ETR": ["lemma", "lemma-equivalence-h-v-locally-finite-presentation", 1],
      "0ETT": ["lemma", "lemma-Noetherian-h-covering", 1],
    };
    const flatContent = [
      ...Array.from({ length: 8609 }, () => "% audited padding"),
      ...claim.split("\n"),
      String.raw`\begin{remark}
\label{remark-unpromoted-control}
This ordinary remark remains excluded.
\end{remark}`,
      ...Object.values(ownerLabelsByTag).map((args) => owner(...args)),
    ].join("\n");
    const result = extractStacksGraphFromUnits([
      {
        stem: "properties",
        path: "properties.tex",
        title: "Properties of Schemes",
        content: formalLemma("lemma-quasi-coherent-finite-type-ideals"),
      },
      {
        stem: "divisors",
        path: "divisors.tex",
        title: "Divisors",
        content: [
          "lemma-strict-transform",
          "lemma-composition-admissible-blowups",
          "lemma-composition-finite-type-blowups",
          "lemma-strict-transform-composition-blowups",
          "lemma-blowing-up-gives-effective-Cartier-divisor",
          "lemma-complement-effective-Cartier-divisor",
          "lemma-extend-admissible-blowups",
          "lemma-dominate-admissible-blowups",
        ].map(formalLemma).join("\n"),
      },
      {
        stem: "flat",
        path: "flat.tex",
        title: "More on Flatness",
        content: flatContent,
      },
    ], [
      "01PH,properties-lemma-quasi-coherent-finite-type-ideals",
      "080E,divisors-lemma-strict-transform",
      "080L,divisors-lemma-composition-admissible-blowups",
      "080B,divisors-lemma-composition-finite-type-blowups",
      "080I,divisors-lemma-strict-transform-composition-blowups",
      "02OS,divisors-lemma-blowing-up-gives-effective-Cartier-divisor",
      "07ZU,divisors-lemma-complement-effective-Cartier-divisor",
      "080M,divisors-lemma-extend-admissible-blowups",
      "080N,divisors-lemma-dominate-admissible-blowups",
      "080Y,flat-remark-successive-blowups",
      ...Object.entries(ownerLabelsByTag).map(([tag, [, label]]) => `${tag},flat-${label}`),
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    const prerequisiteIds = [
      "tag-080e", "tag-080l", "tag-080b", "tag-080i", "tag-01ph",
      "tag-02os", "tag-07zu", "tag-080m", "tag-080n",
    ].sort();
    expect(result.graph.nodes.find(({ id }) => id === "tag-080y")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      title: "Successive admissible-blowup reductions",
      sourceLocator: "flat.tex:L8610-L8665",
      sourceTextSha256: "f7df6d2fb4c463e5883419506cb03224f4e355f4262e2255bb2419215ea5c3a1",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-080y")
      .map(({ prerequisite }) => prerequisite.id)
      .sort()).toEqual(prerequisiteIds);
    expect(result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === "tag-080y")
      .map(({ dependentNodeId }) => dependentNodeId)
      .sort()).toEqual(Object.keys(ownerLabelsByTag)
        .map((tag) => `tag-${tag.toLowerCase()}`)
        .sort());
    expect(result.graph.directDependencies.find(({ id }) => (
      id === "dep-tag-0811-to-tag-080y"
    ))?.evidence.note).toContain("3 explicit proof reference occurrence(s)");
    expect(result.graph.directDependencies.find(({ id }) => (
      id === "dep-tag-0814-to-tag-080y"
    ))?.evidence.note).toContain("2 explicit proof reference occurrence(s)");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-080y")
      ?.dependencyIds.sort()).toEqual(prerequisiteIds.map((id) => `dep-tag-080y-to-${id}`));
    expect(result.stats).toMatchObject({
      curatedClaimCount: 1,
      excludedEnvironmentCounts: expect.objectContaining({ remark: 1 }),
    });
    expect(result.graph.references).toHaveLength(0);
  });

  it("promotes arbitrary-category simplicial homotopy as a claim with functoriality", () => {
    const claim = String.raw`\begin{remark}
\label{remark-homotopy-better}
Let $\mathcal{C}$ be any category (no assumptions whatsoever). Let
$U$ and $V$ be simplicial objects of $\mathcal{C}$. Let $a, b : U \to V$
be morphisms of simplicial objects of $\mathcal{C}$. A
{\it homotopy from $a$ to $b$} is given by
morphisms\footnote{In the literature, often the maps
$h_{n + 1, i} \circ s_i : U_n \to V_{n + 1}$ are used instead
of the maps $h_{n, i}$. Of course the relations these maps satisfy
are different from the ones in Lemma \ref{lemma-relations-homotopy}.}
$h_{n, i} : U_n \to V_n$, for $n \geq 0$, $i = 0, \ldots, n + 1$
satisfying the relations of Lemma \ref{lemma-relations-homotopy}.
As in Definition \ref{definition-homotopy} we say the morphisms $a$ and $b$
are {\it homotopic} if there exists a sequence of morphisms
$a = a_0, a_1, \ldots, a_n = b$ from $U$ to $V$ such that for each
$i = 1, \ldots, n$ there either exists a homotopy from $a_{i - 1}$ to $a_i$
or there exists a homotopy from $a_i$ to $a_{i - 1}$.
Clearly, if $F : \mathcal{C} \to \mathcal{C}'$ is any functor
and $\{h_{n, i}\}$ is a homotopy from $a$ to $b$, then
$\{F(h_{n, i})\}$ is a homotopy from $F(a)$ to $F(b)$.
Similarly, if $a$ and $b$ are homotopic, then $F(a)$ and $F(b)$
are homotopic.
Since the lemma says that the newer notion is the same
as the old one in case finite coproduct exist, we deduce
in particular that functors preserve the original notion
whenever both categories have finite coproducts.
\end{remark}`;
    const owner = (label, target = "remark-homotopy-better") => String.raw`
\begin{lemma}
\label{${label}}
The homotopy construction has the asserted consequence.
\end{lemma}
\begin{proof}
Use Remark \ref{${target}}.
\end{proof}`;
    const prefix = String.raw`\begin{definition}
\label{definition-homotopy}
Homotopy is defined using the simplicial interval.
\end{definition}

\begin{lemma}
\label{lemma-relations-homotopy}
The component maps characterize a simplicial homotopy.
\end{lemma}`.split("\n");
    const simplicialOwners = {
      "019P": "lemma-fibre-products-simplicial-object-w-section",
      "08Q4": "lemma-products-homotopy",
      "019X": "lemma-compare-homotopies",
      "019Y": "lemma-functorial-homotopy",
      "0G5R": "lemma-godement-two-maps",
      "0G5S": "lemma-godement-before-after",
    };
    const crossOwners = {
      "08Q9": ["sites-cohomology", "lemma-compute-by-cosimplicial-resolution"],
      "09W5": ["spaces-simplicial", "lemma-simplicial-resolution-Z"],
      "09WI": ["spaces-simplicial", "lemma-simplicial-resolution-Z-site"],
      "0D9B": ["spaces-simplicial", "lemma-simplicial-resolution-ringed"],
    };
    const simplicialContent = [
      ...prefix,
      ...Array.from({ length: 4518 - prefix.length }, () => "% audited padding"),
      ...claim.split("\n"),
      String.raw`\begin{remark}
\label{remark-unpromoted-control}
This ordinary remark remains excluded.
\end{remark}`,
      ...Object.values(simplicialOwners).map((label) => owner(label)),
    ].join("\n");
    const crossUnit = (stem) => ({
      stem,
      path: `${stem}.tex`,
      title: stem,
      content: Object.values(crossOwners)
        .filter(([ownerStem]) => ownerStem === stem)
        .map(([, label]) => owner(label, "simplicial-remark-homotopy-better"))
        .join("\n"),
    });
    const result = extractStacksGraphFromUnits([
      {
        stem: "simplicial",
        path: "simplicial.tex",
        title: "Simplicial Methods",
        content: simplicialContent,
      },
      crossUnit("sites-cohomology"),
      crossUnit("spaces-simplicial"),
    ], [
      "019K,simplicial-definition-homotopy",
      "019L,simplicial-lemma-relations-homotopy",
      "019M,simplicial-remark-homotopy-better",
      ...Object.entries(simplicialOwners).map(([tag, label]) => `${tag},simplicial-${label}`),
      ...Object.entries(crossOwners).map(([tag, [stem, label]]) => `${tag},${stem}-${label}`),
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    const expectedOwnerIds = [
      ...Object.keys(simplicialOwners),
      ...Object.keys(crossOwners),
    ].map((tag) => `tag-${tag.toLowerCase()}`).sort();
    expect(result.graph.nodes.find(({ id }) => id === "tag-019m")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      title: "Componentwise simplicial homotopy and functoriality",
      sourceLocator: "simplicial.tex:L4519-L4545",
      sourceTextSha256: "d651d6ec33fedd7b753489405702c8c75d9695a6cf56717fa95bdcf9dd688b7b",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-019m")
      .map(({ prerequisite }) => prerequisite.id)
      .sort()).toEqual(["tag-019k", "tag-019l"]);
    expect(result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === "tag-019m")
      .map(({ dependentNodeId }) => dependentNodeId)
      .sort()).toEqual(expectedOwnerIds);
    expect(result.graph.directDependencies.find(({ id }) => (
      id === "dep-tag-019m-to-tag-019l"
    ))?.evidence.note).toContain("2 explicit proof reference occurrence(s)");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-019m")
      ?.dependencyIds.sort()).toEqual([
        "dep-tag-019m-to-tag-019k",
        "dep-tag-019m-to-tag-019l",
      ]);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-08q4")
      ?.dependencyIds).toEqual(["dep-tag-08q4-to-tag-019m"]);
    expect(result.stats).toMatchObject({
      curatedClaimCount: 1,
      excludedEnvironmentCounts: expect.objectContaining({ remark: 1 }),
    });
    expect(result.graph.references).toHaveLength(0);
  });

  it("promotes the relative-dualizing claim and preserves aggregate trace-section debt", () => {
    const claim = String.raw`\begin{remark}
\label{remark-relative-dualizing-complex}
Let $Y$ be a quasi-compact and quasi-separated scheme.
Let $f : X \to Y$ be a proper, flat morphism of finite presentation.
Let $a$ be the adjoint of Lemma \ref{lemma-twisted-inverse-image} for $f$.
In this situation, $\omega_{X/Y}^\bullet = a(\mathcal{O}_Y)$
is sometimes called the {\it relative dualizing complex}. By
Lemma \ref{lemma-compare-with-pullback-flat-proper}
there is a functorial isomorphism
$a(K) = Lf^*K \otimes_{\mathcal{O}_X}^\mathbf{L} \omega_{X/Y}^\bullet$
for $K \in D_\QCoh(\mathcal{O}_Y)$. Moreover, the trace map
$$
\text{Tr}_{f, \mathcal{O}_Y} : Rf_*\omega_{X/Y}^\bullet \to \mathcal{O}_Y
$$
of Section \ref{section-trace} induces the trace map for all $K$
in $D_\QCoh(\mathcal{O}_Y)$. More precisely the diagram
$$
\xymatrix{
Rf_*a(K) \ar[rrr]_{\text{Tr}_{f, K}} \ar@{=}[d] & & &
K \ar@{=}[d] \\
Rf_*(Lf^*K \otimes_{\mathcal{O}_X}^\mathbf{L} \omega_{X/Y}^\bullet)
\ar@{=}[r] &
K \otimes_{\mathcal{O}_Y}^\mathbf{L} Rf_*\omega_{X/Y}^\bullet
\ar[rr]^-{\text{id}_K \otimes \text{Tr}_{f, \mathcal{O}_Y}} & & K
}
$$
where the equality on the lower right is
Derived Categories of Schemes, Lemma \ref{perfect-lemma-cohomology-base-change}.
If $g : Y' \to Y$ is a
morphism of quasi-compact and quasi-separated schemes
and $X' = Y' \times_Y X$, then by
Lemma \ref{lemma-proper-flat-base-change} we have
$\omega_{X'/Y'}^\bullet = L(g')^*\omega_{X/Y}^\bullet$ where $g' : X' \to X$
is the projection and by Lemma \ref{lemma-trace-map-and-base-change}
the trace map
$$
\text{Tr}_{f', \mathcal{O}_{Y'}} :
Rf'_*\omega_{X'/Y'}^\bullet \to \mathcal{O}_{Y'}
$$
for $f' : X' \to Y'$ is the base change of $\text{Tr}_{f, \mathcal{O}_Y}$
via the base change isomorphism.
\end{remark}`;
    const formalLemma = (label) => String.raw`\begin{lemma}
\label{${label}}
The audited prerequisite holds.
\end{lemma}`;
    const owner = (
      label,
      occurrenceCount,
      target = "remark-relative-dualizing-complex",
      extraProofText = "",
    ) => (
      String.raw`
\begin{lemma}
\label{${label}}
The relative-duality conclusion holds.
\end{lemma}
\begin{proof}
${Array.from({ length: occurrenceCount }, () => (
    String.raw`Use Remark \ref{${target}}.`
  )).join(" ")} ${extraProofText}
\end{proof}`
    );
    const dualityOwners = {
      "0E4L": ["lemma-properties-relative-dualizing", 1, "Apply the Yoneda lemma."],
      "0BRT": ["lemma-smooth-proper", 1],
      "0FVV": ["lemma-duality-proper-over-field", 1],
      "0FW1": ["lemma-sanity-check-duality", 1],
    };
    const crossOwners = {
      "0G8I": ["derham", "lemma-relative-duality-hodge", 1],
      "0BS2": ["curves", "lemma-duality-dim-1", 1],
      "0E32": ["curves", "lemma-sanity-check-duality", 1],
      "0FYX": ["equiv", "lemma-fourier-mukai-left-adjoint", 1],
      "0FYY": ["equiv", "lemma-fourier-mukai-flat-proper-over-noetherian", 2],
    };
    const prefix = [
      formalLemma("lemma-twisted-inverse-image"),
      formalLemma("lemma-compare-with-pullback-flat-proper"),
      formalLemma("lemma-proper-flat-base-change"),
      formalLemma("lemma-trace-map-and-base-change"),
      String.raw`\section{Trace map}
\label{section-trace}`,
    ].join("\n").split("\n");
    const dualityContent = [
      ...prefix,
      ...Array.from({ length: 2726 - prefix.length }, () => "% audited padding"),
      ...claim.split("\n"),
      String.raw`\begin{remark}
\label{remark-unpromoted-control}
This ordinary remark remains excluded.
\end{remark}`,
      ...Object.values(dualityOwners).map(([label, count, extra]) => owner(
        label,
        count,
        "remark-relative-dualizing-complex",
        extra,
      )),
      String.raw`\begin{lemma}
\label{lemma-section-trigger}
The trace construction is available.
\end{lemma}
\begin{proof}
Use Section \ref{section-trace}.
\end{proof}`,
    ].join("\n");
    const crossUnit = (stem) => ({
      stem,
      path: `${stem}.tex`,
      title: stem,
      content: Object.values(crossOwners)
        .filter(([ownerStem]) => ownerStem === stem)
        .map(([, label, count]) => owner(
          label,
          count,
          "duality-remark-relative-dualizing-complex",
        ))
        .join("\n"),
    });
    const result = extractStacksGraphFromUnits([
      {
        stem: "categories",
        path: "categories.tex",
        title: "Categories",
        content: formalLemma("lemma-yoneda"),
      },
      {
        stem: "perfect",
        path: "perfect.tex",
        title: "Derived Categories of Schemes",
        content: formalLemma("lemma-cohomology-base-change"),
      },
      {
        stem: "duality",
        path: "duality.tex",
        title: "Duality for Schemes",
        content: dualityContent,
      },
      crossUnit("derham"),
      crossUnit("curves"),
      crossUnit("equiv"),
    ], [
      "001P,categories-lemma-yoneda",
      "08EU,perfect-lemma-cohomology-base-change",
      "0A9E,duality-lemma-twisted-inverse-image",
      "0E4K,duality-lemma-compare-with-pullback-flat-proper",
      "0AAB,duality-lemma-proper-flat-base-change",
      "0B6J,duality-lemma-trace-map-and-base-change",
      "0AWG,duality-section-trace",
      "0B6S,duality-remark-relative-dualizing-complex",
      "0ZZ1,duality-lemma-section-trigger",
      ...Object.entries(dualityOwners).map(([tag, [label]]) => `${tag},duality-${label}`),
      ...Object.entries(crossOwners).map(([tag, [stem, label]]) => `${tag},${stem}-${label}`),
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    const prerequisiteIds = [
      "tag-0a9e", "tag-0e4k", "tag-08eu", "tag-0aab", "tag-0b6j", "tag-0awg",
    ].sort();
    const expectedOwnerIds = [
      ...Object.keys(dualityOwners),
      ...Object.keys(crossOwners),
    ].map((tag) => `tag-${tag.toLowerCase()}`).sort();
    expect(result.graph.nodes.find(({ id }) => id === "tag-0b6s")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "claim",
      title: "Relative dualizing complex, trace, and base-change compatibilities",
      sourceLocator: "duality.tex:L2727-L2768",
      sourceTextSha256: "80700177e1bd893b674206641bf9b5f555f30df451f21609f44001f6930c6f61",
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-0b6s")
      .map(({ prerequisite }) => prerequisite.id)
      .sort()).toEqual(prerequisiteIds);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      id: "dep-tag-0b6s-to-tag-0awg",
      dependentNodeId: "tag-0b6s",
      prerequisite: { type: "node", id: "tag-0awg" },
      role: "source-reference",
    }));
    expect(result.graph.nodes.find(({ id }) => id === "tag-0awg")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "section",
    });
    expect(result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === "tag-0b6s")
      .map(({ dependentNodeId }) => dependentNodeId)
      .sort()).toEqual(expectedOwnerIds);
    expect(result.graph.directDependencies.find(({ id }) => (
      id === "dep-tag-0fyy-to-tag-0b6s"
    ))?.evidence.note).toContain("2 explicit proof reference occurrence(s)");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0b6s"))
      .toMatchObject({
        dependencyIds: expect.arrayContaining(prerequisiteIds.map((id) => (
          `dep-tag-0b6s-to-${id}`
        ))),
        evidence: {
          note: expect.stringContaining(
            "classifying, decomposing, or suppressing that occurrence remains route debt",
          ),
        },
      });
    expect(result.graph.nodes.find(({ id }) => id === "tag-0awg")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "section",
      evidence: {
        note: expect.stringContaining(
          "classification, decomposition, or an occurrence-specific nondependency decision remains graph-audit debt",
        ),
      },
    });
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "tag-0b6s",
      ref: "duality-section-trace",
      resolution: expect.objectContaining({
        status: "resolved",
        target: { type: "node", id: "tag-0awg" },
      }),
    }));
    expect(result.stats).toMatchObject({
      curatedClaimCount: 1,
      sourceArtifactCount: 1,
      sourceArtifactKindCounts: { section: 1 },
      excludedEnvironmentCounts: expect.objectContaining({ remark: 1 }),
    });
  });

  it("represents audited Zorn invocations as one shared typed external theorem", () => {
    const conventionLines = Array.from({ length: 30 }, (_, index) => (
      index === 27 ? "We use Zermelo-Fraenkel set theory with the axiom of choice." : ""
    ));
    const result = extractStacksGraphFromUnits([
      {
        stem: "conventions",
        path: "conventions.tex",
        title: "Conventions",
        content: conventionLines.join("\n"),
      },
      {
        stem: "fields",
        path: "fields.tex",
        title: "Fields",
        content: String.raw`
\begin{lemma}
\label{lemma-transcendence-degree}
A transcendence basis exists.
\end{lemma}
\begin{proof}
By Zorn's lemma, the partially ordered collection has a maximal element.
\end{proof}
`,
      },
    ], "030F,fields-lemma-transcendence-degree", { capturedAt });

    expect(result.graph.externalInputs).toEqual([
      expect.objectContaining({
        id: "external-zorns-lemma",
        kind: "external-theorem",
        label: "Zorn's lemma",
      }),
    ]);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-030f",
      prerequisite: { type: "external-input", id: "external-zorns-lemma" },
      role: "logical",
    }));
  });

  it("uses only the audited targets in an exact deictic proof's discussion window", () => {
    const result = extractStacksGraphFromUnits([{
      stem: "examples",
      path: "examples.tex",
      title: "Examples",
      content: String.raw`
\begin{lemma}
\label{lemma-countable-coherent}
The constructed ring is coherent.
\end{lemma}
\begin{proof}
This is direct.
\end{proof}

The construction uses Lemma \ref{lemma-countable-coherent}.

\begin{lemma}
\label{lemma-completion-polynomial-ring-not-flat}
The completion map is not flat.
\end{lemma}
\begin{proof}
See above.
\end{proof}
`,
    }], [
      "0ALB,examples-lemma-countable-coherent",
      "0ALC,examples-lemma-completion-polynomial-ring-not-flat",
    ].join("\n"), { capturedAt });

    expect(result.stats.deicticDependencyCount).toBe(1);
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0alc",
      prerequisite: { type: "node", id: "tag-0alb" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0alc")
      ?.evidence.locator).toContain("L9-L18");
  });

  it("resolves an exact owner-specific section delegation without aliasing the section globally", () => {
    const auditedOwnerAndProof = String.raw`\begin{lemma}
\label{lemma-base-change-monomorphism}
Let $\mathcal{X} \to \mathcal{Y}$ be a morphism of algebraic stacks.
Let $\mathcal{Z} \to \mathcal{Y}$ be a monomorphism.
Then $\mathcal{Z} \times_\mathcal{Y} \mathcal{X} \to \mathcal{X}$
is a monomorphism.
\end{lemma}

\begin{proof}
This follows from the general discussion in
Section \ref{section-properties-morphisms}.
\end{proof}`;
    const unrelatedOwnerAndProof = String.raw`
\begin{lemma}
\label{lemma-unlisted-section-use}
An unrelated assertion uses a different part of the same section.
\end{lemma}
\begin{proof}
Compare Section \ref{section-properties-morphisms}.
\end{proof}`;
    const stacksPropertiesPadding = Array.from({ length: 1429 }, () => "% audited padding");
    stacksPropertiesPadding[0] = String.raw`\section{Properties of morphisms}`;
    stacksPropertiesPadding[1] = String.raw`\label{section-properties-morphisms}`;
    const stacksPropertiesContent = [
      ...stacksPropertiesPadding,
      ...auditedOwnerAndProof.split("\n"),
      ...unrelatedOwnerAndProof.split("\n"),
    ].join("\n");
    const fixtureUnits = [
      {
        stem: "algebraic",
        path: "algebraic.tex",
        title: "Algebraic Stacks",
        content: String.raw`
\begin{lemma}
\label{lemma-base-change-representable-transformations-property}
Representable properties are preserved by base change.
\end{lemma}
`,
      },
      {
        stem: "stacks-properties",
        path: "stacks-properties.tex",
        title: "Properties of Stacks",
        content: stacksPropertiesContent,
      },
    ];
    const fixtureTags = [
      "045C,algebraic-lemma-base-change-representable-transformations-property",
      "04XB,stacks-properties-section-properties-morphisms",
      "04ZX,stacks-properties-lemma-base-change-monomorphism",
      "0ZZZ,stacks-properties-lemma-unlisted-section-use",
    ].join("\n");

    const result = extractStacksGraphFromUnits(fixtureUnits, fixtureTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      sectionDelegationDependencyCount: 1,
      curatedResolvedSectionProofXrefCount: 1,
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-04zx",
      prerequisite: { type: "node", id: "tag-045c" },
    }));
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-04zx")
      ?.dependencyIds).toEqual(["dep-tag-04zx-to-tag-045c"]);
    expect(result.graph.references.some(({ ownerNodeId }) => ownerNodeId === "tag-04zx"))
      .toBe(false);
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "tag-0zzz",
      ref: "stacks-properties-section-properties-morphisms",
      resolution: expect.objectContaining({
        status: "resolved",
        target: { type: "node", id: "tag-04xb" },
      }),
    }));
    expect(result.graph.nodes.find(({ id }) => id === "tag-04xb")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "section",
    });
    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "tag-0zzz",
      prerequisite: { type: "node", id: "tag-04xb" },
      role: "source-reference",
    }));
    expect(result.graph.directDependencies.some(({ dependentNodeId, prerequisite }) => (
      dependentNodeId === "tag-04zx" && prerequisite.id === "tag-04xb"
    ))).toBe(false);

    const changedUnits = fixtureUnits.map((unit) => (
      unit.stem === "stacks-properties"
        ? { ...unit, content: unit.content.replace("general discussion", "discussion") }
        : unit
    ));
    expect(() => extractStacksGraphFromUnits(changedUnits, fixtureTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    })).toThrow(/section-delegation proof 04ZX changed/u);
  });

  it("promotes the audited item support batch with exact owner inventories", () => {
    const sparseUnit = (stem, length, placements) => {
      const lines = Array(length).fill("% audited padding");
      for (const [startLine, rawSpan] of placements) {
        rawSpan.split("\n").forEach((line, index) => {
          lines[startLine - 1 + index] = line;
        });
      }
      return {
        stem,
        path: `${stem}.tex`,
        title: stem,
        content: lines.join("\n"),
      };
    };
    const lemma = (label) => String.raw`\begin{lemma}
\label{${label}}
Audited owner statement.
\end{lemma}`;
    const resultUnits = [
      sparseUnit("more-etale", 1460, [
        [833, String.raw`\item
\label{item-sum}
$(Z, s) + (Z, s') = (Z, s + s')$,
\item
\label{item-sub}
$(Z, s) = (Z', s)$ if $Z \subset Z'$.`],
        [930, lemma("lemma-finite-support-stalk")],
        [940, String.raw`\begin{proof}`],
        [963, String.raw`maps and that the relations (\ref{item-sum}) $(Z, s) + (Z, s') - (Z, s + s')$`],
        [964, String.raw`and (\ref{item-sub}) $(Z, s) - (Z', s)$ if $Z \subset Z'$ are sent to zero.`],
        [1022, String.raw`(\ref{item-sum}) and (\ref{item-sub}) to replace $s$ by`],
        [1043, String.raw`Thus by the relation (\ref{item-sub})`],
        [1050, String.raw`\end{proof}`],
        [1320, lemma("lemma-lqf-base-change-f-shriek")],
        [1330, String.raw`\begin{proof}`],
        [1363, String.raw`(\ref{item-sum}) and (\ref{item-sub}) and compatible`],
        [1380, String.raw`\end{proof}`],
        [1400, lemma("lemma-lqf-separated-shriek-composition")],
        [1410, String.raw`\begin{proof}`],
        [1450, String.raw`(\ref{item-sum}) and (\ref{item-sub})`],
        [1460, String.raw`\end{proof}`],
      ]),
      sparseUnit("derham", 3670, [
        [3230, String.raw`\item
\label{item-degree-zero}
$c_{Y/X}^0(1) = \delta(\NL_{Y/X})$ see
Discriminants, Section \ref{discriminant-section-tate-map},
\item
\label{item-multiplicative}
$c_{Y/X}^{q + p}(\omega \wedge \eta) = \omega \wedge c_{Y/X}^p(\eta)$
for local sections $\omega$ of $f^*\Omega^q_{X/\mathbf{Z}}$
and $\eta$ of $\Omega^p_{Y/\mathbf{Z}}$,`],
        [3400, lemma("lemma-base-change-Garel-upstairs")],
        [3440, String.raw`\begin{proof}`],
        [3463, String.raw`is surjective. Conditions (\ref{item-degree-zero}) and`],
        [3464, String.raw`(\ref{item-multiplicative}) combined with the commutativity`],
        [3470, String.raw`\end{proof}`],
        [3515, lemma("lemma-Garel-upstairs")],
        [3540, String.raw`\begin{proof}`],
        [3555, String.raw`with properties (\ref{item-degree-zero}) and (\ref{item-multiplicative}),`],
        [3571, String.raw`with properties (\ref{item-degree-zero}) and (\ref{item-multiplicative}).`],
        [3597, String.raw`$c^p_{Y/X}$, $p \geq 0$ satisfying conditions (\ref{item-degree-zero})`],
        [3598, String.raw`and (\ref{item-multiplicative}). If $b/a : Y'/X' \to Y/X$`],
        [3615, String.raw`maps $c^p_{Y'/X'}$, $p \geq 0$  satisfying conditions (\ref{item-degree-zero})`],
        [3616, String.raw`and (\ref{item-multiplicative}) compatible with the already constructed`],
        [3662, String.raw`(\ref{item-degree-zero}) and (\ref{item-multiplicative}).`],
        [3670, String.raw`\end{proof}`],
      ]),
      sparseUnit("more-algebra", 19220, [
        [18384, String.raw`\item
\label{item-shift-tensor}
There is a canonical isomorphism
$$
\text{Tot}(M^\bullet \otimes_R N^\bullet)[a + b] \to
\text{Tot}(M^\bullet[a] \otimes_R N^\bullet[b])
$$
which uses the sign $(-1)^{pb}$ on the summand $M^p \otimes_R N^q$,
see Homology, Remark \ref{homology-remark-shift-double-complex}. It
is often more convenient to consider the corresponding shifted map
$\text{Tot}(M^\bullet \otimes_R N^\bullet) \to
\text{Tot}(M^\bullet[a] \otimes_R N^\bullet[b])[-a - b]$.`],
        [18532, String.raw`\item
\label{item-compatible}
The choice above is such that if $M^\bullet$ has a left
dual $N^\bullet$ as in Lemma \ref{lemma-left-dual-complex},
then we have a canonical isomorphism
$$
\text{Tot}(K^\bullet \otimes_R N^\bullet)
\longrightarrow
\Hom^\bullet(M^\bullet, K^\bullet)
$$
defined without the intervention of signs sending the summand
$K^p \otimes_R N^q$ to the summand $\Hom_R(M^{-q}, K^p)$
via $N^q = \Hom_R(M^{-q}, R)$ and the canonical map
$K^p \otimes_R \Hom_R(M^{-q}, R) \to \Hom_R(M^{-q}, K^p)$.`],
        [19175, lemma("lemma-dual-perfect-complex")],
        [19190, String.raw`\begin{proof}`],
        [19213, String.raw`By Section \ref{section-sign-rules} item (\ref{item-compatible})`],
        [19220, String.raw`\end{proof}`],
      ]),
      sparseUnit("cohomology", 7264, [
        [7214, lemma("lemma-second-cup-equals-first")],
        [7220, String.raw`\begin{proof}`],
        [7240, String.raw`More on Algebra, Item (\ref{more-algebra-item-shift-tensor})`],
        [7264, String.raw`\end{proof}`],
      ]),
    ];
    const resultTags = [
      "0F6K,more-etale-item-sum",
      "0F6L,more-etale-item-sub",
      "0F6P,more-etale-lemma-finite-support-stalk",
      "0F5J,more-etale-lemma-lqf-base-change-f-shriek",
      "0F79,more-etale-lemma-lqf-separated-shriek-composition",
      "0H9C,derham-item-degree-zero",
      "0H9D,derham-item-multiplicative",
      "0H9G,derham-lemma-base-change-Garel-upstairs",
      "0FLA,derham-lemma-Garel-upstairs",
      "0FNH,more-algebra-item-shift-tensor",
      "0FNL,more-algebra-item-compatible",
      "07VI,more-algebra-lemma-dual-perfect-complex",
      "0FP2,cohomology-lemma-second-cup-equals-first",
    ].join("\n");
    const result = extractStacksGraphFromUnits(resultUnits, resultTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    const expectedSupports = [
      ["0F6K", "construction", "more-etale.tex:L833-L835", "a8083e56b7c5743ad707da713435b5e1952867ae43ba2bee857cef98df30bfd3", { "0F6P": 2, "0F5J": 1, "0F79": 1 }],
      ["0F6L", "construction", "more-etale.tex:L836-L838", "2240b1942b521183a9a70cfdc60e3da7031a91dfd7c8ba6580fce5a6945a7c27", { "0F6P": 3, "0F5J": 1, "0F79": 1 }],
      ["0H9C", "definition", "derham.tex:L3230-L3233", "7ffd73f0087f0d245adff1275ea16532769d0ded0e0c31125ad3e9e514525e21", { "0H9G": 1, "0FLA": 5 }],
      ["0H9D", "definition", "derham.tex:L3234-L3238", "6cecbaae66743545770abc9c0d92ab5545fc20d85b9de6510572c7e6eed958bb", { "0H9G": 1, "0FLA": 5 }],
      ["0FNH", "construction", "more-algebra.tex:L18384-L18395", "33114700942851fecab52ffd651d4648922766b521bce150885665a9f6c9638d", { "0FP2": 1 }],
      ["0FNL", "construction", "more-algebra.tex:L18532-L18545", "035e8a2d0b5fa90aad787b77674be7fba6f7a336f0153a9052fc1d3ce9861df4", { "07VI": 1 }],
    ];
    for (const [tag, kind, sourceLocator, sourceTextSha256, owners] of expectedSupports) {
      const supportId = `tag-${tag.toLowerCase()}`;
      expect(result.graph.nodes.find(({ id }) => id === supportId)).toMatchObject({
        nodeClass: "support",
        kind,
        sourceLocator,
        sourceTextSha256,
      });
      expect(result.graph.directDependencies
        .filter(({ prerequisite }) => prerequisite.id === supportId)
        .map(({ dependentNodeId, role, evidence }) => [
          dependentNodeId.slice(4).toUpperCase(),
          role,
          Number(evidence.note.match(/^\d+/u)?.[0]),
        ])
        .sort()).toEqual(Object.entries(owners)
          .map(([ownerTag, count]) => [ownerTag, kind, count])
          .sort());
      expect(result.graph.proofRoutes.some(({ theoremNodeId }) => theoremNodeId === supportId))
        .toBe(false);
    }
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0h9g")
      ?.dependencyIds.sort()).toEqual([
      "dep-tag-0h9g-to-tag-0h9c",
      "dep-tag-0h9g-to-tag-0h9d",
    ]);
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0fp2")
      ?.dependencyIds).toEqual(["dep-tag-0fp2-to-tag-0fnh"]);
    expect(result.graph.nodes.find(({ id }) => id === "tag-0fnh")?.evidence.note)
      .toContain("Remark Tag 0FLG");
    expect(result.stats).toMatchObject({
      curatedSupportCount: 6,
      supportCount: 6,
      explicitProofXrefDependencyCount: 12,
    });
    expect(result.graph.references).toHaveLength(0);

    const changedUnits = resultUnits.map((unit) => (
      unit.stem === "more-etale"
        ? { ...unit, content: unit.content.replace("maps and that the relations", "maps and also that the relations") }
        : unit
    ));
    expect(() => extractStacksGraphFromUnits(changedUnits, resultTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    })).toThrow(/support 0F6K incoming occurrence artifacts changed/u);
  });

  it("promotes the audited item claims with guarded routes, debt, and goal suppressions", () => {
    const sparseUnit = (stem, length, placements) => {
      const lines = Array(length).fill("% audited padding");
      for (const [startLine, rawSpan] of placements) {
        rawSpan.split("\n").forEach((line, index) => {
          lines[startLine - 1 + index] = line;
        });
      }
      return {
        stem,
        path: `${stem}.tex`,
        title: stem,
        content: lines.join("\n"),
      };
    };
    const lemma = (label) => String.raw`\begin{lemma}
\label{${label}}
Audited theorem statement.
\end{lemma}`;
    const claimUnits = [
      sparseUnit("chow", 12710, [
        [640, lemma("lemma-prepare-tame-symbol")],
        [781, String.raw`\item $\partial_A(aa', b) = \partial_A(a, b)\partial_A(a', b)$
\label{item-bilinear-better}
and $\partial_A(a, bb') = \partial_A(a, b)\partial_A(a, b')$
for $a, a', b, b' \in A$ nonzerodivisors,`],
        [785, String.raw`\item $\partial_A(b, b) = (-1)^m$
\label{item-skew-better}
with $m = \text{length}_A(A/bA)$
for $b \in A$ a nonzerodivisor,`],
        [789, String.raw`\item $\partial_A(u, b) = u^m \bmod \mathfrak m$
\label{item-normalization}
with $m = \text{length}_A(A/bA)$ for $u \in A$ a unit and
$b \in A$ a nonzerodivisor, and`],
        [793, String.raw`\item
\label{item-1-x-better}
$\partial_A(a, b - a)\partial_A(b, b) = \partial_A(b, b - a)\partial_A(a, b)$
for $a, b \in A$ such that $a, b, b - a$ are nonzerodivisors.`],
        [901, lemma("lemma-tame-symbol")],
        [910, String.raw`\begin{proof}`],
        [911, String.raw`Let us prove (\ref{item-bilinear-better}).
Let $a_1, a_2, a_3 \in A$ be nonzerodivisors.
Choose $A \subset B$ as in Lemma \ref{lemma-prepare-tame-symbol}
for $a_1, a_2, a_3$. Then the equality
$$
\partial_A(a_1a_2, a_3) = \partial_A(a_1, a_3) \partial_A(a_2, a_3)
$$
follows from the equality
$$
(-1)^{(e_{1, j} + e_{2, j})e_{3, j}}
(u_{1, j}u_{2, j})^{e_{3, j}}u_{3, j}^{-e_{1, j} - e_{2, j}} =
(-1)^{e_{1, j}e_{3, j}}
u_{1, j}^{e_{3, j}}u_{3, j}^{-e_{1, j}}
(-1)^{e_{2, j}e_{3, j}}
u_{2, j}^{e_{3, j}}u_{3, j}^{-e_{2, j}}
$$
in $B_j$. Properties (\ref{item-skew-better}) and
(\ref{item-normalization}) are equally immediate.

\medskip\noindent
Let us prove (\ref{item-1-x-better}). Let $a_1, a_2, a_1 - a_2 \in A$
be nonzerodivisors and set $a_3 = a_1 - a_2$.
Choose $A \subset B$ as in Lemma \ref{lemma-prepare-tame-symbol}
for $a_1, a_2, a_3$. Then it suffices to show
$$
(-1)^{e_{1, j}e_{2, j} + e_{1, j}e_{3, j} + e_{2, j}e_{3, j} + e_{2, j}}
u_{1, j}^{e_{2, j} - e_{3, j}}
u_{2, j}^{e_{3, j} - e_{1, j}}
u_{3, j}^{e_{1, j} - e_{2, j}} \bmod \mathfrak m_j = 1
$$
This is clear if $e_{1, j} = e_{2, j} = e_{3, j}$.
Say $e_{1, j} > e_{2, j}$. Then we see that $e_{3, j} = e_{2, j}$
because $a_3 = a_1 - a_2$ and we see that $u_{3, j}$
has the same residue class as $-u_{2, j}$. Hence
the formula is true -- the signs work out as well
and this verification is the reason for the choice of signs
in (\ref{equation-tame-symbol}).
The other cases are handled in exactly the same manner.
\end{proof}`],
        [4740, lemma("lemma-key-formula")],
        [4760, String.raw`\begin{proof}`],
        [4775, String.raw`(\ref{item-normalization}) of the tame symbol.`],
        [4780, String.raw`\end{proof}`],
        [11677, String.raw`\item
\label{item-find-Z-in-blowup}
there is a closed immersion $\mathbf{P}^1_Z \to W$ whose
composition with $b$ is the inclusion morphism
$\mathbf{P}^1_Z \to \mathbf{P}^1_X$ and whose base change by $\infty$
is the composition $Z \to C_ZX \to E \to W_\infty$ where the first
arrow is the vertex of the cone.`],
        [11715, String.raw`\medskip\noindent
The intersection of $\infty(Z)$ with $\mathbf{P}^1_Z$ is the effective
Cartier divisor $(\mathbf{P}^1_Z)_\infty$ hence the strict transform
of $\mathbf{P}^1_Z$ by the blowing up $b$ maps isomorphically to
$\mathbf{P}^1_Z$ (see Divisors, Lemmas \ref{divisors-lemma-strict-transform}
and \ref{divisors-lemma-blow-up-effective-Cartier-divisor}).
This gives us the morphism $\mathbf{P}^1_Z \to W$ mentioned in (8).
It is a closed immersion as $b$ is separated, see
Schemes, Lemma \ref{schemes-lemma-section-immersion}.`],
        [11815, String.raw`\medskip\noindent
Finally, we have to prove the last part of (8). This is clear
because the map $\mathbf{P}^1_Z \to W$ is affine locally
given by the surjection
$$
B \to B \otimes_{A[s]} A/I =
(A/I \oplus I/I^2 \oplus I^2/I^3 \oplus \ldots)[S] \to
A/I[S]
$$
and the identification $\text{Proj}(A/I[S]) = \Spec(A/I)$.
Some details omitted.`],
        [12250, lemma("lemma-relation-normal-cones")],
        [12270, String.raw`\begin{proof}`],
        [12295, String.raw`from (\ref{item-find-Z-in-blowup}) and its associated bivariant class`],
        [12310, String.raw`\end{proof}`],
        [12600, lemma("lemma-agreement-with-loc-chern")],
        [12630, String.raw`\begin{proof}`],
        [12651, String.raw`as in Section \ref{section-blowup-Z-first}. By (\ref{item-find-Z-in-blowup})`],
        [12680, String.raw`\end{proof}`],
      ]),
      sparseUnit("spaces-chow", 3065, [
        [2960, lemma("lemma-key-formula")],
        [2970, String.raw`\begin{proof}`],
        [2977, String.raw`Chow Homology, Equation (\ref{chow-item-normalization}).`],
        [2990, String.raw`\end{proof}`],
      ]),
      sparseUnit("divisors", 20, [
        [1, lemma("lemma-strict-transform")],
        [10, lemma("lemma-blow-up-effective-Cartier-divisor")],
      ]),
      sparseUnit("schemes", 10, [[1, lemma("lemma-section-immersion")]]),
      sparseUnit("duality", 5230, [
        [1, lemma("lemma-shriek-open-immersion")],
        [10, lemma("lemma-upper-shriek-composition")],
        [20, lemma("lemma-pseudo-functor")],
        [5067, String.raw`\item
\label{item-cocycle-glueing}
for each $i, j, k$ we have
$$
\varphi_{ik}|_{U_i \cap U_j \cap U_k} =
\varphi_{jk}|_{U_i \cap U_j \cap U_k} \circ
\varphi_{ij}|_{U_i \cap U_j \cap U_k}
$$
in $D(\mathcal{O}_{U_i \cap U_j \cap U_k})$.
\end{enumerate}
Here, in (2) we use that $(U_i \cap U_j \to U_i)^!$
is given by restriction (Lemma \ref{lemma-shriek-open-immersion})
and that we have canonical isomorphisms
$$
(U_i \cap U_j \to U_i)^! \circ p_i^! = p_{ij}^! =
(U_i \cap U_j \to U_j)^! \circ p_j^!
$$
by Lemma \ref{lemma-upper-shriek-composition} and to get (3) we use
that the upper shriek functors form a pseudo functor by
Lemma \ref{lemma-pseudo-functor}.`],
        [5130, lemma("lemma-good-dualizing-independence-covering")],
        [5140, String.raw`\begin{proof}`],
        [5160, String.raw`On the other hand, by condition (\ref{item-cocycle-glueing}) the pair`],
        [5165, String.raw`\end{proof}`],
        [5174, lemma("lemma-existence-good-dualizing")],
        [5183, String.raw`\begin{proof}`],
        [5194, String.raw`On the other hand, by condition (\ref{item-cocycle-glueing}) the pair`],
        [5200, String.raw`\end{proof}`],
      ]),
    ];
    const claimTags = [
      "0EAG,chow-lemma-prepare-tame-symbol",
      "0EAL,chow-item-bilinear-better",
      "0EAM,chow-item-skew-better",
      "0EAN,chow-item-normalization",
      "0EAP,chow-item-1-x-better",
      "0EAS,chow-lemma-tame-symbol",
      "0AYC,chow-lemma-key-formula",
      "0EQV,spaces-chow-lemma-key-formula",
      "0FE9,chow-item-find-Z-in-blowup",
      "0FEB,chow-lemma-relation-normal-cones",
      "0FEG,chow-lemma-agreement-with-loc-chern",
      "080E,divisors-lemma-strict-transform",
      "0807,divisors-lemma-blow-up-effective-Cartier-divisor",
      "01KT,schemes-lemma-section-immersion",
      "0AU6,duality-item-cocycle-glueing",
      "0AU8,duality-lemma-good-dualizing-independence-covering",
      "0AU9,duality-lemma-existence-good-dualizing",
      "0AU0,duality-lemma-shriek-open-immersion",
      "0ATX,duality-lemma-upper-shriek-composition",
      "0ATY,duality-lemma-pseudo-functor",
    ].join("\n");
    const result = extractStacksGraphFromUnits(claimUnits, claimTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    for (const tag of ["0EAL", "0EAM", "0EAN", "0EAP", "0FE9", "0AU6"]) {
      expect(result.graph.nodes.find(({ id }) => id === `tag-${tag.toLowerCase()}`))
        .toMatchObject({ nodeClass: "theorem-like", kind: "claim" });
    }
    const routePrerequisites = (tag) => result.graph.proofRoutes
      .find(({ theoremNodeId }) => theoremNodeId === `tag-${tag.toLowerCase()}`)
      ?.dependencyIds.map((id) => id.split("-to-tag-")[1].toUpperCase()).sort();
    expect(routePrerequisites("0EAL")).toEqual(["0EAG"]);
    expect(routePrerequisites("0EAP")).toEqual(["0EAG"]);
    expect(routePrerequisites("0FE9")).toEqual(["01KT", "0807", "080E"]);
    expect(routePrerequisites("0AU6")).toEqual(["0ATX", "0ATY", "0AU0"]);
    expect(routePrerequisites("0EAM")).toEqual([]);
    expect(routePrerequisites("0EAN")).toEqual([]);
    for (const tag of ["0EAM", "0EAN"]) {
      expect(result.graph.nodes.find(({ id }) => id === `tag-${tag.toLowerCase()}`)
        ?.evidence.note).toMatch(/equally immediate.*proof debt/u);
      expect(result.graph.proofRoutes.find(({ theoremNodeId }) => (
        theoremNodeId === `tag-${tag.toLowerCase()}`
      ))?.summary).toContain("not a root attestation");
    }
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0eal")
      ?.evidence.note).toContain("excluded defining formula");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0eap")
      ?.evidence.note).toContain("symmetric remaining cases");
    expect(result.graph.proofRoutes.find(({ theoremNodeId }) => theoremNodeId === "tag-0fe9")
      ?.evidence.note).toContain("Rees-algebra setup");
    const incomingOwners = (tag) => result.graph.directDependencies
      .filter(({ prerequisite }) => prerequisite.id === `tag-${tag.toLowerCase()}`)
      .map(({ dependentNodeId }) => dependentNodeId.slice(4).toUpperCase())
      .sort();
    expect(incomingOwners("0EAL")).toEqual([]);
    expect(incomingOwners("0EAM")).toEqual([]);
    expect(incomingOwners("0EAN")).toEqual(["0AYC", "0EQV"]);
    expect(incomingOwners("0EAP")).toEqual([]);
    expect(incomingOwners("0FE9")).toEqual(["0FEB", "0FEG"]);
    expect(incomingOwners("0AU6")).toEqual(["0AU8", "0AU9"]);
    expect(result.stats).toMatchObject({
      curatedClaimCount: 6,
      suppressedProofXrefDependencyCount: 4,
    });
    expect(result.graph.references).toHaveLength(0);

    const changedUnits = claimUnits.map((unit) => (
      unit.stem === "chow"
        ? { ...unit, content: unit.content.replace("of the tame symbol.", "for the tame symbol.") }
        : unit
    ));
    expect(() => extractStacksGraphFromUnits(changedUnits, claimTags, {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    })).toThrow(/claim 0EAN incoming occurrence artifacts changed/u);
  });

  it("decomposes the mixed Tag 03II recall bundle by audited occurrence", () => {
    const decentLines = Array(310).fill("");
    decentLines[269] = String.raw`\begin{remark}`;
    decentLines[270] = String.raw`\label{remark-recall}`;
    decentLines[271] = "A mixed bundle of recalled facts.";
    decentLines[272] = String.raw`\end{remark}`;
    decentLines[289] = String.raw`\begin{lemma}`;
    decentLines[290] = String.raw`\label{lemma-U-finite-above-x}`;
    decentLines[291] = "The fibres are finite.";
    decentLines[292] = String.raw`\end{lemma}`;
    decentLines[294] = String.raw`\begin{proof}`;
    decentLines[298] = String.raw`Since the map is etale it is open (see Remark \ref{remark-recall}).`;
    decentLines[303] = "The other map is etale, hence locally quasi-finite";
    decentLines[304] = "as recalled above.";
    decentLines[305] = String.raw`\end{proof}`;
    const result = extractStacksGraphFromUnits([
      {
        stem: "morphisms",
        path: "morphisms.tex",
        title: "Morphisms",
        content: String.raw`
\begin{lemma}
\label{lemma-etale-open}
Etale morphisms are open.
\end{lemma}
\begin{lemma}
\label{lemma-flat-unramified-etale}
Flat unramified morphisms are etale.
\end{lemma}
\begin{lemma}
\label{lemma-unramified-quasi-finite}
Unramified morphisms are locally quasi-finite.
\end{lemma}
`,
      },
      {
        stem: "decent-spaces",
        path: "decent-spaces.tex",
        title: "Decent Spaces",
        content: decentLines.join("\n"),
      },
    ], [
      "03WT,morphisms-lemma-etale-open",
      "02GV,morphisms-lemma-flat-unramified-etale",
      "02V5,morphisms-lemma-unramified-quasi-finite",
      "03II,decent-spaces-remark-recall",
      "03JS,decent-spaces-lemma-U-finite-above-x",
    ].join("\n"), { capturedAt });

    expect(result.stats).toMatchObject({
      bundledRemarkDependencyCount: 3,
      curatedResolvedBundledProofXrefCount: 1,
    });
    expect(result.graph.directDependencies
      .filter(({ dependentNodeId }) => dependentNodeId === "tag-03js")
      .map(({ prerequisite }) => prerequisite.id)
      .sort()).toEqual(["tag-02gv", "tag-02v5", "tag-03wt"]);
    expect(result.graph.references.some(({ ref }) => (
      ref === "decent-spaces-remark-recall"
    ))).toBe(false);
    expect(result.graph.directDependencies.some(({ dependentNodeId, prerequisite }) => (
      dependentNodeId === "tag-03js" && prerequisite.id === "tag-03ii"
    ))).toBe(false);
  });

  it("suppresses a source-audited notation-only xref to a promoted claim", () => {
    const result = extractStacksGraphFromUnits([
      {
        stem: "spaces-perfect",
        path: "spaces-perfect.tex",
        title: "Perfect Complexes on Spaces",
        content: String.raw`
\begin{remark}
\label{remark-match-total-direct-images}
We claim the pullback and pushforward diagrams commute, by the construction.
\end{remark}
`,
      },
      {
        stem: "spaces-more-morphisms",
        path: "spaces-more-morphisms.tex",
        title: "More Morphisms of Spaces",
        content: String.raw`
\begin{lemma}
\label{lemma-affine-locally-rel-perfect}
The object is relatively perfect.
\end{lemma}
\begin{proof}
Use notation as in Remark
\ref{spaces-perfect-remark-match-total-direct-images}.
\end{proof}
`,
      },
    ], [
      "08GH,spaces-perfect-remark-match-total-direct-images",
      "0DKQ,spaces-more-morphisms-lemma-affine-locally-rel-perfect",
    ].join("\n"), { capturedAt });

    expect(result.stats.suppressedProofXrefDependencyCount).toBe(1);
    expect(result.graph.directDependencies.some((dependency) => (
      dependency.dependentNodeId === "tag-0dkq"
      && dependency.prerequisite.id === "tag-08gh"
    ))).toBe(false);
  });

  it("suppresses only the nine audited etale goal-item references", () => {
    const owner = (environment, label, references) => String.raw`
\begin{${environment}}
\label{${label}}
The listed goal clauses hold.
\end{${environment}}
\begin{proof}
${references.map((reference) => String.raw`We establish \ref{${reference}}.`).join(" ")}
\end{proof}`;
    const content = [
      String.raw`\begin{enumerate}
\item \label{item-vanishing}
The vanishing goal.
\item \label{item-finite-proper}
The finite-proper goal.
\item \label{item-base-change-prime-to-p}
The prime-to-p base-change goal.
\item \label{item-base-change-proper}
The proper base-change goal.
\item \label{item-surjective}
The surjectivity goal.
\end{enumerate}`,
      owner("lemma", "lemma-constant-smooth-statements", [
        "item-base-change-prime-to-p",
        "item-base-change-proper",
        "item-finite-proper",
        "item-surjective",
        "item-vanishing",
      ]),
      owner("lemma", "lemma-finite-pushforward-statements", [
        "item-surjective",
      ]),
      owner("lemma", "lemma-restrict-to-open", [
        "item-vanishing",
        "item-surjective",
      ]),
      owner("theorem", "theorem-vanishing-affine-curves", [
        "item-vanishing",
        "item-surjective",
      ]),
    ].join("\n");
    const result = extractStacksGraphFromUnits([{
      stem: "etale-cohomology",
      path: "etale-cohomology.tex",
      title: "Etale Cohomology",
      content,
    }], [
      "0A53,etale-cohomology-item-vanishing",
      "0A57,etale-cohomology-item-finite-proper",
      "0A58,etale-cohomology-item-base-change-prime-to-p",
      "0A59,etale-cohomology-item-base-change-proper",
      "0A5A,etale-cohomology-item-surjective",
      "0A5B,etale-cohomology-lemma-constant-smooth-statements",
      "0A5D,etale-cohomology-lemma-finite-pushforward-statements",
      "0GJA,etale-cohomology-lemma-restrict-to-open",
      "03SC,etale-cohomology-theorem-vanishing-affine-curves",
    ].join("\n"), {
      capturedAt,
      sourceRevision: stacksSourceRevision,
    });

    expect(result.stats).toMatchObject({
      theoremCount: 4,
      sourceArtifactCount: 1,
      sourceArtifactKindCounts: { item: 1 },
      directDependencyCount: 1,
      sourceArtifactDependencyCount: 1,
      sourceArtifactRouteCount: 1,
      suppressedProofXrefDependencyCount: 9,
      unresolvedTaggedProofReferenceCount: 0,
      uniqueUnresolvedTaggedProofTargetCount: 0,
      emptySourceRouteCount: 3,
    });
    expect(result.graph.nodes.find(({ id }) => id === "tag-0a53")).toMatchObject({
      nodeClass: "source-artifact",
      kind: "item",
    });
    expect(result.graph.nodes.some(({ id }) => [
      "tag-0a57",
      "tag-0a58",
      "tag-0a59",
      "tag-0a5a",
    ].includes(id))).toBe(false);
    expect(result.graph.directDependencies).toEqual([
      expect.objectContaining({
        dependentNodeId: "tag-0a5b",
        prerequisite: { type: "node", id: "tag-0a53" },
        role: "source-reference",
      }),
    ]);
    expect(result.graph.references).toEqual([
      expect.objectContaining({
        ownerNodeId: "tag-0a5b",
        ref: "etale-cohomology-item-vanishing",
        basis: "proof-xref",
        resolution: expect.objectContaining({
          status: "resolved",
          target: { type: "node", id: "tag-0a53" },
        }),
      }),
    ]);
  });
});
