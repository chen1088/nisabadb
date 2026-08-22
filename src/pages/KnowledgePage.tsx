import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  corpus,
  dependencyRouteKind,
  getLearningDependencyIds,
  kindLabels,
  paperById,
  routeReviewStatus,
  statementById,
  theoremPath,
  verificationMeta,
} from "../components/content";
import { MathMarkdown } from "../components/MathMarkdown";
import type { Statement } from "../data/schema";

function knowledgeLayers(rootId: string): Statement[][] {
  const depthById = new Map<string, number>();
  const visit = (id: string, visiting: Set<string>): number => {
    const known = depthById.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    const statement = statementById.get(id);
    if (!statement) return 0;
    const next = new Set(visiting).add(id);
    const dependencies = getLearningDependencyIds(statement);
    const depth = dependencies.length
      ? Math.max(...dependencies.map((dependency) => visit(dependency, next))) + 1
      : 0;
    depthById.set(id, depth);
    return depth;
  };
  visit(rootId, new Set());
  const layers: Statement[][] = [];
  for (const [id, depth] of depthById) {
    const statement = statementById.get(id);
    if (!statement) continue;
    (layers[depth] ??= []).push(statement);
  }
  return layers;
}

export function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const targets = useMemo(
    () => corpus.statements.filter((statement) =>
      statement.importance === "hero" ||
      (statement.importance === "major" && ["theorem", "proposition", "corollary"].includes(statement.kind)),
    ),
    [],
  );
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(targets[0]?.id ?? "");
  const goldPaperIds = useMemo(
    () => new Set(corpus.papers.filter((paper) => paper.status === "gold").map((paper) => paper.id)),
    [],
  );
  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return corpus.statements.filter((statement) => {
      if (!goldPaperIds.has(statement.paperId)) return false;
      if (kind !== "all" && statement.kind !== kind) return false;
      if (!normalized) return true;
      return [
        statement.title,
        statement.exactStatement,
        statement.idea,
        statement.intuition,
        statement.localLabel,
        ...statement.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [goldPaperIds, kind, query]);
  const sourcePaperCount = new Set(candidates.map((statement) => statement.paperId)).size;
  const layers = useMemo(() => knowledgeLayers(targetId), [targetId]);
  const selected = statementById.get(selectedId) ?? statementById.get(targetId);

  return (
    <div className="knowledge-page page-shell">
      <header className="page-hero compact-page-hero knowledge-hero">
        <p className="eyebrow">The canonical learning layer</p>
        <h1>Knowledge</h1>
        <p>
          Atomic mathematical ideas, organized by prerequisites and teaching cost. The goal
          is the smallest verified route from what a learner knows to what they want to master.
        </p>
      </header>

      <section className="knowledge-stage" aria-labelledby="knowledge-stage-title">
        <div>
          <p className="eyebrow">Normalization in progress</p>
          <h2 id="knowledge-stage-title">Paper claims are becoming reusable knowledge</h2>
          <p>
            These reviewed source records are the current candidates. A candidate becomes a
            canonical Knowledge node only after equivalent statements are merged, its minimal
            description and tutorial are reviewed, and its prerequisites are source-independent.
          </p>
        </div>
        <dl>
          <div>
            <dt>Candidate units</dt>
            <dd>{corpus.statements.length}</dd>
          </div>
          <div>
            <dt>Source papers</dt>
            <dd>{corpus.papers.filter((paper) => paper.status === "gold").length}</dd>
          </div>
          <div>
            <dt>Canonical merges</dt>
            <dd>Pending review</dd>
          </div>
        </dl>
      </section>

      <section className="knowledge-map" aria-labelledby="knowledge-map-title">
        <header>
          <div>
            <p className="eyebrow">Candidate knowledge DAG</p>
            <h2 id="knowledge-map-title">See every prerequisite before the goal</h2>
          </div>
          <label>
            <span>Target knowledge</span>
            <select
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                setSelectedId(event.target.value);
              }}
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>{target.title}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="knowledge-map-layout">
          <div className="knowledge-dag" aria-label="Layered prerequisite graph">
            {layers.map((layer, layerIndex) => (
              <section key={layerIndex} aria-label={`Knowledge layer ${layerIndex + 1}`}>
                <span>Layer {String(layerIndex + 1).padStart(2, "0")}</span>
                <div>
                  {layer.map((statement) => {
                    const dependencies = getLearningDependencyIds(statement)
                      .map((id) => statementById.get(id))
                      .filter((dependency): dependency is Statement => Boolean(dependency));
                    const dependencyLabels = dependencies.map((dependency) => dependency.localLabel);
                    return (
                      <button
                        key={statement.id}
                        type="button"
                        className={selected?.id === statement.id ? "is-selected" : ""}
                        aria-pressed={selected?.id === statement.id}
                        onClick={() => setSelectedId(statement.id)}
                      >
                        <small>{kindLabels[statement.kind]} · {dependencies.length} inputs</small>
                        <strong>{statement.title}</strong>
                        <span
                          className="knowledge-node-edges"
                          aria-label={dependencies.length
                            ? `Direct prerequisites: ${dependencies.map((dependency) => dependency.title).join(", ")}`
                            : "No direct prerequisites"}
                        >
                          {dependencies.length ? `← ${dependencyLabels.join(" · ")}` : "Foundational node"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {selected ? (
            <article className="knowledge-reader" aria-label={`Selected knowledge: ${selected.title}`}>
              <span>{selected.localLabel} · {kindLabels[selected.kind]}</span>
              <h3>{selected.title}</h3>
              <div>
                <h4>Candidate minimized description</h4>
                <MathMarkdown>{selected.intuition ?? selected.idea}</MathMarkdown>
              </div>
              <div>
                <h4>Precise record</h4>
                <MathMarkdown>{selected.exactStatement}</MathMarkdown>
              </div>
              {selected.proofRoutes.length ? (
                <div>
                  <h4>Dependency routes</h4>
                  <ul>
                    {selected.proofRoutes.map((route) => (
                      <li key={route.id}>
                        <strong>{dependencyRouteKind(route)}</strong>
                        <span>{route.label} · {routeReviewStatus(route)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link to={theoremPath(selected)}>Open full reviewed record →</Link>
            </article>
          ) : null}
        </div>
      </section>

      <section className="knowledge-controls" aria-label="Knowledge filters">
        <label className="search-control">
          <span>Search mathematical knowledge</span>
          <span className="input-shell">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              placeholder="Concept, theorem, technique…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <label>
          <span>Knowledge kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All kinds</option>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <p aria-live="polite">
          <strong>{candidates.length}</strong> candidates from {sourcePaperCount} paper
          {sourcePaperCount === 1 ? "" : "s"}
        </p>
      </section>

      <div className="knowledge-list">
        {candidates.map((statement) => {
          const paper = paperById.get(statement.paperId);
          const routeKinds = new Set(statement.proofRoutes.map(dependencyRouteKind));
          return (
            <article key={statement.id} className="knowledge-card">
              <div className="knowledge-card-topline">
                <span>{kindLabels[statement.kind]}</span>
                <span>{verificationMeta[statement.formalStatus].label}</span>
              </div>
              <h2>
                <Link to={theoremPath(statement)}>{statement.title}</Link>
              </h2>
              <p className="knowledge-description">{statement.intuition ?? statement.idea}</p>
              <div className="knowledge-route-tags" aria-label="Dependency route types">
                {routeKinds.size ? Array.from(routeKinds).map((routeKind) => (
                  <span key={routeKind}>{routeKind}</span>
                )) : <span>definition route</span>}
              </div>
              <footer>
                <span>{statement.dependencies.length} prerequisites</span>
                {paper ? <Link to={`/papers/${paper.id}`}>{paper.title}</Link> : null}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
