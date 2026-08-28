import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ACTOR_ID = "open-logic-book-importer";
const ENTRY_FILE = "open-logic-complete.tex";
const AUDITED_REVISION = "1e960beff9ed7835bf3e3f1335e21af3439cd107";

const GRAPH_ENVIRONMENTS = new Map([
  ["thm", { nodeClass: "theorem-like", kind: "theorem", label: "Theorem" }],
  ["lem", { nodeClass: "theorem-like", kind: "lemma", label: "Lemma" }],
  ["prop", { nodeClass: "theorem-like", kind: "proposition", label: "Proposition" }],
  ["cor", { nodeClass: "theorem-like", kind: "corollary", label: "Corollary" }],
  ["defn", { nodeClass: "support", kind: "definition", label: "Definition" }],
  ["axiom", { nodeClass: "support", kind: "axiom", label: "Axiom" }],
  ["defish", {
    nodeClass: "support",
    kind: "definition",
    label: "Definition-like block",
    sourceStructural: true,
  }],
  ["conv", { nodeClass: "support", kind: "notation", label: "Convention" }],
]);

const EXCLUDED_GRAPH_ANCESTORS = new Set([
  "case",
  "digress",
  "editorial",
  "explain",
  "history",
  "intro",
  "note",
  "pedantic",
  "prob",
  "probd",
  "probtag",
  "proof",
  "reading",
  "rem",
]);

const ARTIFACT_ENVIRONMENTS = new Map([
  ["ex", { kind: "example", label: "Example" }],
  ["prob", { kind: "exercise", label: "Exercise" }],
  ["probd", { kind: "exercise", label: "Exercise" }],
  ["probtag", { kind: "exercise", label: "Exercise" }],
  ["rem", { kind: "remark", label: "Remark" }],
  ["note", { kind: "remark", label: "Note" }],
  ["equation", { kind: "equation", label: "Equation" }],
  ["equation*", { kind: "equation", label: "Equation" }],
  ["align", { kind: "equation", label: "Equation" }],
  ["align*", { kind: "equation", label: "Equation" }],
  ["aligned", { kind: "equation", label: "Equation" }],
  ["eqnarray", { kind: "equation", label: "Equation" }],
  ["eqnarray*", { kind: "equation", label: "Equation" }],
  ["gather", { kind: "equation", label: "Equation" }],
  ["gather*", { kind: "equation", label: "Equation" }],
  ["multline", { kind: "equation", label: "Equation" }],
  ["multline*", { kind: "equation", label: "Equation" }],
  ["figure", { kind: "prose", label: "Figure" }],
  ["table", { kind: "prose", label: "Table" }],
  ["enumerate", { kind: "item", label: "Item" }],
  ["tagenumerate", { kind: "item", label: "Item" }],
]);

const VERBATIM_ENVIRONMENTS = new Set(["verbatim", "lstlisting", "minted"]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  return JSON.stringify(value);
}

function normalizeNewlines(value) {
  return value.replace(/\r\n?/gu, "\n");
}

function safeSlug(value, fallback = "item") {
  const slug = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_:.\\/]+/gu, "-")
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return /^[a-z0-9]/u.test(slug) ? slug : `id-${slug || fallback}`;
}

function uniqueStableId(preferred, fallback, usedIds) {
  const base = safeSlug(preferred || fallback);
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  const digest = sha256(`${preferred}\0${fallback}`).slice(0, 12);
  let candidate = `${base}-${digest}`;
  let suffix = 1;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${digest}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function maskTexComments(source) {
  const output = source.split("");
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "%") continue;
    let slashCount = 0;
    for (let previous = index - 1; previous >= 0 && source[previous] === "\\"; previous -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 1) continue;
    while (index < source.length && source[index] !== "\n") {
      output[index] = " ";
      index += 1;
    }
  }
  return output.join("");
}

function maskKnownCompleteBuildConditionals(source) {
  const characters = source.split("");
  const startToken = "\\ifdefined\\ollangid";
  const endToken = "\\fi";
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(startToken, cursor);
    if (start < 0) break;
    const endStart = source.indexOf(endToken, start + startToken.length);
    if (endStart < 0) break;
    maskRange(characters, start, endStart + endToken.length);
    cursor = endStart + endToken.length;
  }
  return characters.join("");
}

function maskRange(characters, start, end) {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n" && characters[index] !== "\r") characters[index] = " ";
  }
}

function skipWhitespace(source, offset) {
  let cursor = offset;
  while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
  return cursor;
}

function readBalanced(source, offset, open, close) {
  if (source[offset] !== open) return null;
  let depth = 1;
  for (let cursor = offset + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (source[cursor] === open) depth += 1;
    else if (source[cursor] === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          value: source.slice(offset + 1, cursor),
          start: offset,
          contentStart: offset + 1,
          contentEnd: cursor,
          end: cursor + 1,
          grouped: true,
          tokenKind: "group",
        };
      }
    }
  }
  return null;
}

function readRequiredArgument(source, offset) {
  if (offset >= source.length) return null;
  if (source[offset] === "{") return readBalanced(source, offset, "{", "}");

  let end = offset + 1;
  let tokenKind = "character";
  if (source[offset] === "\\") {
    tokenKind = "control-sequence";
    if (/[A-Za-z@]/u.test(source[end] ?? "")) {
      while (end < source.length && /[A-Za-z@]/u.test(source[end])) end += 1;
    } else if (end < source.length) {
      const codePoint = source.codePointAt(end);
      end += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    }
  } else {
    const codePoint = source.codePointAt(offset);
    end = offset + (codePoint !== undefined && codePoint > 0xffff ? 2 : 1);
  }

  return {
    value: source.slice(offset, end),
    start: offset,
    contentStart: offset,
    contentEnd: end,
    end,
    grouped: false,
    tokenKind,
  };
}

function parseInvocation(source, start, name, {
  optionalLimit = 0,
  requiredCount = 1,
  allowStar = false,
} = {}) {
  let cursor = start + name.length + 1;
  cursor = skipWhitespace(source, cursor);
  let starred = false;
  if (allowStar && source[cursor] === "*") {
    starred = true;
    cursor = skipWhitespace(source, cursor + 1);
  }
  const optional = [];
  while (optional.length < optionalLimit && source[cursor] === "[") {
    const argument = readBalanced(source, cursor, "[", "]");
    if (!argument) return null;
    optional.push(argument);
    cursor = skipWhitespace(source, argument.end);
  }
  const required = [];
  while (required.length < requiredCount) {
    const argument = readRequiredArgument(source, cursor);
    if (!argument) return null;
    required.push(argument);
    cursor = skipWhitespace(source, argument.end);
  }
  return { start, end: cursor, starred, optional, required };
}

function tagNames(value) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function setTag(tags, name, value) {
  if (!name) return;
  tags.set(name, value);
  tags.set(`not${name}`, !value);
}

function tagsMatch(tags, expression) {
  return tagNames(expression).some((tag) => tags.get(tag) === true);
}

function tagContextDigest(tags) {
  return sha256(canonicalJson([...tags.entries()].sort(([left], [right]) => left.localeCompare(right))));
}

function applyTagDeclarations(source, tags) {
  const masked = maskTexComments(source);
  const pattern = /\\(tagtrue|tagfalse)(?![A-Za-z@])/gu;
  for (const match of masked.matchAll(pattern)) {
    const invocation = parseInvocation(masked, match.index, match[1], { requiredCount: 1 });
    if (!invocation) continue;
    const value = match[1] === "tagtrue";
    for (const tag of tagNames(invocation.required[0].value)) setTag(tags, tag, value);
  }
}

function initialTagConfiguration(checkoutRoot) {
  const tags = new Map();
  const configurationFiles = [];
  const controlPaths = [
    "open-logic-config.sty",
    "open-logic-complete-config.sty",
    "open-logic-envs.sty",
    "sty/open-logic-referencing.sty",
    "sty/open-logic-selective.sty",
    "sty/open-logic-defer.sty",
    "sty/open-logic.sty",
    "README.md",
    "LICENSE.md",
  ];
  const tagDeclarationPaths = new Set([
    "open-logic-config.sty",
    "open-logic-complete-config.sty",
    "sty/open-logic.sty",
  ]);
  for (const relativePath of controlPaths) {
    const absolutePath = path.join(checkoutRoot, ...relativePath.split("/"));
    if (!fs.existsSync(absolutePath)) continue;
    const content = normalizeNewlines(fs.readFileSync(absolutePath, "utf8"));
    configurationFiles.push({ path: relativePath, contentSha256: sha256(content) });
    if (tagDeclarationPaths.has(relativePath)) applyTagDeclarations(content, tags);
  }
  return { tags, configurationFiles };
}

function parseEnvironments(source) {
  const environments = [];
  const stack = [];
  const pattern = /\\(begin|end)\s*\{([^{}]+)\}/gu;
  for (const match of source.matchAll(pattern)) {
    const name = match[2].trim();
    const tokenEnd = match.index + match[0].length;
    if (match[1] === "begin") {
      let contentStart = tokenEnd;
      contentStart = skipWhitespace(source, contentStart);
      let title = null;
      if (source[contentStart] === "[") {
        const optional = readBalanced(source, contentStart, "[", "]");
        if (optional) {
          title = optional.value;
          contentStart = optional.end;
        }
      }
      const environment = {
        name,
        start: match.index,
        beginEnd: tokenEnd,
        contentStart,
        title,
        endStart: source.length,
        end: source.length,
        parent: stack.at(-1) ?? null,
      };
      environments.push(environment);
      stack.push(environment);
      continue;
    }
    let stackIndex = stack.length - 1;
    while (stackIndex >= 0 && stack[stackIndex].name !== name) stackIndex -= 1;
    if (stackIndex < 0) continue;
    const environment = stack[stackIndex];
    environment.endStart = match.index;
    environment.end = tokenEnd;
    stack.splice(stackIndex);
  }
  return environments;
}

function maskVerbatimContents(source) {
  const characters = source.split("");
  for (const environment of parseEnvironments(source)) {
    if (VERBATIM_ENVIRONMENTS.has(environment.name)) {
      maskRange(characters, environment.contentStart, environment.endStart);
    }
  }
  return characters.join("");
}

function scanImportsOnly(source) {
  const imports = [];
  const pattern = /\\olimport(?![A-Za-z@])/gu;
  for (const match of source.matchAll(pattern)) {
    const invocation = parseInvocation(source, match.index, "olimport", {
      optionalLimit: 1,
      requiredCount: 1,
      allowStar: true,
    });
    if (!invocation) continue;
    imports.push({
      offset: match.index,
      starred: invocation.starred,
      directory: invocation.optional[0]?.value.trim() ?? null,
      filename: invocation.required[0].value.trim(),
    });
  }
  return imports;
}

function evaluateTaggedSource(content, initialTags) {
  const commentMasked = maskKnownCompleteBuildConditionals(maskTexComments(content));
  const characters = commentMasked.split("");
  const tags = new Map(initialTags);
  const imports = [];
  let evaluatedConditionalCount = 0;

  let processRange;
  const activateConditional = (invocation, end) => {
    const selected = tagsMatch(tags, invocation.required[0].value)
      ? invocation.required[1]
      : invocation.required[2];
    maskRange(characters, invocation.start, invocation.end);
    for (let index = selected.contentStart; index < selected.contentEnd; index += 1) {
      characters[index] = commentMasked[index];
    }
    evaluatedConditionalCount += 1;

    if (!selected.grouped && selected.tokenKind === "control-sequence") {
      const selectedName = selected.value.slice(1);
      if (selectedName === "iftag" || selectedName === "tagitem") {
        const emittedInvocation = parseInvocation(
          commentMasked,
          selected.contentStart,
          selectedName,
          { requiredCount: 3 },
        );
        if (emittedInvocation && emittedInvocation.end <= end) {
          return activateConditional(emittedInvocation, end);
        }
      }
    }

    processRange(selected.contentStart, selected.contentEnd);
    return invocation.end;
  };

  processRange = (start, end) => {
    const commandPattern = /\\(iftag|tagitem|tagtrue|tagfalse|olimport)(?![A-Za-z@])/gu;
    commandPattern.lastIndex = start;
    while (commandPattern.lastIndex < end) {
      const match = commandPattern.exec(commentMasked);
      if (!match || match.index >= end) break;
      const name = match[1];
      if (name === "iftag" || name === "tagitem") {
        const invocation = parseInvocation(commentMasked, match.index, name, { requiredCount: 3 });
        if (!invocation || invocation.end > end) continue;
        commandPattern.lastIndex = activateConditional(invocation, end);
        continue;
      }
      if (name === "tagtrue" || name === "tagfalse") {
        const invocation = parseInvocation(commentMasked, match.index, name, { requiredCount: 1 });
        if (!invocation || invocation.end > end) continue;
        const value = name === "tagtrue";
        for (const tag of tagNames(invocation.required[0].value)) setTag(tags, tag, value);
        commandPattern.lastIndex = invocation.end;
        continue;
      }
      const invocation = parseInvocation(commentMasked, match.index, "olimport", {
        optionalLimit: 1,
        requiredCount: 1,
        allowStar: true,
      });
      if (!invocation || invocation.end > end) continue;
      imports.push({
        offset: match.index,
        starred: invocation.starred,
        directory: invocation.optional[0]?.value.trim() ?? null,
        filename: invocation.required[0].value.trim(),
        tags: new Map(tags),
      });
      commandPattern.lastIndex = invocation.end;
    }
  };

  processRange(0, commentMasked.length);
  let activeSource = characters.join("");
  const environments = parseEnvironments(activeSource);
  const lexicalTags = new Map(initialTags);
  const tagblockCharacters = activeSource.split("");
  const lexicalPattern = /\\(tagtrue|tagfalse|tagprob|tagendprob|begin)(?![A-Za-z@])/gu;
  const inactiveLexicalRanges = [];
  let probEnabled = true;
  for (const match of activeSource.matchAll(lexicalPattern)) {
    if (inactiveLexicalRanges.some(({ start, end }) => start < match.index && match.index < end)) continue;
    if (match[1] === "tagtrue" || match[1] === "tagfalse") {
      const invocation = parseInvocation(activeSource, match.index, match[1], { requiredCount: 1 });
      if (!invocation) continue;
      const value = match[1] === "tagtrue";
      for (const tag of tagNames(invocation.required[0].value)) setTag(lexicalTags, tag, value);
      continue;
    }
    if (match[1] === "tagprob") {
      const invocation = parseInvocation(activeSource, match.index, "tagprob", {
        optionalLimit: 1,
        requiredCount: 1,
      });
      if (!invocation) continue;
      const outerTags = invocation.optional[0]?.value ?? "tagTrue";
      probEnabled = tagsMatch(lexicalTags, outerTags)
        && tagsMatch(lexicalTags, invocation.required[0].value);
      continue;
    }
    if (match[1] === "tagendprob") {
      probEnabled = true;
      continue;
    }
    const environment = environments.find(({ start }) => start === match.index);
    if (!environment) continue;
    if (environment.name === "prob" && !probEnabled) {
      maskRange(tagblockCharacters, environment.start, environment.end);
      inactiveLexicalRanges.push({ start: environment.start, end: environment.end });
      continue;
    }
    if (environment.name === "tagblock") {
      const tagsArgumentOffset = skipWhitespace(activeSource, environment.beginEnd);
      const argument = readBalanced(activeSource, tagsArgumentOffset, "{", "}");
      if (!argument || tagsMatch(lexicalTags, argument.value)) continue;
      maskRange(tagblockCharacters, environment.start, environment.end);
      inactiveLexicalRanges.push({ start: environment.start, end: environment.end });
    }
  }
  activeSource = tagblockCharacters.join("");
  const activeImports = scanImportsOnly(activeSource);
  const activeImportOffsets = new Set(activeImports.map(({ offset }) => offset));
  const filteredImports = imports.filter(({ offset }) => activeImportOffsets.has(offset));
  const semanticSource = maskVerbatimContents(activeSource);
  const unevaluatedConditionalCount = [...semanticSource.matchAll(
    /\\(?:if(?:case|cat|defined|dim|eof|false|hmode|inner|mmode|num|odd|true|vmode|x)?|unless)(?![A-Za-z@])/gu,
  )].length;
  return {
    activeSource: semanticSource,
    imports: filteredImports,
    evaluatedConditionalCount,
    unevaluatedConditionalCount,
  };
}

function assertContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Open Logic import escapes the checkout: ${candidate}`);
  }
}

function normalizeSourcePath(relativePath) {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/").replace(/^\.\//u, ""));
  if (normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe Open Logic source path: ${relativePath}`);
  }
  return normalized.endsWith(".tex") ? normalized : `${normalized}.tex`;
}

function resolveImport(ownerPath, import_) {
  const filename = import_.filename.endsWith(".tex") ? import_.filename : `${import_.filename}.tex`;
  if (import_.starred) {
    return normalizeSourcePath(path.posix.join("content", import_.directory ?? "", filename));
  }
  return normalizeSourcePath(path.posix.join(
    path.posix.dirname(ownerPath),
    import_.directory ?? "",
    filename,
  ));
}

export function collectOpenLogicSourceUnits(checkoutRoot, entryFile = ENTRY_FILE) {
  const root = path.resolve(checkoutRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Open Logic checkout is not a directory: ${root}`);
  }
  const realRoot = fs.realpathSync(root);
  const { tags: initialTags, configurationFiles } = initialTagConfiguration(root);
  const units = [];
  const missingImports = [];
  const cyclicImports = [];
  const pathCounts = new Map();
  let evaluatedConditionalCount = 0;
  let unevaluatedConditionalCount = 0;

  const visit = (relativePath, tags, ancestry = []) => {
    const normalized = normalizeSourcePath(relativePath);
    const absolute = path.resolve(root, ...normalized.split("/"));
    assertContained(root, absolute);
    if (!fs.existsSync(absolute)) {
      missingImports.push(normalized);
      return;
    }
    const realAbsolute = fs.realpathSync(absolute);
    assertContained(realRoot, realAbsolute);
    const contextDigest = tagContextDigest(tags);
    const cycleKey = `${normalized}\0${contextDigest}`;
    if (ancestry.includes(cycleKey)) {
      cyclicImports.push({ path: normalized, contextDigest });
      return;
    }
    const content = normalizeNewlines(fs.readFileSync(realAbsolute, "utf8"));
    const evaluated = evaluateTaggedSource(content, tags);
    evaluatedConditionalCount += evaluated.evaluatedConditionalCount;
    unevaluatedConditionalCount += evaluated.unevaluatedConditionalCount;
    const pathOccurrence = (pathCounts.get(normalized) ?? 0) + 1;
    pathCounts.set(normalized, pathOccurrence);
    const ordinal = units.length + 1;
    units.push({
      path: normalized,
      content,
      activeContent: evaluated.activeSource,
      ordinal,
      pathOccurrence,
      contextDigest,
      tags: new Map(tags),
    });
    const nextAncestry = [...ancestry, cycleKey];
    for (const import_ of evaluated.imports) {
      const target = resolveImport(normalized, import_);
      const targetAbsolute = path.resolve(root, ...target.split("/"));
      assertContained(root, targetAbsolute);
      if (!fs.existsSync(targetAbsolute)) {
        missingImports.push(target);
        continue;
      }
      visit(target, import_.tags, nextAncestry);
    }
  };

  visit(entryFile, initialTags);
  const uniquePaths = [...pathCounts.keys()];
  return {
    units,
    configurationFiles,
    missingImports: [...new Set(missingImports)].sort(),
    cyclicImports,
    sourcePathCount: uniquePaths.length,
    duplicateImportInstanceCount: units.length - uniquePaths.length,
    evaluatedConditionalCount,
    unevaluatedConditionalCount,
    initialTags: Object.fromEntries([...initialTags.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineAt(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

function normalizeTex(value) {
  return maskTexComments(value)
    .replace(/\\(?:ol)?label\s*\{[^{}]*\}/gu, " ")
    .replace(/\\begin\s*\{[^{}]+\}|\\end\s*\{[^{}]+\}/gu, " ")
    .replace(/~/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function plainTex(value) {
  return normalizeTex(value)
    .replace(/\\[A-Za-z@]+\*?/gu, " ")
    .replace(/[{}$]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function capturedEvidence({ sourceUnitIds, locator, artifactSha256, capturedAt, note }) {
  return {
    status: "captured",
    sourceUnitIds,
    locator,
    captureAudit: { actorId: ACTOR_ID, capturedAt, artifactSha256 },
    independentReview: null,
    note,
  };
}

function buildSourceUnits(units, usedIds) {
  const sourceUnits = units.map((unit) => {
    const instanceSuffix = `${String(unit.ordinal).padStart(4, "0")}-${unit.contextDigest.slice(0, 10)}`;
    return {
      id: uniqueStableId(`unit-${unit.path}-${instanceSuffix}`, `${unit.path}:${instanceSuffix}`, usedIds),
      ordinal: unit.ordinal,
      label: unit.pathOccurrence === 1 ? unit.path : `${unit.path} (import instance ${unit.pathOccurrence})`,
      locator: `${unit.path}#import-instance-${unit.ordinal};tag-context-${unit.contextDigest.slice(0, 12)}`,
      contentSha256: sha256(unit.content),
    };
  });
  return sourceUnits;
}

function scanCommandInvocations(source, name, options) {
  const pattern = new RegExp(`\\\\${name}(?![A-Za-z@])`, "gu");
  const results = [];
  for (const match of source.matchAll(pattern)) {
    const invocation = parseInvocation(source, match.index, name, options);
    if (invocation) results.push(invocation);
  }
  return results;
}

function fileIdForUnit(unit) {
  const fileIds = scanCommandInvocations(unit.activeContent, "olfileid", {
    optionalLimit: 1,
    requiredCount: 3,
  });
  if (fileIds[0]) return fileIds[0].required.map(({ value }) => value.trim());
  const chapterIds = scanCommandInvocations(unit.activeContent, "olchapterid", {
    optionalLimit: 1,
    requiredCount: 2,
  });
  if (chapterIds[0]) return [
    chapterIds[0].required[0].value.trim(),
    chapterIds[0].required[1].value.trim(),
    "udf",
  ];
  const partIds = scanCommandInvocations(unit.activeContent, "olpartid", {
    optionalLimit: 1,
    requiredCount: 1,
  });
  if (partIds[0]) return [partIds[0].required[0].value.trim(), "udf", "udf"];
  return ["udf", "udf", "udf"];
}

function hasExcludedAncestor(environment) {
  let ancestor = environment.parent;
  while (ancestor) {
    if (EXCLUDED_GRAPH_ANCESTORS.has(ancestor.name)) return true;
    ancestor = ancestor.parent;
  }
  return false;
}

function innermostEnvironmentAt(environments, offset, predicate = () => true) {
  let match = null;
  for (const environment of environments) {
    if (environment.start <= offset && offset < environment.end && predicate(environment)) {
      if (!match || environment.start >= match.start) match = environment;
    }
  }
  return match;
}

function scanLabels(unit, environments) {
  const occurrences = [];
  const fileId = unit.fileId;
  for (const invocation of scanCommandInvocations(unit.activeContent, "ollabel", { requiredCount: 1 })) {
    const local = invocation.required[0].value.trim();
    if (!local) continue;
    occurrences.push({
      key: `${fileId[0]}:${fileId[1]}:${fileId[2]}:${local}`,
      local,
      offset: invocation.start,
      end: invocation.end,
      unit,
      environments,
      generatedKind: null,
      generatedTitle: null,
    });
  }
  for (const invocation of scanCommandInvocations(unit.activeContent, "label", { requiredCount: 1 })) {
    const label = invocation.required[0].value.trim();
    if (!label) continue;
    occurrences.push({
      key: label,
      local: label,
      offset: invocation.start,
      end: invocation.end,
      unit,
      environments,
      generatedKind: null,
      generatedTitle: null,
    });
  }
  for (const invocation of scanCommandInvocations(unit.activeContent, "olsection", {
    optionalLimit: 1,
    requiredCount: 1,
  })) {
    occurrences.push({
      key: `${fileId[0]}:${fileId[1]}:${fileId[2]}:sec`,
      local: "sec",
      offset: invocation.start,
      end: invocation.end,
      unit,
      environments,
      generatedKind: "section",
      generatedTitle: plainTex(invocation.required[0].value) || "Section",
    });
  }
  for (const invocation of scanCommandInvocations(unit.activeContent, "olchapter", {
    optionalLimit: 1,
    requiredCount: 3,
  })) {
    occurrences.push({
      key: `${invocation.required[0].value.trim()}:${invocation.required[1].value.trim()}::chap`,
      local: "chap",
      offset: invocation.start,
      end: invocation.end,
      unit,
      environments,
      generatedKind: "section",
      generatedTitle: plainTex(invocation.required[2].value) || "Chapter",
    });
  }
  for (const invocation of scanCommandInvocations(unit.activeContent, "olpart", {
    optionalLimit: 1,
    requiredCount: 2,
  })) {
    occurrences.push({
      key: `${invocation.required[0].value.trim()}:::part`,
      local: "part",
      offset: invocation.start,
      end: invocation.end,
      unit,
      environments,
      generatedKind: "section",
      generatedTitle: plainTex(invocation.required[1].value) || "Part",
    });
  }
  return occurrences.sort((left, right) => left.offset - right.offset);
}

function labelOwnedByCandidate(occurrence, candidate) {
  if (!(candidate.environment.start <= occurrence.offset && occurrence.offset < candidate.environment.end)) return false;
  const boundary = innermostEnvironmentAt(occurrence.environments, occurrence.offset, (environment) => (
    GRAPH_ENVIRONMENTS.has(environment.name)
      || ARTIFACT_ENVIRONMENTS.has(environment.name)
      || EXCLUDED_GRAPH_ANCESTORS.has(environment.name)
  ));
  return boundary === candidate.environment;
}

function referenceTargetForOlref(fileId, invocation) {
  const optional = invocation.optional.map(({ value }) => value.trim());
  let prefix;
  if (optional.length === 0) prefix = fileId;
  else if (optional.length === 1) prefix = [fileId[0], fileId[1], optional[0]];
  else if (optional.length === 2) prefix = [fileId[0], optional[0], optional[1]];
  else prefix = [optional[0], optional[1], optional[2]];
  return `${prefix[0]}:${prefix[1]}:${prefix[2]}:${invocation.required[0].value.trim()}`;
}

function splitTopLevelCsv(value) {
  const items = [];
  let start = 0;
  let braceDepth = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    if (character === "{") braceDepth += 1;
    else if (character === "}" && braceDepth > 0) braceDepth -= 1;
    if ((character === "," && braceDepth === 0) || index === value.length) {
      const item = value.slice(start, index).trim();
      if (item) items.push(item);
      start = index + 1;
    }
  }
  return items;
}

function scanReferencesInRange(unit, start, end) {
  const references = [];
  const names = ["olref", "Olref"];
  for (const name of names) {
    for (const invocation of scanCommandInvocations(unit.activeContent.slice(start, end), name, {
      optionalLimit: 3,
      requiredCount: 1,
    })) {
      const absoluteStart = start + invocation.start;
      references.push({
        key: referenceTargetForOlref(unit.fileId, invocation),
        offset: absoluteStart,
        end: start + invocation.end,
        commandName: name,
      });
    }
  }
  for (const name of ["cref", "Cref", "eqref"]) {
    for (const invocation of scanCommandInvocations(unit.activeContent.slice(start, end), name, {
      requiredCount: 1,
    })) {
      for (const target of splitTopLevelCsv(invocation.required[0].value)) {
        const key = target.replace(/^\{([\s\S]*)\}$/u, "$1").trim();
        if (!key) continue;
        references.push({
          key,
          offset: start + invocation.start,
          end: start + invocation.end,
          commandName: name,
        });
      }
    }
  }
  for (const invocation of scanCommandInvocations(unit.activeContent.slice(start, end), "tagrefs", {
    requiredCount: 1,
  })) {
    for (const pair of splitTopLevelCsv(invocation.required[0].value)) {
      const slash = pair.indexOf("/");
      if (slash < 1) continue;
      const tag = pair.slice(0, slash).trim();
      if (unit.tags.get(tag) !== true) continue;
      const key = pair.slice(slash + 1).trim().replace(/^\{([\s\S]*)\}$/u, "$1").trim();
      if (!key) continue;
      references.push({
        key,
        offset: start + invocation.start,
        end: start + invocation.end,
        commandName: "tagrefs",
      });
    }
  }
  return references.sort((left, right) => left.offset - right.offset || left.key.localeCompare(right.key));
}

function scanCitationsInRange(unit, start, end) {
  const citations = [];
  const source = unit.activeContent.slice(start, end);
  for (const name of [
    "cite",
    "citep",
    "citet",
    "citealp",
    "citealt",
    "citeauthor",
    "citeyear",
    "citeyearpar",
  ]) {
    for (const invocation of scanCommandInvocations(source, name, {
      optionalLimit: 2,
      requiredCount: 1,
      allowStar: true,
    })) {
      const pinpointParts = invocation.optional.map(({ value }) => normalizeTex(value)).filter(Boolean);
      for (const key of splitTopLevelCsv(invocation.required[0].value)) {
        citations.push({
          key,
          offset: start + invocation.start,
          end: start + invocation.end,
          commandName: invocation.starred ? `${name}*` : name,
          citationPinpoint: pinpointParts.length ? pinpointParts.join("; ") : null,
        });
      }
    }
  }
  return citations.sort((left, right) => left.offset - right.offset || left.key.localeCompare(right.key));
}

function sourceContext(unit, start, end) {
  const lineStart = unit.activeContent.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIndex = unit.activeContent.indexOf("\n", end);
  const lineEnd = lineEndIndex < 0 ? unit.activeContent.length : lineEndIndex;
  const context = normalizeTex(unit.activeContent.slice(lineStart, lineEnd));
  if (!context) return `Open Logic source reference at line ${lineAt(unit.lineStarts, start)}.`;
  return context.length <= 400 ? context : `${context.slice(0, 397)}...`;
}

function artifactContextForOccurrence(occurrence) {
  if (occurrence.generatedKind) {
    return {
      kind: occurrence.generatedKind,
      label: "Section",
      title: occurrence.generatedTitle,
      start: occurrence.offset,
      end: occurrence.end,
    };
  }
  const environment = innermostEnvironmentAt(occurrence.environments, occurrence.offset, ({ name }) => (
    ARTIFACT_ENVIRONMENTS.has(name)
  ));
  if (environment) {
    const mapping = ARTIFACT_ENVIRONMENTS.get(environment.name);
    return {
      ...mapping,
      title: environment.title ? plainTex(environment.title) : null,
      start: environment.start,
      end: environment.end,
    };
  }
  const lineStart = occurrence.unit.content.lastIndexOf("\n", Math.max(0, occurrence.offset - 1)) + 1;
  const lineEndIndex = occurrence.unit.content.indexOf("\n", occurrence.end);
  return {
    kind: "prose",
    label: "Prose",
    title: null,
    start: lineStart,
    end: lineEndIndex < 0 ? occurrence.unit.content.length : lineEndIndex,
  };
}

function dependencyRole(targetNode) {
  if (targetNode.nodeClass === "source-artifact") return "source-reference";
  if (targetNode.kind === "definition") return "definition";
  if (targetNode.kind === "notation") return "notation";
  if (targetNode.kind === "construction") return "construction";
  if (targetNode.kind === "calculation") return "calculation";
  return "logical";
}

function uniqueTarget(bindings) {
  const distinct = new Map((bindings ?? []).map((binding) => [binding.node.id, binding]));
  return distinct.size === 1 ? [...distinct.values()][0] : null;
}

function wouldCreateCycle(adjacency, dependentId, prerequisiteId) {
  if (dependentId === prerequisiteId) return true;
  const stack = [prerequisiteId];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === dependentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }
  return false;
}

export function extractOpenLogicGraphFromUnits(inputUnits, {
  capturedAt = "2000-01-01T00:00:00.000Z",
} = {}) {
  const usedIds = new Set();
  const units = inputUnits.map((unit, index) => ({
    ...unit,
    ordinal: unit.ordinal ?? index + 1,
    pathOccurrence: unit.pathOccurrence ?? 1,
    contextDigest: unit.contextDigest ?? tagContextDigest(unit.tags ?? new Map()),
    tags: unit.tags instanceof Map ? new Map(unit.tags) : new Map(Object.entries(unit.tags ?? {})),
    content: normalizeNewlines(unit.content),
    activeContent: unit.activeContent ?? maskVerbatimContents(maskTexComments(normalizeNewlines(unit.content))),
  }));
  const sourceUnits = buildSourceUnits(units, usedIds);
  const sourceUnitByOrdinal = new Map(sourceUnits.map((sourceUnit) => [sourceUnit.ordinal, sourceUnit]));
  const candidates = [];
  const allLabelOccurrences = [];

  for (const unit of units) {
    unit.sourceUnit = sourceUnitByOrdinal.get(unit.ordinal);
    if (!unit.sourceUnit) throw new Error(`Missing source unit ${unit.ordinal}`);
    unit.lineStarts = lineStarts(unit.content);
    unit.fileId = fileIdForUnit(unit);
    unit.environments = parseEnvironments(unit.activeContent);
    unit.labels = scanLabels(unit, unit.environments);
    allLabelOccurrences.push(...unit.labels);
    const ordinals = new Map();
    for (const environment of unit.environments) {
      const mapping = GRAPH_ENVIRONMENTS.get(environment.name);
      if (!mapping || hasExcludedAncestor(environment)) continue;
      const ordinal = (ordinals.get(environment.name) ?? 0) + 1;
      ordinals.set(environment.name, ordinal);
      candidates.push({ unit, environment, mapping, ordinal });
    }
  }

  const nodeMetadata = [];
  const candidateByEnvironment = new Map();
  const labelBindings = new Map();
  const bindLabel = (key, binding) => {
    const bindings = labelBindings.get(key) ?? [];
    bindings.push(binding);
    labelBindings.set(key, bindings);
  };

  for (const candidate of candidates) {
    const { unit, environment, mapping, ordinal } = candidate;
    const ownedLabels = unit.labels.filter((occurrence) => labelOwnedByCandidate(occurrence, candidate));
    const primaryLabel = ownedLabels[0]?.key ?? null;
    const fallback = `${environment.name}-${unit.path}-${unit.ordinal}-${String(ordinal).padStart(4, "0")}`;
    const id = uniqueStableId(primaryLabel, fallback, usedIds);
    const activeStatement = unit.activeContent.slice(environment.contentStart, environment.endStart);
    const raw = unit.content.slice(environment.start, environment.end);
    const projectedSourceHash = sha256(canonicalJson({
      raw,
      activeStatement,
      contextDigest: unit.contextDigest,
    }));
    const startLine = lineAt(unit.lineStarts, environment.start);
    const endLine = lineAt(unit.lineStarts, environment.end);
    const locator = `${unit.sourceUnit.locator}:L${startLine}-L${endLine}`;
    const title = environment.title
      ? plainTex(environment.title)
      : `${mapping.label} at ${path.posix.basename(unit.path)}:${startLine}`;
    const node = {
      id,
      nodeClass: mapping.nodeClass,
      kind: mapping.kind,
      sourceLabel: primaryLabel ? `${mapping.label} (${primaryLabel})` : mapping.label,
      sourceXmlId: primaryLabel,
      sourceLocator: locator,
      title,
      normalizedStatement: normalizeTex(activeStatement)
        || `${mapping.label} recorded at ${unit.path}, line ${startLine}.`,
      sourceTextSha256: projectedSourceHash,
      evidence: capturedEvidence({
        sourceUnitIds: [unit.sourceUnit.id],
        locator,
        artifactSha256: projectedSourceHash,
        capturedAt,
        note: mapping.sourceStructural
          ? "The Open Logic source structurally marks this as a definition-like block; it is inventoried as candidate support without asserting that mathematical classification has been reviewed."
          : "Deterministic candidate extraction from one active import instance of the pinned Open Logic LaTeX source; not independently reviewed.",
      }),
    };
    const metadata = { node, unit, environment, ownedLabels, offset: environment.start };
    nodeMetadata.push(metadata);
    candidateByEnvironment.set(environment, metadata);
    for (const occurrence of ownedLabels) bindLabel(occurrence.key, metadata);
  }

  const occurrenceBindings = new Map();
  for (const occurrence of allLabelOccurrences) {
    const bindings = occurrenceBindings.get(occurrence.key) ?? [];
    bindings.push(occurrence);
    occurrenceBindings.set(occurrence.key, bindings);
  }
  const uniqueSourceTarget = (key) => {
    const occurrences = occurrenceBindings.get(key) ?? [];
    const distinctOccurrences = new Set(occurrences.map(({ unit, offset }) => `${unit.ordinal}:${offset}`));
    if (distinctOccurrences.size > 1) return null;
    return uniqueTarget(labelBindings.get(key));
  };

  const proofAssociations = [];
  const unassociatedProofs = [];
  let unassociatedProofCount = 0;
  for (const unit of units) {
    const localMetadata = nodeMetadata
      .filter((metadata) => metadata.unit === unit)
      .sort((left, right) => left.environment.start - right.environment.start);
    const proofs = unit.environments.filter(({ name }) => name === "proof");
    for (const proof of proofs) {
      if (hasExcludedAncestor(proof)) continue;
      let owner = null;
      let associationKind = "nearest-preceding-result";
      let ancestor = proof.parent;
      while (ancestor) {
        const candidate = candidateByEnvironment.get(ancestor);
        if (candidate?.node.nodeClass === "theorem-like") {
          owner = candidate;
          associationKind = "nested-proof";
          break;
        }
        ancestor = ancestor.parent;
      }
      if (!owner && proof.title) {
        const titleEnd = proof.contentStart;
        const titleReferences = scanReferencesInRange(unit, proof.beginEnd, titleEnd)
          .map(({ key }) => uniqueSourceTarget(key))
          .filter((target) => target?.node.nodeClass === "theorem-like");
        const distinct = new Map(titleReferences.map((target) => [target.node.id, target]));
        if (distinct.size === 1) {
          owner = [...distinct.values()][0];
          associationKind = "proof-title-target";
        }
      }
      if (!owner) {
        owner = localMetadata.filter((metadata) => (
          metadata.node.nodeClass === "theorem-like" && metadata.environment.end <= proof.start
        )).at(-1) ?? null;
      }
      if (owner) proofAssociations.push({ owner, proof, unit, associationKind });
      else {
        unassociatedProofCount += 1;
        unassociatedProofs.push({ proof, unit });
      }
    }
  }

  const artifactMetadata = [];
  const unassociatedProofAssociations = [];
  for (const { proof, unit } of unassociatedProofs) {
    const proofReferences = scanReferencesInRange(unit, proof.contentStart, proof.endStart);
    const proofCitations = scanCitationsInRange(unit, proof.contentStart, proof.endStart);
    if (proofReferences.length === 0 && proofCitations.length === 0) continue;
    const raw = unit.content.slice(proof.start, proof.end);
    const activeProofText = unit.activeContent.slice(proof.start, proof.end);
    const projectedProofHash = sha256(canonicalJson({
      raw,
      activeProofText,
      contextDigest: unit.contextDigest,
    }));
    const startLine = lineAt(unit.lineStarts, proof.start);
    const endLine = lineAt(unit.lineStarts, proof.end);
    const locator = `${unit.sourceUnit.locator}:L${startLine}-L${endLine}`;
    const node = {
      id: uniqueStableId(
        `artifact-unassociated-proof-${unit.ordinal}-${startLine}`,
        `${unit.path}:${proof.start}:unassociated-proof`,
        usedIds,
      ),
      nodeClass: "source-artifact",
      kind: "prose",
      sourceLabel: `Unassociated proof (${unit.path}:${startLine})`,
      sourceXmlId: null,
      sourceLocator: locator,
      title: `Unassociated proof at ${path.posix.basename(unit.path)}:${startLine}`,
      normalizedStatement: normalizeTex(activeProofText)
        || `Unassociated proof source artifact recorded at ${unit.path}, line ${startLine}.`,
      sourceTextSha256: projectedProofHash,
      evidence: capturedEvidence({
        sourceUnitIds: [unit.sourceUnit.id],
        locator,
        artifactSha256: projectedProofHash,
        capturedAt,
        note: "This proof contains exact source references but has no deterministic theorem owner; it is retained as a raw source artifact rather than silently dropped.",
      }),
    };
    const metadata = { node, unit, offset: proof.start, proof };
    artifactMetadata.push(metadata);
    unassociatedProofAssociations.push({
      owner: metadata,
      proof,
      unit,
      associationKind: "unassociated-proof-artifact",
    });
  }
  const allProofAssociations = [...proofAssociations, ...unassociatedProofAssociations];
  const referenceDrafts = [];
  const proofDraftsByProof = new Map();
  for (const metadata of nodeMetadata) {
    const nestedProofs = metadata.unit.environments.filter((environment) => (
      environment.name === "proof"
        && metadata.environment.start <= environment.start
        && environment.end <= metadata.environment.end
    ));
    for (const reference of scanReferencesInRange(
      metadata.unit,
      metadata.environment.contentStart,
      metadata.environment.endStart,
    )) {
      if (nestedProofs.some((proof) => proof.start <= reference.offset && reference.offset < proof.end)) continue;
      referenceDrafts.push({
        ...reference,
        owner: metadata,
        basis: "statement-xref",
        unit: metadata.unit,
        proof: null,
      });
    }
  }
  for (const association of allProofAssociations) {
    const referenceDraftItems = scanReferencesInRange(
      association.unit,
      association.proof.contentStart,
      association.proof.endStart,
    )
      .map((reference) => ({
        ...reference,
        owner: association.owner,
        basis: "proof-xref",
        unit: association.unit,
        proof: association.proof,
        associationKind: association.associationKind,
      }));
    const citationDraftItems = scanCitationsInRange(
      association.unit,
      association.proof.contentStart,
      association.proof.endStart,
    ).map((citation) => ({
      ...citation,
      owner: association.owner,
      basis: "proof-citation",
      unit: association.unit,
      proof: association.proof,
      associationKind: association.associationKind,
    }));
    const drafts = [...referenceDraftItems, ...citationDraftItems].sort((left, right) => (
      left.offset - right.offset || left.key.localeCompare(right.key)
    ));
    referenceDrafts.push(...drafts);
    proofDraftsByProof.set(association.proof, drafts);
  }

  const artifactByOccurrence = new Map();
  const ensureArtifact = (key) => {
    const existingTarget = uniqueSourceTarget(key);
    if (existingTarget) return existingTarget;
    if ((labelBindings.get(key) ?? []).length > 1) return null;
    const occurrences = occurrenceBindings.get(key) ?? [];
    if (occurrences.length !== 1) return null;
    const occurrence = occurrences[0];
    if (artifactByOccurrence.has(occurrence)) return artifactByOccurrence.get(occurrence);
    const context = artifactContextForOccurrence(occurrence);
    const raw = occurrence.unit.content.slice(context.start, context.end);
    const activeArtifactText = occurrence.unit.activeContent.slice(context.start, context.end);
    const projectedArtifactHash = sha256(canonicalJson({
      raw,
      activeArtifactText,
      contextDigest: occurrence.unit.contextDigest,
    }));
    const startLine = lineAt(occurrence.unit.lineStarts, context.start);
    const endLine = lineAt(occurrence.unit.lineStarts, context.end);
    const locator = `${occurrence.unit.sourceUnit.locator}:L${startLine}-L${endLine}`;
    const node = {
      id: uniqueStableId(`artifact-${key}`, `${occurrence.unit.path}:${occurrence.offset}:${key}`, usedIds),
      nodeClass: "source-artifact",
      kind: context.kind,
      sourceLabel: `${context.label} (${key})`,
      sourceXmlId: key,
      sourceLocator: locator,
      title: context.title || `${context.label} at ${path.posix.basename(occurrence.unit.path)}:${startLine}`,
      normalizedStatement: normalizeTex(activeArtifactText)
        || `${context.label} source artifact recorded at ${occurrence.unit.path}, line ${startLine}.`,
      sourceTextSha256: projectedArtifactHash,
      evidence: capturedEvidence({
        sourceUnitIds: [occurrence.unit.sourceUnit.id],
        locator,
        artifactSha256: projectedArtifactHash,
        capturedAt,
        note: "A proof reference targets this non-mathematical or not-yet-classified source object. It remains a raw source artifact pending decomposition or suppression.",
      }),
    };
    const metadata = { node, unit: occurrence.unit, offset: occurrence.offset, occurrence };
    artifactMetadata.push(metadata);
    artifactByOccurrence.set(occurrence, metadata);
    bindLabel(key, metadata);
    return metadata;
  };

  for (const draft of referenceDrafts) {
    if (draft.basis === "proof-xref" && !uniqueSourceTarget(draft.key)) ensureArtifact(draft.key);
  }

  const references = [];
  const dependencyGroups = new Map();
  for (const draft of referenceDrafts) {
    if (draft.basis === "proof-citation") continue;
    const target = uniqueSourceTarget(draft.key);
    draft.target = target;
    if (draft.basis !== "proof-xref" || !target || target.node.id === draft.owner.node.id) continue;
    const pair = `${draft.owner.node.id}\0${target.node.id}`;
    const group = dependencyGroups.get(pair) ?? {
      dependent: draft.owner,
      target,
      drafts: [],
    };
    group.drafts.push(draft);
    dependencyGroups.set(pair, group);
  }

  const adjacency = new Map();
  const directDependencies = [];
  const dependencyIdByPair = new Map();
  const cycleRejectedPairs = new Set();
  for (const [pair, group] of dependencyGroups) {
    if (wouldCreateCycle(adjacency, group.dependent.node.id, group.target.node.id)) {
      cycleRejectedPairs.add(pair);
      continue;
    }
    const sourceUnitIds = [...new Set(group.drafts.map(({ unit }) => unit.sourceUnit.id))];
    const locators = group.drafts.map(({ unit, offset }) => (
      `${unit.sourceUnit.locator}:L${lineAt(unit.lineStarts, offset)}`
    ));
    const dependency = {
      id: uniqueStableId(
        `dep-${group.dependent.node.id}-to-${group.target.node.id}`,
        pair,
        usedIds,
      ),
      dependentNodeId: group.dependent.node.id,
      prerequisite: { type: "node", id: group.target.node.id },
      role: dependencyRole(group.target.node),
      rationale: group.target.node.nodeClass === "source-artifact"
        ? `The source proof explicitly references raw ${group.target.node.sourceLabel}; mathematical decomposition remains pending.`
        : `The source proof explicitly references ${group.target.node.sourceLabel}.`,
      evidence: capturedEvidence({
        sourceUnitIds,
        locator: locators.join("; "),
        artifactSha256: sha256(canonicalJson(group.drafts.map(({ key, unit, offset, commandName }) => ({
          key,
          locator: `${unit.sourceUnit.locator}:L${lineAt(unit.lineStarts, offset)}`,
          commandName,
        })))),
        capturedAt,
        note: `${group.drafts.length} explicit proof reference${group.drafts.length === 1 ? "" : "s"} merged into one candidate edge; no implicit prerequisite or independent review is claimed.`,
      }),
    };
    directDependencies.push(dependency);
    dependencyIdByPair.set(pair, dependency.id);
    const outgoing = adjacency.get(group.dependent.node.id) ?? [];
    outgoing.push(group.target.node.id);
    adjacency.set(group.dependent.node.id, outgoing);
  }

  let referenceOrdinal = 0;
  for (const draft of referenceDrafts.sort((left, right) => (
    left.unit.ordinal - right.unit.ordinal || left.offset - right.offset || left.key.localeCompare(right.key)
  ))) {
    referenceOrdinal += 1;
    const pair = draft.target ? `${draft.owner.node.id}\0${draft.target.node.id}` : null;
    const dependencyId = pair ? dependencyIdByPair.get(pair) : null;
    let resolution;
    if (draft.basis === "proof-citation") {
      resolution = {
        status: "unresolved",
        note: "The proof-local bibliographic citation is retained exactly, but no typed external theorem or source pinpoint has been independently resolved.",
      };
    } else if (!draft.target) {
      const bindingCount = (labelBindings.get(draft.key) ?? []).length;
      const occurrenceCount = (occurrenceBindings.get(draft.key) ?? []).length;
      resolution = {
        status: "unresolved",
        note: bindingCount > 1 || occurrenceCount > 1
          ? "The exact source label is ambiguous across active import instances; no target was guessed."
          : "No unique inventoried node or proof-referenced source artifact has this exact source label.",
      };
    } else if (draft.basis === "proof-xref" && draft.target.node.id === draft.owner.node.id) {
      resolution = {
        status: "unresolved",
        note: "This proof reference points back to its owner and therefore cannot be promoted to a direct dependency.",
      };
    } else if (draft.basis === "proof-xref" && (!dependencyId || cycleRejectedPairs.has(pair))) {
      resolution = {
        status: "unresolved",
        note: "The exact target was found, but promoting this proof reference would create a dependency cycle; mathematical review is required.",
      };
    } else {
      resolution = {
        status: "resolved",
        target: { type: "node", id: draft.target.node.id },
        directDependencyId: draft.basis === "proof-xref" ? dependencyId : null,
        note: draft.target.node.nodeClass === "source-artifact"
          ? "The exact source label resolves to a raw source artifact; this is not yet a mathematical dependency."
          : "The exact source label resolves uniquely to an inventoried node in the active import-instance expansion; not independently reviewed.",
      };
    }
    const referenceLine = lineAt(draft.unit.lineStarts, draft.offset);
    const referenceColumn = draft.offset - draft.unit.lineStarts[referenceLine - 1] + 1;
    const locator = `${draft.unit.sourceUnit.locator}:L${referenceLine}:C${referenceColumn}#reference-${referenceOrdinal}`;
    const raw = draft.unit.content.slice(draft.offset, draft.end);
    references.push({
      id: uniqueStableId(
        `ref-${draft.owner.node.id}-${draft.basis}-${String(referenceOrdinal).padStart(6, "0")}`,
        `${locator}:${draft.key}:${draft.commandName}`,
        usedIds,
      ),
      ownerNodeId: draft.owner.node.id,
      basis: draft.basis,
      ref: draft.key,
      ...(draft.basis === "proof-citation" ? { pinpoint: draft.citationPinpoint } : {}),
      context: sourceContext(draft.unit, draft.offset, draft.end),
      locator,
      resolution,
      evidence: capturedEvidence({
        sourceUnitIds: [draft.unit.sourceUnit.id],
        locator,
        artifactSha256: sha256(raw),
        capturedAt,
        note: `Captured exact proof-local or statement-local \\${draft.commandName} source syntax from the active import instance; classification is not independently reviewed.`,
      }),
    });
    draft.reference = references.at(-1);
  }

  const proofRoutes = [];
  for (const association of proofAssociations) {
    const drafts = proofDraftsByProof.get(association.proof) ?? [];
    const dependencyIds = [...new Set(drafts.flatMap((draft) => {
      if (!draft.target) return [];
      const id = dependencyIdByPair.get(`${draft.owner.node.id}\0${draft.target.node.id}`);
      return id ? [id] : [];
    }))];
    const raw = association.unit.content.slice(association.proof.start, association.proof.end);
    const startLine = lineAt(association.unit.lineStarts, association.proof.start);
    const endLine = lineAt(association.unit.lineStarts, association.proof.end);
    const locator = `${association.unit.sourceUnit.locator}:L${startLine}-L${endLine}`;
    proofRoutes.push({
      id: uniqueStableId(
        `route-${association.owner.node.id}-source-proof-${association.unit.ordinal}-${startLine}`,
        `${association.owner.node.id}:${locator}`,
        usedIds,
      ),
      theoremNodeId: association.owner.node.id,
      routeKind: "source-proof",
      dependencyIds,
      summary: dependencyIds.length
        ? "Candidate source-faithful route containing only dependencies named by exact proof-local references."
        : "The source proof boundary is captured, but it contains no resolved explicit mathematical dependency; implicit prerequisites remain pending.",
      evidence: capturedEvidence({
        sourceUnitIds: [association.unit.sourceUnit.id],
        locator,
        artifactSha256: sha256(raw),
        capturedAt,
        note: `${association.associationKind} proof association from the active import instance; candidate route only, with no independent mathematical review.`,
      }),
    });
  }

  const allMetadata = [...nodeMetadata, ...artifactMetadata].sort((left, right) => (
    left.unit.ordinal - right.unit.ordinal || left.offset - right.offset
  ));
  const inventoryBySourceUnit = new Map(sourceUnits.map((sourceUnit) => [sourceUnit.id, {
    theoremNodeIds: [],
    supportNodeIds: [],
    sourceArtifactNodeIds: [],
  }]));
  for (const metadata of allMetadata) {
    const inventory = inventoryBySourceUnit.get(metadata.unit.sourceUnit.id);
    if (!inventory) throw new Error(`Missing inventory for ${metadata.unit.sourceUnit.id}`);
    if (metadata.node.nodeClass === "theorem-like") inventory.theoremNodeIds.push(metadata.node.id);
    else if (metadata.node.nodeClass === "support") inventory.supportNodeIds.push(metadata.node.id);
    else inventory.sourceArtifactNodeIds.push(metadata.node.id);
  }
  const unitInventories = sourceUnits.map((sourceUnit) => {
    const inventory = inventoryBySourceUnit.get(sourceUnit.id);
    const theoremFreeAttestation = inventory.theoremNodeIds.length === 0;
    return {
      sourceUnitId: sourceUnit.id,
      theoremNodeIds: inventory.theoremNodeIds,
      supportNodeIds: inventory.supportNodeIds,
      sourceArtifactNodeIds: inventory.sourceArtifactNodeIds,
      theoremFreeAttestation,
      evidence: capturedEvidence({
        sourceUnitIds: [sourceUnit.id],
        locator: sourceUnit.locator,
        artifactSha256: sourceUnit.contentSha256,
        capturedAt,
        note: theoremFreeAttestation
          ? "The deterministic active-instance scan found no inventoried theorem-like environments in this source-file instance; captured, not independently reviewed."
          : `The deterministic active-instance scan assigned ${inventory.theoremNodeIds.length} theorem-like, ${inventory.supportNodeIds.length} support, and ${inventory.sourceArtifactNodeIds.length} raw source-artifact node(s); not independently reviewed.`,
      }),
    };
  });

  const theoremNodes = nodeMetadata.filter(({ node }) => node.nodeClass === "theorem-like");
  const nodeById = new Map(allMetadata.map(({ node }) => [node.id, node]));
  const dependencyById = new Map(directDependencies.map((dependency) => [dependency.id, dependency]));
  const dependencyReadyTheorems = new Set(proofRoutes.filter((route) => route.dependencyIds.some((id) => {
    const dependency = dependencyById.get(id);
    return dependency && nodeById.get(dependency.prerequisite.id)?.nodeClass !== "source-artifact";
  })).map(({ theoremNodeId }) => theoremNodeId));
  const allLabelKeys = new Set([...labelBindings.keys(), ...occurrenceBindings.keys()]);
  const ambiguousLabels = [...allLabelKeys].filter((key) => {
    const occurrences = occurrenceBindings.get(key) ?? [];
    const distinctOccurrences = new Set(occurrences.map(({ unit, offset }) => `${unit.ordinal}:${offset}`));
    const nodeIds = new Set((labelBindings.get(key) ?? []).map(({ node }) => node.id));
    return distinctOccurrences.size > 1 || nodeIds.size > 1;
  }).length;
  const graph = {
    nodes: allMetadata.map(({ node }) => node),
    externalInputs: [],
    directDependencies,
    proofRoutes,
    references,
  };
  const stats = {
    theoremCount: theoremNodes.length,
    supportCount: nodeMetadata.filter(({ node }) => node.nodeClass === "support").length,
    sourceArtifactCount: artifactMetadata.length,
    directDependencyCount: directDependencies.length,
    proofRouteCount: proofRoutes.length,
    referenceCount: references.length,
    unresolvedReferenceCount: references.filter(({ resolution }) => resolution.status === "unresolved").length,
    unresolvedProofReferenceCount: references.filter(({ basis, resolution }) => (
      basis === "proof-xref" && resolution.status === "unresolved"
    )).length,
    proofCitationCount: references.filter(({ basis }) => basis === "proof-citation").length,
    unresolvedProofCitationCount: references.filter(({ basis, resolution }) => (
      basis === "proof-citation" && resolution.status === "unresolved"
    )).length,
    pendingTheoremCount: theoremNodes.length - dependencyReadyTheorems.size,
    unitInventoryCount: unitInventories.length,
    theoremFreeUnitCount: unitInventories.filter(({ theoremFreeAttestation }) => theoremFreeAttestation).length,
    ambiguousLabelCount: ambiguousLabels,
    unassociatedProofCount,
    retainedUnassociatedProofArtifactCount: unassociatedProofAssociations.length,
    cycleRejectedDependencyCount: cycleRejectedPairs.size,
    activeEnvironmentCounts: Object.fromEntries([
      ...GRAPH_ENVIRONMENTS.keys(),
      "proof",
      "prob",
      "probtag",
    ].map((name) => [
      name,
      units.reduce((count, unit) => (
        count + unit.environments.filter((environment) => environment.name === name).length
      ), 0),
    ])),
    inventoriedEnvironmentCounts: Object.fromEntries([...GRAPH_ENVIRONMENTS.keys()].map((name) => [
      name,
      candidates.filter(({ environment }) => environment.name === name).length,
    ])),
  };
  stats.excludedNestedGraphEnvironmentCount = [...GRAPH_ENVIRONMENTS.keys()].reduce((count, name) => (
    count + stats.activeEnvironmentCounts[name] - stats.inventoriedEnvironmentCounts[name]
  ), 0);
  return { sourceUnits, unitInventories, graph, stats };
}

export function buildOpenLogicBookFile({
  baseFile,
  checkoutRoot,
  commit,
  capturedAt,
  sourceRepository = "https://github.com/OpenLogicProject/OpenLogic",
}) {
  if (!baseFile?.identity?.sourceRecordId) throw new Error("baseFile with a source identity is required");
  if (!/^[0-9a-f]{40}$/iu.test(commit)) throw new Error("--commit must be a full 40-character Git commit");
  if (Number.isNaN(new Date(capturedAt).getTime())) throw new Error("capturedAt must be a valid ISO-8601 timestamp");
  const collected = collectOpenLogicSourceUnits(checkoutRoot, ENTRY_FILE);
  if (collected.units.length === 0) throw new Error("The Open Logic source expansion is empty");
  const extracted = extractOpenLogicGraphFromUnits(collected.units, { capturedAt });
  const expectedEnvironmentCounts = {
    thm: 182,
    prop: 410,
    lem: 121,
    cor: 73,
    defn: 440,
    axiom: 10,
    defish: 71,
    conv: 1,
    proof: 699,
    prob: 413,
    probtag: 7,
  };
  const environmentCountMismatches = Object.entries(expectedEnvironmentCounts).flatMap(([name, expected]) => {
    const actual = extracted.stats.activeEnvironmentCounts[name] ?? 0;
    return actual === expected ? [] : [{ name, expected, actual }];
  });
  if (commit.toLowerCase() === AUDITED_REVISION && environmentCountMismatches.length) {
    throw new Error(
      `Audited Open Logic active-environment baseline mismatch: ${environmentCountMismatches
        .map(({ name, expected, actual }) => `${name} expected ${expected}, found ${actual}`)
        .join("; ")}`,
    );
  }
  const artifactManifest = {
    entryFile: ENTRY_FILE,
    sourceRevision: commit.toLowerCase(),
    configurationFiles: collected.configurationFiles,
    orderedImportInstances: collected.units.map((unit) => ({
      path: unit.path,
      ordinal: unit.ordinal,
      pathOccurrence: unit.pathOccurrence,
      contextDigest: unit.contextDigest,
      contentSha256: sha256(unit.content),
      activeContentSha256: sha256(unit.activeContent),
    })),
  };
  const artifactSha256 = sha256(canonicalJson(artifactManifest));
  const unitManifestSha256 = sha256(canonicalJson(extracted.sourceUnits));
  const sourceBoundary = {
    entryFile: ENTRY_FILE,
    configurationFiles: collected.configurationFiles,
    missingImports: collected.missingImports,
    cyclicImports: collected.cyclicImports,
    sourcePathCount: collected.sourcePathCount,
    duplicateImportInstanceCount: collected.duplicateImportInstanceCount,
    evaluatedConditionalCount: collected.evaluatedConditionalCount,
    unevaluatedConditionalCount: collected.unevaluatedConditionalCount,
  };
  const sourceBoundarySha256 = sha256(canonicalJson(sourceBoundary));
  const extractionArtifactSha256 = sha256(canonicalJson({
    sourceUnits: extracted.sourceUnits,
    unitInventories: extracted.unitInventories,
  }));
  const graphArtifactSha256 = sha256(canonicalJson(extracted.graph));
  const boundaryDebt = [
    collected.missingImports.length ? `${collected.missingImports.length} missing import target(s)` : null,
    collected.cyclicImports.length ? `${collected.cyclicImports.length} cyclic import occurrence(s)` : null,
    collected.unevaluatedConditionalCount
      ? `${collected.unevaluatedConditionalCount} raw TeX conditional occurrence(s) not semantically evaluated`
      : null,
    environmentCountMismatches.length
      ? `${environmentCountMismatches.length} active formal-environment baseline mismatch(es)`
      : null,
  ].filter(Boolean);
  const boundaryDebtNote = boundaryDebt.length
    ? ` Remaining source-boundary debt: ${boundaryDebt.join(", ")}.`
    : "";
  return {
    file: {
      ...baseFile,
      exactEdition: {
        editionId: `${baseFile.identity.sourceRecordId.toLowerCase()}-open-logic-${commit.slice(0, 12)}`,
        label: "The Open Logic Text — Complete Build",
        publicationYear: null,
        publisher: "The Open Logic Project",
        stableLocator: `${sourceRepository}/tree/${commit}`,
        sourceFormat: "latex",
        accessKind: "open",
        licenseSpdx: "CC-BY-4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        licenseNote: "Candidate edition-level license metadata follows the official project source and README for the pinned repository revision; not independently reviewed.",
        sourceRepository,
        sourceRevision: commit.toLowerCase(),
        artifactSha256,
        unitManifestSha256,
        sourceUnitKind: "source-file",
      },
      sourceUnits: extracted.sourceUnits,
      unitInventories: extracted.unitInventories,
      graph: extracted.graph,
      extractionState: {
        status: "extracted",
        extractionAudit: {
          actorId: ACTOR_ID,
          completedAt: capturedAt,
          artifactSha256: extractionArtifactSha256,
          sourceUnitCount: extracted.sourceUnits.length,
          unitInventoryCount: extracted.unitInventories.length,
        },
        independentReview: null,
        note: `Deterministic candidate inventory from ${extracted.sourceUnits.length} ordered active import instances (${collected.sourcePathCount} unique paths, ${collected.duplicateImportInstanceCount} duplicate-context instances) rooted at ${ENTRY_FILE} in the pinned official source. Default and complete-build tag declarations plus balanced \\iftag/\\tagitem branches were evaluated; no independent review is claimed.${boundaryDebtNote} Source-boundary manifest SHA-256: ${sourceBoundarySha256}.`,
      },
      graphState: {
        status: "extracted",
        graphAudit: {
          actorId: ACTOR_ID,
          completedAt: capturedAt,
          artifactSha256: graphArtifactSha256,
          nodeCount: extracted.graph.nodes.length,
          externalInputCount: 0,
          directDependencyCount: extracted.graph.directDependencies.length,
          proofRouteCount: extracted.graph.proofRoutes.length,
          referenceCount: extracted.graph.references.length,
        },
        independentReview: null,
        note: `${extracted.stats.directDependencyCount} candidate edge(s) come only from exact proof-local \\olref/\\Olref, raw \\cref/\\Cref/\\eqref, or active \\tagrefs syntax. ${extracted.stats.pendingTheoremCount} theorem-like node(s) remain dependency-pending; empty and source-artifact-only routes are not roots. ${extracted.stats.unresolvedReferenceCount} source reference(s) remain unresolved, ${extracted.stats.sourceArtifactCount} raw proof-reference target(s) require classification, and no mathematical review or completeness is claimed.`,
      },
    },
    stats: {
      ...extracted.stats,
      sourceUnitCount: extracted.sourceUnits.length,
      sourcePathCount: collected.sourcePathCount,
      duplicateImportInstanceCount: collected.duplicateImportInstanceCount,
      missingImportCount: collected.missingImports.length,
      cyclicImportCount: collected.cyclicImports.length,
      evaluatedConditionalCount: collected.evaluatedConditionalCount,
      unevaluatedConditionalCount: collected.unevaluatedConditionalCount,
      expectedEnvironmentCounts,
      environmentCountMismatches,
      expectedEnvironmentCountMismatchCount: environmentCountMismatches.length,
      sourceBoundarySha256,
      artifactSha256,
      unitManifestSha256,
      extractionArtifactSha256,
      graphArtifactSha256,
    },
  };
}
