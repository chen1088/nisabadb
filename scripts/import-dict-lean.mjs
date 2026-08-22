import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import vm from "node:vm";
import { assembleCorpus } from "./corpus-assembly.mjs";
import { bklmPaperPack } from "./paper-packs/bklm-invariance.mjs";
import { proofOverrides } from "./proof-overrides.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const sourceRoot = args.get("--source");
const manuscriptPath = args.get("--manuscript");
const generatedAt = args.get("--timestamp") || "2026-08-21T12:00:00.000Z";
const sourceCommit = "4b6c455234729dd554df5e35058cdd2940fd2c2b";
const paperId = "dimension-free-dictatorship-tester";

if (!sourceRoot || !manuscriptPath) {
  throw new Error("Usage: node scripts/import-dict-lean.mjs --source <dict_lean checkout> --manuscript <author manuscript> [--timestamp <ISO>]");
}

const execFileAsync = promisify(execFile);
const { stdout: suppliedSourceHead } = await execFileAsync(
  "git",
  ["-C", sourceRoot, "rev-parse", "HEAD"],
  { encoding: "utf8" },
);
if (suppliedSourceHead.trim() !== sourceCommit) {
  throw new Error(`dict_lean checkout is ${suppliedSourceHead.trim()}, expected pinned commit ${sourceCommit}`);
}

const dependencySource = await readFile(path.join(sourceRoot, "docs", "dependency-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(dependencySource, context, { filename: "dependency-data.js" });
const legacy = context.window.DICT_DEPENDENCY_DATA;
if (!legacy?.nodes) throw new Error("dict_lean dependency data did not define window.DICT_DEPENDENCY_DATA");
const legacySnapshot = structuredClone(legacy);

// The legacy viewer encoded some definition/result relationships backwards and
// omitted the operational trial and several proof-audited inputs. NisabaDB
// records the corrected directions while retaining the untouched snapshot.
const dependencyCorrections = {
  S02_T02: ["S02_T01"],
  S03_L01: ["S03_D03"],
  S03_L02: ["S03_D03", "S03_L01"],
  S04_D01: ["S03_D03", "S02_L03"],
  S04_P05: ["S04_L01", "S04_P02", "S04_T04", "S03_D03"],
  S04_L06: ["S03_D03", "S02_T02", "S04_P05"],
  S04_L07: ["S02_D01", "S03_D03", "S03_L02", "S04_L06"],
  S05_D08: ["S05_D07", "S05_D03", "S05_D05"],
  S05_L09: ["S05_D06", "S05_T02", "S05_L08"],
  S05_L10: ["S05_D08", "S05_D05"],
  S05_L15: ["S05_D12", "S05_L13", "S05_L14", "S05_L08", "S05_D06"],
  S05_P16: ["S04_P02", "S05_D12", "S05_L14", "S05_T03", "S05_L05", "S05_L15", "S04_L03", "S05_D06", "S05_L08", "S05_L09"],
  S05_L17: ["S05_D10", "S05_L12"],
};
for (const node of legacy.nodes) {
  if (dependencyCorrections[node.id]) node.deps = dependencyCorrections[node.id];
}

legacy.nodes.push({
  id: "S03_D03",
  label: "Construction 3.1",
  title: "Matching cubes and one matching-square trial",
  section: "Matching cubes and one square test",
  kind: "definition",
  importance: "major",
  status: "proven",
  file: "DictatorshipTesting/Paper/Defs/S03_IntDef_MatchingCubeRestriction.lean",
  declarations: [
    "matchingCubeRestriction",
    "cubeColorU",
    "cubeColorV",
    "matchingTrialDelta",
    "matchingTrialTester",
    "matchingTrialTester_run_eq_decide_delta",
  ],
  deps: ["S02_D01", "S02_N02"],
  summary: "Matching-cube coordinates and the operational four-query square trial.",
  statement: "Matching-cube coordinates and the operational four-query square trial.",
  terms: [],
  paperLabel: "alg:matching-trial",
  paperEnv: "definition",
  sourceLineStart: 576,
  sourceLineEnd: 680,
  sourceLocator: "Matching-cube coordinates, source lines 576-629; one matching-cube square test, source lines 664-680",
  paperStatementLatex: String.raw`Let \(M=\{e_1,\ldots,e_m\}\) be an ordered near-perfect matching of \([n]\), let \(\tau_{e_r}\) be the transposition on \(e_r\), and set
\[
  \tau_x=\prod_{r=1}^m\tau_{e_r}^{x_r},\qquad
  A_M=\{\tau_x:x\in\{0,1\}^m\}.
\]
For a right coset \(C=\rho_CA_M\), the map \(x\mapsto\rho_C\tau_x\) is a bijection and the cube restriction is \(g_{C,M}(x)=f(\rho_C\tau_x)\).

One matching-square trial samples \(M\) uniformly, colors each edge independently by \(0,A,B\) with probability \(1/3\) each, and lets \(u_r=1\) exactly on color \(A\) and \(v_r=1\) exactly on color \(B\). It then samples \(\pi\in S_n\) uniformly, queries
\[
  f(\pi),\quad f(\pi\tau_u),\quad f(\pi\tau_v),\quad f(\pi\tau_u\tau_v),
\]
and rejects exactly when their alternating sum
\[
  \Delta=f(\pi)-f(\pi\tau_u)-f(\pi\tau_v)+f(\pi\tau_u\tau_v)
\]
is nonzero. The directions have disjoint support, so these queries are the four corners of one cube square.`,
  leanLinks: [
    { name: "matchingCubeRestriction", file: "DictatorshipTesting/Paper/Defs/S03_IntDef_MatchingCubeRestriction.lean", line: 21 },
    { name: "cubeColorU", file: "DictatorshipTesting/Paper/Defs/S03_IntDef_CubeColorU.lean", line: 19 },
    { name: "cubeColorV", file: "DictatorshipTesting/Paper/Defs/S03_IntDef_CubeColorV.lean", line: 19 },
    { name: "matchingTrialDelta", file: "DictatorshipTesting/Paper/Defs/S03_IntDef_MatchingTrialDelta.lean", line: 22 },
    { name: "matchingTrialTester", file: "DictatorshipTesting/Paper/S04_Lem4_07_IndependentRepetition.lean", line: 54 },
    { name: "matchingTrialTester_run_eq_decide_delta", file: "DictatorshipTesting/Paper/S04_Lem4_07_IndependentRepetition.lean", line: 66 },
  ],
});

const l13 = legacy.nodes.find((node) => node.id === "S05_L13");
const l10 = legacy.nodes.find((node) => node.id === "S05_L10");
if (l13 && l10) {
  const alignedL10Names = new Set([
    "S05_signedTwoBoxChild_orthogonal_decomposition",
    "S05_signedTwoBoxChildEmbedding_isometry",
    "S05_signedTwoBoxChildEmbedding_finalOperator",
    "S05_signedTwoBoxChildEmbedding_intertwinesEarlierAdjacent",
    "S05_signedTwoBoxChildEmbedding_ranges_orthogonal",
    "S05_signedTwoBoxChildEmbeddings_span",
  ]);
  l10.leanLinks = [
    ...(l10.leanLinks || []),
    ...(l13.leanLinks || []).filter((link) => alignedL10Names.has(link.name)),
  ];
  l10.declarations = l10.leanLinks.map((link) => link.name);
}

function appendLeanLinks(statementId, links) {
  const node = legacy.nodes.find((candidate) => candidate.id === statementId);
  if (!node) return;
  const existingNames = new Set((node.leanLinks || []).map((link) => link.name));
  node.leanLinks = [
    ...(node.leanLinks || []),
    ...links.filter((link) => !existingNames.has(link.name)),
  ];
  node.declarations = node.leanLinks.map((link) => link.name);
}

appendLeanLinks("S05_D10", [
  { name: "S05_evenSignPatternMultiset", file: "DictatorshipTesting/Paper/Defs/S05_Def5_10a_EvenSignPatternMultiset.lean", line: 49 },
  { name: "S05_zeroSignPatternMultiplicity", file: "DictatorshipTesting/Paper/Defs/S05_Def5_10a_EvenSignPatternMultiset.lean", line: 62 },
  { name: "S05_highSignPatternMultiplicity", file: "DictatorshipTesting/Paper/Defs/S05_Def5_10a_EvenSignPatternMultiset.lean", line: 67 },
  { name: "S05_oddSignPatternMultiset", file: "DictatorshipTesting/Paper/Defs/S05_Def5_10b_OddSignPatternMultiset.lean", line: 31 },
  { name: "S05_oddHighSignPatternCount", file: "DictatorshipTesting/Paper/Defs/S05_Def5_10b_OddSignPatternMultiset.lean", line: 38 },
]);

appendLeanLinks("S05_L01", [
  { name: "S05_Lem5_01_youngAdjacentOperator_sq", file: "DictatorshipTesting/Paper/S05_Lem5_01_AdjacentTranspositionsInYoungsBasis.lean", line: 1068 },
  { name: "S05_Lem5_01_youngAdjacentOperator_comm_of_disjoint_indices", file: "DictatorshipTesting/Paper/S05_Lem5_01_AdjacentTranspositionsInYoungsBasis.lean", line: 1141 },
  { name: "S05_Lem5_01_youngAdjacentOperator_braid_of_succ", file: "DictatorshipTesting/Paper/S05_Lem5_01_AdjacentTranspositionsInYoungsBasis.lean", line: 1181 },
  { name: "S05_Lem5_01_youngAdjacent_coxeter_relations", file: "DictatorshipTesting/Paper/S05_Lem5_01_AdjacentTranspositionsInYoungsBasis.lean", line: 1193 },
  { name: "youngAdjacentOperator_braid_basis_of_succ", file: "AlgebraicLibrary/Young/OrthogonalRepresentation.lean", line: 3989 },
]);

appendLeanLinks("S05_T02", [
  { name: "adjacent_cons_ascendingSegment_normalForm", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 287 },
  { name: "exists_ascendingSegment_lift_normalForm", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 331 },
  { name: "adjacentWordPerm_complete", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 393 },
  { name: "adjacentWordPerm_surjective", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 444 },
  { name: "youngPermutationOperator_mul", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 554 },
  { name: "youngPermutationOperator_adjacent", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 571 },
  { name: "youngOrthogonalActionData_nonempty", file: "AlgebraicLibrary/Young/AdjacentCoxeterPresentation.lean", line: 597 },
]);

appendLeanLinks("S04_P05", [
  { name: "oneTrialDeltaSqExpectation_ge_matchingMeanProjectionError", file: "DictatorshipTesting/Paper/S04_Prop4_05_SquareEnergyControlsGlobalDegree.lean", line: 102 },
]);

appendLeanLinks("S04_L06", [
  { name: "bool_four_query_delta_sq_le_indicator", file: "DictatorshipTesting/Paper/S04_Lem4_06_OneTrialSoundness.lean", line: 32 },
  { name: "matchingTrialDelta_sq_le_four_rejectIndicator", file: "DictatorshipTesting/Paper/S04_Lem4_06_OneTrialSoundness.lean", line: 40 },
  { name: "oneTrialRejectProbability_ge_deltaSqExpectation", file: "DictatorshipTesting/Paper/S04_Lem4_06_OneTrialSoundness.lean", line: 55 },
]);

appendLeanLinks("S05_L09", [
  { name: "natAdjacentCoordinateSwap_degreeOneCoordinateVector_right", file: "DictatorshipTesting/Paper/S05_Int_DegreeOneYoungBlock.lean", line: 729 },
  { name: "standardCoordinateMap_youngAdjacentOperator_basis", file: "DictatorshipTesting/Paper/S05_Int_DegreeOneYoungBlock.lean", line: 1414 },
  { name: "standardCoordinateMap_intertwines_youngAction", file: "DictatorshipTesting/Paper/S05_Int_DegreeOneYoungBlock.lean", line: 1606 },
  { name: "U1_eq_concreteDegreeOneYoungBlockSum", file: "DictatorshipTesting/Paper/S05_Int_DegreeOneYoungBlock.lean", line: 2294 },
  { name: "l2DistSqToU1_eq_sum_concreteYoungBlockEnergy", file: "DictatorshipTesting/Paper/S05_Lem5_09_DegreeOneYoungBlockIdentification.lean", line: 38 },
]);

appendLeanLinks("S05_P16", [
  { name: "S05_averagedHighMatchingElement_rightConvolution", file: "DictatorshipTesting/Paper/Defs/S05_Def5_12c_AveragedHighMatchingElement.lean", line: 428 },
  { name: "S05_averagedHighMatchingElement_central", file: "DictatorshipTesting/Paper/Defs/S05_Def5_12c_AveragedHighMatchingElement.lean", line: 501 },
  { name: "S05_averagedRejectionYoungOperator_scalar_from_section5", file: "DictatorshipTesting/Paper/Defs/S05_Def5_12c_AveragedHighMatchingElement.lean", line: 667 },
  { name: "matchingMeanProjectionError_eq_inner_averagedHighConvolution", file: "DictatorshipTesting/Paper/S05_Prop5_16_AveragedRejectionOnYoungBlocks.lean", line: 335 },
  { name: "matchingHighIdempotent_eq_zero_of_mem_U1", file: "DictatorshipTesting/Paper/S05_Prop5_16_AveragedRejectionOnYoungBlocks.lean", line: 389 },
  { name: "rightConvolution_averagedHigh_eq_zero_of_mem_U1", file: "DictatorshipTesting/Paper/S05_Prop5_16_AveragedRejectionOnYoungBlocks.lean", line: 400 },
]);

const manuscript = await readFile(manuscriptPath, "utf8");
const manuscriptHash = createHash("sha256").update(manuscript).digest("hex");
const manuscriptLines = manuscript.split(/\r?\n/);

const leanFileLines = new Map();
for (const file of new Set(legacy.nodes.flatMap((node) => (node.leanLinks || []).map((link) => link.file || node.file)))) {
  leanFileLines.set(file, (await readFile(path.join(sourceRoot, file), "utf8")).split(/\r?\n/));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarationLine(link) {
  const lines = leanFileLines.get(link.file);
  if (!lines) return link.line;
  const shortName = link.name.split(".").at(-1);
  const declarationPattern = new RegExp(`\\b(?:axiom|theorem|lemma|def|abbrev|structure|class|instance|opaque)\\s+${escapeRegExp(shortName)}(?:\\s|$|\\[|\\{|\\()`);
  const exactPattern = new RegExp(`\\b${escapeRegExp(link.name)}\\b`);
  const declarationIndex = lines.findIndex((line) => declarationPattern.test(line));
  if (declarationIndex >= 0) return declarationIndex + 1;
  const exactIndex = lines.findIndex((line) => exactPattern.test(line));
  return exactIndex >= 0 ? exactIndex + 1 : link.line;
}

function manuscriptLine(label) {
  if (!label) return undefined;
  const line = manuscriptLines.findIndex((value) => value.includes(`{${label}}`));
  return line >= 0 ? line + 1 : undefined;
}

function normalizeLatex(value) {
  return String(value || "")
    .replace(/\\label(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\tag\{[^}]*\}/g, "")
    // Replacement strings interpret `$$` as one literal dollar sign, so use
    // callbacks to preserve Markdown's two-dollar display-math delimiter.
    .replace(/\\begin\{equation\*?\}/g, () => "\n$$\n")
    .replace(/\\end\{equation\*?\}/g, () => "\n$$\n")
    .replace(/\\begin\{align\*?\}/g, () => "\n$$\n\\begin{aligned}\n")
    .replace(/\\end\{align\*?\}/g, () => "\n\\end{aligned}\n$$\n")
    .replace(/\\begin\{enumerate\}(?:\[[^\]]*\])?/g, "\n")
    .replace(/\\end\{enumerate\}/g, "\n")
    .replace(/\\item\s*/g, "\n1. ")
    .replace(/\\cref\{alg:matching-trial\}/gi, "the matching-square trial")
    .replace(/\\[Cc]ref\{([^}]*)\}/g, (_match, label) => `the source statement \\(${label}\\)`)
    .replace(/\\eqref\{([^}]*)\}/g, (_match, label) => `the source equation \\(${label}\\)`)
    .replace(/\\emph\{([^{}]*)\}/g, "*$1*")
    .replace(/\\textsc\{([^{}]*)\}/g, "\\text{$1}")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mappedKind(node) {
  if (node.kind === "definition") return "definition";
  if (node.kind === "notation") return "notation";
  const environment = node.paperEnv || "";
  if (environment === "proposition") return "proposition";
  if (environment === "lemma") return "lemma";
  if (environment === "corollary") return "corollary";
  if (node.id === "S02_T01" || node.id === "S02_T02") return "imported-result";
  return "theorem";
}

const standardLeanAxioms = ["propext", "Classical.choice", "Quot.sound"];
const namedMathematicalAxiomsByStatement = {
  S01_T01: ["fknStability_input"],
  S02_T01: ["booleanU1_dictator_classification_input"],
  S02_T02: ["fknStability_input"],
  S04_L06: ["fknStability_input"],
};
const nativeDecisionAxiomStatements = new Set([
  "S01_T01",
  "S04_T04",
  "S04_P05",
  "S04_L06",
  "S05_L19",
  "S05_L20",
]);
const alignmentCaveatsByStatement = {
  S02_T01: "The paper statement omits a rank restriction. The Lean wrapper assumes 1 <= n; its named axiom handles 3 <= n and the small positive ranks are discharged separately. The n = 0 formulation is false under the formal definition. Attribution also needs review: the manuscript cites Ellis--Friedgut--Pilpel (2011) and Ellis--Filmus--Friedgut (2017), while dict_lean/ASSUMPTIONS.md points to Filmus (2021), Theorem 2.8.",
  S02_T02: "The paper statement omits a rank restriction. Both the Lean wrapper and its named FKN input assume 4 <= n.",
  S04_P05: "The manuscript statement omits the necessary hypothesis 4 <= n, although its proof invokes Theorem 4.4 with that hypothesis and the Lean declaration includes it. The displayed NisabaDB statement restores the restriction; at n = 3 every matching cube has dimension one and the claimed lower bound is false.",
  S04_L06: "The manuscript statement omits the necessary hypothesis 4 <= n, although its proof invokes Proposition 4.5 and the FKN input with that hypothesis and the Lean declaration includes it. The displayed NisabaDB statement restores the restriction.",
  S05_L10: "The legacy viewer linked only a set-level tableau equivalence. NisabaDB adds the later unitarity, orthogonal-sum, eigenvalue, and intertwining declarations; full human-formal alignment remains pending.",
  S05_D10: "The manuscript's displayed base and recursion define the even and odd multisets for m >= 1. The Lean source additionally supplies a coherent m = 0 even base; NisabaDB keeps that formal extension visible without importing it into the displayed paper definition.",
  S05_L12: "The manuscript cardinality clause uses the sign-pattern multisets defined from m >= 1. NisabaDB makes that range explicit; the Lean source additionally supports its coherent m = 0 extension.",
  S05_L13: "The manuscript proof starts with the m = 1 matching basis and recurses upward. NisabaDB makes m >= 1 explicit because the displayed sign-pattern multisets are not defined at m = 0.",
  S05_L15: "The trace formula uses the sign-pattern heights defined in the manuscript for m >= 1. NisabaDB makes that range explicit; the formal source also has a coherent rank-zero extension.",
  S05_P16: "The displayed scalar formulas use sign-pattern heights with m >= 1. NisabaDB therefore states n >= 2, excluding the undefined manuscript cases n = 0 and n = 1 while retaining the positive low ranks.",
  S05_L17: "The source wording says every partition of 2m, but its defining manuscript recursion and proof start at m >= 2. Lean adds an m = 0 base and can state its recurrence from m >= 1. NisabaDB makes the manuscript range m >= 2 explicit.",
  S05_L18: "The manuscript proof starts at m = 1, and z_m is displayed only for m >= 1. NisabaDB makes that range explicit; the Lean development separately supplies a rank-zero extension.",
};

const statementCorrections = {
  S02_T01: (statement) => `Assume \\(n\\ge 1\\). ${statement}`,
  S02_T02: (statement) => `Assume \\(n\\ge 4\\). ${statement}`,
  S04_P05: (statement) => `Assume \\(n\\ge 4\\). ${statement}`,
  S04_L06: (statement) => `Assume \\(n\\ge 4\\). ${statement}`,
  S05_D10: (statement) => `For this definition, assume \\(m\\ge1\\). ${statement}`,
  S05_L12: (statement) => statement.replace("Moreover,\n\\[", "Moreover, for \\(m\\ge1\\),\n\\["),
  S05_L13: (statement) => `Assume \\(m\\ge1\\). ${statement}`,
  S05_L15: (statement) => `Assume \\(m\\ge1\\). ${statement}`,
  S05_P16: (statement) => `Assume \\(n\\ge2\\). ${statement}`,
  S05_L17: (statement) => statement.replace("For every $\\lambda\\vdash2m$", "For every $m\\ge2$ and every $\\lambda\\vdash2m$"),
  S05_L18: (statement) => `Assume \\(m\\ge1\\). ${statement}`,
};

const statementCorrectionNotes = {
  S02_T01: "The manuscript omits a rank condition. NisabaDB restores n >= 1, matching the proved Lean wrapper; the unrestricted n = 0 formulation is false.",
  S02_T02: "The manuscript omits a rank condition. NisabaDB restores n >= 4, matching both the named FKN input and its Lean wrapper.",
  S04_P05: "The manuscript omits n >= 4 even though its proof uses Theorem 4.4, which has that hypothesis. NisabaDB restores it; the unrestricted claim fails at n = 3.",
  S04_L06: "The manuscript omits n >= 4 even though its proof uses the corrected Proposition 4.5 and the rank-restricted FKN input. NisabaDB restores it.",
  S05_D10: "The displayed bases and recursion define the manuscript's sign-pattern multisets for m >= 1. Lean additionally provides a coherent m = 0 extension.",
  S05_L12: "The sign-pattern cardinality identities use the manuscript multisets defined for m >= 1. NisabaDB states that range explicitly.",
  S05_L13: "The displayed matching eigenbasis is indexed by sign-pattern multisets defined for m >= 1. NisabaDB states that range explicitly.",
  S05_L15: "The displayed trace formulas use sign-pattern heights defined for m >= 1. NisabaDB states that range explicitly.",
  S05_P16: "The displayed block scalars use sign-pattern heights with m >= 1. NisabaDB states n >= 2 so both parity formulas stay within that range.",
  S05_L17: "The displayed recurrence uses z_(m-1) and h_(m-1), and the source recursion is defined for m >= 2. NisabaDB states that range explicitly.",
  S05_L18: "The manuscript's z_m definition and the proof's base case begin at m = 1. NisabaDB states that range explicitly.",
};

const statementFormatting = {
  // A display equation immediately after a Markdown list marker is parsed as
  // one unterminated math block by remark-math. Keep the source semantics while
  // placing this short identity inline inside its numbered item.
  S05_L11: (statement) => statement.replace(
    /1\. \$\$\s*([\s\S]*?)\s*\$\$/,
    (_match, expression) => `1. $${expression.trim().replace(/\s+/g, " ")}$`,
  ),
};

const importedSourceAttributions = {
  S02_T01: "The manuscript attributes this classification to Ellis--Friedgut--Pilpel (2011) and Ellis--Filmus--Friedgut (2017), whereas dict_lean/ASSUMPTIONS.md points to Filmus (2021), Theorem 2.8. NisabaDB preserves that discrepancy for review; the proof has not yet been distilled.",
  S02_T02: "The manuscript invokes the symmetric-group FKN stability theorem from Filmus, Boolean functions on S_n which are nearly linear (Discrete Analysis 2021:25, Theorem 1.5), together with the classification input. The Lean development records this as the named axiom fknStability_input; the proof has not yet been distilled.",
};

function formalDeclarations(node) {
  const mathematicalAxioms = namedMathematicalAxiomsByStatement[node.id] || [];
  const nativeAxioms = nativeDecisionAxiomStatements.has(node.id)
    ? ["fourColumnDiagramFour._native.native_decide.ax_1"]
    : [];
  const axiomFootprint = [...standardLeanAxioms, ...mathematicalAxioms, ...nativeAxioms];
  return (node.leanLinks || []).map((link) => ({
    prover: {
      id: "lean4",
      label: "Lean 4",
      checker: "Lean kernel",
    },
    repository: "chen1088/dict_lean",
    commit: sourceCommit,
    file: link.file || node.file,
    name: link.name,
    lineStart: declarationLine(link),
    kernelChecks: true,
    hasSorry: false,
    hasAdmit: false,
    unresolvedPlaceholders: [],
    usesExternalInput: mathematicalAxioms.length > 0 || nativeAxioms.length > 0,
    axiomFootprint,
    auditNote: `${alignmentCaveatsByStatement[node.id] ? `${alignmentCaveatsByStatement[node.id]} ` : ""}${mathematicalAxioms.length > 0
      ? `Kernel-checked and axiom-audited at the pinned commit; conditional on named mathematical input ${mathematicalAxioms.join(", ")}. Standard logical axioms and any native-decision axiom are listed explicitly.`
      : nativeAxioms.length > 0
        ? "Kernel-checked and axiom-audited at the pinned commit; uses the listed native_decide trust boundary in addition to standard Lean logical axioms."
        : "Kernel-checked and axiom-audited at the pinned commit; only standard Lean logical axioms are listed. Repository-wide sorry/admit/opaque/unsafe scan is clean."}`,
  }));
}

function defaultIdea(node) {
  if (node.kind === "definition" || node.kind === "notation") {
    return `This node fixes the precise objects and notation used for ${node.title.toLowerCase()}.`;
  }
  return `The human-readable proof of ${node.label} has not yet been distilled from the author manuscript and pinned Lean source.`;
}

function proofRoutes(node, declarations) {
  if (node.kind === "definition" || node.kind === "notation") return [];
  const override = proofOverrides[node.id];
  const isImported = node.id === "S02_T01" || node.id === "S02_T02";
  const customAxioms = namedMathematicalAxiomsByStatement[node.id] || [];
  const sourceAttribution = isImported
    ? importedSourceAttributions[node.id]
    : override
      ? `New NisabaDB compression of the 2026-07-15 shortened author manuscript, cross-checked against dict_lean ${sourceCommit.slice(0, 12)} at the declaration level.`
      : `Statement and dependency route imported from dict_lean ${sourceCommit.slice(0, 12)}; no human proof is asserted until the source and formal routes are distilled.`;

  return [{
    id: isImported ? "historical-source" : "compressed-source",
    label: isImported ? "Literature source" : "Compressed source",
    type: isImported ? "historical" : "compressed-source",
    dependencyKind: "original",
    reviewStatus: "reviewed",
    interpretationNote: "Source-route dependencies retained from the audited paper and pinned formal graph.",
    conceptualCost: node.section.includes("Section 5") ? "specialist" : node.importance === "hero" ? "moderate" : "low",
    dependencies: [...(node.deps || [])],
    status: override ? "complete" : "proof-not-yet-distilled",
    proof: override?.proof || "**Proof not yet distilled.** NisabaDB records the exact statement, declared prerequisites, pinned formal declarations, and current audit state, but does not claim a human-readable proof for this node yet.",
    steps: override?.steps || [],
    sourceAttribution,
    verificationStatus: override
      ? customAxioms.length > 0 ? "conditional-formalization" : "human-formal-alignment-pending"
      : declarations.length > 0 ? "human-formal-alignment-pending" : "statement-only",
    formalAlignment: "pending",
  }];
}

const statements = legacy.nodes.map((node) => {
  const declarations = formalDeclarations(node);
  const routes = proofRoutes(node, declarations);
  const indexedLine = manuscriptLine(node.paperLabel);
  const lineStart = Number.isInteger(node.sourceLineStart) ? node.sourceLineStart : indexedLine;
  const lineEnd = Number.isInteger(node.sourceLineEnd) ? node.sourceLineEnd : undefined;
  const customAxioms = namedMathematicalAxiomsByStatement[node.id] || [];
  const sourceLocations = [{
    type: "manuscript",
    label: "Author manuscript",
    locator: node.sourceLocator || (lineStart
      ? `${node.section}; ${node.paperLabel || node.label}; source line ${lineStart}`
      : `${node.section}; ${node.paperLabel || node.label}`
    ),
    version: `2026-07-15 shortened author manuscript, sha256:${manuscriptHash}`,
    ...(lineStart ? { lineStart } : {}),
    ...(lineEnd ? { lineEnd } : {}),
  }];
  if (node.file) {
    sourceLocations.push({
      type: "lean",
      label: "Pinned Lean source",
      url: `https://github.com/chen1088/dict_lean/blob/${sourceCommit}/${node.file}${node.leanLinks?.[0]?.line ? `#L${declarationLine(node.leanLinks[0])}` : ""}`,
      locator: node.leanLinks?.length
        ? node.leanLinks.map((link) => `${link.name}:L${declarationLine(link)}`).join(", ")
        : node.file,
      version: sourceCommit,
      repository: "chen1088/dict_lean",
      commit: sourceCommit,
      file: node.file,
      ...(node.leanLinks?.[0]?.line ? { lineStart: declarationLine(node.leanLinks[0]) } : {}),
    });
  }

  const kind = mappedKind(node);
  const normalizedStatement = normalizeLatex(node.paperStatementLatex || node.statement);
  const sourceStatement = statementFormatting[node.id]
    ? statementFormatting[node.id](normalizedStatement)
    : normalizedStatement;
  const exactStatement = statementCorrections[node.id]
    ? statementCorrections[node.id](sourceStatement)
    : sourceStatement;
  return {
    id: node.id,
    paperId,
    localLabel: node.label,
    globalStatementId: `${paperId}.${node.id.toLowerCase().replaceAll("_", "-")}`,
    kind,
    title: node.title,
    section: node.section,
    importance: node.importance,
    exactStatement,
    ...(statementCorrections[node.id] ? {
      sourceStatement,
      statementNote: statementCorrectionNotes[node.id],
    } : {}),
    idea: proofOverrides[node.id]?.idea || defaultIdea(node),
    proofRoutes: routes,
    dependencies: [...(node.deps || [])],
    sourceLocations,
    formalDeclarations: declarations,
    formalStatus: declarations.length === 0
      ? "statement-only"
      : customAxioms.length > 0 ? "conditional-formalization" : "axiom-audited",
    formalAlignment: "pending",
    contributors: {
      distillers: proofOverrides[node.id] ? ["NisabaDB project"] : [],
      mathematicalReviewers: [],
      formalizers: declarations.length > 0 ? ["Chen Xu"] : [],
      alignmentReviewers: [],
    },
    version: "1.0.0",
    modificationHistory: [{
      version: "1.0.0",
      timestamp: generatedAt,
      contributors: ["NisabaDB project"],
      summary: `Imported from the author manuscript and dict_lean ${sourceCommit.slice(0, 12)}; dependency, proof, and formal-alignment audit recorded.`,
    }],
    tags: [node.section, kind, ...(customAxioms.length ? ["conditional"] : [])],
    ...((kind === "definition" || kind === "notation") ? {
      intuition: `The exact statement is kept as the canonical reference; dependency links show which earlier objects are required to make this definition well-formed.`,
    } : {}),
  };
});

const paperRoots = legacy.nodes.filter((node) => node.kind === "paper").map((node) => node.id);
const section5Roots = legacy.nodes.filter((node) => node.kind === "paper" && node.id.startsWith("S05_")).map((node) => node.id);
const nodeById = new Map(legacy.nodes.map((node) => [node.id, node]));
const transitive = new Set();
function visit(id) {
  const node = nodeById.get(id);
  if (!node || transitive.has(id)) return;
  transitive.add(id);
  (node.deps || []).forEach(visit);
}
visit("S01_T01");

const mainPaper = {
  id: paperId,
  title: "A Dimension-Free Dictatorship Tester on the Symmetric Group",
  authors: ["Chaowen Guan", "Chen Xu", "Xiangyu Guo", "GPT-5.5"],
  date: "2026-07-15",
  venue: "STOC 2027 shortened author manuscript; publication status not independently verified",
  status: "gold",
  identifiers: { internal: `author-manuscript-sha256:${manuscriptHash}` },
  sourceLinks: [
    { label: "Lean formalization", url: `https://github.com/chen1088/dict_lean/tree/${sourceCommit}` },
    { label: "Original dependency viewer", url: `https://chen1088.github.io/dict_lean/` },
  ],
  contributionSummary: "A nonadaptive one-sided tester for Boolean dictators on the symmetric group using O(epsilon^-2) queries independent of n. Matching cubes reduce local behavior to Boolean-cube square tests; a Young-representation spectral gap connects local rejection to global distance.",
  importProvenance: [
    { provider: "author-manuscript", retrievedAt: generatedAt, recordId: `sha256:${manuscriptHash}` },
    { provider: "github", retrievedAt: generatedAt, recordId: `chen1088/dict_lean@${sourceCommit}` },
  ],
  license: {
    metadata: "Bibliographic metadata and NisabaDB-authored distillation may be redistributed with attribution.",
    fullText: "No public full-text license was found; the author manuscript is not republished here.",
  },
  rewriteStatus: "partial-distillation",
  theoremExtractionStatus: "complete",
  formalizationStatus: "conditional-formalization",
  citationCoverage: {
    outgoingFound: 17,
    outgoingResolved: 17,
    incomingFound: 0,
    incomingResolved: 0,
    incomingStatus: "target-unindexed",
    providerSearchesAttempted: 5,
    recursiveClosureComplete: false,
    note: "All 17 in-text outgoing citations are resolved. The manuscript has no DOI, arXiv, OpenAlex, Semantic Scholar, or DataCite identity, so zero provider-visible incoming citations is not evidence that no real incoming citations exist.",
  },
  version: `manuscript-sha256:${manuscriptHash};lean:${sourceCommit}`,
  modificationHistory: [{
    version: "1.0.0",
    timestamp: generatedAt,
    contributors: ["NisabaDB project"],
    summary: "Created the first gold rewrite from the pinned author manuscript, formal source, and reviewed citation audit.",
  }],
  featured: true,
  graph: {
    mainRoot: "S01_T01",
    paperRoots,
    views: [
      {
        id: "main",
        label: "Main theorem",
        roots: ["S01_T01"],
        initiallyExpanded: [...transitive].filter((id) => nodeById.get(id)?.kind === "paper"),
      },
      {
        id: "paper",
        label: "Complete paper map",
        roots: paperRoots,
        initiallyExpanded: ["S01_T01", "S04_T04", "S05_P16", "S05_L19", "S05_L20"],
      },
      {
        id: "section5",
        label: "Section 5",
        roots: section5Roots,
        initiallyExpanded: ["S05_P16", "S05_L19", "S05_L20", "S05_L13", "S05_L08", "S05_T02"],
      },
    ],
  },
};

const neighborhood = JSON.parse(await readFile("data/citation-neighborhood.json", "utf8"));
const corpus = assembleCorpus({
  schemaVersion: "1.0.0",
  generatedAt,
  primaryPapers: [mainPaper],
  primaryStatements: statements,
  neighborhood,
  goldPacks: [bklmPaperPack],
});

await mkdir("data/source-snapshots", { recursive: true });
await mkdir("src/data", { recursive: true });
await writeFile(
  "data/source-snapshots/dict-lean-dependency-data.json",
  `${JSON.stringify({ sourceRepository: legacySnapshot.repoUrl, sourceCommit, nodes: legacySnapshot.nodes }, null, 2)}\n`,
);
await writeFile("src/data/corpus.json", `${JSON.stringify(corpus, null, 2)}\n`);

const completeProofs = statements.filter((statement) => statement.proofRoutes.some((route) => route.status === "complete")).length;
console.log(`Imported ${statements.length} statements (${completeProofs} complete shortened proofs) from dict_lean ${sourceCommit}.`);
console.log(`Author manuscript SHA-256: ${manuscriptHash}`);
