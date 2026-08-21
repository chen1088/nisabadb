import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mergeAuditIntoSnapshot } from "./citation-snapshot-lib.mjs";

const AUDIT_PATH = resolve("data/citations/direct-neighborhood-audit.json");
const SNAPSHOT_PATH = resolve("data/citation-neighborhood.json");
const reset = process.argv.slice(2).includes("--reset");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--reset");
if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}. Use --reset only for an intentional baseline reset.`);
}

const audit = JSON.parse(await readFile(AUDIT_PATH, "utf8"));
let existingSnapshot;
if (!reset) {
  try {
    existingSnapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const snapshot = mergeAuditIntoSnapshot(audit, existingSnapshot);
const temporaryPath = `${SNAPSHOT_PATH}.${process.pid}.${Date.now()}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
await rename(temporaryPath, SNAPSHOT_PATH);

const blocked = snapshot.ingestionQueue.filter((item) => item.state === "blocked").length;
console.log(
  `${reset ? "Reset" : "Merged"} the reviewed direct audit: ${snapshot.papers.length} papers, ${snapshot.citationEdges.length} citation edges, ${snapshot.ingestionQueue.length} queue items.`,
);
console.log(`${blocked} queue item(s) are blocked on stable-identifier resolution; existing recursive crawl progress was ${reset ? "intentionally reset" : "preserved"}.`);
