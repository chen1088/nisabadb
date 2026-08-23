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

// A remark is not a theorem merely because later proofs cite it. These three
// pinned-source remarks are exceptional: each states an explicit mathematical
// claim and gives its derivation inline. They were individually reviewed before
// promotion. Keep this allowlist label-exact and do not generalize it by wording,
// proximity, or citation frequency.
const CURATED_CLAIMS = new Map([
  ["derived-remark-truncation-distinguished-triangle", "Canonical distinguished triangles of truncations"],
  ["sites-cohomology-remark-before-Leray", "Derived global sections after derived pushforward"],
  ["spaces-perfect-remark-match-total-direct-images", "Compatibility of derived pullback and pushforward for representable algebraic spaces"],
]);

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
  ["algebra-remark-Tor-ring-mod-ideal", "algebra-lemma-characterize-flat"],
]);

// Named results invoked in prose rather than through \ref. Every entry is tied
// to one permanent owner tag and an exact expected phrase count in that owner's
// proof. This is an audited whitelist, not a global name recognizer.
const CURATED_NAMED_PROOF_DEPENDENCIES = [
  { ownerTag: "00HL", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00LU", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00MZ", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0CE7", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "02TQ", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "04D2", targetTag: "001P", phrasePattern: "Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00WY", targetTag: "001P", phrasePattern: "Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00XM", targetTag: "001P", phrasePattern: "Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "06D3", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 3 },
  { ownerTag: "030F", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00E0", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "07P2", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "01D7", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
];

// Exact owner/prerequisite tag pairs recovered from proofs whose entire body is
// a deictic delegation to the immediately preceding discussion. Every pair was
// manually checked; the wider discussion windows also contained rejected
// comparisons and forward references, so they must never be promoted wholesale.
const CURATED_DEICTIC_PROOF_DEPENDENCIES = new Map([
  ["02Y5", ["02XN", "004B", "0040"]],
  ["039G", ["00UW", "02FM"]],
  ["05JE", ["05GG", "031A"]],
  ["05JG", ["05JE", "0315", "031A"]],
  ["0ALC", ["0ALB"]],
  ["0ALG", ["0AIF", "0430", "06WK", "09B8"]],
  ["0GHI", ["05GH", "00OK", "00MA"]],
  ["086I", ["01KO", "01L0"]],
  ["087I", ["02WW"]],
  ["05WJ", ["00NW", "05WI", "00NX"]],
  ["05WL", ["05WK"]],
  ["05G2", ["00R2"]],
  ["05LC", ["05KK", "04PS"]],
  ["09AP", ["096N", "096T", "00U7", "00U8"]],
  ["0274", ["01PM"]],
  ["06UK", ["02Z3"]],
  ["04AH", ["0CQJ", "03YK", "01T8"]],
  ["07Z1", ["04UK", "07XL"]],
  ["078F", ["023Q", "072B"]],
  ["05LE", ["021A", "03HV", "04EX", "04DZ"]],
  ["05LH", ["021A", "04EX", "04DZ", "049J"]],
  ["07BG", ["00X1", "04D3"]],
  ["0GE9", ["00X1", "04D3"]],
  ["07DD", ["06WK"]],
  ["0D5E", ["0C66"]],
  ["09R5", ["09JR", "05QW", "09QH", "0132"]],
  ["0CXX", ["0AFB", "0AF9", "0AFA"]],
  ["0ATF", ["0571"]],
  ["0EU9", ["00HY", "01J8", "0ETH"]],
  ["09I5", ["09DT"]],
  ["01DK", ["0139", "0161"]],
  ["0C7M", ["0C7E", "0C6Z", "0C5X"]],
  ["0C7R", ["0C7M", "0C5X"]],
  ["0C7V", ["0C7R"]],
  ["0C80", ["0C7R"]],
  ["0C82", ["0C7R", "0C7V"]],
  ["0C86", ["0C7R", "0C80"]],
  ["0C87", ["0C80", "0C7V"]],
  ["0C89", ["0C82"]],
  ["0C8D", ["0C87", "0C89", "0C82"]],
  ["0C8F", ["0C87"]],
  ["0C8H", ["0C87", "0C8D"]],
  ["0C8I", ["0C87"]],
  ["0C8J", ["0C87", "0C8D"]],
  ["0C8L", ["0C8J", "0C8I"]],
  ["0C8P", ["0C8I"]],
  ["04RU", ["04QH", "04RR", "04PE", "04PH"]],
  ["09VM", ["008J", "008L"]],
  ["09WF", ["09WC", "09WD", "09WE"]],
]);

// Three slightly longer deictic proofs were audited separately. Unlike the
// exact one-line cases, their source route begins at the earliest listed formal
// prerequisite and includes the intervening discussion.
const CURATED_ESSENTIAL_DEICTIC_PROOF_DEPENDENCIES = [
  {
    ownerTag: "0272",
    targetTags: ["00IT"],
    proofPattern: "^See discussion above and \\(insert future reference on normalization here\\)\\.$",
    routeDebtNote: "The source proof also contains an explicit future-reference placeholder for normalization; that prerequisite remains unresolved review debt.",
  },
  {
    ownerTag: "069G",
    targetTags: ["069E", "069F"],
    proofPattern: "^This is the defining property of a local complete intersection morphism\\. See discussion above\\.$",
  },
  {
    ownerTag: "01JS",
    targetTags: ["01JQ", "01JR"],
    proofPattern: "^See discussion above the lemma\\.$",
  },
];

// The excluded Tag 03II remark is a bundle of several recalled facts. These
// occurrence-level resolutions select only the formal fact actually used at
// each source location. Two nearby untagged prose uses are included explicitly.
const CURATED_BUNDLED_REMARK_DEPENDENCIES = [
  { ownerTag: "03JS", sourceLineRanges: [[299, 299]], targetTags: ["03WT"], resolvesTag: "03II", expectedPattern: "Remark \\\\ref\\{remark-recall\\}" },
  { ownerTag: "03JS", sourceLineRanges: [[304, 305]], targetTags: ["02GV", "02V5"], expectedPattern: "locally quasi-finite" },
  { ownerTag: "03JT", sourceLineRanges: [[655, 655]], targetTags: ["03WT"], resolvesTag: "03II", expectedPattern: "Remark \\\\ref\\{remark-recall\\}" },
  { ownerTag: "03JT", sourceLineRanges: [[661, 662]], targetTags: ["02GV", "02V5"], expectedPattern: "locally quasi-finite" },
  { ownerTag: "03JU", sourceLineRanges: [[374, 374], [411, 411]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "Remark \\\\ref\\{remark-recall\\}" },
  { ownerTag: "03JV", sourceLineRanges: [[573, 573], [601, 601]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "Remark \\\\ref\\{remark-recall\\}" },
  { ownerTag: "03IM", sourceLineRanges: [[1283, 1284]], targetTags: ["02GS", "03HV"], resolvesTag: "03II", expectedPattern: "generalizations lift" },
  { ownerTag: "03IM", sourceLineRanges: [[1297, 1298]], targetTags: ["02GV", "02V5", "01TH"], resolvesTag: "03II", expectedPattern: "no specializations" },
  { ownerTag: "03K2", sourceLineRanges: [[1365, 1368]], targetTags: ["02GS", "03HV"], resolvesTag: "03II", expectedPattern: "generalizations lift" },
  { ownerTag: "0BBN", sourceLineRanges: [[1599, 1601]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "disjoint union" },
  { ownerTag: "06QW", sourceLineRanges: [[2889, 2891]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "disjoint union" },
  { ownerTag: "06QX", sourceLineRanges: [[2936, 2938]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "disjoint union" },
  { ownerTag: "06QZ", sourceLineRanges: [[3020, 3027]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "disjoint union" },
  { ownerTag: "06R1", sourceLineRanges: [[3127, 3129]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "regular" },
  { ownerTag: "0BB6", sourceLineRanges: [[3285, 3289]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "finite disjoint unions" },
  { ownerTag: "0AHB", sourceLineRanges: [[3433, 3436]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "finite disjoint union" },
  { ownerTag: "088J", sourceLineRanges: [[3523, 3527]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "disjoint union" },
  { ownerTag: "0BA5", sourceLineRanges: [[5318, 5320]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "finite disjoint union" },
  { ownerTag: "0EDM", sourceLineRanges: [[7308, 7313]], targetTags: ["02GL"], resolvesTag: "03II", expectedPattern: "finitely many points" },
];

// This proof cites the promoted compatibility claim only to import notation.
// It is deliberately resolved without a logical dependency edge.
const CURATED_NONDEPENDENCY_PROOF_XREFS = new Set([
  "0DKQ|08GH",
]);

const DEICTIC_PROOF_BODIES = new Set([
  "See above.",
  "See discussion above.",
  "See the discussion above.",
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

function normalizedProofBody(rawProof) {
  return normalizeWhitespace(rawProof
    .replace(/^\s*\\begin\{proof\}(?:\[[^\]]*\])?/u, "")
    .replace(/\\end\{proof\}\s*$/u, ""));
}

function proofPhraseOccurrences(owner, patternSource) {
  const lines = owner.unit.content.split(/\r?\n/u);
  const occurrences = [];
  const proofStartLines = new Set();
  for (const proof of owner.proofs ?? []) {
    for (let lineNumber = proof.startLine; lineNumber <= proof.endLine; lineNumber += 1) {
      const line = stripLatexComment(lines[lineNumber - 1] ?? "");
      for (const match of line.matchAll(new RegExp(patternSource, "giu"))) {
        occurrences.push({
          lineNumber,
          context: lineContext(lines, lineNumber),
          matchedText: match[0],
        });
        proofStartLines.add(proof.startLine);
      }
    }
  }
  return { occurrences, proofStartLines: [...proofStartLines] };
}

function occurrenceLocator(unitPath, occurrence) {
  return occurrence.endLine && occurrence.endLine !== occurrence.lineNumber
    ? `${unitPath}:L${occurrence.lineNumber}-L${occurrence.endLine}`
    : `${unitPath}:L${occurrence.lineNumber}`;
}

function precedingDiscussionRegion(owner) {
  const lines = owner.unit.content.split(/\r?\n/u);
  const previousProofEnd = environmentRanges(lines, "proof")
    .filter(({ endLine }) => endLine < owner.startLine)
    .at(-1)?.endLine ?? 0;
  let previousBoundaryLine = 0;
  for (let lineNumber = 1; lineNumber < owner.startLine; lineNumber += 1) {
    if (STRUCTURAL_BOUNDARY_PATTERN.test(stripLatexComment(lines[lineNumber - 1] ?? ""))) {
      previousBoundaryLine = lineNumber;
    }
  }
  const startLine = Math.max(previousProofEnd, previousBoundaryLine) + 1;
  const endLine = owner.startLine - 1;
  return {
    startLine,
    endLine,
    rawText: lines.slice(startLine - 1, endLine).join("\n"),
    references: endLine >= startLine ? referencesInLines(lines, startLine, endLine) : [],
  };
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
          note: "Formal Stacks environment captured from the pinned LaTeX source; examples, exercises, and uncurated remarks are outside the graph policy.",
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

  for (const environment of ["remark", "remarks"]) {
    for (const range of environmentRanges(lines, environment)) {
      const rawEnvironment = lines.slice(range.startLine - 1, range.endLine).join("\n");
      const localLabel = findBalancedCommandArgument(rawEnvironment, "label");
      if (!localLabel) continue;
      const fullLabel = `${unit.stem}-${localLabel}`;
      const curatedTitle = CURATED_CLAIMS.get(fullLabel);
      if (!curatedTitle) continue;
      const tag = tags.fullLabelToTag.get(fullLabel);
      if (!tag) throw new Error(`${unit.path}:${range.startLine} has no stable tag for ${fullLabel}`);
      const nodeId = tagNodeId(tag);
      const normalizedStatement = normalizeWhitespace(rawEnvironment
        .replace(new RegExp(`^\\s*\\\\begin\\{${environment}\\}(?:\\[[^\\]]*\\])?`, "u"), "")
        .replace(new RegExp(`\\\\end\\{${environment}\\}\\s*$`, "u"), ""));
      const locator = `${unit.path}:L${range.startLine}-L${range.endLine}`;
      const label = sourceLabel("claim", tag);
      const artifactSha256 = sha256(rawEnvironment);
      const inlineProof = {
        ...range,
        title: "Inline derivation in source remark",
        rawProof: rawEnvironment,
        references: referencesInLines(lines, range.startLine, range.endLine),
        citations: citationsInLines(lines, range.startLine, range.endLine),
      };
      metadata.push({
        node: {
          id: nodeId,
          nodeClass: "theorem-like",
          kind: "claim",
          sourceLabel: label,
          title: curatedTitle,
          sourceXmlId: fullLabel,
          sourceLocator: locator,
          normalizedStatement: normalizedStatement || label,
          sourceTextSha256: artifactSha256,
          evidence: capturedEvidence({
            sourceUnitId: unitId(unit.stem),
            locator,
            artifactSha256,
            capturedAt,
            note: "Source-audited Stacks remark promoted by exact permanent label because it states a theorem-level claim and supplies an inline derivation; this does not promote remarks generally.",
          }),
        },
        unit,
        environment,
        startLine: range.startLine,
        endLine: range.endLine,
        rawEnvironment,
        aliasFullLabels: labelArguments(rawEnvironment)
          .filter((labelArgument) => labelArgument !== localLabel)
          .map((labelArgument) => `${unit.stem}-${labelArgument}`),
        statementReferences: [],
        proofs: [inlineProof],
        curatedClaim: true,
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

  const metadataByFullLabel = new Map(metadata.map((item) => [item.node.sourceXmlId, item]));
  const metadataByNodeId = new Map(metadata.map((item) => [item.node.id, item]));
  const unitOrderByStem = new Map(units.map((unit, index) => [unit.stem, index]));
  const metadataForTag = (tag, role) => {
    const fullLabel = tags.tagToFullLabel.get(tag);
    if (!fullLabel) return null;
    const item = metadataByFullLabel.get(fullLabel);
    if (!item) throw new Error(`Curated ${role} tag ${tag} (${fullLabel}) has no formal graph node`);
    return item;
  };
  const targetForTag = (tag, role) => {
    const item = metadataForTag(tag, role);
    if (!item) throw new Error(`Curated ${role} target tag ${tag} is absent from the pinned tag manifest`);
    return item;
  };
  const assertTargetPrecedesOwner = (target, owner, role) => {
    const targetUnitOrder = unitOrderByStem.get(target.unit.stem);
    const ownerUnitOrder = unitOrderByStem.get(owner.unit.stem);
    const precedes = targetUnitOrder < ownerUnitOrder
      || (targetUnitOrder === ownerUnitOrder && target.startLine < owner.startLine);
    if (!precedes) {
      throw new Error(`Curated ${role} target ${target.node.id} does not precede owner ${owner.node.id}`);
    }
  };

  const semanticGroupsByOwner = new Map();
  const addSemanticGroup = (group) => {
    const targetId = group.targetNode?.id ?? group.externalInput?.id;
    if (!targetId) throw new Error(`Curated semantic dependency for ${group.owner.node.id} has no target`);
    const ownerGroups = semanticGroupsByOwner.get(group.owner.node.id) ?? new Map();
    const existing = ownerGroups.get(targetId);
    if (existing) {
      existing.occurrences.push(...group.occurrences);
      existing.proofStartLines = [...new Set([
        ...existing.proofStartLines,
        ...group.proofStartLines,
      ])];
      existing.routeEvidenceRegions.push(...group.routeEvidenceRegions);
      existing.routeDebtNotes.push(...group.routeDebtNotes);
    } else {
      ownerGroups.set(targetId, {
        ...group,
        routeEvidenceRegions: [...group.routeEvidenceRegions],
        routeDebtNotes: [...group.routeDebtNotes],
      });
    }
    semanticGroupsByOwner.set(group.owner.node.id, ownerGroups);
  };

  const activeNamedAudits = CURATED_NAMED_PROOF_DEPENDENCIES
    .map((config) => ({ config, owner: metadataForTag(config.ownerTag, "named-result owner") }))
    .filter(({ owner }) => owner);
  const externalInputs = [];
  if (activeNamedAudits.some(({ config }) => config.externalInputId === "external-zorns-lemma")) {
    const conventions = units.find(({ stem }) => stem === "conventions");
    if (!conventions) throw new Error("Zorn's lemma audit requires the pinned conventions source unit");
    const conventionLines = conventions.content.split(/\r?\n/u);
    const rawConvention = conventionLines.slice(23, 30).join("\n");
    if (!/Zermelo-Fraenkel set theory with the axiom of choice/iu.test(rawConvention)) {
      throw new Error("The pinned ZFC-with-choice convention moved or changed");
    }
    externalInputs.push({
      id: "external-zorns-lemma",
      kind: "external-theorem",
      label: "Zorn's lemma",
      normalizedStatement: "Every nonempty partially ordered set in which every chain has an upper bound contains a maximal element.",
      sourceTextSha256: null,
      sourceCitation: "Invoked by name under the Stacks Project's declared ZFC convention; conventions.tex:L24-L30.",
      evidence: capturedEvidence({
        sourceUnitId: unitId("conventions"),
        locator: "conventions.tex:L24-L30",
        artifactSha256: sha256(rawConvention),
        capturedAt,
        note: "The pinned source declares Zermelo-Fraenkel set theory with choice; four source-audited formal proofs invoke Zorn's lemma by name.",
      }),
    });
  }
  const externalInputById = new Map(externalInputs.map((input) => [input.id, input]));

  for (const { config, owner } of activeNamedAudits) {
    const { occurrences, proofStartLines } = proofPhraseOccurrences(owner, config.phrasePattern);
    if (occurrences.length !== config.expectedOccurrenceCount) {
      throw new Error(`Curated named-result audit for ${config.ownerTag} expected ${config.expectedOccurrenceCount} occurrence(s), found ${occurrences.length}`);
    }
    const target = config.targetTag
      ? targetForTag(config.targetTag, "named-result")
      : null;
    if (target) assertTargetPrecedesOwner(target, owner, "named-result");
    const externalInput = config.externalInputId
      ? externalInputById.get(config.externalInputId)
      : null;
    if (config.externalInputId && !externalInput) {
      throw new Error(`Curated named-result external input ${config.externalInputId} is missing`);
    }
    const targetLabel = target?.node.sourceLabel ?? externalInput.label;
    addSemanticGroup({
      owner,
      basis: "audited-named-result",
      targetNode: target?.node ?? null,
      externalInput,
      occurrences,
      proofStartLines,
      routeEvidenceRegions: [],
      routeDebtNotes: [],
      rationale: `The pinned Stacks proof invokes ${targetLabel} by its standard name.`,
      evidenceNote: `${occurrences.length} owner-specific, source-audited named-result invocation(s) merged into one dependency.`,
    });
  }

  for (const [ownerTag, targetTags] of CURATED_DEICTIC_PROOF_DEPENDENCIES) {
    const owner = metadataForTag(ownerTag, "deictic-proof owner");
    if (!owner) continue;
    const deicticProofs = (owner.proofs ?? []).filter((proof) => (
      DEICTIC_PROOF_BODIES.has(normalizedProofBody(proof.rawProof))
    ));
    if (deicticProofs.length !== 1) {
      throw new Error(`Curated deictic proof ${ownerTag} no longer has exactly one audited proof body`);
    }
    const proof = deicticProofs[0];
    const discussion = precedingDiscussionRegion(owner);
    const ownerLines = owner.unit.content.split(/\r?\n/u);
    const routeRegion = {
      startLine: discussion.startLine,
      endLine: proof.endLine,
      rawText: ownerLines.slice(discussion.startLine - 1, proof.endLine).join("\n"),
    };
    for (const targetTag of targetTags) {
      const target = targetForTag(targetTag, "deictic-proof");
      assertTargetPrecedesOwner(target, owner, "deictic-proof");
      const targetFullLabel = tags.tagToFullLabel.get(targetTag);
      const occurrences = discussion.references.filter(({ ref }) => (
        resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === targetFullLabel
      ));
      if (occurrences.length === 0) {
        throw new Error(`Curated deictic pair ${ownerTag}->${targetTag} is absent from the preceding discussion window`);
      }
      addSemanticGroup({
        owner,
        basis: "audited-deictic-proof",
        targetNode: target.node,
        externalInput: null,
        occurrences,
        proofStartLines: [proof.startLine],
        routeEvidenceRegions: [routeRegion],
        routeDebtNotes: [],
        rationale: `The pinned Stacks proof delegates to the preceding discussion, which explicitly cites ${target.node.sourceLabel}.`,
        evidenceNote: `${occurrences.length} explicit discussion reference occurrence(s) selected by an owner-specific audit of the deictic proof.`,
      });
    }
  }

  for (const config of CURATED_ESSENTIAL_DEICTIC_PROOF_DEPENDENCIES) {
    const owner = metadataForTag(config.ownerTag, "essential-deictic owner");
    if (!owner) continue;
    const matchingProofs = (owner.proofs ?? []).filter((proof) => (
      new RegExp(config.proofPattern, "u").test(normalizedProofBody(proof.rawProof))
    ));
    if (matchingProofs.length !== 1) {
      throw new Error(`Curated essential-deictic proof ${config.ownerTag} no longer matches its audited body`);
    }
    const proof = matchingProofs[0];
    const discussion = precedingDiscussionRegion(owner);
    const targets = config.targetTags.map((targetTag) => ({
      targetTag,
      target: targetForTag(targetTag, "essential-deictic"),
    }));
    for (const { target } of targets) assertTargetPrecedesOwner(target, owner, "essential-deictic");
    const sameUnitTargetStarts = targets
      .map(({ target }) => target)
      .filter(({ unit }) => unit.stem === owner.unit.stem)
      .map(({ startLine }) => startLine);
    const routeStartLine = Math.min(discussion.startLine, ...sameUnitTargetStarts);
    const ownerLines = owner.unit.content.split(/\r?\n/u);
    const routeRegion = {
      startLine: routeStartLine,
      endLine: proof.endLine,
      rawText: ownerLines.slice(routeStartLine - 1, proof.endLine).join("\n"),
    };
    for (const { targetTag, target } of targets) {
      const targetFullLabel = tags.tagToFullLabel.get(targetTag);
      const explicitOccurrences = discussion.references.filter(({ ref }) => (
        resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === targetFullLabel
      ));
      const occurrences = explicitOccurrences.length > 0
        ? explicitOccurrences
        : [{
          lineNumber: target.startLine,
          endLine: target.endLine,
          context: `Audited preceding formal result ${target.node.sourceLabel}.`,
        }];
      addSemanticGroup({
        owner,
        basis: "audited-essential-deictic-proof",
        targetNode: target.node,
        externalInput: null,
        occurrences,
        proofStartLines: [proof.startLine],
        routeEvidenceRegions: [routeRegion],
        routeDebtNotes: config.routeDebtNote ? [config.routeDebtNote] : [],
        rationale: `An owner-specific audit of the short deictic Stacks proof and its preceding construction identifies ${target.node.sourceLabel} as a direct prerequisite.`,
        evidenceNote: "Owner-specific source audit of a short deictic proof; no proximity-wide inference rule was applied.",
      });
    }
  }

  const curatedResolvedProofGroupKeys = new Set();
  const resolvedRangesByGroupKey = new Map();
  for (const config of CURATED_BUNDLED_REMARK_DEPENDENCIES) {
    const owner = metadataForTag(config.ownerTag, "bundled-remark owner");
    if (!owner) continue;
    const ownerLines = owner.unit.content.split(/\r?\n/u);
    const sourceRegions = config.sourceLineRanges.map(([startLine, endLine]) => ({
      startLine,
      endLine,
      rawText: ownerLines.slice(startLine - 1, endLine).join("\n"),
    }));
    if (sourceRegions.some((region) => !(owner.proofs ?? []).some((proof) => (
      proof.startLine <= region.startLine && proof.endLine >= region.endLine
    )))) {
      throw new Error(`Curated bundled-remark evidence for ${config.ownerTag} moved outside its proof`);
    }
    const rawEvidence = sourceRegions.map(({ rawText }) => rawText).join("\n");
    if (!new RegExp(config.expectedPattern, "iu").test(rawEvidence)) {
      throw new Error(`Curated bundled-remark evidence for ${config.ownerTag} no longer matches its audited text`);
    }
    const occurrences = sourceRegions.map(({ startLine, endLine, rawText }) => ({
      lineNumber: startLine,
      endLine,
      context: normalizeWhitespace(rawText).slice(0, 240),
    }));
    const proofStartLines = [...new Set(sourceRegions.map((region) => (
      (owner.proofs ?? []).find((proof) => (
        proof.startLine <= region.startLine && proof.endLine >= region.endLine
      ))?.startLine
    )).filter(Boolean))];
    for (const targetTag of config.targetTags) {
      const target = targetForTag(targetTag, "bundled-remark");
      assertTargetPrecedesOwner(target, owner, "bundled-remark");
      addSemanticGroup({
        owner,
        basis: "audited-bundled-remark",
        targetNode: target.node,
        externalInput: null,
        occurrences,
        proofStartLines,
        routeEvidenceRegions: [],
        routeDebtNotes: [],
        rationale: `An occurrence-level source audit resolves the cited recall bundle to ${target.node.sourceLabel} for this proof use.`,
        evidenceNote: "Occurrence-keyed audit of one fact from the excluded Tag 03II recall bundle; the remark itself was not promoted or globally aliased.",
      });
    }
    if (config.resolvesTag) {
      const resolvedFullLabel = tags.tagToFullLabel.get(config.resolvesTag);
      if (!resolvedFullLabel) throw new Error(`Bundled-remark tag ${config.resolvesTag} is absent`);
      const groupKey = `${owner.node.id}|${resolvedFullLabel}`;
      const ranges = resolvedRangesByGroupKey.get(groupKey) ?? [];
      ranges.push(...config.sourceLineRanges);
      resolvedRangesByGroupKey.set(groupKey, ranges);
      curatedResolvedProofGroupKeys.add(groupKey);
    }
  }
  for (const groupKey of curatedResolvedProofGroupKeys) {
    const [ownerNodeId, fullLabel] = groupKey.split("|");
    const owner = metadataByNodeId.get(ownerNodeId);
    const coveredRanges = resolvedRangesByGroupKey.get(groupKey) ?? [];
    const uncovered = (owner.proofs ?? [])
      .flatMap(({ references }) => references)
      .filter(({ ref }) => resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === fullLabel)
      .filter(({ lineNumber }) => !coveredRanges.some(([startLine, endLine]) => (
        startLine <= lineNumber && endLine >= lineNumber
      )));
    if (uncovered.length > 0) {
      throw new Error(`Curated bundled-remark audit for ${ownerNodeId} left ${uncovered.length} occurrence(s) uncovered`);
    }
  }

  const usedIds = new Set([
    ...sourceUnits.map(({ id }) => id),
    ...nodes.map(({ id }) => id),
    ...externalInputs.map(({ id }) => id),
  ]);

  const directDependencies = [];
  const dependencyIdByPair = new Map();
  const proofGroupsByOwner = new Map();
  const citationGroupsByOwner = new Map();
  let suppressedProofXrefDependencyCount = 0;
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
      const ownerTag = tags.fullLabelToTag.get(owner.node.sourceXmlId);
      const targetTag = tags.fullLabelToTag.get(group.targetNode.sourceXmlId);
      if (CURATED_NONDEPENDENCY_PROOF_XREFS.has(`${ownerTag}|${targetTag}`)) {
        suppressedProofXrefDependencyCount += 1;
        continue;
      }
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
  const explicitProofXrefDependencyCount = directDependencies.length;
  let namedResultDependencyCount = 0;
  let deicticDependencyCount = 0;
  let bundledRemarkDependencyCount = 0;
  for (const ownerGroups of semanticGroupsByOwner.values()) {
    for (const group of ownerGroups.values()) {
      const targetId = group.targetNode?.id ?? group.externalInput.id;
      const pair = `${group.owner.node.id}|${targetId}`;
      if (dependencyIdByPair.has(pair)) continue;
      const id = `dep-${group.owner.node.id}-to-${targetId}`;
      if (usedIds.has(id)) throw new Error(`Duplicate dependency ID: ${id}`);
      usedIds.add(id);
      dependencyIdByPair.set(pair, id);
      const locator = group.occurrences
        .map((item) => occurrenceLocator(group.owner.unit.path, item))
        .join("; ");
      directDependencies.push({
        id,
        dependentNodeId: group.owner.node.id,
        prerequisite: group.targetNode
          ? { type: "node", id: group.targetNode.id }
          : { type: "external-input", id: group.externalInput.id },
        role: group.targetNode ? dependencyRole(group.targetNode) : "logical",
        rationale: group.rationale,
        evidence: capturedEvidence({
          sourceUnitId: unitId(group.owner.unit.stem),
          locator,
          artifactSha256: sha256(canonicalJson(group.occurrences)),
          capturedAt,
          note: group.evidenceNote,
        }),
      });
      if (group.basis === "audited-named-result") namedResultDependencyCount += 1;
      else if (group.basis.includes("deictic")) deicticDependencyCount += 1;
      else if (group.basis === "audited-bundled-remark") bundledRemarkDependencyCount += 1;
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
      const explicitDependencyIds = routeReferenceGroups
        .filter(({ targetNode }) => targetNode && targetNode.id !== owner.node.id)
        .map(({ targetNode }) => dependencyIdByPair.get(`${owner.node.id}|${targetNode.id}`))
        .filter(Boolean);
      const routeProofStartLines = new Set(routeGroup.proofs.map(({ startLine }) => startLine));
      const routeSemanticGroups = [...(semanticGroupsByOwner.get(owner.node.id)?.values() ?? [])]
        .filter(({ proofStartLines }) => proofStartLines.some((line) => routeProofStartLines.has(line)));
      const semanticDependencyIds = routeSemanticGroups
        .map((group) => {
          const targetId = group.targetNode?.id ?? group.externalInput.id;
          return dependencyIdByPair.get(`${owner.node.id}|${targetId}`);
        })
        .filter(Boolean);
      const dependencyIds = [...new Set([...explicitDependencyIds, ...semanticDependencyIds])];
      if (dependencyIds.length === 0) continue;
      const isAlternativeSet = routeGroups.length >= 2;
      const routeKind = isAlternativeSet && groupIndex > 0 ? "alternate-proof" : "source-proof";
      const ordinalSuffix = routeKind === "alternate-proof" ? `-${routeGroup.ordinal}` : "";
      const id = `route-${owner.node.id}-${routeKind}${ordinalSuffix}`;
      if (usedIds.has(id)) throw new Error(`Duplicate proof-route ID: ${id}`);
      usedIds.add(id);
      const routeEvidenceRegions = [...new Map(routeSemanticGroups
        .flatMap(({ routeEvidenceRegions }) => routeEvidenceRegions)
        .map((region) => [`${region.startLine}-${region.endLine}`, region])).values()];
      const locatorParts = [
        ...routeGroup.proofs.map((proof) => (
          `${owner.unit.path}:L${proof.startLine}-L${proof.endLine}`
        )),
        ...routeEvidenceRegions.map((region) => (
          `${owner.unit.path}:L${region.startLine}-L${region.endLine}`
        )),
      ];
      const locator = [...new Set(locatorParts)].join("; ");
      const routeEvidenceText = [
        ...routeGroup.proofs.map(({ rawProof }) => rawProof),
        ...routeEvidenceRegions.map(({ rawText }) => rawText),
      ].join("\n");
      const routeDebtNotes = [...new Set(routeSemanticGroups
        .flatMap(({ routeDebtNotes }) => routeDebtNotes))];
      const hasSemanticDependencies = routeSemanticGroups.length > 0;
      proofRoutes.push({
        id,
        theoremNodeId: owner.node.id,
        routeKind,
        dependencyIds,
        summary: routeKind === "alternate-proof"
          ? "Source-faithful alternate route containing only direct prerequisites explicitly cited or selected by an owner-specific source audit of this separately titled Stacks proof."
          : "Source-faithful candidate route containing direct prerequisites explicitly cited or selected by owner-specific audits of named and deictic proof language in the pinned Stacks source.",
        evidence: capturedEvidence({
          sourceUnitId: unitId(owner.unit.stem),
          locator: locator || owner.node.sourceLocator,
          artifactSha256: sha256(routeEvidenceText),
          capturedAt,
          note: routeKind === "alternate-proof"
            ? `Candidate alternative route from a separately titled source proof${hasSemanticDependencies ? " with owner-specific audited prose dependencies" : ""}; implicit prerequisites remain pending and no independent review is claimed.${routeDebtNotes.length ? ` ${routeDebtNotes.join(" ")}` : ""}`
            : `Candidate route from ${hasSemanticDependencies ? "explicit proof references plus owner-specific audited named, deictic, or bundled-remark dependencies" : "explicit proof references only"}; implicit prerequisites remain pending and no independent review is claimed.${routeDebtNotes.length ? ` ${routeDebtNotes.join(" ")}` : ""}`,
        }),
      });
    }
  }

  const references = [];
  for (const owner of metadata) {
    if (owner.node.nodeClass === "theorem-like") {
      for (const group of proofGroupsByOwner.get(owner.node.id) ?? []) {
        if (group.targetNode) continue;
        if (curatedResolvedProofGroupKeys.has(`${owner.node.id}|${group.fullLabel}`)) continue;
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
    curatedClaimCount: 0,
  }]));
  for (const { node, unit, curatedClaim = false } of metadata) {
    const inventory = inventoryByUnitId.get(unitId(unit.stem));
    if (!inventory) throw new Error(`Missing source-unit inventory for ${unit.path}`);
    if (node.nodeClass === "theorem-like") inventory.theoremNodeIds.push(node.id);
    else inventory.supportNodeIds.push(node.id);
    if (curatedClaim) inventory.curatedClaimCount += 1;
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
          ? "Formal-environment plus curated-claim scan found no theorem-like result in this complete pinned chapter; examples and exercises do not count as theorem nodes."
          : `Formal-environment plus curated-claim scan assigned ${inventory.theoremNodeIds.length} theorem-like and ${inventory.supportNodeIds.length} definition/situation node(s), including ${inventory.curatedClaimCount} exact-label source-audited remark claim(s); examples, exercises, and all other remarks were excluded.`,
      }),
    };
  });

  const curatedClaimCount = metadata.filter(({ curatedClaim }) => curatedClaim).length;
  const excludedEnvironmentCounts = Object.fromEntries(EXCLUDED_ENVIRONMENTS.map((environment) => [
    environment,
    units.reduce((total, unit) => total + environmentRanges(
      unit.content.split(/\r?\n/u),
      environment,
    ).length, 0) - metadata.filter((item) => item.curatedClaim && item.environment === environment).length,
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
      externalInputs,
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
      explicitProofXrefDependencyCount,
      namedResultDependencyCount,
      deicticDependencyCount,
      bundledRemarkDependencyCount,
      semanticDependencyCount: namedResultDependencyCount
        + deicticDependencyCount
        + bundledRemarkDependencyCount,
      suppressedProofXrefDependencyCount,
      curatedResolvedBundledProofXrefCount: curatedResolvedProofGroupKeys.size,
      externalInputCount: externalInputs.length,
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
      curatedClaimCount,
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
        note: `Formal-environment extraction plus ${extracted.stats.curatedClaimCount} exact-label, source-audited theorem-level remark claim(s) from all ${extracted.sourceUnits.length} chapters in the pinned official source: ${kindSummary}. Deliberately excluded ${excludedSummary}; no worked example is a graph node and no other remark was promoted.`,
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
        note: `${extracted.stats.directDependencyCount} candidate edges comprise ${extracted.stats.explicitProofXrefDependencyCount} explicit proof-xref edges and ${extracted.stats.semanticDependencyCount} owner-specific source-audited prose-use edges (${extracted.stats.namedResultDependencyCount} named-result, ${extracted.stats.deicticDependencyCount} deictic-proof, ${extracted.stats.bundledRemarkDependencyCount} bundled-remark); resolved occurrences are merged into edge evidence, and ${extracted.stats.suppressedProofXrefDependencyCount} notation-only proof xref was explicitly suppressed. Zorn's lemma is represented once as a typed external theorem under the source's declared choice convention. ${extracted.stats.unresolvedTaggedProofReferenceCount} unresolved tagged proof-xref records (${extracted.stats.uniqueUnresolvedTaggedProofTargetCount} unique permanent labels) and ${extracted.stats.proofCitationReferenceCount} unresolved bibliographic proof-citation records (${extracted.stats.distinctProofCitationKeyCount} keys) remain review candidates; no bibliographic citation was promoted to an external input. ${extracted.stats.pendingTheoremCount} theorem-like nodes have no route with a resolved candidate prerequisite and remain pending, not roots. No independent mathematical review or graph-completeness claim is made.`,
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
