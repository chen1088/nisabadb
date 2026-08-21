import { Link } from "react-router-dom";
import { corpus, getPaperStatements, verificationMeta } from "../components/content";

export function LandingPage() {
  const featured = corpus.papers.find((paper) => paper.featured) ?? corpus.papers[0];
  const featuredStatements = featured ? getPaperStatements(featured.id) : [];
  const checked = featuredStatements.filter(
    (statement) =>
      statement.formalDeclarations.length > 0 &&
      statement.formalDeclarations.every((declaration) => declaration.kernelChecks),
  ).length;

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">A proof-bearing mathematical library</p>
          <h1>
            The distilled, verified
            <span>graph of mathematics.</span>
          </h1>
          <p className="hero-lede">
            NisabaDB rewrites papers as navigable networks of precise statements,
            shortened proofs, dependencies, and formal evidence—without hiding what remains
            unaudited.
          </p>
          <div className="hero-actions">
            {featured ? (
              <Link className="button-link primary-button" to={`/papers/${featured.id}`}>
                Explore the first paper <span aria-hidden="true">→</span>
              </Link>
            ) : null}
            <Link className="button-link subtle-button" to="/papers">
              Browse the catalog
            </Link>
          </div>
        </div>
        <div className="hero-graph" aria-label="A theorem connected to its proof prerequisites">
          <div className="hero-graph-caption">
            <span>One statement</span>
            <span>Every dependency exposed</span>
          </div>
          <div className="mini-node mini-node-hero">
            <small>Main theorem</small>
            <strong>Dimension-free testing</strong>
            <span>complete compressed route</span>
          </div>
          <div className="mini-branch" aria-hidden="true" />
          <div className="mini-node-grid">
            <div className="mini-node">
              <small>Definition 2.1</small>
              <strong>Finite-seed tester</strong>
            </div>
            <div className="mini-node">
              <small>Lemma 4.7</small>
              <strong>Independent repetition</strong>
            </div>
          </div>
          <p className="hero-graph-note">
            Exact statements · compressed proofs · Lean declarations · source provenance
          </p>
        </div>
      </section>

      <section className="principles-section" aria-labelledby="principles-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The graph is the rewritten paper</p>
            <h2 id="principles-title">Read the logic, not just the conclusion</h2>
          </div>
          <p>
            Every displayed prerequisite must be used. Every nontrivial imported fact must
            be visible. Missing work is marked, never papered over.
          </p>
        </div>
        <div className="principle-grid">
          <article>
            <span className="principle-number">01</span>
            <h3>Distilled proofs</h3>
            <p>
              Human-readable routes preserve hypotheses, constants, restrictions, and edge
              cases while removing incidental exposition.
            </p>
          </article>
          <article>
            <span className="principle-number">02</span>
            <h3>Explicit dependencies</h3>
            <p>
              Follow a proof backward through definitions, imported results, and alternate
              routes without leaving the mathematical context.
            </p>
          </article>
          <article>
            <span className="principle-number">03</span>
            <h3>Granular verification</h3>
            <p>
              Kernel checking, axiom audits, and human–formal alignment remain separate,
              inspectable claims.
            </p>
          </article>
        </div>
      </section>

      {featured ? (
        <section className="featured-paper-section" aria-labelledby="featured-paper-title">
          <div className="featured-paper-label">
            <span>Featured gold rewrite</span>
            <span>Paper 001</span>
          </div>
          <div className="featured-paper-main">
            <div>
              <p className="paper-authors">{featured.authors.join(" · ")}</p>
              <h2 id="featured-paper-title">{featured.title}</h2>
              <p>{featured.contributionSummary}</p>
              <Link className="text-link with-arrow" to={`/papers/${featured.id}`}>
                Open proof graph <span aria-hidden="true">→</span>
              </Link>
            </div>
            <dl className="featured-metrics">
              <div>
                <dt>Statements</dt>
                <dd>{featuredStatements.length}</dd>
              </div>
              <div>
                <dt>Kernel checked</dt>
                <dd>{checked}</dd>
              </div>
              <div>
                <dt>Formal status</dt>
                <dd>{verificationMeta[featured.formalizationStatus].label}</dd>
              </div>
              <div>
                <dt>Query bound</dt>
                <dd>
                  <span aria-label="Big O epsilon to the negative two">O(ε⁻²)</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="corpus-strip" aria-label="Corpus status">
        <div>
          <strong>{corpus.papers.length}</strong>
          <span>paper records</span>
        </div>
        <div>
          <strong>{corpus.statements.length}</strong>
          <span>mathematical statements</span>
        </div>
        <div>
          <strong>{corpus.citationEdges.length}</strong>
          <span>citation edges with provenance</span>
        </div>
        <p>Corpus snapshot {new Date(corpus.generatedAt).toLocaleDateString("en", { dateStyle: "long" })}</p>
      </section>
    </div>
  );
}
