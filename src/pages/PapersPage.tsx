import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  corpus,
  formatDate,
  getPaperStatements,
  shortIdentifier,
  verificationMeta,
} from "../components/content";

export function PapersPage() {
  const [query, setQuery] = useState("");
  const [recordStatus, setRecordStatus] = useState("all");
  const papers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return corpus.papers.filter((paper) => {
      if (recordStatus !== "all" && paper.status !== recordStatus) return false;
      if (!normalized) return true;
      return [
        paper.title,
        paper.authors.join(" "),
        paper.venue,
        paper.contributionSummary,
        ...Object.values(paper.identifiers),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [query, recordStatus]);

  return (
    <div className="catalog-page page-shell">
      <header className="page-hero compact-page-hero">
        <p className="eyebrow">Mathematical corpus</p>
        <h1>Paper catalog</h1>
        <p>
          Gold rewrites expose theorem-level mathematics. Provisional records mark citation
          neighbors awaiting extraction and review.
        </p>
      </header>

      <section className="catalog-controls" aria-label="Paper catalog filters">
        <label className="search-control">
          <span>Search the catalog</span>
          <span className="input-shell">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Title, author, venue, identifier…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <label>
          <span>Record class</span>
          <select value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)}>
            <option value="all">All records</option>
            <option value="gold">Gold rewrites</option>
            <option value="provisional">Provisional metadata</option>
          </select>
        </label>
        <p aria-live="polite">
          <strong>{papers.length}</strong> of {corpus.papers.length} records
        </p>
      </section>

      <div className="paper-list">
        {papers.map((paper, index) => {
          const statements = getPaperStatements(paper.id);
          return (
            <article key={paper.id} className={`paper-card paper-${paper.status}`}>
              <div className="paper-card-index">{String(index + 1).padStart(3, "0")}</div>
              <div className="paper-card-body">
                <div className="paper-card-topline">
                  <span className={`record-state record-${paper.status}`}>{paper.status}</span>
                  <span>{formatDate(paper.date)}</span>
                  <span>{paper.venue}</span>
                </div>
                <h2>
                  <Link to={`/papers/${paper.id}`}>{paper.title}</Link>
                </h2>
                <p className="paper-authors">{paper.authors.join(", ")}</p>
                <p>{paper.contributionSummary}</p>
                <div className="paper-card-footer">
                  <span>{shortIdentifier(paper)}</span>
                  <span>{statements.length} statement records</span>
                  <span>{verificationMeta[paper.formalizationStatus].label}</span>
                  <Link className="text-link with-arrow" to={`/papers/${paper.id}`}>
                    {paper.status === "gold" ? "Open rewrite" : "View record"}{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
        {!papers.length ? (
          <div className="empty-state">
            <strong>No papers match.</strong>
            <span>Clear the search or include both record classes.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
