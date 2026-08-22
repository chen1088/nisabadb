import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const GRAPH_NODE_TAGS = new Map([
  ["theorem", { nodeClass: "theorem-like", kind: "theorem" }],
  ["lemma", { nodeClass: "theorem-like", kind: "lemma" }],
  ["proposition", { nodeClass: "theorem-like", kind: "proposition" }],
  ["corollary", { nodeClass: "theorem-like", kind: "corollary" }],
  ["claim", { nodeClass: "theorem-like", kind: "claim" }],
  ["principle", { nodeClass: "theorem-like", kind: "named-result" }],
  ["fact", { nodeClass: "theorem-like", kind: "named-result" }],
  ["identity", { nodeClass: "theorem-like", kind: "named-result" }],
  ["definition", { nodeClass: "support", kind: "definition" }],
  ["axiom", { nodeClass: "support", kind: "axiom" }],
  ["assumption", { nodeClass: "support", kind: "assumption" }],
  ["notation", { nodeClass: "support", kind: "notation" }],
  ["construction", { nodeClass: "support", kind: "construction" }],
  ["algorithm", { nodeClass: "support", kind: "algorithm" }],
]);

const ENTITY_REPLACEMENTS = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", "\""],
  ["apos", "'"],
  ["nbsp", " "],
  ["mdash", "—"],
  ["ndash", "–"],
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  return JSON.stringify(value);
}

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9.-]*);/gi, (match, entity) => {
    if (entity.startsWith("#x")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITY_REPLACEMENTS.get(entity.toLowerCase()) ?? match;
  });
}

function normalizeText(value) {
  return decodeEntities(value).replace(/\s+/gu, " ").trim();
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function markupEnd(source, start) {
  if (source.startsWith("<!--", start)) {
    const end = source.indexOf("-->", start + 4);
    return end < 0 ? source.length : end + 3;
  }
  if (source.startsWith("<![CDATA[", start)) {
    const end = source.indexOf("]]>", start + 9);
    return end < 0 ? source.length : end + 3;
  }
  if (source.startsWith("<?", start)) {
    const end = source.indexOf("?>", start + 2);
    return end < 0 ? source.length : end + 2;
  }

  let quote = "";
  let bracketDepth = 0;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") bracketDepth += 1;
    else if (character === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (character === ">" && bracketDepth === 0) return index + 1;
  }
  return source.length;
}

function attributesFromToken(token) {
  const attributes = {};
  const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(["'])([\s\S]*?)\2/g;
  for (const match of token.matchAll(attributePattern)) {
    attributes[match[1]] = decodeEntities(match[3]);
  }
  return attributes;
}

export function parsePretextXml(source, filePath = "fixture.ptx") {
  const document = {
    type: "element",
    name: "#document",
    attributes: {},
    children: [],
    filePath,
    source,
    start: 0,
    end: source.length,
    startLine: 1,
    endLine: lineAt(source, source.length),
    parent: null,
  };
  const stack = [document];
  let cursor = 0;

  const appendText = (value, start, end) => {
    if (!value) return;
    stack.at(-1).children.push({
      type: "text",
      value,
      start,
      end,
      parent: stack.at(-1),
    });
  };

  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) {
      appendText(source.slice(cursor), cursor, source.length);
      break;
    }
    appendText(source.slice(cursor, tagStart), cursor, tagStart);
    const tagEnd = markupEnd(source, tagStart);
    const token = source.slice(tagStart, tagEnd);
    cursor = tagEnd;

    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!DOCTYPE")) {
      continue;
    }
    if (token.startsWith("<![CDATA[")) {
      appendText(token.slice(9, -3), tagStart, tagEnd);
      continue;
    }
    if (/^<!/u.test(token)) continue;

    const closing = token.match(/^<\s*\/\s*([A-Za-z_:][A-Za-z0-9_.:-]*)\s*>$/u);
    if (closing) {
      const closingName = closing[1].toLowerCase();
      let matchIndex = stack.length - 1;
      while (matchIndex > 0 && stack[matchIndex].name !== closingName) matchIndex -= 1;
      if (matchIndex === 0) continue;
      while (stack.length - 1 >= matchIndex) {
        const completed = stack.pop();
        completed.end = tagEnd;
        completed.endLine = lineAt(source, tagEnd);
      }
      continue;
    }

    const opening = token.match(/^<\s*([A-Za-z_:][A-Za-z0-9_.:-]*)/u);
    if (!opening) continue;
    const element = {
      type: "element",
      name: opening[1].toLowerCase(),
      attributes: attributesFromToken(token),
      children: [],
      filePath,
      source,
      start: tagStart,
      end: tagEnd,
      startLine: lineAt(source, tagStart),
      endLine: lineAt(source, tagEnd),
      parent: stack.at(-1),
    };
    stack.at(-1).children.push(element);
    if (!/\/\s*>$/u.test(token)) stack.push(element);
  }

  while (stack.length > 1) {
    const unfinished = stack.pop();
    unfinished.end = source.length;
    unfinished.endLine = lineAt(source, source.length);
  }
  return document;
}

function walkElements(node, visit) {
  if (node.type !== "element") return;
  visit(node);
  for (const child of node.children) walkElements(child, visit);
}

function descendantElements(node, name) {
  const matches = [];
  for (const child of node.children) {
    walkElements(child, (candidate) => {
      if (candidate.name === name) matches.push(candidate);
    });
  }
  return matches;
}

function firstDirectElement(node, name) {
  return node.children.find((child) => child.type === "element" && child.name === name);
}

function textContent(node, { skip = new Set() } = {}) {
  if (node.type === "text") return node.value;
  if (skip.has(node.name)) return "";
  return node.children.map((child) => textContent(child, { skip })).join(" ");
}

function sourceSlice(node) {
  return node.source.slice(node.start, node.end);
}

function safeSlug(value) {
  const slug = String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_:.\\/]+/gu, "-")
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return /^[a-z0-9]/u.test(slug) ? slug : `id-${slug || "item"}`;
}

function uniqueStableId(preferred, fallback, usedIds) {
  const base = safeSlug(preferred || fallback);
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  const suffix = sha256(`${preferred}\0${fallback}`).slice(0, 10);
  const candidate = `${base}-${suffix}`;
  if (usedIds.has(candidate)) throw new Error(`Unable to create a unique deterministic ID for ${fallback}`);
  usedIds.add(candidate);
  return candidate;
}

function nodeLocator(node, sourceXmlId) {
  const suffix = sourceXmlId ? `#${sourceXmlId}` : `:L${node.startLine}-L${node.endLine}`;
  return `${node.filePath}${suffix}`;
}

function kindLabel(kind) {
  return kind.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function nearestContextText(xref, boundary) {
  let current = xref.parent;
  while (current && current !== boundary && !["p", "statement", "proof"].includes(current.name)) {
    current = current.parent;
  }
  const contextNode = current && current !== boundary ? current : boundary;
  const text = normalizeText(textContent(contextNode, { skip: new Set(["idx"]) }));
  return text.length <= 400 ? text : `${text.slice(0, 397)}...`;
}

function hasAncestorBefore(node, ancestorName, boundary) {
  let current = node.parent;
  while (current && current !== boundary) {
    if (current.name === ancestorName) return true;
    current = current.parent;
  }
  return false;
}

function capturedEvidence({ sourceUnitId, locator, artifactSha256, capturedAt, note }) {
  return {
    status: "captured",
    sourceUnitIds: [sourceUnitId],
    locator,
    captureAudit: {
      actorId: "pretext-book-importer",
      capturedAt,
      artifactSha256,
    },
    independentReview: null,
    note,
  };
}

function sourceUnitId(relativePath, usedIds) {
  return uniqueStableId(`unit-${relativePath.replace(/\.ptx$/iu, "")}`, relativePath, usedIds);
}

function includesIn(source) {
  const document = parsePretextXml(source, "include-scan.ptx");
  const includes = [];
  walkElements(document, (element) => {
    if (element.name !== "xi:include") return;
    const href = element.attributes.href;
    if (!href) return;
    includes.push({ href, parse: element.attributes.parse ?? "xml", line: element.startLine });
  });
  return includes;
}

function assertContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`PreTeXt include escapes the checkout: ${candidate}`);
  }
}

export function collectPretextSourceUnits(checkoutRoot, entryFile = "source/dmoi.ptx") {
  const root = path.resolve(checkoutRoot);
  const realRoot = fs.realpathSync(root);
  const ordered = [];
  const visited = new Set();
  const missingIncludes = [];
  const embeddedTextIncludes = [];

  const visit = (relativePath) => {
    const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/").replace(/^\.\//u, ""));
    if (normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
      throw new Error(`Unsafe PreTeXt source path: ${relativePath}`);
    }
    if (visited.has(normalized)) return;
    const absolute = path.resolve(root, ...normalized.split("/"));
    assertContained(root, absolute);
    if (!fs.existsSync(absolute)) {
      missingIncludes.push(normalized);
      return;
    }
    const realAbsolute = fs.realpathSync(absolute);
    assertContained(realRoot, realAbsolute);
    visited.add(normalized);
    const content = fs.readFileSync(realAbsolute, "utf8");
    ordered.push({ path: normalized, content });
    for (const include of includesIn(content)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), include.href));
      if (include.parse === "text" || !target.endsWith(".ptx")) {
        embeddedTextIncludes.push({ ownerPath: normalized, target, line: include.line });
        continue;
      }
      const targetAbsolute = path.resolve(root, ...target.split("/"));
      assertContained(root, targetAbsolute);
      if (!fs.existsSync(targetAbsolute)) {
        missingIncludes.push(target);
        continue;
      }
      visit(target);
    }
  };

  visit(entryFile);
  return {
    units: ordered,
    missingIncludes: [...new Set(missingIncludes)].sort(),
    embeddedTextIncludes,
  };
}

function buildSourceUnits(units) {
  const usedIds = new Set();
  const sourceUnits = units.map((unit, index) => ({
    id: sourceUnitId(unit.path, usedIds),
    ordinal: index + 1,
    label: unit.path,
    locator: unit.path,
    contentSha256: sha256(unit.content),
  }));
  return {
    sourceUnits,
    sourceUnitIdByPath: new Map(sourceUnits.map((unit) => [unit.locator, unit.id])),
    usedIds,
  };
}

function graphCandidates(units) {
  const candidates = [];
  const documents = [];
  for (const unit of units) {
    const document = parsePretextXml(unit.content, unit.path);
    documents.push(document);
    const fileOrdinals = new Map();
    walkElements(document, (element) => {
      const mapping = GRAPH_NODE_TAGS.get(element.name);
      if (!mapping) return;
      const ordinal = (fileOrdinals.get(element.name) ?? 0) + 1;
      fileOrdinals.set(element.name, ordinal);
      candidates.push({ element, mapping, ordinal });
    });
  }
  return { candidates, documents };
}

function dependencyRole(targetNode) {
  if (targetNode.kind === "definition") return "definition";
  if (targetNode.kind === "notation") return "notation";
  if (targetNode.kind === "construction") return "construction";
  if (targetNode.kind === "calculation") return "calculation";
  return "logical";
}

export function extractPretextGraphFromUnits(units, {
  capturedAt = "2000-01-01T00:00:00.000Z",
} = {}) {
  const { sourceUnits, sourceUnitIdByPath, usedIds } = buildSourceUnits(units);
  const { candidates, documents } = graphCandidates(units);
  const nodeMetadata = [];
  const graphNodeByXmlId = new Map();
  const ambiguousXmlIds = new Set();

  for (const candidate of candidates) {
    const { element, mapping, ordinal } = candidate;
    const sourceXmlId = element.attributes["xml:id"] ?? null;
    const fileSlug = safeSlug(element.filePath.replace(/\.ptx$/iu, ""));
    const fallbackId = `${element.name}-${fileSlug}-${String(ordinal).padStart(4, "0")}`;
    const id = uniqueStableId(sourceXmlId, fallbackId, usedIds);
    const statementElement = firstDirectElement(element, "statement");
    const titleElement = firstDirectElement(element, "title");
    const normalizedStatement = normalizeText(textContent(statementElement ?? element, {
      skip: statementElement ? new Set(["idx"]) : new Set(["idx", "title", "proof", "solution"]),
    })) || `${kindLabel(mapping.kind)} recorded at ${element.filePath}, line ${element.startLine}.`;
    const title = normalizeText(textContent(titleElement ?? { type: "text", value: "" }))
      || `${kindLabel(mapping.kind)} at ${path.posix.basename(element.filePath)}:${element.startLine}`;
    const locator = nodeLocator(element, sourceXmlId);
    const rawElement = sourceSlice(element);
    const sourceUnitId = sourceUnitIdByPath.get(element.filePath);
    if (!sourceUnitId) throw new Error(`Missing source unit for ${element.filePath}`);
    const node = {
      id,
      nodeClass: mapping.nodeClass,
      kind: mapping.kind,
      sourceLabel: sourceXmlId ? `${kindLabel(mapping.kind)} (${sourceXmlId})` : kindLabel(mapping.kind),
      title,
      sourceXmlId,
      sourceLocator: locator,
      normalizedStatement,
      sourceTextSha256: sha256(rawElement),
      evidence: capturedEvidence({
        sourceUnitId,
        locator,
        artifactSha256: sha256(rawElement),
        capturedAt,
        note: "Deterministic candidate extraction from the pinned PreTeXt source; not independently reviewed.",
      }),
    };
    nodeMetadata.push({ node, element, sourceUnitId });
    if (sourceXmlId) {
      if (graphNodeByXmlId.has(sourceXmlId)) ambiguousXmlIds.add(sourceXmlId);
      else graphNodeByXmlId.set(sourceXmlId, node);
    }
  }
  for (const ambiguousId of ambiguousXmlIds) graphNodeByXmlId.delete(ambiguousId);

  const references = [];
  const proofReferencesByPair = new Map();
  const metadataByElement = new Map(nodeMetadata.map((metadata) => [metadata.element, metadata]));
  const proofElementsByTheoremId = new Map(
    nodeMetadata
      .filter(({ node }) => node.nodeClass === "theorem-like")
      .map(({ node, element }) => [node.id, descendantElements(element, "proof")]),
  );
  let referenceOrdinal = 0;

  const captureReference = ({
    node,
    ownerElement,
    xref,
    sourceUnitId,
    basis,
    associationKind,
  }) => {
    const ref = xref.attributes.ref ?? "missing-ref-attribute";
    const targetNode = graphNodeByXmlId.get(ref);
    const isSelfReference = targetNode?.id === node.id;
    const structuralAssociation = associationKind === "preceding-sibling-proof";
    const locator = `${xref.filePath}:L${xref.startLine}`;
    const rawXref = sourceSlice(xref);
    referenceOrdinal += 1;
    const reference = {
      id: uniqueStableId(
        `ref-${node.id}-${basis}-${String(referenceOrdinal).padStart(5, "0")}`,
        `${xref.filePath}:${xref.startLine}:${ref}`,
        usedIds,
      ),
      ownerNodeId: node.id,
      basis,
      ref,
      context: nearestContextText(xref, ownerElement) || `PreTeXt ${basis} to ${ref}.`,
      locator,
      resolution: targetNode && !(basis === "proof-xref" && isSelfReference)
        ? {
            status: "resolved",
            target: { type: "node", id: targetNode.id },
            directDependencyId: null,
            note: structuralAssociation
              ? "The xref target is an unambiguous inventoried graph node. Its standalone proof is associated with the nearest preceding theorem-like sibling as a deterministic structural candidate; not independently reviewed."
              : "The xref target is an unambiguous inventoried graph node; this candidate resolution is not independently reviewed.",
          }
        : {
            status: "unresolved",
            note: isSelfReference
              ? "The proof xref points back to its owner, so it cannot form a direct dependency."
              : "The xref target is absent from, or ambiguous within, the inventoried graph nodes.",
          },
      evidence: capturedEvidence({
        sourceUnitId,
        locator,
        artifactSha256: sha256(rawXref),
        capturedAt,
        note: structuralAssociation
          ? "Captured proof-xref from a standalone PreTeXt proof associated deterministically with the nearest preceding theorem-like sibling; structural candidate only, not independently reviewed."
          : `Captured ${basis} from the pinned PreTeXt source; classification is not independently reviewed.`,
      }),
    };
    references.push(reference);
    if (basis === "proof-xref" && targetNode && !isSelfReference) {
      const pair = `${node.id}\0${targetNode.id}`;
      const group = proofReferencesByPair.get(pair) ?? {
        dependentNode: node,
        targetNode,
        references: [],
        sourceUnitIds: new Set(),
        associationKinds: new Set(),
      };
      group.references.push(reference);
      group.sourceUnitIds.add(sourceUnitId);
      group.associationKinds.add(associationKind);
      proofReferencesByPair.set(pair, group);
    }
  };

  for (const { node, element, sourceUnitId } of nodeMetadata) {
    for (const xref of descendantElements(element, "xref")) {
      const inProof = hasAncestorBefore(xref, "proof", element);
      const inStatement = hasAncestorBefore(xref, "statement", element);
      if (!inProof && !inStatement) continue;
      captureReference({
        node,
        ownerElement: element,
        xref,
        sourceUnitId,
        basis: inProof ? "proof-xref" : "statement-xref",
        associationKind: inProof ? "nested-proof" : "node-statement",
      });
    }
  }

  const associateStandaloneProofs = (container, graphAncestor = null) => {
    const containerMapping = GRAPH_NODE_TAGS.get(container.name);
    const nextGraphAncestor = containerMapping ? container : graphAncestor;
    const children = container.children?.filter((child) => child.type === "element") ?? [];
    if (!nextGraphAncestor) {
      for (let index = 0; index < children.length; index += 1) {
        const proof = children[index];
        if (proof.name !== "proof") continue;
        let precedingTheorem;
        for (let previous = index - 1; previous >= 0; previous -= 1) {
          const sibling = children[previous];
          if (GRAPH_NODE_TAGS.get(sibling.name)?.nodeClass === "theorem-like") {
            precedingTheorem = sibling;
            break;
          }
        }
        if (!precedingTheorem || descendantElements(precedingTheorem, "proof").length > 0) continue;
        const metadata = metadataByElement.get(precedingTheorem);
        if (!metadata) continue;
        const associatedProofs = proofElementsByTheoremId.get(metadata.node.id) ?? [];
        associatedProofs.push(proof);
        proofElementsByTheoremId.set(metadata.node.id, associatedProofs);
        for (const xref of descendantElements(proof, "xref")) {
          captureReference({
            node: metadata.node,
            ownerElement: proof,
            xref,
            sourceUnitId: metadata.sourceUnitId,
            basis: "proof-xref",
            associationKind: "preceding-sibling-proof",
          });
        }
      }
    }
    for (const child of children) associateStandaloneProofs(child, nextGraphAncestor);
  };
  for (const document of documents) associateStandaloneProofs(document);

  const directDependencies = [];
  const dependencyIdsByTheorem = new Map();
  for (const group of proofReferencesByPair.values()) {
    const structurallyAssociated = group.associationKinds.has("preceding-sibling-proof");
    const dependencyId = uniqueStableId(
      `dep-${group.dependentNode.id}-to-${group.targetNode.id}`,
      `${group.dependentNode.id}:${group.targetNode.id}`,
      usedIds,
    );
    const locators = group.references.map((reference) => reference.locator);
    const evidenceHash = sha256(canonicalJson(group.references.map((reference) => ({
      ref: reference.ref,
      locator: reference.locator,
      evidenceSha256: reference.evidence.captureAudit.artifactSha256,
    }))));
    const dependency = {
      id: dependencyId,
      dependentNodeId: group.dependentNode.id,
      prerequisite: { type: "node", id: group.targetNode.id },
      role: dependencyRole(group.targetNode),
      rationale: structurallyAssociated
        ? `A standalone source proof is associated with the nearest preceding theorem-like sibling and explicitly references ${group.targetNode.sourceLabel} via PreTeXt xref.`
        : `The source proof explicitly references ${group.targetNode.sourceLabel} via PreTeXt xref.`,
      evidence: {
        status: "captured",
        sourceUnitIds: [...group.sourceUnitIds],
        locator: locators.join("; "),
        captureAudit: {
          actorId: "pretext-book-importer",
          capturedAt,
          artifactSha256: evidenceHash,
        },
        independentReview: null,
        note: `${group.references.length} explicit proof xref${group.references.length === 1 ? "" : "s"} merged into one candidate dependency; ${structurallyAssociated ? "the standalone proof-to-theorem association is a deterministic structural candidate; " : ""}not independently reviewed.`,
      },
    };
    directDependencies.push(dependency);
    for (const reference of group.references) {
      reference.resolution.directDependencyId = dependencyId;
    }
    const dependencyIds = dependencyIdsByTheorem.get(group.dependentNode.id) ?? [];
    dependencyIds.push(dependencyId);
    dependencyIdsByTheorem.set(group.dependentNode.id, dependencyIds);
  }

  const proofRoutes = [];
  for (const { node, element, sourceUnitId } of nodeMetadata) {
    if (node.nodeClass !== "theorem-like") continue;
    const dependencyIds = dependencyIdsByTheorem.get(node.id) ?? [];
    if (dependencyIds.length === 0) continue;
    const proofs = proofElementsByTheoremId.get(node.id) ?? [];
    const proofRaw = proofs.map(sourceSlice).join("\n");
    const locator = proofs.length
      ? proofs.map((proof) => `${proof.filePath}:L${proof.startLine}-L${proof.endLine}`).join("; ")
      : node.sourceLocator;
    proofRoutes.push({
      id: uniqueStableId(`route-${node.id}-source-proof`, `${node.id}:source-proof`, usedIds),
      theoremNodeId: node.id,
      routeKind: "source-proof",
      dependencyIds,
      summary: "Candidate source-faithful route containing only direct dependencies named by explicit xrefs inside the PreTeXt proof.",
      evidence: capturedEvidence({
        sourceUnitId,
        locator,
        artifactSha256: sha256(proofRaw || sourceSlice(element)),
        capturedAt,
        note: "Candidate route from explicit proof xrefs only; implicit prerequisites remain pending and no review is claimed.",
      }),
    });
  }

  const theoremCount = nodeMetadata.filter(({ node }) => node.nodeClass === "theorem-like").length;
  const pendingTheoremCount = theoremCount - proofRoutes.length;
  const unresolvedProofXrefCount = references.filter((reference) => (
    reference.basis === "proof-xref" && reference.resolution.status === "unresolved"
  )).length;
  const nodesBySourceUnitId = new Map(sourceUnits.map((unit) => [unit.id, {
    theoremNodeIds: [],
    supportNodeIds: [],
  }]));
  for (const { node, sourceUnitId } of nodeMetadata) {
    const inventory = nodesBySourceUnitId.get(sourceUnitId);
    if (!inventory) throw new Error(`Missing source-unit inventory for ${sourceUnitId}`);
    if (node.nodeClass === "theorem-like") inventory.theoremNodeIds.push(node.id);
    else inventory.supportNodeIds.push(node.id);
  }
  const unitInventories = sourceUnits.map((unit) => {
    const inventory = nodesBySourceUnitId.get(unit.id);
    if (!inventory) throw new Error(`Missing source-unit inventory for ${unit.id}`);
    return {
      sourceUnitId: unit.id,
      theoremNodeIds: inventory.theoremNodeIds,
      supportNodeIds: inventory.supportNodeIds,
      theoremFreeAttestation: inventory.theoremNodeIds.length === 0,
      evidence: capturedEvidence({
        sourceUnitId: unit.id,
        locator: unit.locator,
        artifactSha256: unit.contentSha256,
        capturedAt,
        note: inventory.theoremNodeIds.length === 0
          ? "Deterministic candidate scan found no inventoried theorem-like elements in this complete pinned source unit; theorem-free attestation is captured, not independently reviewed."
          : `Deterministic candidate scan assigned ${inventory.theoremNodeIds.length} theorem-like and ${inventory.supportNodeIds.length} support node(s) to this complete pinned source unit; not independently reviewed.`,
      }),
    };
  });

  return {
    sourceUnits,
    unitInventories,
    graph: {
      nodes: nodeMetadata.map(({ node }) => node),
      externalInputs: [],
      directDependencies,
      proofRoutes,
      references,
    },
    stats: {
      theoremCount,
      supportCount: nodeMetadata.length - theoremCount,
      directDependencyCount: directDependencies.length,
      proofRouteCount: proofRoutes.length,
      referenceCount: references.length,
      unresolvedProofXrefCount,
      statementXrefCount: references.filter((reference) => reference.basis === "statement-xref").length,
      pendingTheoremCount,
      ambiguousGraphXmlIdCount: ambiguousXmlIds.size,
      unitInventoryCount: unitInventories.length,
      theoremFreeUnitCount: unitInventories.filter((inventory) => inventory.theoremFreeAttestation).length,
    },
  };
}

function inferredEditionLabel(units) {
  const rootUnit = units.find((unit) => unit.path.endsWith("source/dmoi.ptx")) ?? units[0];
  if (!rootUnit) return "Pinned official PreTeXt edition";
  const document = parsePretextXml(rootUnit.content, rootUnit.path);
  let book;
  walkElements(document, (element) => {
    if (!book && element.name === "book") book = element;
  });
  if (!book) return "Pinned official PreTeXt edition";
  const title = normalizeText(textContent(firstDirectElement(book, "title") ?? { type: "text", value: "" }));
  const subtitle = normalizeText(textContent(firstDirectElement(book, "subtitle") ?? { type: "text", value: "" }));
  return [title, subtitle].filter(Boolean).join(": ") || "Pinned official PreTeXt edition";
}

function inferredPublicationYear(units) {
  for (const unit of units) {
    const document = parsePretextXml(unit.content, unit.path);
    const text = normalizeText(textContent(document));
    const released = text.match(/\breleased\s+in\s+(?:[A-Za-z]+\s+)?((?:19|20|21)\d{2})\b/iu);
    if (released) return Number.parseInt(released[1], 10);
  }
  return null;
}

function licenseFromText(source) {
  if (/creativecommons\.org\/licenses\/by-nc-sa\/4\.0\//iu.test(source)) {
    return {
      licenseSpdx: "CC-BY-NC-SA-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    };
  }
  if (/creativecommons\.org\/licenses\/by-sa\/4\.0\//iu.test(source)) {
    return {
      licenseSpdx: "CC-BY-SA-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    };
  }
  return { licenseSpdx: null, licenseUrl: null };
}

function inferredLicense(units, checkoutRoot) {
  const editionLicense = licenseFromText(units.map((unit) => unit.content).join("\n"));
  const repositoryLicensePath = ["LICENSE", "LICENSE.md", "LICENSE.txt"]
    .map((name) => path.join(checkoutRoot, name))
    .find((candidate) => fs.existsSync(candidate));
  const repositoryLicense = repositoryLicensePath
    ? licenseFromText(fs.readFileSync(repositoryLicensePath, "utf8"))
    : { licenseSpdx: null, licenseUrl: null };
  const conflict = editionLicense.licenseSpdx
    && repositoryLicense.licenseSpdx
    && editionLicense.licenseSpdx !== repositoryLicense.licenseSpdx;
  return {
    ...editionLicense,
    licenseNote: conflict
      ? `The active book source states ${editionLicense.licenseSpdx}, while the repository-level LICENSE states ${repositoryLicense.licenseSpdx}. This candidate edition metadata follows the active book source; the conflict remains pending review.`
      : editionLicense.licenseSpdx
        ? `Candidate license metadata inferred from the active pinned book source (${editionLicense.licenseSpdx}); not independently reviewed.`
        : "No unambiguous edition-level license was detected in the active pinned book source; license identification remains pending review.",
  };
}

export function buildPretextBookFile({
  baseFile,
  checkoutRoot,
  commit,
  capturedAt,
  sourceRepository = "https://github.com/oscarlevin/discrete-book",
  entryFile = "source/dmoi.ptx",
}) {
  if (!/^[0-9a-f]{40}$/iu.test(commit)) throw new Error("--commit must be a full 40-character Git commit");
  const collected = collectPretextSourceUnits(checkoutRoot, entryFile);
  if (collected.units.length === 0) throw new Error("The PreTeXt source graph is empty");
  const extracted = extractPretextGraphFromUnits(collected.units, { capturedAt });
  const artifactManifest = collected.units.map((unit) => ({
    path: unit.path,
    contentSha256: sha256(unit.content),
  }));
  const artifactSha256 = sha256(canonicalJson(artifactManifest));
  const unitManifestSha256 = sha256(canonicalJson(extracted.sourceUnits));
  const extractionArtifactSha256 = sha256(canonicalJson({
    sourceUnits: extracted.sourceUnits,
    unitInventories: extracted.unitInventories,
  }));
  const graphArtifactSha256 = sha256(canonicalJson(extracted.graph));
  const license = inferredLicense(collected.units, checkoutRoot);
  const missingIncludeNote = collected.missingIncludes.length
    ? ` ${collected.missingIncludes.length} active PTX include target(s) were absent in the pinned checkout: ${collected.missingIncludes.join(", ")}.`
    : "";

  return {
    file: {
      ...baseFile,
      exactEdition: {
        editionId: `${baseFile.identity.sourceRecordId.toLowerCase()}-pretext-${commit.slice(0, 12)}`,
        label: inferredEditionLabel(collected.units),
        publicationYear: inferredPublicationYear(collected.units),
        publisher: null,
        stableLocator: `${sourceRepository}/tree/${commit}`,
        artifactSha256,
        unitManifestSha256,
        sourceUnitKind: "source-file",
        sourceFormat: "pretext-xml",
        accessKind: "open",
        licenseSpdx: license.licenseSpdx,
        licenseUrl: license.licenseUrl,
        licenseNote: license.licenseNote,
        sourceRepository,
        sourceRevision: commit,
      },
      sourceUnits: extracted.sourceUnits,
      unitInventories: extracted.unitInventories,
      graph: extracted.graph,
      extractionState: {
        status: "extracted",
        extractionAudit: {
          actorId: "pretext-book-importer",
          completedAt: capturedAt,
          artifactSha256: extractionArtifactSha256,
          sourceUnitCount: extracted.sourceUnits.length,
          unitInventoryCount: extracted.unitInventories.length,
        },
        independentReview: null,
        note: `Deterministic candidate inventory from the official PreTeXt source at ${commit}; no independent review is claimed.${missingIncludeNote}`,
      },
      graphState: {
        status: "extracted",
        graphAudit: {
          actorId: "pretext-book-importer",
          completedAt: capturedAt,
          artifactSha256: graphArtifactSha256,
          nodeCount: extracted.graph.nodes.length,
          externalInputCount: extracted.graph.externalInputs.length,
          directDependencyCount: extracted.graph.directDependencies.length,
          proofRouteCount: extracted.graph.proofRoutes.length,
          referenceCount: extracted.graph.references.length,
        },
        independentReview: null,
        note: `${extracted.stats.directDependencyCount} candidate edge(s) come only from explicit xrefs inside proofs. ${extracted.stats.pendingTheoremCount} theorem-like node(s) have no resolved explicit proof dependency and remain pending, not roots. ${extracted.stats.unresolvedProofXrefCount} proof xref(s) remain unresolved. No graph review or completeness is claimed.`,
      },
    },
    stats: {
      ...extracted.stats,
      sourceUnitCount: extracted.sourceUnits.length,
      missingIncludeCount: collected.missingIncludes.length,
      embeddedTextIncludeCount: collected.embeddedTextIncludes.length,
      artifactSha256,
      unitManifestSha256,
      extractionArtifactSha256,
      graphArtifactSha256,
    },
  };
}
