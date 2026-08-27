import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  BOOK_GRAPH_LOGICAL_VERSION,
  encodeBookGraphFile,
  readBookGraphFileSync,
  referencedBookGraphShardPaths,
  resolveBookGraphShardPathSync,
} from "./book-graph-codec.mjs";

const sourceRecordIdPattern = /^S\d{4}$/u;
const componentIdPattern = /^[a-z0-9][a-z0-9-]*$/u;

function atomicWrite(filePath, bytes) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporaryPath, bytes);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function assertSafeIdentity(recordId, componentId) {
  if (typeof recordId !== "string" || !sourceRecordIdPattern.test(recordId)) {
    throw new Error(`Unsafe source record ID: ${String(recordId)}`);
  }
  if (typeof componentId !== "string" || !componentIdPattern.test(componentId)) {
    throw new Error(`Unsafe source component ID: ${String(componentId)}`);
  }
}

export function sourceComponentFor(registry, recordId, componentId) {
  assertSafeIdentity(recordId, componentId);
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.records)) {
    throw new Error("Source registry has no records array");
  }
  const records = registry.records.filter((candidate) => candidate?.id === recordId);
  if (records.length !== 1) {
    throw new Error(`Expected exactly one source registry record for ${recordId}, found ${records.length}`);
  }
  const record = records[0];
  if (!Array.isArray(record.requiredEditionComponents)) {
    throw new Error(`${recordId} has no required edition components`);
  }
  const components = record.requiredEditionComponents.filter((candidate) => candidate?.id === componentId);
  if (components.length !== 1) {
    throw new Error(
      `Expected exactly one source component ${recordId}:${componentId}, found ${components.length}`,
    );
  }
  return { record, component: components[0] };
}

export function bookGraphIdentityFor(registry, record, component) {
  assertSafeIdentity(record?.id, component?.id);
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

export function initialBookGraphFor(registry, record, component) {
  return {
    schemaVersion: BOOK_GRAPH_LOGICAL_VERSION,
    phase: "source-dependency-graph",
    identity: bookGraphIdentityFor(registry, record, component),
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

export function readBookGraphBaseOrInitialSync({
  indexPath,
  registryPath,
  recordId,
  componentId,
}) {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const { record, component } = sourceComponentFor(registry, recordId, componentId);
  const expectedIdentity = bookGraphIdentityFor(registry, record, component);
  if (!fs.existsSync(indexPath)) return initialBookGraphFor(registry, record, component);

  const file = readBookGraphFileSync(indexPath);
  if (!isDeepStrictEqual(file.identity, expectedIdentity)) {
    throw new Error("The destination component identity does not match the source registry");
  }
  return file;
}

export function canonicalNeutralArtifactPathsSync(indexPath, expectedNeutralFile) {
  if (!fs.existsSync(indexPath)) return null;
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const logical = readBookGraphFileSync(indexPath);
  if (!isDeepStrictEqual(logical, expectedNeutralFile)) return null;

  if (raw?.schemaVersion === BOOK_GRAPH_LOGICAL_VERSION) {
    if (!isDeepStrictEqual(raw, expectedNeutralFile)) return null;
  } else {
    const canonicalIndex = encodeBookGraphFile(expectedNeutralFile).index;
    if (!isDeepStrictEqual(raw, canonicalIndex)) return null;
  }

  return [
    indexPath,
    ...referencedBookGraphShardPaths(raw).map((relativePath) => (
      resolveBookGraphShardPathSync(indexPath, relativePath)
    )),
  ];
}

export function createRollbackSafeManifestRefreshSync({ manifestPath, refresh }) {
  if (typeof refresh !== "function") throw new Error("A manifest refresh function is required");
  const manifestExisted = fs.existsSync(manifestPath);
  const originalManifestBytes = manifestExisted ? fs.readFileSync(manifestPath) : null;

  return (context = { phase: "write" }) => {
    if (context.phase === "rollback") {
      if (originalManifestBytes) {
        atomicWrite(manifestPath, originalManifestBytes);
      } else if (fs.existsSync(manifestPath)) {
        fs.unlinkSync(manifestPath);
      }
    }
    return refresh(context);
  };
}
