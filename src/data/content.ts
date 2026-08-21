import rawCorpus from "./corpus.json";
import { validateCorpus, type Paper, type ProofRoute, type Statement } from "./schema";

export const corpus = validateCorpus(rawCorpus);
export const papers = corpus.papers;
export const statements = corpus.statements;
export const paperById = new Map(papers.map((paper) => [paper.id, paper]));
export const statementById = new Map(statements.map((statement) => [statement.id, statement]));
export const statementByGlobalId = new Map(
  statements.map((statement) => [statement.globalStatementId, statement]),
);

export function getPaper(id: string | undefined): Paper | undefined {
  return id ? paperById.get(id) : undefined;
}

export function getStatement(id: string | undefined): Statement | undefined {
  return id ? statementById.get(id) ?? statementByGlobalId.get(id) : undefined;
}

export function statementsForPaper(paperId: string): Statement[] {
  return statements.filter((statement) => statement.paperId === paperId);
}

export function selectedRoute(statement: Statement, routeId?: string): ProofRoute | undefined {
  return statement.proofRoutes.find((route) => route.id === routeId) ?? statement.proofRoutes[0];
}

export function routeDependencies(statement: Statement, routeId?: string): string[] {
  return selectedRoute(statement, routeId)?.dependencies ?? statement.dependencies;
}

export function dependentsFor(statementId: string): Statement[] {
  return statements.filter((statement) => statement.dependencies.includes(statementId));
}

export function collectPrerequisites(rootId: string, routeByStatement: ReadonlyMap<string, string> = new Map()): Set<string> {
  const collected = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (collected.has(id) || visiting.has(id)) return;
    const statement = statementById.get(id);
    if (!statement) return;
    visiting.add(id);
    for (const dependency of routeDependencies(statement, routeByStatement.get(id))) visit(dependency);
    visiting.delete(id);
    collected.add(id);
  };

  visit(rootId);
  return collected;
}

export function topologicalReadingOrder(
  roots: readonly string[],
  options: { expandPrerequisites: boolean; routeByStatement?: ReadonlyMap<string, string> },
): Statement[] {
  const included = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Statement[] = [];
  const routeByStatement = options.routeByStatement ?? new Map<string, string>();

  const visit = (id: string) => {
    if (included.has(id) || visiting.has(id)) return;
    const statement = statementById.get(id);
    if (!statement) return;
    visiting.add(id);
    if (options.expandPrerequisites) {
      routeDependencies(statement, routeByStatement.get(id)).forEach(visit);
    }
    visiting.delete(id);
    included.add(id);
    ordered.push(statement);
  };

  roots.forEach(visit);
  return ordered;
}

export function proofCoverage(paperId: string) {
  const theoremLike = statementsForPaper(paperId).filter((statement) =>
    ["theorem", "lemma", "proposition", "corollary", "imported-result"].includes(
      statement.kind,
    ),
  );
  const complete = theoremLike.filter((statement) =>
    statement.proofRoutes.some((route) => route.status === "complete"),
  );
  return {
    total: theoremLike.length,
    complete: complete.length,
    pending: theoremLike.length - complete.length,
  };
}

export function formalCoverage(paperId: string) {
  const paperStatements = statementsForPaper(paperId);
  const withDeclarations = paperStatements.filter((statement) => statement.formalDeclarations.length > 0);
  const kernelChecked = paperStatements.filter((statement) =>
    statement.formalDeclarations.length > 0 &&
    statement.formalDeclarations.every((declaration) => declaration.kernelChecks),
  );
  const conditional = paperStatements.filter((statement) =>
    statement.formalDeclarations.some((declaration) => declaration.usesExternalInput),
  );
  return {
    total: paperStatements.length,
    withDeclarations: withDeclarations.length,
    kernelChecked: kernelChecked.length,
    conditional: conditional.length,
  };
}

export function theoremPath(statement: Statement): string {
  return `/theorems/${statement.globalStatementId}`;
}
