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
        statementReferences: referencesInLines(lines, range.startLine, range.endLine),
      });
    }
  }
  metadata.sort((left, right) => left.startLine - right.startLine);

  const proofRanges = environmentRanges(lines, "proof");
  for (const proof of proofRanges) {
    const owner = [...metadata]
      .reverse()
      .find((candidate) => (
        candidate.node.nodeClass === "theorem-like"
        && candidate.endLine < proof.startLine
      ));
    if (!owner) continue;
    const interveningTheorem = metadata.some((candidate) => (
      candidate.node.nodeClass === "theorem-like"
      && candidate.startLine > owner.startLine
      && candidate.startLine < proof.startLine
    ));
    if (interveningTheorem) continue;
    const rawProof = lines.slice(proof.startLine - 1, proof.endLine).join("\n");
    const proofs = owner.proofs ?? [];
    proofs.push({
      ...proof,
      rawProof,
      references: referencesInLines(lines, proof.startLine, proof.endLine),
    });
    owner.proofs = proofs;
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

export function extractStacksGraphFromUnits(units, tagText, { capturedAt }) {
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
  const nodeByFullLabel = new Map(metadata.map(({ node }) => [node.sourceXmlId, node]));
  const usedIds = new Set([...sourceUnits.map(({ id }) => id), ...nodes.map(({ id }) => id)]);

  const directDependencies = [];
  const dependencyIdByPair = new Map();
  const proofGroupsByOwner = new Map();
  for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
    const proofReferences = (owner.proofs ?? []).flatMap(({ references }) => references);
    const groups = uniqueReferenceGroups({
      references: proofReferences,
      owner,
      basis: "proof-xref",
      nodeByFullLabel,
      tags,
    });
    proofGroupsByOwner.set(owner.node.id, groups);
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
  const dependencyIdsByOwner = new Map();
  for (const dependency of directDependencies) {
    const ids = dependencyIdsByOwner.get(dependency.dependentNodeId) ?? [];
    ids.push(dependency.id);
    dependencyIdsByOwner.set(dependency.dependentNodeId, ids);
  }
  for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
    const dependencyIds = dependencyIdsByOwner.get(owner.node.id) ?? [];
    if (dependencyIds.length === 0) continue;
    const proofs = owner.proofs ?? [];
    const locator = proofs.map((proof) => (
      `${owner.unit.path}:L${proof.startLine}-L${proof.endLine}`
    )).join("; ");
    const id = `route-${owner.node.id}-source-proof`;
    if (usedIds.has(id)) throw new Error(`Duplicate proof-route ID: ${id}`);
    usedIds.add(id);
    proofRoutes.push({
      id,
      theoremNodeId: owner.node.id,
      routeKind: "source-proof",
      dependencyIds,
      summary: "Source-faithful candidate route containing the direct formal results and definitions explicitly cited in the pinned Stacks proof.",
      evidence: capturedEvidence({
        sourceUnitId: unitId(owner.unit.stem),
        locator: locator || owner.node.sourceLocator,
        artifactSha256: sha256(proofs.map(({ rawProof }) => rawProof).join("\n")),
        capturedAt,
        note: "Candidate route from explicit proof references only; implicit prerequisites remain pending and no review is claimed.",
      }),
    });
  }

  const references = [];
  for (const owner of metadata) {
    if (owner.node.nodeClass === "theorem-like") {
      for (const group of proofGroupsByOwner.get(owner.node.id) ?? []) {
        if (group.targetNode) continue;
        references.push(referenceEntity({ group, dependencyId: null, capturedAt, usedIds }));
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
  const unresolvedProofXrefCount = references.filter((reference) => (
    reference.basis === "proof-xref" && reference.resolution.status === "unresolved"
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
      statementXrefCount: 0,
      unresolvedProofXrefCount,
      pendingTheoremCount: theoremCount - routedTheoremIds.size,
      unitInventoryCount: unitInventories.length,
      theoremFreeUnitCount: unitInventories.filter(({ theoremFreeAttestation }) => theoremFreeAttestation).length,
      excludedEnvironmentCounts,
      tagCount: tags.tagToFullLabel.size,
      unresolvedTaggedProofTargetCount: references.filter((reference) => (
        reference.basis === "proof-xref" && reference.resolution.status === "unresolved"
      )).length,
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
  if (!fs.existsSync(makefilePath) || !fs.existsSync(tagsPath)) {
    throw new Error("The checkout lacks the Stacks Makefile or tags/tags manifest");
  }
  const makefileText = fs.readFileSync(makefilePath, "utf8");
  const tagText = fs.readFileSync(tagsPath, "utf8");
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
  return { units, tagText, makefileText };
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
  const extracted = extractStacksGraphFromUnits(collected.units, collected.tagText, { capturedAt });
  const artifactFiles = [
    { path: "Makefile", content: collected.makefileText },
    { path: "tags/tags", content: collected.tagText },
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
        note: `${extracted.stats.directDependencyCount} candidate edges come only from explicit formal references in source proofs; resolved occurrences are merged into edge evidence, while ${extracted.stats.unresolvedProofXrefCount} tagged proof targets outside the strict node policy remain explicit unresolved references. ${extracted.stats.pendingTheoremCount} theorem-like nodes have no resolved explicit formal proof citation and remain pending, not roots. No mathematical review or graph-completeness claim is made.`,
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
