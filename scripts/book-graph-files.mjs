import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  readBookGraphFileSync,
  referencedBookGraphShardPaths,
} from "./book-graph-codec.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repositoryRoot, "data/knowledge/source-records.json");
const booksRoot = path.join(repositoryRoot, "data/books");
const manifestPath = path.join(booksRoot, "manifest.json");
const checkOnly = process.argv.includes("--check");

const sourceRecordIdPattern = /^S\d{4}$/;
const componentIdPattern = /^[a-z0-9][a-z0-9-]*$/;
const relativeFilePattern = /^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function digestJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertSafeSegment(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`Unsafe ${label}: ${String(value)}`);
  }
}

function relativeFileFor(recordId, componentId) {
  assertSafeSegment(recordId, sourceRecordIdPattern, "source record ID");
  assertSafeSegment(componentId, componentIdPattern, "source component ID");
  const relativeFile = `${recordId}/${componentId}.json`;
  if (!relativeFilePattern.test(relativeFile) || path.posix.normalize(relativeFile) !== relativeFile) {
    throw new Error(`Unsafe book-graph path: ${relativeFile}`);
  }
  return relativeFile;
}

function identityFor(registry, record, component) {
  return {
    bookGraphId: `${record.id}:${component.id}`,
    sourceSetRevision: registry.sourceSetRevision,
    sourceRecordId: record.id,
    sourceOrdinal: record.ordinal,
    familyId: record.familyId,
    sourceTitle: record.title,
    sourceAuthorLine: record.authorLine,
    sourceRawCitation: record.rawCitation,
    componentId: component.id,
    componentLabel: component.label,
  };
}

function placeholderFor(registry, record, component) {
  return {
    schemaVersion: "1.0.0",
    phase: "source-dependency-graph",
    identity: identityFor(registry, record, component),
    exactEdition: null,
    sourceUnits: [],
    unitInventories: [],
    graph: {
      nodes: [],
      externalInputs: [],
      directDependencies: [],
      proofRoutes: [],
      references: [],
    },
    extractionState: {
      status: "awaiting-edition",
      extractionAudit: null,
      independentReview: null,
      note: "Awaiting acquisition and identification of the exact edition before theorem extraction.",
    },
    graphState: {
      status: "not-started",
      graphAudit: null,
      independentReview: null,
      note: "Phase-I source dependency graph has not been extracted.",
    },
  };
}

function isSafePlaceholder(value) {
  return value !== null
    && typeof value === "object"
    && value.exactEdition === null
    && Array.isArray(value.sourceUnits)
    && value.sourceUnits.length === 0
    && (value.unitInventories === undefined
      || (Array.isArray(value.unitInventories) && value.unitInventories.length === 0))
    && value.graph !== null
    && typeof value.graph === "object"
    && ["nodes", "externalInputs", "directDependencies", "proofRoutes"]
      .every((key) => Array.isArray(value.graph[key]) && value.graph[key].length === 0)
    && (value.graph.references === undefined
      || (Array.isArray(value.graph.references) && value.graph.references.length === 0))
    && value.extractionState?.status === "awaiting-edition"
    && value.graphState?.status === "not-started";
}

function desiredCorpus(registry) {
  if (!Array.isArray(registry.records)) throw new Error("Source registry has no records array");
  const baseEntries = [];
  const placeholders = new Map();
  const seenPaths = new Set();
  const seenGraphIds = new Set();

  for (const record of registry.records) {
    assertSafeSegment(record.id, sourceRecordIdPattern, "source record ID");
    if (!Array.isArray(record.requiredEditionComponents) || record.requiredEditionComponents.length === 0) {
      throw new Error(`${record.id} has no required edition components`);
    }
    for (const component of record.requiredEditionComponents) {
      const relativeFile = relativeFileFor(record.id, component.id);
      const identity = identityFor(registry, record, component);
      if (seenPaths.has(relativeFile)) throw new Error(`Duplicate book-graph path: ${relativeFile}`);
      if (seenGraphIds.has(identity.bookGraphId)) throw new Error(`Duplicate book graph ID: ${identity.bookGraphId}`);
      seenPaths.add(relativeFile);
      seenGraphIds.add(identity.bookGraphId);
      baseEntries.push({
        bookGraphId: identity.bookGraphId,
        sourceRecordId: record.id,
        sourceOrdinal: record.ordinal,
        componentId: component.id,
        componentLabel: component.label,
        path: relativeFile,
      });
      placeholders.set(relativeFile, placeholderFor(registry, record, component));
    }
  }

  return { baseEntries, placeholders };
}

function metricsFor(file, relativeFile) {
  if (!file || typeof file !== "object" || !file.graph || typeof file.graph !== "object") {
    throw new Error(`${relativeFile} is not a book graph container`);
  }
  const { nodes, directDependencies, references } = file.graph;
  if (!Array.isArray(nodes) || !Array.isArray(directDependencies) || !Array.isArray(references)) {
    throw new Error(`${relativeFile} lacks required graph arrays`);
  }
  const routedTheoremIds = new Set(
    Array.isArray(file.graph.proofRoutes)
      ? file.graph.proofRoutes.map((route) => route?.theoremNodeId)
      : [],
  );
  return {
    extractionStatus: file.extractionState?.status,
    graphStatus: file.graphState?.status,
    exactEditionResolved: file.exactEdition !== null,
    sourceUnitCount: Array.isArray(file.sourceUnits) ? file.sourceUnits.length : 0,
    inventoriedSourceUnitCount: Array.isArray(file.unitInventories)
      ? file.unitInventories.filter((inventory) => inventory?.evidence?.status !== "pending").length
      : 0,
    reviewedSourceUnitCount: Array.isArray(file.unitInventories)
      ? file.unitInventories.filter((inventory) => inventory?.evidence?.status === "reviewed").length
      : 0,
    theoremNodeCount: nodes.filter((node) => node?.nodeClass === "theorem-like").length,
    unroutedTheoremCount: nodes.filter((node) => (
      node?.nodeClass === "theorem-like" && !routedTheoremIds.has(node.id)
    )).length,
    supportNodeCount: nodes.filter((node) => node?.nodeClass === "support").length,
    dependencyCount: directDependencies.length,
    reviewedDependencyCount: directDependencies.filter((dependency) => dependency?.evidence?.status === "reviewed").length,
    unresolvedReferenceCount: references.filter((reference) => reference?.resolution?.status === "unresolved").length,
  };
}

function manifestFor(registry, baseEntries) {
  const entries = baseEntries.map((baseEntry) => {
    const filePath = path.join(booksRoot, ...baseEntry.path.split("/"));
    if (!fs.existsSync(filePath)) throw new Error(`Missing book graph file: ${baseEntry.path}`);
    return { ...baseEntry, ...metricsFor(readBookGraphFileSync(filePath), baseEntry.path) };
  });
  const summary = {
    exactEditionResolvedCount: entries.filter((entry) => entry.exactEditionResolved).length,
    awaitingEditionCount: entries.filter((entry) => entry.extractionStatus === "awaiting-edition").length,
    reviewedExtractionCount: entries.filter((entry) => entry.extractionStatus === "reviewed").length,
    reviewedCompleteGraphCount: entries.filter((entry) => entry.graphStatus === "reviewed-complete").length,
    sourceUnitCount: entries.reduce((sum, entry) => sum + entry.sourceUnitCount, 0),
    inventoriedSourceUnitCount: entries.reduce((sum, entry) => sum + entry.inventoriedSourceUnitCount, 0),
    reviewedSourceUnitCount: entries.reduce((sum, entry) => sum + entry.reviewedSourceUnitCount, 0),
    theoremNodeCount: entries.reduce((sum, entry) => sum + entry.theoremNodeCount, 0),
    unroutedTheoremCount: entries.reduce((sum, entry) => sum + entry.unroutedTheoremCount, 0),
    supportNodeCount: entries.reduce((sum, entry) => sum + entry.supportNodeCount, 0),
    dependencyCount: entries.reduce((sum, entry) => sum + entry.dependencyCount, 0),
    reviewedDependencyCount: entries.reduce((sum, entry) => sum + entry.reviewedDependencyCount, 0),
    unresolvedReferenceCount: entries.reduce((sum, entry) => sum + entry.unresolvedReferenceCount, 0),
  };
  return {
    schemaVersion: "1.0.0",
    sourceSetRevision: registry.sourceSetRevision,
    sourceRecordCount: registry.records.length,
    componentFileCount: entries.length,
    summary,
    entries,
  };
}

function listBookJsonFiles(directory, prefix = "") {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listBookJsonFiles(fullPath, relative));
    else if (entry.isFile() && entry.name.endsWith(".json") && relative !== "manifest.json") files.push(relative);
  }
  return files.sort();
}

function listBookJsonlFiles(directory, prefix = "") {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listBookJsonlFiles(fullPath, relative));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(relative);
  }
  return files.sort();
}

function referencedShardFiles(baseEntries) {
  const shardFiles = [];
  const seen = new Set();
  for (const baseEntry of baseEntries) {
    const filePath = path.join(booksRoot, ...baseEntry.path.split("/"));
    const storageIndex = readJson(filePath);
    for (const shardPath of referencedBookGraphShardPaths(storageIndex)) {
      const relativeShardPath = path.posix.join(path.posix.dirname(baseEntry.path), shardPath);
      if (seen.has(relativeShardPath)) {
        throw new Error(`Duplicate referenced book-graph shard: ${relativeShardPath}`);
      }
      seen.add(relativeShardPath);
      shardFiles.push(relativeShardPath);
    }
  }
  return shardFiles.sort();
}

function checkCorpus(registry, baseEntries, placeholders) {
  if (!fs.existsSync(manifestPath)) throw new Error("Missing data/books/manifest.json; run npm run books:sync");
  const manifest = manifestFor(registry, baseEntries);
  const actualManifest = readJson(manifestPath);
  if (canonicalJson(actualManifest) !== canonicalJson(manifest)) {
    throw new Error("data/books/manifest.json is stale; run npm run books:sync");
  }

  const expectedFiles = [...placeholders.keys()].sort();
  const actualFiles = listBookJsonFiles(booksRoot);
  if (canonicalJson(actualFiles) !== canonicalJson(expectedFiles)) {
    throw new Error(`Book graph file set differs from the registry (${actualFiles.length}/${expectedFiles.length})`);
  }

  const expectedShardFiles = referencedShardFiles(baseEntries);
  const actualShardFiles = listBookJsonlFiles(booksRoot);
  if (canonicalJson(actualShardFiles) !== canonicalJson(expectedShardFiles)) {
    const expectedShardSet = new Set(expectedShardFiles);
    const actualShardSet = new Set(actualShardFiles);
    const missingCount = expectedShardFiles.filter((shardPath) => !actualShardSet.has(shardPath)).length;
    const orphanCount = actualShardFiles.filter((shardPath) => !expectedShardSet.has(shardPath)).length;
    throw new Error(`Book graph shard file set differs from component indexes (${missingCount} missing, ${orphanCount} orphan)`);
  }

  for (const [relativeFile, placeholder] of placeholders) {
    const filePath = path.join(booksRoot, ...relativeFile.split("/"));
    const actual = readBookGraphFileSync(filePath);
    const expectedIdentity = placeholder.identity;
    if (canonicalJson(actual.identity) !== canonicalJson(expectedIdentity)) {
      throw new Error(`${relativeFile} identity does not match the source registry`);
    }
    if (actual.exactEdition !== null) {
      if (actual.exactEdition?.unitManifestSha256 !== digestJson(actual.sourceUnits)) {
        throw new Error(`${relativeFile} unit-manifest fingerprint is stale`);
      }
    }
    if (actual.extractionState?.extractionAudit
      && actual.extractionState.extractionAudit.artifactSha256 !== digestJson({
        sourceUnits: actual.sourceUnits,
        unitInventories: actual.unitInventories,
      })) {
      throw new Error(`${relativeFile} extraction-audit fingerprint is stale`);
    }
    if (actual.graphState?.graphAudit
      && actual.graphState.graphAudit.artifactSha256 !== digestJson(actual.graph)) {
      throw new Error(`${relativeFile} graph-audit fingerprint is stale`);
    }
  }
}

function syncCorpus(registry, baseEntries, placeholders) {
  fs.mkdirSync(booksRoot, { recursive: true });
  let created = 0;
  let refreshed = 0;
  let preserved = 0;

  for (const [relativeFile, placeholder] of placeholders) {
    const filePath = path.join(booksRoot, ...relativeFile.split("/"));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, canonicalJson(placeholder));
      created += 1;
      continue;
    }

    const current = readBookGraphFileSync(filePath);
    if (isSafePlaceholder(current)) {
      const next = canonicalJson(placeholder);
      if (fs.readFileSync(filePath, "utf8") !== next) {
        fs.writeFileSync(filePath, next);
        refreshed += 1;
      }
    } else {
      preserved += 1;
    }
  }

  const manifest = manifestFor(registry, baseEntries);
  fs.writeFileSync(manifestPath, canonicalJson(manifest));
  checkCorpus(registry, baseEntries, placeholders);
  process.stdout.write(
    `Book graph components synchronized: ${placeholders.size} total, ${created} created, ${refreshed} placeholders refreshed, ${preserved} populated indexes preserved.\n`,
  );
}

const registry = readJson(registryPath);
const { baseEntries, placeholders } = desiredCorpus(registry);

if (checkOnly) {
  checkCorpus(registry, baseEntries, placeholders);
  const manifest = manifestFor(registry, baseEntries);
  process.stdout.write(`Book graph data valid: ${manifest.sourceRecordCount} source rows, ${manifest.componentFileCount} component identities.\n`);
} else {
  syncCorpus(registry, baseEntries, placeholders);
}
