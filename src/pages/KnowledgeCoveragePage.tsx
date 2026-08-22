import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { knowledgeBook, knowledgeNodes } from "../data/knowledge";
import {
  deriveCoverageSummary,
  validateSourceCoverage,
  type SourceCoverageLedger,
  type SourceRegistry,
  type VerificationPolicy,
} from "../data/source-coverage-schema";

type CoverageData = {
  registry: SourceRegistry;
  ledger: SourceCoverageLedger;
  verificationPolicy: VerificationPolicy;
};

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

export function KnowledgeCoveragePage() {
  const [parameters] = useSearchParams();
  const { hash } = useLocation();
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [familyId, setFamilyId] = useState(parameters.get("family") ?? "all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [registryResponse, ledgerResponse, policyResponse] = await Promise.all([
          fetch(coverageDataUrl("source-records.json"), { signal: controller.signal }),
          fetch(coverageDataUrl("coverage-ledger.json"), { signal: controller.signal }),
          fetch(coverageDataUrl("verification-policy.json"), { signal: controller.signal }),
        ]);
        if (!registryResponse.ok || !ledgerResponse.ok || !policyResponse.ok) {
          throw new Error("The coverage data could not be loaded.");
        }
        const validated = validateSourceCoverage(
          await registryResponse.json(),
          await ledgerResponse.json(),
          await policyResponse.json(),
          {
            knowledgeNodes: knowledgeNodes.map((node) => ({
              id: node.id,
              contentSha256: node.contentSha256,
            })),
            knowledgeEdition: knowledgeBook.edition,
          },
        );
        setData(validated);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "The coverage data could not be loaded.");
      }
    };
    void load();
    return () => controller.abort();
  }, []);

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
  const selectedRecord = data?.registry.records.find((record) => record.id === selectedRecordId);
  const familyById = new Map(data?.registry.families.map((family) => [family.id, family]) ?? []);
  const editionById = new Map(data?.ledger.editions.map((edition) => [edition.id, edition]) ?? []);
  const claimById = new Map(data?.ledger.canonicalClaims.map((claim) => [claim.id, claim]) ?? []);
  const residualById = new Map(data?.ledger.residualArtifacts.map((artifact) => [artifact.id, artifact]) ?? []);
  const summary = data ? deriveCoverageSummary(data.registry, data.ledger) : null;
  const selectedEditions = selectedRecord?.editionIds
    .map((editionId) => editionById.get(editionId))
    .filter((edition): edition is SourceCoverageLedger["editions"][number] => Boolean(edition)) ?? [];
  const selectedOccurrences = data?.ledger.theoremOccurrences.filter((occurrence) => (
    selectedRecord?.editionIds.includes(occurrence.editionId)
  )) ?? [];

  useEffect(() => {
    if (!data || !selectedRecord) return;
    const targetId = hash ? decodeURIComponent(hash.slice(1)) : "selected-source-title";
    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView?.({ block: "start" });
      target?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, hash, selectedRecord]);

  const inventoryLabel = (record: SourceRegistry["records"][number]) => {
    if (record.resolutionState === "unresolved") return "Queued";
    if (record.resolutionState === "duplicate-record") return `Duplicate of ${record.duplicateOfRecordId}`;
    const states = record.editionIds.map((editionId) => editionById.get(editionId)?.inventoryState ?? "missing-edition");
    return states.length ? states.map(humanize).join(" · ") : "Missing edition";
  };

  return (
    <div className="coverage-page">
      <header className="coverage-hero page-shell">
        <div>
          <p className="audit-breadcrumb"><Link to="/knowledge">Knowledge</Link><span>/</span> Source coverage</p>
          <p className="eyebrow">The non-omission ledger</p>
          <h1>Every source theorem gets a durable address.</h1>
          <p>
            The learner reads one rewritten textbook. Behind it, every theorem-like result in every
            exact source edition must retain its locator and an explicit mathematical disposition.
          </p>
          <div className="coverage-hero-actions">
            <a href="#source-registry">Inspect the source registry</a>
            <Link to="/knowledge/compression">See how ideas converge</Link>
          </div>
        </div>
        <aside aria-label="Coverage promise">
          <span>Coverage floor</span>
          <strong>Nothing disappears during compression.</strong>
          <p>Theorems, lemmas, propositions, corollaries, named results, and results embedded in exercises are all in scope.</p>
        </aside>
      </header>

      <section className="coverage-progress page-shell" aria-labelledby="coverage-progress-title" aria-live="polite">
        <header>
          <p className="eyebrow">Derived from validated records, never typed by hand</p>
          <h2 id="coverage-progress-title">Coverage is incomplete—and visibly so.</h2>
        </header>
        {error ? <p className="coverage-load-error">{error}</p> : null}
        {!summary && !error ? <p className="coverage-loading">Loading the exact source ledger…</p> : null}
        {summary ? (
          <>
            <dl aria-label="Theorem coverage status">
              <div><dt>Source rows resolved</dt><dd>{ratio(summary.resolvedRecords, summary.sourceRecords)}</dd></div>
              <div><dt>Source rows fully reconciled</dt><dd>{ratio(summary.completeRecords, summary.sourceRecords)}</dd></div>
              <div><dt>Exact editions fully inventoried</dt><dd>{ratio(summary.completeEditions, summary.editions)}</dd></div>
              <div><dt>Administrator-verified terminal dispositions</dt><dd>{ratio(summary.terminalOccurrences, summary.theoremOccurrences)}</dd></div>
            </dl>
            <p className="coverage-terminal-breakdown">
              Verified Knowledge mappings: <strong>{summary.verifiedMappings}</strong>
              <span>·</span>
              Verified retained residuals: <strong>{summary.verifiedResiduals}</strong>
              <span>·</span>
              Whole source universe: <strong>{summary.sourceUniverseComplete ? "complete" : "incomplete"}</strong>
            </p>
          </>
        ) : null}
        <p className="coverage-progress-note">
          The earlier 662-record research pool gained 26 gap-filling entries before approval. The fingerprint-locked target is therefore <strong>{summary?.sourceRecords ?? __SOURCE_RECORD_COUNT__} source records</strong>, not an estimated deduplicated count.
        </p>
      </section>

      <section className="coverage-model page-shell" aria-labelledby="coverage-model-title">
        <div>
          <p className="eyebrow">Three separate identities</p>
          <h2 id="coverage-model-title">Repetition is merged only after the source occurrence survives.</h2>
        </div>
        <ol>
          <li><span>01</span><strong>Source occurrence</strong><p>One exact edition, immutable source unit, label, locator, and independently rewritten claim.</p></li>
          <li><span>02</span><strong>Canonical claim</strong><p>Equivalent hypotheses and conclusions converge; stronger, weaker, and overlapping claims remain related.</p></li>
          <li><span>03</span><strong>Knowledge node or residual</strong><p>The beginner sees the best tutorial route; distinct mathematics remains as a separately reviewed residual artifact.</p></li>
        </ol>
      </section>

      <section className="source-registry page-shell" id="source-registry" aria-labelledby="source-registry-title">
        <header>
          <div>
            <p className="eyebrow">Exact approved intake</p>
            <h2 id="source-registry-title">The source registry</h2>
            <p>This is an accountability index, not a reading list or a Materials shelf.</p>
          </div>
          {data ? <strong>{visibleRecords.length.toLocaleString()} matching records</strong> : null}
        </header>

        {selectedRecord ? (
          <aside className="selected-source-record" aria-labelledby="selected-source-title">
            <div><span>{selectedRecord.id}</span><small>{humanize(selectedRecord.resolutionState)}</small></div>
            <h3 id="selected-source-title" tabIndex={-1}>{selectedRecord.title}</h3>
            <p>{selectedRecord.authorLine}</p>
            <dl>
              <div><dt>Intake branch</dt><dd>{familyById.get(selectedRecord.familyId)?.title}</dd></div>
              <div><dt>Required edition components</dt><dd>{selectedRecord.requiredEditionComponents.map((component) => component.label).join(" · ")}</dd></div>
              <div><dt>Exact editions</dt><dd>{selectedRecord.editionIds.length ? selectedRecord.editionIds.join(" · ") : "Not resolved yet"}</dd></div>
              <div><dt>Theorem occurrences</dt><dd>{selectedOccurrences.length}</dd></div>
              <div><dt>Administrator resolution</dt><dd>{selectedRecord.resolutionReview ? `Reviewed by ${selectedRecord.resolutionReview.actorId}` : "Not reviewed"}</dd></div>
            </dl>

            {selectedRecord.resolutionState === "duplicate-record" ? (
              <p className="selected-source-empty">This row is retained and resolves through {selectedRecord.duplicateOfRecordId}. Its duplicate evidence remains administrator-reviewed.</p>
            ) : null}
            {selectedRecord.resolutionState === "unresolved" ? (
              <p className="selected-source-empty">The theorem inventory cannot begin until all {selectedRecord.requiredEditionComponents.length} required edition component{selectedRecord.requiredEditionComponents.length === 1 ? " is" : "s are"} fixed and fingerprinted.</p>
            ) : null}

            {selectedEditions.map((edition) => {
              const occurrences = selectedOccurrences.filter((occurrence) => occurrence.editionId === edition.id);
              return (
                <section className="source-edition-audit" key={edition.id} aria-labelledby={`${edition.id}-title`}>
                  <header>
                    <div><span>Exact edition</span><strong id={`${edition.id}-title`}>{edition.label}</strong></div>
                    <small>{humanize(edition.inventoryState)}</small>
                  </header>
                  <dl>
                    <div><dt>Stable locator</dt><dd>{edition.stableLocator}</dd></div>
                    <div><dt>Required component</dt><dd>{selectedRecord.requiredEditionComponents.find((component) => component.id === edition.sourceComponentId)?.label ?? edition.sourceComponentId}</dd></div>
                    <div><dt>Immutable source units</dt><dd>{edition.sourceUnits.length}</dd></div>
                    <div><dt>Inventoried theorem occurrences</dt><dd>{occurrences.length}</dd></div>
                  </dl>
                  {occurrences.length ? (
                    <div className="theorem-occurrence-list">
                      {occurrences.map((occurrence) => (
                        <article id={occurrence.id} key={occurrence.id} tabIndex={-1}>
                          <header>
                            <span>{occurrence.id} · {humanize(occurrence.kind)} · {occurrence.sourceLabel} · {occurrence.locator}</span>
                            <small>{humanize(occurrence.decisionStatus)} · {humanize(occurrence.disposition)}</small>
                          </header>
                          <h4>{occurrence.normalizedTitle}</h4>
                          <p>{occurrence.normalizedClaim}</p>
                          <dl>
                            <div><dt>Immutable source unit</dt><dd>{occurrence.sourceUnitId}</dd></div>
                            <div><dt>Mapping relation</dt><dd>{occurrence.relation ? humanize(occurrence.relation) : "No canonical mapping"}</dd></div>
                            <div><dt>Reason</dt><dd>{occurrence.reason}</dd></div>
                            <div><dt>Administrative review</dt><dd>{occurrence.administrativeReview ? `${occurrence.administrativeReview.actorId} · ${occurrence.administrativeReview.reviewedAt}` : "Not reviewed"}</dd></div>
                            <div><dt>Review evidence</dt><dd>{occurrence.administrativeReview?.evidenceSha256 ?? "Not reviewed"}</dd></div>
                          </dl>
                          <div>
                            {occurrence.targetCanonicalClaimIds.map((claimId) => {
                              const claim = claimById.get(claimId);
                              return claim ? (
                                <section key={claimId}>
                                  <strong>{claim.id} · {claim.title}</strong>
                                  <p>{claim.normalizedStatement}</p>
                                  {claim.knowledgeTargets.map((target) => (
                                    <Link key={target.knowledgeNodeId} to={`/knowledge?node=${target.knowledgeNodeId}`}>
                                      {target.knowledgeNodeId} in {target.knowledgeEdition}
                                    </Link>
                                  ))}
                                </section>
                              ) : null;
                            })}
                            {occurrence.targetResidualArtifactIds.map((artifactId) => {
                              const artifact = residualById.get(artifactId);
                              return artifact ? <section key={artifactId}><strong>{artifact.title}</strong><p>{artifact.reason}</p></section> : null;
                            })}
                          </div>
                          <Link className="theorem-occurrence-permalink" to={`/knowledge/coverage?source=${selectedRecord.id}#${occurrence.id}`}>Permanent occurrence address</Link>
                        </article>
                      ))}
                    </div>
                  ) : <p className="selected-source-empty">No theorem occurrence is published for this edition yet.</p>}
                </section>
              );
            })}
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
              <thead><tr><th>Record</th><th>Source</th><th>Intake branch</th><th>Exact edition set</th><th>Inventory</th></tr></thead>
              <tbody>
                {pageRecords.map((record) => (
                  <tr key={record.id}>
                    <td><Link to={`/knowledge/coverage?source=${record.id}`}>{record.id}</Link></td>
                    <td><strong>{record.title}</strong><span>{record.authorLine}</span></td>
                    <td>{familyById.get(record.familyId)?.title}</td>
                    <td>{record.editionIds.length ? record.editionIds.join(" · ") : record.resolutionState === "duplicate-record" ? `See ${record.duplicateOfRecordId}` : "Unresolved"}</td>
                    <td><span data-state={record.resolutionState}>{inventoryLabel(record)}</span></td>
                  </tr>
                ))}
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
          <p className="eyebrow">The word “complete” has a hard gate</p>
          <h2 id="coverage-gate-title">A source row is handled only when every exact edition is reconciled.</h2>
          {data ? <p>Only {data.verificationPolicy.administrators.map((administrator) => administrator.displayName).join(", ")} may approve terminal review records.</p> : null}
        </div>
        <ul>
          <li>Every exact volume or version is identified, artifact-fingerprinted, and expanded into an immutable source-unit manifest.</li>
          <li>Every source unit belongs to exactly one scan segment; no page, section, appendix, or web node may fall outside the manifest.</li>
          <li>Each segment records occurrences found or an explicit theorem-free attestation, source evidence, and a worker audit.</li>
          <li>A different authorized administrator reviews every segment and the completed edition.</li>
          <li>Every occurrence has one locator, independently written claim, visible disposition, reason, and terminal Knowledge or residual target.</li>
          <li>Verified Knowledge targets must exist in the current Knowledge edition; stale or nonexistent targets fail validation.</li>
          <li>The complete-universe flag remains false until all {__SOURCE_RECORD_COUNT__} rows resolve through audited editions.</li>
        </ul>
      </section>
    </div>
  );
}
