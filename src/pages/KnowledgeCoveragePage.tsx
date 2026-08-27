import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  bookGraphManifestSchema,
  type BookGraphManifest,
} from "../data/book-graph-schema";
import { sourceRegistrySchema, type SourceRegistry } from "../data/source-coverage-schema";

type CoverageData = {
  registry: SourceRegistry;
  manifest: BookGraphManifest;
};

type ManifestEntry = BookGraphManifest["entries"][number];

const pageSize = 30;

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

function aggregateStatus(entries: readonly ManifestEntry[]) {
  const statusCounts = new Map<string, number>();
  for (const entry of entries) {
    statusCounts.set(entry.graphStatus, (statusCounts.get(entry.graphStatus) ?? 0) + 1);
  }
  return [...statusCounts.entries()]
    .map(([status, count]) => entries.length === 1 ? humanize(status) : `${count} ${humanize(status)}`)
    .join(" · ");
}

export function KnowledgeCoveragePage() {
  const [parameters] = useSearchParams();
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState("");
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

  useEffect(() => {
    if (!data || !selectedRecord) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById("selected-source-title");
      target?.scrollIntoView?.({ block: "start" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, selectedEntry, selectedRecord]);

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
          <p className="eyebrow">Phase I · data-first source graph status</p>
          <h1>Build the dependency graph before compressing the library.</h1>
          <p>
            Each approved source is tracked in a durable raw graph. The first job is to identify the
            exact edition, inventory every theorem-like and supporting node, and record its direct
            proof dependencies. Raw graph artifacts stay in the data pipeline rather than becoming
            browser payloads; compression and simplification remain a later phase.
          </p>
          <div className="coverage-hero-actions">
            <a href="#source-registry">Inspect the source registry</a>
            <Link to="/knowledge">Return to Knowledge</Link>
          </div>
        </div>
        <aside aria-label="Phase-I scope">
          <span>Approved corpus</span>
          <strong>{data?.registry.records.length ?? __SOURCE_RECORD_COUNT__} records · {componentCount} required components</strong>
          <p>Every required volume or part is tracked separately in the Phase-I manifest.</p>
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
              <div><dt>Indexed source components</dt><dd>{ratio(data.manifest.entries.length, componentCount)}</dd></div>
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
          This page loads only the small source registry and aggregate manifest. Raw node, edge, route,
          and reference records remain internal data artifacts. The 126-chapter Knowledge roadmap is
          not used as a corpus-coverage count.
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
            <p className="eyebrow">Approved intake · {componentCount} separately tracked components</p>
            <h2 id="source-registry-title">The source registry</h2>
            <p>Select a record, then choose a required component to inspect its manifest status.</p>
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
              <div><dt>Exact edition</dt><dd>{selectedEntry.exactEditionResolved ? "identified" : "awaiting identification"}</dd></div>
              <div><dt>Repository data path</dt><dd>{selectedEntry.path}</dd></div>
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
              <dl className="book-graph-overview" aria-label="Selected component manifest counts">
                <div><dt>Theorem-like nodes</dt><dd>{selectedEntry.theoremNodeCount.toLocaleString()}</dd></div>
                <div><dt>Theorems without a route</dt><dd>{selectedEntry.unroutedTheoremCount.toLocaleString()}</dd></div>
                <div><dt>Support nodes</dt><dd>{selectedEntry.supportNodeCount.toLocaleString()}</dd></div>
                <div><dt>Inventoried source units</dt><dd>{selectedEntry.inventoriedSourceUnitCount.toLocaleString()} / {selectedEntry.sourceUnitCount.toLocaleString()}</dd></div>
                <div><dt>Reviewed source units</dt><dd>{selectedEntry.reviewedSourceUnitCount.toLocaleString()}</dd></div>
                <div><dt>Direct dependencies</dt><dd>{selectedEntry.dependencyCount.toLocaleString()}</dd></div>
                <div><dt>Reviewed dependencies</dt><dd>{selectedEntry.reviewedDependencyCount.toLocaleString()}</dd></div>
                <div><dt>Unresolved references</dt><dd>{selectedEntry.unresolvedReferenceCount.toLocaleString()}</dd></div>
              </dl>
              <p className="selected-source-empty">
                Raw node, edge, route, and reference artifacts are validated in the data pipeline and are not published to the browser.
              </p>
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
              <thead><tr><th>Record</th><th>Source</th><th>Intake branch</th><th>Components</th><th>Graph state</th></tr></thead>
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
                      <td>{entries.length} component{entries.length === 1 ? "" : "s"} · {exactEditionCount} exact edition{exactEditionCount === 1 ? "" : "s"}</td>
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
          <li>Corpus Phase I completes only when all {componentCount.toLocaleString()} component graphs reach reviewed-complete status.</li>
        </ul>
      </section>
    </div>
  );
}
