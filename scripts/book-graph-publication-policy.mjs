import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const privateCandidatePathPattern = /^data\/books\/S\d{4}\/[a-z0-9][a-z0-9-]*\.json$/u;

function repositoryRelativePath(repositoryRoot, filePath) {
  const relativePath = path.relative(path.resolve(repositoryRoot), path.resolve(filePath));
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Book-graph path escapes the repository: ${filePath}`);
  }
  return relativePath.replaceAll("\\", "/");
}

function gitStatus(repositoryRoot, arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  return result.status;
}

export function trackedBookGraphPayloadPathsSync(repositoryRoot) {
  const output = execFileSync("git", ["ls-files", "--cached", "--", "data/books"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Set(output
    .split(/\r?\n/u)
    .filter((relativePath) => relativePath && relativePath !== "data/books/manifest.json"));
}

export function checkPublicBookGraphBoundarySync(repositoryRoot) {
  const trackedPayloadPaths = trackedBookGraphPayloadPathsSync(repositoryRoot);
  if (trackedPayloadPaths.size > 0) {
    throw new Error(
      `Raw book-graph payloads must not be tracked by public Git: ${[...trackedPayloadPaths].join(", ")}`,
    );
  }
  return trackedPayloadPaths;
}

export function assertPrivateCandidateDestinationSync(repositoryRoot, destination) {
  const relativePath = repositoryRelativePath(repositoryRoot, destination);
  if (!privateCandidatePathPattern.test(relativePath)) {
    throw new Error(`Candidate graph destination is not canonical private-cache storage: ${relativePath}`);
  }
  if (gitStatus(repositoryRoot, ["ls-files", "--error-unmatch", "--", relativePath]) === 0) {
    throw new Error(`Candidate graph destination is tracked by public Git: ${relativePath}`);
  }
  if (gitStatus(repositoryRoot, ["check-ignore", "--quiet", "--no-index", "--", relativePath]) !== 0) {
    throw new Error(`Candidate graph destination is not protected by .gitignore: ${relativePath}`);
  }
  return relativePath;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const repositoryRoot = path.resolve(path.dirname(modulePath), "..");
  checkPublicBookGraphBoundarySync(repositoryRoot);
  process.stdout.write("Public book-graph boundary valid: only metadata/manifests are tracked.\n");
}
