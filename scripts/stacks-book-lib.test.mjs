import { describe, expect, it } from "vitest";
import { extractStacksGraphFromUnits } from "./stacks-book-lib.mjs";

const capturedAt = "2026-08-23T18:00:00.000Z";

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

  it("does not attach an untargeted proof across a section boundary", () => {
    const result = extractStacksGraphFromUnits(units, tagText, { capturedAt });
    const boundaryEdges = result.graph.directDependencies.filter((dependency) => (
      dependency.dependentNodeId === "tag-0013"
    ));

    expect(boundaryEdges.some(({ prerequisite }) => prerequisite.id === "tag-0006")).toBe(false);
    expect(result.graph.proofRoutes.find((route) => route.theoremNodeId === "tag-0013")
      ?.evidence.locator).not.toContain("Detached prose");
  });
});
