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

    expect(result.graph.nodes).toHaveLength(8);
    expect(result.stats.kindCounts).toEqual({
      assumption: 1,
      definition: 1,
      lemma: 2,
      proposition: 2,
      theorem: 2,
    });
    expect(result.graph.nodes.some((node) => node.kind === "example")).toBe(false);
    expect(result.stats.excludedEnvironmentCounts.example).toBe(1);
    expect(result.unitInventories[0]).toMatchObject({
      theoremNodeIds: ["tag-0003", "tag-0004", "tag-0012", "tag-0013"],
      supportNodeIds: ["tag-0001", "tag-0002"],
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
      .toHaveLength(2);
  });

  it("keeps explicit alternative proofs as separate dependency routes", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const routes = result.graph.proofRoutes.filter((route) => route.theoremNodeId === "tag-0004");

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({
      id: "route-tag-0004-source-proof",
      routeKind: "source-proof",
    });
    expect(routes[0].dependencyIds).toHaveLength(2);
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
      resolution: { status: "unresolved" },
    });
    expect(result.graph.directDependencies.some((dependency) => (
      dependency.prerequisite.id === "tag-0005"
    ))).toBe(false);
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
      ["tag-0x01", ["tag-02vb", "tag-02ye", "tag-03c6"]],
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
      resolution: expect.objectContaining({ status: "unresolved" }),
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
    expect(result.graph.proofRoutes).toHaveLength(3);
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
    const stacksPropertiesContent = [
      ...Array.from({ length: 1429 }, () => "% audited padding"),
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
      resolution: expect.objectContaining({ status: "unresolved" }),
    }));

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
    expect(result.graph.nodes.some(({ sourceXmlId }) => (
      sourceXmlId === "decent-spaces-remark-recall"
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
});
