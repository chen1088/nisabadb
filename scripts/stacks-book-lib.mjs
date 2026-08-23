import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const GRAPH_ENVIRONMENTS = new Map([
  ["definition", { nodeClass: "support", kind: "definition" }],
  ["situation", { nodeClass: "support", kind: "assumption" }],
  ["lemma", { nodeClass: "theorem-like", kind: "lemma" }],
  ["proposition", { nodeClass: "theorem-like", kind: "proposition" }],
  ["theorem", { nodeClass: "theorem-like", kind: "theorem" }],
]);

const EXCLUDED_ENVIRONMENTS = ["example", "exercise", "remark", "remarks"];

const STRUCTURAL_BOUNDARY_PATTERN = /^\s*\\(?:chapter|section|subsection|subsubsection)\b/u;

// These permanent labels occur in exposition outside a strict formal environment.
// In each case the pinned source explicitly identifies the labeled display with the
// listed formal result. Keep this list narrow and source-audited; never infer an
// owner merely from proximity.
const CURATED_FORMAL_REFERENCE_ALIASES = new Map([
  ["sites-equation-map-representable-into-presheaf", "categories-lemma-yoneda"],
  ["derived-equation-long-exact-cohomology-sequence-D", "derived-lemma-cohomology-homological"],
  ["derived-equation-decompose", "derived-lemma-filtered-injective"],
  ["more-algebra-equation-first-ss-ext", "derived-lemma-two-ss-complex-functor"],
  ["dga-equation-les", "homology-lemma-long-exact-sequence-cochain"],
  ["coherent-equation-identify", "coherent-lemma-cohomology-projective-space-over-ring"],
  ["cotangent-equation-triangle", "cotangent-proposition-triangle"],
  ["spaces-more-morphisms-equation-equivalence-etale-spaces", "spaces-more-morphisms-theorem-topological-invariance"],
  ["algebraic-equation-morphisms-spaces", "categories-lemma-2-category-fibred-setoids"],
  ["spaces-cohomology-equation-representable-higher-direct-image", "spaces-properties-lemma-pushforward-etale-base-change-modules"],
  ["sites-cohomology-equation-commutative-epsilon", "sites-lemma-localize-morphism"],
  ["stacks-morphisms-equation-exact-sequence-isom", "stacks-morphisms-lemma-inertia"],
  ["schemes-equation-canonical-morphism", "schemes-lemma-morphism-from-spec-local-ring"],
  ["spaces-properties-equation-restrict", "spaces-properties-lemma-etale-morphism-topoi"],
  ["spaces-properties-equation-restrict-modules", "spaces-properties-lemma-etale-exact-pullback"],
  ["spaces-morphisms-equation-representable-pushforward", "spaces-properties-lemma-pushforward-etale-base-change-modules"],
  ["more-morphisms-equation-D", "more-morphisms-lemma-difference-derivation"],
  ["spaces-more-morphisms-equation-D", "spaces-more-morphisms-lemma-difference-derivation"],
  ["stacks-sheaves-equation-compare-big-small", "stacks-sheaves-lemma-compare-morphism"],
  ["proetale-equation-compare-big-small", "proetale-lemma-morphism-big-small"],
  ["formal-defos-equation-sequence", "algebra-lemma-differential-seq"],
  ["formal-defos-equation-sequence-extended", "algebra-lemma-exact-sequence-NL"],
  ["curves-equation-degree-c1", "chow-lemma-degree-vector-bundle"],
  ["derived-equation-everywhere", "derived-proposition-derived-functor"],
  ["divisors-equation-koszul", "modules-definition-koszul-complex"],
]);

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stripLatexComment(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashCount = 0;
    for (let previous = index - 1; previous >= 0 && line[previous] === "\\"; previous -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) return line.slice(0, index);
  }
  return line;
}

function normalizeWhitespace(value) {
  return value
    .split(/\r?\n/u)
    .map(stripLatexComment)
    .join("\n")
    .replace(/\\label\{[^{}]+\}/gu, " ")
    .replace(/\\begin\{(?:reference|slogan|history)\}[\s\S]*?\\end\{(?:reference|slogan|history)\}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanTitle(value) {
  return normalizeWhitespace(value)
    .replace(/[.\s]+$/u, "")
    .trim();
}

function lineContext(lines, lineNumber) {
  const line = stripLatexComment(lines[lineNumber - 1] ?? "")
    .replace(/\\ref\{[^{}]+\}/gu, "[reference]")
    .replace(/\\cite(?:\[[^\]]*\])?\{[^{}]+\}/gu, "[citation]")
    .replace(/\s+/gu, " ")
    .trim();
  return line.slice(0, 240) || `Explicit source reference on line ${lineNumber}.`;
}

function tagNodeId(tag) {
  return `tag-${tag.toLowerCase()}`;
}

function unitId(stem) {
  return `unit-${stem}`;
}

function sourceLabel(kind, tag) {
  return `${kind[0].toUpperCase()}${kind.slice(1)} (Tag ${tag})`;
}

function dependencyRole(node) {
  if (node.kind === "definition") return "definition";
  if (node.kind === "notation") return "notation";
  if (node.kind === "construction") return "construction";
  return "logical";
}

function capturedEvidence({ sourceUnitId, locator, artifactSha256, capturedAt, note }) {
  return {
    status: "captured",
    sourceUnitIds: [sourceUnitId],
    locator,
    captureAudit: {
      actorId: "stacks-latex-importer",
      capturedAt,
      artifactSha256,
    },
    independentReview: null,
    note,
  };
}

function findBalancedCommandArgument(source, command) {
  const marker = `\\${command}{`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let depth = 1;
  for (let index = start + marker.length; index < source.length; index += 1) {
    if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
    if (source[index] === "}" && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return source.slice(start + marker.length, index);
  }
  return null;
}

function labelArguments(source) {
  const labels = [];
  const pattern = /\\label\{([^{}]+)\}/gu;
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = stripLatexComment(rawLine);
    for (const match of line.matchAll(pattern)) labels.push(match[1]);
  }
  return labels;
}

function parseTagRows(tagText) {
  const fullLabelToTag = new Map();
  const tagToFullLabel = new Map();
  for (const rawLine of tagText.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const comma = line.indexOf(",");
    if (comma < 1) throw new Error(`Malformed Stacks tag row: ${rawLine}`);
    const tag = line.slice(0, comma);
    const fullLabel = line.slice(comma + 1);
    if (!/^[0-9A-Z]{4}$/u.test(tag) || !fullLabel) {
      throw new Error(`Malformed Stacks tag row: ${rawLine}`);
    }
    if (fullLabelToTag.has(fullLabel)) throw new Error(`Duplicate Stacks full label: ${fullLabel}`);
    if (tagToFullLabel.has(tag)) throw new Error(`Duplicate Stacks tag: ${tag}`);
    fullLabelToTag.set(fullLabel, tag);
    tagToFullLabel.set(tag, fullLabel);
  }
  return { fullLabelToTag, tagToFullLabel };
}

function resolveFullLabel(reference, stem, fullLabelToTag) {
  if (fullLabelToTag.has(reference)) return reference;
  const local = `${stem}-${reference}`;
  return fullLabelToTag.has(local) ? local : null;
}

function referencesInLines(lines, startLine, endLine) {
  const references = [];
  const pattern = /\\ref\{([^{}]+)\}/gu;
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const line = stripLatexComment(lines[lineNumber - 1] ?? "");
    for (const match of line.matchAll(pattern)) {
      references.push({ ref: match[1], lineNumber, context: lineContext(lines, lineNumber) });
    }
  }
  return references;
}

function citationsInLines(lines, startLine, endLine) {
  const citations = [];
  const pattern = /\\cite(?:\[([^\]]*)\])?\{([^{}]+)\}/gu;
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const line = stripLatexComment(lines[lineNumber - 1] ?? "");
    const commandCount = [...line.matchAll(/\\cite\b/gu)].length;
    let parsedCommandCount = 0;
    for (const match of line.matchAll(pattern)) {
      parsedCommandCount += 1;
      const pinpoint = match[1]?.trim() || null;
      for (const key of match[2].split(",").map((value) => value.trim()).filter(Boolean)) {
        citations.push({ key, pinpoint, lineNumber, context: lineContext(lines, lineNumber) });
      }
    }
    if (parsedCommandCount !== commandCount) {
      throw new Error(`Unsupported or multiline \\cite syntax on line ${lineNumber}`);
    }
  }
  return citations;
}

function bibliographyKeys(bibliographyText) {
  const keys = new Set();
  for (const match of bibliographyText.matchAll(/^\s*@[a-z]+\s*\{\s*([^,\s]+)\s*,/gimu)) {
    keys.add(match[1]);
  }
  return keys;
}

function explicitProofOwner(proofTitle, metadata, stem, tags) {
  if (!proofTitle) return null;
  const referencedLabels = [...proofTitle.matchAll(/\\ref\{([^{}]+)\}/gu)]
    .map((match) => resolveFullLabel(match[1], stem, tags.fullLabelToTag))
    .filter(Boolean);
  const candidates = metadata.filter((candidate) => (
    candidate.node.nodeClass === "theorem-like"
    && referencedLabels.includes(candidate.node.sourceXmlId)
  ));
  return candidates.length === 1 ? candidates[0] : null;
}

function isCompleteAlternativeProofTitle(title) {
  if (!title || /proof of part\b/iu.test(title)) return false;
  if (/^(?:First|Second|Third) proof\b/iu.test(title)) return true;
  return [
    /^Proof by naive method$/iu,
    /^Less naive proof$/iu,
    /^Proof (?:without )?using spectral sequences\.?$/iu,
    /^Proof not using Artin approximation$/iu,
    /^Proof using Gabriel-Rosenberg reconstruction$/iu,
    /^Proof not relying on Gabriel-Rosenberg reconstruction$/iu,
  ].some((pattern) => pattern.test(title));
}

function proofRouteGroups(proofs) {
  const alternatives = proofs
    .map((proof, index) => ({ proofs: [proof], ordinal: index + 1 }))
    .filter(({ proofs: [proof] }) => isCompleteAlternativeProofTitle(proof.title));
  return alternatives.length >= 2
    ? alternatives
    : [{ proofs, ordinal: 1 }];
}

function environmentRanges(lines, environment) {
  const beginPattern = new RegExp(`^\\s*\\\\begin\\{${environment}\\}(?:\\[[^\\]]*\\])?\\s*$`, "u");
  const endPattern = new RegExp(`^\\s*\\\\end\\{${environment}\\}\\s*$`, "u");
  const ranges = [];
  let start = null;
  let inVerbatim = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripLatexComment(lines[index]);
    if (!inVerbatim && /^\s*\\begin\{verbatim\}/u.test(line)) {
      inVerbatim = true;
      continue;
    }
    if (inVerbatim) {
      if (/^\s*\\end\{verbatim\}/u.test(line)) inVerbatim = false;
      continue;
    }
    if (start === null && beginPattern.test(line)) {
      start = index + 1;
      continue;
    }
    if (start !== null && endPattern.test(line)) {
      ranges.push({ startLine: start, endLine: index + 1 });
      start = null;
    }
  }
  if (start !== null) throw new Error(`Unclosed ${environment} environment beginning on line ${start}`);
  return ranges;
}

function extractSlogan(rawEnvironment) {
  const match = rawEnvironment.match(/\\begin\{slogan\}([\s\S]*?)\\end\{slogan\}/u);
  return match ? cleanTitle(match[1]) : null;
}

function graphNodesFromUnit(unit, tags, capturedAt) {
  const lines = unit.content.split(/\r?\n/u);
  const metadata = [];
  for (const [environment, mapping] of GRAPH_ENVIRONMENTS) {
    for (const range of environmentRanges(lines, environment)) {
      const rawEnvironment = lines.slice(range.startLine - 1, range.endLine).join("\n");
      const localLabel = findBalancedCommandArgument(rawEnvironment, "label");
      if (!localLabel) {
        throw new Error(`${unit.path}:${range.startLine} ${environment} has no label`);
      }
      const fullLabel = `${unit.stem}-${localLabel}`;
      const tag = tags.fullLabelToTag.get(fullLabel);
      if (!tag) throw new Error(`${unit.path}:${range.startLine} has no stable tag for ${fullLabel}`);
      const nodeId = tagNodeId(tag);
      const normalizedStatement = normalizeWhitespace(rawEnvironment
        .replace(new RegExp(`^\\s*\\\\begin\\{${environment}\\}(?:\\[[^\\]]*\\])?`, "u"), "")
        .replace(new RegExp(`\\\\end\\{${environment}\\}\\s*$`, "u"), ""));
      const locator = `${unit.path}:L${range.startLine}-L${range.endLine}`;
      const label = sourceLabel(mapping.kind, tag);
      const node = {
        id: nodeId,
        nodeClass: mapping.nodeClass,
        kind: mapping.kind,
        sourceLabel: label,
        title: extractSlogan(rawEnvironment) ?? label,
        sourceXmlId: fullLabel,
        sourceLocator: locator,
        normalizedStatement: normalizedStatement || label,
        sourceTextSha256: sha256(rawEnvironment),
        evidence: capturedEvidence({
          sourceUnitId: unitId(unit.stem),
          locator,
          artifactSha256: sha256(rawEnvironment),
          capturedAt,
          note: "Formal Stacks environment captured from the pinned LaTeX source; examples, exercises, and remarks are outside the graph policy.",
        }),
      };
      metadata.push({
        node,
        unit,
        environment,
        startLine: range.startLine,
        endLine: range.endLine,
        rawEnvironment,
        aliasFullLabels: labelArguments(rawEnvironment)
          .filter((label) => label !== localLabel)
          .map((label) => `${unit.stem}-${label}`),
        statementReferences: referencesInLines(lines, range.startLine, range.endLine),
      });
    }
  }
  metadata.sort((left, right) => left.startLine - right.startLine);

  const proofRanges = environmentRanges(lines, "proof");
  for (const proof of proofRanges) {
    const proofTitle = stripLatexComment(lines[proof.startLine - 1] ?? "")
      .match(/^\s*\\begin\{proof\}(?:\[([^\]]*)\])?\s*$/u)?.[1]?.trim() || null;
    const titledOwner = explicitProofOwner(proofTitle, metadata, unit.stem, tags);
    const precedingOwner = [...metadata]
      .reverse()
      .find((candidate) => (
        candidate.node.nodeClass === "theorem-like"
        && candidate.endLine < proof.startLine
      ));
    const owner = titledOwner ?? precedingOwner;
    if (!owner) continue;
    const crossesStructuralBoundary = lines
      .slice(owner.endLine, proof.startLine - 1)
      .some((line) => STRUCTURAL_BOUNDARY_PATTERN.test(stripLatexComment(line)));
    if (!titledOwner && crossesStructuralBoundary) continue;
    const existingProofs = owner.proofs ?? [];
    if (existingProofs.length > 0 && !proofTitle) continue;
    const rawProof = lines.slice(proof.startLine - 1, proof.endLine).join("\n");
    existingProofs.push({
      ...proof,
      title: proofTitle,
      rawProof,
      references: referencesInLines(lines, proof.startLine, proof.endLine),
      citations: citationsInLines(lines, proof.startLine, proof.endLine),
    });
    owner.proofs = existingProofs;
    owner.aliasFullLabels.push(...labelArguments(rawProof).map((label) => `${unit.stem}-${label}`));
  }
  return metadata;
}

function uniqueReferenceGroups({ references, owner, basis, nodeByFullLabel, tags }) {
  const groups = new Map();
  for (const reference of references) {
    const fullLabel = resolveFullLabel(reference.ref, owner.unit.stem, tags.fullLabelToTag);
    if (!fullLabel) continue;
    const targetNode = nodeByFullLabel.get(fullLabel) ?? null;
    if (basis === "statement-xref" && !targetNode) continue;
    const key = targetNode ? targetNode.id : fullLabel;
    const group = groups.get(key) ?? {
      owner,
      basis,
      fullLabel,
      targetNode,
      occurrences: [],
    };
    group.occurrences.push(reference);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function uniqueCitationGroups({ citations, owner }) {
  const groups = new Map();
  for (const citation of citations) {
    const key = `${citation.key}\u0000${citation.pinpoint ?? ""}`;
    const group = groups.get(key) ?? {
      owner,
      basis: "proof-citation",
      citationKey: citation.key,
      pinpoint: citation.pinpoint,
      occurrences: [],
    };
    group.occurrences.push(citation);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function referenceEntity({ group, dependencyId, capturedAt, usedIds }) {
  const { owner, basis, fullLabel, targetNode, occurrences } = group;
  const targetSuffix = targetNode?.id ?? `unresolved-${sha256(fullLabel).slice(0, 10)}`;
  let id = `ref-${owner.node.id}-to-${targetSuffix}-${basis === "proof-xref" ? "proof" : "statement"}`;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `ref-${owner.node.id}-to-${targetSuffix}-${basis === "proof-xref" ? "proof" : "statement"}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  const locator = occurrences.map((item) => `${owner.unit.path}:L${item.lineNumber}`).join("; ");
  const evidenceHash = sha256(canonicalJson(occurrences));
  return {
    id,
    ownerNodeId: owner.node.id,
    basis,
    ref: fullLabel,
    context: occurrences[0]?.context ?? "Explicit formal source reference.",
    locator,
    resolution: targetNode
      ? {
        status: "resolved",
        target: { type: "node", id: targetNode.id },
        directDependencyId: dependencyId,
        note: basis === "proof-xref"
          ? "The stable Stacks label resolves to an inventoried formal node and its proof citation is represented by the linked direct dependency."
          : "The stable Stacks label resolves to an inventoried formal node; statement citations are retained but are not promoted to proof dependencies.",
      }
      : {
        status: "unresolved",
        note: "The permanent Stacks label resolves to material outside this strict formal-node graph; it remains pending review rather than becoming an example, remark, equation, or section node.",
      },
    evidence: capturedEvidence({
      sourceUnitId: unitId(owner.unit.stem),
      locator,
      artifactSha256: evidenceHash,
      capturedAt,
      note: `${occurrences.length} explicit ${basis === "proof-xref" ? "proof" : "statement"} reference occurrence(s) merged by stable target label; not independently reviewed.`,
    }),
  };
}

function citationReferenceEntity({ group, capturedAt, usedIds }) {
  const { owner, citationKey, pinpoint, occurrences } = group;
  const citationIdentity = `${citationKey}\u0000${pinpoint ?? ""}`;
  const targetSuffix = sha256(citationIdentity).slice(0, 12);
  let id = `ref-${owner.node.id}-to-cite-${targetSuffix}-proof-citation`;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `ref-${owner.node.id}-to-cite-${targetSuffix}-proof-citation-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  const locator = occurrences.map((item) => `${owner.unit.path}:L${item.lineNumber}`).join("; ");
  return {
    id,
    ownerNodeId: owner.node.id,
    basis: "proof-citation",
    ref: citationKey,
    pinpoint,
    context: occurrences[0]?.context ?? "Explicit bibliographic citation in a formal proof.",
    locator,
    resolution: {
      status: "unresolved",
      note: "This bibliographic proof citation requires source review before it can be promoted to a typed external mathematical input and dependency.",
    },
    evidence: capturedEvidence({
      sourceUnitId: unitId(owner.unit.stem),
      locator,
      artifactSha256: sha256(canonicalJson(occurrences)),
      capturedAt,
      note: `${occurrences.length} explicit proof citation occurrence(s) merged by bibliography key and pinpoint; not independently reviewed.`,
    }),
  };
}

export function extractStacksGraphFromUnits(units, tagText, { capturedAt, bibliographyText = null }) {
  if (!Array.isArray(units) || units.length === 0) throw new Error("The Stacks source-unit list is empty");
  const tags = parseTagRows(tagText);
  const sourceUnits = units.map((unit, index) => ({
    id: unitId(unit.stem),
    ordinal: index + 1,
    label: unit.title || unit.stem,
    locator: unit.path,
    contentSha256: sha256(unit.content),
  }));
  const metadata = units.flatMap((unit) => graphNodesFromUnit(unit, tags, capturedAt));
  const nodes = metadata.map(({ node }) => node);
  const nodeByFullLabel = new Map();
  for (const { node, aliasFullLabels } of metadata) {
    for (const fullLabel of [node.sourceXmlId, ...new Set(aliasFullLabels)]) {
      const existing = nodeByFullLabel.get(fullLabel);
      if (existing && existing.id !== node.id) {
        throw new Error(`Stacks label ${fullLabel} is owned by both ${existing.id} and ${node.id}`);
      }
      nodeByFullLabel.set(fullLabel, node);
    }
  }
  for (const [aliasFullLabel, targetFullLabel] of CURATED_FORMAL_REFERENCE_ALIASES) {
    if (!tags.fullLabelToTag.has(aliasFullLabel)) continue;
    const targetNode = nodeByFullLabel.get(targetFullLabel);
    if (!targetNode) {
      throw new Error(`Curated Stacks alias ${aliasFullLabel} has missing formal target ${targetFullLabel}`);
    }
    const existing = nodeByFullLabel.get(aliasFullLabel);
    if (existing && existing.id !== targetNode.id) {
      throw new Error(`Curated Stacks alias ${aliasFullLabel} conflicts with formal owner ${existing.id}`);
    }
    nodeByFullLabel.set(aliasFullLabel, targetNode);
  }
  const usedIds = new Set([...sourceUnits.map(({ id }) => id), ...nodes.map(({ id }) => id)]);

  const directDependencies = [];
  const dependencyIdByPair = new Map();
  const proofGroupsByOwner = new Map();
  const citationGroupsByOwner = new Map();
  for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
    const proofs = owner.proofs ?? [];
    const proofReferences = proofs.flatMap(({ references }) => references);
    const groups = uniqueReferenceGroups({
      references: proofReferences,
      owner,
      basis: "proof-xref",
      nodeByFullLabel,
      tags,
    });
    proofGroupsByOwner.set(owner.node.id, groups);
    citationGroupsByOwner.set(owner.node.id, uniqueCitationGroups({
      citations: proofs.flatMap(({ citations }) => citations),
      owner,
    }));
    for (const group of groups) {
      if (!group.targetNode || group.targetNode.id === owner.node.id) continue;
      const pair = `${owner.node.id}|${group.targetNode.id}`;
      if (dependencyIdByPair.has(pair)) continue;
      const id = `dep-${owner.node.id}-to-${group.targetNode.id}`;
      if (usedIds.has(id)) throw new Error(`Duplicate dependency ID: ${id}`);
      usedIds.add(id);
      dependencyIdByPair.set(pair, id);
      const locator = group.occurrences
        .map((item) => `${owner.unit.path}:L${item.lineNumber}`)
        .join("; ");
      directDependencies.push({
        id,
        dependentNodeId: owner.node.id,
        prerequisite: { type: "node", id: group.targetNode.id },
        role: dependencyRole(group.targetNode),
        rationale: `The pinned Stacks proof explicitly cites ${group.targetNode.sourceLabel}.`,
        evidence: capturedEvidence({
          sourceUnitId: unitId(owner.unit.stem),
          locator,
          artifactSha256: sha256(canonicalJson(group.occurrences)),
          capturedAt,
          note: `${group.occurrences.length} explicit proof reference occurrence(s) merged into one candidate dependency; not independently reviewed.`,
        }),
      });
    }
  }

  const proofRoutes = [];
  for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
    const proofs = owner.proofs ?? [];
    const routeGroups = proofRouteGroups(proofs);
    for (const [groupIndex, routeGroup] of routeGroups.entries()) {
      const routeReferenceGroups = uniqueReferenceGroups({
        references: routeGroup.proofs.flatMap(({ references }) => references),
        owner,
        basis: "proof-xref",
        nodeByFullLabel,
        tags,
      });
      const dependencyIds = [...new Set(routeReferenceGroups
        .filter(({ targetNode }) => targetNode && targetNode.id !== owner.node.id)
        .map(({ targetNode }) => dependencyIdByPair.get(`${owner.node.id}|${targetNode.id}`))
        .filter(Boolean))];
      if (dependencyIds.length === 0) continue;
      const isAlternativeSet = routeGroups.length >= 2;
      const routeKind = isAlternativeSet && groupIndex > 0 ? "alternate-proof" : "source-proof";
      const ordinalSuffix = routeKind === "alternate-proof" ? `-${routeGroup.ordinal}` : "";
      const id = `route-${owner.node.id}-${routeKind}${ordinalSuffix}`;
      if (usedIds.has(id)) throw new Error(`Duplicate proof-route ID: ${id}`);
      usedIds.add(id);
      const locator = routeGroup.proofs.map((proof) => (
        `${owner.unit.path}:L${proof.startLine}-L${proof.endLine}`
      )).join("; ");
      proofRoutes.push({
        id,
        theoremNodeId: owner.node.id,
        routeKind,
        dependencyIds,
        summary: routeKind === "alternate-proof"
          ? "Source-faithful alternate route containing only the direct formal results and definitions explicitly cited in this separately titled Stacks proof."
          : "Source-faithful candidate route containing the direct formal results and definitions explicitly cited in the pinned Stacks proof.",
        evidence: capturedEvidence({
          sourceUnitId: unitId(owner.unit.stem),
          locator: locator || owner.node.sourceLocator,
          artifactSha256: sha256(routeGroup.proofs.map(({ rawProof }) => rawProof).join("\n")),
          capturedAt,
          note: routeKind === "alternate-proof"
            ? "Candidate alternative route from a separately titled source proof; implicit prerequisites remain pending and no review is claimed."
            : "Candidate route from explicit proof references only; implicit prerequisites remain pending and no review is claimed.",
        }),
      });
    }
  }

  const references = [];
  for (const owner of metadata) {
    if (owner.node.nodeClass === "theorem-like") {
      for (const group of proofGroupsByOwner.get(owner.node.id) ?? []) {
        if (group.targetNode) continue;
        references.push(referenceEntity({ group, dependencyId: null, capturedAt, usedIds }));
      }
      for (const group of citationGroupsByOwner.get(owner.node.id) ?? []) {
        references.push(citationReferenceEntity({ group, capturedAt, usedIds }));
      }
    }
  }

  const inventoryByUnitId = new Map(sourceUnits.map(({ id }) => [id, {
    theoremNodeIds: [],
    supportNodeIds: [],
  }]));
  for (const { node, unit } of metadata) {
    const inventory = inventoryByUnitId.get(unitId(unit.stem));
    if (!inventory) throw new Error(`Missing source-unit inventory for ${unit.path}`);
    if (node.nodeClass === "theorem-like") inventory.theoremNodeIds.push(node.id);
    else inventory.supportNodeIds.push(node.id);
  }
  const unitInventories = sourceUnits.map((unit) => {
    const inventory = inventoryByUnitId.get(unit.id);
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
          ? "Strict formal-environment scan found no theorem, lemma, or proposition in this complete pinned chapter; examples and exercises do not count as theorem nodes."
          : `Strict formal-environment scan assigned ${inventory.theoremNodeIds.length} theorem-like and ${inventory.supportNodeIds.length} definition/situation node(s); examples, exercises, and remarks were excluded.`,
      }),
    };
  });

  const excludedEnvironmentCounts = Object.fromEntries(EXCLUDED_ENVIRONMENTS.map((environment) => [
    environment,
    units.reduce((total, unit) => total + environmentRanges(
      unit.content.split(/\r?\n/u),
      environment,
    ).length, 0),
  ]));
  const theoremCount = nodes.filter((node) => node.nodeClass === "theorem-like").length;
  const routedTheoremIds = new Set(proofRoutes.map(({ theoremNodeId }) => theoremNodeId));
  const unresolvedTaggedProofReferences = references.filter((reference) => (
    reference.basis === "proof-xref" && reference.resolution.status === "unresolved"
  ));
  const proofCitationReferences = references.filter((reference) => (
    reference.basis === "proof-citation"
  ));
  if (bibliographyText !== null) {
    const knownBibliographyKeys = bibliographyKeys(bibliographyText);
    const missingCitation = proofCitationReferences.find(({ ref }) => !knownBibliographyKeys.has(ref));
    if (missingCitation) {
      throw new Error(`Stacks proof citation key ${missingCitation.ref} is absent from my.bib`);
    }
  }
  const unresolvedReferenceCount = references.filter((reference) => (
    reference.resolution.status === "unresolved"
  )).length;

  return {
    sourceUnits,
    unitInventories,
    graph: {
      nodes,
      externalInputs: [],
      directDependencies,
      proofRoutes,
      references,
    },
    stats: {
      theoremCount,
      supportCount: nodes.length - theoremCount,
      kindCounts: Object.fromEntries([...new Set(nodes.map(({ kind }) => kind))]
        .sort()
        .map((kind) => [kind, nodes.filter((node) => node.kind === kind).length])),
      directDependencyCount: directDependencies.length,
      proofRouteCount: proofRoutes.length,
      referenceCount: references.length,
      unresolvedReferenceCount,
      statementXrefCount: 0,
      proofCitationReferenceCount: proofCitationReferences.length,
      proofCitationOccurrenceCount: [...citationGroupsByOwner.values()]
        .flatMap((groups) => groups)
        .reduce((total, group) => total + group.occurrences.length, 0),
      distinctProofCitationKeyCount: new Set(proofCitationReferences.map(({ ref }) => ref)).size,
      proofCitationOwnerCount: new Set(proofCitationReferences.map(({ ownerNodeId }) => ownerNodeId)).size,
      unresolvedProofXrefCount: unresolvedTaggedProofReferences.length,
      unresolvedTaggedProofReferenceCount: unresolvedTaggedProofReferences.length,
      uniqueUnresolvedTaggedProofTargetCount: new Set(
        unresolvedTaggedProofReferences.map(({ ref }) => ref),
      ).size,
      pendingTheoremCount: theoremCount - routedTheoremIds.size,
      unitInventoryCount: unitInventories.length,
      theoremFreeUnitCount: unitInventories.filter(({ theoremFreeAttestation }) => theoremFreeAttestation).length,
      excludedEnvironmentCounts,
      tagCount: tags.tagToFullLabel.size,
    },
  };
}

function makefileChapterStems(makefileText) {
  const lines = makefileText.split(/\r?\n/u);
  const startIndex = lines.findIndex((line) => /^LIJST\s*=/u.test(line));
  if (startIndex < 0) throw new Error("The Stacks Makefile has no LIJST chapter manifest");
  const fragments = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    let line = stripLatexComment(lines[index]).trim();
    if (index === startIndex) line = line.replace(/^LIJST\s*=\s*/u, "");
    const continues = line.endsWith("\\");
    fragments.push(line.replace(/\\$/u, "").trim());
    if (!continues) break;
  }
  const stems = fragments.join(" ").split(/\s+/u).filter(Boolean);
  if (stems.length === 0) throw new Error("The Stacks Makefile LIJST chapter manifest is empty");
  if (new Set(stems).size !== stems.length) throw new Error("The Stacks Makefile repeats a LIJST chapter stem");
  for (const stem of stems) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(stem)) throw new Error(`Unsafe Stacks chapter stem: ${stem}`);
  }
  return stems.includes("fdl") ? stems : [...stems, "fdl"];
}

export function collectStacksSourceUnits(checkoutRoot) {
  const makefilePath = path.join(checkoutRoot, "Makefile");
  const tagsPath = path.join(checkoutRoot, "tags", "tags");
  const bibliographyPath = path.join(checkoutRoot, "my.bib");
  if (!fs.existsSync(makefilePath) || !fs.existsSync(tagsPath) || !fs.existsSync(bibliographyPath)) {
    throw new Error("The checkout lacks the Stacks Makefile, tags/tags manifest, or my.bib bibliography");
  }
  const makefileText = fs.readFileSync(makefilePath, "utf8");
  const tagText = fs.readFileSync(tagsPath, "utf8");
  const bibliographyText = fs.readFileSync(bibliographyPath, "utf8");
  const units = makefileChapterStems(makefileText).map((stem) => {
    const relativePath = `${stem}.tex`;
    const filePath = path.join(checkoutRoot, relativePath);
    if (!fs.existsSync(filePath)) throw new Error(`Missing Stacks chapter source: ${relativePath}`);
    const content = fs.readFileSync(filePath, "utf8");
    return {
      stem,
      path: relativePath,
      title: cleanTitle(findBalancedCommandArgument(content, "title") ?? stem) || stem,
      content,
    };
  });
  return { units, tagText, makefileText, bibliographyText };
}

export function buildStacksBookFile({
  baseFile,
  checkoutRoot,
  commit,
  capturedAt,
  sourceRepository = "https://github.com/stacks/stacks-project",
}) {
  if (!/^[0-9a-f]{40}$/iu.test(commit)) throw new Error("--commit must be a full 40-character Git commit");
  const collected = collectStacksSourceUnits(checkoutRoot);
  const extracted = extractStacksGraphFromUnits(collected.units, collected.tagText, {
    capturedAt,
    bibliographyText: collected.bibliographyText,
  });
  const artifactFiles = [
    { path: "Makefile", content: collected.makefileText },
    { path: "tags/tags", content: collected.tagText },
    { path: "my.bib", content: collected.bibliographyText },
    ...collected.units.map((unit) => ({ path: unit.path, content: unit.content })),
  ];
  const artifactSha256 = sha256(canonicalJson(artifactFiles.map((file) => ({
    path: file.path,
    contentSha256: sha256(file.content),
  }))));
  const unitManifestSha256 = sha256(JSON.stringify(extracted.sourceUnits));
  const extractionArtifactSha256 = sha256(JSON.stringify({
    sourceUnits: extracted.sourceUnits,
    unitInventories: extracted.unitInventories,
  }));
  const graphArtifactSha256 = sha256(JSON.stringify(extracted.graph));
  const kindSummary = Object.entries(extracted.stats.kindCounts)
    .map(([kind, count]) => `${count} ${kind}`)
    .join(", ");
  const excludedSummary = Object.entries(extracted.stats.excludedEnvironmentCounts)
    .map(([kind, count]) => `${count} ${kind}`)
    .join(", ");

  return {
    file: {
      ...baseFile,
      exactEdition: {
        editionId: `${baseFile.identity.sourceRecordId.toLowerCase()}-stacks-${commit.slice(0, 12)}`,
        label: `The Stacks Project, source revision ${commit.slice(0, 12)}`,
        publicationYear: Number.parseInt(capturedAt.slice(0, 4), 10),
        publisher: null,
        stableLocator: `${sourceRepository}/tree/${commit}`,
        artifactSha256,
        unitManifestSha256,
        sourceUnitKind: "chapter",
        sourceFormat: "latex",
        accessKind: "open",
        licenseSpdx: "GFDL-1.2-or-later",
        licenseUrl: "https://www.gnu.org/licenses/old-licenses/fdl-1.2.html",
        licenseNote: "The pinned Introduction grants GNU Free Documentation License version 1.2 or any later version, with no invariant sections or cover texts.",
        sourceRepository,
        sourceRevision: commit,
      },
      sourceUnits: extracted.sourceUnits,
      unitInventories: extracted.unitInventories,
      graph: extracted.graph,
      extractionState: {
        status: "extracted",
        extractionAudit: {
          actorId: "stacks-latex-importer",
          completedAt: capturedAt,
          artifactSha256: extractionArtifactSha256,
          sourceUnitCount: extracted.sourceUnits.length,
          unitInventoryCount: extracted.unitInventories.length,
        },
        independentReview: null,
        note: `Strict extraction from all ${extracted.sourceUnits.length} chapters in the pinned official source: ${kindSummary}. Deliberately excluded ${excludedSummary}; no worked example is a graph node.`,
      },
      graphState: {
        status: "extracted",
        graphAudit: {
          actorId: "stacks-latex-importer",
          completedAt: capturedAt,
          artifactSha256: graphArtifactSha256,
          nodeCount: extracted.graph.nodes.length,
          externalInputCount: extracted.graph.externalInputs.length,
          directDependencyCount: extracted.graph.directDependencies.length,
          proofRouteCount: extracted.graph.proofRoutes.length,
          referenceCount: extracted.graph.references.length,
        },
        independentReview: null,
        note: `${extracted.stats.directDependencyCount} candidate edges come only from explicit formal references in source proofs; resolved occurrences are merged into edge evidence. ${extracted.stats.unresolvedTaggedProofReferenceCount} unresolved tagged proof-xref records (${extracted.stats.uniqueUnresolvedTaggedProofTargetCount} unique permanent labels) and ${extracted.stats.proofCitationReferenceCount} unresolved bibliographic proof-citation records (${extracted.stats.distinctProofCitationKeyCount} keys) remain review candidates; no citation was promoted to an external input. ${extracted.stats.pendingTheoremCount} theorem-like nodes have no route with a resolved explicit formal proof reference and remain pending, not roots. No mathematical review or graph-completeness claim is made.`,
      },
    },
    stats: {
      ...extracted.stats,
      sourceUnitCount: extracted.sourceUnits.length,
      artifactSha256,
      unitManifestSha256,
      extractionArtifactSha256,
      graphArtifactSha256,
    },
  };
}
