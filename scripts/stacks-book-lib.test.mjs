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
Every marked input is valid.
\end{lemma}
\begin{proof}
Use Definition \ref{definition-input} in Situation \ref{situation-context}.
\end{proof}

\begin{example}
\label{example-worked}
This worked example must not become a graph node.
\end{example}

\begin{theorem}
\label{theorem-output}
By Lemma \ref{lemma-first}, every output is valid.
\end{theorem}
\begin{proof}
Apply Lemma \ref{lemma-first}, Proposition
\ref{geometry-proposition-cross-file}, and Example \ref{example-worked}.
\end{proof}
\begin{proof}[Second proof]
Apply Lemma \ref{lemma-first} again.
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

    expect(result.graph.nodes).toHaveLength(5);
    expect(result.stats.kindCounts).toEqual({
      assumption: 1,
      definition: 1,
      lemma: 1,
      proposition: 1,
      theorem: 1,
    });
    expect(result.graph.nodes.some((node) => node.kind === "example")).toBe(false);
    expect(result.stats.excludedEnvironmentCounts.example).toBe(1);
    expect(result.unitInventories[0]).toMatchObject({
      theoremNodeIds: ["tag-0003", "tag-0004"],
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
});
