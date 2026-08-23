#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildPressbooksBookFile } from "./pressbooks-book-lib.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bookGraphSyncScript = path.join(repositoryRoot, "scripts", "book-graph-files.mjs");
const allowedOptions = new Set([
  "--source",
  "--source-url",
  "--artifact-sha256",
  "--record-id",
  "--component-id",
  "--publisher",
  "--captured-at",
  "--write",
]);

function usage() {
  return [
    "Usage:",
    "  node scripts/import-pressbooks-book.mjs --source <book.xml>",
    "    --source-url <official-wxr-download-url> --artifact-sha256 <64-hex>",
    "    --record-id S0002",
    "    --component-id complete-source [--publisher <name>]",
    "    [--captured-at <ISO-8601>] [--write]",
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
  for (const required of [
    "--source",
    "--source-url",
    "--artifact-sha256",
    "--record-id",
    "--component-id",
  ]) {
    if (!values.has(required)) throw new Error(`Missing required option ${required}\n${usage()}`);
  }
  return values;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertSafeIdentity(recordId, componentId) {
  if (!/^S\d{4}$/u.test(recordId)) throw new Error(`Unsafe source record ID: ${recordId}`);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(componentId)) {
    throw new Error(`Unsafe source component ID: ${componentId}`);
  }
}

function canonicalSourceUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Pressbooks source URL: ${value}`);
  }
  if (url.protocol !== "https:") throw new Error("Pressbooks source URL must use HTTPS");
  return url.toString();
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
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}`,
  );
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
    const syncOutput = runBookGraphFiles();
    if (syncOutput) process.stdout.write(syncOutput);
  } catch (error) {
    atomicWrite(destination, originalText);
    try {
      runBookGraphFiles();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Import failed and the manifest could not be restored after rolling back the book JSON",
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

function report({ built, recordId, componentId, sourcePath, sourceUrl, capturedAt, write, destination }) {
  const { stats } = built;
  process.stdout.write([
    `${write ? "WROTE" : "DRY RUN"}: ${recordId}:${componentId}`,
    `WXR artifact: ${sourcePath}`,
    `Official source: ${sourceUrl}`,
    `Captured at: ${capturedAt}`,
    `Source units: ${stats.sourceUnitCount}`,
    `Inventoried source units: ${stats.unitInventoryCount}`,
    `Source units with no explicit result marker found by this candidate scan: ${stats.theoremFreeUnitCount}`,
    `Theorem-like nodes: ${stats.theoremCount}`,
    `Support nodes: ${stats.supportCount}`,
    `Candidate direct dependencies: ${stats.directDependencyCount}`,
    `Candidate proof routes: ${stats.proofRouteCount}`,
    `Source references: ${stats.referenceCount}`,
    `Unresolved source references: ${stats.unresolvedReferenceCount}`,
    `Theorem-like nodes still dependency-pending: ${stats.pendingTheoremCount}`,
    `Artifact SHA-256: ${stats.artifactSha256}`,
    `Unit manifest SHA-256: ${stats.unitManifestSha256}`,
    `${write ? "Updated" : "Would update only"}: ${path.relative(repositoryRoot, destination)}`,
    "Status: deterministic candidate extraction only; no mathematical review or graph completeness is claimed.",
    "",
  ].join("\n"));
}

const argumentsMap = parseArguments(process.argv.slice(2));
const sourcePath = path.resolve(argumentsMap.get("--source"));
const sourceUrl = canonicalSourceUrl(argumentsMap.get("--source-url"));
const expectedArtifactSha256 = argumentsMap.get("--artifact-sha256").toLowerCase();
const recordId = argumentsMap.get("--record-id");
const componentId = argumentsMap.get("--component-id");
const publisher = argumentsMap.get("--publisher") ?? null;
const write = argumentsMap.get("--write") === true;
const capturedAtArgument = argumentsMap.get("--captured-at");
assertSafeIdentity(recordId, componentId);
if (!/^[a-f0-9]{64}$/u.test(expectedArtifactSha256)) {
  throw new Error("--artifact-sha256 must be a lowercase or uppercase 64-character hexadecimal digest");
}
if (write && !capturedAtArgument) throw new Error("--captured-at is required with --write");
const capturedAtDate = capturedAtArgument ? new Date(capturedAtArgument) : new Date();
if (Number.isNaN(capturedAtDate.getTime())) throw new Error("--captured-at must be a valid ISO-8601 timestamp");
const capturedAt = capturedAtDate.toISOString();
if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
  throw new Error(`Pressbooks source is not a regular file: ${sourcePath}`);
}
if (fs.statSync(sourcePath).size > 100 * 1024 * 1024) {
  throw new Error("Pressbooks source exceeds the 100 MiB importer safety limit");
}
const xmlSource = fs.readFileSync(sourcePath, "utf8");
if (!/<rss\b[\s\S]*xmlns:wp=/u.test(xmlSource) || !/<channel>/u.test(xmlSource)) {
  throw new Error("The source does not look like a WordPress/Pressbooks WXR export");
}

const destination = componentFilePath(recordId, componentId);
if (!fs.existsSync(destination)) {
  throw new Error(`Missing component file ${path.relative(repositoryRoot, destination)}; synchronize the 717 book files first`);
}
const baseFile = JSON.parse(fs.readFileSync(destination, "utf8"));
if (baseFile.identity?.sourceRecordId !== recordId || baseFile.identity?.componentId !== componentId) {
  throw new Error("The destination component identity does not match the requested source record and component");
}

const built = buildPressbooksBookFile({
  baseFile,
  xmlSource,
  sourceUrl,
  capturedAt,
  publisher,
  expectedArtifactSha256,
});
if (built.stats.artifactSha256 !== expectedArtifactSha256) {
  throw new Error(
    `Pressbooks artifact SHA-256 is ${built.stats.artifactSha256}, expected ${expectedArtifactSha256}`,
  );
}
await validateCandidate(built.file);

if (write) writeCandidateAndRefreshManifest(destination, canonicalJson(built.file));
report({ built, recordId, componentId, sourcePath, sourceUrl, capturedAt, write, destination });
