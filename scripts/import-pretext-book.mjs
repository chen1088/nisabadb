#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildPretextBookFile } from "./pretext-book-lib.mjs";
import {
  writeBookGraphFileAndRefreshSync,
} from "./book-graph-codec.mjs";
import {
  createRollbackSafeManifestRefreshSync,
  readBookGraphBaseOrInitialSync,
} from "./book-graph-source-components.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bookGraphSyncScript = path.join(repositoryRoot, "scripts", "book-graph-files.mjs");
const sourceRegistryPath = path.join(repositoryRoot, "data", "knowledge", "source-records.json");
const bookGraphManifestPath = path.join(repositoryRoot, "data", "books", "manifest.json");
const allowedOptions = new Set([
  "--source",
  "--record-id",
  "--component-id",
  "--commit",
  "--entry-file",
  "--captured-at",
  "--write",
]);

function usage() {
  return [
    "Usage:",
    "  node scripts/import-pretext-book.mjs --source <checkout> --record-id S0060",
    "    --component-id complete-source --commit <40-hex-commit>",
    "    [--entry-file source/dmoi.ptx] [--captured-at <ISO-8601>] [--write]",
    "",
    "--captured-at is required with --write. Without --write, it defaults to the current time.",
    "A dry run validates and reports the candidate graph without changing files.",
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

function assertSafeEntryFile(entryFile) {
  const normalized = path.posix.normalize(entryFile.replaceAll("\\", "/").replace(/^\.\//u, ""));
  if (normalized.startsWith("../") || path.posix.isAbsolute(normalized) || !normalized.endsWith(".ptx")) {
    throw new Error(`Unsafe PreTeXt entry file: ${entryFile}`);
  }
  return normalized;
}

function githubRepositoryFromRemote(remote) {
  const match = remote.trim().match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?$/iu,
  );
  if (!match) {
    throw new Error(`The checkout origin is not an unambiguous GitHub repository URL: ${remote}`);
  }
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

function report({
  recordId,
  componentId,
  commit,
  capturedAt,
  entryFile,
  sourceRepository,
  write,
  destination,
  stats,
}) {
  const mode = write ? "WROTE" : "DRY RUN";
  process.stdout.write([
    `${mode}: ${recordId}:${componentId}`,
    `Source repository: ${sourceRepository}`,
    `Pinned revision: ${commit}`,
    `PreTeXt entry: ${entryFile}`,
    `Captured at: ${capturedAt}`,
    `Source units: ${stats.sourceUnitCount}`,
    `Inventoried source units: ${stats.unitInventoryCount}`,
    `Theorem-free source units (captured candidate): ${stats.theoremFreeUnitCount}`,
    `Theorem-like nodes: ${stats.theoremCount}`,
    `Support nodes: ${stats.supportCount}`,
    `Candidate proof-xref edges: ${stats.directDependencyCount}`,
    `Candidate proof routes: ${stats.proofRouteCount}`,
    `Statement xrefs retained: ${stats.statementXrefCount}`,
    `Unresolved proof xrefs: ${stats.unresolvedProofXrefCount}`,
    `Theorem-like nodes still dependency-pending: ${stats.pendingTheoremCount}`,
    `Ambiguous inventoried xml:id values: ${stats.ambiguousGraphXmlIdCount}`,
    `Missing active PTX includes: ${stats.missingIncludeCount}`,
    `Artifact SHA-256: ${stats.artifactSha256}`,
    `Unit manifest SHA-256: ${stats.unitManifestSha256}`,
    `${write ? "Updated" : "Would update only"}: ${path.relative(repositoryRoot, destination)}`,
    "Status: candidate extraction only; no mathematical review or graph completeness is claimed.",
    "",
  ].join("\n"));
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
    return candidate;
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

function writeCandidateAndRefreshManifest(destination, candidate) {
  // A clean preflight prevents unrelated corpus-wide artifact changes from
  // being hidden inside a one-component import. The codec updates content-addressed
  // shards and the component index before the generated manifest refresh.
  runBookGraphFiles("--check");
  const refreshManifest = createRollbackSafeManifestRefreshSync({
    manifestPath: bookGraphManifestPath,
    refresh: () => {
      const syncOutput = runBookGraphFiles();
      if (syncOutput) process.stdout.write(syncOutput);
    },
  });
  writeBookGraphFileAndRefreshSync(destination, candidate, refreshManifest);
}

const argumentsMap = parseArguments(process.argv.slice(2));
const checkout = path.resolve(argumentsMap.get("--source"));
const recordId = argumentsMap.get("--record-id");
const componentId = argumentsMap.get("--component-id");
const commit = argumentsMap.get("--commit").toLowerCase();
const entryFile = assertSafeEntryFile(argumentsMap.get("--entry-file") ?? "source/dmoi.ptx");
const write = argumentsMap.get("--write") === true;
const capturedAtArgument = argumentsMap.get("--captured-at");
assertSafeIdentity(recordId, componentId);
if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("--commit must be a full 40-character Git commit");
if (write && !capturedAtArgument) throw new Error("--captured-at is required with --write");
const capturedAtDate = capturedAtArgument ? new Date(capturedAtArgument) : new Date();
if (Number.isNaN(capturedAtDate.getTime())) throw new Error("--captured-at must be a valid ISO-8601 timestamp");
const capturedAt = capturedAtDate.toISOString();
if (!fs.statSync(checkout).isDirectory()) throw new Error(`Source checkout is not a directory: ${checkout}`);

const head = git(checkout, ["rev-parse", "HEAD"]);
if (head !== commit) throw new Error(`Source checkout is at ${head}, expected pinned commit ${commit}`);
const dirtyStatus = git(checkout, ["status", "--porcelain", "--untracked-files=all"]);
if (dirtyStatus) {
  throw new Error("Source checkout is not clean; refusing to bind modified bytes to the pinned Git revision");
}
const sourceRepository = githubRepositoryFromRemote(git(checkout, ["remote", "get-url", "origin"]));
const destination = componentFilePath(recordId, componentId);
const baseFile = readBookGraphBaseOrInitialSync({
  indexPath: destination,
  registryPath: sourceRegistryPath,
  recordId,
  componentId,
});

const built = buildPretextBookFile({
  baseFile,
  checkoutRoot: checkout,
  commit,
  capturedAt,
  sourceRepository,
  entryFile,
});

const candidate = await validateCandidate(built.file);

if (write) {
  writeCandidateAndRefreshManifest(destination, candidate);
}
report({
  recordId,
  componentId,
  commit,
  capturedAt,
  entryFile,
  sourceRepository,
  write,
  destination,
  stats: built.stats,
});
