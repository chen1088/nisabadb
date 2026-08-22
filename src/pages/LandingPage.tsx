import { Link } from "react-router-dom";
import { corpus, getPaperStatements, verificationMeta } from "../components/content";
import { knowledgeNodes } from "../data/knowledge";

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
          <p className="eyebrow">For a learner starting with no mathematics background</p>
          <h1>
            From first steps
            <span>to research mathematics.</span>
          </h1>
          <p className="hero-lede">
            NisabaDB rewrites mathematics into one connected textbook, exposing every dependency
            between a person’s first symbol and the theorem they want to understand. The goal is
            the smallest honest route—not the usual stack of courses.
          </p>
          <div className="hero-actions">
            <Link className="button-link primary-button" to="/knowledge">
              Start the living textbook <span aria-hidden="true">→</span>
            </Link>
            <Link className="button-link subtle-button" to="/papers">
              Explore {corpus.papers.length.toLocaleString()} papers
            </Link>
          </div>
        </div>
        <div className="hero-graph" aria-label="A research goal connected to prerequisite knowledge">
          <div className="hero-graph-caption">
            <span>One destination</span>
            <span>Every candidate bridge exposed</span>
          </div>
          <div className="mini-node mini-node-hero">
            <small>Research destination</small>
            <strong>Understand dictatorship testing</strong>
            <span>current route · not yet claimed minimal</span>
          </div>
          <div className="mini-branch" aria-hidden="true" />
          <div className="mini-node-grid">
            <div className="mini-node">
              <small>Shared foundation</small>
              <strong>Proof + finite probability</strong>
            </div>
            <div className="mini-node">
              <small>Computational bridge</small>
              <strong>Groups + Young diagrams</strong>
            </div>
          </div>
          <p className="hero-graph-note">
            Start-level diagnostics · alternate routes · source rights · paper provenance
          </p>
        </div>
      </section>

      <section className="principles-section" aria-labelledby="principles-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The learner DAG is not the textbook shelf</p>
            <h2 id="principles-title">Begin with the person. End at the theorem.</h2>
          </div>
          <p>
            We use books and papers as evidence, extract only what a goal needs, and compare
            competing routes before declaring any piece of mathematics essential.
          </p>
        </div>
        <div className="principle-grid">
          <article>
            <span className="principle-number">01</span>
            <h3>Start where the learner is</h3>
            <p>
              Diagnose missing arithmetic or algebra one idea at a time. Known material is
              skipped; a beginner is never told to “go learn the prerequisites” alone.
            </p>
          </article>
          <article>
            <span className="principle-number">02</span>
            <h3>Make abstractions executable</h3>
            <p>
              Concrete examples and software experiments can carry a shared core from linear
              algebra into groups, representations, probability, and algorithms.
            </p>
          </article>
          <article>
            <span className="principle-number">03</span>
            <h3>Compare before compressing</h3>
            <p>
              Original, minimized, and reinterpreted routes remain visible. Compression is a
              reviewed mathematical claim, not a promise made by the interface.
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
                <dt>Formally checked</dt>
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
          <strong>{knowledgeNodes.length}</strong>
          <span>rewritten knowledge nodes</span>
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
