import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  corpus,
  dependencyRouteKind,
  getLearningDependencyIds,
  getLearningRoute,
  kindLabels,
  paperById,
  statementById,
  theoremPath,
} from "../components/content";
import type { Statement } from "../data/schema";

function learningMinutes(statement: Statement): number {
  if (["definition", "notation"].includes(statement.kind)) return 8;
  const cost = getLearningRoute(statement)?.conceptualCost;
  return { low: 12, moderate: 25, high: 45, specialist: 75 }[cost ?? "moderate"];
}

function learningOrder(rootId: string, mastered: ReadonlySet<string>): Statement[] {
  const visited = new Set<string>();
  const order: Statement[] = [];
  const visit = (id: string, visiting: Set<string>) => {
    if (visited.has(id) || visiting.has(id)) return;
    const statement = statementById.get(id);
    if (!statement) return;
    if (mastered.has(id)) {
      visited.add(id);
      order.push(statement);
      return;
    }
    const next = new Set(visiting).add(id);
    getLearningDependencyIds(statement).forEach((dependency) => visit(dependency, next));
    visited.add(id);
    order.push(statement);
  };
  visit(rootId, new Set());
  return order;
}

export function LearnPage() {
  const targets = corpus.statements.filter((statement) =>
    statement.importance === "hero" ||
    (statement.importance === "major" && ["theorem", "proposition", "corollary"].includes(statement.kind)),
  );
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [mastered, setMastered] = useState<Set<string>>(new Set());
  const path = useMemo(() => learningOrder(targetId, mastered), [mastered, targetId]);
  const masteredInPath = path.filter((statement) => mastered.has(statement.id)).length;
  const remaining = path.filter((statement) => !mastered.has(statement.id));
  const minutes = remaining.reduce((total, statement) => total + learningMinutes(statement), 0);
  const target = statementById.get(targetId);

  const toggleMastered = (id: string) => {
    setMastered((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="learn-page page-shell">
      <header className="page-hero compact-page-hero learn-hero">
        <p className="eyebrow">Shortest reviewed training route</p>
        <h1>Learn</h1>
        <p>
          Choose a mathematical goal, mark what you already know, and NisabaDB removes
          mastered prerequisites from the active route.
        </p>
      </header>

      <section className="learning-planner" aria-labelledby="learning-planner-title">
        <div className="learning-target">
          <label>
            <span>What do you want to understand?</span>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              {targets.map((candidate) => {
                const paper = paperById.get(candidate.paperId);
                return (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}{paper ? ` · ${paper.authors[0]}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          {target ? (
            <div className="learning-target-summary">
              <span>{kindLabels[target.kind]}</span>
              <h2 id="learning-planner-title">{target.title}</h2>
              <p>{target.intuition ?? target.idea}</p>
              {getLearningRoute(target) ? (
                <span className="learning-route-label">
                  Active route: {dependencyRouteKind(getLearningRoute(target)!)} · {getLearningRoute(target)!.label}
                </span>
              ) : target.proofRoutes.length ? (
                <span className="learning-route-label">No reviewed dependency route is available yet.</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="learning-estimate" aria-label="Learning estimate">
          <span>Estimated remaining effort</span>
          <strong>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}</strong>
          <p>{remaining.length} of {path.length} knowledge units remain</p>
          <div className="learning-meter" aria-hidden="true">
            <span style={{ width: `${path.length ? (masteredInPath / path.length) * 100 : 0}%` }} />
          </div>
          <button type="button" onClick={() => setMastered(new Set())}>Reset diagnostic</button>
        </aside>
      </section>

      <section className="learning-path" aria-labelledby="learning-path-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prerequisites first</p>
            <h2 id="learning-path-title">Your current route</h2>
          </div>
          <p>Check a unit only when you can explain it and pass its mastery test.</p>
        </div>
        <ol>
          {path.map((statement, index) => {
            const isMastered = mastered.has(statement.id);
            return (
              <li key={statement.id} className={isMastered ? "is-mastered" : ""}>
                <span className="learning-step-number">{String(index + 1).padStart(2, "0")}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={isMastered}
                    aria-label={`I know this: ${statement.title}`}
                    onChange={() => toggleMastered(statement.id)}
                  />
                  <span>I know this</span>
                </label>
                <div>
                  <span>{statement.localLabel} · {kindLabels[statement.kind]}</span>
                  <h3><Link to={theoremPath(statement)}>{statement.title}</Link></h3>
                  <p>{statement.intuition ?? statement.idea}</p>
                </div>
                <strong>{learningMinutes(statement)} min</strong>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
