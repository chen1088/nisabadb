import { describe, expect, it } from "vitest";
import { locateStacksSourceArtifacts } from "./stacks-source-artifacts.mjs";

describe("Stacks raw source-artifact locator", () => {
  it("captures exact referenced containers without promoting their environment classes", () => {
    const content = String.raw`\section{Imported background}
\label{section-background}

\begin{remark}
\label{remark-recall}
Recall a useful construction.
\end{remark}

\begin{equation}
\label{equation-comparison}
x = y
\end{equation}

\begin{enumerate}
\item \label{item-first}
First condition.
\item \label{item-second}
Second condition.
\end{enumerate}

\begin{example}
\label{example-witness}
A source witness.
\end{example}`;
    const units = [{ stem: "algebra", path: "algebra.tex", title: "Algebra", content }];
    const artifacts = locateStacksSourceArtifacts(units, [
      "algebra-section-background",
      "algebra-remark-recall",
      "algebra-equation-comparison",
      "algebra-item-first",
      "algebra-example-witness",
    ]);

    expect(artifacts.map(({ fullLabel, kind }) => [fullLabel, kind])).toEqual([
      ["algebra-equation-comparison", "equation"],
      ["algebra-example-witness", "example"],
      ["algebra-item-first", "item"],
      ["algebra-remark-recall", "remark"],
      ["algebra-section-background", "section"],
    ]);
    expect(artifacts.find(({ kind }) => kind === "section")).toMatchObject({
      startLine: 1,
      endLine: 24,
      title: "Imported background",
    });
    expect(artifacts.find(({ kind }) => kind === "section")?.rawSource)
      .toContain(String.raw`\label{example-witness}`);
    expect(artifacts.find(({ kind }) => kind === "item")?.rawSource).toContain("First condition.");
    expect(artifacts.find(({ kind }) => kind === "item")?.rawSource).not.toContain("Second condition.");
    expect(artifacts.some(({ fullLabel }) => fullLabel === "algebra-item-second")).toBe(false);
  });

  it("uses the longest chapter stem and rejects missing or duplicate source labels", () => {
    const units = [
      {
        stem: "stacks",
        path: "stacks.tex",
        title: "Stacks",
        content: String.raw`\begin{remark}
\label{remark-decoy}
Decoy.
\end{remark}`,
      },
      {
        stem: "stacks-sheaves",
        path: "stacks-sheaves.tex",
        title: "Sheaves on Stacks",
        content: String.raw`\begin{remark}
\label{remark-target}
Target.
\end{remark}`,
      },
    ];
    expect(locateStacksSourceArtifacts(units, ["stacks-sheaves-remark-target"])[0])
      .toMatchObject({ unit: { stem: "stacks-sheaves" }, kind: "remark" });
    expect(() => locateStacksSourceArtifacts(units, ["stacks-sheaves-remark-missing"]))
      .toThrow(/expected one source line.*found 0/i);

    const duplicate = structuredClone(units);
    duplicate[1].content += String.raw`
\label{remark-target}`;
    expect(() => locateStacksSourceArtifacts(duplicate, ["stacks-sheaves-remark-target"]))
      .toThrow(/expected one source line.*found 2/i);
  });
});
