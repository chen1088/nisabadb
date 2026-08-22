import {
  STABLE_IDENTIFIER_KEYS,
  normalizeStableIdentifier,
} from "./citation-lib.mjs";

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizedIdentifier(kind, value) {
  return normalizeStableIdentifier(kind, value) ?? String(value).trim().toLowerCase();
}

function assertPaperIdentityIntegrity(papers) {
  const paperIds = new Set();
  const identifierOwners = new Map();

  for (const paper of papers) {
    if (!paper?.id) throw new Error("Every assembled paper must have an ID");
    if (paperIds.has(paper.id)) {
      throw new Error(`Duplicate paper ID during corpus assembly: ${paper.id}`);
    }
    paperIds.add(paper.id);

    for (const kind of STABLE_IDENTIFIER_KEYS) {
      const value = paper.identifiers?.[kind];
      if (!value) continue;
      const key = `${kind}:${normalizedIdentifier(kind, value)}`;
      const owner = identifierOwners.get(key);
      if (owner && owner !== paper.id) {
        throw new Error(
          `Stable identifier collision during corpus assembly: ${key} belongs to both ${owner} and ${paper.id}`,
        );
      }
      identifierOwners.set(key, paper.id);
    }
  }
}

function mergeIdentifiers(existingPaper, goldPaper) {
  const merged = { ...(existingPaper.identifiers ?? {}) };

  for (const kind of STABLE_IDENTIFIER_KEYS) {
    const existingValue = existingPaper.identifiers?.[kind];
    const goldValue = goldPaper.identifiers?.[kind];
    if (!goldValue) continue;
    if (existingValue &&
        normalizedIdentifier(kind, existingValue) !== normalizedIdentifier(kind, goldValue)) {
      throw new Error(
        `Gold pack ${goldPaper.id} conflicts with its provisional ${kind} identifier`,
      );
    }
    if (!existingValue) merged[kind] = goldValue;
  }

  return merged;
}

function promotePaper(existingPaper, goldPaper) {
  if (existingPaper.status !== "provisional") {
    throw new Error(
      `Gold pack ${goldPaper.id} can only replace an existing provisional paper`,
    );
  }
  if (goldPaper.status !== "gold") {
    throw new Error(`Paper pack ${goldPaper.id} must declare status gold`);
  }

  return {
    ...existingPaper,
    ...goldPaper,
    id: existingPaper.id,
    identifiers: mergeIdentifiers(existingPaper, goldPaper),
    sourceLinks: uniqueBy(
      [...(existingPaper.sourceLinks ?? []), ...(goldPaper.sourceLinks ?? [])],
      (link) => link.url,
    ),
    importProvenance: uniqueBy(
      [...(existingPaper.importProvenance ?? []), ...(goldPaper.importProvenance ?? [])],
      (entry) => `${entry.provider}\u0000${entry.recordId}\u0000${entry.retrievedAt}`,
    ),
    modificationHistory: uniqueBy(
      [...(existingPaper.modificationHistory ?? []), ...(goldPaper.modificationHistory ?? [])],
      (entry) => `${entry.version}\u0000${entry.timestamp}\u0000${entry.summary}`,
    ),
    citationCoverage: existingPaper.citationCoverage,
  };
}

function assertStatementIntegrity(statements, paperIds) {
  const statementIds = new Set();
  const globalStatementIds = new Set();

  for (const statement of statements) {
    if (!statement?.id) throw new Error("Every assembled statement must have an ID");
    if (statementIds.has(statement.id)) {
      throw new Error(`Duplicate statement ID during corpus assembly: ${statement.id}`);
    }
    statementIds.add(statement.id);

    if (!statement.globalStatementId) {
      throw new Error(`Statement ${statement.id} is missing a global statement ID`);
    }
    if (globalStatementIds.has(statement.globalStatementId)) {
      throw new Error(
        `Duplicate global statement ID during corpus assembly: ${statement.globalStatementId}`,
      );
    }
    globalStatementIds.add(statement.globalStatementId);

    if (!paperIds.has(statement.paperId)) {
      throw new Error(
        `Statement ${statement.id} references an unassembled paper ${statement.paperId}`,
      );
    }
  }
}

function assertNeighborhoodShape(neighborhood) {
  if (!neighborhood || !Array.isArray(neighborhood.papers) ||
      !Array.isArray(neighborhood.citationEdges) ||
      !Array.isArray(neighborhood.ingestionQueue)) {
    throw new Error(
      "Citation neighborhood must contain papers, citationEdges, and ingestionQueue arrays",
    );
  }
}

export function assembleCorpus({
  schemaVersion,
  generatedAt,
  primaryPapers,
  primaryStatements,
  neighborhood,
  goldPacks = [],
}) {
  if (!Array.isArray(primaryPapers) || !Array.isArray(primaryStatements) ||
      !Array.isArray(goldPacks)) {
    throw new Error("Primary papers, primary statements, and gold packs must be arrays");
  }
  assertNeighborhoodShape(neighborhood);

  assertPaperIdentityIntegrity(primaryPapers);
  assertPaperIdentityIntegrity(neighborhood.papers);

  const assembledPrimaryPapers = [];
  let neighborhoodPapers = [...neighborhood.papers];
  for (const primaryPaper of primaryPapers) {
    const existingPaper = neighborhoodPapers.find((paper) => paper.id === primaryPaper.id);
    if (!existingPaper) {
      assembledPrimaryPapers.push(primaryPaper);
      continue;
    }
    if (primaryPaper.status !== "gold" || existingPaper.status !== "provisional") {
      throw new Error(`Duplicate paper ID during corpus assembly: ${primaryPaper.id}`);
    }
    assembledPrimaryPapers.push(promotePaper(existingPaper, primaryPaper));
    neighborhoodPapers = neighborhoodPapers.filter((paper) => paper.id !== primaryPaper.id);
  }
  assertPaperIdentityIntegrity([...assembledPrimaryPapers, ...neighborhoodPapers]);

  const goldPackIds = new Set();
  const statementsByPack = [];

  for (const pack of goldPacks) {
    const goldPaper = pack?.paper;
    const packStatements = pack?.statements;
    if (!goldPaper?.id || !Array.isArray(packStatements)) {
      throw new Error("Every gold pack must contain a paper and a statements array");
    }
    if (goldPackIds.has(goldPaper.id)) {
      throw new Error(`Duplicate gold pack ID during corpus assembly: ${goldPaper.id}`);
    }
    goldPackIds.add(goldPaper.id);

    const existingPaper = neighborhoodPapers.find((paper) => paper.id === goldPaper.id);
    if (!existingPaper) {
      throw new Error(
        `Gold pack ${goldPaper.id} does not match an existing provisional paper by exact ID`,
      );
    }

    for (const statement of packStatements) {
      if (statement.paperId !== goldPaper.id) {
        throw new Error(
          `Gold-pack statement ${statement.id ?? "without ID"} must belong to ${goldPaper.id}`,
        );
      }
      if (!statement.globalStatementId?.startsWith(`${goldPaper.id}.`)) {
        throw new Error(
          `Gold-pack statement ${statement.id ?? "without ID"} must use the ${goldPaper.id} global namespace`,
        );
      }
    }

    neighborhoodPapers = neighborhoodPapers.map((paper) =>
      paper.id === goldPaper.id ? promotePaper(paper, goldPaper) : paper,
    );
    statementsByPack.push(...packStatements);
  }

  const papers = [...assembledPrimaryPapers, ...neighborhoodPapers];
  assertPaperIdentityIntegrity(papers);
  const statements = [...primaryStatements, ...statementsByPack];
  assertStatementIntegrity(statements, new Set(papers.map((paper) => paper.id)));

  return {
    schemaVersion,
    generatedAt,
    papers,
    statements,
    citationEdges: [...neighborhood.citationEdges],
    ingestionQueue: [...neighborhood.ingestionQueue],
  };
}
