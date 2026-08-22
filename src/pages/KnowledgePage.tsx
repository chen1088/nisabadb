import { Link } from "react-router-dom";
import { corpus } from "../components/content";
import { materials } from "../data/materials";

const goldPapers = corpus.papers.filter((paper) => paper.status === "gold").length;
const provisionalPapers = corpus.papers.length - goldPapers;

export function KnowledgePage() {
  return (
    <div className="knowledge-page page-shell">
      <header className="page-hero compact-page-hero knowledge-hero knowledge-hero-gated">
        <p className="eyebrow">Canonical layer · deliberately gated</p>
        <h1>Knowledge is what survives compression.</h1>
        <p>
          A textbook, chapter, or paper is not one piece of Knowledge. NisabaDB must extract
          the small ideas they use, forge beginner-friendly bridges between them, and compare
          alternate routes before claiming a minimum prerequisite graph.
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
            <span>Checked learning sources</span>
            <strong>{materials.length}</strong>
            <small>Evidence containers, not curriculum nodes</small>
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
          <h2 id="knowledge-gate-title">A source map is not yet a learning path.</h2>
          <p>
            The current Materials DAG shows where useful explanations may be found. The paper
            DAGs show how two research results are proved. A canonical Knowledge node needs a
            minimized description, a tutorial for someone arriving with exactly its listed
            prerequisites, reviewed equivalence boundaries, and evidence that every edge is used.
          </p>
          <Link className="button-link primary-action" to="/materials">
            Inspect the source collection <span aria-hidden="true">→</span>
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
              <h3>Collect the source universe</h3>
              <p>Map research papers and basic-to-advanced learning materials with precise provenance and reuse boundaries.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Extract small ideas</h3>
              <p>Break papers and books into definitions, algorithms, examples, exact claims, and the dependencies they actually use.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Forge and compare bridges</h3>
              <p>Write independent beginner tutorials, computational reinterpretations, and alternate routes; measure their prerequisite cost.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Verify and compress</h3>
              <p>Administrators approve source-independent nodes only after mathematical, pedagogical, and formal evidence survives review.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
