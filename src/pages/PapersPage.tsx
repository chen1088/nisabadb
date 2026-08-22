import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  corpus,
  formatDate,
  getPaperStatements,
  shortIdentifier,
  verificationMeta,
} from "../components/content";
import type { Corpus, Paper } from "../data/schema";

type CitationEdge = Corpus["citationEdges"][number];
type QueueItem = Corpus["ingestionQueue"][number];

const CATALOG_PAGE_SIZE = 50;
const GRAPH_DEPTH = 2;
const GRAPH_NODE_LIMIT = 60;
const CORPUS_MILESTONE = 10_000;

const queueLabels: Record<QueueItem["state"], string> = {
  queued: "Queued",
  "metadata-fetched": "Ready to expand",
  "neighbors-fetched": "Awaiting review",
  blocked: "Identity blocked",
  "complete-direct-neighborhood": "Neighborhood fetched",
};

function addEdge(map: Map<string, CitationEdge[]>, id: string, edge: CitationEdge) {
  const edges = map.get(id) ?? [];
  edges.push(edge);
  map.set(id, edges);
}

function ancestryLayers(
  rootId: string,
  paperById: ReadonlyMap<string, Paper>,
  outgoingByPaper: ReadonlyMap<string, CitationEdge[]>,
) {
  const seen = new Set([rootId]);
  const depthById = new Map([[rootId, 0]]);
  let frontier = [rootId];
  const layers = [[rootId]];
  let nodeLimitReached = false;

  for (let depth = 0; depth < GRAPH_DEPTH && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const paperId of frontier) {
      for (const edge of outgoingByPaper.get(paperId) ?? []) {
        if (seen.has(edge.citedPaperId) || !paperById.has(edge.citedPaperId)) continue;
        if (seen.size >= GRAPH_NODE_LIMIT) {
          nodeLimitReached = true;
          break;
        }
        seen.add(edge.citedPaperId);
        depthById.set(edge.citedPaperId, depth + 1);
        next.push(edge.citedPaperId);
      }
      if (nodeLimitReached) break;
    }
    if (!next.length) break;
    layers.push(next);
    frontier = next;
    if (nodeLimitReached) break;
  }

  const depthLimitReached = !nodeLimitReached && frontier.some((paperId) =>
    (outgoingByPaper.get(paperId) ?? []).some((edge) =>
      paperById.has(edge.citedPaperId) && !seen.has(edge.citedPaperId)
    )
  );
  const projectedEdges: CitationEdge[] = [];
  let rawVisibleEdgeCount = 0;
  for (const citingPaperId of seen) {
    const citingDepth = depthById.get(citingPaperId);
    for (const edge of outgoingByPaper.get(citingPaperId) ?? []) {
      const citedDepth = depthById.get(edge.citedPaperId);
      if (citedDepth !== undefined) rawVisibleEdgeCount += 1;
      if (citingDepth !== undefined && citedDepth === citingDepth + 1) {
        projectedEdges.push(edge);
      }
    }
  }

  return {
    layers: layers.reverse().map((layer) =>
      layer.map((id) => paperById.get(id)).filter((paper): paper is Paper => Boolean(paper))
    ),
    depthLimitReached,
    nodeCount: seen.size,
    nodeLimitReached,
    projectedEdges,
    rawVisibleEdgeCount,
  };
}

export function PapersPage() {
  const [query, setQuery] = useState("");
  const [recordStatus, setRecordStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [graphQuery, setGraphQuery] = useState("");
  const featured = corpus.papers.find((paper) => paper.featured) ?? corpus.papers[0];
  const [graphRootId, setGraphRootId] = useState(featured?.id ?? "");

  const paperById = useMemo(
    () => new Map(corpus.papers.map((paper) => [paper.id, paper])),
    [],
  );
  const queueByPaperId = useMemo(
    () => new Map(corpus.ingestionQueue.map((item) => [item.paperId, item])),
    [],
  );
  const { incomingByPaper, outgoingByPaper } = useMemo(() => {
    const incoming = new Map<string, CitationEdge[]>();
    const outgoing = new Map<string, CitationEdge[]>();
    for (const edge of corpus.citationEdges) {
      addEdge(outgoing, edge.citingPaperId, edge);
      addEdge(incoming, edge.citedPaperId, edge);
    }
    return { incomingByPaper: incoming, outgoingByPaper: outgoing };
  }, []);

  const queueCounts = useMemo(() => {
    const counts = new Map<QueueItem["state"], number>();
    for (const item of corpus.ingestionQueue) {
      counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
    }
    return counts;
  }, []);
  const goldCount = corpus.papers.filter((paper) => paper.status === "gold").length;
  const readyCount = (queueCounts.get("queued") ?? 0) + (queueCounts.get("metadata-fetched") ?? 0);
  const blockedCount = queueCounts.get("blocked") ?? 0;
  const fetchedCount = queueCounts.get("complete-direct-neighborhood") ?? 0;
  const graphRootOptions = useMemo(() => {
    const connected = new Set(corpus.citationEdges.flatMap((edge) => [edge.citingPaperId, edge.citedPaperId]));
    return corpus.papers
      .filter((paper) => connected.has(paper.id))
      .sort((left, right) => Number(right.status === "gold") - Number(left.status === "gold") ||
        left.title.localeCompare(right.title));
  }, []);
  const graphRootMatches = useMemo(() => {
    const normalized = graphQuery.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];
    return graphRootOptions.filter((paper) => [
      paper.title,
      paper.authors.join(" "),
      ...Object.values(paper.identifiers),
    ].join(" ").toLocaleLowerCase().includes(normalized)).slice(0, 8);
  }, [graphQuery, graphRootOptions]);
  const graph = useMemo(
    () => ancestryLayers(graphRootId, paperById, outgoingByPaper),
    [graphRootId, outgoingByPaper, paperById],
  );
  const selectedPaper = paperById.get(graphRootId);
  const directReferences = (outgoingByPaper.get(graphRootId) ?? [])
    .map((edge) => paperById.get(edge.citedPaperId))
    .filter((paper): paper is Paper => Boolean(paper));
  const incomingCitations = (incomingByPaper.get(graphRootId) ?? [])
    .map((edge) => paperById.get(edge.citingPaperId))
    .filter((paper): paper is Paper => Boolean(paper));

  const filteredPapers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return corpus.papers
      .filter((paper) => {
        if (recordStatus !== "all" && paper.status !== recordStatus) return false;
        if (!normalized) return true;
        return [
          paper.title,
          paper.authors.join(" "),
          paper.venue,
          paper.contributionSummary,
          ...Object.values(paper.identifiers),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized);
      })
      .sort((left, right) => Number(right.status === "gold") - Number(left.status === "gold") ||
        right.date.localeCompare(left.date) || left.title.localeCompare(right.title));
  }, [query, recordStatus]);
  const pageCount = Math.max(1, Math.ceil(filteredPapers.length / CATALOG_PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const pageStart = (activePage - 1) * CATALOG_PAGE_SIZE;
  const papers = filteredPapers.slice(pageStart, pageStart + CATALOG_PAGE_SIZE);
  const milestonePercent = Math.min(100, (corpus.papers.length / CORPUS_MILESTONE) * 100);

  const chooseGraphRoot = (paperId: string) => {
    setGraphRootId(paperId);
    setGraphQuery("");
    document.getElementById("paper-citation-graph")?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="catalog-page page-shell">
      <header className="page-hero compact-page-hero papers-corpus-hero">
        <p className="eyebrow">Active phase · build the source universe</p>
        <h1>Papers first.</h1>
        <p>
          NisabaDB is expanding a provenance-preserving paper graph before attempting global
          Knowledge compression. Gold rewrites expose proof DAGs; provisional records form the
          queue that humans and workers still need to process.
        </p>
      </header>

      <section className="corpus-command" aria-labelledby="corpus-command-title">
        <div>
          <p className="eyebrow">Corpus acquisition</p>
          <h2 id="corpus-command-title">A backlog large enough to reveal real mathematical overlap</h2>
          <p>
            The first thousand records are a collection milestone, not permission to merge
            knowledge. Every paper must still pass source acquisition, theorem extraction,
            dependency review, and verification.
          </p>
          <div className="corpus-milestone" aria-label={`${corpus.papers.length} of ${CORPUS_MILESTONE} paper records`}>
            <span style={{ width: `${milestonePercent}%` }} />
          </div>
          <small>{corpus.papers.length.toLocaleString()} discovered · next durable catalog milestone {CORPUS_MILESTONE.toLocaleString()}</small>
        </div>
        <dl>
          <div><dt>Paper records</dt><dd>{corpus.papers.length.toLocaleString()}</dd></div>
          <div><dt>Observed citation edges</dt><dd>{corpus.citationEdges.length.toLocaleString()}</dd></div>
          <div><dt>Gold proof graphs</dt><dd>{goldCount}</dd></div>
          <div><dt>Ready to expand</dt><dd>{readyCount.toLocaleString()}</dd></div>
        </dl>
      </section>

      <section id="paper-citation-graph" className="paper-citation-stage" aria-labelledby="paper-citation-title">
        <header>
          <div>
            <p className="eyebrow">Rooted source ancestry</p>
            <h2 id="paper-citation-title">Paper citation DAG projection</h2>
            <p>
              A selected paper is placed after the works it cites. The raw citation network is
              retained separately and may contain cycles; this focused projection collapses
              repeated nodes, retains only forward adjacent-layer relations, and stops safely at
              a bounded frontier. Omitted raw relations are counted below.
            </p>
          </div>
          <div className="graph-root-search">
            <label>
              <span>Find a paper to map</span>
              <input
                type="search"
                value={graphQuery}
                placeholder="Type at least two characters…"
                onChange={(event) => setGraphQuery(event.target.value)}
              />
            </label>
            {graphRootMatches.length ? (
              <ul aria-label="Matching papers for the citation map">
                {graphRootMatches.map((paper) => (
                  <li key={paper.id}>
                    <button type="button" onClick={() => chooseGraphRoot(paper.id)}>{paper.title}</button>
                  </li>
                ))}
              </ul>
            ) : null}
            {graphQuery.trim().length >= 2 ? (
              <small role="status">{graphRootMatches.length ? `${graphRootMatches.length} connected matches shown.` : "No connected paper matches."}</small>
            ) : null}
            <p><span>Mapped paper</span>{selectedPaper?.title ?? "No paper selected"}</p>
          </div>
        </header>

        <div className="paper-citation-layout">
          <div className="paper-dag-panel">
            <p className="graph-projection-summary" aria-live="polite">
              {graph.nodeCount} papers · {graph.projectedEdges.length} layer-respecting citation relations · {graph.rawVisibleEdgeCount - graph.projectedEdges.length} additional raw relations omitted to preserve the DAG · at most {GRAPH_DEPTH} citation steps
            </p>
            <div className="paper-ancestry-dag" aria-label="Rooted paper citation DAG">
              {graph.layers.map((layer, layerIndex) => {
                const stepsEarlier = graph.layers.length - layerIndex - 1;
                return (
                  <section key={`${graphRootId}-${layerIndex}`} aria-label={stepsEarlier ? `${stepsEarlier} citation steps before the selected paper` : "Selected paper"}>
                    <span>{stepsEarlier ? `${stepsEarlier} step${stepsEarlier === 1 ? "" : "s"} earlier` : "Selected paper"}</span>
                    <div>
                      {layer.map((paper) => {
                        const queueItem = queueByPaperId.get(paper.id);
                        const projectedDependents = graph.projectedEdges
                          .filter((edge) => edge.citedPaperId === paper.id)
                          .map((edge) => paperById.get(edge.citingPaperId))
                          .filter((dependent): dependent is Paper => Boolean(dependent));
                        return (
                          <button
                            key={paper.id}
                            type="button"
                            aria-pressed={paper.id === graphRootId}
                            className={paper.id === graphRootId ? "is-selected" : ""}
                            onClick={() => chooseGraphRoot(paper.id)}
                          >
                            <small>{paper.date.slice(0, 4)} · {paper.status} · {queueItem ? queueLabels[queueItem.state] : "Cataloged"}</small>
                            <strong>{paper.title}</strong>
                            {projectedDependents.length ? (
                              <span className="paper-node-connections">
                                <span>Cited by later in this projection</span>
                                {projectedDependents.map((dependent) => <span key={dependent.id}>→ {dependent.title}</span>)}
                              </span>
                            ) : <span>Selected endpoint</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            {graph.nodeLimitReached ? (
              <p className="graph-truncation-note">The record limit stopped this projection at {GRAPH_NODE_LIMIT} papers. Select any node to continue from there.</p>
            ) : null}
            {graph.depthLimitReached ? (
              <p className="graph-truncation-note">More ancestry exists beyond the visible {GRAPH_DEPTH}-step depth limit. Select an earlier node to continue.</p>
            ) : null}
          </div>

          {selectedPaper ? (
            <article className="paper-citation-reader" aria-label={`Citation record for ${selectedPaper.title}`}>
              <span>{selectedPaper.status} paper · {selectedPaper.date.slice(0, 4)}</span>
              <h3>{selectedPaper.title}</h3>
              <p>{selectedPaper.contributionSummary}</p>
              <dl>
                <div><dt>Direct references represented</dt><dd>{directReferences.length}</dd></div>
                <div><dt>Incoming records represented</dt><dd>{incomingCitations.length}</dd></div>
                <div><dt>Queue state</dt><dd>{queueLabels[queueByPaperId.get(selectedPaper.id)?.state ?? "queued"]}</dd></div>
              </dl>
              <div>
                <h4>Direct citation edges</h4>
                {directReferences.length ? (
                  <ul>
                    {directReferences.slice(0, 12).map((paper) => (
                      <li key={paper.id}>
                        <button type="button" onClick={() => chooseGraphRoot(paper.id)}>{paper.title}</button>
                      </li>
                    ))}
                  </ul>
                ) : <p>No outgoing reference edges are represented yet.</p>}
                {directReferences.length > 12 ? <small>Showing 12 of {directReferences.length} direct references.</small> : null}
              </div>
              <Link to={`/papers/${selectedPaper.id}`}>Open full paper record →</Link>
            </article>
          ) : null}
        </div>
      </section>

      <section className="processing-backlog" aria-labelledby="processing-backlog-title">
        <header>
          <p className="eyebrow">Work queue</p>
          <h2 id="processing-backlog-title">What the corpus still needs</h2>
        </header>
        <div>
          <article><span>01</span><strong>{readyCount.toLocaleString()}</strong><h3>Expand metadata</h3><p>Fetch direct source neighborhoods and preserve provider evidence.</p></article>
          <article><span>02</span><strong>{blockedCount.toLocaleString()}</strong><h3>Resolve identities</h3><p>Match DOI, arXiv, and provider IDs without title-only merges.</p></article>
          <article><span>03</span><strong>{fetchedCount.toLocaleString()}</strong><h3>Extract mathematics</h3><p>Turn fetched papers into reviewed theorem and proof DAGs.</p></article>
          <article><span>04</span><strong>{goldCount}</strong><h3>Verify and publish</h3><p>Administrative review promotes only evidence-backed gold records.</p></article>
        </div>
      </section>

      <section className="catalog-controls" aria-label="Paper catalog filters">
        <label className="search-control">
          <span>Search the catalog</span>
          <span className="input-shell">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Title, author, venue, identifier…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
        <label>
          <span>Record class</span>
          <select value={recordStatus} onChange={(event) => {
            setRecordStatus(event.target.value);
            setPage(1);
          }}>
            <option value="all">All records</option>
            <option value="gold">Gold rewrites</option>
            <option value="provisional">Provisional metadata</option>
          </select>
        </label>
        <p aria-live="polite">
          <strong>{filteredPapers.length.toLocaleString()}</strong> of {corpus.papers.length.toLocaleString()} records
        </p>
      </section>

      <nav className="catalog-pagination" aria-label="Paper catalog pages">
        <span>Page {activePage.toLocaleString()} of {pageCount.toLocaleString()}</span>
        <div>
          <button type="button" disabled={activePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <button type="button" disabled={activePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
        </div>
      </nav>

      <div className="paper-list">
        {papers.map((paper, index) => {
          const statements = getPaperStatements(paper.id);
          const queueItem = queueByPaperId.get(paper.id);
          return (
            <article key={paper.id} className={`paper-card paper-${paper.status}`}>
              <div className="paper-card-index">{String(pageStart + index + 1).padStart(4, "0")}</div>
              <div className="paper-card-body">
                <div className="paper-card-topline">
                  <span className={`record-state record-${paper.status}`}>{paper.status}</span>
                  <span>{formatDate(paper.date)}</span>
                  <span>{paper.venue}</span>
                </div>
                <h2><Link to={`/papers/${paper.id}`}>{paper.title}</Link></h2>
                <p className="paper-authors">{paper.authors.join(", ")}</p>
                <p>{paper.contributionSummary}</p>
                <div className="paper-card-footer">
                  <span>{shortIdentifier(paper)}</span>
                  <span>{statements.length} statement records</span>
                  <span>{queueItem ? queueLabels[queueItem.state] : verificationMeta[paper.formalizationStatus].label}</span>
                  <button className="text-link" type="button" onClick={() => chooseGraphRoot(paper.id)}>Map ancestry</button>
                  <Link className="text-link with-arrow" to={`/papers/${paper.id}`}>
                    {paper.status === "gold" ? "Open rewrite" : "View record"} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
        {!papers.length ? (
          <div className="empty-state"><strong>No papers match.</strong><span>Clear the search or include both record classes.</span></div>
        ) : null}
      </div>
    </div>
  );
}
