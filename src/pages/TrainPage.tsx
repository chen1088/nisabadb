import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MathMarkdown } from "../components/MathMarkdown";
import {
  corpus,
  getLearningRoute,
  graphPath,
  kindLabels,
  paperById,
  statementById,
} from "../components/content";
import type { Statement } from "../data/schema";
import { pickTrainCandidate, trainCandidates } from "./train-model";

export function TrainPage() {
  const firstCandidate = trainCandidates[0];
  const [selectedId, setSelectedId] = useState(() => pickTrainCandidate(trainCandidates)?.id ?? firstCandidate?.id);
  const [paperFilter, setPaperFilter] = useState("all");
  const [mode, setMode] = useState<"human" | "ai">("human");
  const [attempt, setAttempt] = useState("");
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [solutionVisible, setSolutionVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const pool = useMemo(
    () => trainCandidates.filter((candidate) => paperFilter === "all" || candidate.paperId === paperFilter),
    [paperFilter],
  );
  const selected = pool.find((candidate) => candidate.id === selectedId) ?? pool[0] ?? firstCandidate;
  const paper = selected ? paperById.get(selected.paperId) : undefined;
  const route = selected ? getLearningRoute(selected) : undefined;
  const prerequisites = (route?.dependencies ?? selected?.dependencies ?? [])
    .map((id) => statementById.get(id))
    .filter((item): item is Statement => Boolean(item));

  const resetExercise = (candidate?: Statement) => {
    setSelectedId(candidate?.id);
    setAttempt("");
    setHintLevel(0);
    setSolutionVisible(false);
    setCopied(false);
  };

  const chooseAnother = () => resetExercise(pickTrainCandidate(pool, selected?.id));

  const changePaper = (paperId: string) => {
    setPaperFilter(paperId);
    const nextPool = trainCandidates.filter((candidate) => paperId === "all" || candidate.paperId === paperId);
    resetExercise(pickTrainCandidate(nextPool));
  };

  if (!selected || !paper || !route) {
    return <div className="train-page page-shell"><p className="empty-state">No reviewed proof exercises are available yet.</p></div>;
  }

  const aiPrompt = [
    "Act as a rigorous proof trainee. Re-prove the following result without quoting its stored proof.",
    "",
    `Paper: ${paper.title}`,
    `Result: ${selected.localLabel} — ${selected.title}`,
    `Statement: ${selected.exactStatement}`,
    "",
    `Allowed prerequisites: ${prerequisites.length ? prerequisites.map((item) => `${item.localLabel} (${item.title})`).join("; ") : "none listed"}.`,
    "Give a complete proof, name every dependency when used, and explicitly flag any gap or extra assumption. Then suggest one simpler proof route if you see one.",
  ].join("\n");

  const copyPrompt = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
  };

  return (
    <div className="train-page page-shell">
      <header className="train-hero">
        <div>
          <p className="eyebrow">Proof training from the paper DAG</p>
          <h1>Train by rebuilding a result.</h1>
          <p>
            NisabaDB chooses a meaningful reviewed result, hides its proof, and asks a human or
            an AI to derive it again. Hints expose the dependency graph one layer at a time.
          </p>
        </div>
        <dl aria-label="Training pool status">
          <div><dt>Eligible results</dt><dd>{trainCandidates.length}</dd></div>
          <div><dt>Gold paper graphs</dt><dd>{new Set(trainCandidates.map((item) => item.paperId)).size}</dd></div>
          <div><dt>Selection</dt><dd>Random, reviewed, complete</dd></div>
        </dl>
      </header>

      <section className="train-controls" aria-label="Exercise controls">
        <label>
          <span>Paper pool</span>
          <select value={paperFilter} onChange={(event) => changePaper(event.target.value)}>
            <option value="all">All gold papers</option>
            {corpus.papers.filter((candidatePaper) => trainCandidates.some((item) => item.paperId === candidatePaper.id)).map((candidatePaper) => (
              <option key={candidatePaper.id} value={candidatePaper.id}>{candidatePaper.title}</option>
            ))}
          </select>
        </label>
        <div className="train-mode" aria-label="Trainee type">
          <span>Trainee</span>
          <div>
            <button type="button" aria-pressed={mode === "human"} onClick={() => setMode("human")}>Human</button>
            <button type="button" aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>AI</button>
          </div>
        </div>
        <button className="train-new-button" type="button" onClick={chooseAnother}>
          Pick another result <span aria-hidden="true">↻</span>
        </button>
      </section>

      <article className="train-card" aria-labelledby="train-result-title">
        <div className="train-card-header">
          <div>
            <p className="eyebrow">Today’s proof exercise</p>
            <span>{paper.title}</span>
            <h2 id="train-result-title">{selected.localLabel} · {selected.title}</h2>
          </div>
          <div className="train-card-meta">
            <span>{kindLabels[selected.kind]}</span>
            <span>{prerequisites.length} direct prerequisite{prerequisites.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        <section className="train-statement">
          <h3>Re-prove this statement</h3>
          <MathMarkdown>{selected.exactStatement}</MathMarkdown>
        </section>

        {mode === "human" ? (
          <section className="train-workspace">
            <label htmlFor="proof-attempt">Your proof attempt</label>
            <textarea
              id="proof-attempt"
              value={attempt}
              placeholder="Start from the statement. Write what is given, what must be shown, and why each step follows…"
              onChange={(event) => setAttempt(event.target.value)}
            />
            <small>Your draft stays in this browser tab and is not submitted.</small>
          </section>
        ) : (
          <section className="train-ai-prompt">
            <div><h3>Prompt an AI proof trainee</h3><button type="button" onClick={copyPrompt}>{copied ? "Copied" : "Copy prompt"}</button></div>
            <pre>{aiPrompt}</pre>
          </section>
        )}

        <section className="train-help" aria-label="Progressive proof help">
          <div>
            <span>Need a nudge?</span>
            <strong>Open only as much of the graph as you need.</strong>
          </div>
          {hintLevel < 1 ? (
            <button type="button" onClick={() => setHintLevel(1)}>Reveal prerequisites</button>
          ) : (
            <div className="train-hint">
              <span>Hint 1 · permitted inputs</span>
              {prerequisites.length ? (
                <ul>{prerequisites.map((item) => <li key={item.id}><strong>{item.localLabel}</strong> {item.title}</li>)}</ul>
              ) : <p>This result has no listed incoming prerequisites.</p>}
            </div>
          )}
          {hintLevel === 1 ? <button type="button" onClick={() => setHintLevel(2)}>Reveal proof idea</button> : null}
          {hintLevel >= 2 ? (
            <div className="train-hint">
              <span>Hint 2 · proof idea</span>
              <MathMarkdown>{selected.intuition ?? selected.idea}</MathMarkdown>
            </div>
          ) : null}
          {hintLevel >= 2 && !solutionVisible ? <button type="button" onClick={() => setSolutionVisible(true)}>Compare with the reviewed proof</button> : null}
          {solutionVisible ? (
            <div className="train-solution">
              <span>Reviewed route · {route.label}</span>
              <MathMarkdown>{route.proof}</MathMarkdown>
              {route.steps.length ? (
                <ol>{route.steps.map((step) => <li key={step.id}><MathMarkdown>{step.text}</MathMarkdown></li>)}</ol>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="train-card-footer">
          <p>Exercise generated from a reviewed paper node; this is practice, not a new verification claim.</p>
          <Link to={graphPath(paper, selected, { routeId: route.id })}>Inspect this result in its paper DAG →</Link>
        </footer>
      </article>
    </div>
  );
}
