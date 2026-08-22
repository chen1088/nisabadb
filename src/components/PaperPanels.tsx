import { Link } from "react-router-dom";
import type { Paper, Statement } from "../data/schema";
import {
  corpus,
  formatDate,
  isTheoremLike,
  paperById,
  shortIdentifier,
  verificationMeta,
} from "./content";

interface FormalCoveragePanelProps {
  paper: Paper;
  statements: Statement[];
}

export function FormalCoveragePanel({ paper, statements }: FormalCoveragePanelProps) {
  const theoremLike = statements.filter(isTheoremLike);
  const checked = statements.filter(
    (statement) =>
      statement.formalDeclarations.length > 0 &&
      statement.formalDeclarations.every((declaration) => declaration.kernelChecks),
  ).length;
  const aligned = statements.filter((statement) => statement.formalAlignment === "reviewed").length;
  const completeRoutes = theoremLike.filter((statement) =>
    statement.proofRoutes.some((route) => route.status === "complete"),
  ).length;
  const declarations = statements.reduce(
    (total, statement) => total + statement.formalDeclarations.length,
    0,
  );
  const proverSystems = new Set(
    statements.flatMap((statement) =>
      statement.formalDeclarations.map((declaration) => declaration.prover.label),
    ),
  );
  const checkedPercent = statements.length ? Math.round((checked / statements.length) * 100) : 0;

  return (
    <section className="evidence-panel formal-coverage" aria-labelledby="formal-coverage-title">
      <div className="evidence-panel-heading">
        <div>
          <p className="eyebrow">Formal coverage</p>
          <h2 id="formal-coverage-title">Evidence, not a blanket badge</h2>
        </div>
        <span className="coverage-status">
          {verificationMeta[paper.formalizationStatus].label}
        </span>
      </div>
      <p>
        Checker acceptance, proof distillation, and human–formal alignment are reported
        independently. Similar declaration names are not treated as certification.
      </p>
      <div className="coverage-meter" aria-label={`${checkedPercent}% of statement records have checker-accepted artifacts`}>
        <span style={{ width: `${checkedPercent}%` }} />
      </div>
      <div className="coverage-stat-grid">
        <div>
          <strong>{checked}</strong>
          <span>of {statements.length} statement records have checker-accepted artifacts</span>
        </div>
        <div>
          <strong>{completeRoutes}</strong>
          <span>of {theoremLike.length} result nodes have complete distilled routes</span>
        </div>
        <div>
          <strong>{aligned}</strong>
          <span>human–formal alignments reviewed</span>
        </div>
        <div>
          <strong>{declarations}</strong>
          <span>formal artifacts across {proverSystems.size} prover system{proverSystems.size === 1 ? "" : "s"}</span>
        </div>
      </div>
      <aside className="prover-intake-note" aria-label="Prover-neutral verification intake">
        <strong>Prover-neutral by design</strong>
        <p>
          Lean is the first populated adapter, not a platform restriction. Versioned proof
          artifacts from Rocq/Coq, Isabelle, Agda, HOL systems, Metamath, Mizar, and other
          reproducible checkers can enter the same sandboxed verification and admin-review flow.
        </p>
      </aside>
    </section>
  );
}

interface CitationNeighborhoodProps {
  paper: Paper;
}

function NeighborList({
  items,
  paper,
  empty,
}: {
  items: typeof corpus.citationEdges;
  paper: Paper;
  empty: string;
}) {
  return (
    <div className="citation-column">
      {items.length ? (
        <ul>
          {items.map((edge) => {
            const neighborId =
              edge.citingPaperId === paper.id ? edge.citedPaperId : edge.citingPaperId;
            const neighbor = paperById.get(neighborId);
            if (!neighbor) return null;
            return (
              <li key={edge.id}>
                <Link to={`/papers/${neighbor.id}`}>
                  <strong>{neighbor.title}</strong>
                  <span>{neighbor.authors.join(", ")}</span>
                  <small>
                    {neighbor.date.slice(0, 4)} · {shortIdentifier(neighbor)}
                  </small>
                </Link>
                <span className={`record-state record-${neighbor.status}`}>{neighbor.status}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="citation-empty">{empty}</p>
      )}
    </div>
  );
}

export function CitationNeighborhood({ paper }: CitationNeighborhoodProps) {
  const edges = corpus.citationEdges.filter(
    (edge) => edge.citingPaperId === paper.id || edge.citedPaperId === paper.id,
  );
  const queueItem = corpus.ingestionQueue.find((item) => item.paperId === paper.id);
  const outgoing = edges.filter((edge) => edge.citingPaperId === paper.id);
  const incoming = edges.filter((edge) => edge.citedPaperId === paper.id);
  const coverage = paper.citationCoverage;
  const unresolvedOutgoing = Math.max(0, coverage.outgoingFound - coverage.outgoingResolved);
  const unresolvedIncoming = Math.max(0, coverage.incomingFound - coverage.incomingResolved);

  return (
    <section className="evidence-panel citation-neighborhood" aria-labelledby="citation-title">
      <div className="evidence-panel-heading">
        <div>
          <p className="eyebrow">Citation neighborhood</p>
          <h2 id="citation-title">The paper in its mathematical neighborhood</h2>
        </div>
        <span className="queue-state">Queue: {queueItem?.state.replaceAll("-", " ") ?? "not queued"}</span>
      </div>
      <p>
        Direct references and citing papers receive provisional records before mathematical
        distillation. Provenance is retained for every edge.
      </p>
      <div className="citation-coverage-grid" aria-label="Citation crawl coverage">
        <div>
          <span>Outgoing metadata</span>
          <strong>
            {coverage.outgoingResolved} / {coverage.outgoingFound}
          </strong>
          <small>{unresolvedOutgoing} unresolved provider IDs</small>
        </div>
        <div>
          <span>Incoming metadata</span>
          <strong>
            {coverage.incomingResolved} / {coverage.incomingFound}
          </strong>
          <small>
            {coverage.incomingStatus.replaceAll("-", " ")} · {unresolvedIncoming} unresolved
          </small>
        </div>
        <div>
          <span>Provider searches</span>
          <strong>{coverage.providerSearchesAttempted}</strong>
          <small>recorded attempts</small>
        </div>
        <div>
          <span>OpenAlex work ID</span>
          <strong>{paper.identifiers.openAlex ?? "Unresolved"}</strong>
          <small>{coverage.recursiveClosureComplete ? "recursive closure complete" : "recursive closure open"}</small>
        </div>
      </div>
      <p className="citation-coverage-note">{coverage.note}</p>
      {queueItem?.unresolvedProviderIds?.length ? (
        <aside className="citation-unresolved-ids" aria-label="Unresolved provider identifiers">
          <strong>Retained unresolved provider IDs</strong>
          <ul>
            {queueItem.unresolvedProviderIds.map((providerId) => (
              <li key={providerId}>
                <code>{providerId}</code>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      {queueItem?.lastError ? (
        <aside className="citation-queue-error" aria-label="Citation queue error">
          <strong>Why this queue item is blocked</strong>
          <p>{queueItem.lastError}</p>
        </aside>
      ) : null}
      <div className="citation-grid">
        <div>
          <h3>
            Cited by this paper <span>{outgoing.length}</span>
          </h3>
          <NeighborList
            items={outgoing}
            paper={paper}
            empty="Outgoing references have not yet been resolved into the public corpus."
          />
        </div>
        <div>
          <h3>
            Papers citing this work <span>{incoming.length}</span>
          </h3>
          <NeighborList
            items={incoming}
            paper={paper}
            empty="Incoming citations have not yet been resolved into the public corpus."
          />
        </div>
      </div>
      <footer className="queue-note">
        <span>
          Last queue update {queueItem ? formatDate(queueItem.updatedAt.slice(0, 10)) : "not available"}
        </span>
        <span>
          Next: {queueItem?.nextTasks.map((task) => task.replaceAll("-", " ")).join(" · ") || "none recorded"}
        </span>
      </footer>
    </section>
  );
}
