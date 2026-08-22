import { createHash } from "node:crypto";

export const STABLE_IDENTIFIER_KEYS = Object.freeze([
  "openAlex",
  "doi",
  "arxiv",
  "semanticScholar",
  "isbn",
  "internal",
]);

const QUEUE_TASKS = Object.freeze([
  "fetch-outgoing",
  "fetch-incoming",
  "deduplicate",
]);
const SOURCE_BIBLIOGRAPHY_PROVIDERS = new Set([
  "author-manuscript",
  "arXiv source bibliography",
]);

function hasSourceBibliographyProvenance(edge) {
  return edge.provenance?.some((entry) =>
    SOURCE_BIBLIOGRAPHY_PROVIDERS.has(entry.provider)
  ) ?? false;
}

function asNonemptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeOpenAlexId(value) {
  const raw = asNonemptyString(value);
  if (!raw) return undefined;
  const tail = raw.replace(/^https?:\/\/(?:api\.)?openalex\.org\/works\//i, "")
    .replace(/^https?:\/\/(?:api\.)?openalex\.org\//i, "")
    .replace(/^openalex:/i, "")
    .split(/[/?#]/, 1)[0];
  return /^w\d+$/i.test(tail) ? tail.toUpperCase() : undefined;
}

export function normalizeStableIdentifier(kind, value) {
  const raw = asNonemptyString(value);
  if (!raw) return undefined;

  switch (kind) {
    case "openAlex":
      return normalizeOpenAlexId(raw);
    case "doi":
      return raw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "")
        .toLowerCase();
    case "arxiv":
      return raw.replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, "")
        .replace(/^arxiv:\s*/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/v\d+$/i, "")
        .toLowerCase();
    case "semanticScholar":
      return raw.replace(/^https?:\/\/www\.semanticscholar\.org\/paper\//i, "")
        .replace(/^corpusid:/i, "corpusid:")
        .toLowerCase();
    case "isbn":
      return raw.replace(/^isbn(?:-1[03])?:?\s*/i, "")
        .replace(/[\s-]/g, "")
        .toUpperCase();
    case "internal":
      return raw.toLowerCase();
    default:
      return undefined;
  }
}

export function exactIdentifierKeys(left, right) {
  const leftIdentifiers = left?.identifiers ?? {};
  const rightIdentifiers = right?.identifiers ?? {};
  return STABLE_IDENTIFIER_KEYS.filter((key) => {
    const leftValue = normalizeStableIdentifier(key, leftIdentifiers[key]);
    const rightValue = normalizeStableIdentifier(key, rightIdentifiers[key]);
    return leftValue !== undefined && leftValue === rightValue;
  });
}

export function findExactPaperMatch(papers, candidate) {
  const matches = papers.filter((paper) => exactIdentifierKeys(paper, candidate).length > 0);
  if (matches.length > 1) {
    throw new Error(
      `Stable identifiers for ${candidate.id ?? "candidate"} match multiple records: ${matches.map((paper) => paper.id).join(", ")}`,
    );
  }
  return matches[0];
}

export function hasSourceAuthoritativeCitationCoverage(paper, citationEdges = []) {
  return Boolean(paper?.id) && citationEdges.some((edge) =>
    edge.citingPaperId === paper.id && hasSourceBibliographyProvenance(edge)
  );
}

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePaperValues(existing, candidate) {
  return {
    ...candidate,
    ...existing,
    identifiers: { ...candidate.identifiers, ...existing.identifiers },
    sourceLinks: uniqueBy(
      [...(existing.sourceLinks ?? []), ...(candidate.sourceLinks ?? [])],
      (link) => `${link.label}\u0000${link.url}`,
    ),
    importProvenance: uniqueBy(
      [...(existing.importProvenance ?? []), ...(candidate.importProvenance ?? [])],
      (entry) => `${entry.provider}\u0000${entry.recordId}\u0000${entry.retrievedAt}`,
    ),
    modificationHistory: uniqueBy(
      [...(existing.modificationHistory ?? []), ...(candidate.modificationHistory ?? [])],
      (entry) => `${entry.version}\u0000${entry.timestamp}\u0000${entry.summary}`,
    ),
  };
}

export function mergePaperRecord(papers, candidate) {
  const exactMatch = findExactPaperMatch(papers, candidate);
  const idMatch = papers.find((paper) => paper.id === candidate.id);
  if (exactMatch && idMatch && exactMatch.id !== idMatch.id) {
    throw new Error(
      `Candidate ID ${candidate.id} collides with ${idMatch.id}, while a stable identifier matches ${exactMatch.id}`,
    );
  }
  const match = exactMatch ?? idMatch;
  if (!match) {
    return { papers: [...papers, candidate], paperId: candidate.id, added: true };
  }
  return {
    papers: papers.map((paper) => paper.id === match.id ? mergePaperValues(paper, candidate) : paper),
    paperId: match.id,
    added: false,
  };
}

function paperIdFromOpenAlex(openAlexId) {
  return `openalex-${openAlexId.toLowerCase()}`;
}

function extractArxivId(work) {
  const candidates = [
    work?.primary_location?.landing_page_url,
    work?.best_oa_location?.landing_page_url,
    ...(work?.locations ?? []).map((location) => location?.landing_page_url),
  ];
  for (const value of candidates) {
    const match = asNonemptyString(value)?.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/i);
    if (match) return match[1];
  }
  return undefined;
}

function formatVenue(work) {
  const source = work?.primary_location?.source?.display_name ??
    work?.locations?.find((location) => location?.source?.display_name)?.source?.display_name;
  const details = [];
  if (work?.biblio?.volume) details.push(`volume ${work.biblio.volume}`);
  if (work?.biblio?.issue) details.push(`issue ${work.biblio.issue}`);
  if (work?.biblio?.first_page) {
    const pageRange = work.biblio.last_page && work.biblio.last_page !== work.biblio.first_page
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : String(work.biblio.first_page);
    details.push(`pages ${pageRange}`);
  }
  const base = asNonemptyString(source) ?? "Venue not supplied by OpenAlex";
  return details.length ? `${base}, ${details.join(", ")}` : base;
}

function openAlexSourceLinks(work, openAlexId, identifiers) {
  const links = [{ label: "OpenAlex", url: `https://openalex.org/${openAlexId}` }];
  if (identifiers.doi) links.push({ label: "DOI", url: `https://doi.org/${identifiers.doi}` });
  if (identifiers.arxiv) links.push({ label: "arXiv", url: `https://arxiv.org/abs/${identifiers.arxiv.replace(/v\d+$/i, "")}` });
  return uniqueBy(links, (link) => link.url);
}

export function openAlexWorkToPaper(work, retrievedAt) {
  const openAlexId = normalizeOpenAlexId(work?.id ?? work?.ids?.openalex);
  if (!openAlexId) throw new Error("OpenAlex work is missing a stable OpenAlex work ID");
  const title = asNonemptyString(work?.display_name ?? work?.title) ?? `Untitled OpenAlex work ${openAlexId}`;
  const authors = (work?.authorships ?? [])
    .map((authorship) => asNonemptyString(authorship?.author?.display_name ?? authorship?.raw_author_name))
    .filter(Boolean);
  const doi = normalizeStableIdentifier("doi", work?.doi ?? work?.ids?.doi);
  const arxiv = extractArxivId(work);
  const identifiers = {
    openAlex: openAlexId,
    ...(doi ? { doi } : {}),
    ...(arxiv ? { arxiv } : {}),
  };
  const oaLicense = asNonemptyString(
    work?.best_oa_location?.license ?? work?.primary_location?.license,
  );

  return {
    id: paperIdFromOpenAlex(openAlexId),
    title,
    authors: authors.length ? authors : ["Unknown author"],
    date: asNonemptyString(work?.publication_date) ??
      (Number.isInteger(work?.publication_year) ? String(work.publication_year) : "Undated"),
    venue: formatVenue(work),
    status: "provisional",
    identifiers,
    sourceLinks: openAlexSourceLinks(work, openAlexId, identifiers),
    contributionSummary: `OpenAlex provisional metadata record for a recursively discovered ${work?.type ?? "work"}; theorem-level mathematical distillation has not started.`,
    importProvenance: [{ provider: "OpenAlex", retrievedAt, recordId: openAlexId }],
    license: {
      metadata: "Cached OpenAlex bibliographic metadata with retrieval provenance; OpenAlex terms apply.",
      fullText: oaLicense
        ? `OpenAlex reports license ${oaLicense}; full-text reuse has not been independently verified.`
        : "No normalized reusable full-text license confirmed.",
    },
    rewriteStatus: "metadata-only",
    theoremExtractionStatus: "not-started",
    formalizationStatus: "statement-only",
    citationCoverage: {
      outgoingFound: 0,
      outgoingResolved: 0,
      incomingFound: 0,
      incomingResolved: 0,
      incomingStatus: "queued",
      providerSearchesAttempted: 0,
      recursiveClosureComplete: false,
      note: "Discovered through an OpenAlex citation edge; direct incoming and outgoing neighborhoods remain queued.",
    },
    version: `openalex:${retrievedAt}`,
    modificationHistory: [{
      version: `openalex:${retrievedAt}`,
      timestamp: retrievedAt,
      contributors: ["NisabaDB citation ingestor"],
      summary: "Created a provisional record from an exact OpenAlex work identity.",
    }],
    featured: false,
    graph: { paperRoots: [], views: [] },
  };
}

export function createCacheEnvelope(url, retrievedAt, body) {
  return { url, retrievedAt, body };
}

export function cacheFileNameForUrl(url) {
  return `${createHash("sha256").update(url).digest("hex")}.json.gz`;
}

function provenanceKey(entry) {
  return [
    entry.provider,
    entry.providerRecordId,
    entry.retrievedAt,
    entry.evidenceUrl ?? "",
  ].join("\u0000");
}

const CONFIDENCE_RANK = Object.freeze({
  uncertain: 0,
  "provider-linked": 1,
  "exact-id": 2,
  "manual-reviewed": 3,
});

export function mergeCitationEdge(edges, candidate) {
  const match = edges.find((edge) =>
    edge.citingPaperId === candidate.citingPaperId && edge.citedPaperId === candidate.citedPaperId);
  if (!match) return { edges: [...edges, candidate], added: true, edgeId: candidate.id };

  const confidence = CONFIDENCE_RANK[candidate.confidence] > CONFIDENCE_RANK[match.confidence]
    ? candidate.confidence
    : match.confidence;
  const merged = {
    ...match,
    confidence,
    provenance: uniqueBy([...match.provenance, ...candidate.provenance], provenanceKey),
  };
  return {
    edges: edges.map((edge) => edge.id === match.id ? merged : edge),
    added: false,
    edgeId: match.id,
  };
}

export function mergeQueueItem(queue, candidate) {
  const existing = queue.find((item) => item.paperId === candidate.paperId);
  if (!existing) return { queue: [...queue, candidate], added: true };
  if (["blocked", "complete-direct-neighborhood"].includes(existing.state)) {
    return { queue, added: false };
  }
  const merged = {
    ...existing,
    nextTasks: uniqueBy([...existing.nextTasks, ...candidate.nextTasks], (task) => task),
  };
  return {
    queue: queue.map((item) => item.paperId === existing.paperId ? merged : item),
    added: false,
  };
}

function discoveredQueueItem(paperId, updatedAt) {
  return {
    paperId,
    state: "metadata-fetched",
    nextTasks: [...QUEUE_TASKS],
    attempts: 0,
    updatedAt,
  };
}

function activateResolvedIdentifierQueueItem(queue, paperId, updatedAt) {
  return queue.map((item) =>
    item.paperId === paperId && item.state === "blocked" &&
      item.nextTasks.includes("resolve-identifiers")
      ? {
          paperId,
          state: "metadata-fetched",
          nextTasks: [...QUEUE_TASKS],
          attempts: item.attempts,
          updatedAt,
        }
      : item
  );
}

function activateResolvedIdentifierPaper(papers, paperId) {
  return papers.map((paper) => {
    if (paper.id !== paperId || paper.citationCoverage?.incomingStatus !== "identifier-unresolved") {
      return paper;
    }
    return {
      ...paper,
      citationCoverage: {
        ...paper.citationCoverage,
        incomingStatus: "queued",
        note: "An exact OpenAlex identity was resolved from citation-neighborhood evidence; direct incoming and outgoing neighborhoods are queued.",
      },
    };
  });
}

export function reconcileResolvedIdentifierQueueItems(snapshot) {
  const paperById = new Map(snapshot.papers.map((paper) => [paper.id, paper]));
  const reactivatedPaperIds = snapshot.ingestionQueue
    .filter((item) => item.state === "blocked" && item.nextTasks.includes("resolve-identifiers"))
    .filter((item) => normalizeOpenAlexId(paperById.get(item.paperId)?.identifiers?.openAlex))
    .map((item) => item.paperId);

  let papers = snapshot.papers;
  let ingestionQueue = snapshot.ingestionQueue;
  for (const paperId of reactivatedPaperIds) {
    const paper = paperById.get(paperId);
    const updatedAt = (paper?.importProvenance ?? [])
      .filter((entry) => entry.provider === "OpenAlex")
      .map((entry) => entry.retrievedAt)
      .sort()
      .at(-1) ?? ingestionQueue.find((item) => item.paperId === paperId)?.updatedAt;
    papers = activateResolvedIdentifierPaper(papers, paperId);
    ingestionQueue = activateResolvedIdentifierQueueItem(ingestionQueue, paperId, updatedAt);
  }

  return {
    snapshot: { ...snapshot, papers, ingestionQueue },
    reactivatedPaperIds,
  };
}

function citationEdge(citingPaperId, citedPaperId, discoveredFromPaperId, direction, record) {
  const providerRecordId = normalizeOpenAlexId(record.work?.id ?? record.work?.ids?.openalex);
  return {
    id: `citation-${citingPaperId}-${citedPaperId}`,
    citingPaperId,
    citedPaperId,
    discoveredFromPaperId,
    discoveryDirection: direction,
    provenance: [{
      provider: "OpenAlex",
      providerRecordId: providerRecordId ?? "unresolved-work-id",
      retrievedAt: record.retrievedAt,
      evidenceUrl: record.url,
    }],
    confidence: "provider-linked",
  };
}

function mergeKnownPaper(papers, paperId, candidate) {
  const existing = papers.find((paper) => paper.id === paperId);
  if (!existing) throw new Error(`Queue paper ${paperId} is absent from the citation snapshot`);
  const exactMatch = findExactPaperMatch(papers, candidate);
  if (exactMatch && exactMatch.id !== paperId) {
    throw new Error(`OpenAlex metadata for ${paperId} exactly matches different paper ${exactMatch.id}`);
  }
  return papers.map((paper) => paper.id === paperId ? mergePaperValues(paper, candidate) : paper);
}

function completeQueueItem(queue, paperId, completedAt) {
  return queue.map((item) => item.paperId === paperId ? {
    paperId,
    state: "complete-direct-neighborhood",
    nextTasks: [],
    attempts: item.attempts + 1,
    updatedAt: completedAt,
  } : item);
}

function retainIncompleteQueueItem(queue, paperId, completedAt, unresolvedProviderIds) {
  return queue.map((item) => item.paperId === paperId ? {
    paperId,
    state: "metadata-fetched",
    nextTasks: ["fetch-outgoing"],
    attempts: item.attempts + 1,
    updatedAt: completedAt,
    lastError: `OpenAlex returned no work record for ${unresolvedProviderIds.length} referenced identifier(s): ${unresolvedProviderIds.join(", ")}`,
    unresolvedProviderIds,
  } : item);
}

function retainSourceAuditedQueueItem(queue, paperId, completedAt, unresolvedProviderIds) {
  return queue.map((item) => item.paperId === paperId ? {
    paperId,
    state: "neighbors-fetched",
    nextTasks: uniqueBy(
      [...item.nextTasks.filter((task) => ["deduplicate", "review-match"].includes(task)), "deduplicate", "review-match"],
      (task) => task,
    ),
    attempts: item.attempts + 1,
    updatedAt: completedAt,
    lastError: unresolvedProviderIds.length
      ? `Source-authoritative direct endpoints remain persisted; OpenAlex still did not return ${unresolvedProviderIds.length} referenced identifier(s), so provider identity reconciliation remains under review.`
      : "Source-authoritative direct endpoints remain persisted; provider identity reconciliation and recursive endpoint crawling remain under review.",
  } : item);
}

function updatePaperCoverage(papers, paperId, coverage, citationEdges) {
  const completeForProvider = coverage.unresolvedOutgoingIds.length === 0;
  return papers.map((paper) => {
    if (paper.id !== paperId) return paper;
    const prior = paper.citationCoverage;
    if (hasSourceAuthoritativeCitationCoverage(paper, citationEdges)) {
      return {
        ...paper,
        citationCoverage: {
          outgoingFound: Math.max(prior.outgoingFound, coverage.outgoingFound),
          outgoingResolved: Math.max(prior.outgoingResolved, coverage.outgoingResolved),
          incomingFound: Math.max(prior.incomingFound, coverage.incomingFound),
          incomingResolved: Math.max(prior.incomingResolved, coverage.incomingResolved),
          incomingStatus: "provider-visible-only",
          providerSearchesAttempted: (prior.providerSearchesAttempted ?? 0) + 2,
          recursiveClosureComplete: false,
          note: prior.note,
        },
      };
    }
    return {
      ...paper,
      citationCoverage: {
        outgoingFound: coverage.outgoingFound,
        outgoingResolved: coverage.outgoingResolved,
        incomingFound: coverage.incomingFound,
        incomingResolved: coverage.incomingResolved,
        incomingStatus: "provider-visible-only",
        providerSearchesAttempted: (prior?.providerSearchesAttempted ?? 0) + 2,
        recursiveClosureComplete: false,
        note: completeForProvider
          ? "OpenAlex direct incoming and outgoing neighborhoods were fetched completely for this provider. Newly discovered papers remain in the persistent recursive queue."
          : `OpenAlex returned no work record for ${coverage.unresolvedOutgoingIds.length} referenced identifier(s). Those exact IDs remain on this paper's queue item for retry; the direct neighborhood is not marked complete.`,
      },
    };
  });
}

function upsertDiscoveredRecord(state, record) {
  const candidate = openAlexWorkToPaper(record.work, record.retrievedAt);
  const paperMerge = mergePaperRecord(state.papers, candidate);
  const queueMerge = mergeQueueItem(
    state.queue,
    discoveredQueueItem(paperMerge.paperId, record.retrievedAt),
  );
  const resolvedBlockedIdentity = state.queue.some((item) =>
    item.paperId === paperMerge.paperId && item.state === "blocked" &&
    item.nextTasks.includes("resolve-identifiers")
  );
  return {
    papers: resolvedBlockedIdentity
      ? activateResolvedIdentifierPaper(paperMerge.papers, paperMerge.paperId)
      : paperMerge.papers,
    queue: resolvedBlockedIdentity
      ? activateResolvedIdentifierQueueItem(queueMerge.queue, paperMerge.paperId, record.retrievedAt)
      : queueMerge.queue,
    paperId: paperMerge.paperId,
    paperAdded: paperMerge.added,
    queueAdded: queueMerge.added,
  };
}

export function integrateOpenAlexNeighborhood(snapshot, input) {
  const seedCandidate = openAlexWorkToPaper(input.seed.work, input.seed.retrievedAt);
  const sourceAuthoritativeSeed = hasSourceAuthoritativeCitationCoverage(
    snapshot.papers.find((paper) => paper.id === input.paperId),
    snapshot.citationEdges,
  );
  let papers = mergeKnownPaper([...snapshot.papers], input.paperId, seedCandidate);
  let edges = [...snapshot.citationEdges];
  let queue = [...snapshot.ingestionQueue];
  let papersAdded = 0;
  let edgesAdded = 0;
  let queueItemsAdded = 0;
  let providerOutgoingRecordsSkipped = 0;
  const outgoingResolved = new Set();
  const incomingResolved = new Set();
  const sourceAuditedOutgoingPaperIds = new Set(
    edges
      .filter((edge) => edge.citingPaperId === input.paperId &&
        hasSourceBibliographyProvenance(edge))
      .map((edge) => edge.citedPaperId),
  );

  for (const record of input.outgoing) {
    if (sourceAuthoritativeSeed) {
      const candidate = openAlexWorkToPaper(record.work, record.retrievedAt);
      const exactMatch = findExactPaperMatch(papers, candidate);
      if (!exactMatch || !sourceAuditedOutgoingPaperIds.has(exactMatch.id)) {
        providerOutgoingRecordsSkipped += 1;
        continue;
      }
    }
    const merged = upsertDiscoveredRecord({ papers, queue }, record);
    papers = merged.papers;
    queue = merged.queue;
    if (sourceAuthoritativeSeed) {
      queue = activateResolvedIdentifierQueueItem(queue, merged.paperId, record.retrievedAt);
    }
    if (merged.paperAdded) papersAdded += 1;
    if (merged.queueAdded) queueItemsAdded += 1;
    if (merged.paperId === input.paperId) continue;
    outgoingResolved.add(merged.paperId);
    const edgeMerge = mergeCitationEdge(
      edges,
      citationEdge(input.paperId, merged.paperId, input.paperId, "outgoing", record),
    );
    edges = edgeMerge.edges;
    if (edgeMerge.added) edgesAdded += 1;
  }

  for (const record of input.incoming) {
    const merged = upsertDiscoveredRecord({ papers, queue }, record);
    papers = merged.papers;
    queue = merged.queue;
    if (merged.paperAdded) papersAdded += 1;
    if (merged.queueAdded) queueItemsAdded += 1;
    if (merged.paperId === input.paperId) continue;
    incomingResolved.add(merged.paperId);
    const edgeMerge = mergeCitationEdge(
      edges,
      citationEdge(merged.paperId, input.paperId, input.paperId, "incoming", record),
    );
    edges = edgeMerge.edges;
    if (edgeMerge.added) edgesAdded += 1;
  }

  const expectedOutgoingIds = new Set(
    (input.seed.work?.referenced_works ?? []).map(normalizeOpenAlexId).filter(Boolean),
  );
  const fetchedOutgoingIds = new Set(
    input.outgoing.map((record) =>
      normalizeOpenAlexId(record.work?.id ?? record.work?.ids?.openalex)).filter(Boolean),
  );
  const papersById = new Map(papers.map((paper) => [paper.id, paper]));
  const persistedOutgoingIds = new Set(
    edges
      .filter((edge) => edge.citingPaperId === input.paperId)
      .map((edge) => normalizeOpenAlexId(
        papersById.get(edge.citedPaperId)?.identifiers?.openAlex,
      ))
      .filter(Boolean),
  );
  const resolvedOutgoingIds = new Set(
    [...expectedOutgoingIds].filter((identifier) =>
      fetchedOutgoingIds.has(identifier) || persistedOutgoingIds.has(identifier)),
  );
  const unresolvedOutgoingIds = [...expectedOutgoingIds]
    .filter((identifier) => !resolvedOutgoingIds.has(identifier))
    .sort();
  const incomingProviderIds = new Set(
    input.incoming.map((record) =>
      normalizeOpenAlexId(record.work?.id ?? record.work?.ids?.openalex)).filter(Boolean),
  );

  papers = updatePaperCoverage(papers, input.paperId, {
    outgoingFound: expectedOutgoingIds.size,
    outgoingResolved: resolvedOutgoingIds.size,
    incomingFound: incomingProviderIds.size,
    incomingResolved: incomingProviderIds.size,
    unresolvedOutgoingIds,
  }, edges);
  queue = sourceAuthoritativeSeed
    ? retainSourceAuditedQueueItem(queue, input.paperId, input.completedAt, unresolvedOutgoingIds)
    : unresolvedOutgoingIds.length === 0
      ? completeQueueItem(queue, input.paperId, input.completedAt)
      : retainIncompleteQueueItem(queue, input.paperId, input.completedAt, unresolvedOutgoingIds);

  return {
    snapshot: { ...snapshot, papers, citationEdges: edges, ingestionQueue: queue },
    stats: {
      papersAdded,
      edgesAdded,
      queueItemsAdded,
      unresolvedOutgoingIds,
      canonicalOutgoingPapers: outgoingResolved.size,
      canonicalIncomingPapers: incomingResolved.size,
      providerOutgoingRecordsSkipped,
    },
  };
}

export function recordQueueFailure(snapshot, paperId, updatedAt, error) {
  return {
    ...snapshot,
    ingestionQueue: snapshot.ingestionQueue.map((item) => item.paperId === paperId ? {
      ...item,
      attempts: item.attempts + 1,
      updatedAt,
      lastError: error instanceof Error ? error.message : String(error),
    } : item),
  };
}

export function outgoingFetchOptions(queueItem) {
  return {
    refresh: (queueItem?.unresolvedProviderIds?.length ?? 0) > 0,
  };
}

export function assertCitationSnapshotIntegrity(snapshot) {
  if (!Array.isArray(snapshot?.papers) || !Array.isArray(snapshot?.citationEdges) ||
      !Array.isArray(snapshot?.ingestionQueue)) {
    throw new Error("Citation snapshot must contain papers, citationEdges, and ingestionQueue arrays");
  }
  const paperIds = new Set();
  for (const paper of snapshot.papers) {
    if (!paper?.id || paperIds.has(paper.id)) {
      throw new Error(`Citation snapshot has a missing or duplicate paper ID: ${paper?.id ?? "missing"}`);
    }
    paperIds.add(paper.id);
  }
  const queuePaperIds = new Set();
  for (const item of snapshot.ingestionQueue) {
    if (!paperIds.has(item.paperId)) {
      throw new Error(`Citation queue references missing paper ${item.paperId}`);
    }
    if (queuePaperIds.has(item.paperId)) {
      throw new Error(`Citation snapshot has duplicate queue item ${item.paperId}`);
    }
    queuePaperIds.add(item.paperId);
  }
  for (const edge of snapshot.citationEdges) {
    for (const endpoint of [edge.citingPaperId, edge.citedPaperId, edge.discoveredFromPaperId]) {
      if (!paperIds.has(endpoint)) {
        throw new Error(`Citation edge ${edge.id} references missing paper ${endpoint}`);
      }
    }
  }
  return snapshot;
}

export function eligibleQueueItems(snapshot) {
  const papersById = new Map(snapshot.papers.map((paper) => [paper.id, paper]));
  return snapshot.ingestionQueue.filter((item) => {
    if (["blocked", "complete-direct-neighborhood"].includes(item.state)) return false;
    if (!item.nextTasks.some((task) => ["fetch-outgoing", "fetch-incoming"].includes(task))) return false;
    const paper = papersById.get(item.paperId);
    return Boolean(normalizeOpenAlexId(paper?.identifiers?.openAlex));
  });
}
