import {
  mergeCitationEdge,
  mergePaperRecord,
} from "./citation-lib.mjs";

export const FEATURED_PAPER_ID = "dimension-free-dictatorship-tester";

function auditedPaper(record, auditAsOf) {
  const hasOpenAlexIdentity = Boolean(record.identifiers.openAlex);
  return {
    id: record.id,
    title: record.title,
    authors: record.authors,
    date: record.date,
    venue: record.venue,
    status: "provisional",
    identifiers: record.identifiers,
    sourceLinks: record.sourceLinks,
    contributionSummary: `Provisional metadata record for a directly cited ${record.kind.replaceAll("-", " ")}; theorem-level mathematical distillation has not started.`,
    importProvenance: record.providerRecords.map((providerRecord) => ({
      provider: providerRecord.provider,
      retrievedAt: auditAsOf,
      recordId: providerRecord.id,
    })),
    license: {
      metadata: "Cached bibliographic metadata with provider provenance; provider terms apply.",
      fullText: record.license,
    },
    rewriteStatus: "metadata-only",
    theoremExtractionStatus: "not-started",
    formalizationStatus: "statement-only",
    citationCoverage: {
      outgoingFound: 0,
      outgoingResolved: 0,
      incomingFound: 0,
      incomingResolved: 0,
      incomingStatus: hasOpenAlexIdentity ? "queued" : "identifier-unresolved",
      providerSearchesAttempted: 0,
      recursiveClosureComplete: false,
      note: hasOpenAlexIdentity
        ? "Direct-neighbor metadata is cached; this record is queued for its own incoming and outgoing citation neighborhood."
        : "This direct neighbor has no OpenAlex work identity in the reviewed metadata. Its recursive neighborhood is blocked pending identifier resolution.",
    },
    version: `metadata-audit:${auditAsOf}`,
    modificationHistory: [{
      version: `metadata-audit:${auditAsOf}`,
      timestamp: auditAsOf,
      contributors: ["NisabaDB project"],
      summary: "Created a provisional metadata record from the reviewed direct-citation audit.",
    }],
    featured: false,
    graph: { paperRoots: [], views: [] },
  };
}

function auditedEdge(record, citedPaperId, auditAsOf) {
  return {
    id: `citation-${FEATURED_PAPER_ID}-${record.bibKey.toLowerCase()}`,
    citingPaperId: FEATURED_PAPER_ID,
    citedPaperId,
    discoveredFromPaperId: FEATURED_PAPER_ID,
    discoveryDirection: "outgoing",
    provenance: [{
      provider: "author-manuscript",
      providerRecordId: `${record.bibKey}:lines-${record.citationLines.join("-")}`,
      retrievedAt: auditAsOf,
    }],
    confidence: "manual-reviewed",
  };
}

function seedQueueItem(auditAsOf) {
  return {
    paperId: FEATURED_PAPER_ID,
    state: "blocked",
    nextTasks: ["resolve-identifiers"],
    attempts: 1,
    updatedAt: auditAsOf,
    lastError: "The seed manuscript is absent from OpenAlex, Crossref, arXiv, DataCite, and Semantic Scholar. Incoming citation coverage remains indeterminate until it receives a stable provider identity.",
  };
}

function neighborQueueItem(paper, auditAsOf) {
  if (!paper.identifiers.openAlex) {
    return {
      paperId: paper.id,
      state: "blocked",
      nextTasks: ["resolve-identifiers"],
      attempts: 0,
      updatedAt: auditAsOf,
      lastError: "No OpenAlex work identity is present in the reviewed direct-neighbor metadata.",
    };
  }
  return {
    paperId: paper.id,
    state: "metadata-fetched",
    nextTasks: ["fetch-outgoing", "fetch-incoming", "deduplicate"],
    attempts: 0,
    updatedAt: auditAsOf,
  };
}

function alignBlockedIdentityCoverage(papers, paperId, auditAsOf) {
  return papers.map((paper) => {
    if (paper.id !== paperId || paper.identifiers.openAlex) return paper;
    const historyRecord = {
      version: `metadata-audit:${auditAsOf}:identity-state`,
      timestamp: auditAsOf,
      contributors: ["NisabaDB project"],
      summary: "Marked the recursive citation neighborhood blocked pending a resolvable provider work identity.",
    };
    const modificationHistory = paper.modificationHistory.some(
      (record) => record.version === historyRecord.version,
    )
      ? paper.modificationHistory
      : [...paper.modificationHistory, historyRecord];
    return {
      ...paper,
      citationCoverage: {
        ...paper.citationCoverage,
        incomingStatus: "identifier-unresolved",
        recursiveClosureComplete: false,
        note: "This direct neighbor has no OpenAlex work identity in the reviewed metadata. Its recursive incoming and outgoing neighborhoods are blocked pending identifier resolution.",
      },
      modificationHistory,
    };
  });
}

function mergeBaselineQueueItem(queue, candidate) {
  const existing = queue.find((item) => item.paperId === candidate.paperId);
  if (!existing) return [...queue, candidate];
  if (existing.state === "complete-direct-neighborhood") return queue;
  if (existing.state === "blocked") return queue;

  if (candidate.state === "blocked") {
    return queue.map((item) => item.paperId === candidate.paperId ? {
      ...candidate,
      attempts: item.attempts,
    } : item);
  }
  return queue.map((item) => item.paperId === candidate.paperId ? {
    ...item,
    nextTasks: [...new Set([...item.nextTasks, ...candidate.nextTasks])],
  } : item);
}

export function mergeAuditIntoSnapshot(audit, existingSnapshot) {
  const existing = existingSnapshot ?? { papers: [], citationEdges: [], ingestionQueue: [] };
  if (!Array.isArray(existing.papers) || !Array.isArray(existing.citationEdges) ||
      !Array.isArray(existing.ingestionQueue)) {
    throw new Error("Existing citation snapshot must contain papers, citationEdges, and ingestionQueue arrays");
  }

  let papers = [...existing.papers];
  const auditedIdToCorpusId = new Map();
  for (const record of audit.records) {
    const merged = mergePaperRecord(papers, auditedPaper(record, audit.auditAsOf));
    papers = merged.papers;
    papers = alignBlockedIdentityCoverage(papers, merged.paperId, audit.auditAsOf);
    auditedIdToCorpusId.set(record.id, merged.paperId);
  }

  let citationEdges = [...existing.citationEdges];
  for (const record of audit.records) {
    const citedPaperId = auditedIdToCorpusId.get(record.id);
    if (!citedPaperId) throw new Error(`Audit paper ${record.id} was not merged`);
    citationEdges = mergeCitationEdge(
      citationEdges,
      auditedEdge(record, citedPaperId, audit.auditAsOf),
    ).edges;
  }

  let ingestionQueue = [...existing.ingestionQueue];
  if (!ingestionQueue.some((item) => item.paperId === FEATURED_PAPER_ID)) {
    ingestionQueue.push(seedQueueItem(audit.auditAsOf));
  }
  for (const record of audit.records) {
    const paperId = auditedIdToCorpusId.get(record.id);
    const paper = papers.find((candidate) => candidate.id === paperId);
    if (!paper) throw new Error(`Merged paper ${paperId} is absent`);
    ingestionQueue = mergeBaselineQueueItem(
      ingestionQueue,
      neighborQueueItem(paper, audit.auditAsOf),
    );
  }

  return { papers, citationEdges, ingestionQueue };
}
