import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  readBookGraphFileSync,
  referencedBookGraphShardPaths,
} from "./book-graph-codec.mjs";
import {
  bookGraphIdentityFor,
  canonicalNeutralArtifactPathsSync,
  initialBookGraphFor,
} from "./book-graph-source-components.mjs";
import {
  trackedBookGraphPayloadPathsSync,
} from "./book-graph-publication-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repositoryRoot, "data/knowledge/source-records.json");
const booksRoot = path.join(repositoryRoot, "data/books");
const manifestPath = path.join(booksRoot, "manifest.json");
const commandArguments = process.argv.slice(2);
const allowedArguments = new Set(["--check", "--remove-neutral-placeholders"]);
for (const argument of commandArguments) {
  if (!allowedArguments.has(argument)) throw new Error(`Unknown option: ${argument}`);
}
if (new Set(commandArguments).size !== commandArguments.length) {
  throw new Error("Duplicate book-graph corpus option");
}
const checkOnly = commandArguments.includes("--check");
const removeNeutralPlaceholders = commandArguments.includes("--remove-neutral-placeholders");
if (checkOnly && removeNeutralPlaceholders) {
  throw new Error("--check and --remove-neutral-placeholders are mutually exclusive");
}

const sourceRecordIdPattern = /^S\d{4}$/;
const componentIdPattern = /^[a-z0-9][a-z0-9-]*$/;
const relativeFilePattern = /^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function atomicWrite(filePath, bytes) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`,
  );
  try {
    fs.writeFileSync(temporaryPath, bytes);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
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
      const identity = bookGraphIdentityFor(registry, record, component);
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
        canonicalArtifactPath: relativeFile,
      });
      placeholders.set(relativeFile, initialBookGraphFor(registry, record, component));
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
  const proofRoutes = Array.isArray(file.graph.proofRoutes) ? file.graph.proofRoutes : [];
  const routedTheoremIds = new Set(proofRoutes.map((route) => route?.theoremNodeId));
  const nodeById = new Map(nodes.map((node) => [node?.id, node]));
  const dependencyById = new Map(directDependencies.map((dependency) => [
    dependency?.id,
    dependency,
  ]));
  const dependencyRoutedTheoremIds = new Set(proofRoutes
    .filter((route) => route?.routeKind === "root-attestation"
      || route?.dependencyIds?.some((id) => {
        const dependency = dependencyById.get(id);
        if (!dependency) return false;
        if (dependency.prerequisite?.type === "external-input") return true;
        const prerequisiteNode = nodeById.get(dependency.prerequisite?.id);
        return prerequisiteNode !== undefined && prerequisiteNode.nodeClass !== "source-artifact";
      }))
    .map((route) => route?.theoremNodeId));
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
    dependencyPendingTheoremCount: nodes.filter((node) => (
      node?.nodeClass === "theorem-like" && !dependencyRoutedTheoremIds.has(node.id)
    )).length,
    supportNodeCount: nodes.filter((node) => node?.nodeClass === "support").length,
    sourceArtifactNodeCount: nodes.filter((node) => node?.nodeClass === "source-artifact").length,
    dependencyCount: directDependencies.length,
    reviewedDependencyCount: directDependencies.filter((dependency) => dependency?.evidence?.status === "reviewed").length,
    unresolvedReferenceCount: references.filter((reference) => reference?.resolution?.status === "unresolved").length,
  };
}

function manifestFor(registry, baseEntries, neutralFiles) {
  const entries = baseEntries.map((baseEntry) => {
    const { canonicalArtifactPath, ...identity } = baseEntry;
    return {
      ...identity,
      artifactPath: null,
      ...metricsFor(neutralFiles.get(canonicalArtifactPath), canonicalArtifactPath),
    };
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
    dependencyPendingTheoremCount: entries.reduce((sum, entry) => (
      sum + entry.dependencyPendingTheoremCount
    ), 0),
    supportNodeCount: entries.reduce((sum, entry) => sum + entry.supportNodeCount, 0),
    sourceArtifactNodeCount: entries.reduce((sum, entry) => sum + entry.sourceArtifactNodeCount, 0),
    dependencyCount: entries.reduce((sum, entry) => sum + entry.dependencyCount, 0),
    reviewedDependencyCount: entries.reduce((sum, entry) => sum + entry.reviewedDependencyCount, 0),
    unresolvedReferenceCount: entries.reduce((sum, entry) => sum + entry.unresolvedReferenceCount, 0),
  };
  return {
    schemaVersion: "1.2.0",
    sourceSetRevision: registry.sourceSetRevision,
    sourceRecordCount: registry.records.length,
    componentCount: entries.length,
    artifactCount: entries.filter((entry) => entry.artifactPath !== null).length,
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
    const filePath = path.join(booksRoot, ...baseEntry.canonicalArtifactPath.split("/"));
    if (!fs.existsSync(filePath)) continue;
    const storageIndex = readJson(filePath);
    for (const shardPath of referencedBookGraphShardPaths(storageIndex)) {
      const relativeShardPath = path.posix.join(
        path.posix.dirname(baseEntry.canonicalArtifactPath),
        shardPath,
      );
      if (seen.has(relativeShardPath)) {
        throw new Error(`Duplicate referenced book-graph shard: ${relativeShardPath}`);
      }
      seen.add(relativeShardPath);
      shardFiles.push(relativeShardPath);
    }
  }
  return shardFiles.sort();
}

function priorArtifactPaths(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.entries)) {
    throw new Error("Existing data/books/manifest.json has no entries array");
  }
  return manifest.entries.map((entry) => {
    if (Object.hasOwn(entry, "artifactPath")) {
      if (entry.artifactPath !== null && typeof entry.artifactPath !== "string") {
        throw new Error("Existing book manifest has an invalid artifactPath");
      }
      return entry.artifactPath;
    }
    if (typeof entry.path === "string") return entry.path;
    throw new Error("Existing book manifest entry has neither artifactPath nor legacy path");
  }).filter((artifactPath) => artifactPath !== null);
}

function assertNoSilentArtifactLoss(previousManifest) {
  for (const relativeFile of priorArtifactPaths(previousManifest)) {
    if (!relativeFilePattern.test(relativeFile) || path.posix.normalize(relativeFile) !== relativeFile) {
      throw new Error(`Existing book manifest has an unsafe artifact path: ${relativeFile}`);
    }
    const filePath = path.join(booksRoot, ...relativeFile.split("/"));
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Previously present book graph artifact disappeared: ${relativeFile}; `
          + "restore it or use the explicit neutral-placeholder migration",
      );
    }
  }
}

function validateArtifactFiles(baseEntries, neutralFiles) {
  const allowedFiles = new Set(neutralFiles.keys());
  const actualFiles = listBookJsonFiles(booksRoot);
  const unexpectedFiles = actualFiles.filter((relativeFile) => !allowedFiles.has(relativeFile));
  if (unexpectedFiles.length > 0) {
    throw new Error(`Unexpected book graph artifacts: ${unexpectedFiles.join(", ")}`);
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

  const trackedPayloadPaths = trackedBookGraphPayloadPathsSync(repositoryRoot);
  const classifiedPayloadPaths = new Set();
  for (const relativeFile of actualFiles) {
    const filePath = path.join(booksRoot, ...relativeFile.split("/"));
    const storageIndex = readJson(filePath);
    const relativePayloadPaths = [
      relativeFile,
      ...referencedBookGraphShardPaths(storageIndex).map((shardPath) => (
        path.posix.join(path.posix.dirname(relativeFile), shardPath)
      )),
    ];
    const repositoryPayloadPaths = relativePayloadPaths.map((relativePath) => `data/books/${relativePath}`);
    repositoryPayloadPaths.forEach((relativePath) => classifiedPayloadPaths.add(relativePath));
    const trackedForArtifact = repositoryPayloadPaths.filter((relativePath) => trackedPayloadPaths.has(relativePath));
    if (trackedForArtifact.length > 0) {
      throw new Error(
        `${relativeFile} is local/private graph data but ${trackedForArtifact.length} payload file(s) are tracked by public Git`,
      );
    }
    const actual = readBookGraphFileSync(filePath);
    const expectedIdentity = neutralFiles.get(relativeFile).identity;
    if (canonicalJson(actual.identity) !== canonicalJson(expectedIdentity)) {
      throw new Error(`${relativeFile} identity does not match the source registry`);
    }
    if (actual.exactEdition !== null
      && actual.exactEdition?.unitManifestSha256 !== digestJson(actual.sourceUnits)) {
      throw new Error(`${relativeFile} unit-manifest fingerprint is stale`);
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
  const unclassifiedTrackedPaths = [...trackedPayloadPaths]
    .filter((relativePath) => !classifiedPayloadPaths.has(relativePath));
  if (unclassifiedTrackedPaths.length > 0) {
    throw new Error(`Tracked book-graph payloads are missing or unclassified: ${unclassifiedTrackedPaths.join(", ")}`);
  }
}

function checkCorpus(registry, baseEntries, neutralFiles) {
  if (!fs.existsSync(manifestPath)) throw new Error("Missing data/books/manifest.json; run npm run books:sync");
  const manifest = manifestFor(registry, baseEntries, neutralFiles);
  const actualManifest = readJson(manifestPath);
  if (canonicalJson(actualManifest) !== canonicalJson(manifest)) {
    throw new Error("data/books/manifest.json is stale; run npm run books:sync");
  }
  validateArtifactFiles(baseEntries, neutralFiles);
}

function syncCorpus(registry, baseEntries, neutralFiles) {
  fs.mkdirSync(booksRoot, { recursive: true });
  const previousManifestBytes = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
  if (fs.existsSync(manifestPath)) {
    assertNoSilentArtifactLoss(readJson(manifestPath));
  }
  validateArtifactFiles(baseEntries, neutralFiles);
  const manifest = manifestFor(registry, baseEntries, neutralFiles);
  try {
    atomicWrite(manifestPath, canonicalJson(manifest));
    checkCorpus(registry, baseEntries, neutralFiles);
  } catch (error) {
    if (previousManifestBytes) {
      atomicWrite(manifestPath, previousManifestBytes);
    } else if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
    }
    throw error;
  }
  process.stdout.write(
    `Book graph manifest synchronized: ${manifest.componentCount} component identities, `
      + `${manifest.artifactCount} public payload paths, ${manifest.componentCount - manifest.artifactCount} absent.\n`,
  );
}

function restoreBackups(backups) {
  for (const [filePath, bytes] of backups) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, bytes);
  }
}

function removeCanonicalNeutralPlaceholders(registry, baseEntries, neutralFiles) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Missing data/books/manifest.json; refusing placeholder migration without prior state");
  }
  const previousManifestBytes = fs.readFileSync(manifestPath);
  const previousManifest = JSON.parse(previousManifestBytes.toString("utf8"));
  assertNoSilentArtifactLoss(previousManifest);
  validateArtifactFiles(baseEntries, neutralFiles);

  const removableArtifacts = [];
  for (const [relativeFile, neutralFile] of neutralFiles) {
    const filePath = path.join(booksRoot, ...relativeFile.split("/"));
    const artifactPaths = canonicalNeutralArtifactPathsSync(filePath, neutralFile);
    if (artifactPaths) removableArtifacts.push({ relativeFile, artifactPaths });
  }

  const backups = new Map();
  try {
    for (const { artifactPaths } of removableArtifacts) {
      for (const artifactPath of artifactPaths) {
        if (!fs.existsSync(artifactPath)) {
          throw new Error(`Neutral-placeholder artifact disappeared during migration: ${artifactPath}`);
        }
        backups.set(artifactPath, fs.readFileSync(artifactPath));
      }
    }
    for (const { artifactPaths } of removableArtifacts) {
      for (const artifactPath of artifactPaths) fs.unlinkSync(artifactPath);
    }

    const manifest = manifestFor(registry, baseEntries, neutralFiles);
    atomicWrite(manifestPath, canonicalJson(manifest));
    checkCorpus(registry, baseEntries, neutralFiles);
    process.stdout.write(
      `Removed ${removableArtifacts.length} exact canonical neutral placeholders; `
        + `${manifest.artifactCount} public payload paths remain for ${manifest.componentCount} components.\n`,
    );
  } catch (error) {
    restoreBackups(backups);
    atomicWrite(manifestPath, previousManifestBytes);
    throw error;
  }
}

const registry = readJson(registryPath);
const { baseEntries, placeholders: neutralFiles } = desiredCorpus(registry);

if (checkOnly) {
  checkCorpus(registry, baseEntries, neutralFiles);
  const manifest = manifestFor(registry, baseEntries, neutralFiles);
  process.stdout.write(
    `Book graph data valid: ${manifest.sourceRecordCount} source rows, `
      + `${manifest.componentCount} component identities, ${manifest.artifactCount} public payload paths.\n`,
  );
} else if (removeNeutralPlaceholders) {
  removeCanonicalNeutralPlaceholders(registry, baseEntries, neutralFiles);
} else {
  syncCorpus(registry, baseEntries, neutralFiles);
}
