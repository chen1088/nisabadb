import { corpus } from "../components/content";

export function UnsolvedPage() {
  const sourceCandidates = corpus.statements.filter((statement) => statement.kind === "conjecture").length;

  return (
    <div className="unsolved-page page-shell">
      <header className="page-hero compact-page-hero unsolved-hero">
        <p className="eyebrow">The reviewed mathematical frontier</p>
        <h1>Unsolved</h1>
        <p>
          Only problems with a precise statement and an administratively reviewed literature
          audit appear here. A failed proof attempt or missing distillation is not an open problem.
        </p>
      </header>

      <section className="unsolved-empty" aria-labelledby="unsolved-title">
        <div>
          <span className="empty-orbit" aria-hidden="true" />
          <p className="eyebrow">No public entries yet</p>
          <h2 id="unsolved-title">The empty list is intentional</h2>
          <p>
            NisabaDB currently has {sourceCandidates} source conjecture candidate
            {sourceCandidates === 1 ? "" : "s"}, but none has completed the separate
            “confirmed open as of” review required for this page.
          </p>
        </div>
        <ol>
          <li><strong>1</strong><span>Normalize the statement and equivalent formulations.</span></li>
          <li><strong>2</strong><span>Search terminology variants, versions, citations, and partial results.</span></li>
          <li><strong>3</strong><span>Record coverage, limitations, reviewers, and the last-checked date.</span></li>
          <li><strong>4</strong><span>An administrator may publish it as open-as-of-date.</span></li>
        </ol>
      </section>
    </div>
  );
}
