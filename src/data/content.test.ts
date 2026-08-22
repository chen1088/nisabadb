import { describe, expect, it } from "vitest";
import citationAudit from "../../data/citations/direct-neighborhood-audit.json";
import rawCorpus from "./corpus.json";
import {
  corpus,
  learningRoute,
  paperById,
  proofCoverage,
  statementById,
  statements,
  topologicalReadingOrder,
} from "./content";
import { validateCorpus } from "./schema";

describe("NisabaDB content", () => {
  it("validates the committed corpus", () => {
    expect(validateCorpus(rawCorpus)).toEqual(corpus);
  });

  it("imports the complete legacy inventory plus the audited matching-trial construction", () => {
    const dictStatements = statements.filter((statement) =>
      statement.paperId === "dimension-free-dictatorship-tester"
    );
    expect(dictStatements).toHaveLength(51);
    expect(dictStatements.filter((statement) => statement.kind === "definition")).toHaveLength(16);
    expect(dictStatements.filter((statement) => statement.kind === "notation")).toHaveLength(2);
    expect(dictStatements.reduce((sum, statement) => sum + statement.dependencies.length, 0)).toBe(117);
    expect(statements.some((statement) => statement.formalStatus === "fully-certified")).toBe(false);
    expect(statements.every((statement) => !/^\$$/m.test(statement.exactStatement))).toBe(true);
    expect(statementById.get("S02_L03")?.exactStatement).toContain("$$");
    expect(statementById.get("S02_T01")).toMatchObject({
      exactStatement: expect.stringContaining("n\\ge 1"),
      sourceStatement: expect.not.stringContaining("n\\ge 1"),
    });
    expect(statementById.get("S04_P05")).toMatchObject({
      exactStatement: expect.stringContaining("n\\ge 4"),
      statementNote: expect.stringContaining("fails at n = 3"),
    });
    expect(statementById.get("S05_D10")).toMatchObject({
      exactStatement: expect.stringContaining("m\\ge1"),
      sourceStatement: expect.not.stringContaining("For this definition"),
    });
    for (const id of ["S05_L12", "S05_L13", "S05_L15", "S05_L18"]) {
      expect(statementById.get(id)).toMatchObject({
        exactStatement: expect.stringContaining("m\\ge1"),
        sourceStatement: expect.any(String),
        statementNote: expect.any(String),
      });
    }
    expect(statementById.get("S05_P16")).toMatchObject({
      exactStatement: expect.stringContaining("n\\ge2"),
      sourceStatement: expect.any(String),
      statementNote: expect.any(String),
    });
    expect(statementById.get("S05_L17")?.exactStatement).toContain("m\\ge2");
    expect(statementById.get("S03_D03")?.sourceLocations[0]).toMatchObject({
      lineStart: 576,
      lineEnd: 680,
      locator: expect.stringContaining("Matching-cube coordinates"),
    });
    for (const id of ["S03_L01", "S03_L02", "S04_P05", "S04_L06", "S04_L07"]) {
      const statement = statementById.get(id);
      expect(statement?.dependencies).toContain("S03_D03");
      expect(statement?.proofRoutes.flatMap((route) =>
        route.steps.flatMap((step) => step.dependencyRefs),
      )).toContain("S03_D03");
    }
    expect(statementById.get("S05_L09")?.dependencies).toContain("S05_D06");
    expect(statementById.get("S05_L17")?.dependencies).toContain("S05_L12");
    expect(statementById.get("S05_P16")?.dependencies).toContain("S05_T03");
    expect(statementById.get("S05_P16")?.dependencies).toContain("S05_D06");
    expect(statementById.get("S05_P16")?.dependencies).not.toContain("S05_L06");
    expect(statementById.get("S05_D10")?.formalDeclarations.some((declaration) =>
      declaration.file.endsWith("S05_Def5_10b_OddSignPatternMultiset.lean"),
    )).toBe(true);
  });

  it("contains a complete proof-bearing main spine and labels all remaining gaps", () => {
    const main = statementById.get("S01_T01");
    expect(main?.proofRoutes[0]?.status).toBe("complete");
    expect(main?.exactStatement).toContain("O(\\epsilon^{-2})");
    const dictStatements = statements.filter((statement) =>
      statement.paperId === "dimension-free-dictatorship-tester"
    );
    for (const statement of dictStatements.filter((item) => item.proofRoutes.length > 0)) {
      expect(statement.proofRoutes.every((route) =>
        route.status === "complete" || route.proof.includes("Proof not yet distilled"),
      )).toBe(true);
    }
    const coverage = proofCoverage("dimension-free-dictatorship-tester");
    expect(coverage.total).toBe(33);
    expect(coverage.complete).toBe(31);
    expect(
      dictStatements
        .filter((statement) => statement.proofRoutes.some((route) => route.status !== "complete"))
        .map((statement) => statement.id)
        .sort(),
    ).toEqual(["S02_T01", "S02_T02"]);
    expect(statementById.get("S02_T01")?.proofRoutes[0]?.sourceAttribution).toContain(
      "preserves that discrepancy",
    );
  });

  it("prefers a reviewed minimized route for learning and ignores candidates", () => {
    const source = statementById.get("S01_T01");
    const original = source?.proofRoutes[0];
    if (!source || !original) throw new Error("Learning-route fixture is incomplete");
    const statement = structuredClone(source);
    statement.proofRoutes = [
      original,
      { ...structuredClone(original), id: "candidate-shortcut", dependencyKind: "reinterpretation", reviewStatus: "candidate" },
      { ...structuredClone(original), id: "reviewed-minimum", dependencyKind: "minimized", reviewStatus: "reviewed", derivedFromRouteId: original.id },
    ];

    expect(learningRoute(statement)?.id).toBe("reviewed-minimum");

    statement.proofRoutes = statement.proofRoutes.map((route) => ({
      ...route,
      reviewStatus: "candidate" as const,
    }));
    expect(learningRoute(statement)).toBeUndefined();
  });

  it("promotes the multislice paper with a complete numbered-result map and honest gaps", () => {
    const paperId = "braverman-khot-lifshitz-minzer-2025-invariance-principle-multislice";
    const paper = paperById.get(paperId);
    const paperStatements = statements.filter((statement) => statement.paperId === paperId);

    expect(paper).toMatchObject({
      status: "gold",
      theoremExtractionStatus: "complete",
      rewriteStatus: "partial-distillation",
      formalizationStatus: "statement-only",
    });
    expect(paperStatements).toHaveLength(42);
    expect(paper?.graph.paperRoots).toHaveLength(21);
    expect(new Set(paper?.graph.paperRoots).size).toBe(21);
    expect(statementById.get("BKLM_C04")?.proofRoutes[0]?.status)
      .toBe("proof-not-yet-distilled");
    expect(["BKLM_C05", "BKLM_C06"].every((id) =>
      statementById.get(id)?.proofRoutes[0]?.status === "complete"
    )).toBe(true);
    expect(statementById.get("BKLM_T01")?.proofRoutes[0]?.status).toBe("complete");
    expect(statementById.get("BKLM_L03")?.proofRoutes[0]?.status)
      .toBe("proof-not-yet-distilled");
    expect(statementById.get("BKLM_L09")?.dependencies).toContain("BKLM_I14");
    expect(statementById.get("BKLM_L06")?.dependencies).toContain("BKLM_I19");
    expect(statementById.get("BKLM_L06")?.proofRoutes[0]?.status)
      .toBe("proof-not-yet-distilled");
    expect(statementById.get("BKLM_T03")?.proofRoutes[0]?.status)
      .toBe("proof-not-yet-distilled");
    expect(statementById.get("BKLM_L01")?.proofRoutes[0]?.status)
      .toBe("proof-not-yet-distilled");
    expect(statementById.get("BKLM_L01")?.statementNote).toContain("tail condition is vacuous");
    expect(statementById.get("BKLM_D08")?.exactStatement).toContain(
      "partition induced by a uniformly random incident edge",
    );
    expect(statementById.get("BKLM_D09")?.dependencies).toEqual(["BKLM_D13"]);
    expect(statementById.get("BKLM_L09")?.dependencies).toContain("BKLM_D13");
    expect(statementById.get("BKLM_L07")?.exactStatement).toContain(
      "every $(\\alpha,\\zeta)$-coupling",
    );
    expect(statementById.get("BKLM_L08")?.exactStatement).toContain(
      "$\\beta n/2\\in\\mathbb N$",
    );
    expect(statementById.get("BKLM_T06")?.proofRoutes[0]?.status).toBe("proof-not-yet-distilled");
    expect(statementById.get("BKLM_T06")?.statementNote).toContain("line-graph connectivity");
    expect(statementById.get("BKLM_T05")?.dependencies).toEqual(
      expect.arrayContaining(["BKLM_I11", "BKLM_I12", "BKLM_C04", "BKLM_C05", "BKLM_C06"]),
    );
    expect(statementById.get("BKLM_T07")?.proofRoutes[0]?.proof)
      .toContain("Proof not yet distilled");
    expect(statementById.get("BKLM_L08")?.statementNote).toContain("restores");
    expect(paperStatements.every((statement) =>
      statement.formalDeclarations.length === 0 && statement.formalStatus === "statement-only"
    )).toBe(true);
  });

  it("orders selected prerequisites before the main theorem", () => {
    const order = topologicalReadingOrder(["S01_T01"], { expandPrerequisites: true });
    const positions = new Map(order.map((statement, index) => [statement.id, index]));
    for (const statement of order) {
      for (const dependency of statement.proofRoutes[0]?.dependencies ?? statement.dependencies) {
        const dependencyPosition = positions.get(dependency);
        const statementPosition = positions.get(statement.id);
        if (dependencyPosition === undefined || statementPosition === undefined) {
          throw new Error(`Reading order omitted ${dependency} or ${statement.id}`);
        }
        expect(dependencyPosition).toBeLessThan(statementPosition);
      }
    }
    expect(order.at(-1)?.id).toBe("S01_T01");
  });

  it("has graph roots that resolve to the featured paper", () => {
    const paper = paperById.get("dimension-free-dictatorship-tester");
    expect(paper?.featured).toBe(true);
    expect(statementById.get(paper?.graph.mainRoot ?? "")?.paperId).toBe(paper?.id);
  });

  it("represents every actual direct citation and does not invent incoming closure", () => {
    const featured = paperById.get("dimension-free-dictatorship-tester");
    const multisliceId =
      "braverman-khot-lifshitz-minzer-2025-invariance-principle-multislice";
    const multislice = paperById.get(multisliceId);
    const citedIds = new Set(corpus.citationEdges.map((edge) => edge.citedPaperId));

    expect(corpus.papers.length).toBeGreaterThanOrEqual(2_000);
    expect(corpus.papers.filter((paper) => paper.status === "gold")).toHaveLength(2);
    expect(corpus.citationEdges.length).toBeGreaterThanOrEqual(2_000);
    expect(corpus.ingestionQueue).toHaveLength(corpus.papers.length);
    expect(corpus.ingestionQueue.filter((item) => item.state === "metadata-fetched").length)
      .toBeGreaterThanOrEqual(2_000);
    expect(corpus.ingestionQueue.filter((item) => item.state === "blocked")).toHaveLength(36);
    expect(corpus.ingestionQueue.filter((item) => item.state === "blocked")
      .every((item) => !paperById.get(item.paperId)?.identifiers.openAlex)).toBe(true);
    expect(corpus.ingestionQueue.filter((item) => item.state === "neighbors-fetched")).toHaveLength(1);
    expect(corpus.ingestionQueue.filter((item) => item.state === "complete-direct-neighborhood").length)
      .toBeGreaterThanOrEqual(3);
    expect(citationAudit.records).toHaveLength(17);
    expect(citationAudit.records.every((record) => citedIds.has(record.id))).toBe(true);
    expect(featured?.citationCoverage).toMatchObject({
      outgoingFound: 17,
      outgoingResolved: 17,
      incomingFound: 0,
      incomingResolved: 0,
      incomingStatus: "target-unindexed",
      providerSearchesAttempted: 5,
      recursiveClosureComplete: false,
    });
    expect(multislice?.citationCoverage).toMatchObject({
      outgoingFound: 48,
      outgoingResolved: 48,
      incomingFound: 28,
      incomingResolved: 28,
      incomingStatus: "provider-visible-only",
      recursiveClosureComplete: false,
    });
    expect(corpus.citationEdges.filter((edge) =>
      edge.discoveredFromPaperId === multisliceId && edge.discoveryDirection === "outgoing"
    )).toHaveLength(48);
    expect(corpus.citationEdges.filter((edge) =>
      edge.discoveredFromPaperId === multisliceId && edge.discoveryDirection === "incoming"
    )).toHaveLength(28);
    expect(citationAudit.bibliographyOnly.every((entry) =>
      corpus.papers.every((paper) => paper.identifiers.doi !== entry.identifiers.doi),
    )).toBe(true);
    expect(paperById.get("james-kerber-1981-representation-theory-symmetric-group")?.citationCoverage)
      .toMatchObject({
        incomingStatus: "identifier-unresolved",
        recursiveClosureComplete: false,
        note: expect.stringContaining("blocked pending identifier resolution"),
      });
  });
});

describe("schema failure cases", () => {
  it("rejects duplicate normalized stable identifiers", () => {
    const invalid = structuredClone(corpus);
    const owner = invalid.papers[0];
    const duplicate = invalid.papers[1];
    if (!owner || !duplicate) throw new Error("fixture missing paper records");
    duplicate.identifiers.internal = owner.identifiers.internal;
    expect(() => validateCorpus(invalid)).toThrow(/duplicate stable identifier/i);
  });

  it("rejects duplicate ingestion queue items", () => {
    const invalid = structuredClone(corpus);
    const queueItem = invalid.ingestionQueue[0];
    if (!queueItem) throw new Error("fixture missing ingestion queue item");
    invalid.ingestionQueue.push(structuredClone(queueItem));
    expect(() => validateCorpus(invalid)).toThrow(/duplicate queue item/i);
  });

  it("rejects duplicate citation endpoint pairs even under distinct edge IDs", () => {
    const invalid = structuredClone(corpus);
    const edge = invalid.citationEdges[0];
    if (!edge) throw new Error("fixture missing citation edge");
    invalid.citationEdges.push({ ...structuredClone(edge), id: `${edge.id}-duplicate` });
    expect(() => validateCorpus(invalid)).toThrow(/duplicate citation endpoint pair/i);
  });

  it("rejects impossible citation coverage claims", () => {
    const overResolved = structuredClone(corpus);
    const overResolvedPaper = overResolved.papers[0];
    if (!overResolvedPaper) throw new Error("fixture missing paper record");
    overResolvedPaper.citationCoverage.outgoingResolved =
      overResolvedPaper.citationCoverage.outgoingFound + 1;
    expect(() => validateCorpus(overResolved)).toThrow(/resolved above found/i);

    const falselyComplete = structuredClone(corpus);
    const falselyCompletePaper = falselyComplete.papers[0];
    if (!falselyCompletePaper) throw new Error("fixture missing paper record");
    falselyCompletePaper.citationCoverage.incomingFound = 1;
    falselyCompletePaper.citationCoverage.incomingResolved = 0;
    falselyCompletePaper.citationCoverage.incomingStatus = "complete";
    expect(() => validateCorpus(falselyComplete)).toThrow(/complete incoming coverage/i);

    const impossibleClosure = structuredClone(corpus);
    const impossibleClosurePaper = impossibleClosure.papers[0];
    if (!impossibleClosurePaper) throw new Error("fixture missing paper record");
    impossibleClosurePaper.citationCoverage.recursiveClosureComplete = true;
    expect(() => validateCorpus(impossibleClosure)).toThrow(/impossible recursive citation-closure claim/i);
  });

  it("rejects duplicate proof route and proof step IDs", () => {
    const duplicateRoute = structuredClone(corpus);
    const routeStatement = duplicateRoute.statements.find((statement) => statement.id === "S01_T01");
    const route = routeStatement?.proofRoutes[0];
    if (!routeStatement || !route) throw new Error("fixture missing S01_T01 proof route");
    routeStatement.proofRoutes.push(structuredClone(route));
    expect(() => validateCorpus(duplicateRoute)).toThrow(/duplicate proof route ID/i);

    const duplicateStep = structuredClone(corpus);
    const stepRoute = duplicateStep.statements.find((statement) => statement.id === "S01_T01")
      ?.proofRoutes[0];
    const step = stepRoute?.steps[0];
    if (!stepRoute || !step) throw new Error("fixture missing S01_T01 proof step");
    stepRoute.steps.push(structuredClone(step));
    expect(() => validateCorpus(duplicateStep)).toThrow(/duplicate proof step ID/i);
  });

  it("rejects impossible fully-certified proof routes", () => {
    const invalid = structuredClone(corpus);
    const route = invalid.statements.find((statement) => statement.id === "S01_T01")
      ?.proofRoutes[0];
    if (!route) throw new Error("fixture missing S01_T01 proof route");
    route.verificationStatus = "fully-certified";
    route.formalAlignment = "pending";
    expect(() => validateCorpus(invalid)).toThrow(/impossible fully-certified route state/i);
  });

  it("requires preserved source wording and its audit note to travel together", () => {
    const invalid = structuredClone(corpus);
    const statement = invalid.statements.find((item) => item.id === "S02_T01");
    if (!statement) throw new Error("fixture missing S02_T01");
    delete statement.statementNote;
    expect(() => validateCorpus(invalid)).toThrow(/pair preserved source wording/i);
  });

  it("rejects a missing dependency target", () => {
    const invalid = structuredClone(corpus);
    invalid.statements[0]?.dependencies.push("DOES_NOT_EXIST");
    invalid.statements[0]?.proofRoutes[0]?.dependencies.push("DOES_NOT_EXIST");
    expect(() => validateCorpus(invalid)).toThrow(/missing dependency/i);
  });

  it("rejects an undeclared proof reference", () => {
    const invalid = structuredClone(corpus);
    invalid.statements[0]?.proofRoutes[0]?.steps[0]?.dependencyRefs.push("S05_L01");
    expect(() => validateCorpus(invalid)).toThrow(/undeclared proof reference/i);
  });

  it("rejects a citation whose discovery direction contradicts its source", () => {
    const invalid = structuredClone(corpus);
    const edge = invalid.citationEdges[0];
    if (!edge) throw new Error("fixture missing citation edge");
    edge.discoveredFromPaperId = edge.citedPaperId;
    expect(() => validateCorpus(invalid)).toThrow(/inconsistent discovery direction/i);
  });

  it("rejects an unreviewed cycle", () => {
    const invalid = structuredClone(corpus);
    const target = invalid.statements.find((statement) => statement.id === "S02_L03");
    if (!target) throw new Error("fixture missing S02_L03");
    const route = target.proofRoutes[0];
    const step = route?.steps[0];
    if (!route || !step) throw new Error("fixture missing S02_L03 proof route");
    target.dependencies = ["S01_T01"];
    route.dependencies = ["S01_T01"];
    step.dependencyRefs = ["S01_T01"];
    expect(() => validateCorpus(invalid)).toThrow(/cycle/i);
  });
});
