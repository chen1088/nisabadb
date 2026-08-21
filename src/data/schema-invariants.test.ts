import { describe, expect, it } from "vitest";
import { isTheoremLike, kindLabels } from "../components/content";
import rawCorpus from "./corpus.json";
import { validateCorpus, type Corpus, type Statement } from "./schema";

function clonedCorpus(): Corpus {
  return structuredClone(validateCorpus(rawCorpus));
}

function conjectureFor(corpus: Corpus, paperId = corpus.papers[0]?.id): Statement {
  const template = corpus.statements.find((statement) => statement.kind === "definition");
  if (!template || !paperId) throw new Error("Conjecture test fixture is incomplete");
  return {
    ...structuredClone(template),
    id: "TEST_CONJECTURE",
    paperId,
    localLabel: "Conjecture 1",
    globalStatementId: `${paperId}.test-conjecture`,
    kind: "conjecture",
    title: "A deliberately open claim",
    exactStatement: "For every test object, the asserted open property holds.",
    idea: "This records motivation and evidence without claiming a proof.",
    proofRoutes: [],
    dependencies: [],
    formalDeclarations: [],
    formalStatus: "statement-only",
    formalAlignment: "not-applicable",
    tags: ["conjecture", "test"],
  };
}

describe("conjecture records", () => {
  it("accepts an unproved conjecture and does not classify it as a theorem-like result", () => {
    const corpus = clonedCorpus();
    const conjecture = conjectureFor(corpus);
    corpus.statements.push(conjecture);

    expect(() => validateCorpus(corpus)).not.toThrow();
    expect(kindLabels.conjecture).toBe("Conjecture");
    expect(isTheoremLike(conjecture)).toBe(false);
  });
});

describe("paper-local corpus invariants", () => {
  it("allows at most one featured paper", () => {
    const corpus = clonedCorpus();
    const secondPaper = corpus.papers[1];
    if (!secondPaper) throw new Error("Paper fixture is incomplete");
    secondPaper.featured = true;

    expect(() => validateCorpus(corpus)).toThrow(/at most one paper may be featured/i);
  });

  it("requires every gold paper to contain statements and graph views", () => {
    const withoutStatements = clonedCorpus();
    const provisional = withoutStatements.papers.find((paper) => paper.status === "provisional");
    if (!provisional) throw new Error("Provisional-paper fixture is incomplete");
    provisional.status = "gold";
    expect(() => validateCorpus(withoutStatements)).toThrow(/gold paper.*at least one statement/i);

    const withoutViews = clonedCorpus();
    const gold = withoutViews.papers.find((paper) => paper.status === "gold");
    if (!gold) throw new Error("Gold-paper fixture is incomplete");
    gold.graph.views = [];
    expect(() => validateCorpus(withoutViews)).toThrow(/gold paper.*graph views/i);
  });

  it("requires global statement IDs and dependencies to stay paper-local", () => {
    const wrongNamespace = clonedCorpus();
    const firstStatement = wrongNamespace.statements[0];
    if (!firstStatement) throw new Error("Statement fixture is incomplete");
    firstStatement.globalStatementId = `wrong-paper.${firstStatement.id.toLowerCase()}`;
    expect(() => validateCorpus(wrongNamespace)).toThrow(/global namespace/i);

    const crossPaper = clonedCorpus();
    const source = crossPaper.statements.find((statement) => statement.proofRoutes.length > 0);
    const otherPaper = crossPaper.papers.find((paper) => paper.id !== source?.paperId);
    if (!source || !otherPaper) throw new Error("Cross-paper fixture is incomplete");
    const external = conjectureFor(crossPaper, otherPaper.id);
    external.id = "EXTERNAL_CONJECTURE";
    external.globalStatementId = `${otherPaper.id}.external-conjecture`;
    crossPaper.statements.push(external);
    source.dependencies.push(external.id);
    const route = source.proofRoutes[0];
    const firstStep = route?.steps[0];
    if (!route || !firstStep) throw new Error("Proof-route fixture is incomplete");
    route.dependencies.push(external.id);
    firstStep.dependencyRefs.push(external.id);
    expect(() => validateCorpus(crossPaper)).toThrow(/cross-paper dependency/i);
  });

  it("rejects duplicate graph view IDs and cross-paper graph references", () => {
    const duplicateView = clonedCorpus();
    const gold = duplicateView.papers.find((paper) => paper.status === "gold");
    const firstView = gold?.graph.views[0];
    if (!gold || !firstView) throw new Error("Graph-view fixture is incomplete");
    gold.graph.views.push(structuredClone(firstView));
    expect(() => validateCorpus(duplicateView)).toThrow(/duplicate graph view ID/i);

    const crossPaperRoot = clonedCorpus();
    const graphPaper = crossPaperRoot.papers.find((paper) => paper.status === "gold");
    const otherPaper = crossPaperRoot.papers.find((paper) => paper.id !== graphPaper?.id);
    const view = graphPaper?.graph.views[0];
    if (!graphPaper || !otherPaper || !view) throw new Error("Graph fixture is incomplete");
    const external = conjectureFor(crossPaperRoot, otherPaper.id);
    external.id = "EXTERNAL_GRAPH_NODE";
    external.globalStatementId = `${otherPaper.id}.external-graph-node`;
    crossPaperRoot.statements.push(external);
    view.roots = [external.id];
    expect(() => validateCorpus(crossPaperRoot)).toThrow(/graph references cross-paper statement/i);
  });
});
