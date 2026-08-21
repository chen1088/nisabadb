import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="not-found page-shell">
      <p className="eyebrow">Record not found</p>
      <h1>This mathematical path is not in the corpus.</h1>
      <p>The identifier may have changed, or the paper may still be awaiting ingestion.</p>
      <div>
        <Link className="button-link primary-button" to="/papers">
          Browse papers
        </Link>
        <Link className="button-link subtle-button" to="/">
          Return home
        </Link>
      </div>
    </section>
  );
}
