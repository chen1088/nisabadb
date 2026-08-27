#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildStacksBookFile } from "./stacks-book-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bookGraphSyncScript = path.join(repositoryRoot, "scripts", "book-graph-files.mjs");
const allowedOptions = new Set([
  "--source",
  "--record-id",
  "--component-id",
  "--commit",
  "--captured-at",
  "--write",
]);

function usage() {
  return [
    "Usage:",
    "  node scripts/import-stacks-book.mjs --source <clean-checkout> --record-id S0262",
    "    --component-id complete-source --commit <40-hex-commit>",
    "    [--captured-at <ISO-8601>] [--write]",
    "",
    "--captured-at is required with --write. Without --write, it defaults to the current time.",
    "The importer includes formal definitions, situations, lemmas, propositions, and theorems.",
    "It deliberately excludes examples, exercises, and all remarks except an exact-label allowlist of source-audited theorem-level claims.",
  ].join("\n");
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!allowedOptions.has(option)) throw new Error(`Unknown option: ${option}\n${usage()}`);
    if (option === "--write") {
      values.set(option, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value\n${usage()}`);
    if (values.has(option)) throw new Error(`Duplicate option: ${option}`);
    values.set(option, value);
    index += 1;
  }
  for (const required of ["--source", "--record-id", "--component-id", "--commit"]) {
    if (!values.has(required)) throw new Error(`Missing required option ${required}\n${usage()}`);
  }
  return values;
}

function serializedBookJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function git(checkout, args) {
  return execFileSync("git", ["-C", checkout, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function assertSafeIdentity(recordId, componentId) {
  if (!/^S\d{4}$/u.test(recordId)) throw new Error(`Unsafe source record ID: ${recordId}`);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(componentId)) {
    throw new Error(`Unsafe source component ID: ${componentId}`);
  }
}

function githubRepositoryFromRemote(remote) {
  const match = remote.trim().match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?$/iu,
  );
  if (!match) throw new Error(`The checkout origin is not an unambiguous GitHub URL: ${remote}`);
  return `https://github.com/${match[1]}`;
}

function componentFilePath(recordId, componentId) {
  assertSafeIdentity(recordId, componentId);
  const destination = path.join(repositoryRoot, "data", "books", recordId, `${componentId}.json`);
  const booksRoot = path.join(repositoryRoot, "data", "books");
  const relative = path.relative(booksRoot, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing unsafe destination: ${destination}`);
  }
  return destination;
}

async function validateCandidate(candidate) {
  const server = await createServer({
    root: repositoryRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  try {
    const schema = await server.ssrLoadModule("/src/data/book-graph-schema.ts");
    schema.validateBookGraphFile(candidate);
  } finally {
    await server.close();
  }
}

function runBookGraphFiles(...arguments_) {
  return execFileSync(process.execPath, [bookGraphSyncScript, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function atomicWrite(filePath, contents) {
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp-${process.pid}`);
  try {
    fs.writeFileSync(temporaryPath, contents, { encoding: "utf8" });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function writeCandidateAndRefreshManifest(destination, candidateText) {
  runBookGraphFiles("--check");
  const originalText = fs.readFileSync(destination, "utf8");
  try {
    atomicWrite(destination, candidateText);
    const output = runBookGraphFiles();
    if (output) process.stdout.write(output);
  } catch (error) {
    atomicWrite(destination, originalText);
    try {
      runBookGraphFiles();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Stacks import failed and the generated manifest could not be restored after rollback",
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

function report({ recordId, componentId, commit, capturedAt, sourceRepository, write, destination, stats }) {
  process.stdout.write([
    `${write ? "WROTE" : "DRY RUN"}: ${recordId}:${componentId}`,
    `Source repository: ${sourceRepository}`,
    `Pinned revision: ${commit}`,
    `Captured at: ${capturedAt}`,
    `Source chapters: ${stats.sourceUnitCount}`,
    `Theorem-like nodes: ${stats.theoremCount}`,
    `Support nodes: ${stats.supportCount}`,
    `Formal node kinds: ${JSON.stringify(stats.kindCounts)}`,
    `Candidate proof-reference edges: ${stats.directDependencyCount}`,
    `  Explicit proof-xref edges: ${stats.explicitProofXrefDependencyCount}`,
    `  Source-audited semantic edges: ${stats.semanticDependencyCount} (${stats.namedResultDependencyCount} named-result / ${stats.curatedClaimDependencyCount} curated-claim / ${stats.externalCitationDependencyCount} external-citation / ${stats.deicticDependencyCount} deictic / ${stats.bundledRemarkDependencyCount} bundled-remark / ${stats.sectionDelegationDependencyCount} section-delegation)`,
    `Typed external inputs: ${stats.externalInputCount}`,
    `Candidate proof routes: ${stats.proofRouteCount}`,
    `Source-reference records: ${stats.referenceCount}`,
    `Unresolved source-reference records: ${stats.unresolvedReferenceCount}`,
    `Unresolved tagged proof owner-target records: ${stats.unresolvedTaggedProofReferenceCount}`,
    `Unique tagged proof targets outside the strict graph: ${stats.uniqueUnresolvedTaggedProofTargetCount}`,
    `Unresolved bibliographic proof citations: ${stats.proofCitationReferenceCount} records / ${stats.proofCitationOccurrenceCount} occurrences / ${stats.distinctProofCitationKeyCount} keys / ${stats.proofCitationOwnerCount} theorem owners`,
    `Theorem-like nodes still dependency-pending: ${stats.pendingTheoremCount}`,
    `Excluded environments: ${JSON.stringify(stats.excludedEnvironmentCounts)}`,
    `Artifact SHA-256: ${stats.artifactSha256}`,
    `${write ? "Updated" : "Would update only"}: ${path.relative(repositoryRoot, destination)}`,
    "Status: deterministic candidate extraction; no independent mathematical review is claimed.",
    "",
  ].join("\n"));
}

const argumentsMap = parseArguments(process.argv.slice(2));
const checkout = path.resolve(argumentsMap.get("--source"));
const recordId = argumentsMap.get("--record-id");
const componentId = argumentsMap.get("--component-id");
const commit = argumentsMap.get("--commit").toLowerCase();
const write = argumentsMap.get("--write") === true;
const capturedAtArgument = argumentsMap.get("--captured-at");
assertSafeIdentity(recordId, componentId);
if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("--commit must be a full 40-character Git commit");
if (write && !capturedAtArgument) throw new Error("--captured-at is required with --write");
const capturedAtDate = capturedAtArgument ? new Date(capturedAtArgument) : new Date();
if (Number.isNaN(capturedAtDate.getTime())) throw new Error("--captured-at must be valid ISO-8601");
const capturedAt = capturedAtDate.toISOString();
if (!fs.statSync(checkout).isDirectory()) throw new Error(`Source checkout is not a directory: ${checkout}`);

const head = git(checkout, ["rev-parse", "HEAD"]);
if (head !== commit) throw new Error(`Source checkout is at ${head}, expected ${commit}`);
if (git(checkout, ["status", "--porcelain", "--untracked-files=all"])) {
  throw new Error("Source checkout is not clean; refusing to bind modified bytes to the pinned revision");
}
const sourceRepository = githubRepositoryFromRemote(git(checkout, ["remote", "get-url", "origin"]));
if (sourceRepository !== "https://github.com/stacks/stacks-project") {
  throw new Error(`Expected the official Stacks repository, got ${sourceRepository}`);
}
const destination = componentFilePath(recordId, componentId);
if (!fs.existsSync(destination)) throw new Error(`Missing component file: ${destination}`);
const baseFile = JSON.parse(fs.readFileSync(destination, "utf8"));
if (baseFile.identity?.sourceRecordId !== recordId || baseFile.identity?.componentId !== componentId) {
  throw new Error("The destination component identity does not match the requested record/component");
}

const built = buildStacksBookFile({
  baseFile,
  checkoutRoot: checkout,
  commit,
  capturedAt,
  sourceRepository,
});
await validateCandidate(built.file);
if (write) writeCandidateAndRefreshManifest(destination, serializedBookJson(built.file));
report({
  recordId,
  componentId,
  commit,
  capturedAt,
  sourceRepository,
  write,
  destination,
  stats: built.stats,
});
