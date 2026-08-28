#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildOpenLogicBookFile } from "./open-logic-book-lib.mjs";
import {
  writeBookGraphFileAndRefreshSync,
} from "./book-graph-codec.mjs";
import {
  createRollbackSafeManifestRefreshSync,
  readBookGraphBaseOrInitialSync,
} from "./book-graph-source-components.mjs";
import { assertPrivateCandidateDestinationSync } from "./book-graph-publication-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bookGraphSyncScript = path.join(repositoryRoot, "scripts", "book-graph-files.mjs");
const bookSourceSyncScript = path.join(repositoryRoot, "scripts", "book-source-files.mjs");
const sourceRegistryPath = path.join(repositoryRoot, "data", "knowledge", "source-records.json");
const bookGraphManifestPath = path.join(repositoryRoot, "data", "books", "manifest.json");
const officialSourceRepository = "https://github.com/OpenLogicProject/OpenLogic";
const officialEntryFile = "open-logic-complete.tex";
const expectedRecordId = "S0321";
const expectedComponentId = "complete-source";
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
    "  node scripts/import-open-logic-book.mjs --source <clean-checkout>",
    "    --record-id S0321 --component-id complete-source --commit <40-hex-commit>",
    "    [--captured-at <ISO-8601>] [--write]",
    "",
    "--captured-at is required with --write. Without --write, it defaults to the current time.",
    `The importer reads the official ${officialEntryFile} build from a clean checkout.`,
    "A dry run validates and reports the candidate graph without changing files.",
  ].join("\n");
}

export function parseOpenLogicImporterArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!allowedOptions.has(option)) throw new Error(`Unknown option: ${option}\n${usage()}`);
    if (option === "--write") {
      if (values.has(option)) throw new Error(`Duplicate option: ${option}`);
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

function git(checkout, arguments_) {
  return execFileSync("git", ["-C", checkout, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function assertSafeIdentity(recordId, componentId) {
  if (!/^S\d{4}$/u.test(recordId)) throw new Error(`Unsafe source record ID: ${recordId}`);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(componentId)) {
    throw new Error(`Unsafe source component ID: ${componentId}`);
  }
  if (recordId !== expectedRecordId || componentId !== expectedComponentId) {
    throw new Error(
      `The Open Logic importer is bound to ${expectedRecordId}:${expectedComponentId}, `
        + `not ${recordId}:${componentId}`,
    );
  }
}

function githubRepositoryFromRemote(remote) {
  const match = remote.trim().match(
    /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?$/iu,
  );
  if (!match) throw new Error(`The checkout origin is not an unambiguous GitHub URL: ${remote}`);
  return `https://github.com/${match[1]}`;
}

function assertOfficialSourceLayout(checkout) {
  const entryPath = path.join(checkout, officialEntryFile);
  for (const relativeFile of [
    officialEntryFile,
    "open-logic-config.sty",
    "open-logic-complete-config.sty",
    "open-logic-envs.sty",
    "LICENSE.md",
  ]) {
    const sourcePath = path.join(checkout, relativeFile);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new Error(`Open Logic control file is missing: ${sourcePath}`);
    }
  }
  for (const directory of ["content", "include", "sty"]) {
    const directoryPath = path.join(checkout, directory);
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      throw new Error(`Open Logic source directory is missing: ${directoryPath}`);
    }
  }
  const entrySource = fs.readFileSync(entryPath, "utf8");
  if (!/\\olimport\s*\[content\]\s*\{content\}/u.test(entrySource)
    || !/\\input\s*\{\\olpath\/sty\/open-logic\.sty\}/u.test(entrySource)) {
    throw new Error(`${officialEntryFile} does not look like the official complete-build entry file`);
  }
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
    return candidate;
  } finally {
    await server.close();
  }
}

function runNodeScript(scriptPath, ...arguments_) {
  return execFileSync(process.execPath, [scriptPath, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function writeCandidateAndRefreshLedgers(destination, candidate) {
  assertPrivateCandidateDestinationSync(repositoryRoot, destination);
  runNodeScript(bookGraphSyncScript, "--check");
  runNodeScript(bookSourceSyncScript, "--check");

  let graphSyncOutput = "";
  let sourceSyncOutput = "";
  const refreshManifests = createRollbackSafeManifestRefreshSync({
    manifestPath: bookGraphManifestPath,
    refresh: ({ phase }) => {
      graphSyncOutput = runNodeScript(bookGraphSyncScript);
      sourceSyncOutput = phase === "write"
        ? runNodeScript(bookSourceSyncScript, "--bootstrap-from-graphs")
        : runNodeScript(bookSourceSyncScript);
    },
  });
  writeBookGraphFileAndRefreshSync(destination, candidate, refreshManifests);
  if (graphSyncOutput) process.stdout.write(graphSyncOutput);
  if (sourceSyncOutput) process.stdout.write(sourceSyncOutput);
}

function report({ built, recordId, componentId, commit, capturedAt, sourceRepository, write, destination }) {
  const { stats } = built;
  const statisticLines = [
    ["Active source-import instances", stats.sourceUnitCount],
    ["Unique source paths", stats.sourcePathCount],
    ["Deliberate duplicate-context imports", stats.duplicateImportInstanceCount],
    ["Inventoried source-import instances", stats.unitInventoryCount],
    ["Theorem-free import instances (captured candidate)", stats.theoremFreeUnitCount],
    ["Theorem-like nodes", stats.theoremCount],
    ["Support nodes", stats.supportCount],
    ["Raw source-artifact nodes", stats.sourceArtifactCount],
    ["Candidate direct dependencies", stats.directDependencyCount],
    ["Candidate proof routes", stats.proofRouteCount],
    ["Source references", stats.referenceCount],
    ["Unresolved source references", stats.unresolvedReferenceCount],
    ["Unresolved proof references", stats.unresolvedProofReferenceCount],
    ["Theorem-like nodes still dependency-pending", stats.pendingTheoremCount],
    ["Missing active source imports", stats.missingImportCount],
    ["Unassociated proof environments", stats.unassociatedProofCount],
    ["Ambiguous active labels", stats.ambiguousLabelCount],
    ["Source-boundary manifest SHA-256", stats.sourceBoundarySha256],
    ["Extraction artifact SHA-256", stats.extractionArtifactSha256],
    ["Graph artifact SHA-256", stats.graphArtifactSha256],
    ["Artifact SHA-256", stats.artifactSha256],
    ["Unit manifest SHA-256", stats.unitManifestSha256],
  ].filter(([, value]) => value !== undefined);
  process.stdout.write([
    `${write ? "WROTE" : "DRY RUN"}: ${recordId}:${componentId}`,
    `Source repository: ${sourceRepository}`,
    `Pinned revision: ${commit}`,
    `LaTeX entry: ${officialEntryFile}`,
    `Captured at: ${capturedAt}`,
    ...statisticLines.map(([label, value]) => `${label}: ${value}`),
    `${write ? "Updated" : "Would update only"}: ${path.relative(repositoryRoot, destination)}`,
    write
      ? "Source-resolution record and generated manifests were refreshed transactionally."
      : "Source-resolution records and generated manifests were not changed.",
    "Status: deterministic candidate extraction only; no mathematical review or graph completeness is claimed.",
    "",
  ].join("\n"));
}

export async function runOpenLogicBookImporter(argv = process.argv.slice(2)) {
  const argumentsMap = parseOpenLogicImporterArguments(argv);
  const checkout = path.resolve(argumentsMap.get("--source"));
  const recordId = argumentsMap.get("--record-id");
  const componentId = argumentsMap.get("--component-id");
  const commit = argumentsMap.get("--commit").toLowerCase();
  const write = argumentsMap.get("--write") === true;
  const capturedAtArgument = argumentsMap.get("--captured-at");

  assertSafeIdentity(recordId, componentId);
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error("--commit must be a full 40-character Git commit");
  }
  if (write && !capturedAtArgument) throw new Error("--captured-at is required with --write");
  const capturedAtDate = capturedAtArgument ? new Date(capturedAtArgument) : new Date();
  if (Number.isNaN(capturedAtDate.getTime())) {
    throw new Error("--captured-at must be a valid ISO-8601 timestamp");
  }
  const capturedAt = capturedAtDate.toISOString();
  if (!fs.existsSync(checkout) || !fs.statSync(checkout).isDirectory()) {
    throw new Error(`Source checkout is not a directory: ${checkout}`);
  }

  const head = git(checkout, ["rev-parse", "HEAD"]);
  if (head !== commit) throw new Error(`Source checkout is at ${head}, expected pinned commit ${commit}`);
  const dirtyStatus = git(checkout, [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ]);
  if (dirtyStatus) {
    throw new Error("Source checkout is not clean; refusing to bind modified bytes to the pinned revision");
  }
  const sourceRepository = githubRepositoryFromRemote(git(checkout, ["remote", "get-url", "origin"]));
  if (sourceRepository.toLowerCase() !== officialSourceRepository.toLowerCase()) {
    throw new Error(`Expected the official Open Logic repository, got ${sourceRepository}`);
  }
  assertOfficialSourceLayout(checkout);

  const destination = componentFilePath(recordId, componentId);
  const baseFile = readBookGraphBaseOrInitialSync({
    indexPath: destination,
    registryPath: sourceRegistryPath,
    recordId,
    componentId,
  });
  const built = buildOpenLogicBookFile({
    baseFile,
    checkoutRoot: checkout,
    commit,
    capturedAt,
    sourceRepository: officialSourceRepository,
  });
  const candidate = await validateCandidate(built.file);
  if (write) writeCandidateAndRefreshLedgers(destination, candidate);
  report({
    built,
    recordId,
    componentId,
    commit,
    capturedAt,
    sourceRepository: officialSourceRepository,
    write,
    destination,
  });
  return built;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runOpenLogicBookImporter();
}
