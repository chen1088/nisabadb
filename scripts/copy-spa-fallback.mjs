import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

await mkdir("dist", { recursive: true });
await copyFile("dist/index.html", "dist/404.html");

const corpus = JSON.parse(await readFile("src/data/corpus.json", "utf8"));
const statementCountByPaper = new Map();
for (const statement of corpus.statements) {
  statementCountByPaper.set(
    statement.paperId,
    (statementCountByPaper.get(statement.paperId) ?? 0) + 1,
  );
}

const routes = new Set(["knowledge", "papers", "unsolved", "train", "learn", "materials"]);
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
