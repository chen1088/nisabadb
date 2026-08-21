import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cacheFileNameForUrl,
  createCacheEnvelope,
  eligibleQueueItems,
  integrateOpenAlexNeighborhood,
  normalizeOpenAlexId,
  outgoingFetchOptions,
  recordQueueFailure,
} from "./citation-lib.mjs";

const SNAPSHOT_PATH = resolve("data/citation-neighborhood.json");
const CACHE_DIRECTORY = resolve("data/citations/cache");
const DEFAULT_MAX_ITEMS = 1;

function usage() {
  return [
    "Usage: node scripts/ingest-citations.mjs [--live] [--max-items N]",
    "",
    "Without --live, reports the safe dry-run configuration and does not read or write the snapshot or cache.",
    "--max-items caps work done by one invocation; it is not a graph-depth limit.",
  ].join("\n");
}

function parseArguments(argv) {
  let live = false;
  let maxItems = DEFAULT_MAX_ITEMS;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--live") {
      live = true;
    } else if (argument === "--help" || argument === "-h") {
      return { help: true, live, maxItems };
    } else if (argument === "--max-items") {
      maxItems = Number(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith("--max-items=")) {
      maxItems = Number(argument.slice("--max-items=".length));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isSafeInteger(maxItems) || maxItems < 1) {
    throw new Error("--max-items must be a positive integer");
  }
  return { help: false, live, maxItems };
}

async function atomicWriteJson(path, value) {
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function readCachedEnvelope(url) {
  const path = resolve(CACHE_DIRECTORY, cacheFileNameForUrl(url));
  try {
    const envelope = JSON.parse(await readFile(path, "utf8"));
    if (envelope.url !== url || typeof envelope.retrievedAt !== "string" || !("body" in envelope)) {
      throw new Error(`Malformed cache envelope: ${path}`);
    }
    return envelope;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function fetchJsonWithCache(url, { refresh = false } = {}) {
  if (!refresh) {
    const cached = await readCachedEnvelope(url);
    if (cached) return cached;
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "NisabaDB citation ingestor (https://github.com/chen1088/nisabadb)",
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAlex request failed with HTTP ${response.status}: ${url}`);
  }
  const body = await response.json();
  const envelope = createCacheEnvelope(url, new Date().toISOString(), body);
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  await atomicWriteJson(resolve(CACHE_DIRECTORY, cacheFileNameForUrl(url)), envelope);
  return envelope;
}

function openAlexWorkUrl(openAlexId) {
  return `https://api.openalex.org/works/${openAlexId}`;
}

function openAlexCollectionUrl(filter, cursor, perPage) {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("filter", filter);
  url.searchParams.set("per-page", String(perPage));
  if (cursor) url.searchParams.set("cursor", cursor);
  return url.toString();
}

function asProviderRecords(envelope) {
  const results = envelope.body?.results;
  if (!Array.isArray(results)) throw new Error(`OpenAlex collection response has no results array: ${envelope.url}`);
  return results.map((work) => ({
    work,
    url: envelope.url,
    retrievedAt: envelope.retrievedAt,
  }));
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function fetchOutgoing(seedEnvelope, { refresh = false } = {}) {
  const referencedIds = [...new Set(
    (seedEnvelope.body?.referenced_works ?? []).map(normalizeOpenAlexId).filter(Boolean),
  )];
  const records = [];
  for (const batch of chunks(referencedIds, 50)) {
    const url = openAlexCollectionUrl(`openalex_id:${batch.join("|")}`, undefined, 50);
    records.push(...asProviderRecords(await fetchJsonWithCache(url, { refresh })));
  }
  return records;
}

async function fetchIncoming(openAlexId) {
  const records = [];
  const seenCursors = new Set();
  let cursor = "*";
  while (cursor) {
    if (seenCursors.has(cursor)) throw new Error(`OpenAlex returned a repeated pagination cursor for ${openAlexId}`);
    seenCursors.add(cursor);
    const url = openAlexCollectionUrl(`cites:${openAlexId}`, cursor, 200);
    const envelope = await fetchJsonWithCache(url);
    records.push(...asProviderRecords(envelope));
    cursor = envelope.body?.meta?.next_cursor ?? undefined;
  }
  return records;
}

function assertSnapshotShape(snapshot) {
  if (!Array.isArray(snapshot?.papers) ||
      !Array.isArray(snapshot?.citationEdges) ||
      !Array.isArray(snapshot?.ingestionQueue)) {
    throw new Error("Citation snapshot must contain papers, citationEdges, and ingestionQueue arrays");
  }
}

async function processQueueItem(snapshot, item) {
  const paper = snapshot.papers.find((candidate) => candidate.id === item.paperId);
  const openAlexId = normalizeOpenAlexId(paper?.identifiers?.openAlex);
  if (!paper || !openAlexId) throw new Error(`Eligible queue item ${item.paperId} lost its OpenAlex identity`);
  const seedUrl = openAlexWorkUrl(openAlexId);
  const seedEnvelope = await fetchJsonWithCache(seedUrl);
  const seed = { work: seedEnvelope.body, url: seedUrl, retrievedAt: seedEnvelope.retrievedAt };
  const [outgoing, incoming] = await Promise.all([
    fetchOutgoing(seedEnvelope, outgoingFetchOptions(item)),
    fetchIncoming(openAlexId),
  ]);
  return integrateOpenAlexNeighborhood(snapshot, {
    paperId: item.paperId,
    seed,
    outgoing,
    incoming,
    completedAt: new Date().toISOString(),
  });
}

async function runLive(maxItems) {
  let snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  assertSnapshotShape(snapshot);
  const eligible = eligibleQueueItems(snapshot).slice(0, maxItems);
  console.log(`Live ingestion selected ${eligible.length} of ${eligibleQueueItems(snapshot).length} eligible queue items.`);
  console.log(`The ${maxItems}-item invocation cap does not limit recursive graph depth.`);
  let failures = 0;

  for (const item of eligible) {
    try {
      const result = await processQueueItem(snapshot, item);
      snapshot = result.snapshot;
      await atomicWriteJson(SNAPSHOT_PATH, snapshot);
      const resolution = result.stats.unresolvedOutgoingIds.length
        ? ` Neighborhood remains queued: ${result.stats.unresolvedOutgoingIds.length} referenced OpenAlex ID(s) were not returned.`
        : " Direct OpenAlex neighborhood complete.";
      console.log(
        `Processed ${item.paperId}: +${result.stats.papersAdded} papers, +${result.stats.edgesAdded} edges, +${result.stats.queueItemsAdded} queue items.${resolution}`,
      );
    } catch (error) {
      failures += 1;
      snapshot = recordQueueFailure(snapshot, item.paperId, new Date().toISOString(), error);
      await atomicWriteJson(SNAPSHOT_PATH, snapshot);
      console.error(`Failed ${item.paperId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures) process.exitCode = 1;
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
  } else if (!options.live) {
    console.log("Citation ingestion dry run (safe default)");
    console.log(`Would process at most ${options.maxItems} eligible queue item(s) without imposing a graph-depth cap.`);
    console.log("The citation snapshot and provider cache were not read or changed. Re-run with --live to ingest.");
  } else {
    await runLive(options.maxItems);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exitCode = 1;
}
