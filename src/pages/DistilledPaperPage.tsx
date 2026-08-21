import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MathMarkdown } from "../components/MathMarkdown";
import {
  getDependencyIds,
  getPaperStatements,
  getRoute,
  kindLabels,
  paperById,
  statementById,
  theoremPath,
} from "../components/content";
import type { Statement } from "../data/schema";
import { NotFoundPage } from "./NotFoundPage";

function expandedReadingOrder(roots: string[], localIds: Set<string>): Statement[] {
  const visited = new Set<string>();
  const ordered: Statement[] = [];
  const visit = (id: string, visiting: Set<string>) => {
    if (visited.has(id) || visiting.has(id)) return;
    const statement = statementById.get(id);
    if (!statement || !localIds.has(id)) return;
    const next = new Set(visiting).add(id);
    getDependencyIds(statement).forEach((dependency) => visit(dependency, next));
    visited.add(id);
    ordered.push(statement);
  };
  roots.forEach((root) => visit(root, new Set()));
  return ordered;
}

export function DistilledPaperPage() {
  const { paperId } = useParams();
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const paper = paperId ? paperById.get(paperId) : undefined;
  if (!paper) return <NotFoundPage />;
  const statements = getPaperStatements(paper.id);
  const localIds = new Set(statements.map((statement) => statement.id));
  const expanded = parameters.get("expand") === "all";
  const mode = parameters.get("mode") === "source" ? "source" : "distilled";
  const paperRoots = paper.graph.paperRoots
    .map((id) => statementById.get(id))
    .filter((statement): statement is Statement => Boolean(statement));
  const readingOrder = expanded
    ? expandedReadingOrder(paper.graph.paperRoots, localIds)
    : paperRoots;

  const updateMode = (nextMode: "distilled" | "source") => {
    const next = new URLSearchParams(parameters);
    if (nextMode === "source") next.set("mode", "source");
    else next.delete("mode");
    setParameters(next);
  };

  const selectReference = (id: string) => {
    const element = document.getElementById(`reading-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.querySelector<HTMLElement>("a, button")?.focus();
      return;
    }
    const target = statementById.get(id);
    if (target) navigate(theoremPath(target));
  };

  return (
    <div className="distilled-page page-shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/papers">Papers</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/papers/${paper.id}`}>{paper.title}</Link>
        <span aria-hidden="true">/</span>
        <span>Distilled paper</span>
      </nav>
      <header className="distilled-header">
        <div>
          <p className="eyebrow">Generated from the proof graph</p>
          <h1>{paper.title}</h1>
          <p>
            A linear reading assembled from the same statements and proof routes used in
            the dependency explorer.
          </p>
        </div>
        <div className="distilled-controls">
          <div className="mode-switch" aria-label="Reading mode">
            <button
              type="button"
              className={mode === "distilled" ? "is-active" : ""}
              aria-pressed={mode === "distilled"}
              onClick={() => updateMode("distilled")}
            >
              Distilled routes
            </button>
            <button
              type="button"
              className={mode === "source" ? "is-active" : ""}
              aria-pressed={mode === "source"}
              onClick={() => updateMode("source")}
            >
              Source record
            </button>
          </div>
          <button
            type="button"
            className="button-link subtle-button"
            aria-pressed={expanded}
            onClick={() => {
              const next = new URLSearchParams(parameters);
              if (expanded) next.delete("expand");
              else next.set("expand", "all");
              setParameters(next);
            }}
          >
            {expanded ? "Show paper-facing results" : "Expand prerequisites"}
          </button>
        </div>
      </header>

      <div className="reading-layout">
        <aside className="reading-contents" aria-label="Reading contents">
          <span>Contents</span>
          <ol>
            {readingOrder.map((statement) => (
              <li key={statement.id}>
                <a href={`#reading-${statement.id}`}>
                  <span>{statement.localLabel}</span>
                  {statement.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>
        <article className="distilled-document">
          <header className="document-title-page">
            <span>NisabaDB distilled edition</span>
            <h2>{paper.title}</h2>
            <p>{paper.authors.join(", ")}</p>
            <div className="document-rule" />
            <MathMarkdown>{paper.contributionSummary}</MathMarkdown>
          </header>
          {readingOrder.map((statement, index) => {
            const route = getRoute(statement);
            const preservedSource = mode === "source" ? statement.sourceStatement : undefined;
            return (
              <section key={statement.id} id={`reading-${statement.id}`} className="reading-statement">
                <header>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p>
                      {statement.localLabel} · {kindLabels[statement.kind]}
                    </p>
                    <h2>{statement.title}</h2>
                  </div>
                  <Link to={theoremPath(statement)}>Canonical record ↗</Link>
                </header>
                <div className="reading-statement-body">
                  <div>
                    <h3>{preservedSource ? "Preserved source statement" : "Statement"}</h3>
                    {statement.statementNote ? (
                      <aside className="statement-audit-note distilled-statement-audit" aria-label="Statement audit note">
                        <strong>Statement audit</strong>
                        <MathMarkdown>{statement.statementNote}</MathMarkdown>
                      </aside>
                    ) : null}
                    <MathMarkdown onStatementReference={selectReference}>
                      {preservedSource ?? statement.exactStatement}
                    </MathMarkdown>
                  </div>
                  {mode === "distilled" ? (
                    <div>
                      <h3>{route ? `Proof · ${route.label}` : "Intuition"}</h3>
                      <MathMarkdown onStatementReference={selectReference}>
                        {route?.proof ?? statement.intuition ?? statement.idea}
                      </MathMarkdown>
                      {route ? (
                        <p className={`route-status route-${route.status}`}>
                          {route.status.replaceAll("-", " ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="source-record-block">
                      <h3>Source record</h3>
                      <dl>
                        {statement.sourceLocations.map((source, sourceIndex) => (
                          <div key={`${source.label}-${sourceIndex}`}>
                            <dt>{source.label}</dt>
                            <dd>
                              {source.url ? (
                                <a href={source.url} target="_blank" rel="noreferrer">
                                  {source.locator} ↗
                                </a>
                              ) : (
                                source.locator
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </article>
      </div>
    </div>
  );
}
