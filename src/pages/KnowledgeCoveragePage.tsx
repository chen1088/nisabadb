import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  bookGraphManifestSchema,
  validateBookGraphFile,
  type BookGraphFile,
  type BookGraphManifest,
} from "../data/book-graph-schema";
import { sourceRegistrySchema, type SourceRegistry } from "../data/source-coverage-schema";

type CoverageData = {
  registry: SourceRegistry;
  manifest: BookGraphManifest;
};

type ManifestEntry = BookGraphManifest["entries"][number];

const pageSize = 30;
const graphDetailLimit = 200;

function coverageDataUrl(filename: string) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}_knowledge-coverage/${filename}`;
}

function ratio(value: number, total: number) {
  return total ? `${value.toLocaleString()} / ${total.toLocaleString()}` : "0 / 0";
}

function humanize(value: string) {
  return value.replaceAll("-", " ");
}

function entryMetricsMatchFile(entry: ManifestEntry, file: BookGraphFile) {
  const theoremNodeCount = file.graph.nodes.filter((node) => node.nodeClass === "theorem-like").length;
  const routedTheoremIds = new Set(file.graph.proofRoutes.map((route) => route.theoremNodeId));
  const unroutedTheoremCount = file.graph.nodes.filter((node) => (
    node.nodeClass === "theorem-like" && !routedTheoremIds.has(node.id)
  )).length;
  const supportNodeCount = file.graph.nodes.length - theoremNodeCount;
  const reviewedDependencyCount = file.graph.directDependencies.filter((dependency) => (
    dependency.evidence.status === "reviewed"
  )).length;
  const unresolvedReferenceCount = file.graph.references.filter((reference) => (
    reference.resolution.status === "unresolved"
  )).length;

  return entry.extractionStatus === file.extractionState.status
    && entry.graphStatus === file.graphState.status
    && entry.exactEditionResolved === (file.exactEdition !== null)
    && entry.sourceUnitCount === file.sourceUnits.length
    && entry.inventoriedSourceUnitCount === file.unitInventories.filter((inventory) => inventory.evidence.status !== "pending").length
    && entry.reviewedSourceUnitCount === file.unitInventories.filter((inventory) => inventory.evidence.status === "reviewed").length
    && entry.theoremNodeCount === theoremNodeCount
    && entry.unroutedTheoremCount === unroutedTheoremCount
    && entry.supportNodeCount === supportNodeCount
    && entry.dependencyCount === file.graph.directDependencies.length
    && entry.reviewedDependencyCount === reviewedDependencyCount
    && entry.unresolvedReferenceCount === unresolvedReferenceCount;
}

function aggregateStatus(entries: readonly ManifestEntry[]) {
  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.graphStatus, (statusCounts.get(entry.graphStatus) ?? 0) + 1);
  }
  return [...statusCounts.entries()]
    .map(([status, count]) => entries.length === 1 ? humanize(status) : `${count} ${humanize(status)}`)
    .join(" · ");
}

function visibleDetailItems<T extends { id: string }>(items: readonly T[], targetId: string) {
  if (items.length <= graphDetailLimit) return items;
  const visible = items.slice(0, graphDetailLimit);
  const target = targetId ? items.find((item) => item.id === targetId) : undefined;
  if (!target || visible.some((item) => item.id === target.id)) return visible;
  return [...visible.slice(0, graphDetailLimit - 1), target];
}

function detailLimitNote(total: number) {
  return total > graphDetailLimit
    ? <p className="selected-source-empty">Showing {graphDetailLimit.toLocaleString()} items here for browser performance; the individual book JSON contains all {total.toLocaleString()}.</p>
    : null;
}

export function KnowledgeCoveragePage() {
  const [parameters] = useSearchParams();
  const { hash } = useLocation();
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState("");
  const [selectedGraph, setSelectedGraph] = useState<BookGraphFile | null>(null);
  const [selectedGraphPath, setSelectedGraphPath] = useState("");
  const [selectedGraphError, setSelectedGraphError] = useState("");
  const [selectedGraphLoading, setSelectedGraphLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [familyId, setFamilyId] = useState(parameters.get("family") ?? "all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [registryResponse, manifestResponse] = await Promise.all([
          fetch(coverageDataUrl("source-records.json"), { signal: controller.signal }),
          fetch(coverageDataUrl("books/manifest.json"), { signal: controller.signal }),
        ]);
        if (!registryResponse.ok || !manifestResponse.ok) {
          throw new Error("The source registry or book-graph manifest could not be loaded.");
        }
        const registry = sourceRegistrySchema.parse(await registryResponse.json());
        const manifest = bookGraphManifestSchema.parse(await manifestResponse.json());
        const requiredComponentCount = registry.records.reduce((count, record) => (
          count + record.requiredEditionComponents.length
        ), 0);
        if (manifest.sourceSetRevision !== registry.sourceSetRevision
          || manifest.sourceRecordCount !== registry.records.length
          || manifest.componentFileCount !== requiredComponentCount
          || manifest.entries.length !== requiredComponentCount) {
          throw new Error("The book-graph manifest does not match the approved source registry.");
        }
        setData({ registry, manifest });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "The source graph index could not be loaded.");
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const entriesByRecord = useMemo(() => {
    const result = new Map<string, ManifestEntry[]>();
    for (const entry of data?.manifest.entries ?? []) {
      const entries = result.get(entry.sourceRecordId) ?? [];
      entries.push(entry);
      result.set(entry.sourceRecordId, entries);
    }
    return result;
  }, [data]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleRecords = useMemo(() => {
    if (!data) return [];
    return data.registry.records.filter((record) => {
      if (familyId !== "all" && record.familyId !== familyId) return false;
      return !normalizedQuery || [record.id, record.title, record.authorLine, record.rawCitation]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [data, familyId, normalizedQuery]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRecords = visibleRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRecordId = parameters.get("source");
  const requestedComponentId = parameters.get("component");
  const selectedRecord = data?.registry.records.find((record) => record.id === selectedRecordId);
  const selectedEntries = selectedRecord ? entriesByRecord.get(selectedRecord.id) ?? [] : [];
  const selectedEntry = selectedEntries.find((entry) => entry.componentId === requestedComponentId)
    ?? selectedEntries[0];
  const familyById = new Map(data?.registry.families.map((family) => [family.id, family]) ?? []);
  const selectedDetailId = hash ? decodeURIComponent(hash.slice(1)) : "";
  const visibleNodes = selectedGraph
    ? visibleDetailItems(selectedGraph.graph.nodes, selectedDetailId)
    : [];
  const visibleExternalInputs = selectedGraph
    ? visibleDetailItems(selectedGraph.graph.externalInputs, selectedDetailId)
    : [];
  const visibleDependencies = selectedGraph
    ? visibleDetailItems(selectedGraph.graph.directDependencies, selectedDetailId)
    : [];
  const visibleProofRoutes = selectedGraph
    ? visibleDetailItems(selectedGraph.graph.proofRoutes, selectedDetailId)
    : [];
  const visibleReferences = selectedGraph
    ? visibleDetailItems(selectedGraph.graph.references, selectedDetailId)
    : [];
  const selectedNodeLabels = new Map(selectedGraph?.graph.nodes.map((node) => (
    [node.id, `${node.title} (${node.id})`] as const
  )) ?? []);
  const selectedInputLabels = new Map(selectedGraph?.graph.externalInputs.map((input) => (
    [input.id, `${input.label} (${input.id})`] as const
  )) ?? []);
  const selectedTargetLabel = (type: "node" | "external-input", id: string) => (
    (type === "node" ? selectedNodeLabels : selectedInputLabels).get(id) ?? id
  );

  useEffect(() => {
    if (!data || !selectedRecord || !selectedEntry) {
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;
        setSelectedGraph(null);
        setSelectedGraphPath(selectedEntry.path);
        setSelectedGraphError("");
        setSelectedGraphLoading(true);
        const response = await fetch(coverageDataUrl(`books/${selectedEntry.path}`), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`The graph file ${selectedEntry.path} could not be loaded.`);
        const file = validateBookGraphFile(await response.json());
        if (file.identity.sourceSetRevision !== data.registry.sourceSetRevision
          || file.identity.bookGraphId !== selectedEntry.bookGraphId
          || file.identity.sourceRecordId !== selectedRecord.id
          || file.identity.componentId !== selectedEntry.componentId
          || !entryMetricsMatchFile(selectedEntry, file)) {
          throw new Error(`The graph file ${selectedEntry.path} does not match its manifest entry.`);
        }
        setSelectedGraph(file);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setSelectedGraphError(loadError instanceof Error ? loadError.message : "The selected graph could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setSelectedGraphLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [data, selectedEntry, selectedRecord]);

  useEffect(() => {
    if (!data || !selectedRecord || selectedGraphLoading) return;
    const targetId = hash ? decodeURIComponent(hash.slice(1)) : "selected-source-title";
    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView?.({ block: "start" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, hash, selectedGraph, selectedGraphLoading, selectedRecord]);

  const summary = data?.manifest.summary;
  const componentCount = data?.manifest.componentFileCount ?? __SOURCE_COMPONENT_COUNT__;
  const candidateDependencyCount = summary
    ? summary.dependencyCount - summary.reviewedDependencyCount
    : 0;

  return (
    <div className="coverage-page">
      <header className="coverage-hero page-shell">
        <div>
          <p className="audit-breadcrumb"><Link to="/knowledge">Knowledge</Link><span>/</span> Source graphs</p>
          <p className="eyebrow">Phase I · one graph file per required book component</p>
          <h1>Build the dependency graph before compressing the library.</h1>
          <p>
            Each approved source gets its own durable JSON graph. The first job is to identify the
            exact edition, inventory every theorem-like and supporting node, and record its direct
            proof dependencies. Compression and simplification remain a later phase.
          </p>
          <div className="coverage-hero-actions">
            <a href="#source-registry">Inspect the source registry</a>
            <Link to="/knowledge">Return to Knowledge</Link>
          </div>
        </div>
        <aside aria-label="Phase-I scope">
          <span>Approved corpus</span>
          <strong>{data?.registry.records.length ?? __SOURCE_RECORD_COUNT__} records · {componentCount} component files</strong>
          <p>A multi-volume source has one independently loadable graph file for each required component.</p>
        </aside>
      </header>

      <section className="coverage-progress page-shell" aria-labelledby="coverage-progress-title" aria-live="polite">
        <header>
          <p className="eyebrow">Derived from the book-graph manifest</p>
          <h2 id="coverage-progress-title">Phase-I progress is explicit.</h2>
        </header>
        {error ? <p className="coverage-load-error" role="alert">{error}</p> : null}
        {!summary && !error ? <p className="coverage-loading">Loading the source registry and graph manifest…</p> : null}
        {summary && data ? (
          <>
            <dl aria-label="Source dependency graph status">
              <div><dt>Approved source records</dt><dd>{data.registry.records.length.toLocaleString()}</dd></div>
              <div><dt>Component JSON files</dt><dd>{ratio(data.manifest.entries.length, componentCount)}</dd></div>
              <div><dt>Exact editions identified</dt><dd>{ratio(summary.exactEditionResolvedCount, componentCount)}</dd></div>
              <div><dt>Reviewed-complete graphs</dt><dd>{ratio(summary.reviewedCompleteGraphCount, componentCount)}</dd></div>
              <div><dt>Theorem-like nodes</dt><dd>{summary.theoremNodeCount.toLocaleString()}</dd></div>
              <div><dt>Theorem nodes without a route</dt><dd>{summary.unroutedTheoremCount.toLocaleString()}</dd></div>
              <div><dt>Supporting nodes</dt><dd>{summary.supportNodeCount.toLocaleString()}</dd></div>
              <div><dt>Dependencies · candidate / reviewed</dt><dd>{candidateDependencyCount.toLocaleString()} / {summary.reviewedDependencyCount.toLocaleString()}</dd></div>
              <div><dt>Unresolved source references</dt><dd>{summary.unresolvedReferenceCount.toLocaleString()}</dd></div>
            </dl>
            <p className="coverage-terminal-breakdown">
              Source units: <strong>{summary.sourceUnitCount.toLocaleString()}</strong>
              <span>·</span>
              Inventoried / reviewed units: <strong>{summary.inventoriedSourceUnitCount.toLocaleString()} / {summary.reviewedSourceUnitCount.toLocaleString()}</strong>
              <span>·</span>
              Reviewed extractions: <strong>{summary.reviewedExtractionCount.toLocaleString()}</strong>
              <span>·</span>
              Components awaiting an edition: <strong>{summary.awaitingEditionCount.toLocaleString()}</strong>
            </p>
          </>
        ) : null}
        <p className="coverage-progress-note">
          The manifest indexes every required component, while this page fetches only the graph file
          selected below. The 126-chapter Knowledge roadmap is not used as a corpus-coverage count.
        </p>
      </section>

      <section className="coverage-model page-shell" aria-labelledby="coverage-model-title">
        <div>
          <p className="eyebrow">The source-first data model</p>
          <h2 id="coverage-model-title">Every book remains inspectable on its own terms.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Exact source</strong><p>A pinned edition, source-unit manifest, stable locator, format, license, and artifact fingerprints.</p></li>
          <li><span>02</span><strong>Local graph</strong><p>Theorem-like and support nodes, direct dependencies, proof routes, external inputs, and source references.</p></li>
          <li><span>03</span><strong>Independent review</strong><p>Extraction and graph states advance separately; candidate evidence never masquerades as reviewed completion.</p></li>
        </ol>
      </section>

      <section className="source-registry page-shell" id="source-registry" aria-labelledby="source-registry-title">
        <header>
          <div>
            <p className="eyebrow">Approved intake · {componentCount} individually addressable files</p>
            <h2 id="source-registry-title">The source registry</h2>
            <p>Select a record, then choose one of its required book components.</p>
          </div>
          {data ? <strong>{visibleRecords.length.toLocaleString()} matching records</strong> : null}
        </header>

        {selectedRecord && selectedEntry ? (
          <aside className="selected-source-record" aria-labelledby="selected-source-title">
            <div><span>{selectedRecord.id}</span><small>{selectedEntries.length} component{selectedEntries.length === 1 ? "" : "s"}</small></div>
            <h3 id="selected-source-title" tabIndex={-1}>{selectedRecord.title}</h3>
            <p>{selectedRecord.authorLine}</p>
            <dl>
              <div><dt>Intake branch</dt><dd>{familyById.get(selectedRecord.familyId)?.title}</dd></div>
              <div><dt>Selected component</dt><dd>{selectedEntry.componentLabel}</dd></div>
              <div><dt>Extraction state</dt><dd>{humanize(selectedEntry.extractionStatus)}</dd></div>
              <div><dt>Graph state</dt><dd>{humanize(selectedEntry.graphStatus)}</dd></div>
              <div><dt>Graph file</dt><dd>{selectedEntry.path}</dd></div>
            </dl>

            <nav className="book-component-choices" aria-label={`Components of ${selectedRecord.title}`}>
              {selectedEntries.map((entry) => (
                <Link
                  className={entry.componentId === selectedEntry.componentId ? "is-current" : undefined}
                  key={entry.bookGraphId}
                  to={`/knowledge/coverage?source=${selectedRecord.id}&component=${entry.componentId}`}
                  aria-current={entry.componentId === selectedEntry.componentId ? "page" : undefined}
                >
                  <strong>{entry.componentLabel}</strong>
                  <span>{humanize(entry.extractionStatus)} · {humanize(entry.graphStatus)}</span>
                </Link>
              ))}
            </nav>

            <div className="selected-book-graph" aria-live="polite">
              {selectedGraphLoading ? <p className="coverage-loading">Loading {selectedGraphPath}…</p> : null}
              {selectedGraphError ? <p className="coverage-load-error" role="alert">{selectedGraphError}</p> : null}
              {selectedGraph ? (
                <>
                  <section className="source-edition-audit" aria-labelledby={`${selectedGraph.identity.componentId}-edition-title`}>
                    <header>
                      <div>
                        <span>Exact edition</span>
                        <strong id={`${selectedGraph.identity.componentId}-edition-title`}>
                          {selectedGraph.exactEdition?.label ?? "Not identified yet"}
                        </strong>
                      </div>
                      <small>{humanize(selectedGraph.extractionState.status)} · {humanize(selectedGraph.graphState.status)}</small>
                    </header>
                    {selectedGraph.exactEdition ? (
                      <dl>
                        <div><dt>Stable locator</dt><dd>{selectedGraph.exactEdition.stableLocator}</dd></div>
                        <div><dt>Publication</dt><dd>{[selectedGraph.exactEdition.publisher, selectedGraph.exactEdition.publicationYear].filter(Boolean).join(" · ") || "Not supplied"}</dd></div>
                        <div><dt>Format / access</dt><dd>{humanize(selectedGraph.exactEdition.sourceFormat)} · {humanize(selectedGraph.exactEdition.accessKind)}</dd></div>
                        <div><dt>Source revision</dt><dd>{selectedGraph.exactEdition.sourceRevision ?? "No repository revision"}</dd></div>
                        <div><dt>Source units</dt><dd>{selectedGraph.sourceUnits.length.toLocaleString()} {humanize(selectedGraph.exactEdition.sourceUnitKind)} units</dd></div>
                        <div><dt>License</dt><dd>{selectedGraph.exactEdition.licenseSpdx ?? "Not supplied"}</dd></div>
                        <div><dt>License note</dt><dd>{selectedGraph.exactEdition.licenseNote}</dd></div>
                      </dl>
                    ) : (
                      <p className="selected-source-empty">This component remains queued until an exact edition is fixed and fingerprinted.</p>
                    )}
                    <p><strong>Extraction:</strong> {selectedGraph.extractionState.note}</p>
                    <p><strong>Graph:</strong> {selectedGraph.graphState.note}</p>
                  </section>

                  <dl className="book-graph-overview" aria-label="Selected component graph counts">
                    <div><dt>Theorem-like nodes</dt><dd>{selectedEntry.theoremNodeCount}</dd></div>
                    <div><dt>Theorems without a route</dt><dd>{selectedEntry.unroutedTheoremCount}</dd></div>
                    <div><dt>Support nodes</dt><dd>{selectedEntry.supportNodeCount}</dd></div>
                    <div><dt>Inventoried source units</dt><dd>{selectedEntry.inventoriedSourceUnitCount} / {selectedEntry.sourceUnitCount}</dd></div>
                    <div><dt>Reviewed source units</dt><dd>{selectedEntry.reviewedSourceUnitCount}</dd></div>
                    <div><dt>Direct dependencies</dt><dd>{selectedEntry.dependencyCount}</dd></div>
                    <div><dt>Reviewed dependencies</dt><dd>{selectedEntry.reviewedDependencyCount}</dd></div>
                    <div><dt>Proof routes</dt><dd>{selectedGraph.graph.proofRoutes.length}</dd></div>
                    <div><dt>External inputs</dt><dd>{selectedGraph.graph.externalInputs.length}</dd></div>
                    <div><dt>References</dt><dd>{selectedGraph.graph.references.length}</dd></div>
                    <div><dt>Unresolved references</dt><dd>{selectedEntry.unresolvedReferenceCount}</dd></div>
                  </dl>

                  <section className="book-graph-section" aria-labelledby="selected-graph-nodes-title">
                    <header><h4 id="selected-graph-nodes-title">Graph nodes</h4><span>{selectedGraph.graph.nodes.length.toLocaleString()}</span></header>
                    {selectedGraph.graph.nodes.length ? (
                      <div className="theorem-occurrence-list">
                        {visibleNodes.map((node) => (
                          <article id={node.id} key={node.id} tabIndex={-1}>
                            <header>
                              <span>{node.id} · {humanize(node.nodeClass)} · {humanize(node.kind)}</span>
                              <small>{node.evidence.status}</small>
                            </header>
                            <h4>{node.title}</h4>
                            <p>{node.normalizedStatement}</p>
                            <dl>
                              <div><dt>Source label</dt><dd>{node.sourceLabel}</dd></div>
                              <div><dt>Source locator</dt><dd>{node.sourceLocator}</dd></div>
                              <div><dt>Source XML ID</dt><dd>{node.sourceXmlId ?? "None"}</dd></div>
                              <div><dt>Evidence units</dt><dd>{node.evidence.sourceUnitIds.join(" · ") || "Pending"}</dd></div>
                            </dl>
                            <Link className="theorem-occurrence-permalink" to={`/knowledge/coverage?source=${selectedRecord.id}&component=${selectedEntry.componentId}#${node.id}`}>Permanent node address</Link>
                          </article>
                        ))}
                      </div>
                    ) : <p className="selected-source-empty">No theorem-like or supporting nodes have been published for this component yet.</p>}
                    {detailLimitNote(selectedGraph.graph.nodes.length)}
                  </section>

                  <section className="book-graph-section" aria-labelledby="selected-external-inputs-title">
                    <header><h4 id="selected-external-inputs-title">External inputs</h4><span>{selectedGraph.graph.externalInputs.length.toLocaleString()}</span></header>
                    {selectedGraph.graph.externalInputs.length ? (
                      <div className="theorem-occurrence-list">
                        {visibleExternalInputs.map((input) => (
                          <article id={input.id} key={input.id} tabIndex={-1}>
                            <header><span>{input.id} · {humanize(input.kind)}</span><small>{input.evidence.status}</small></header>
                            <h4>{input.label}</h4>
                            <p>{input.normalizedStatement}</p>
                            <p><strong>Source:</strong> {input.sourceCitation}</p>
                          </article>
                        ))}
                      </div>
                    ) : <p className="selected-source-empty">No external inputs are recorded.</p>}
                    {detailLimitNote(selectedGraph.graph.externalInputs.length)}
                  </section>

                  <section className="book-graph-section" aria-labelledby="selected-dependencies-title">
                    <header><h4 id="selected-dependencies-title">Direct dependencies</h4><span>{selectedGraph.graph.directDependencies.length.toLocaleString()}</span></header>
                    {selectedGraph.graph.directDependencies.length ? (
                      <div className="theorem-occurrence-list">
                        {visibleDependencies.map((dependency) => (
                          <article id={dependency.id} key={dependency.id} tabIndex={-1}>
                            <header><span>{dependency.id} · {humanize(dependency.role)}</span><small>{dependency.evidence.status}</small></header>
                            <h4>{selectedTargetLabel("node", dependency.dependentNodeId)}</h4>
                            <p>Depends directly on <strong>{selectedTargetLabel(dependency.prerequisite.type, dependency.prerequisite.id)}</strong>.</p>
                            <p>{dependency.rationale}</p>
                          </article>
                        ))}
                      </div>
                    ) : <p className="selected-source-empty">No direct dependency edges are recorded yet.</p>}
                    {detailLimitNote(selectedGraph.graph.directDependencies.length)}
                  </section>

                  <section className="book-graph-section" aria-labelledby="selected-proof-routes-title">
                    <header><h4 id="selected-proof-routes-title">Proof routes</h4><span>{selectedGraph.graph.proofRoutes.length.toLocaleString()}</span></header>
                    {selectedGraph.graph.proofRoutes.length ? (
                      <div className="theorem-occurrence-list">
                        {visibleProofRoutes.map((route) => (
                          <article id={route.id} key={route.id} tabIndex={-1}>
                            <header><span>{route.id} · {humanize(route.routeKind)}</span><small>{route.evidence.status}</small></header>
                            <h4>{selectedTargetLabel("node", route.theoremNodeId)}</h4>
                            <p>{route.summary}</p>
                            <p><strong>Dependency edges:</strong> {route.dependencyIds.length ? route.dependencyIds.join(" · ") : "None (root attestation)"}</p>
                          </article>
                        ))}
                      </div>
                    ) : <p className="selected-source-empty">No proof routes or root attestations are recorded yet.</p>}
                    {detailLimitNote(selectedGraph.graph.proofRoutes.length)}
                  </section>

                  <section className="book-graph-section" aria-labelledby="selected-references-title">
                    <header><h4 id="selected-references-title">Source references</h4><span>{selectedGraph.graph.references.length.toLocaleString()}</span></header>
                    {selectedGraph.graph.references.length ? (
                      <div className="theorem-occurrence-list">
                        {visibleReferences.map((reference) => (
                          <article id={reference.id} key={reference.id} tabIndex={-1}>
                            <header>
                              <span>{reference.id} · {humanize(reference.basis)} · {reference.ref}</span>
                              <small>{reference.resolution.status} · {reference.evidence.status}</small>
                            </header>
                            <h4>{selectedTargetLabel("node", reference.ownerNodeId)}</h4>
                            <p>{reference.context}</p>
                            <dl>
                              <div><dt>Source locator</dt><dd>{reference.locator}</dd></div>
                              <div><dt>Resolution</dt><dd>{reference.resolution.status === "resolved" ? selectedTargetLabel(reference.resolution.target.type, reference.resolution.target.id) : "Unresolved"}</dd></div>
                              <div><dt>Dependency edge</dt><dd>{reference.resolution.status === "resolved" ? reference.resolution.directDependencyId ?? "Statement reference only" : "None"}</dd></div>
                              <div><dt>Resolution note</dt><dd>{reference.resolution.note}</dd></div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : <p className="selected-source-empty">No proof or statement references are recorded yet.</p>}
                    {detailLimitNote(selectedGraph.graph.references.length)}
                  </section>
                </>
              ) : null}
            </div>
            <Link to="/knowledge/coverage">Close source detail</Link>
          </aside>
        ) : null}

        <div className="source-registry-controls" aria-label="Source registry filters">
          <label>
            <span>Find a source</span>
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Title, author, or record ID…" />
          </label>
          <label>
            <span>Intake branch</span>
            <select value={familyId} onChange={(event) => { setFamilyId(event.target.value); setPage(1); }}>
              <option value="all">All {__SOURCE_BRANCH_COUNT__} intake branches</option>
              {data?.registry.families.map((family) => <option key={family.id} value={family.id}>{family.number}. {family.title}</option>)}
            </select>
          </label>
        </div>

        {data ? (
          <div className="source-registry-table-wrap">
            <table className="source-registry-table">
              <thead><tr><th>Record</th><th>Source</th><th>Intake branch</th><th>Component files</th><th>Graph state</th></tr></thead>
              <tbody>
                {pageRecords.map((record) => {
                  const entries = entriesByRecord.get(record.id) ?? [];
                  const firstEntry = entries[0];
                  const exactEditionCount = entries.filter((entry) => entry.exactEditionResolved).length;
                  return (
                    <tr key={record.id}>
                      <td>{firstEntry ? <Link to={`/knowledge/coverage?source=${record.id}&component=${firstEntry.componentId}`}>{record.id}</Link> : record.id}</td>
                      <td><strong>{record.title}</strong><span>{record.authorLine}</span></td>
                      <td>{familyById.get(record.familyId)?.title}</td>
                      <td>{entries.length} file{entries.length === 1 ? "" : "s"} · {exactEditionCount} exact edition{exactEditionCount === 1 ? "" : "s"}</td>
                      <td><span data-state={entries.every((entry) => entry.graphStatus === "reviewed-complete") ? "reviewed-complete" : "pending"}>{aggregateStatus(entries)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!pageRecords.length ? <p className="source-registry-empty">No source matches these filters.</p> : null}
          </div>
        ) : null}

        {data && visibleRecords.length ? (
          <nav className="source-registry-pagination" aria-label="Source registry pages">
            <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Previous</button>
            <span>Page {safePage} of {pageCount}</span>
            <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next →</button>
          </nav>
        ) : null}
      </section>

      <section className="coverage-gate page-shell" aria-labelledby="coverage-gate-title">
        <div>
          <p className="eyebrow">The Phase-I completion gate</p>
          <h2 id="coverage-gate-title">A book graph is complete only when its local proof structure is reviewed.</h2>
          <p>Compression targets are deliberately absent from this gate. A source graph stands on its own before cross-book simplification begins.</p>
        </div>
        <ul>
          <li>The exact edition is identified, stably located, artifact-fingerprinted, and divided into an ordered source-unit manifest.</li>
          <li>Every theorem-like result and proof-relevant definition, axiom, notation, or construction is inventoried; worked examples and routine calculations are not graph nodes.</li>
          <li>Every direct proof dependency points to a local node or an explicitly documented external input.</li>
          <li>Each theorem-like node has a reviewed proof route or a reviewed root attestation when it has no direct prerequisites.</li>
          <li>Resolved proof citations are merged into evidenced edges; excluded or unresolved proof targets remain explicit references and are never silently converted into nodes.</li>
          <li>Extraction evidence and graph evidence receive independent review, with stale fingerprints rejected.</li>
          <li>Corpus Phase I completes only when all {componentCount.toLocaleString()} component files reach reviewed-complete graph status.</li>
        </ul>
      </section>
    </div>
  );
}
