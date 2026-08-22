import { Link } from "react-router-dom";
import { corpus } from "../components/content";

const goldPapers = corpus.papers.filter((paper) => paper.status === "gold");

export function LearnPage() {
  return (
    <div className="learn-page page-shell">
      <header className="page-hero compact-page-hero learn-hero knowledge-hero-gated">
        <p className="eyebrow">Later phase · deliberately gated</p>
        <h1>Training follows compression.</h1>
        <p>
          NisabaDB will not estimate a shortest curriculum or claim mastery tests before a
          reviewed Knowledge DAG exists. For now, learners can read individual gold paper
          graphs without mistaking those routes for a global mathematical curriculum.
        </p>
      </header>

      <section className="knowledge-gate learn-gate" aria-labelledby="learn-gate-title">
        <div className="knowledge-gate-counts" aria-label="Learning activation status">
          <div><span>Active curricula</span><strong>0</strong><small>No global route claimed</small></div>
          <div><span>Canonical knowledge nodes</span><strong>0</strong><small>Compression has not started</small></div>
          <div><span>Readable paper graphs</span><strong>{goldPapers.length}</strong><small>Paper-local study only</small></div>
        </div>
        <div className="knowledge-gate-copy">
          <p className="eyebrow">What is available now</p>
          <h2 id="learn-gate-title">Study the evidence-bearing papers directly.</h2>
          <p>
            These paper routes preserve the authors' result structure, proof dependencies,
            and verification boundaries. They are useful reading paths, but they are not yet
            minimized across the literature.
          </p>
          <div className="learn-paper-links">
            {goldPapers.map((paper) => (
              <Link key={paper.id} to={`/papers/${paper.id}`}>{paper.title} →</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="knowledge-activation" aria-labelledby="learn-activation-title">
        <header>
          <p className="eyebrow">Future training loop</p>
          <h2 id="learn-activation-title">The AI tutor must operate on reviewed knowledge</h2>
        </header>
        <ol>
          <li><span>01</span><div><h3>Diagnose</h3><p>Measure what the learner can actually explain and use.</p></div></li>
          <li><span>02</span><div><h3>Select a goal</h3><p>Choose a theorem, technique, or capability in the canonical graph.</p></div></li>
          <li><span>03</span><div><h3>Minimize the route</h3><p>Remove prerequisites already mastered using reviewed dependency alternatives.</p></div></li>
          <li><span>04</span><div><h3>Teach and verify</h3><p>Adapt tutorials and exercises while retaining inspectable mastery evidence.</p></div></li>
        </ol>
      </section>
    </div>
  );
}
