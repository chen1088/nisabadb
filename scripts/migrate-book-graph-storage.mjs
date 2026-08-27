#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  decodeBookGraphFile,
  encodeBookGraphFile,
  readBookGraphFileSync,
  writeBookGraphFileAtomicSync,
} from "./book-graph-codec.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const booksRoot = path.join(repositoryRoot, "data", "books");
const bookGraphSyncScript = path.join(repositoryRoot, "scripts", "book-graph-files.mjs");
const defaultComponents = [
  "S0060/complete-source.json",
  "S0262/complete-source.json",
];
const componentPathPattern = /^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u;

function usage() {
  return [
    "Usage:",
    "  node scripts/migrate-book-graph-storage.mjs [--write] [S####/component.json ...]",
    "",
    "Without component paths, the S0060 and S0262 pilots are checked or migrated.",
    "Without --write, the command performs an in-memory parity check only.",
  ].join("\n");
}

function parseArguments(arguments_) {
  let write = false;
  const components = [];
  for (const argument of arguments_) {
    if (argument === "--write") {
      if (write) throw new Error(`Duplicate --write option\n${usage()}`);
      write = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}\n${usage()}`);
    } else {
      const normalized = argument.replaceAll("\\", "/").replace(/^data\/books\//u, "");
      if (!componentPathPattern.test(normalized) || path.posix.normalize(normalized) !== normalized) {
        throw new Error(`Unsafe component path: ${argument}`);
      }
      if (components.includes(normalized)) throw new Error(`Duplicate component path: ${normalized}`);
      components.push(normalized);
    }
  }
  return { write, components: components.length ? components : defaultComponents };
}

function componentPath(relativePath) {
  const absolute = path.resolve(booksRoot, ...relativePath.split("/"));
  const relative = path.relative(booksRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Component path escapes data/books: ${relativePath}`);
  }
  return absolute;
}

function atomicWrite(filePath, bytes) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.rollback-${process.pid}-${Date.now()}`,
  );
  try {
    fs.writeFileSync(temporaryPath, bytes);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function runBookGraphFiles(...arguments_) {
  return execFileSync(process.execPath, [bookGraphSyncScript, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function distributionFor(file) {
  const edition = file.exactEdition;
  const sourcePolicy = edition
    ? `${edition.accessKind}${edition.licenseSpdx ? ` / ${edition.licenseSpdx}` : " / no SPDX identifier"}`
    : "no exact edition";
  return {
    class: "review-required",
    note: `Conservative default pending administrative distribution review (${sourcePolicy}).`,
  };
}

async function loadValidator() {
  const server = await createServer({
    root: repositoryRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  const schema = await server.ssrLoadModule("/src/data/book-graph-schema.ts");
  return {
    validate: schema.validateBookGraphFile,
    close: () => server.close(),
  };
}

const { write, components } = parseArguments(process.argv.slice(2));
runBookGraphFiles("--check");

const validator = await loadValidator();
const plans = [];
try {
  for (const relativePath of components) {
    const absolutePath = componentPath(relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Missing component: ${relativePath}`);
    const originalIndexBytes = fs.readFileSync(absolutePath);
    const logicalFile = readBookGraphFileSync(absolutePath);
    validator.validate(logicalFile);
    const encoded = encodeBookGraphFile(logicalFile, {
      distribution: distributionFor(logicalFile),
    });
    const decoded = decodeBookGraphFile(encoded.index, (shardPath) => {
      const shard = encoded.shards.get(shardPath);
      if (!shard) throw new Error(`Encoder omitted its declared shard: ${shardPath}`);
      return shard;
    });
    validator.validate(decoded);
    if (!isDeepStrictEqual(decoded, logicalFile)) {
      throw new Error(`${relativePath} failed exact logical round-trip parity`);
    }
    plans.push({
      relativePath,
      absolutePath,
      originalIndexBytes,
      logicalFile,
      encoded,
      createdPaths: [],
    });
  }
} finally {
  await validator.close();
}

if (write) {
  try {
    for (const plan of plans) {
      const result = writeBookGraphFileAtomicSync(plan.absolutePath, plan.logicalFile, {
        distribution: distributionFor(plan.logicalFile),
      });
      plan.createdPaths = result.createdPaths;
      const stored = readBookGraphFileSync(plan.absolutePath);
      if (!isDeepStrictEqual(stored, plan.logicalFile)) {
        throw new Error(`${plan.relativePath} changed logical data after writing`);
      }
    }
    const output = runBookGraphFiles();
    if (output) process.stdout.write(output);
    runBookGraphFiles("--check");
  } catch (error) {
    for (const plan of [...plans].reverse()) {
      atomicWrite(plan.absolutePath, plan.originalIndexBytes);
      for (const createdPath of [...plan.createdPaths].reverse()) {
        if (fs.existsSync(createdPath)) fs.unlinkSync(createdPath);
      }
    }
    try {
      runBookGraphFiles();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Book-graph migration failed and its manifest rollback also failed",
        { cause: rollbackError },
      );
    }
    throw error;
  }
}

for (const plan of plans) {
  const shardBytes = [...plan.encoded.shards.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  process.stdout.write([
    `${write ? "MIGRATED" : "PARITY OK"}: ${plan.relativePath}`,
    `Logical SHA-256: ${plan.encoded.index.logicalContentSha256}`,
    `Component SHA-256: ${plan.encoded.index.componentSha256}`,
    `Shards: ${plan.encoded.shards.size}`,
    `Shard bytes: ${shardBytes}`,
    "",
  ].join("\n"));
}
