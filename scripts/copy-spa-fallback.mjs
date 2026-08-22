import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

await mkdir("dist", { recursive: true });
await copyFile("dist/index.html", "dist/404.html");

const knowledgeCoverageDirectory = join("dist", "_knowledge-coverage");
await mkdir(knowledgeCoverageDirectory, { recursive: true });
const sourceRegistry = JSON.parse(await readFile(join("data", "knowledge", "source-records.json"), "utf8"));
if (!Array.isArray(sourceRegistry.records) || sourceRegistry.records.length === 0) {
  throw new Error("The Knowledge source registry is empty or malformed.");
}
sourceRegistry.records.forEach((record, index) => {
  const expectedId = `S${String(index + 1).padStart(4, "0")}`;
  if (record.id !== expectedId || record.ordinal !== index + 1) {
    throw new Error(`The Knowledge source registry loses order at ${expectedId}.`);
  }
});
if (sourceRegistry.approvedRecordCount !== sourceRegistry.records.length) {
  throw new Error("The approved Knowledge source count does not match the registry.");
}
const manifestRows = sourceRegistry.records.map(({
  id, ordinal, title, authorLine, rawCitation, familyId, requiredEditionComponents,
}) => ({ id, ordinal, title, authorLine, rawCitation, familyId, requiredEditionComponents }));
const manifestSha256 = createHash("sha256")
  .update(JSON.stringify(manifestRows))
  .digest("hex");
if (manifestSha256 !== sourceRegistry.approvedManifestSha256) {
  throw new Error("The approved Knowledge source manifest fingerprint changed.");
}

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const verifyReviewDigest = (value, reviewKey, label) => {
  const review = value[reviewKey];
  if (!review) return;
  const subject = { ...value };
  delete subject[reviewKey];
  if (review.evidenceSha256 !== digest(subject)) {
    throw new Error(`${label} administrative review is stale or not bound to its subject.`);
  }
};

for (const record of sourceRegistry.records) {
  verifyReviewDigest(record, "resolutionReview", record.id);
}

const knowledgeBook = JSON.parse(await readFile(join("src", "data", "knowledge.json"), "utf8"));
const sourceRecordById = new Map(sourceRegistry.records.map((record) => [record.id, record]));
for (const source of knowledgeBook.sources) {
  const registryRecord = sourceRecordById.get(source.registryRecordId);
  if (!registryRecord) {
    throw new Error(`Knowledge reference ${source.id} has missing registry record ${source.registryRecordId}.`);
  }
  if (registryRecord.title !== source.title) {
    throw new Error(`Knowledge reference ${source.id} does not match registry title ${source.registryRecordId}.`);
  }
}
for (const node of knowledgeBook.nodes) {
  const { contentSha256, ...content } = node;
  if (contentSha256 !== digest(content)) {
    throw new Error(`${node.id} content fingerprint is stale.`);
  }
}

const compressionProgram = JSON.parse(await readFile(join("src", "data", "compression.json"), "utf8"));
for (const cluster of compressionProgram.clusters) {
  verifyReviewDigest(cluster, "administrativeReview", cluster.id);
  for (const route of cluster.routes) verifyReviewDigest(route, "administrativeReview", route.id);
  for (const residual of cluster.residuals) verifyReviewDigest(residual, "administrativeReview", residual.id);
}

const javascriptAssets = (await readdir(join("dist", "assets"))).filter((filename) => filename.endsWith(".js"));
const registryMarker = sourceRegistry.records[0].title;
for (const filename of javascriptAssets) {
  const asset = await readFile(join("dist", "assets", filename), "utf8");
  if (asset.includes(registryMarker)) {
    throw new Error(`Source-registry data leaked into browser bundle ${filename}.`);
  }
}
for (const filename of ["source-records.json", "verification-policy.json"]) {
  await copyFile(join("data", "knowledge", filename), join(knowledgeCoverageDirectory, filename));
}

const bookManifest = JSON.parse(await readFile(join("data", "books", "manifest.json"), "utf8"));
if (bookManifest.sourceRecordCount !== sourceRegistry.records.length
  || bookManifest.componentFileCount !== bookManifest.entries?.length) {
  throw new Error("The per-book graph manifest does not match the approved source registry.");
}
const expectedComponentCount = sourceRegistry.records.reduce(
  (total, record) => total + record.requiredEditionComponents.length,
  0,
);
if (bookManifest.componentFileCount !== expectedComponentCount) {
  throw new Error("The per-book graph manifest loses required book or volume components.");
}
const publishedBookDirectory = join(knowledgeCoverageDirectory, "books");
await mkdir(publishedBookDirectory, { recursive: true });
await copyFile(join("data", "books", "manifest.json"), join(publishedBookDirectory, "manifest.json"));
const publishedBookPaths = new Set();
for (const entry of bookManifest.entries) {
  if (!/^S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/.test(entry.path) || publishedBookPaths.has(entry.path)) {
    throw new Error(`Unsafe or duplicate per-book graph path: ${entry.path}`);
  }
  publishedBookPaths.add(entry.path);
  const source = join("data", "books", ...entry.path.split("/"));
  const destination = join(publishedBookDirectory, ...entry.path.split("/"));
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const corpus = JSON.parse(await readFile("src/data/corpus.json", "utf8"));
const statementCountByPaper = new Map();
for (const statement of corpus.statements) {
  statementCountByPaper.set(
    statement.paperId,
    (statementCountByPaper.get(statement.paperId) ?? 0) + 1,
  );
}

const routes = new Set([
  "knowledge",
  "knowledge/compression",
  "knowledge/coverage",
  "papers",
  "unsolved",
  "train",
  "learn",
  "materials",
]);
for (const paper of corpus.papers) {
  routes.add(`papers/${paper.id}`);
  if ((statementCountByPaper.get(paper.id) ?? 0) > 0) {
    routes.add(`papers/${paper.id}/distilled`);
  }
}
for (const statement of corpus.statements) {
  routes.add(`theorems/${statement.globalStatementId}`);
}

for (const route of routes) {
  if (!route.split("/").every((segment) => /^[a-z0-9.-]+$/.test(segment))) {
    throw new Error(`Refusing to create an unsafe static route: ${route}`);
  }
  const destination = join("dist", ...route.split("/"), "index.html");
  await mkdir(dirname(destination), { recursive: true });
  await copyFile("dist/index.html", destination);
}

console.log(`Created static entry shells for ${routes.size} canonical client routes.`);
console.log(
  `Published ${sourceRegistry.records.length} source records and ${bookManifest.componentFileCount} lazy per-book graphs.`,
);
