import rawCorpus from "../data/corpus.json";
import type {
  Corpus,
  Paper,
  ProofRoute,
  Statement,
  VerificationStatus,
} from "../data/schema";

// The corpus is schema-validated by the build-time content test. Keeping validation
// out of the browser avoids shipping the validator with every static page.
export const corpus = rawCorpus as unknown as Corpus;

export const paperById = new Map(corpus.papers.map((paper) => [paper.id, paper]));
export const statementById = new Map(
  corpus.statements.map((statement) => [statement.id, statement]),
);
export const statementByGlobalId = new Map(
  corpus.statements.map((statement) => [statement.globalStatementId, statement]),
);

export const verificationMeta: Record<
  VerificationStatus,
  { label: string; tone: "quiet" | "caution" | "positive" | "strong" }
> = {
  "statement-only": { label: "Statement only", tone: "quiet" },
  "formalization-drafted": { label: "Formalization drafted", tone: "caution" },
  "conditional-formalization": { label: "Conditional formalization", tone: "caution" },
  "kernel-checked": { label: "Kernel checked", tone: "positive" },
  "axiom-audited": { label: "Axiom audited", tone: "positive" },
  "human-formal-alignment-pending": {
    label: "Alignment pending",
    tone: "caution",
  },
  "alignment-reviewed": { label: "Alignment reviewed", tone: "positive" },
  "fully-certified": { label: "Fully certified", tone: "strong" },
};

export const kindLabels: Record<Statement["kind"], string> = {
  theorem: "Theorem",
  lemma: "Lemma",
  proposition: "Proposition",
  corollary: "Corollary",
  definition: "Definition",
  notation: "Notation",
  "imported-result": "Imported result",
};

export function getPaperStatements(paperId: string): Statement[] {
  return corpus.statements.filter((statement) => statement.paperId === paperId);
}

export function getRoute(statement: Statement, routeId?: string | null): ProofRoute | undefined {
  return (
    statement.proofRoutes.find((route) => route.id === routeId) ??
    statement.proofRoutes[0]
  );
}

export function getDependencyIds(statement: Statement, routeId?: string | null): string[] {
  return getRoute(statement, routeId)?.dependencies ?? statement.dependencies;
}

export function theoremPath(statement: Statement): string {
  return `/theorems/${encodeURIComponent(statement.globalStatementId)}`;
}

export function graphPath(
  paper: Paper,
  statement: Statement,
  options?: { routeId?: string; viewId?: string },
): string {
  const parameters = new URLSearchParams({ node: statement.id });
  if (options?.viewId) parameters.set("view", options.viewId);
  if (options?.routeId) parameters.set("route", options.routeId);
  return `/papers/${paper.id}?${parameters.toString()}#explorer`;
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function shortIdentifier(paper: Paper): string {
  if (paper.identifiers.doi) return `DOI ${paper.identifiers.doi}`;
  if (paper.identifiers.arxiv) return `arXiv ${paper.identifiers.arxiv}`;
  if (paper.identifiers.openAlex) return `OpenAlex ${paper.identifiers.openAlex}`;
  return paper.identifiers.internal ?? paper.id;
}

export function repositoryUrl(
  repository: string,
  commit: string,
  file: string,
  line?: number,
): string {
  return `https://github.com/${repository}/blob/${commit}/${file}${line ? `#L${line}` : ""}`;
}

export function isTheoremLike(statement: Statement): boolean {
  return !["definition", "notation"].includes(statement.kind);
}
