import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  BOOK_GRAPH_STORAGE_VERSION,
  MAX_BOOK_GRAPH_SHARD_BYTES,
  decodeBookGraphFile,
  encodeBookGraphFile,
  readBookGraphFileSync,
  referencedBookGraphShardPaths,
  writeBookGraphFileAtomicSync,
  writeBookGraphFileAndRefreshSync,
} from "./book-graph-codec.mjs";
import {
  canonicalNeutralArtifactPathsSync,
  createRollbackSafeManifestRefreshSync,
  initialBookGraphFor,
  readBookGraphBaseOrInitialSync,
} from "./book-graph-source-components.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
      throw new Error(`Refusing to remove unexpected test directory: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pendingEvidence(note) {
  return {
    status: "pending",
    sourceUnitIds: [],
    locator: null,
    captureAudit: null,
    independentReview: null,
    note,
  };
}

function smallFixture(statement = "Every finite example has a deterministic encoding. 🧮") {
  return {
    schemaVersion: "1.0.0",
    phase: "source-dependency-graph",
    identity: {
      bookGraphId: "S0001:complete-source",
      sourceSetRevision: "fixture-revision",
      sourceRecordId: "S0001",
      sourceOrdinal: 1,
      familyId: "F01",
      sourceTitle: "Fixture Mathematics",
      sourceAuthorLine: "Ada Example",
      sourceRawCitation: "Ada Example, Fixture Mathematics.",
      componentId: "complete-source",
      componentLabel: "Complete source",
    },
    exactEdition: null,
    sourceUnits: [
      {
        id: "unit-1",
        ordinal: 1,
        label: "Unit 1",
        locator: "unit 1",
        contentSha256: "1".repeat(64),
      },
      {
        id: "unit-2",
        ordinal: 2,
        label: "Unit 2",
        locator: "unit 2",
        contentSha256: "2".repeat(64),
      },
    ],
    unitInventories: [
      {
        sourceUnitId: "unit-1",
        theoremNodeIds: ["theorem-1"],
        supportNodeIds: ["definition-1"],
        theoremFreeAttestation: false,
        evidence: pendingEvidence("Inventory evidence remains pending."),
      },
      {
        sourceUnitId: "unit-2",
        theoremNodeIds: [],
        supportNodeIds: [],
        theoremFreeAttestation: true,
        evidence: pendingEvidence("A second independent inventory decision."),
      },
    ],
    graph: {
      nodes: [
        {
          id: "definition-1",
          nodeClass: "support",
          kind: "definition",
          sourceLabel: "Definition 1",
          sourceXmlId: "definition-1",
          sourceLocator: "unit 1",
          title: "Deterministic encoding",
          normalizedStatement: "An encoding has one canonical byte representation.",
          sourceTextSha256: "3".repeat(64),
          evidence: pendingEvidence("Definition evidence is deliberately preserved."),
        },
        {
          id: "theorem-1",
          nodeClass: "theorem-like",
          kind: "theorem",
          sourceLabel: "Theorem 1",
          sourceXmlId: "theorem-1",
          sourceLocator: "unit 1",
          title: "Round trip",
          normalizedStatement: statement,
          sourceTextSha256: "4".repeat(64),
          evidence: pendingEvidence("Theorem evidence is deliberately preserved. 🧾"),
        },
      ],
      externalInputs: [{
        id: "external-json",
        kind: "definition",
        label: "JSON",
        normalizedStatement: "JSON supplies the record representation.",
        sourceTextSha256: null,
        sourceCitation: "ECMA-404",
        evidence: pendingEvidence("External-input evidence remains attached."),
      }],
      directDependencies: [{
        id: "dependency-1",
        dependentNodeId: "theorem-1",
        prerequisite: { type: "node", id: "definition-1" },
        role: "definition",
        rationale: "The theorem uses the definition.",
        evidence: pendingEvidence("Dependency evidence remains attached."),
      }],
      proofRoutes: [{
        id: "route-1",
        theoremNodeId: "theorem-1",
        routeKind: "source-proof",
        dependencyIds: ["dependency-1"],
        summary: "Apply the definition.",
        evidence: pendingEvidence("Route evidence remains attached."),
      }],
      references: [{
        id: "reference-1",
        ownerNodeId: "theorem-1",
        basis: "proof-xref",
        ref: "definition-1",
        context: "The proof invokes Definition 1.",
        locator: "unit 1",
        resolution: {
          status: "resolved",
          target: { type: "node", id: "definition-1" },
          directDependencyId: "dependency-1",
          note: "Resolved exactly.",
        },
        evidence: pendingEvidence("Reference evidence remains attached."),
      }],
    },
    extractionState: {
      status: "extracting",
      extractionAudit: null,
      independentReview: null,
      note: "Fixture extraction is in progress.",
    },
    graphState: {
      status: "building",
      graphAudit: null,
      independentReview: null,
      note: "Fixture graph construction is in progress.",
    },
  };
}

function fixtureRegistry() {
  return {
    sourceSetRevision: "fixture-revision",
    records: [{
      id: "S0001",
      ordinal: 1,
      familyId: "F01",
      title: "Fixture Mathematics",
      authorLine: "Ada Example",
      rawCitation: "Ada Example, Fixture Mathematics.",
      requiredEditionComponents: [{
        id: "complete-source",
        label: "Complete source",
      }],
    }],
  };
}

function decodeEncoded(encoded, replacements = new Map()) {
  return decodeBookGraphFile(encoded.index, (relativePath) => (
    replacements.get(relativePath) ?? encoded.shards.get(relativePath)
  ));
}

describe("book-graph v1.1 sharded codec", () => {
  it("round-trips deterministically, preserves order and evidence, and counts UTF-8 bytes", () => {
    const fixture = smallFixture();
    const first = encodeBookGraphFile(fixture, { maxShardBytes: 620 });
    const second = encodeBookGraphFile(fixture, { maxShardBytes: 620 });

    expect(first.index.storageSchemaVersion).toBe(BOOK_GRAPH_STORAGE_VERSION);
    expect(first.index.distribution.class).toBe("review-required");
    expect(first.indexBytes.equals(second.indexBytes)).toBe(true);
    expect([...first.shards.keys()]).toEqual([...second.shards.keys()]);
    for (const [shardPath, bytes] of first.shards) {
      expect(bytes.equals(second.shards.get(shardPath))).toBe(true);
      expect(bytes.length).toBeLessThanOrEqual(620);
      expect(bytes.length).toBe(Buffer.byteLength(bytes.toString("utf8"), "utf8"));
    }
    expect(Object.values(first.index.collections).flat().every((descriptor) => (
      descriptor.schemaVersion === BOOK_GRAPH_STORAGE_VERSION
    ))).toBe(true);

    const decoded = decodeEncoded(first);
    expect(decoded).toEqual(fixture);
    expect(decoded.graph.nodes.map(({ id }) => id)).toEqual(["definition-1", "theorem-1"]);
    expect(decoded.graph.nodes[1].evidence).toEqual(fixture.graph.nodes[1].evidence);
    expect(first.index.logicalContentSha256).toBe(sha256(JSON.stringify(fixture)));
    expect(referencedBookGraphShardPaths(first.index)).toEqual([...first.shards.keys()]);
  });

  it("rejects oversized records before producing a shard", () => {
    expect(() => encodeBookGraphFile(smallFixture("x".repeat(2_000)), { maxShardBytes: 500 }))
      .toThrow(/record.*exceeding/i);
  });

  it("rejects unsafe paths and detects reordered descriptors", () => {
    const encoded = encodeBookGraphFile(smallFixture(), { maxShardBytes: 620 });
    const unsafe = structuredClone(encoded.index);
    unsafe.collections.nodes[0].path = "../escape.jsonl";
    expect(() => decodeBookGraphFile(unsafe, () => Buffer.alloc(0))).toThrow(/unsafe|canonical/i);

    const reordered = structuredClone(encoded.index);
    const descriptors = reordered.collections.nodes;
    expect(descriptors.length).toBeGreaterThan(1);
    [descriptors[0], descriptors[1]] = [descriptors[1], descriptors[0]];
    expect(() => decodeBookGraphFile(reordered, () => Buffer.alloc(0))).toThrow(/path|fingerprint/i);
  });

  it("checks every shard's exact bytes, digest, and record count", () => {
    const encoded = encodeBookGraphFile(smallFixture(), { maxShardBytes: 800 });
    const [shardPath, shardBytes] = encoded.shards.entries().next().value;
    const alteredBytes = Buffer.from(shardBytes);
    alteredBytes[0] ^= 1;
    expect(() => decodeEncoded(encoded, new Map([[shardPath, alteredBytes]]))).toThrow(/fingerprint/i);

    const truncatedBytes = shardBytes.subarray(0, shardBytes.length - 1);
    expect(() => decodeEncoded(encoded, new Map([[shardPath, truncatedBytes]]))).toThrow(/byte length/i);

    const staleCount = structuredClone(encoded.index);
    staleCount.collections.sourceUnits[0].recordCount += 1;
    expect(() => decodeBookGraphFile(staleCount, () => shardBytes)).toThrow(/component fingerprint/i);
  });

  it("reads legacy monoliths and replaces an index only after writing its shards", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-codec-"));
    temporaryDirectories.push(temporaryRoot);
    const componentDirectory = path.join(temporaryRoot, "S0001");
    const indexPath = path.join(componentDirectory, "complete-source.json");
    fs.mkdirSync(componentDirectory, { recursive: true });
    const fixture = smallFixture();
    fs.writeFileSync(indexPath, `${JSON.stringify(fixture)}\n`, "utf8");

    expect(readBookGraphFileSync(indexPath)).toEqual(fixture);
    expect(referencedBookGraphShardPaths(fixture)).toEqual([]);

    const result = writeBookGraphFileAtomicSync(indexPath, fixture, { maxShardBytes: 700 });
    const storedIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    expect(storedIndex.storageSchemaVersion).toBe(BOOK_GRAPH_STORAGE_VERSION);
    expect(result.shardPaths).toEqual(referencedBookGraphShardPaths(storedIndex));
    expect(result.createdPaths.every((createdPath) => fs.statSync(createdPath).isFile())).toBe(true);
    expect(readBookGraphFileSync(indexPath)).toEqual(fixture);
  });

  it("restores the prior index and shards when manifest refresh fails", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-codec-rollback-"));
    temporaryDirectories.push(temporaryRoot);
    const componentDirectory = path.join(temporaryRoot, "S0001");
    const indexPath = path.join(componentDirectory, "complete-source.json");
    fs.mkdirSync(componentDirectory, { recursive: true });
    const fixture = smallFixture();
    fs.writeFileSync(indexPath, `${JSON.stringify(fixture)}\n`, "utf8");
    writeBookGraphFileAtomicSync(indexPath, fixture, { maxShardBytes: 700 });
    const originalIndexBytes = fs.readFileSync(indexPath);
    let refreshCount = 0;

    expect(() => writeBookGraphFileAndRefreshSync(
      indexPath,
      smallFixture("A changed theorem statement."),
      () => {
        refreshCount += 1;
        if (refreshCount === 1) throw new Error("synthetic manifest failure");
      },
      { maxShardBytes: 700 },
    )).toThrow(/synthetic manifest failure/i);

    expect(refreshCount).toBe(2);
    expect(fs.readFileSync(indexPath).equals(originalIndexBytes)).toBe(true);
    expect(readBookGraphFileSync(indexPath)).toEqual(fixture);
  });

  it("restores first-time artifact absence when manifest refresh fails", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-codec-first-write-"));
    temporaryDirectories.push(temporaryRoot);
    const indexPath = path.join(temporaryRoot, "S0001", "complete-source.json");
    let refreshCount = 0;

    expect(() => writeBookGraphFileAndRefreshSync(
      indexPath,
      smallFixture(),
      () => {
        refreshCount += 1;
        if (refreshCount === 1) throw new Error("synthetic first-write manifest failure");
      },
      { maxShardBytes: 700 },
    )).toThrow(/synthetic first-write manifest failure/i);

    expect(refreshCount).toBe(2);
    expect(fs.existsSync(indexPath)).toBe(false);
    const remainingFiles = fs.existsSync(path.dirname(indexPath))
      ? fs.readdirSync(path.dirname(indexPath), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
      : [];
    expect(remainingFiles).toHaveLength(0);
  });

  it("restores the prior root manifest before a failed first-write rollback refresh", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-manifest-rollback-"));
    temporaryDirectories.push(temporaryRoot);
    const indexPath = path.join(temporaryRoot, "S0001", "complete-source.json");
    const manifestPath = path.join(temporaryRoot, "manifest.json");
    const originalManifest = Buffer.from('{"artifactPath":null}\n', "utf8");
    const changedManifest = Buffer.from('{"artifactPath":"S0001/complete-source.json"}\n', "utf8");
    fs.writeFileSync(manifestPath, originalManifest);
    const phases = [];
    const refreshManifest = createRollbackSafeManifestRefreshSync({
      manifestPath,
      refresh: ({ phase }) => {
        phases.push(phase);
        if (phase === "write") {
          fs.writeFileSync(manifestPath, changedManifest);
          throw new Error("synthetic post-manifest failure");
        }
        expect(fs.readFileSync(manifestPath).equals(originalManifest)).toBe(true);
      },
    });

    expect(() => writeBookGraphFileAndRefreshSync(
      indexPath,
      smallFixture(),
      refreshManifest,
      { maxShardBytes: 700 },
    )).toThrow(/synthetic post-manifest failure/i);

    expect(phases).toEqual(["write", "rollback"]);
    expect(fs.existsSync(indexPath)).toBe(false);
    expect(fs.readFileSync(manifestPath).equals(originalManifest)).toBe(true);
  });

  it("synthesizes absent component bases and recognizes only exact canonical neutral artifacts", () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-neutral-artifact-"));
    temporaryDirectories.push(temporaryRoot);
    const registryPath = path.join(temporaryRoot, "source-records.json");
    const indexPath = path.join(temporaryRoot, "S0001", "complete-source.json");
    const registry = fixtureRegistry();
    const neutral = initialBookGraphFor(
      registry,
      registry.records[0],
      registry.records[0].requiredEditionComponents[0],
    );
    fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`, "utf8");

    expect(readBookGraphBaseOrInitialSync({
      indexPath,
      registryPath,
      recordId: "S0001",
      componentId: "complete-source",
    })).toEqual(neutral);

    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, `${JSON.stringify(neutral, null, 2)}\n`, "utf8");
    expect(canonicalNeutralArtifactPathsSync(indexPath, neutral)).toEqual([indexPath]);

    const blocked = structuredClone(neutral);
    blocked.extractionState.status = "blocked";
    blocked.extractionState.note = "The source is unavailable under the current access policy.";
    fs.writeFileSync(indexPath, `${JSON.stringify(blocked, null, 2)}\n`, "utf8");
    expect(canonicalNeutralArtifactPathsSync(indexPath, neutral)).toBeNull();

    const populated = structuredClone(neutral);
    populated.graph.nodes.push(smallFixture().graph.nodes[0]);
    populated.extractionState.status = "extracting";
    populated.graphState.status = "building";
    fs.writeFileSync(indexPath, `${JSON.stringify(populated, null, 2)}\n`, "utf8");
    expect(canonicalNeutralArtifactPathsSync(indexPath, neutral)).toBeNull();

    writeBookGraphFileAtomicSync(indexPath, neutral, {
      distribution: {
        class: "metadata-only",
        note: "A custom distribution decision must be retained.",
      },
    });
    expect(canonicalNeutralArtifactPathsSync(indexPath, neutral)).toBeNull();

    writeBookGraphFileAtomicSync(indexPath, neutral);
    expect(canonicalNeutralArtifactPathsSync(indexPath, neutral)).toEqual([indexPath]);
  });

  it("round-trips the two current populated components without writing", { timeout: 30_000 }, () => {
    for (const relativePath of [
      "data/books/S0060/complete-source.json",
      "data/books/S0262/complete-source.json",
    ]) {
      const file = readBookGraphFileSync(path.join(repositoryRoot, relativePath));
      const encoded = encodeBookGraphFile(file);
      expect([...encoded.shards.values()].every((bytes) => bytes.length <= MAX_BOOK_GRAPH_SHARD_BYTES)).toBe(true);
      const decoded = decodeEncoded(encoded);
      expect(decoded).toEqual(file);
      expect(sha256(JSON.stringify(decoded))).toBe(encoded.index.logicalContentSha256);
      expect(decoded.graph.nodes.length).toBe(file.graph.nodes.length);
      expect(decoded.graph.references.at(-1)?.evidence).toEqual(file.graph.references.at(-1)?.evidence);
    }
  });
});
