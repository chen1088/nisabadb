import {
  exactIdentifierKeys,
  findExactPaperMatch,
  mergeCitationEdge,
  mergePaperRecord,
  mergeQueueItem,
  normalizeStableIdentifier,
} from "./citation-lib.mjs";

export const MULTISLICE_PAPER_ID =
  "braverman-khot-lifshitz-minzer-2025-invariance-principle-multislice";
export const SOURCE_AUDIT_VERSION_PREFIX = "citation-source-audit:";
const EXPECTED_REUSED_PAPER_IDS = Object.freeze([
  "ellis-friedgut-pilpel-2011-intersecting-families-permutations",
  "odonnell-2014-analysis-boolean-functions",
]);

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAuditGeneratedPaper(paper, auditId) {
  const version = `${SOURCE_AUDIT_VERSION_PREFIX}${auditId}`;
  return paper?.modificationHistory?.some((entry) => entry.version === version) ?? false;
}

function assertDistinct(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Multislice audit has duplicate ${label}`);
  }
}

export function validateMultisliceCitationAudit(audit) {
  if (audit?.schemaVersion !== "1.0.0" || !audit.auditId || !audit.auditAsOf) {
    throw new Error("Multislice citation audit is missing its versioned audit identity");
  }
  if (audit.seedPaperId !== MULTISLICE_PAPER_ID) {
    throw new Error(`Multislice citation audit targets unexpected paper ${audit.seedPaperId}`);
  }
  if (!Array.isArray(audit.outgoing) || audit.outgoing.length !== 48) {
    throw new Error(`Multislice citation audit must contain exactly 48 outgoing records; found ${audit.outgoing?.length ?? 0}`);
  }
  if (audit.sourceAudit?.uniqueInTextCitationCount !== 48 ||
      audit.sourceAudit?.bibliographyEntryCount !== 48 ||
      audit.sourceAudit?.citationKeySetMatchesBibliography !== true ||
      audit.sourceAudit?.crossrefReferenceCount !== 48 ||
      audit.sourceAudit?.crossrefExactDoiReferenceCount !== 20) {
    throw new Error("Multislice audit must preserve 48 source/bibliography/Crossref references and 20 exact Crossref-linked DOIs");
  }
  if (!Array.isArray(audit.incoming) || audit.incoming.length !== 28 ||
      audit.versionFamily?.conference?.incomingProviderVisibleNonXpacCount !== 28 ||
      audit.versionFamily?.conference?.incomingProviderVisibleInclusiveCount !== 29) {
    throw new Error("Multislice incoming audit must contain 28 non-XPAC records and record the 29-record inclusive count");
  }
  if (audit.versionFamily?.conference?.openAlex !== "W3207594656" ||
      audit.versionFamily?.journal?.openAlex !== "W4413142925") {
    throw new Error("Multislice citation audit lost the explicit journal/conference OpenAlex identity split");
  }
  if (audit.providerGaps?.journalOpenAlexReferencedWorkCount !== 45 ||
      audit.providerGaps?.journalOpenAlexResolvedAtAudit !== 22 ||
      audit.providerGaps?.unresolvedReferencedWorkIds?.length !== 23) {
    throw new Error("Multislice OpenAlex gap audit must preserve 45 expected, 22 returned, and 23 unresolved provider IDs");
  }

  assertDistinct(audit.outgoing.map((record) => record.bibKey), "outgoing bibliography keys");
  assertDistinct(audit.outgoing.map((record) => record.id), "outgoing endpoint IDs");
  assertDistinct(audit.incoming.map((record) => record.openAlex), "incoming OpenAlex IDs");
  assertDistinct(audit.providerGaps.unresolvedReferencedWorkIds, "unresolved OpenAlex IDs");

  for (const record of audit.outgoing) {
    if (!record.id || !record.bibKey || !record.title || !record.authors?.length ||
        !record.date || !record.venue || !record.citationLines?.length ||
        !record.identifiers?.internal) {
      throw new Error(`Outgoing multislice audit record ${record.bibKey ?? "unknown"} is incomplete`);
    }
  }
  const crossrefDoiRecords = audit.outgoing.filter((record) =>
    record.identifiers.doi && record.doiEvidence !== "reviewed-existing-record");
  if (crossrefDoiRecords.length !== audit.sourceAudit.crossrefExactDoiReferenceCount) {
    throw new Error(`Multislice audit expected 20 Crossref-linked outgoing DOIs; found ${crossrefDoiRecords.length}`);
  }
  for (const record of audit.incoming) {
    if (!/^W\d+$/.test(record.openAlex) || !record.title || !record.authors?.length ||
        !record.date || !record.type || !record.venue) {
      throw new Error(`Incoming multislice audit record ${record.openAlex ?? "unknown"} is incomplete`);
    }
  }

  const reuseIds = audit.outgoing.filter((record) => record.reusePaperId)
    .map((record) => record.reusePaperId).sort();
  if (JSON.stringify(reuseIds) !== JSON.stringify([...EXPECTED_REUSED_PAPER_IDS].sort())) {
    throw new Error(`Multislice audit may reuse only the two reviewed exact records: ${EXPECTED_REUSED_PAPER_IDS.join(", ")}`);
  }
  return audit;
}

function identifierLinks(identifiers, sourceArchiveUrl, bibKey) {
  const links = [{
    label: `arXiv v2 bibliography (${bibKey})`,
    url: sourceArchiveUrl,
  }];
  if (identifiers.doi) {
    links.push({ label: "DOI", url: `https://doi.org/${identifiers.doi}` });
  }
  if (identifiers.arxiv) {
    links.push({
      label: "arXiv",
      url: `https://arxiv.org/abs/${identifiers.arxiv.replace(/v\d+$/i, "")}`,
    });
  }
  if (identifiers.openAlex) {
    links.push({ label: "OpenAlex", url: `https://openalex.org/${identifiers.openAlex}` });
  }
  return links;
}

function outgoingPaper(record, audit) {
  const version = `${SOURCE_AUDIT_VERSION_PREFIX}${audit.auditId}`;
  const providerRecords = [{
    provider: "arXiv source bibliography",
    retrievedAt: audit.auditAsOf,
    recordId: `${audit.sourceAudit.arxiv}:${record.bibKey}`,
  }];
  if (record.identifiers.doi) {
    providerRecords.push({
      provider: record.doiEvidence === "reviewed-existing-record"
        ? "reviewed direct-neighborhood audit"
        : "Crossref reference metadata",
      retrievedAt: audit.auditAsOf,
      recordId: normalizeStableIdentifier("doi", record.identifiers.doi),
    });
  }
  if (record.identifiers.arxiv) {
    providerRecords.push({
      provider: "arXiv",
      retrievedAt: audit.auditAsOf,
      recordId: record.identifiers.arxiv,
    });
  }
  return {
    id: record.id,
    title: record.title,
    authors: record.authors,
    date: record.date,
    venue: record.venue,
    status: "provisional",
    identifiers: record.identifiers,
    sourceLinks: identifierLinks(
      record.identifiers,
      audit.sourceAudit.sourceArchiveUrl,
      record.bibKey,
    ),
    contributionSummary: "Provisional endpoint metadata transcribed from the reviewed arXiv v2 bibliography; theorem-level mathematical distillation has not started.",
    importProvenance: providerRecords,
    license: {
      metadata: "Bibliographic facts and in-text citation locations from the reviewed arXiv source, with provider provenance.",
      fullText: "No normalized reusable full-text license confirmed for this cited work; no cited full text was copied.",
    },
    rewriteStatus: "metadata-only",
    theoremExtractionStatus: "not-started",
    formalizationStatus: "statement-only",
    citationCoverage: {
      outgoingFound: 0,
      outgoingResolved: 0,
      incomingFound: 0,
      incomingResolved: 0,
      incomingStatus: "identifier-unresolved",
      providerSearchesAttempted: 0,
      recursiveClosureComplete: false,
      note: "This source-resolved endpoint has no reviewed OpenAlex identity. Its own recursive citation neighborhood is blocked pending exact identifier resolution.",
    },
    version,
    modificationHistory: [{
      version,
      timestamp: audit.auditAsOf,
      contributors: ["NisabaDB citation audit"],
      summary: `Created a source-resolved endpoint for bibliography key ${record.bibKey}; no title-only merge was used.`,
    }],
    featured: false,
    graph: { paperRoots: [], views: [] },
  };
}

function incomingPaper(record, audit) {
  const version = `${SOURCE_AUDIT_VERSION_PREFIX}${audit.auditId}`;
  const identifiers = {
    openAlex: record.openAlex,
    ...(record.doi ? { doi: normalizeStableIdentifier("doi", record.doi) } : {}),
  };
  const sourceLinks = [
    { label: "OpenAlex version-family query", url: audit.versionFamily.conference.queryUrl },
    { label: "OpenAlex", url: `https://openalex.org/${record.openAlex}` },
    ...(record.doi ? [{ label: "DOI", url: `https://doi.org/${record.doi}` }] : []),
  ];
  return {
    id: `openalex-${record.openAlex.toLowerCase()}`,
    title: record.title,
    authors: record.authors,
    date: record.date,
    venue: record.venue,
    status: "provisional",
    identifiers,
    sourceLinks,
    contributionSummary: `OpenAlex provisional metadata for a ${record.type} returned by the non-XPAC incoming-citation query on the FOCS version-family identity; theorem-level mathematical distillation has not started.`,
    importProvenance: [{
      provider: "OpenAlex version-family query",
      retrievedAt: audit.auditAsOf,
      recordId: record.openAlex,
    }],
    license: {
      metadata: "Cached OpenAlex bibliographic metadata with exact work identity and retrieval provenance; OpenAlex terms apply.",
      fullText: "No normalized reusable full-text license confirmed; no full text was copied.",
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
      note: "Discovered through an exact OpenAlex version-family incoming edge; this endpoint's own incoming and outgoing neighborhoods remain queued.",
    },
    version,
    modificationHistory: [{
      version,
      timestamp: audit.auditAsOf,
      contributors: ["NisabaDB citation audit"],
      summary: `Created a provider-linked incoming endpoint from exact OpenAlex work ${record.openAlex}.`,
    }],
    featured: false,
    graph: { paperRoots: [], views: [] },
  };
}

function mergeReviewedPaper(papers, candidate, audit, reusePaperId) {
  const exactMatch = findExactPaperMatch(papers, candidate);
  const idMatch = papers.find((paper) => paper.id === candidate.id);
  if (reusePaperId) {
    const reused = papers.find((paper) => paper.id === reusePaperId);
    if (!reused || exactMatch?.id !== reusePaperId) {
      throw new Error(`Reviewed reuse ${reusePaperId} is absent or lacks an exact stable-identifier match`);
    }
    const globallyStableMatches = exactIdentifierKeys(reused, candidate)
      .filter((key) => key !== "internal");
    if (globallyStableMatches.length === 0) {
      throw new Error(`Reviewed reuse ${reusePaperId} matches only an internal identifier`);
    }
  } else {
    if (exactMatch && !isAuditGeneratedPaper(exactMatch, audit.auditId)) {
      throw new Error(`Unreviewed existing-paper reuse for ${candidate.id} through ${exactIdentifierKeys(exactMatch, candidate).join(", ")}`);
    }
    if (idMatch && !isAuditGeneratedPaper(idMatch, audit.auditId) && idMatch !== exactMatch) {
      throw new Error(`Audit endpoint ID ${candidate.id} collides with a non-audit paper`);
    }
  }
  return mergePaperRecord(papers, candidate);
}

function removeStaleAuditProvenance(papers, paperId, record, audit) {
  if (record.doiEvidence !== "reviewed-existing-record") return papers;
  const doi = normalizeStableIdentifier("doi", record.identifiers.doi);
  return papers.map((paper) => paper.id === paperId ? {
    ...paper,
    importProvenance: paper.importProvenance.filter((entry) => !(
      entry.provider === "Crossref reference metadata" &&
      entry.retrievedAt === audit.auditAsOf &&
      normalizeStableIdentifier("doi", entry.recordId) === doi
    )),
  } : paper);
}

function outgoingEdge(record, citedPaperId, audit) {
  return {
    id: `citation-${audit.seedPaperId}-${record.bibKey.toLowerCase()}`,
    citingPaperId: audit.seedPaperId,
    citedPaperId,
    discoveredFromPaperId: audit.seedPaperId,
    discoveryDirection: "outgoing",
    provenance: [{
      provider: "arXiv source bibliography",
      providerRecordId: `${audit.sourceAudit.arxiv}:${record.bibKey}:lines-${record.citationLines.join("-")}`,
      retrievedAt: audit.auditAsOf,
      evidenceUrl: audit.sourceAudit.sourceArchiveUrl,
    }],
    confidence: "manual-reviewed",
  };
}

function incomingEdge(citingPaperId, record, audit) {
  return {
    id: `citation-${citingPaperId}-${audit.seedPaperId}`,
    citingPaperId,
    citedPaperId: audit.seedPaperId,
    discoveredFromPaperId: audit.seedPaperId,
    discoveryDirection: "incoming",
    provenance: [{
      provider: `OpenAlex version-family via ${audit.versionFamily.conference.openAlex}`,
      providerRecordId: record.openAlex,
      retrievedAt: audit.auditAsOf,
      evidenceUrl: audit.versionFamily.conference.queryUrl,
    }],
    confidence: "provider-linked",
  };
}

function endpointQueueItem(paper, audit) {
  if (!paper.identifiers.openAlex) {
    return {
      paperId: paper.id,
      state: "blocked",
      nextTasks: ["resolve-identifiers"],
      attempts: 0,
      updatedAt: audit.auditAsOf,
      lastError: "No exact OpenAlex work identity is present in the reviewed citation audit; title-only resolution is prohibited.",
    };
  }
  return {
    paperId: paper.id,
    state: "metadata-fetched",
    nextTasks: ["fetch-outgoing", "fetch-incoming", "deduplicate"],
    attempts: 0,
    updatedAt: audit.auditAsOf,
  };
}

function mergeEndpointQueueItem(queue, candidate) {
  const existing = queue.find((item) => item.paperId === candidate.paperId);
  if (!existing) return [...queue, candidate];
  if (["blocked", "complete-direct-neighborhood"].includes(existing.state)) return queue;
  return mergeQueueItem(queue, candidate).queue;
}

function updateSeedPaper(papers, audit) {
  const paper = papers.find((candidate) => candidate.id === audit.seedPaperId);
  if (!paper) throw new Error(`Citation snapshot is missing multislice seed ${audit.seedPaperId}`);
  const version = `${SOURCE_AUDIT_VERSION_PREFIX}${audit.auditId}`;
  const historyRecord = {
    version,
    timestamp: audit.auditAsOf,
    contributors: ["NisabaDB citation audit"],
    summary: "Materialized all 48 source-authoritative outgoing endpoints and 28 non-XPAC provider-visible incoming version-family endpoints; recursive closure remains incomplete.",
  };
  const provenance = [
    {
      provider: "arXiv source archive",
      retrievedAt: audit.auditAsOf,
      recordId: `${audit.sourceAudit.arxiv}:sha256:${audit.sourceAudit.sourceArchiveSha256}`,
    },
    {
      provider: "Crossref reference list",
      retrievedAt: audit.auditAsOf,
      recordId: audit.sourceAudit.journalDoi,
    },
    {
      provider: "OpenAlex version-family query",
      retrievedAt: audit.auditAsOf,
      recordId: audit.versionFamily.conference.openAlex,
    },
  ];
  const sourceLinks = [
    { label: "arXiv v2 source", url: audit.sourceAudit.sourceArchiveUrl },
    { label: "Related FOCS version", url: `https://doi.org/${audit.versionFamily.conference.doi}` },
    { label: "FOCS OpenAlex identity used for incoming scan", url: `https://openalex.org/${audit.versionFamily.conference.openAlex}` },
  ];

  return papers.map((candidate) => candidate.id === paper.id ? {
    ...candidate,
    sourceLinks: uniqueBy([...(candidate.sourceLinks ?? []), ...sourceLinks], (link) => `${link.label}\u0000${link.url}`),
    importProvenance: uniqueBy(
      [...(candidate.importProvenance ?? []), ...provenance],
      (entry) => `${entry.provider}\u0000${entry.recordId}\u0000${entry.retrievedAt}`,
    ),
    license: {
      metadata: "Bibliographic facts, source citation locations, and provider-linked identities are cached with retrieval provenance; provider terms apply.",
      fullText: "arXiv v2 uses the arXiv non-exclusive distribution license and no normalized reusable source/full-text license was confirmed. Elsevier sharing terms also restrict redistribution/adaptation. NisabaDB stores no copied paper text.",
    },
    citationCoverage: {
      outgoingFound: 48,
      outgoingResolved: 48,
      incomingFound: 28,
      incomingResolved: 28,
      incomingStatus: "provider-visible-only",
      providerSearchesAttempted: Math.max(candidate.citationCoverage?.providerSearchesAttempted ?? 0, 6),
      recursiveClosureComplete: false,
      note: "Outgoing coverage is source-authoritative: comment-stripped arXiv v2 cites 48 unique bibliography keys, the .bbl contains 48 entries, and Crossref reports 48 references; all 48 endpoints are persisted. Incoming coverage is provider-visible-only: 28 non-XPAC OpenAlex records cite the related FOCS identity W3207594656 (29 with XPAC, whose extra record is a later-version duplicate), while the distinct journal and arXiv OpenAlex identities each returned zero. Version-family edges do not assert that each work cites the 2025 journal record. Recursive endpoint crawling and identity review remain incomplete.",
    },
    version,
    modificationHistory: uniqueBy(
      [...(candidate.modificationHistory ?? []), historyRecord],
      (entry) => `${entry.version}\u0000${entry.timestamp}\u0000${entry.summary}`,
    ),
  } : candidate);
}

function updateSeedQueue(queue, audit) {
  const unresolved = audit.providerGaps.unresolvedReferencedWorkIds;
  const reviewed = {
    paperId: audit.seedPaperId,
    state: "neighbors-fetched",
    nextTasks: ["deduplicate", "review-match"],
    attempts: 1,
    updatedAt: audit.auditAsOf,
    lastError: `Source and version-family neighborhoods are persisted, but provider reconciliation remains open: OpenAlex exposed 45 journal referenced-work IDs, returned 22 records, and returned no record for ${unresolved.length} IDs. Recursive closure is not complete.`,
  };
  const existing = queue.find((item) => item.paperId === audit.seedPaperId);
  if (!existing) return [...queue, reviewed];
  return queue.map((item) => item.paperId === audit.seedPaperId ? {
    ...reviewed,
    attempts: Math.max(item.attempts, reviewed.attempts),
    updatedAt: item.updatedAt > reviewed.updatedAt ? item.updatedAt : reviewed.updatedAt,
  } : item);
}

export function mergeMultisliceCitationAuditIntoSnapshot(inputAudit, existingSnapshot) {
  const audit = validateMultisliceCitationAudit(inputAudit);
  if (!Array.isArray(existingSnapshot?.papers) ||
      !Array.isArray(existingSnapshot?.citationEdges) ||
      !Array.isArray(existingSnapshot?.ingestionQueue)) {
    throw new Error("Existing citation snapshot must contain papers, citationEdges, and ingestionQueue arrays");
  }

  let papers = [...existingSnapshot.papers];
  let citationEdges = [...existingSnapshot.citationEdges];
  let ingestionQueue = [...existingSnapshot.ingestionQueue];
  const outgoingPaperIds = new Map();
  let papersAdded = 0;
  let edgesAdded = 0;

  for (const record of audit.outgoing) {
    const merged = mergeReviewedPaper(
      papers,
      outgoingPaper(record, audit),
      audit,
      record.reusePaperId,
    );
    papers = merged.papers;
    papers = removeStaleAuditProvenance(papers, merged.paperId, record, audit);
    if (merged.added) papersAdded += 1;
    outgoingPaperIds.set(record.bibKey, merged.paperId);
  }

  for (const record of audit.outgoing) {
    const citedPaperId = outgoingPaperIds.get(record.bibKey);
    const edge = mergeCitationEdge(citationEdges, outgoingEdge(record, citedPaperId, audit));
    citationEdges = edge.edges;
    if (edge.added) edgesAdded += 1;
    const paper = papers.find((candidate) => candidate.id === citedPaperId);
    ingestionQueue = mergeEndpointQueueItem(
      ingestionQueue,
      endpointQueueItem(paper, audit),
    );
  }

  for (const record of audit.incoming) {
    const merged = mergeReviewedPaper(papers, incomingPaper(record, audit), audit);
    papers = merged.papers;
    if (merged.added) papersAdded += 1;
    const edge = mergeCitationEdge(citationEdges, incomingEdge(merged.paperId, record, audit));
    citationEdges = edge.edges;
    if (edge.added) edgesAdded += 1;
    const paper = papers.find((candidate) => candidate.id === merged.paperId);
    ingestionQueue = mergeEndpointQueueItem(
      ingestionQueue,
      endpointQueueItem(paper, audit),
    );
  }

  papers = updateSeedPaper(papers, audit);
  ingestionQueue = updateSeedQueue(ingestionQueue, audit);

  return {
    snapshot: { ...existingSnapshot, papers, citationEdges, ingestionQueue },
    stats: {
      papersAdded,
      edgesAdded,
      outgoingEndpoints: audit.outgoing.length,
      incomingEndpoints: audit.incoming.length,
      reviewedExistingPaperReuses: EXPECTED_REUSED_PAPER_IDS.length,
    },
  };
}
