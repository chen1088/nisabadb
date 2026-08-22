import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import rawCorpus from "../data/corpus.json";
import { validateCorpus, type Statement } from "../data/schema";
import { GraphExplorer, ProofPanel } from "./GraphExplorer";

afterEach(cleanup);

describe("paper graph expansion", () => {
  it("starts every dependency disclosure folded", () => {
    const corpus = validateCorpus(rawCorpus);
    const paper = corpus.papers.find((candidate) => candidate.status === "gold");
    if (!paper) throw new Error("Gold-paper graph fixture is incomplete");
    const statements = corpus.statements.filter((statement) => statement.paperId === paper.id);

    render(
      <MemoryRouter>
        <GraphExplorer paper={paper} statements={statements} />
      </MemoryRouter>,
    );

    const disclosures = screen.getAllByRole("button", { name: /prerequisites for/i });
    expect(disclosures.length).toBeGreaterThan(0);
    disclosures.forEach((disclosure) => {
      expect(disclosure).toHaveAttribute("aria-expanded", "false");
    });
    expect(
      screen.queryByRole("button", { name: /fold prerequisites for/i }),
    ).not.toBeInTheDocument();
  });
});

describe("conjecture proof panel", () => {
  it("labels source status without automatically certifying an open problem", () => {
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
    expect(screen.getByRole("heading", { name: "Source conjecture" })).toBeInTheDocument();
    expect(screen.getByText(/does not claim a proof/i)).toBeInTheDocument();
    expect(screen.getByText(/does not.*certify.*remains open/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Proof idea" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Shortened proof" })).not.toBeInTheDocument();
  });
});

describe("dependency route provenance", () => {
  it("shows original, minimized, and candidate reinterpretation routes separately", () => {
    const corpus = validateCorpus(rawCorpus);
    const source = corpus.statements.find((statement) => statement.proofRoutes.length > 0);
    const original = source?.proofRoutes[0];
    const paper = source ? corpus.papers.find((candidate) => candidate.id === source.paperId) : undefined;
    if (!source || !original || !paper) throw new Error("Dependency-route fixture is incomplete");
    const statement = structuredClone(source);
    statement.proofRoutes = [
      original,
      {
        ...structuredClone(original),
        id: "minimized-route",
        label: "Minimal prerequisite route",
        dependencyKind: "minimized",
        reviewStatus: "reviewed",
        derivedFromRouteId: original.id,
      },
      {
        ...structuredClone(original),
        id: "candidate-route",
        label: "Geometric reinterpretation",
        dependencyKind: "reinterpretation",
        reviewStatus: "candidate",
      },
    ];

    render(
      <MemoryRouter>
        <ProofPanel paper={paper} statement={statement} activeRoute={original} />
      </MemoryRouter>,
    );

    const spectrum = screen.getByLabelText(/available dependency routes/i);
    expect(spectrum).toHaveTextContent(/1\s*original/i);
    expect(spectrum).toHaveTextContent(/1\s*minimized/i);
    expect(spectrum).toHaveTextContent(/1\s*reinterpretations/i);
    const selector = screen.getByLabelText(new RegExp(`proof route for ${source.localLabel}`, "i"));
    expect(within(selector).getByRole("option", { name: /minimized.*minimal prerequisite route/i })).toBeInTheDocument();
    expect(within(selector).getByRole("option", { name: /reinterpretation.*geometric reinterpretation.*candidate/i })).toBeInTheDocument();
  });
});

describe("prover-neutral formal evidence", () => {
  it("renders the prover and checker supplied by an artifact adapter", () => {
    const corpus = validateCorpus(rawCorpus);
    const source = corpus.statements.find((statement) => statement.formalDeclarations.length > 0);
    const paper = source ? corpus.papers.find((candidate) => candidate.id === source.paperId) : undefined;
    if (!source || !paper) throw new Error("Formal-artifact fixture is incomplete");
    const statement = structuredClone(source);
    const declaration = statement.formalDeclarations[0];
    if (!declaration) throw new Error("Formal declaration fixture is incomplete");
    declaration.prover = { id: "rocq", label: "Rocq", version: "9.0", checker: "rocqchk" };

    render(
      <MemoryRouter>
        <ProofPanel paper={paper} statement={statement} activeRoute={statement.proofRoutes[0]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Rocq")).toBeInTheDocument();
    expect(screen.getByText("rocqchk")).toBeInTheDocument();
    expect(screen.queryByText(/no prover artifact/i)).not.toBeInTheDocument();
  });
});
