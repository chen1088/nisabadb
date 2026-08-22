import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  compressionBandByClusterId,
  compressionBands,
  compressionClusterById,
  compressionClusters,
  compressionProgram,
  compressionResiduals,
  compressionSourceFamilies,
  compressionSourceFamilyById,
} from "../data/compression";

const statusLabels = {
  reviewed: "Reviewed",
  rewriting: "Rewrite in progress",
  mapped: "Mapped for extraction",
  unresolved: "Unresolved",
} as const;

const frontierLabels = {
  written: "Learner nodes written",
  outlined: "Learner nodes outlined",
  unmapped: "Learner nodes not written",
} as const;

const dispositionLabels = {
  "merge-into-core": "Merge into core",
  bridge: "Keep as bridge",
  "alternate-route": "Keep as alternate route",
  "specialist-extension": "Keep as specialist extension",
  "historical-context": "Keep as history or example",
  "open-editorial-question": "Open editorial question",
} as const;

const dependencyLabels = {
  minimized: "Minimized dependency route",
  original: "Candidate source-route pattern",
  reinterpretation: "Reinterpretation",
} as const;

function clusterHref(clusterId: string) {
  return `/knowledge/compression?cluster=${encodeURIComponent(clusterId)}`;
}

export function KnowledgeCompressionPage() {
  const [parameters] = useSearchParams();
  const [query, setQuery] = useState("");
  const requestedCluster = parameters.get("cluster") ?? undefined;
  const selected = compressionClusterById.get(requestedCluster ?? "") ?? compressionClusters[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const visibleClusterIds = useMemo(() => new Set(
    compressionClusters
      .filter((cluster) => !normalizedQuery || [
        cluster.title,
        cluster.canonicalIdea,
        cluster.rewriteDecision,
        ...cluster.unlocks,
      ].join(" ").toLocaleLowerCase().includes(normalizedQuery))
      .map((cluster) => cluster.id),
  ), [normalizedQuery]);

  useEffect(() => {
    if (!requestedCluster || !selected) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById("selected-cluster-title");
      target?.scrollIntoView?.({ block: "start" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedCluster, selected]);

  if (!selected) return null;
  const selectedBand = compressionBandByClusterId.get(selected.id);
  const selectedFamilies = selected.sourceFamilyIds
    .map((familyId) => compressionSourceFamilyById.get(familyId))
    .filter((family) => Boolean(family));
  const canonicalRoute = selected.routes.find((route) => route.kind === "canonical");
  const otherRoutes = selected.routes.filter((route) => route.kind !== "canonical");

  return (
    <div className="compression-atlas-page">
      <header className="compression-atlas-hero page-shell">
        <div>
          <p className="audit-breadcrumb"><Link to="/knowledge">Knowledge</Link><span>/</span> Compression atlas</p>
          <p className="eyebrow">The rewrite plan for all mathematics</p>
          <h1>Compress repeated exposition. Keep every mathematical distinction.</h1>
          <p>{compressionProgram.thesis}</p>
          <div className="compression-atlas-actions">
            <a href="#atlas">Explore the common core</a>
            <Link to="/knowledge/coverage">Audit every source theorem</Link>
          </div>
        </div>
        <dl aria-label="Compression atlas status">
          <div><dt>Source records preserved</dt><dd>{__SOURCE_RECORD_COUNT__}</dd></div>
          <div><dt>Whole-field clusters</dt><dd>{compressionClusters.length}</dd></div>
          <div><dt>Explicit residual decisions</dt><dd>{compressionResiduals.length}</dd></div>
          <div><dt>Administrator-reviewed cluster rewrites</dt><dd>{compressionClusters.filter((cluster) => cluster.status === "reviewed").length}</dd></div>
        </dl>
      </header>

      <section className="coverage-boundary page-shell" aria-labelledby="coverage-boundary-title">
        <span aria-hidden="true">!</span>
        <div>
          <h2 id="coverage-boundary-title">A compression design is not a completed extraction.</h2>
          <p>{compressionProgram.coverageNote}</p>
        </div>
        <Link to="/knowledge/coverage">See the exact coverage ledger →</Link>
      </section>

      <section className="compression-method page-shell" aria-labelledby="compression-method-title">
        <div>
          <p className="eyebrow">One accountable pipeline</p>
          <h2 id="compression-method-title">Rewrite the mathematics; retain the evidence.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Inventory</strong><p>Locate every result in an exact edition, including results hidden in exercises.</p></li>
          <li><span>02</span><strong>Compare</strong><p>Normalize hypotheses and conclusions before calling two statements equivalent.</p></li>
          <li><span>03</span><strong>Rewrite</strong><p>Publish one short canonical explanation and the best known dependency route.</p></li>
          <li><span>04</span><strong>Retain</strong><p>Keep stronger, weaker, alternate, historical, and unresolved material visibly classified.</p></li>
        </ol>
      </section>

      <section className="compression-atlas page-shell" id="atlas" aria-labelledby="atlas-title">
        <header>
          <p className="eyebrow">Six bands · not a linear syllabus</p>
          <h2 id="atlas-title">The common-core atlas</h2>
          <p>Select a cluster to inspect its canonical idea, notation decisions, routes, and honest remainders.</p>
        </header>

        <div className="compression-atlas-workspace">
          <article className="compression-cluster-reader" aria-labelledby="selected-cluster-title">
            <header>
              <div className="compression-cluster-meta">
                <span>{selectedBand?.title ?? "Compression cluster"}</span>
                <span data-status={selected.status}>{statusLabels[selected.status]}</span>
                <span>{frontierLabels[selected.frontierState]}</span>
              </div>
              <h3 id="selected-cluster-title" tabIndex={-1}>{selected.title}</h3>
              <p>{selected.canonicalIdea}</p>
            </header>

            <section className="compression-decision">
              <p className="eyebrow">Rewrite decision</p>
              <p>{selected.rewriteDecision}</p>
              <dl>
                <div><dt>Rewrite potential</dt><dd>{selected.rewritePotential}</dd></div>
                <div><dt>Comparison lenses converging</dt><dd>{selectedFamilies.length}</dd></div>
                <div><dt>Written Knowledge nodes</dt><dd>{selected.knowledgeNodeIds.length}</dd></div>
              </dl>
            </section>

            <section className="compression-reader-section" aria-labelledby="cluster-sources-title">
              <h4 id="cluster-sources-title">What converges here</h4>
              <p>These are cross-cutting comparison lenses over the 31 intake branches, not citations proving that extraction is finished.</p>
              <div className="compression-source-details">
                {selectedFamilies.map((family) => family ? (
                  <details key={family.id}>
                    <summary><span>{family.title}</span><small>{family.inventoryState.replaceAll("-", " ")}</small></summary>
                    <p>{family.editorialUse}</p>
                    <strong>Registered comparison anchors</strong>
                    <ul>{family.representativeSources.map((source) => <li key={source.sourceRecordId}><span>{source.sourceRecordId}</span> {source.citation}</li>)}</ul>
                  </details>
                ) : null)}
              </div>
            </section>

            <section className="compression-reader-section" aria-labelledby="notation-decisions-title">
              <h4 id="notation-decisions-title">Notation decisions</h4>
              <div className="compression-notation-table" role="table" aria-label="Compression notation decisions">
                <div className="visually-hidden" role="row">
                  <span role="columnheader">Concept and canonical notation</span>
                  <span role="columnheader">Resolution and source aliases</span>
                </div>
                {selected.notationResolutions.map((resolution) => (
                  <div role="row" key={resolution.concept}>
                    <div role="cell"><span>{resolution.concept}</span><strong>{resolution.canonical}</strong></div>
                    <div role="cell"><p>{resolution.resolution}</p><small>Source aliases: {resolution.aliases.join(" · ")}</small></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="compression-reader-section" aria-labelledby="dependency-routes-title">
              <h4 id="dependency-routes-title">Dependency routes</h4>
              {canonicalRoute ? (
                <article className="canonical-compression-route">
                  <div><span>{dependencyLabels[canonicalRoute.dependencyKind]}</span><small>{canonicalRoute.reviewState} · {canonicalRoute.equivalence.replaceAll("-", " ")}</small></div>
                  <h5>{canonicalRoute.label}</h5>
                  <p>{canonicalRoute.summary}</p>
                  <p><strong>Compared against:</strong> {selected.routes.find((route) => route.id === canonicalRoute.derivedFromRouteId)?.label ?? "Original route not linked"}</p>
                  <p><strong>Needs:</strong> {canonicalRoute.prerequisiteClusterIds.length ? canonicalRoute.prerequisiteClusterIds.map((id) => compressionClusterById.get(id)?.title ?? id).join(" · ") : "No cluster prerequisite"}</p>
                </article>
              ) : null}
              <div className="candidate-compression-routes">
                {otherRoutes.map((route) => (
                  <details key={route.id}>
                    <summary><span>{route.label}</span><small>{dependencyLabels[route.dependencyKind]} · {route.reviewState}</small></summary>
                    <p>{route.summary}</p>
                    <p><strong>Equivalence:</strong> {route.equivalence.replaceAll("-", " ")}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="compression-reader-section" aria-labelledby="cluster-residuals-title">
              <h4 id="cluster-residuals-title">What does not disappear</h4>
              <div className="cluster-residual-list">
                {selected.residuals.map((residual) => (
                  <article key={residual.id}>
                    <span>{dispositionLabels[residual.disposition]}</span>
                    <h5>{residual.title}</h5>
                    <p>{residual.reason}</p>
                    <small>{statusLabels[residual.status]}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="compression-reader-section compression-unlocks" aria-labelledby="cluster-unlocks-title">
              <h4 id="cluster-unlocks-title">This cluster unlocks</h4>
              <ul>{selected.unlocks.map((unlock) => <li key={unlock}>{unlock}</li>)}</ul>
              {selected.knowledgeNodeIds.length ? (
                <div>
                  <strong>Current learner nodes</strong>
                  {selected.knowledgeNodeIds.map((nodeId) => <Link key={nodeId} to={`/knowledge?node=${nodeId}`}>{nodeId}</Link>)}
                </div>
              ) : <p>No learner node is claimed complete for this cluster yet.</p>}
            </section>
          </article>

          <aside className="compression-atlas-index" aria-label="Compression cluster index">
            <label>
              <span>Find a reusable idea</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Linearity, entropy, proof…" />
            </label>
            <nav aria-label="Compression bands">
              {compressionBands.map((band) => {
                const clusters = band.clusterIds
                  .map((clusterId) => compressionClusterById.get(clusterId))
                  .filter((cluster) => cluster && visibleClusterIds.has(cluster.id));
                if (!clusters.length) return null;
                return (
                  <section key={band.id}>
                    <header><span>{String(band.clusterIds[0] ? compressionBands.indexOf(band) + 1 : 0).padStart(2, "0")}</span><strong>{band.title}</strong></header>
                    <p>{band.summary}</p>
                    <ol>
                      {clusters.map((cluster) => cluster ? (
                        <li key={cluster.id}>
                          <Link className={cluster.id === selected.id ? "is-current" : undefined} aria-current={cluster.id === selected.id ? "page" : undefined} to={clusterHref(cluster.id)}>
                            <span>{statusLabels[cluster.status]}</span>{cluster.title}
                          </Link>
                        </li>
                      ) : null)}
                    </ol>
                  </section>
                );
              })}
            </nav>
            {normalizedQuery && visibleClusterIds.size === 0 ? <p className="compression-no-results">No cluster matches “{query}”.</p> : null}
          </aside>
        </div>
      </section>

      <section className="residual-ledger page-shell" aria-labelledby="residual-ledger-title">
        <header>
          <p className="eyebrow">Nothing silently omitted</p>
          <h2 id="residual-ledger-title">Whole-atlas remaining-material ledger</h2>
          <p>Every non-core item must stay visible under one disposition until an administrator approves a different mapping.</p>
        </header>
        <div>
          {Object.entries(dispositionLabels).map(([disposition, label]) => {
            const items = compressionResiduals.filter((residual) => residual.disposition === disposition);
            if (!items.length) return null;
            return (
              <details key={disposition}>
                <summary><span>{label}</span><strong>{items.length}</strong></summary>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}><Link to={clusterHref(item.clusterId)}>{item.title}</Link><span>{compressionClusterById.get(item.clusterId)?.title}</span></li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      <section className="source-family-map page-shell" aria-labelledby="source-family-map-title">
        <header>
          <p className="eyebrow">Comparison structure</p>
          <h2 id="source-family-map-title">{compressionSourceFamilies.length} comparison lenses cover all {__SOURCE_BRANCH_COUNT__} intake branches.</h2>
          <p>The 31 branches preserve the approved list without loss. These 16 overlapping lenses decide which sources should be compared across branch boundaries; they do not remove or repartition any of the exact {__SOURCE_RECORD_COUNT__} rows.</p>
        </header>
        <div>
          {compressionSourceFamilies.map((family) => (
            <details key={family.id}>
              <summary><span>{family.title}</span><small>{family.inventoryState.replaceAll("-", " ")}</small></summary>
              <p>{family.branch}</p>
              <p>{family.editorialUse}</p>
              <p><strong>Intake branches:</strong></p>
              <ul>{family.registryBranches.map((branch) => <li key={branch.id}><Link to={`/knowledge/coverage?family=${branch.id}`}>{branch.id} · {branch.title}</Link></li>)}</ul>
              <ul>{family.representativeSources.map((source) => <li key={source.sourceRecordId}><span>{source.sourceRecordId}</span> {source.citation}</li>)}</ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
