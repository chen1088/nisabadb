import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MathMarkdown } from "../components/MathMarkdown";
import {
  getKnowledgeNode,
  knowledgeBook,
  knowledgeChapterById,
  knowledgeDependents,
  knowledgeNodeById,
  knowledgeNodes,
  knowledgeNodesForChapter,
  knowledgeSourceById,
  nextKnowledgeNode,
  notationById,
  previousKnowledgeNode,
} from "../data/knowledge";
import type { KnowledgeNode } from "../data/knowledge-schema";

const kindLabels: Record<KnowledgeNode["kind"], string> = {
  language: "Language",
  definition: "Definition",
  law: "Law",
  method: "Method",
  theorem: "Theorem",
};

function nodePath(node: KnowledgeNode): string {
  return `/knowledge?node=${encodeURIComponent(node.slug)}`;
}

export function KnowledgePage() {
  const [parameters] = useSearchParams();
  const [query, setQuery] = useState("");
  const requestedNode = parameters.get("node") ?? undefined;
  const selected = getKnowledgeNode(requestedNode) ?? knowledgeNodes[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const visibleNodeIds = useMemo(() => {
    if (!normalizedQuery) return new Set(knowledgeNodes.map((node) => node.id));
    return new Set(
      knowledgeNodes
        .filter((node) =>
          [node.id, node.title, node.purpose, node.kind, ...node.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        )
        .map((node) => node.id),
    );
  }, [normalizedQuery]);

  if (!selected) return null;

  const chapter = knowledgeChapterById.get(selected.chapterId);
  const prerequisites = selected.prerequisiteIds
    .map((id) => knowledgeNodeById.get(id))
    .filter((node): node is KnowledgeNode => Boolean(node));
  const dependents = knowledgeDependents(selected.id);
  const previous = previousKnowledgeNode(selected.id);
  const next = nextKnowledgeNode(selected.id);
  const notation = selected.notationIds
    .map((id) => notationById.get(id))
    .filter((entry) => Boolean(entry));
  const sources = selected.sourceRefs
    .map((reference) => ({
      ...reference,
      source: knowledgeSourceById.get(reference.sourceId),
    }))
    .filter((reference) => Boolean(reference.source));

  return (
    <div className="textbook-page">
      <header className="textbook-masthead page-shell">
        <div>
          <p className="eyebrow">The canonical living textbook</p>
          <h1>{knowledgeBook.title}</h1>
          <p>{knowledgeBook.subtitle}</p>
        </div>
        <dl aria-label="Textbook status">
          <div><dt>Edition</dt><dd>{knowledgeBook.edition}</dd></div>
          <div><dt>Written knowledge nodes</dt><dd>{knowledgeNodes.length}</dd></div>
          <div><dt>Organization</dt><dd>Dependency DAG</dd></div>
        </dl>
      </header>

      <section className="compression-contract page-shell" aria-labelledby="compression-contract-title">
        <div className="compression-contract-copy">
          <p className="eyebrow">The source-compression program</p>
          <h2 id="compression-contract-title">Many books become one honest mathematical language.</h2>
          <p>We independently rewrite shared ideas in one canonical language while keeping every source theorem traceable to an exact edition, locator, and disposition.</p>
        </div>
        <div className="compression-contract-flow" aria-label="Textbook compression status">
          <div><strong>{__SOURCE_RECORD_COUNT__}</strong><span>source records preserved</span></div>
          <span aria-hidden="true">→</span>
          <div><strong>{__COMPRESSION_SOURCE_FAMILY_COUNT__}</strong><span>cross-cutting lenses over {__SOURCE_BRANCH_COUNT__} intake branches</span></div>
          <span aria-hidden="true">→</span>
          <div><strong>{__COMPRESSION_CLUSTER_COUNT__}</strong><span>whole-field clusters</span></div>
          <span aria-hidden="true">+</span>
          <div><strong>{__COMPRESSION_RESIDUAL_COUNT__}</strong><span>explicit residual decisions</span></div>
        </div>
        <div className="compression-contract-rules">
          <p><span>01</span><strong>Rewrite the common idea</strong><small>Source prose and chapter order do not control the canonical lesson.</small></p>
          <p><span>02</span><strong>Unify notation</strong><small>Aliases translate into one stable language instead of spawning duplicate knowledge.</small></p>
          <p><span>03</span><strong>Keep honest remainders</strong><small>Distinct mathematics survives as a bridge, route, extension, history, or open editorial question.</small></p>
          <p><span>04</span><strong>Lose no theorem</strong><small>Compression may merge exposition; it may never erase a source occurrence or its exact lineage.</small></p>
        </div>
        <div className="compression-contract-links">
          <Link to="/knowledge/compression">Explore the compression atlas <span aria-hidden="true">→</span></Link>
          <Link to="/knowledge/coverage">Audit all {__SOURCE_RECORD_COUNT__} source records <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <details className="textbook-global-dag page-shell">
        <summary>
          <span>Whole-book dependency index</span>
          <strong>Open all {knowledgeNodes.length} written nodes and their prerequisites</strong>
        </summary>
        <div className="textbook-global-dag-body" aria-label="Global knowledge dependency index">
          <p>
            Each card names its direct prerequisites. “Needs K04” means the current idea depends
            on K04; chapter order is only a reading convenience and does not create an edge.
          </p>
          <div>
            {knowledgeBook.chapters.map((candidateChapter) => (
              <section key={candidateChapter.id}>
                <header>
                  <span>Chapter {candidateChapter.number}</span>
                  <strong>{candidateChapter.title}</strong>
                </header>
                {knowledgeNodesForChapter(candidateChapter.id).map((node) => (
                  <Link
                    key={node.id}
                    className={node.id === selected.id ? "is-current" : undefined}
                    to={nodePath(node)}
                  >
                    <span>{node.id} · {node.section}</span>
                    <strong>{node.title}</strong>
                    <small>{node.prerequisiteIds.length ? `Needs ${node.prerequisiteIds.join(", ")}` : "Entry node"}</small>
                  </Link>
                ))}
              </section>
            ))}
          </div>
        </div>
      </details>

      <div className="textbook-workspace page-shell">
        <aside className="textbook-contents" aria-label="Textbook table of contents">
          <div className="textbook-pane-heading">
            <span>Contents</span>
            <strong>Read in dependency order</strong>
          </div>
          <label className="textbook-search">
            <span>Find a knowledge node</span>
            <input
              type="search"
              value={query}
              placeholder="Sets, equality, quantifiers…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <nav aria-label="Knowledge chapters">
            {knowledgeBook.chapters.map((candidateChapter) => {
              const chapterNodes = knowledgeNodesForChapter(candidateChapter.id).filter((node) =>
                visibleNodeIds.has(node.id),
              );
              if (!chapterNodes.length) return null;
              return (
                <section key={candidateChapter.id}>
                  <p><span>Chapter {candidateChapter.number}</span><strong>{candidateChapter.title}</strong></p>
                  <ol>
                    {chapterNodes.map((node) => (
                      <li key={node.id}>
                        <Link
                          className={node.id === selected.id ? "is-current" : undefined}
                          to={nodePath(node)}
                          aria-current={node.id === selected.id ? "page" : undefined}
                        >
                          <span>{node.section}</span>
                          {node.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </nav>
          {normalizedQuery && visibleNodeIds.size === 0 ? (
            <p className="textbook-no-results">No knowledge node matches “{query}”.</p>
          ) : null}
        </aside>

        <article className="textbook-reader" aria-labelledby="knowledge-node-title">
          <div className="textbook-section-line">
            <span>{chapter ? `Chapter ${chapter.number} · ${chapter.title}` : "Knowledge"}</span>
            <span>{selected.readMinutes} min</span>
          </div>
          <p className="textbook-node-kind">{selected.section} · {kindLabels[selected.kind]} · {selected.id}</p>
          <h2 id="knowledge-node-title" tabIndex={-1}>{selected.title}</h2>
          <p className="textbook-purpose">{selected.purpose}</p>

          <section className="textbook-prerequisite-strip" aria-label="Required knowledge">
            <span>Know first</span>
            {prerequisites.length ? (
              <div>
                {prerequisites.map((node) => (
                  <Link key={node.id} to={nodePath(node)}>{node.section} {node.title}</Link>
                ))}
              </div>
            ) : <strong>Nothing. This is an entry point.</strong>}
          </section>

          <section className="textbook-section">
            <h3>Why this exists</h3>
            <MathMarkdown>{selected.motivation}</MathMarkdown>
          </section>

          <aside className="textbook-key-idea">
            <span>The one idea to keep</span>
            <MathMarkdown>{selected.keyIdea}</MathMarkdown>
          </aside>

          <section className="textbook-section textbook-tutorial">
            <h3>Tutorial</h3>
            <MathMarkdown>{selected.tutorial}</MathMarkdown>
          </section>

          <section className="textbook-section">
            <h3>Worked examples</h3>
            <div className="textbook-examples">
              {selected.examples.map((example, index) => (
                <article key={example.title}>
                  <span>Example {index + 1}</span>
                  <h4>{example.title}</h4>
                  <MathMarkdown>{example.body}</MathMarkdown>
                </article>
              ))}
            </div>
          </section>

          {notation.length ? (
            <section className="textbook-section">
              <h3>Notation used here</h3>
              <div className="notation-table" role="table" aria-label="Canonical notation">
                <div className="visually-hidden" role="row">
                  <span role="columnheader">Symbol</span>
                  <span role="columnheader">Meaning and source aliases</span>
                </div>
                {notation.map((entry) => entry ? (
                  <div role="row" key={entry.id}>
                    <div role="cell"><MathMarkdown>{`$${entry.symbol}$`}</MathMarkdown></div>
                    <div role="cell">
                      <strong>{entry.spokenAs}</strong>
                      <span>{entry.meaning}</span>
                      {entry.aliases.length ? (
                        <details>
                          <summary>Other books may write this differently</summary>
                          <ul>
                            {entry.aliases.map((alias) => (
                              <li key={alias.form}><MathMarkdown>{`$${alias.form}$ — ${alias.note}`}</MathMarkdown></li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ) : null)}
              </div>
            </section>
          ) : null}

          <section className="textbook-section textbook-exercise">
            <p className="eyebrow">Check your understanding</p>
            <h3>Try it before opening the help</h3>
            <MathMarkdown>{selected.exercise.prompt}</MathMarkdown>
            <details>
              <summary>Show {selected.exercise.hints.length === 1 ? "a hint" : "hints"}</summary>
              <ol>
                {selected.exercise.hints.map((hint) => <li key={hint}><MathMarkdown>{hint}</MathMarkdown></li>)}
              </ol>
            </details>
            <details>
              <summary>Show the solution</summary>
              <MathMarkdown>{selected.exercise.solution}</MathMarkdown>
            </details>
          </section>

          <details className="textbook-provenance">
            <summary>Source lineage and rewrite status</summary>
            <p>
              This explanation is independently rewritten into NisabaDB’s notation. The sources
              below are evidence and comparison points, not chapters pasted into this book.
            </p>
            <ul>
              {sources.map((reference) => reference.source ? (
                <li key={reference.sourceId}>
                  <a href={reference.source.officialUrl} target="_blank" rel="noreferrer">{reference.source.title}</a>
                  <span>{reference.note}</span>
                </li>
              ) : null)}
            </ul>
          </details>

          <nav className="textbook-pagination" aria-label="Textbook pages">
            {previous ? <Link to={nodePath(previous)}><span>Previous</span><strong>{previous.section} {previous.title}</strong></Link> : <span />}
            {next ? <Link to={nodePath(next)}><span>Next</span><strong>{next.section} {next.title}</strong></Link> : <span />}
          </nav>
        </article>

        <aside className="textbook-context" aria-label="Local knowledge dependency graph">
          <div className="textbook-pane-heading"><span>Local DAG</span><strong>What this needs and unlocks</strong></div>
          <section>
            <h3>Prerequisites</h3>
            {prerequisites.length ? prerequisites.map((node) => (
              <Link key={node.id} to={nodePath(node)}><span>{node.id}</span><strong>{node.title}</strong></Link>
            )) : <p>Entry point</p>}
          </section>
          <div className="textbook-dag-arrow" aria-hidden="true">↓</div>
          <div className="textbook-current-node"><span>{selected.id} · selected</span><strong>{selected.title}</strong></div>
          <div className="textbook-dag-arrow" aria-hidden="true">↓</div>
          <section>
            <h3>Immediately unlocks</h3>
            {dependents.length ? dependents.map((node) => (
              <Link key={node.id} to={nodePath(node)}><span>{node.id}</span><strong>{node.title}</strong></Link>
            )) : <p>End of the written frontier</p>}
          </section>
          <details className="textbook-policy">
            <summary>One-book notation policy</summary>
            <p>{knowledgeBook.notationPolicy}</p>
          </details>
          <p className="textbook-print-note">
            The web text is canonical. A future paperback will excerpt important learning paths
            from this same graph, not become a second competing textbook.
          </p>
        </aside>
      </div>
    </div>
  );
}
