import { Link, useParams } from "react-router-dom";
import { GraphExplorer } from "../components/GraphExplorer";
import { CitationNeighborhood, FormalCoveragePanel } from "../components/PaperPanels";
import {
  formatDate,
  getPaperStatements,
  isTheoremLike,
  paperById,
  shortIdentifier,
} from "../components/content";
import { NotFoundPage } from "./NotFoundPage";

export function PaperPage() {
  const { paperId } = useParams();
  const paper = paperId ? paperById.get(paperId) : undefined;
  if (!paper) return <NotFoundPage />;
  const statements = getPaperStatements(paper.id);
  const resultCount = statements.filter(isTheoremLike).length;
  const conjectureCount = statements.filter((statement) => statement.kind === "conjecture").length;
  const referenceCount = statements.length - resultCount - conjectureCount;

  return (
    <div className="paper-page">
      <header className="paper-hero page-shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/papers">Papers</Link>
          <span aria-hidden="true">/</span>
          <span>{paper.status === "gold" ? "Gold rewrite" : "Provisional record"}</span>
        </nav>
        <div className="paper-hero-grid">
          <div>
            <div className="paper-status-line">
              <span className={`record-state record-${paper.status}`}>{paper.status}</span>
              {paper.featured ? <span>Featured first paper</span> : null}
            </div>
            <h1>{paper.title}</h1>
            <p className="paper-authors">{paper.authors.join(" · ")}</p>
            <p className="paper-contribution">{paper.contributionSummary}</p>
            <div className="paper-hero-actions">
              {paper.status === "gold" ? (
                <a className="button-link primary-button" href="#explorer">
                  Enter unified proof graph <span aria-hidden="true">↓</span>
                </a>
              ) : null}
              {statements.length ? (
                <Link className="button-link subtle-button" to={`/papers/${paper.id}/distilled`}>
                  Read distilled paper
                </Link>
              ) : null}
            </div>
          </div>
          <aside className="paper-facts" aria-label="Paper metadata">
            <dl>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(paper.date)}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>{paper.venue}</dd>
              </div>
              <div>
                <dt>Identifier</dt>
                <dd>{shortIdentifier(paper)}</dd>
              </div>
              <div>
                <dt>Corpus version</dt>
                <dd>{paper.version}</dd>
              </div>
            </dl>
            <div className="paper-fact-counts">
              <span>
                <strong>{resultCount}</strong> results
              </span>
              <span>
                <strong>{referenceCount}</strong> definitions & notation
              </span>
              {conjectureCount ? (
                <span>
                  <strong>{conjectureCount}</strong> conjecture{conjectureCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <div className="source-link-list">
              {paper.sourceLinks.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </aside>
        </div>
      </header>

      {paper.status === "gold" ? (
        <GraphExplorer paper={paper} statements={statements} />
      ) : (
        <section className="provisional-notice page-shell">
          <p className="eyebrow">Metadata-level inclusion</p>
          <h2>Mathematical distillation has not started</h2>
          <p>
            This citation-neighbor record preserves identifiers and provenance, but it does
            not yet claim theorem extraction, proof rewriting, or formal alignment.
          </p>
        </section>
      )}

      <div className="paper-evidence page-shell">
        <FormalCoveragePanel paper={paper} statements={statements} />
        <CitationNeighborhood paper={paper} />
      </div>
    </div>
  );
}
