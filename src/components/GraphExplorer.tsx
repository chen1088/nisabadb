import {
  Fragment,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Paper, ProofRoute, Statement } from "../data/schema";
import {
  getDependencyIds,
  getRoute,
  kindLabels,
  repositoryUrl,
  statementById,
  theoremPath,
  verificationMeta,
} from "./content";
import { MathMarkdown } from "./MathMarkdown";
import { VerificationBadge } from "./VerificationBadge";

interface GraphExplorerProps {
  paper: Paper;
  statements: Statement[];
}

type ExpandedByView = Record<string, Set<string>>;

function cloneParameters(parameters: URLSearchParams): URLSearchParams {
  return new URLSearchParams(parameters.toString());
}

function initialExpansion(paper: Paper): ExpandedByView {
  return Object.fromEntries(
    paper.graph.views.map((view) => [view.id, new Set(view.initiallyExpanded)]),
  );
}

function formatEnum(value: string): string {
  return value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function statementSearchText(statement: Statement): string {
  return [
    statement.id,
    statement.localLabel,
    statement.title,
    statement.section,
    statement.kind,
    statement.exactStatement,
    statement.idea,
    statement.formalStatus,
    ...statement.tags,
    ...statement.formalDeclarations.flatMap((declaration) => [
      declaration.name,
      declaration.file,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function routeStatusCopy(route: ProofRoute): string {
  if (route.status === "complete") {
    return "Complete relative to the listed prerequisites";
  }
  if (route.status === "proof-idea") return "Conceptual proof idea; not a complete route";
  return "Proof not yet distilled";
}

export function GraphExplorer({ paper, statements }: GraphExplorerProps) {
  const [parameters, setParameters] = useSearchParams();
  const [expandedByView, setExpandedByView] = useState<ExpandedByView>(() =>
    initialExpansion(paper),
  );
  const localById = useMemo(
    () => new Map(statements.map((statement) => [statement.id, statement])),
    [statements],
  );
  const views = paper.graph.views;
  const view =
    views.find((candidate) => candidate.id === parameters.get("view")) ?? views[0];

  if (!view) {
    return <p className="empty-state">This paper does not yet define a graph view.</p>;
  }

  const requestedNode = parameters.get("node");
  const selected =
    (requestedNode ? localById.get(requestedNode) : undefined) ??
    localById.get(view.roots[0] ?? "") ??
    statements[0];

  if (!selected) {
    return <p className="empty-state">No statements have been imported for this paper.</p>;
  }

  const requestedRoute = parameters.get("route");
  const activeRoute = getRoute(selected, requestedRoute);
  const query = parameters.get("q") ?? "";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const status = parameters.get("status") ?? "all";
  const filtersActive = Boolean(normalizedQuery || status !== "all");
  const expanded = expandedByView[view.id] ?? new Set<string>();
  const statuses = Array.from(new Set(statements.map((statement) => statement.formalStatus)));

  const dependenciesFor = (statement: Statement): string[] =>
    statement.id === selected.id
      ? getDependencyIds(statement, activeRoute?.id)
      : getDependencyIds(statement);

  const matchesNode = (statement: Statement): boolean => {
    if (status !== "all" && statement.formalStatus !== status) return false;
    return !normalizedQuery || statementSearchText(statement).includes(normalizedQuery);
  };

  const branchHasMatch = (statement: Statement, path = new Set<string>()): boolean => {
    if (path.has(statement.id)) return false;
    if (matchesNode(statement)) return true;
    const nextPath = new Set(path).add(statement.id);
    return dependenciesFor(statement).some((id) => {
      const dependency = localById.get(id);
      return dependency ? branchHasMatch(dependency, nextPath) : false;
    });
  };

  const updateParameter = (key: string, value: string | null, replace = true) => {
    const next = cloneParameters(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    setParameters(next, { replace });
  };

  const revealPath = (targetId: string) => {
    const findPath = (
      currentId: string,
      target: string,
      path: string[],
      visiting: Set<string>,
    ): string[] | undefined => {
      if (currentId === target) return [...path, currentId];
      if (visiting.has(currentId)) return undefined;
      const node = localById.get(currentId);
      if (!node) return undefined;
      const nextVisiting = new Set(visiting).add(currentId);
      for (const dependency of node.dependencies) {
        const result = findPath(dependency, target, [...path, currentId], nextVisiting);
        if (result) return result;
      }
      return undefined;
    };

    for (const root of view.roots) {
      const path = findPath(root, targetId, [], new Set());
      if (!path) continue;
      setExpandedByView((current) => ({
        ...current,
        [view.id]: new Set([...(current[view.id] ?? []), ...path]),
      }));
      break;
    }
  };

  const focusGraphNode = (id: string) => {
    window.setTimeout(() => {
      const node = document.getElementById(`graph-node-${id}`);
      node?.focus();
      node?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const selectStatement = (id: string, options?: { focus?: boolean; push?: boolean }) => {
    const target = localById.get(id);
    if (!target) return;
    revealPath(id);
    const next = cloneParameters(parameters);
    next.set("node", id);
    const targetRoute = target.proofRoutes[0];
    if (targetRoute) next.set("route", targetRoute.id);
    else next.delete("route");
    setParameters(next, { replace: options?.push === false });
    if (options?.focus !== false) focusGraphNode(id);
  };

  const changeView = (viewId: string) => {
    const nextView = views.find((candidate) => candidate.id === viewId);
    if (!nextView) return;
    const next = cloneParameters(parameters);
    next.set("view", nextView.id);
    const root = localById.get(nextView.roots[0] ?? "");
    if (root) {
      next.set("node", root.id);
      const rootRoute = root.proofRoutes[0];
      if (rootRoute) next.set("route", rootRoute.id);
      else next.delete("route");
    }
    setParameters(next, { replace: false });
    window.setTimeout(() => document.getElementById(`view-${nextView.id}`)?.focus(), 0);
  };

  const toggleExpanded = (id: string) => {
    setExpandedByView((current) => {
      const nextSet = new Set(current[view.id] ?? []);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return { ...current, [view.id]: nextSet };
    });
  };

  const expandVisible = () => {
    const visible = new Set<string>();
    const walk = (id: string, visiting: Set<string>) => {
      if (visiting.has(id)) return;
      const statement = localById.get(id);
      if (!statement || (filtersActive && !branchHasMatch(statement))) return;
      visible.add(id);
      const next = new Set(visiting).add(id);
      dependenciesFor(statement).forEach((dependency) => walk(dependency, next));
    };
    view.roots.forEach((root) => walk(root, new Set()));
    setExpandedByView((current) => ({ ...current, [view.id]: visible }));
  };

  const collapseVisible = () => {
    setExpandedByView((current) => ({ ...current, [view.id]: new Set() }));
  };

  const changeRoute = (routeId: string) => {
    updateParameter("route", routeId, false);
    setExpandedByView((current) => ({
      ...current,
      [view.id]: new Set([...(current[view.id] ?? []), selected.id]),
    }));
  };

  const renderTreeNode = (
    statement: Statement,
    seen: Set<string>,
    path: Set<string>,
    parentId?: string,
  ): ReactNode => {
    if (filtersActive && !branchHasMatch(statement)) return null;
    const isCycle = path.has(statement.id);
    const isShared = seen.has(statement.id) && !isCycle;
    const isSelected = selected.id === statement.id;
    const isMatch = matchesNode(statement);
    const activeDependencyIds = new Set(activeRoute?.dependencies ?? selected.dependencies);
    const isActiveRouteDependency =
      parentId === selected.id && activeDependencyIds.has(statement.id);

    if (isShared || isCycle) {
      return (
        <li
          key={`${parentId ?? "root"}-${statement.id}-${path.size}`}
          className="shared-dependency-item"
        >
          <button
            type="button"
            className={`shared-dependency${isActiveRouteDependency ? " is-route-dependency" : ""}`}
            onClick={() => selectStatement(statement.id)}
          >
            <span aria-hidden="true">↩</span>
            <strong>{statement.localLabel}</strong>
            <span>{isCycle ? "Equivalence reference" : "Shared prerequisite"}</span>
          </button>
        </li>
      );
    }

    seen.add(statement.id);
    const dependencyIds = dependenciesFor(statement);
    const dependencies = dependencyIds
      .map((id) => localById.get(id))
      .filter((dependency): dependency is Statement => Boolean(dependency));
    const visibleDependencies = filtersActive
      ? dependencies.filter((dependency) => branchHasMatch(dependency))
      : dependencies;
    const hasChildren = visibleDependencies.length > 0;
    const isExpanded = hasChildren && (expanded.has(statement.id) || filtersActive);
    const childPath = new Set(path).add(statement.id);
    const nodeClass = [
      "graph-node-card",
      `importance-${statement.importance}`,
      `kind-${statement.kind}`,
      `status-${statement.formalStatus}`,
      isSelected ? "is-selected" : "",
      isMatch && filtersActive ? "is-match" : "",
      isActiveRouteDependency ? "is-route-dependency" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <li
        key={`${parentId ?? "root"}-${statement.id}`}
        className={`graph-tree-item${isActiveRouteDependency ? " route-edge" : ""}`}
      >
        <div className={nodeClass}>
          <button
            id={`graph-node-${statement.id}`}
            data-node-id={statement.id}
            type="button"
            className="graph-node-select"
            aria-pressed={isSelected}
            onClick={() => selectStatement(statement.id, { focus: false })}
          >
            <span className="node-heading-row">
              <span className="node-label">{statement.localLabel}</span>
              <span className="node-kind">{kindLabels[statement.kind]}</span>
            </span>
            <span className="node-title">{statement.title}</span>
            <VerificationBadge status={statement.formalStatus} compact />
          </button>
          {hasChildren ? (
            <button
              type="button"
              className="node-disclosure"
              aria-expanded={isExpanded}
              aria-controls={`graph-children-${statement.id}-${parentId ?? "root"}`}
              aria-label={`${isExpanded ? "Fold" : "Expand"} prerequisites for ${statement.localLabel}`}
              onClick={() => toggleExpanded(statement.id)}
            >
              <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
            </button>
          ) : null}
        </div>
        {isExpanded ? (
          <ul
            id={`graph-children-${statement.id}-${parentId ?? "root"}`}
            className="graph-children"
          >
            {visibleDependencies.map((dependency) =>
              renderTreeNode(dependency, seen, childPath, statement.id),
            )}
          </ul>
        ) : null}
      </li>
    );
  };

  const rootNodes = view.roots
    .map((id) => localById.get(id))
    .filter((statement): statement is Statement => Boolean(statement))
    .filter((statement) => !filtersActive || branchHasMatch(statement));

  return (
    <section id="explorer" className="explorer-section" aria-labelledby="explorer-title">
      <div className="section-heading explorer-heading">
        <div>
          <p className="eyebrow">Proof-bearing dependency graph</p>
          <h2 id="explorer-title">Read the paper through its results</h2>
          <p>
            Select a statement to read its distillation. Expand a card to follow the exact
            prerequisites used by its active proof route.
          </p>
        </div>
        <Link className="text-link with-arrow" to={`/papers/${paper.id}/distilled`}>
          Read distilled paper <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="graph-toolbar" aria-label="Dependency graph controls">
        <div className="view-tabs" role="tablist" aria-label="Graph views">
          {views.map((candidate) => (
            <button
              key={candidate.id}
              id={`view-${candidate.id}`}
              type="button"
              role="tab"
              aria-selected={candidate.id === view.id}
              className={candidate.id === view.id ? "is-active" : ""}
              onClick={() => changeView(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className="graph-filters">
          <label className="search-control">
            <span>Search statements</span>
            <span className="input-shell">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                placeholder="Theorem, concept, declaration…"
                onChange={(event) => updateParameter("q", event.target.value)}
              />
            </span>
          </label>
          <label>
            <span>Formal status</span>
            <select
              value={status}
              onChange={(event) => updateParameter("status", event.target.value)}
            >
              <option value="all">All statuses</option>
              {statuses.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {verificationMeta[candidate].label}
                </option>
              ))}
            </select>
          </label>
          <div className="toolbar-actions" aria-label="Expansion controls">
            <button type="button" onClick={expandVisible}>
              Expand visible
            </button>
            <button type="button" onClick={collapseVisible}>
              Fold visible
            </button>
          </div>
        </div>
        <div className="graph-context" aria-live="polite">
          <span>
            <strong>{statements.length}</strong> statements
          </span>
          <span>
            <strong>{view.roots.length}</strong> view roots
          </span>
          <span>
            <strong>
              {
                statements.filter(
                  (item) =>
                    item.formalDeclarations.length > 0 &&
                    item.formalDeclarations.every((declaration) => declaration.kernelChecks),
                ).length
              }
            </strong>{" "}
            formally checked
          </span>
        </div>
      </div>

      <div className="explorer-grid">
        <div
          className="graph-pane"
          aria-label={`${view.label} dependency graph`}
          onKeyDown={(event) => handleTreeKeyboard(event, event.currentTarget)}
        >
          <div className="graph-pane-header">
            <div>
              <span className="panel-index">Graph 01</span>
              <h3>{view.label}</h3>
            </div>
            <p>Lines flow from a result to the prerequisites below it.</p>
          </div>
          {rootNodes.length ? (
            <ul className="graph-root-list">
              {rootNodes.map((root) => renderTreeNode(root, new Set(), new Set()))}
            </ul>
          ) : (
            <div className="empty-state">
              <strong>No statements match.</strong>
              <span>Try a broader search or a different verification status.</span>
            </div>
          )}
        </div>

        <ProofPanel
          paper={paper}
          statement={selected}
          activeRoute={activeRoute}
          viewId={view.id}
          onRouteChange={changeRoute}
          onSelectStatement={(id) => selectStatement(id)}
        />
      </div>
    </section>
  );
}

interface ProofPanelProps {
  paper: Paper;
  statement: Statement;
  activeRoute?: ProofRoute;
  viewId?: string;
  onRouteChange?: (routeId: string) => void;
  onSelectStatement?: (statementId: string) => void;
  headingLevel?: "h1" | "h2" | "h3";
  standalone?: boolean;
}

export function ProofPanel({
  paper,
  statement,
  activeRoute,
  viewId,
  onRouteChange,
  onSelectStatement,
  headingLevel = "h3",
  standalone = false,
}: ProofPanelProps) {
  const Heading = headingLevel;
  const dependencyIds = activeRoute?.dependencies ?? statement.dependencies;
  const dependencies = dependencyIds
    .map((id) => statementById.get(id))
    .filter((dependency): dependency is Statement => Boolean(dependency));
  const route = activeRoute ?? statement.proofRoutes[0];
  const sourceLocations = statement.sourceLocations;

  const selectReference = (id: string) => {
    if (onSelectStatement) onSelectStatement(id);
  };

  return (
    <article
      className={`proof-panel${standalone ? " is-standalone" : ""}`}
      aria-labelledby={`proof-title-${statement.id}`}
    >
      <div className="proof-panel-header">
        <div className="proof-kicker-row">
          <span className="panel-index">Selected result</span>
          <VerificationBadge status={statement.formalStatus} />
        </div>
        <div className="proof-title-row">
          <div>
            <span className="statement-label">
              {statement.localLabel} · {kindLabels[statement.kind]}
            </span>
            <Heading id={`proof-title-${statement.id}`}>{statement.title}</Heading>
          </div>
          {!standalone ? (
            <Link
              className="canonical-link"
              to={theoremPath(statement)}
              aria-label={`Open canonical page for ${statement.localLabel}`}
            >
              Canonical page <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </div>
        <p className="section-chip">{statement.section}</p>
      </div>

      <section className="proof-section exact-statement">
        <h4>Exact statement</h4>
        {statement.statementNote ? (
          <aside className="statement-audit-note" aria-label="Statement audit note">
            <strong>Statement audit</strong>
            <MathMarkdown>{statement.statementNote}</MathMarkdown>
          </aside>
        ) : null}
        <MathMarkdown onStatementReference={selectReference}>
          {statement.exactStatement}
        </MathMarkdown>
        {statement.sourceStatement ? (
          <details className="source-wording-disclosure">
            <summary>Uncorrected source wording</summary>
            <MathMarkdown>{statement.sourceStatement}</MathMarkdown>
          </details>
        ) : null}
      </section>

      <section className="proof-section idea-section">
        <h4>{["definition", "notation"].includes(statement.kind) ? "Intuition" : "Proof idea"}</h4>
        <MathMarkdown onStatementReference={selectReference}>
          {statement.intuition ?? statement.idea}
        </MathMarkdown>
      </section>

      {statement.proofRoutes.length ? (
        <Fragment>
          <section className="route-control" aria-labelledby={`route-label-${statement.id}`}>
            <div>
              <span id={`route-label-${statement.id}`}>Proof route</span>
              <strong>{route ? routeStatusCopy(route) : "No route selected"}</strong>
            </div>
            <select
              aria-label={`Proof route for ${statement.localLabel}`}
              value={route?.id ?? ""}
              onChange={(event) => onRouteChange?.(event.target.value)}
              disabled={statement.proofRoutes.length < 2 || !onRouteChange}
            >
              {statement.proofRoutes.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </section>

          {route ? (
            <section className="proof-section shortened-proof">
              <div className="proof-section-heading">
                <h4>Shortened proof</h4>
                <span className={`route-status route-${route.status}`}>
                  {formatEnum(route.status)}
                </span>
              </div>
              <MathMarkdown onStatementReference={selectReference}>{route.proof}</MathMarkdown>
              <dl className="route-metadata">
                <div>
                  <dt>Route type</dt>
                  <dd>{formatEnum(route.type)}</dd>
                </div>
                <div>
                  <dt>Conceptual cost</dt>
                  <dd>{formatEnum(route.conceptualCost)}</dd>
                </div>
                <div>
                  <dt>Formal alignment</dt>
                  <dd>{formatEnum(route.formalAlignment)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {route?.steps.length ? (
            <section className="proof-section proof-steps">
              <h4>Logical steps</h4>
              <ol>
                {route.steps.map((step) => (
                  <li key={step.id}>
                    <MathMarkdown onStatementReference={selectReference}>{step.text}</MathMarkdown>
                    {step.dependencyRefs.length ? (
                      <div className="step-evidence">
                        {step.dependencyRefs.map((id) => {
                          const dependency = statementById.get(id);
                          return dependency ? (
                            <button key={id} type="button" onClick={() => selectReference(id)}>
                              {dependency.localLabel}
                            </button>
                          ) : null;
                        })}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </Fragment>
      ) : (
        <section className="proof-section definition-note">
          <h4>Reference object</h4>
          <p>
            This node introduces mathematical language rather than proving a new result. Its
            dependencies identify the objects needed to make the definition precise.
          </p>
          {statement.examples?.length ? (
            <div className="example-block">
              <strong>Examples</strong>
              {statement.examples.map((example) => (
                <MathMarkdown key={example}>{example}</MathMarkdown>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <section className="proof-section prerequisites">
        <div className="proof-section-heading">
          <h4>Active prerequisites</h4>
          <span>{dependencies.length}</span>
        </div>
        {dependencies.length ? (
          <div className="dependency-links">
            {dependencies.map((dependency) => (
              <button
                key={dependency.id}
                type="button"
                onClick={() => selectReference(dependency.id)}
              >
                <span>{dependency.localLabel}</span>
                <strong>{dependency.title}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-copy">No incoming prerequisites are recorded for this route.</p>
        )}
      </section>

      <section className="proof-section verification-summary">
        <div className="proof-section-heading">
          <h4>Formal record</h4>
          <span>{statement.formalDeclarations.length} declarations</span>
        </div>
        <dl className="formal-facts">
          <div>
            <dt>Statement status</dt>
            <dd>{verificationMeta[statement.formalStatus].label}</dd>
          </div>
          <div>
            <dt>Human–formal alignment</dt>
            <dd>{formatEnum(statement.formalAlignment)}</dd>
          </div>
          <div>
            <dt>Content version</dt>
            <dd>{statement.version}</dd>
          </div>
        </dl>
        {statement.formalDeclarations.length ? (
          <details className="declaration-disclosure">
            <summary>Inspect Lean declarations</summary>
            <ul>
              {statement.formalDeclarations.map((declaration) => (
                <li key={`${declaration.name}-${declaration.lineStart}`}>
                  <a
                    href={repositoryUrl(
                      declaration.repository,
                      declaration.commit,
                      declaration.file,
                      declaration.lineStart,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>{declaration.name}</code>
                    <span>L{declaration.lineStart}</span>
                  </a>
                  <p className="declaration-location">
                    <code title={declaration.commit}>
                      {declaration.repository}@{declaration.commit.slice(0, 12)}
                    </code>
                    <span>
                      {declaration.file}:{declaration.lineStart}
                    </span>
                  </p>
                  <dl className="declaration-audit-facts">
                    <div>
                      <dt>Kernel checked</dt>
                      <dd>{declaration.kernelChecks ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Contains sorry</dt>
                      <dd>{declaration.hasSorry ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Contains admit</dt>
                      <dd>{declaration.hasAdmit ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>External input</dt>
                      <dd>{declaration.usesExternalInput ? "Yes" : "No"}</dd>
                    </div>
                    <div className="axiom-footprint">
                      <dt>Axiom footprint</dt>
                      <dd>
                        {declaration.axiomFootprint.length ? (
                          <ul>
                            {declaration.axiomFootprint.map((axiom) => (
                              <li key={axiom}>
                                <code>{axiom}</code>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "None recorded"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="declaration-audit-note">{declaration.auditNote}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="muted-copy">No Lean declaration is attached to this record.</p>
        )}
      </section>

      <footer className="proof-sources">
        <span>Sources</span>
        <div>
          {sourceLocations.map((source, index) =>
            source.url ? (
              <a key={`${source.label}-${index}`} href={source.url} target="_blank" rel="noreferrer">
                {source.label} · {source.locator}
              </a>
            ) : (
              <span key={`${source.label}-${index}`}>
                {source.label} · {source.locator}
              </span>
            ),
          )}
        </div>
        {standalone ? (
          <Link
            className="button-link subtle-button"
            to={`/papers/${paper.id}?view=${encodeURIComponent(viewId ?? "main")}&node=${encodeURIComponent(statement.id)}${route ? `&route=${encodeURIComponent(route.id)}` : ""}#explorer`}
          >
            Open in dependency graph
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

function handleTreeKeyboard(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement,
) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const nodes = Array.from(
    container.querySelectorAll<HTMLButtonElement>(".graph-node-select:not([disabled])"),
  );
  const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? nodes.length - 1
        : event.key === "ArrowDown"
          ? Math.min(nodes.length - 1, current + 1)
          : Math.max(0, current - 1);
  nodes[nextIndex]?.focus();
}
