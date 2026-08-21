import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import rawCorpus from "../data/corpus.json";
import { validateCorpus, type Statement } from "../data/schema";
import { ProofPanel } from "./GraphExplorer";

afterEach(cleanup);

describe("conjecture proof panel", () => {
  it("labels rationale and open status without presenting a proof", () => {
    const corpus = validateCorpus(rawCorpus);
    const paper = corpus.papers[0];
    const template = corpus.statements.find((statement) => statement.kind === "definition");
    if (!paper || !template) throw new Error("Conjecture panel fixture is incomplete");
    const conjecture: Statement = {
      ...structuredClone(template),
      id: "TEST_CONJECTURE",
      paperId: paper.id,
      localLabel: "Conjecture 1",
      globalStatementId: `${paper.id}.test-conjecture`,
      kind: "conjecture",
      title: "A deliberately open claim",
      exactStatement: "The open property holds.",
      idea: "Known examples and the surrounding theory make the claim plausible.",
      proofRoutes: [],
      dependencies: [],
      formalDeclarations: [],
      formalStatus: "statement-only",
      formalAlignment: "not-applicable",
      tags: ["conjecture", "test"],
    };

    render(
      <MemoryRouter>
        <ProofPanel paper={paper} statement={conjecture} headingLevel="h2" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Selected conjecture")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conjectural rationale" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open conjecture" })).toBeInTheDocument();
    expect(screen.getByText(/does not claim a proof/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Proof idea" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shortened proof" })).not.toBeInTheDocument();
  });
});
