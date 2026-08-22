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
import {
  knowledgeRoadmap,
  roadmapChapterById,
  roadmapChapters,
  roadmapChaptersForPart,
  roadmapParts,
  draftChapterCountForPart,
} from "../data/knowledge-roadmap";
import type { KnowledgeNode } from "../data/knowledge-schema";

const kindLabels: Record<KnowledgeNode["kind"], string> = {
  language: "Language",
  definition: "Definition",
  law: "Law",
  method: "Method",
  theorem: "Theorem",
};

type RoadmapScope = "all" | "draft" | "planned";

const draftRoadmapChapterCount = roadmapChapters.filter(
  (chapter) => chapter.publication.state === "draft",
).length;
const reviewedKnowledgeNodeCount = knowledgeNodes.filter((node) => node.status === "reviewed").length;

function nodePath(node: KnowledgeNode): string {
  return `/knowledge?node=${encodeURIComponent(node.slug)}`;
}

function firstNodePathForKnowledgeChapter(chapterId: string): string | undefined {
  const firstNode = knowledgeNodesForChapter(chapterId)[0];
  return firstNode ? nodePath(firstNode) : undefined;
}

export function KnowledgePage() {
  const [parameters] = useSearchParams();
  const [query, setQuery] = useState("");
  const [roadmapQuery, setRoadmapQuery] = useState("");
  const [roadmapScope, setRoadmapScope] = useState<RoadmapScope>("all");
  const requestedNode = parameters.get("node") ?? undefined;
  const selected = getKnowledgeNode(requestedNode) ?? knowledgeNodes[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedRoadmapQuery = roadmapQuery.trim().toLocaleLowerCase();

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

  const visibleRoadmapParts = useMemo(() => roadmapParts.map((part) => ({
    part,
    chapters: roadmapChaptersForPart(part.id).filter((candidate) => {
      if (roadmapScope !== "all" && candidate.publication.state !== roadmapScope) return false;
      if (!normalizedRoadmapQuery) return true;
      return [part.title, part.summary, candidate.id, candidate.title, candidate.goal]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedRoadmapQuery);
    }),
  })).filter(({ chapters }) => chapters.length > 0), [normalizedRoadmapQuery, roadmapScope]);

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
  const forceRoadmapPartsOpen = Boolean(normalizedRoadmapQuery) || roadmapScope !== "all";

  return (
    <div className="textbook-page">
      <header className="textbook-masthead page-shell">
        <div>
          <p className="eyebrow">The rewritten mathematics book</p>
          <h1>{knowledgeBook.title}</h1>
          <p>{knowledgeBook.subtitle}</p>
        </div>
        <dl aria-label="Textbook status">
          <div><dt>Edition</dt><dd>{knowledgeBook.edition}</dd></div>
          <div><dt>Draft chapters</dt><dd>{draftRoadmapChapterCount} of {knowledgeRoadmap.workingChapterCount}</dd></div>
          <div><dt>Written lessons</dt><dd>{knowledgeNodes.length}</dd></div>
          <div><dt>Reviewed lessons</dt><dd>{reviewedKnowledgeNodeCount}</dd></div>
          <div><dt>Whole-book map</dt><dd>{roadmapParts.length} parts · dependency DAG</dd></div>
        </dl>
      </header>

      <section className="textbook-draft-boundary page-shell" aria-labelledby="textbook-draft-title">
        <div>
          <p className="eyebrow">Writing status</p>
          <h2 id="textbook-draft-title">This is the beginning of the book, not a shelf of source titles.</h2>
        </div>
        <p>
          The first {knowledgeBook.chapters.length} chapters below are independently written lessons.
          The {knowledgeRoadmap.workingChapterCount}-chapter map is a provisional destination: only chapters
          marked <strong>Draft</strong> currently contain readable mathematics.
        </p>
      </section>

      <div className="textbook-workspace page-shell">
        <aside className="textbook-contents" aria-label="Textbook table of contents">
          <div className="textbook-pane-heading">
            <span>Written contents</span>
            <strong>{knowledgeBook.chapters.length} chapters · follow “Know first” edges</strong>
          </div>
          <label className="textbook-search">
            <span>Find a knowledge node</span>
            <input
              type="search"
              value={query}
              placeholder="Counting, fractions, proof…"
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
            <p className="textbook-no-results">No written lesson matches “{query}”.</p>
          ) : null}
        </aside>

        <article className="textbook-reader" aria-labelledby="knowledge-node-title">
          <div className="textbook-section-line">
            <span>{chapter ? `Chapter ${chapter.number} · ${chapter.title}` : "Knowledge"}</span>
            <span>{selected.readMinutes} min</span>
          </div>
          <p className="textbook-node-kind">
            {selected.section} · {kindLabels[selected.kind]} · {selected.id} · {selected.status === "reviewed" ? "Reviewed" : "Initial rewrite"}
          </p>
          <h2 id="knowledge-node-title" tabIndex={-1}>{selected.title}</h2>
          <p className="textbook-purpose">{selected.purpose}</p>

          {chapter ? (
            <aside className="textbook-chapter-compression">
              <span>What this chapter compresses</span>
              <p>{chapter.compressionGoal}</p>
            </aside>
          ) : null}

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
            <summary>Reference lineage and rewrite status</summary>
            <p>
              This lesson is independently written in NisabaDB’s notation. The records below are
              comparison references, not chapters copied into this book. Exact theorem-occurrence
              mappings remain pending until the source editions are inventoried.
            </p>
            <ul>
              {sources.map((reference) => reference.source ? (
                <li key={reference.sourceId}>
                  <div>
                    <Link to={`/knowledge/coverage?source=${encodeURIComponent(reference.source.registryRecordId)}`}>
                      {reference.source.registryRecordId} · registry record
                    </Link>
                    <a href={reference.source.officialUrl} target="_blank" rel="noreferrer">
                      {reference.source.title}
                    </a>
                  </div>
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
            The web text is the working book. A future paperback will excerpt important learning
            paths from this graph rather than become a competing curriculum.
          </p>
        </aside>
      </div>

      <section className="book-roadmap page-shell" aria-labelledby="book-roadmap-title">
        <header className="book-roadmap-heading">
          <div>
            <p className="eyebrow">The whole-book working map</p>
            <h2 id="book-roadmap-title">{knowledgeRoadmap.workingChapterCount} chapters across {roadmapParts.length} parts</h2>
          </div>
          <p>
            This is a dependency-shaped editorial map, not a claim that every chapter is written.
            Planned chapters are deliberately not clickable. Candidate prerequisites and cluster
            assignments may change as compression work finds a shorter route.
          </p>
        </header>

        <div className="book-roadmap-controls" aria-label="Whole-book map filters">
          <label>
            <span>Search the working map</span>
            <input
              type="search"
              value={roadmapQuery}
              placeholder="Calculus, symmetry, proof assistants…"
              onChange={(event) => setRoadmapQuery(event.target.value)}
            />
          </label>
          <div>
            {(["all", "draft", "planned"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                aria-pressed={roadmapScope === scope}
                onClick={() => setRoadmapScope(scope)}
              >
                {scope === "all" ? "All chapters" : scope === "draft" ? "Draft only" : "Planned only"}
              </button>
            ))}
          </div>
        </div>

        <div className="book-roadmap-summary" aria-label="Whole-book map status">
          <span><strong>{draftRoadmapChapterCount}</strong> draft</span>
          <span><strong>{knowledgeRoadmap.workingChapterCount - draftRoadmapChapterCount}</strong> planned</span>
          <span><strong>{reviewedKnowledgeNodeCount}</strong> reviewed lessons</span>
          <p>Only <strong>Draft</strong> entries open lessons.</p>
        </div>

        <div className="book-roadmap-parts">
          {visibleRoadmapParts.map(({ part, chapters: candidateChapters }) => (
            <details key={part.id} open={forceRoadmapPartsOpen || part.number === 1 ? true : undefined}>
              <summary>
                <span>Part {String(part.number).padStart(2, "0")}</span>
                <strong>{part.title}</strong>
                <small>{draftChapterCountForPart(part.id)} of {roadmapChaptersForPart(part.id).length} drafted</small>
              </summary>
              <p>{part.summary}</p>
              <ol>
                {candidateChapters.map((candidate) => {
                  const draftKnowledgeChapterId = candidate.publication.state === "draft"
                    ? candidate.publication.knowledgeChapterId
                    : undefined;
                  const isDraft = Boolean(draftKnowledgeChapterId);
                  const draftPath = draftKnowledgeChapterId
                    ? firstNodePathForKnowledgeChapter(draftKnowledgeChapterId)
                    : undefined;
                  const prerequisiteTitles = candidate.candidatePrerequisiteChapterIds.map(
                    (id) => roadmapChapterById.get(id)?.title ?? id,
                  );
                  return (
                    <li key={candidate.id} className={isDraft ? "is-draft" : "is-planned"}>
                      <div className="book-roadmap-chapter-line">
                        <span>{candidate.id} · Chapter {candidate.number}</span>
                        <em>{isDraft ? "Draft" : "Planned"}</em>
                      </div>
                      {draftPath ? (
                        <Link to={draftPath}>{candidate.title}</Link>
                      ) : (
                        <strong>{candidate.title}</strong>
                      )}
                      <p>{candidate.goal}</p>
                      <small>
                        {prerequisiteTitles.length
                          ? `Candidate prerequisite: ${prerequisiteTitles.join("; ")}`
                          : "Candidate entry point"}
                      </small>
                    </li>
                  );
                })}
              </ol>
            </details>
          ))}
          {visibleRoadmapParts.length === 0 ? (
            <p className="book-roadmap-empty">No working-map chapter matches the current filters.</p>
          ) : null}
        </div>
      </section>

      <details className="textbook-global-dag page-shell">
        <summary>
          <span>Written knowledge-node DAG</span>
          <strong>Open all {knowledgeNodes.length} written lessons and their prerequisites</strong>
        </summary>
        <div className="textbook-global-dag-body" aria-label="Written knowledge dependency index">
          <p>
            Each card names its direct prerequisites. “Needs K04” is a real edge in the written
            lesson graph; chapter order is a reading convenience and does not create an edge.
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

      <section className="compression-contract page-shell" aria-labelledby="compression-contract-title">
        <div className="compression-contract-copy">
          <p className="eyebrow">References and non-omission</p>
          <h2 id="compression-contract-title">The source works remain evidence behind the book.</h2>
          <p>
            The {__SOURCE_RECORD_COUNT__} records do not determine this curriculum. They support
            comparison, theorem inventory, notation translation, and future checks that a rewrite
            has not silently discarded source mathematics. The current atlas contains candidate
            compression routes, not completed theorem-level coverage.
          </p>
        </div>
        <div className="compression-contract-flow" aria-label="Reference processing status">
          <div><strong>{__SOURCE_RECORD_COUNT__}</strong><span>reference records preserved</span></div>
          <span aria-hidden="true">→</span>
          <div><strong>{__COMPRESSION_SOURCE_FAMILY_COUNT__}</strong><span>comparison lenses over {__SOURCE_BRANCH_COUNT__} intake branches</span></div>
          <span aria-hidden="true">→</span>
          <div><strong>{__COMPRESSION_CLUSTER_COUNT__}</strong><span>candidate common cores</span></div>
          <span aria-hidden="true">+</span>
          <div><strong>{__COMPRESSION_RESIDUAL_COUNT__}</strong><span>candidate residual placements</span></div>
        </div>
        <div className="compression-contract-rules">
          <p><span>01</span><strong>Write the common idea</strong><small>Source prose and chapter order do not control the lesson.</small></p>
          <p><span>02</span><strong>Unify notation</strong><small>Aliases translate into one stable language instead of creating duplicate knowledge.</small></p>
          <p><span>03</span><strong>Test the shorter route</strong><small>A proposed compression stays provisional until the dependencies and proofs are reviewed.</small></p>
          <p><span>04</span><strong>Account for every theorem</strong><small>Future inventories must retain every source occurrence and its exact lineage.</small></p>
        </div>
        <div className="compression-contract-links">
          <Link to="/knowledge/compression">Explore candidate compression routes <span aria-hidden="true">→</span></Link>
          <Link to="/knowledge/coverage">Audit all {__SOURCE_RECORD_COUNT__} reference records <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </div>
  );
}
