import { Link } from "react-router-dom";
import { corpus } from "../components/content";

const goldPapers = corpus.papers.filter((paper) => paper.status === "gold").length;
const provisionalPapers = corpus.papers.length - goldPapers;

export function KnowledgePage() {
  return (
    <div className="knowledge-page page-shell">
      <header className="page-hero compact-page-hero knowledge-hero knowledge-hero-gated">
        <p className="eyebrow">Later phase · deliberately gated</p>
        <h1>Knowledge comes after corpus coverage.</h1>
        <p>
          Two processed papers cannot support a meaningful global knowledge graph. NisabaDB
          must first collect thousands of papers and distill their internal proof DAGs; only
          then can repeated ideas be merged, simplified, and compressed responsibly.
        </p>
      </header>

      <section className="knowledge-gate" aria-labelledby="knowledge-gate-title">
        <div className="knowledge-gate-counts" aria-label="Knowledge activation status">
          <div>
            <span>Canonical knowledge nodes</span>
            <strong>0</strong>
            <small>No cross-paper merges claimed</small>
          </div>
          <div>
            <span>Processed source papers</span>
            <strong>{goldPapers}</strong>
            <small>Too little overlap for compression</small>
          </div>
          <div>
            <span>Provisional paper records</span>
            <strong>{provisionalPapers}</strong>
            <small>Corpus expansion is the active phase</small>
          </div>
        </div>

        <div className="knowledge-gate-copy">
          <p className="eyebrow">Why the graph is withheld</p>
          <h2 id="knowledge-gate-title">A small, disconnected sample produces fake simplicity.</h2>
          <p>
            Paper-level theorem nodes are not yet source-independent knowledge. A canonical
            Knowledge node needs evidence that the same idea recurs across papers, a reviewed
            equivalence boundary, and a dependency route that survives removal of paper-specific
            notation and exposition.
          </p>
          <Link className="button-link primary-action" to="/papers">
            Build the paper corpus first <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="knowledge-activation" aria-labelledby="knowledge-activation-title">
        <header>
          <p className="eyebrow">Activation sequence</p>
          <h2 id="knowledge-activation-title">How the real Knowledge DAG will be earned</h2>
        </header>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Collect the paper universe</h3>
              <p>Expand the citation graph into a resumable backlog of thousands of source records.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Process paper proof DAGs</h3>
              <p>Extract exact statements, dependencies, proof routes, and verification evidence paper by paper.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Detect genuine overlap</h3>
              <p>Propose cross-paper equivalences and reinterpretations without silently merging nearby claims.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Review and compress</h3>
              <p>Administrators approve canonical nodes, minimized descriptions, tutorials, and prerequisite routes.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
