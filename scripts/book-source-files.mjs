#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  administratorActorIds,
  canonicalPrettyJson,
  expectedSourceComponents,
  importerStateFor,
  proposalSubjectSha256,
  resolutionStateFor,
  sourcePinSha256,
  sourceResolutionManifestSchema,
  validateSourceResolutionRecord,
} from "./book-source-resolution-schema.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repositoryRoot, "data", "knowledge", "source-records.json");
const verificationPolicyPath = path.join(repositoryRoot, "data", "knowledge", "verification-policy.json");
const graphManifestPath = path.join(repositoryRoot, "data", "books", "manifest.json");
const graphRoot = path.join(repositoryRoot, "data", "books");
const resolutionRoot = path.join(repositoryRoot, "data", "book-sources");
const resolutionManifestPath = path.join(resolutionRoot, "manifest.json");

const allowedArguments = new Set(["--check", "--bootstrap-from-graphs"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function atomicWrite(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function resolutionFilePath(relativePath) {
  if (!/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u.test(relativePath)
    || relativePath.includes("\\")
    || path.posix.normalize(relativePath) !== relativePath) {
    throw new Error(`Unsafe book-source resolution path: ${relativePath}`);
  }
  const resolved = path.resolve(resolutionRoot, ...relativePath.split("/"));
  const relative = path.relative(resolutionRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Book-source resolution path escapes its root: ${relativePath}`);
  }
  return resolved;
}

function listResolutionJsonFiles() {
  if (!fs.existsSync(resolutionRoot)) return [];
  const files = [];
  for (const entry of fs.readdirSync(resolutionRoot, { withFileTypes: true })) {
    if (entry.isFile()) {
      if (entry.name !== "manifest.json") throw new Error(`Unexpected book-source file: ${entry.name}`);
      continue;
    }
    if (!entry.isDirectory() || !/^S\d{4}$/u.test(entry.name)) {
      throw new Error(`Unexpected book-source path: ${entry.name}`);
    }
    for (const child of fs.readdirSync(path.join(resolutionRoot, entry.name), { withFileTypes: true })) {
      if (!child.isFile() || !/^[a-z0-9][a-z0-9-]*\.json$/u.test(child.name)) {
        throw new Error(`Unexpected book-source path: ${entry.name}/${child.name}`);
      }
      files.push(`${entry.name}/${child.name}`);
    }
  }
  return files.sort();
}

function expectedComponentMap(expectedComponents) {
  return new Map(expectedComponents.map((component) => [component.bookGraphId, component]));
}

function graphEntriesById(graphManifest, expectedComponents) {
  if (typeof graphManifest?.sourceSetRevision !== "string"
    || !Array.isArray(graphManifest.entries)) {
    throw new Error("Book graph manifest has no entries array");
  }
  if (graphManifest.entries.length !== expectedComponents.length) {
    throw new Error("Book graph manifest does not cover the source component registry");
  }
  const entries = new Map();
  expectedComponents.forEach((expected, index) => {
    const entry = graphManifest.entries[index];
    if (entry?.bookGraphId !== expected.bookGraphId
      || entry.sourceRecordId !== expected.sourceRecordId
      || entry.sourceOrdinal !== expected.sourceOrdinal
      || entry.componentId !== expected.componentId
      || entry.componentLabel !== expected.componentLabel) {
      throw new Error(`${expected.bookGraphId} graph-manifest identity/order is stale`);
    }
    if (entries.has(entry.bookGraphId)) throw new Error(`Duplicate graph-manifest identity: ${entry.bookGraphId}`);
    entries.set(entry.bookGraphId, entry);
  });
  return entries;
}

function loadResolutionRecords({ registry, expectedComponents, administratorIds }) {
  const expectedById = expectedComponentMap(expectedComponents);
  const records = new Map();
  for (const relativePath of listResolutionJsonFiles()) {
    const component = expectedComponents.find(({ canonicalResolutionPath }) => canonicalResolutionPath === relativePath);
    if (!component) throw new Error(`Unexpected book-source resolution record: ${relativePath}`);
    const filePath = resolutionFilePath(relativePath);
    const bytes = fs.readFileSync(filePath, "utf8");
    const raw = JSON.parse(bytes);
    if (canonicalPrettyJson(raw) !== bytes) {
      throw new Error(`${relativePath} is not canonical pretty JSON with a final newline`);
    }
    const record = validateSourceResolutionRecord(raw, {
      expectedBookGraphId: component.bookGraphId,
      sourceSetRevision: registry.sourceSetRevision,
      administratorActorIds: administratorIds,
    });
    if (!expectedById.has(record.bookGraphId) || records.has(record.bookGraphId)) {
      throw new Error(`Duplicate or unknown resolution record: ${record.bookGraphId}`);
    }
    records.set(record.bookGraphId, { record, relativePath });
  }
  return records;
}

function readGraphArtifact(entry) {
  const artifactPath = entry.artifactPath
    ?? `${entry.sourceRecordId}/${entry.componentId}.json`;
  if (typeof artifactPath !== "string"
    || !/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u.test(artifactPath)
    || artifactPath.includes("\\")
    || path.posix.normalize(artifactPath) !== artifactPath) {
    throw new Error(`Unsafe graph artifact path: ${String(artifactPath)}`);
  }
  const filePath = path.join(graphRoot, ...artifactPath.split("/"));
  if (!fs.existsSync(filePath)) return null;
  const raw = readJson(filePath);
  if (raw?.schemaVersion === "1.0.0") return raw;
  if (raw?.storageSchemaVersion !== "1.1.0" || !raw.metadata) {
    throw new Error(`${artifactPath} has an unsupported graph storage index`);
  }
  return {
    identity: raw.metadata.identity,
    exactEdition: raw.metadata.exactEdition,
    extractionState: raw.metadata.extractionState,
    graphState: raw.metadata.graphState,
  };
}

function matchingEditionProposal(record, exactEdition) {
  return record.proposals.filter((proposal) => (
    proposal.kind === "exact-edition" && isDeepStrictEqual(proposal.edition, exactEdition)
  ));
}

export function validateGraphResolutionPair(bookGraphId, graph, record) {
  if (graph.identity?.bookGraphId !== bookGraphId) {
    throw new Error(`${bookGraphId} graph identity is stale`);
  }
  if (!graph.exactEdition) {
    throw new Error(`${bookGraphId} populated graph lacks an exact-edition snapshot`);
  }
  if (!record) throw new Error(`${bookGraphId} populated graph lacks a source-resolution record`);
  const matches = matchingEditionProposal(record, graph.exactEdition);
  if (matches.length !== 1) {
    throw new Error(`${bookGraphId} exact edition must match exactly one resolution proposal`);
  }
  const proposal = matches[0];
  const resolutionState = resolutionStateFor(record);
  if (record.selectedProposalId !== null && record.selectedProposalId !== proposal.id) {
    throw new Error(`${bookGraphId} stored graph does not match its selected source resolution`);
  }
  if ((graph.extractionState?.status === "reviewed" || graph.graphState?.status === "reviewed-complete")
    && (resolutionState !== "verified-exact-edition" || record.selectedProposalId !== proposal.id)) {
    throw new Error(`${bookGraphId} reviewed graph requires its exact edition to be administratively verified`);
  }
  const extractionAudit = graph.extractionState?.extractionAudit;
  const graphAudit = graph.graphState?.graphAudit;
  const assessment = record.importerAssessments.find((candidate) => (
    candidate.proposalId === proposal.id
    && candidate.outcome === "candidate-produced"
    && candidate.sourcePinSha256 === sourcePinSha256(proposal.edition)
    && candidate.extractionArtifactSha256 === extractionAudit?.artifactSha256
    && candidate.graphArtifactSha256 === graphAudit?.artifactSha256
    && candidate.assessedBy === graphAudit?.actorId
    && candidate.assessedAt === graphAudit?.completedAt
  ));
  if (!extractionAudit || !graphAudit || !assessment) {
    throw new Error(`${bookGraphId} importer assessment does not match the stored graph audits`);
  }
  return proposal;
}

function validateGraphResolutionCrossChecks(graphEntries, records) {
  const graphs = new Map();
  for (const [bookGraphId, entry] of graphEntries) {
    const graph = readGraphArtifact(entry);
    if (!graph) continue;
    graphs.set(bookGraphId, graph);
    const record = records.get(bookGraphId)?.record;
    validateGraphResolutionPair(bookGraphId, graph, record);
  }
  return graphs;
}

function validateSelectedDuplicateChains(records, expectedById) {
  for (const { record } of records.values()) {
    if (resolutionStateFor(record) !== "verified-duplicate") continue;
    const visited = new Set([record.bookGraphId]);
    let current = record;
    while (resolutionStateFor(current) === "verified-duplicate") {
      const selected = current.proposals.find(({ id }) => id === current.selectedProposalId);
      if (!selected || selected.kind !== "duplicate-component") {
        throw new Error(`${current.bookGraphId} has an invalid selected duplicate proposal`);
      }
      if (!expectedById.has(selected.targetBookGraphId)) {
        throw new Error(`${current.bookGraphId} duplicate target is outside the registry`);
      }
      if (visited.has(selected.targetBookGraphId)) {
        throw new Error(`Duplicate component cycle includes ${selected.targetBookGraphId}`);
      }
      visited.add(selected.targetBookGraphId);
      const target = records.get(selected.targetBookGraphId)?.record;
      if (!target) throw new Error(`${current.bookGraphId} duplicate target has no verified resolution record`);
      current = target;
    }
    if (resolutionStateFor(current) !== "verified-exact-edition") {
      throw new Error(`${record.bookGraphId} duplicate chain does not end at a verified exact edition`);
    }
  }
}

export function buildSourceResolutionManifest({
  registry,
  verificationPolicy,
  graphManifest,
  records,
}) {
  const expectedComponents = expectedSourceComponents(registry);
  const expectedById = expectedComponentMap(expectedComponents);
  const administratorIds = administratorActorIds(verificationPolicy);
  if (graphManifest.sourceSetRevision !== registry.sourceSetRevision) {
    throw new Error("Book graph manifest targets a stale source-set revision");
  }
  const graphEntries = graphEntriesById(graphManifest, expectedComponents);
  for (const [bookGraphId, stored] of records) {
    const component = expectedById.get(bookGraphId);
    if (!component || stored.relativePath !== component.canonicalResolutionPath) {
      throw new Error(`${bookGraphId} has a non-canonical or unknown resolution path`);
    }
    validateSourceResolutionRecord(stored.record, {
      expectedBookGraphId: bookGraphId,
      sourceSetRevision: registry.sourceSetRevision,
      administratorActorIds: administratorIds,
    });
  }
  validateSelectedDuplicateChains(records, expectedById);
  validateGraphResolutionCrossChecks(graphEntries, records);

  const domainOrder = ["identity", "acquisition", "license", "importer"];
  const entries = expectedComponents.map((component) => {
    const stored = records.get(component.bookGraphId);
    const record = stored?.record;
    const graphEntry = graphEntries.get(component.bookGraphId);
    const openBlockerDomains = record
      ? domainOrder.filter((domain) => record.blockers.some((blocker) => (
        blocker.state === "open" && blocker.domain === domain
      )))
      : [];
    return {
      bookGraphId: component.bookGraphId,
      sourceRecordId: component.sourceRecordId,
      sourceOrdinal: component.sourceOrdinal,
      componentId: component.componentId,
      componentLabel: component.componentLabel,
      resolutionPath: stored?.relativePath ?? null,
      resolutionState: record ? resolutionStateFor(record) : "unresolved",
      selectedProposalId: record?.selectedProposalId ?? null,
      leadCount: record?.leads.length ?? 0,
      proposalCount: record?.proposals.length ?? 0,
      openBlockerDomains,
      importerState: record ? importerStateFor(record) : "not-assessed",
      graphArtifactPath: graphEntry?.artifactPath ?? null,
    };
  });
  const manifest = {
    schemaVersion: "1.0.0",
    sourceSetRevision: registry.sourceSetRevision,
    sourceRecordCount: registry.records.length,
    componentCount: entries.length,
    resolutionRecordCount: records.size,
    summary: {
      unresolvedComponentCount: entries.filter(({ resolutionState }) => resolutionState === "unresolved").length,
      candidateExactEditionCount: entries.filter(({ resolutionState }) => resolutionState === "candidate-exact-edition").length,
      verifiedExactEditionCount: entries.filter(({ resolutionState }) => resolutionState === "verified-exact-edition").length,
      candidateDuplicateCount: entries.filter(({ resolutionState }) => resolutionState === "candidate-duplicate").length,
      verifiedDuplicateCount: entries.filter(({ resolutionState }) => resolutionState === "verified-duplicate").length,
      blockedComponentCount: entries.filter(({ openBlockerDomains }) => openBlockerDomains.length > 0).length,
      importerCandidateProducedCount: entries.filter(({ importerState }) => importerState === "candidate-produced").length,
    },
    entries,
  };
  return sourceResolutionManifestSchema.parse(manifest);
}

function bootstrapRecordForGraph(graph) {
  if (!graph?.identity?.bookGraphId || !graph.exactEdition) {
    throw new Error("Cannot bootstrap source resolution without a graph identity and exact edition");
  }
  const extractionAudit = graph.extractionState?.extractionAudit;
  const graphAudit = graph.graphState?.graphAudit;
  if (!extractionAudit || !graphAudit) {
    throw new Error(`${graph.identity.bookGraphId} lacks extraction/graph audits for exact bootstrap`);
  }
  const proposal = {
    kind: "exact-edition",
    id: graph.exactEdition.editionId,
    edition: structuredClone(graph.exactEdition),
    licenseAssessment: {
      status: "candidate",
      distributionClass: "review-required",
      administrativeReview: null,
      note: "License and derived-data distribution remain candidates until independent administrative review.",
    },
    proposalAudit: {
      actorId: extractionAudit.actorId,
      proposedAt: extractionAudit.completedAt,
      subjectSha256: "",
      note: graph.extractionState.note,
    },
    administrativeReview: null,
  };
  proposal.proposalAudit.subjectSha256 = proposalSubjectSha256(proposal, {
    sourceSetRevision: graph.identity.sourceSetRevision,
    bookGraphId: graph.identity.bookGraphId,
  });
  const assessmentId = `assessment-${proposal.id}-${graphAudit.artifactSha256.slice(0, 12)}`;
  const blockers = [];
  const hasRepositoryLicenseConflict = /(?:while the repository(?:-level)? (?:LICENSE|COPYING|license file) states|contains multiple distinct license markers)/iu
    .test(graph.exactEdition.licenseNote);
  const expectedConflict = new Set([
    "S0060:complete-source",
    "S0164:complete-source",
  ]).has(graph.identity.bookGraphId);
  if (expectedConflict && !hasRepositoryLicenseConflict) {
    throw new Error(`${graph.identity.bookGraphId} no longer carries its expected source/repository license conflict`);
  }
  if (hasRepositoryLicenseConflict) {
    blockers.push({
      id: "license-conflict",
      proposalId: proposal.id,
      domain: "license",
      code: "license-conflict",
      state: "open",
      opened: {
        actorId: extractionAudit.actorId,
        recordedAt: extractionAudit.completedAt,
        evidenceLocator: graph.exactEdition.stableLocator,
        evidenceSha256: graph.exactEdition.artifactSha256,
        note: graph.exactEdition.licenseNote,
      },
      resolution: null,
    });
  }
  return {
    schemaVersion: "1.0.0",
    sourceSetRevision: graph.identity.sourceSetRevision,
    bookGraphId: graph.identity.bookGraphId,
    leads: [],
    proposals: [proposal],
    selectedProposalId: null,
    blockers,
    importerAssessments: [{
      id: assessmentId,
      proposalId: proposal.id,
      adapterId: graphAudit.actorId,
      outcome: "candidate-produced",
      sourcePinSha256: sourcePinSha256(proposal.edition),
      extractionArtifactSha256: extractionAudit.artifactSha256,
      graphArtifactSha256: graphAudit.artifactSha256,
      assessedBy: graphAudit.actorId,
      assessedAt: graphAudit.completedAt,
      note: "The recorded importer produced this ignored local candidate graph; no independent review or completeness is claimed.",
    }],
  };
}

function loadContext() {
  const registry = readJson(registryPath);
  const verificationPolicy = readJson(verificationPolicyPath);
  const graphManifest = readJson(graphManifestPath);
  const expectedComponents = expectedSourceComponents(registry);
  const administratorIds = administratorActorIds(verificationPolicy);
  const records = loadResolutionRecords({ registry, expectedComponents, administratorIds });
  return { registry, verificationPolicy, graphManifest, expectedComponents, administratorIds, records };
}

function generatedManifest(context) {
  return buildSourceResolutionManifest(context);
}

function syncManifest(context) {
  const manifest = generatedManifest(context);
  const originalBytes = fs.existsSync(resolutionManifestPath) ? fs.readFileSync(resolutionManifestPath) : null;
  try {
    atomicWrite(resolutionManifestPath, canonicalPrettyJson(manifest));
    const actual = fs.readFileSync(resolutionManifestPath, "utf8");
    if (actual !== canonicalPrettyJson(generatedManifest(loadContext()))) {
      throw new Error("Generated book-source manifest failed its post-write check");
    }
  } catch (error) {
    if (originalBytes) atomicWrite(resolutionManifestPath, originalBytes);
    else if (fs.existsSync(resolutionManifestPath)) fs.unlinkSync(resolutionManifestPath);
    throw error;
  }
  return manifest;
}

function checkManifest(context) {
  if (!fs.existsSync(resolutionManifestPath)) {
    throw new Error("Missing data/book-sources/manifest.json; run the book-source sync command");
  }
  const expectedBytes = canonicalPrettyJson(generatedManifest(context));
  const actualBytes = fs.readFileSync(resolutionManifestPath, "utf8");
  if (actualBytes !== expectedBytes) {
    throw new Error("data/book-sources/manifest.json is stale; run the book-source sync command");
  }
  return JSON.parse(actualBytes);
}

function bootstrapFromGraphs() {
  const initialContext = loadContext();
  const graphEntries = graphEntriesById(initialContext.graphManifest, initialContext.expectedComponents);
  const pending = [];
  for (const component of initialContext.expectedComponents) {
    const graphEntry = graphEntries.get(component.bookGraphId);
    if (!graphEntry || initialContext.records.has(component.bookGraphId)) continue;
    const graph = readGraphArtifact(graphEntry);
    if (!graph) continue;
    const record = bootstrapRecordForGraph(graph);
    validateSourceResolutionRecord(record, {
      expectedBookGraphId: component.bookGraphId,
      sourceSetRevision: initialContext.registry.sourceSetRevision,
      administratorActorIds: initialContext.administratorIds,
    });
    pending.push({
      relativePath: component.canonicalResolutionPath,
      filePath: resolutionFilePath(component.canonicalResolutionPath),
      bytes: canonicalPrettyJson(record),
    });
  }

  const originalManifestBytes = fs.existsSync(resolutionManifestPath)
    ? fs.readFileSync(resolutionManifestPath)
    : null;
  const created = [];
  try {
    for (const item of pending) {
      if (fs.existsSync(item.filePath)) {
        throw new Error(`Refusing to overwrite authored source-resolution record: ${item.relativePath}`);
      }
      atomicWrite(item.filePath, item.bytes);
      created.push(item.filePath);
    }
    const manifest = syncManifest(loadContext());
    return { createdCount: created.length, manifest };
  } catch (error) {
    for (const filePath of created.reverse()) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (originalManifestBytes) atomicWrite(resolutionManifestPath, originalManifestBytes);
    else if (fs.existsSync(resolutionManifestPath)) fs.unlinkSync(resolutionManifestPath);
    throw error;
  }
}

function report(prefix, manifest, createdCount = null) {
  const created = createdCount === null ? "" : `, ${createdCount} sparse records created`;
  process.stdout.write(
    `${prefix}: ${manifest.componentCount} component identities, `
      + `${manifest.resolutionRecordCount} sparse records, `
      + `${manifest.summary.candidateExactEditionCount} candidate exact editions, `
      + `${manifest.summary.verifiedExactEditionCount} verified${created}.\n`,
  );
}

export function runBookSourceFilesCli(commandArguments = process.argv.slice(2)) {
  for (const argument of commandArguments) {
    if (!allowedArguments.has(argument)) throw new Error(`Unknown option: ${argument}`);
  }
  if (new Set(commandArguments).size !== commandArguments.length) {
    throw new Error("Duplicate book-source option");
  }
  if (commandArguments.includes("--check") && commandArguments.includes("--bootstrap-from-graphs")) {
    throw new Error("--check and --bootstrap-from-graphs are mutually exclusive");
  }

  if (commandArguments.includes("--bootstrap-from-graphs")) {
    const result = bootstrapFromGraphs();
    report("Book-source bootstrap complete", result.manifest, result.createdCount);
    return result.manifest;
  }
  if (commandArguments.includes("--check")) {
    const manifest = checkManifest(loadContext());
    report("Book-source resolution data valid", manifest);
    return manifest;
  }
  const manifest = syncManifest(loadContext());
  report("Book-source resolution manifest synchronized", manifest);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBookSourceFilesCli();
}
