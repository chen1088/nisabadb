import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const BOOK_GRAPH_STORAGE_VERSION = "1.1.0";
export const BOOK_GRAPH_LOGICAL_VERSION = "1.0.0";
export const MAX_BOOK_GRAPH_SHARD_BYTES = 5 * 1024 * 1024;

const sha256Pattern = /^[a-f0-9]{64}$/u;
const stableIdPattern = /^[a-z0-9][a-z0-9-]*$/u;
const sourceRecordIdPattern = /^S\d{4}$/u;
const distributionClasses = new Set([
  "open-derived-data",
  "metadata-only",
  "restricted-derived-data",
  "review-required",
]);

const defaultDistribution = {
  class: "review-required",
  note: "Distribution of this derived graph requires an explicit source-license review.",
};

const collectionDefinitions = [
  { key: "sourceUnits", directory: "source-units" },
  { key: "unitInventories", directory: "unit-inventories" },
  { key: "nodes", directory: "nodes" },
  { key: "externalInputs", directory: "external-inputs" },
  { key: "directDependencies", directory: "direct-dependencies" },
  { key: "proofRoutes", directory: "proof-routes" },
  { key: "references", directory: "references" },
];

const collectionKeys = new Set(collectionDefinitions.map(({ key }) => key));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compactJsonBytes(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Book-graph data is not JSON-serializable");
  return Buffer.from(serialized, "utf8");
}

function prettyJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a JSON object`);
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !sha256Pattern.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

function assertComponentIdentity(identity) {
  assertPlainObject(identity, "Book-graph identity");
  if (typeof identity.componentId !== "string" || !stableIdPattern.test(identity.componentId)) {
    throw new Error("Book-graph component ID is unsafe");
  }
  if (typeof identity.sourceRecordId !== "string" || !sourceRecordIdPattern.test(identity.sourceRecordId)) {
    throw new Error("Book-graph source-record ID is unsafe");
  }
}

function recordsFor(file) {
  assertPlainObject(file, "Book graph");
  assertPlainObject(file.identity, "Book-graph identity");
  assertPlainObject(file.graph, "Book graph payload");
  const records = {
    sourceUnits: file.sourceUnits,
    unitInventories: file.unitInventories,
    nodes: file.graph.nodes,
    externalInputs: file.graph.externalInputs,
    directDependencies: file.graph.directDependencies,
    proofRoutes: file.graph.proofRoutes,
    references: file.graph.references,
  };
  for (const { key } of collectionDefinitions) {
    if (!Array.isArray(records[key])) throw new Error(`Book-graph collection ${key} must be an array`);
  }
  return records;
}

function metadataFor(file) {
  return {
    phase: file.phase,
    identity: file.identity,
    exactEdition: file.exactEdition,
    extractionState: file.extractionState,
    graphState: file.graphState,
  };
}

function logicalFileFrom(metadata, records) {
  return {
    schemaVersion: BOOK_GRAPH_LOGICAL_VERSION,
    phase: metadata.phase,
    identity: metadata.identity,
    exactEdition: metadata.exactEdition,
    sourceUnits: records.sourceUnits,
    unitInventories: records.unitInventories,
    graph: {
      nodes: records.nodes,
      externalInputs: records.externalInputs,
      directDependencies: records.directDependencies,
      proofRoutes: records.proofRoutes,
      references: records.references,
    },
    extractionState: metadata.extractionState,
    graphState: metadata.graphState,
  };
}

function componentDigestSubject(index) {
  return {
    storageSchemaVersion: index.storageSchemaVersion,
    logicalSchemaVersion: index.logicalSchemaVersion,
    logicalContentSha256: index.logicalContentSha256,
    distribution: index.distribution,
    metadata: index.metadata,
    collections: index.collections,
  };
}

function componentDigest(index) {
  return sha256(compactJsonBytes(componentDigestSubject(index)));
}

function shardRelativePath(componentId, directory, ordinal, digest) {
  return `${componentId}/${directory}/${String(ordinal).padStart(6, "0")}-${digest}.jsonl`;
}

function expectedShardPath(index, definition, ordinal, digest) {
  return shardRelativePath(index.metadata.identity.componentId, definition.directory, ordinal, digest);
}

function assertSafeShardPath(relativePath, expectedPath) {
  if (typeof relativePath !== "string"
    || relativePath.includes("\\")
    || relativePath.startsWith("/")
    || relativePath.includes("\0")
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath.split("/").includes("..")
    || relativePath !== expectedPath) {
    throw new Error(`Unsafe or non-canonical book-graph shard path: ${String(relativePath)}`);
  }
}

function makeShard(records, maxShardBytes, componentId, definition, ordinal) {
  const lines = records.map((record) => {
    const json = JSON.stringify(record);
    if (json === undefined) throw new Error(`${definition.key} contains a non-JSON record`);
    const line = Buffer.from(`${json}\n`, "utf8");
    if (line.length > maxShardBytes) {
      throw new Error(
        `${definition.key} contains a ${line.length}-byte record, exceeding the ${maxShardBytes}-byte shard limit`,
      );
    }
    return line;
  });
  const bytes = Buffer.concat(lines);
  const digest = sha256(bytes);
  const relativePath = shardRelativePath(componentId, definition.directory, ordinal, digest);
  return {
    descriptor: {
      schemaVersion: BOOK_GRAPH_STORAGE_VERSION,
      path: relativePath,
      recordCount: records.length,
      byteLength: bytes.length,
      sha256: digest,
    },
    bytes,
  };
}

function encodeCollection(records, maxShardBytes, componentId, definition) {
  const encoded = [];
  let pending = [];
  let pendingBytes = 0;

  const flush = () => {
    if (pending.length === 0) return;
    encoded.push(makeShard(pending, maxShardBytes, componentId, definition, encoded.length));
    pending = [];
    pendingBytes = 0;
  };

  for (const record of records) {
    const json = JSON.stringify(record);
    if (json === undefined) throw new Error(`${definition.key} contains a non-JSON record`);
    const lineBytes = Buffer.byteLength(`${json}\n`, "utf8");
    if (lineBytes > maxShardBytes) {
      throw new Error(
        `${definition.key} contains a ${lineBytes}-byte record, exceeding the ${maxShardBytes}-byte shard limit`,
      );
    }
    if (pending.length > 0 && pendingBytes + lineBytes > maxShardBytes) flush();
    pending.push(record);
    pendingBytes += lineBytes;
  }
  flush();
  return encoded;
}

function assertIndexShape(index) {
  assertPlainObject(index, "Book-graph storage index");
  assertExactKeys(index, [
    "storageSchemaVersion",
    "logicalSchemaVersion",
    "logicalContentSha256",
    "componentSha256",
    "distribution",
    "metadata",
    "collections",
  ], "Book-graph storage index");
  if (index.storageSchemaVersion !== BOOK_GRAPH_STORAGE_VERSION) {
    throw new Error(`Unsupported book-graph storage version: ${String(index.storageSchemaVersion)}`);
  }
  if (index.logicalSchemaVersion !== BOOK_GRAPH_LOGICAL_VERSION) {
    throw new Error(`Unsupported book-graph logical version: ${String(index.logicalSchemaVersion)}`);
  }
  assertSha256(index.logicalContentSha256, "Logical-content fingerprint");
  assertSha256(index.componentSha256, "Component fingerprint");
  assertPlainObject(index.distribution, "Book-graph distribution policy");
  assertExactKeys(index.distribution, ["class", "note"], "Book-graph distribution policy");
  if (!distributionClasses.has(index.distribution.class)) {
    throw new Error(`Unsupported book-graph distribution class: ${String(index.distribution.class)}`);
  }
  if (typeof index.distribution.note !== "string" || index.distribution.note.trim().length === 0) {
    throw new Error("Book-graph distribution policy requires a note");
  }
  assertPlainObject(index.metadata, "Book-graph metadata");
  assertExactKeys(index.metadata, [
    "phase",
    "identity",
    "exactEdition",
    "extractionState",
    "graphState",
  ], "Book-graph metadata");
  if (index.metadata.phase !== "source-dependency-graph") {
    throw new Error(`Unsupported book-graph phase: ${String(index.metadata.phase)}`);
  }
  assertComponentIdentity(index.metadata.identity);
  assertPlainObject(index.collections, "Book-graph collections");
  assertExactKeys(index.collections, collectionKeys, "Book-graph collections");

  const seenPaths = new Set();
  for (const definition of collectionDefinitions) {
    const descriptors = index.collections[definition.key];
    if (!Array.isArray(descriptors)) throw new Error(`${definition.key} shard descriptors must be an array`);
    descriptors.forEach((descriptor, ordinal) => {
      assertPlainObject(descriptor, `${definition.key} shard ${ordinal}`);
      assertExactKeys(
        descriptor,
        ["schemaVersion", "path", "recordCount", "byteLength", "sha256"],
        `${definition.key} shard ${ordinal}`,
      );
      if (descriptor.schemaVersion !== BOOK_GRAPH_STORAGE_VERSION) {
        throw new Error(`${definition.key} shard ${ordinal} has an unsupported schema version`);
      }
      assertPositiveInteger(descriptor.recordCount, `${definition.key} shard ${ordinal} record count`);
      assertPositiveInteger(descriptor.byteLength, `${definition.key} shard ${ordinal} byte length`);
      if (descriptor.byteLength > MAX_BOOK_GRAPH_SHARD_BYTES) {
        throw new Error(`${definition.key} shard ${ordinal} exceeds the 5 MiB limit`);
      }
      assertSha256(descriptor.sha256, `${definition.key} shard ${ordinal} fingerprint`);
      assertSafeShardPath(
        descriptor.path,
        expectedShardPath(index, definition, ordinal, descriptor.sha256),
      );
      if (seenPaths.has(descriptor.path)) throw new Error(`Duplicate book-graph shard path: ${descriptor.path}`);
      seenPaths.add(descriptor.path);
    });
  }

  const expectedComponentSha256 = componentDigest(index);
  if (index.componentSha256 !== expectedComponentSha256) {
    throw new Error("Book-graph component fingerprint is stale");
  }
}

function parseShardRecords(bytes, descriptor, label) {
  if (!Buffer.isBuffer(bytes)) {
    if (typeof bytes !== "string" && !(bytes instanceof Uint8Array)) {
      throw new Error(`${label} reader did not return bytes or text`);
    }
    bytes = Buffer.from(bytes);
  }
  if (bytes.length !== descriptor.byteLength) {
    throw new Error(`${label} byte length is ${bytes.length}, expected ${descriptor.byteLength}`);
  }
  if (bytes.length > MAX_BOOK_GRAPH_SHARD_BYTES) throw new Error(`${label} exceeds the 5 MiB limit`);
  if (sha256(bytes) !== descriptor.sha256) throw new Error(`${label} fingerprint does not match its bytes`);

  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error(`${label} is not valid UTF-8`);
  if (!text.endsWith("\n") || text.includes("\r")) throw new Error(`${label} is not canonical JSONL`);
  const lines = text.slice(0, -1).split("\n");
  if (lines.length !== descriptor.recordCount || lines.some((line) => line.length === 0)) {
    throw new Error(`${label} record count does not match its descriptor`);
  }
  return lines.map((line, recordIndex) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} record ${recordIndex} is invalid JSON`, { cause: error });
    }
    if (JSON.stringify(record) !== line) throw new Error(`${label} record ${recordIndex} is not canonical JSON`);
    return record;
  });
}

export function encodeBookGraphFile(
  file,
  {
    maxShardBytes = MAX_BOOK_GRAPH_SHARD_BYTES,
    distribution = defaultDistribution,
  } = {},
) {
  if (file?.schemaVersion !== BOOK_GRAPH_LOGICAL_VERSION) {
    throw new Error(`Expected logical book-graph version ${BOOK_GRAPH_LOGICAL_VERSION}`);
  }
  if (file.phase !== "source-dependency-graph") throw new Error(`Unsupported book-graph phase: ${String(file.phase)}`);
  assertPositiveInteger(maxShardBytes, "Maximum shard size");
  if (maxShardBytes > MAX_BOOK_GRAPH_SHARD_BYTES) {
    throw new Error(`Maximum shard size cannot exceed ${MAX_BOOK_GRAPH_SHARD_BYTES} bytes`);
  }
  assertComponentIdentity(file.identity);
  assertPlainObject(distribution, "Book-graph distribution policy");
  if (!distributionClasses.has(distribution.class)
    || typeof distribution.note !== "string"
    || distribution.note.trim().length === 0) {
    throw new Error("Book-graph distribution policy is invalid");
  }
  const records = recordsFor(file);
  const metadata = metadataFor(file);
  const normalizedFile = logicalFileFrom(metadata, records);
  const collections = Object.fromEntries(collectionDefinitions.map(({ key }) => [key, []]));
  const shards = new Map();

  for (const definition of collectionDefinitions) {
    const encoded = encodeCollection(records[definition.key], maxShardBytes, file.identity.componentId, definition);
    collections[definition.key] = encoded.map(({ descriptor }) => descriptor);
    for (const { descriptor, bytes } of encoded) {
      if (shards.has(descriptor.path)) throw new Error(`Duplicate encoded shard path: ${descriptor.path}`);
      shards.set(descriptor.path, bytes);
    }
  }

  const index = {
    storageSchemaVersion: BOOK_GRAPH_STORAGE_VERSION,
    logicalSchemaVersion: BOOK_GRAPH_LOGICAL_VERSION,
    logicalContentSha256: sha256(compactJsonBytes(normalizedFile)),
    componentSha256: "",
    distribution: structuredClone(distribution),
    metadata,
    collections,
  };
  index.componentSha256 = componentDigest(index);
  return { index, indexBytes: prettyJsonBytes(index), shards };
}

export function decodeBookGraphFile(index, readShard) {
  if (typeof readShard !== "function") throw new Error("A book-graph shard reader is required");
  assertIndexShape(index);
  const records = Object.fromEntries(collectionDefinitions.map(({ key }) => [key, []]));

  for (const definition of collectionDefinitions) {
    index.collections[definition.key].forEach((descriptor, ordinal) => {
      const label = `${definition.key} shard ${ordinal}`;
      const shardRecords = parseShardRecords(readShard(descriptor.path), descriptor, label);
      records[definition.key].push(...shardRecords);
    });
  }

  const file = logicalFileFrom(index.metadata, records);
  const actualLogicalSha256 = sha256(compactJsonBytes(file));
  if (actualLogicalSha256 !== index.logicalContentSha256) {
    throw new Error("Book-graph logical-content fingerprint is stale");
  }
  return file;
}

export function referencedBookGraphShardPaths(index) {
  if (index?.schemaVersion === BOOK_GRAPH_LOGICAL_VERSION) return [];
  assertIndexShape(index);
  return collectionDefinitions.flatMap(({ key }) => index.collections[key].map(({ path: shardPath }) => shardPath));
}

function parsedJsonFile(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath}`, { cause: error });
  }
  return parsed;
}

function assertIndexLocation(indexPath, index) {
  const expectedFilename = `${index.metadata.identity.componentId}.json`;
  if (path.basename(indexPath) !== expectedFilename) {
    throw new Error(`Book-graph index filename must be ${expectedFilename}`);
  }
  if (path.basename(path.dirname(indexPath)) !== index.metadata.identity.sourceRecordId) {
    throw new Error(`Book-graph index must be inside ${index.metadata.identity.sourceRecordId}`);
  }
}

function resolveShardPath(indexPath, relativePath) {
  const root = path.resolve(path.dirname(indexPath));
  const resolved = path.resolve(root, ...relativePath.split("/"));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Book-graph shard escapes its component directory: ${relativePath}`);
  }
  return resolved;
}

export function resolveBookGraphShardPathSync(indexPath, relativePath) {
  return resolveShardPath(path.resolve(indexPath), relativePath);
}

export function readBookGraphFileSync(indexPath) {
  const absoluteIndexPath = path.resolve(indexPath);
  const raw = parsedJsonFile(absoluteIndexPath, "Book-graph component");
  if (raw?.schemaVersion === BOOK_GRAPH_LOGICAL_VERSION) return raw;
  assertIndexShape(raw);
  assertIndexLocation(absoluteIndexPath, raw);
  return decodeBookGraphFile(raw, (relativePath) => (
    fs.readFileSync(resolveShardPath(absoluteIndexPath, relativePath))
  ));
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

export function writeBookGraphFileAtomicSync(indexPath, file, options = {}) {
  const absoluteIndexPath = path.resolve(indexPath);
  const encoded = encodeBookGraphFile(file, options);
  assertIndexLocation(absoluteIndexPath, encoded.index);
  fs.mkdirSync(path.dirname(absoluteIndexPath), { recursive: true });
  const createdPaths = [];

  try {
    for (const [relativePath, bytes] of encoded.shards) {
      const shardPath = resolveShardPath(absoluteIndexPath, relativePath);
      fs.mkdirSync(path.dirname(shardPath), { recursive: true });
      if (fs.existsSync(shardPath)) {
        if (!fs.readFileSync(shardPath).equals(bytes)) {
          throw new Error(`Existing content-addressed shard has different bytes: ${relativePath}`);
        }
      } else {
        atomicWrite(shardPath, bytes);
        createdPaths.push(shardPath);
      }
    }
    atomicWrite(absoluteIndexPath, encoded.indexBytes);
  } catch (error) {
    for (const createdPath of createdPaths.reverse()) {
      if (fs.existsSync(createdPath)) fs.unlinkSync(createdPath);
    }
    throw error;
  }

  return {
    index: encoded.index,
    componentSha256: encoded.index.componentSha256,
    logicalContentSha256: encoded.index.logicalContentSha256,
    shardPaths: [...encoded.shards.keys()],
    createdPaths,
  };
}

export function writeBookGraphFileAndRefreshSync(
  indexPath,
  file,
  refreshManifest,
  options = {},
) {
  if (typeof refreshManifest !== "function") {
    throw new Error("A manifest refresh callback is required for a book-graph update");
  }
  const absoluteIndexPath = path.resolve(indexPath);
  const indexExisted = fs.existsSync(absoluteIndexPath);
  const originalIndexBytes = indexExisted ? fs.readFileSync(absoluteIndexPath) : null;
  const originalIndex = originalIndexBytes
    ? JSON.parse(originalIndexBytes.toString("utf8"))
    : null;
  const originalShardBytes = new Map(originalIndex
    ? referencedBookGraphShardPaths(originalIndex).map((relativePath) => {
      const shardPath = resolveShardPath(absoluteIndexPath, relativePath);
      return [shardPath, fs.readFileSync(shardPath)];
    })
    : []);
  let result;

  try {
    result = writeBookGraphFileAtomicSync(absoluteIndexPath, file, options);
    const nextShardPaths = new Set(result.shardPaths.map((relativePath) => (
      resolveShardPath(absoluteIndexPath, relativePath)
    )));
    for (const shardPath of originalShardBytes.keys()) {
      if (!nextShardPaths.has(shardPath) && fs.existsSync(shardPath)) fs.unlinkSync(shardPath);
    }
    refreshManifest({ phase: "write" });
    return result;
  } catch (error) {
    if (originalIndexBytes) {
      atomicWrite(absoluteIndexPath, originalIndexBytes);
    } else if (fs.existsSync(absoluteIndexPath)) {
      fs.unlinkSync(absoluteIndexPath);
    }
    for (const [shardPath, bytes] of originalShardBytes) {
      fs.mkdirSync(path.dirname(shardPath), { recursive: true });
      if (!fs.existsSync(shardPath) || !fs.readFileSync(shardPath).equals(bytes)) {
        atomicWrite(shardPath, bytes);
      }
    }
    for (const createdPath of result?.createdPaths ?? []) {
      if (!originalShardBytes.has(createdPath) && fs.existsSync(createdPath)) fs.unlinkSync(createdPath);
    }
    try {
      refreshManifest({ phase: "rollback", artifactPreviouslyExisted: indexExisted });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Book-graph update failed and its manifest rollback also failed",
        { cause: rollbackError },
      );
    }
    throw error;
  }
}
