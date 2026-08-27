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
  ["algebra-remark-fundamental-diagram", {
    title: "Affine fibres and primes under a ring map",
    startLine: 3421,
    endLine: 3497,
    sourceTextSha256: "40268cd94b6f364d69d1c8310d5b63d0f1dea0623dae588a2ac349f09045ab55",
  }],
  ["spaces-chow-remark-infinite-sums-rational-equivalences", {
    title: "Locally supported sums of rational equivalences",
    startLine: 1773,
    endLine: 1800,
    sourceTextSha256: "65c0b5dfc6e7ea9cbf8214d13d0c2e756f96d138696a94dd2fbfc4bd80108774",
  }],
  ["categories-remark-left-dual-adjoint", {
    title: "Adjoint characterization and uniqueness of left duals",
    startLine: 9385,
    endLine: 9438,
    sourceTextSha256: "befc4e009ad1ef5308039a0453426673be611cbaf2aa09918ad979058d06241b",
  }],
]);

// This exact labeled prose/display span states and derives a general result,
// rather than merely defining notation for the displayed equation. The raw
// span hash is pinned so that source drift fails extraction instead of silently
// changing the promoted claim.
const CURATED_PROSE_CLAIMS = new Map([
  ["derived-equation-long-exact-cohomology-sequence", {
    title: "Long exact sequence associated to a distinguished triangle",
    startLine: 277,
    endLine: 296,
    sourceTextSha256: "7681c73366465bd0ef97fb5f144a2780d4b47dd88f49a42759bcdf08729072cc",
  }],
]);

// Direct prerequisites of promoted claims whose derivations are stated in
// prose rather than with explicit \ref commands. Each phrase count is checked
// only inside the exact source span captured as that claim's inline proof.
const CURATED_CLAIM_DEPENDENCIES = [
  {
    ownerTag: "0148",
    targetTag: "0145",
    phrasePattern: "Our discussion of TR2 above",
    expectedOccurrenceCount: 1,
  },
  {
    ownerTag: "0148",
    targetTag: "0147",
    phrasePattern: "homological functor",
    expectedOccurrenceCount: 2,
  },
  {
    ownerTag: "0FFR",
    targetTag: "0FFP",
    phrasePattern: "property of being a left dual",
    expectedOccurrenceCount: 1,
  },
  {
    ownerTag: "0EQ8",
    targetTag: "0EQ6",
    phrasePattern: "rational equivalences",
    expectedOccurrenceCount: 1,
  },
];

// Complete incoming proof-reference inventories for the newly promoted claims.
// This prevents later source revisions from silently inheriting an audit that
// was performed only for the owner occurrences listed here.
const CURATED_CLAIM_INCOMING_REFERENCE_COUNTS = new Map([
  ["0148", { "05SR": 1, "05R5": 2, "05RD": 1, "05RE": 1, "05RM": 1, "0CQQ": 1 }],
  ["00E6", { "00E7": 1, "00GT": 1, "05DR": 1, "00HQ": 1, "0BRB": 2, "09EF": 1, "00QE": 1, "00SJ": 1, "0BK8": 1, "01K1": 1 }],
  ["0EQ8", { "0EQB": 1, "0EQR": 1, "0ER5": 1, "0ER6": 1, "0ERC": 1, "0ERG": 1, "0ERU": 1, "0ERV": 1 }],
  ["0FFR", { "0FFS": 1, "0FFT": 1, "0FFU": 1, "0FPA": 1, "0FPS": 1, "0FNW": 1, "0FNZ": 1 }],
]);

const CURATED_CITATION_SOURCE_REVISION = "ed88ff783bcb4dd9a28518a33b028841094009cf";
const CURATED_SECTION_DELEGATION_SOURCE_REVISION = "ed88ff783bcb4dd9a28518a33b028841094009cf";

// Exact bibliographic theorem invocations verified against primary sources.
// Multiple citations or owners can attest one reusable external theorem input;
// every local owner body and citation occurrence is hash-guarded.
const CURATED_EXTERNAL_CITATION_INPUTS = [
  {
    id: "external-cumulative-hierarchy-exhaustion",
    label: "Cumulative-hierarchy exhaustion",
    normalizedStatement: "With V_0 empty, V_{alpha + 1} the power set of V_alpha, and V_lambda the union of earlier stages at a limit ordinal, every set belongs to V_alpha for some ordinal alpha.",
    sourceCitation: "Thomas Jech, Set Theory, Lemma 6.3; https://doi.org/10.1007/3-540-44761-X",
    uses: [
      { ownerTag: "000C", citationKey: "Jech", pinpoint: "Lemma 6.3", ownerSourceTextSha256: "e894791e11547e7bb4c5e3da90a95a09b5016005f729a5dd0c29253fa5af120b", citationArtifactSha256: "1ea5576ac940d89782d8977ef742edfbbfb96a4f4f7749072914a2ec56aaff30" },
    ],
  },
  {
    id: "external-finite-formula-reflection",
    label: "Finite-formula reflection theorem",
    normalizedStatement: "For a finite list of formulas and an initial set M_0, some limit ordinal alpha contains M_0 in V_alpha and makes every listed formula absolute between V_alpha and the universe for parameters in V_alpha.",
    sourceCitation: "Thomas Jech, Set Theory, Theorem 12.14, https://doi.org/10.1007/3-540-44761-X; Kenneth Kunen, Set Theory, Theorem 7.4, https://shop.elsevier.com/books/set-theory-an-introduction-to-independence-proofs/kunen/978-0-444-86839-8",
    uses: [
      { ownerTag: "000G", citationKey: "Jech", pinpoint: "Theorem 12.14", ownerSourceTextSha256: "9b9784072cf8e6219a41c5dcf13b590bd3ef16cc19ef3748324d38f1a162b73b", citationArtifactSha256: "74bad7b0e9a3af81cb2a5966cf67f3c26b65a05775b2dbb469af5fabd2830179" },
      { ownerTag: "000G", citationKey: "Kunen", pinpoint: "Theorem 7.4", ownerSourceTextSha256: "9b9784072cf8e6219a41c5dcf13b590bd3ef16cc19ef3748324d38f1a162b73b", citationArtifactSha256: "9fe21c419216af5331433837b28285ab4198b16a9993d3461ae99cc3aa2f5b36" },
    ],
  },
  {
    id: "external-cardinality-finite-sequences",
    label: "Cardinality of finite sequences",
    normalizedStatement: "For every set A, the set of finite sequences in A has cardinality at most max(|A|, aleph_0); when A is infinite, it has cardinality |A|.",
    sourceCitation: "Kenneth Kunen, Set Theory, Chapter I, Section 10.13; https://shop.elsevier.com/books/set-theory-an-introduction-to-independence-proofs/kunen/978-0-444-86839-8",
    uses: [
      { ownerTag: "000P", citationKey: "Kunen", pinpoint: "Ch. I, 10.13", ownerSourceTextSha256: "50a9099972b73e8814565b3008cff1130c4fcd279b79d4cd458dd23169b93e36", citationArtifactSha256: "6cf5f4dab419f14ee0872a787b6c4e091567fe027158e63b0b0fc4ad8a0def19" },
      { ownerTag: "000Q", citationKey: "Kunen", pinpoint: "Ch. I, 10.13", ownerSourceTextSha256: "d2f697f6e9add7f2accb76265acaba50c3a99022332ab8fe84eadfde53559986", citationArtifactSha256: "5759fa32ae712c4ec5ce3314ac10d4f7341a16cb904209ecc2bddf3f0fe9faf2" },
      { ownerTag: "04W0", citationKey: "Kunen", pinpoint: "Ch. I, 10.13", ownerSourceTextSha256: "f8e18dbfaba9c147e753be4f6fc4ba6929d3a0717e67b4056bee44d68d2836dd", citationArtifactSha256: "b1c01f171ac038f649ac18a21f1798a6ca7af25475b785fe41a0797fa1ae5c8a" },
    ],
  },
  {
    id: "external-indexed-disjoint-union-bound",
    label: "Indexed disjoint-union cardinal bound",
    normalizedStatement: "If each set X_j indexed by J has cardinality at most kappa, then the disjoint union of the X_j has cardinality at most |J| times kappa, and hence satisfies the corresponding infinite-cardinal maximum bound.",
    sourceCitation: "Thomas Jech, Set Theory, Lemma 5.8; https://doi.org/10.1007/3-540-44761-X",
    uses: [
      { ownerTag: "000Q", citationKey: "Jech", pinpoint: "Lemma 5.8", ownerSourceTextSha256: "d2f697f6e9add7f2accb76265acaba50c3a99022332ab8fe84eadfde53559986", citationArtifactSha256: "183582ba81c636df869f310201168c51d13c0f9ff9a6be91707fc4b5a3a9c970" },
    ],
  },
  {
    id: "external-compact-support-coefficient-base-change",
    label: "Compact-support coefficient base change",
    normalizedStatement: "For a homomorphism of noetherian torsion coefficient rings Lambda to Lambda', a separated finite-type scheme Y over an algebraically closed field, and K in D_ctf(Y, Lambda), compactly supported cohomology commutes functorially with derived extension of coefficients to Lambda'.",
    sourceCitation: "SGA 4 1/2, Rapport 4.12, pp. 54-55; https://library.slmath.org/nonmsri/sga/sga/ps/sga4.5.ps",
    sourceSpanGuards: [
      { sourceStem: "trace", startLine: 2323, endLine: 2352, sourceTextSha256: "4e6f5b339ba39b67b5b597af0926ae479f5d98e5dd825d75ac68f786b19c940f" },
    ],
    uses: [
      { ownerTag: "03V2", citationKey: "SGA4.5", pinpoint: "Rapport 4.12", ownerSourceTextSha256: "d21773713b7f333cfe42d4cac24505f48a53a77488c1b027d452505051b1c8ff", citationArtifactSha256: "a880437ba118e37f20447f5fced00eb4bf2b88f22b1ff73ecc596e3ac50a335f" },
    ],
  },
  {
    id: "external-deligne-weight-bound",
    label: "Deligne weight bound",
    normalizedStatement: "For a finite-type scheme over a finite field, compactly supported cohomology raises an upper weight bound by the cohomological degree; for a smooth proper scheme and a lisse pure sheaf, ordinary cohomology is pure of the correspondingly shifted weight.",
    sourceCitation: "Pierre Deligne, La conjecture de Weil II, Theorem 3.3.1 and Corollaries 3.3.4 and 3.3.6; https://www.numdam.org/item/PMIHES_1980__52__137_0.pdf",
    sourceSpanGuards: [
      { sourceStem: "trace", startLine: 3054, endLine: 3072, sourceTextSha256: "1d6b8928fe81f25b53b4bf3be0326582c32af61e50b5a6bae533ab3ce2a44b09" },
    ],
    uses: [
      { ownerTag: "03VH", citationKey: "WeilII", pinpoint: null, ownerSourceTextSha256: "0fda6c51664b2557f3ef525dd7da63b7d21e41d5c05115d6c7e6249c8667ec6b", citationArtifactSha256: "48d56b83122e38b259fe3fd79b87a82c28b6ce7f8695f25d674efb27acae21e0" },
    ],
  },
  {
    id: "external-drinfeld-gl2-automorphic-galois",
    label: "Drinfeld GL2 automorphic-to-Galois correspondence",
    normalizedStatement: "In the stated global function-field setting, an unramified GL2 cuspidal Hecke eigenform with the prescribed l-adic data yields a continuous absolutely irreducible two-dimensional l-adic representation whose Frobenius traces and determinants match the Hecke eigenvalues with the stated normalization.",
    sourceCitation: "Vladimir Drinfeld, Langlands' conjecture for GL(2) over functional fields, Theorems A and A', pp. 565-566; https://www.mathunion.org/fileadmin/ICM/Proceedings/ICM1978.2/ICM1978.2.ocr.pdf",
    sourceSpanGuards: [
      { sourceStem: "trace", startLine: 3448, endLine: 3553, sourceTextSha256: "e269235a0bbbd4801a65e02470027f4a0a7f73367ab54b138c72cb8c196b1dd5" },
    ],
    uses: [
      { ownerTag: "03VT", citationKey: "D0", pinpoint: null, ownerSourceTextSha256: "e5b6350a46462e29b60b71e49a446cf7c4af681660d8bc5fa03a422a596b273d", citationArtifactSha256: "c5b9908244e27de36ea6dea383f37f513432ca43e7eb1a337f9c3f628cd1b049" },
    ],
  },
  {
    id: "external-dejong-cusp-forms-finite",
    label: "Finite generation and base change for cusp forms",
    normalizedStatement: "For noetherian Lambda, the cusp-form module C(Lambda) is finitely generated; over a field Lambda with prime field F, the natural base-change map C(F) tensor_F Lambda to C(Lambda) is a Hecke-compatible isomorphism.",
    sourceCitation: "A. J. de Jong, A conjecture on arithmetic fundamental groups, Proposition 4.7; https://www.math.columbia.edu/~dejong/papers/ARITHFUN.dvi; https://doi.org/10.1007/BF02802496",
    sourceSpanGuards: [
      { sourceStem: "trace", startLine: 3619, endLine: 3624, sourceTextSha256: "3b91e4d6fdcb51226f52c9f13310dd1eefc2ba2e4f96ec7bad8e1168ef81b7fc" },
    ],
    uses: [
      { ownerTag: "03VW", citationKey: "dJ-conjecture", pinpoint: "Proposition 4.7", ownerSourceTextSha256: "188e64c3622e14ab002ecb3cf44d3b6d88450a3a2e5ae530eef618cd4d378061", citationArtifactSha256: "ac22cc115659328eabc63dc413023eea172c229cd77fecff343c728d09f60714" },
    ],
  },
  {
    id: "external-dejong-rank2-conjecture",
    label: "De Jong rank-two finite-monodromy theorem",
    normalizedStatement: "For a normal scheme over a finite field in the stated Conjecture 2.3 setup, every continuous rank-two representation has finite geometric monodromy, equivalently in the associated rank-two lisse-sheaf formulation.",
    sourceCitation: "A. J. de Jong, A conjecture on arithmetic fundamental groups, Corollary 4.10 with Conjecture 2.3; https://www.math.columbia.edu/~dejong/papers/ARITHFUN.dvi; https://doi.org/10.1007/BF02802496",
    sourceSpanGuards: [
      { sourceStem: "trace", startLine: 3712, endLine: 3718, sourceTextSha256: "07ec78cd09dfaccfa5d4b8b340b2d44eecfd11e201d675352df974cf3ce5b6d7" },
    ],
    uses: [
      { ownerTag: "03VZ", citationKey: "dJ-conjecture", pinpoint: null, ownerSourceTextSha256: "b81656a237c14e4234a055e245a9ff918779f6c65326c43099497de93a7c1374", citationArtifactSha256: "1841aa01ee68c394d1e184eb1f482f09ccad4d852ac98c6c07fa96e5046a6ea4" },
    ],
  },
  {
    id: "external-kunz-f-finite-excellence",
    label: "Kunz F-finite excellence criterion",
    normalizedStatement: "For a noetherian local ring of characteristic p with finite residue-field imperfection degree, the ring is excellent if and only if Frobenius is finite; in particular, F-finiteness implies excellence.",
    sourceCitation: "Ernst Kunz, On Noetherian rings of characteristic p, Corollary 2.6; https://doi.org/10.2307/2374038",
    sourceSpanGuards: [
      { sourceStem: "examples", startLine: 3299, endLine: 3332, sourceTextSha256: "6a4f6e251f7ce41452f52b3a6ea81b17b42e14dca83d0104957c1ccea89276da" },
    ],
    uses: [
      { ownerTag: "0G66", citationKey: "Kun76", pinpoint: "Corollary 2.6", ownerSourceTextSha256: "5465130402e7d24fea7156af51026b46827ae770acb8c2893619a69fbc04114e", citationArtifactSha256: "a46860fa22e73b3fb5391134708bd0beec11c5b7ee437851ef961b089d7d32db" },
    ],
  },
];

// Exact proof citations audited as attribution, corroboration, background,
// example/construction provenance, or otherwise nonlogical uses. These records
// are omitted rather than left as theorem-dependency debt; genuinely
// unresolved citation records not listed here remain visible for later review.
const CURATED_NONDEPENDENCY_PROOF_CITATIONS = [
  { ownerTag: "07E5", citationKey: "Faltings-einfacher", pinpoint: null, ownerSourceTextSha256: "f30f7040500fcfe8e7b04400566266cfe6b9a2f2f1af42d58c95c100fd84404a", citationArtifactSha256: "d8c1c8656c987b947e8ebae4ee0d7c945dda371cb06a3c8a4be6f18211ad92fe" },
  { ownerTag: "08XE", citationKey: "EGA4", pinpoint: "Proposition~17.2.1", ownerSourceTextSha256: "79ab5d836b34b0a47d2534aee3d914cd9d2614ae2f5f4654735deeac0936b5dd", citationArtifactSha256: "341bddb0935f9bcb3dcf06c95684788d89bc54062ffbbbf1fb943b7d211fdd3c" },
  { ownerTag: "08XE", citationKey: "EGA4", pinpoint: "Th\\'eor\\`eme~17.6.1", ownerSourceTextSha256: "79ab5d836b34b0a47d2534aee3d914cd9d2614ae2f5f4654735deeac0936b5dd", citationArtifactSha256: "93feac3fdaa6aeec8249e2889fd441fb0811c0652d2b0b6fcf0c17022a57f79c" },
  { ownerTag: "0252", citationKey: "MatCA", pinpoint: "Section 20", ownerSourceTextSha256: "436950afa5c86eddd48d62000d854aa6c2ef068a0a50bb046ff937bb89971859", citationArtifactSha256: "182b573f016c16ce2aceea51922478427c0f2243130fd0b542ddb20276083a55" },
  { ownerTag: "0CBY", citationKey: "ACG", pinpoint: "Proposition X.2.1", ownerSourceTextSha256: "d9087d3babab2097821d8de963288c24c617f0c3ecc4cf053558f6c3b1c5ec3b", citationArtifactSha256: "3c989e8e9b264cbcac12b85857358cbfb2905cef781a0e8c7d9906eea0156e64" },
  { ownerTag: "03QE", citationKey: "EGA4", pinpoint: "Th\\'eor\\`eme 18.12.1", ownerSourceTextSha256: "800dd5038cd0a95cb39fedb5371b0bd8b3013234ae6c4b065e554b0ae0f10995", citationArtifactSha256: "0c44bff7e53b7062accb4cd32ba637ada9d0b2956476029013d00b3ba935a0c0" },
  { ownerTag: "03R6", citationKey: "SilvermanEllipticCurves", pinpoint: null, ownerSourceTextSha256: "0421d45b8188e39d39cace3b51fdf50d60a897ae4fcfecc0d7c2c51e7306f9b3", citationArtifactSha256: "9690c9fbfd618e87e692f4245bbd943a65e9d2ddacf7b10bf616180dbd0c765c" },
  { ownerTag: "03R7", citationKey: "SGA4.5", pinpoint: null, ownerSourceTextSha256: "7234252b03e93b66e61ef985620e2ee70351aa3427930d680a934c9eab303002", citationArtifactSha256: "b226e02d561cc139158e3cb9e1d6571e413583afd33ebb0dd4f2b387360d6f1e" },
  { ownerTag: "0GI5", citationKey: "ArtinII", pinpoint: null, ownerSourceTextSha256: "0e8d6d0b0cfb3c66fa422cfb5c0a095d6d147f6f51eae591a556ec499d8f78a8", citationArtifactSha256: "ca9fe639e42cad9e0d0f1115f1b40a6c14a705812169d831f067d0d7bef299e6" },
  { ownerTag: "08J1", citationKey: "H", pinpoint: "Example B.3.4.1", ownerSourceTextSha256: "7bf1108f5e43b63c9ff6a0bee90878ee7e3cca86a0ab02ae9fce30d36fd7feca", citationArtifactSha256: "bfe96b98b01c012d5421de95aada356d6c8e2a664f6931af45fddf754d3721bc" },
  { ownerTag: "08KF", citationKey: "H", pinpoint: "Example B.3.4.2", ownerSourceTextSha256: "824f2813962a308412addd18cc46bd4bc6951b43ba2ab21ff53c002630e8f6c1", citationArtifactSha256: "1193576598fe143b6039b276b68a810ba40a565805ed4e22ba7854cc470c07d8" },
];

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
  // These two expository chapters explicitly restate the listed groupoid
  // lemmas for later reference, including the defining restriction diagrams.
  ["more-groupoids-equation-diagram", "groupoids-lemma-diagram"],
  ["more-groupoids-equation-pull", "groupoids-lemma-diagram-pull"],
  ["more-groupoids-equation-restriction", "groupoids-lemma-restrict-groupoid"],
  ["spaces-more-groupoids-equation-diagram", "spaces-groupoids-lemma-diagram"],
  ["spaces-more-groupoids-equation-pull", "spaces-groupoids-lemma-diagram-pull"],
  ["spaces-more-groupoids-equation-restriction", "spaces-groupoids-lemma-restrict-groupoid"],
  // Each derived-limit display is stated to hold by the corresponding formal lemma.
  ["cohomology-equation-ses-Rlim-over-U", "cohomology-lemma-RGamma-commutes-with-Rlim"],
  ["sites-cohomology-equation-ses-Rlim-over-U", "sites-cohomology-lemma-RGamma-commutes-with-Rlim"],
  // Each comparison display is obtained from part (3) of the listed topology lemma.
  ["etale-cohomology-equation-compare-big-small", "topologies-lemma-morphism-big-small-etale"],
  ["spaces-more-cohomology-equation-compare-big-small", "spaces-topologies-lemma-morphism-big-small-etale"],
]);

// Named results invoked in prose rather than through \ref. Every entry is tied
// to one permanent owner tag and an exact expected phrase count in that owner's
// proof. This is an audited whitelist, not a global name recognizer.
const CURATED_NAMED_PROOF_DEPENDENCIES = [
  // These owner proofs invoke the ordinary Nakayama lemma without an explicit
  // \ref to Tag 00DV. The graded and localization variants are deliberately
  // excluded, as are owners that already cite the formal lemma explicitly.
  { ownerTag: "00SE", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "02K5", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "068Z", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07CH", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07CP", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07CZ", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07D1", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07YL", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "09EJ", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0A7P", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0AWR", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0AXG", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0B99", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0BIA", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0DVZ", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0DZ1", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E7G", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0G0Q", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0H76", targetTag: "00DV", phrasePattern: "Nakayama(?:'s)? lemma", expectedOccurrenceCount: 1 },

  // Five-lemma invocations lacking an explicit reference to Tag 05QB.
  { ownerTag: "06V6", targetTag: "05QB", phrasePattern: "five lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0127", targetTag: "05QB", phrasePattern: "five lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0BP2", targetTag: "05QB", phrasePattern: "five lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0F7B", targetTag: "05QB", phrasePattern: "five lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "09AK", targetTag: "05QB", phrasePattern: "five lemma", expectedOccurrenceCount: 1 },

  { ownerTag: "00HL", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00LU", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00MZ", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0CE7", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "02TQ", targetTag: "07JW", phrasePattern: "snake lemma", expectedOccurrenceCount: 1 },
  // Ordinary Yoneda invocations missing an explicit reference to Tag 001P.
  // The negative lookbehind keeps the separate 2-Yoneda audit disjoint.
  { ownerTag: "04D2", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00WY", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00XM", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0024", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "017V", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "03A2", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "05QT", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "05Y6", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07HW", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "08PC", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "09CN", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0A04", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0A8D", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "0A9T", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0AU2", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0D79", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0D7D", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0D7X", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E4L", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E5Q", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E5V", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E8I", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0E9L", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0GF6", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0GLW", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "0H9L", targetTag: "001P", phrasePattern: "(?<!-)Yoneda(?:'s)? lemma", expectedOccurrenceCount: 1 },

  // 2-Yoneda invocations missing an explicit reference to Tag 004B.
  { ownerTag: "06D3", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 3 },
  { ownerTag: "04XF", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "04XS", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "04ZZ", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "05UK", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "06CH", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "06CX", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 3 },
  { ownerTag: "06D7", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "06PJ", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "07WN", targetTag: "004B", phrasePattern: "\\$2\\$-Yoneda lemma", expectedOccurrenceCount: 1 },

  { ownerTag: "030F", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "00E0", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 2 },
  { ownerTag: "07P2", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "01D7", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "08ZP", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
  { ownerTag: "08XS", externalInputId: "external-zorns-lemma", phrasePattern: "Zorn's lemma", expectedOccurrenceCount: 1 },
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

// Some proofs cite an expository section and then use a small, exact subset
// of the formal results developed there. These mappings are deliberately
// owner-specific: the same section labels occur in other proofs with different
// logical needs, so they must never become global reference aliases. The full
// proof hash and complete occurrence count make every promotion fail closed if
// the pinned source changes.
const CURATED_SECTION_PROOF_DEPENDENCIES = [
  {
    ownerTag: "03Z1",
    referenceTag: "03BT",
    targetTags: ["03BX", "03H5", "03H4"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "c97019b545f3456a60dfea35e7a7008b9e6b5144da7a8763a2e25246078c0ced",
    proofSourceTextSha256: "79178f392d2389efd6ee295833d14bb09865f3d8d51be77874d39619210f7d4f",
    referenceArtifactSha256: "7bd2a2b399cf590c9d39f52855629b1638675c6a606fbd9b38626fc1d605824a",
  },
  {
    ownerTag: "0CFQ",
    referenceTag: "03BT",
    targetTags: ["03BX", "03H5", "03H4"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "391d97db53e42034087f16db767b4337a3978087e10d08d74ad39d9a652f235e",
    proofSourceTextSha256: "eb6723def8d90afa85f0beff5925d758185ee399f5a75c0f3c6a67775c116e0c",
    referenceArtifactSha256: "7f301e1022d745c1b45c5078411950916c35e5ee80e0fdf51b4aed8a76601ad1",
  },
  {
    ownerTag: "03XD",
    referenceTag: "03BT",
    targetTags: ["03BX", "03H5", "03H4"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "d0ccc234fa5c379408ea7f14d4478100c58558541adbd7d5a6edfbdd785cc5c1",
    proofSourceTextSha256: "0481c690f94914b05469a482a2ea6adf02c79b45b87dcdd75d7a5404870252d9",
    referenceArtifactSha256: "93468ff00acab5c4a8cb16c25f740c51dcc4bf1d5c759911123ecb3c5445a9ec",
  },
  {
    ownerTag: "04P1",
    referenceTag: "03BT",
    targetTags: ["03BX", "03BZ"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "dd220de2e7c8b081881854b4bc9f4380bfdb8f1877f28adb6ad56fd72cba0140",
    proofSourceTextSha256: "1c6f1f8b957aa60ab975c4b95313115093c935c636fac10bdba3b4a0e2c15f98",
    referenceArtifactSha256: "b415d548e89a259708e03595d444774a45719d191d4fbd1c078346b0b6766503",
    rationaleNote: "Tag 03BX makes the presentation map open, and Tag 03BZ turns its open image into the required open subspace.",
    routeDebtNote: "The pinned source later writes U -> X and subsets of X where the lemma data use U -> T and subsets of T, and it explicitly omits the final descent verification; this candidate route preserves that source-level proof debt.",
  },
  {
    ownerTag: "0E07",
    referenceTag: "03BT",
    targetTags: ["03BU"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "d93a16805c380372f3e97a7dd3f6c0b7baaee10bb99490fed97a433873381c99",
    proofSourceTextSha256: "89e795b64ee8f85d9f4556605ddf52e8d5662a0fa07bd047b622b80a955d153f",
    referenceArtifactSha256: "7e1864d01248408d2e925c0dbd99431b70d6e1681f72e8dc9ba04048800e10b4",
    rationaleNote: "The concrete equivalence relation is specified in the unlabelled prose immediately preceding Tag 03BU, so the dependency is definitional but the target statement is not self-contained.",
  },
  {
    ownerTag: "06U1",
    referenceTag: "04XE",
    targetTags: ["04XL", "04XI", "04XH"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "cbe79be8d02403a417a5e9d88f50fc262eacb90bd6b9c8c786de2449b7946dff",
    proofSourceTextSha256: "ad31abe8a3c6fd2dd7508e82ff0903915756aeb1c0d51ae3d7ff38acd0d11af4",
    referenceArtifactSha256: "bb8c1625679c0cd4c3f6eeb52aa2ec3fd8cd72dc132acab2eaa69ac2760428db",
  },
  {
    ownerTag: "0CHX",
    referenceTag: "04XE",
    targetTags: ["04XL", "04XI", "04XH"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "f8470821622052108d9b91def694b65891be42a8138b974aeda9cc77fca5b50d",
    proofSourceTextSha256: "626505d6b1b01a5ffe391816295e1baea94f88f39c47b5e01f374ba11282769a",
    referenceArtifactSha256: "d2455ced061e3d6eebed03c101d703ef2711a1956d142c96614e29a727a644b8",
  },
  {
    ownerTag: "0512",
    referenceTag: "04XE",
    targetTags: ["04XL", "04XI", "04XH"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "f13be3463985f58b40e7341ad1fff9cc31d8ed3a9bd412538e07ce4b21cbf716",
    proofSourceTextSha256: "114b8dc269e6ce4ecebf03eb0ba0da9b08888f3b0e8e436488431dc511fcc2e3",
    referenceArtifactSha256: "8d0c64be4ec3eca75b777a613b8183a712d6cf63c95435c198e9571c58aac377",
  },
  {
    ownerTag: "0CI1",
    referenceTag: "04XE",
    targetTags: ["04XL", "04XI", "04XH"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "9e16d91528b356c6792ba6b085283de3f9831e75a83b2d86185738ac3435e840",
    proofSourceTextSha256: "c52a661b0cd9be733f20458f78cf20d34411fc5835d3288d8ee06d1177a70916",
    referenceArtifactSha256: "a7acfe04d4a1f3acf13bc8cd53544dc3eebd11e3d87b32825186dc56dc021451",
  },
  {
    ownerTag: "0CI6",
    referenceTag: "04XE",
    targetTags: ["04XL", "04XI", "04XH"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "e0eb44810aaf1d596d6c3588eb0fa337d18ac7b69461d66a793a86bc70ae4c3c",
    proofSourceTextSha256: "27c29e0d11786e999091f8e1a084d01509ee1f884469f59ff4d974b6bcd6e9c0",
    referenceArtifactSha256: "ecc96d46272c755b45c2f334296fffdc7fe1d180f0534ee162e6f63a65134887",
  },
  {
    ownerTag: "0E86",
    referenceTag: "04XE",
    targetTags: ["04XL"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "76d2cb54d8f1c1b0f098ef55f45ec94857129450f4bf50457f5bd435a9e2e05f",
    proofSourceTextSha256: "498e2973251b43f8f0c9662c315c1e44fe0790e156ea6cfe3e815e6373dc1636",
    referenceArtifactSha256: "52e676d217677207fefa71dd0c5f6995698041c86604b684231723b778b1a13b",
    rationaleNote: "Tag 04XL is the exact construction of the topology used to identify the smooth locus as open; no surjectivity or fibre-product fact from the section is imported.",
    routeDebtNote: "The proof also assumes that the smooth-curves locus is an open substack; that implicit prerequisite remains separate review debt.",
  },
  {
    ownerTag: "04ZX",
    referenceTag: "04XB",
    targetTags: ["045C"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "b7a92b06d5b2a6983676c589c34abfbefacbf06f55b73eef09fd1147a230154b",
    proofSourceTextSha256: "8cb15bbd5804d9c3831d46e278c93e5519b1a35386ac2342086df7eaee344911",
    referenceArtifactSha256: "5c46c3c1fa1dada59e1bcd94f36daab46c28f87a2de79a41a9323bbf4245e77f",
  },
  {
    ownerTag: "0501",
    referenceTag: "04XB",
    targetTags: ["045C"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "81fedda827bb673aa68da61407d8a9fe800ba94b675e9291c1179a6e50bbf9c3",
    proofSourceTextSha256: "8cb15bbd5804d9c3831d46e278c93e5519b1a35386ac2342086df7eaee344911",
    referenceArtifactSha256: "0d9759c3e6793157fbf314833109f703aa8af1e43bd1745c83865eb8b8abfd49",
  },
  {
    ownerTag: "0CHR",
    referenceTag: "04XB",
    targetTags: ["045C"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "ae9c5b5ac73ec0de4b318288bef74cf62c21bf2595b2a807dbdd0b99051099c4",
    proofSourceTextSha256: "a575bba667327928cb81f55a9fc0e70b926cbfcb752e83fe221d9a8d27c6279b",
    referenceArtifactSha256: "eac278e86de21a054c42e45c03790b2a0591224c2cc4d97819af7891e1515978",
  },
  {
    ownerTag: "0CHV",
    referenceTag: "04XB",
    targetTags: ["045C"],
    expectedSectionReferenceCount: 1,
    ownerSourceTextSha256: "5154589af3510426b2784349355dc4a3f049443f7c2aea9ca274f92d64d68f8d",
    proofSourceTextSha256: "a575bba667327928cb81f55a9fc0e70b926cbfcb752e83fe221d9a8d27c6279b",
    referenceArtifactSha256: "f0fd12e48ac734f59058da4de6caedaba92eb08d27617d845c1486e5e92cc6eb",
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
  // Optional "you can also deduce" notes after complete primary proofs.
  "0FNW|0FFR",
  "0FNZ|0FFR",
]);

// These labeled prose/display spans are definitions, predicates, or
// constructions used by theorem proofs. They are support nodes rather than
// theorem-like claims. Every promotion is guarded by the exact defining span
// and complete incoming owner/count inventory; equation labels are never
// promoted as a class.
const CURATED_PROSE_SUPPORT_NODES = [
  {
    targetTag: "0D50",
    kind: "construction",
    title: "Embedding of curves over proper spaces",
    sourceStem: "quot",
    startLine: 4560,
    endLine: 4568,
    sourceTextSha256: "3d08999cfd53fa5d2b9089c54365026f932526903521db68579a12547ccbdc1d",
    ownerOccurrenceCounts: { "0D51": 1, "0D52": 1, "0D53": 1, "0D55": 1, "0D56": 1, "0D57": 1, "0D59": 1, "0D5B": 1 },
  },
  {
    targetTag: "04EH",
    kind: "definition",
    title: "Stalk of a presheaf at p",
    sourceStem: "sites",
    startLine: 7861,
    endLine: 7871,
    sourceTextSha256: "8034590e879cdb544900e7794bbf2f093eff502a23ae65af9e4a30f661bd94ac",
    ownerOccurrenceCounts: { "00Y7": 1, "00YA": 1, "0F4G": 1, "04ET": 2, "04FM": 1, "04K0": 1 },
  },
  {
    targetTag: "0A9L",
    kind: "construction",
    title: "Open-restriction base-change transformation",
    sourceStem: "duality",
    startLine: 756,
    endLine: 780,
    sourceTextSha256: "2cd691ea47e9e1fb79187f22303060bff6bf65954a892ea14a31a8e068ec939d",
    ownerOccurrenceCounts: { "0A9N": 1, "0B6Q": 1, "0AA0": 2, "0ATX": 3, "0ATY": 1, "0B6T": 1 },
  },
  {
    targetTag: "0A9S",
    kind: "construction",
    title: "Pullback-right-adjoint comparison map",
    sourceStem: "duality",
    startLine: 1841,
    endLine: 1865,
    sourceTextSha256: "2ca8d006bf1659f33256fea6e44aa4dcfe13ff54f8daf070f6eb6f62c5318f92",
    ownerOccurrenceCounts: { "0B6P": 1, "0B6Q": 2, "0E4K": 2, "0A9U": 2, "0B6T": 2, "0FYW": 1 },
  },
  {
    targetTag: "0H58",
    kind: "construction",
    title: "Relative cycle-class homomorphism",
    sourceStem: "relative-cycles",
    startLine: 943,
    endLine: 955,
    sourceTextSha256: "6f2ee0659a8df5f7e5b2b0046608838b1338aa1bda71f87b2081aa4ce7021aff",
    ownerOccurrenceCounts: { "0H59": 2, "0H5C": 1, "0H5D": 1, "0H6E": 1, "0H6R": 1 },
  },
  {
    targetTag: "044P",
    kind: "construction",
    title: "Prequotient presheaf in groupoids",
    sourceStem: "spaces-groupoids",
    startLine: 2260,
    endLine: 2282,
    sourceTextSha256: "6f29cebb0c5880a0401f7ee91166f0b12c11224a163489cbdd3ea40c8b04ef97",
    ownerOccurrenceCounts: { "044R": 1, "046Q": 1, "044V": 1, "044T": 1, "0CN4": 1 },
  },
  {
    targetTag: "04PC",
    kind: "definition",
    title: "Finite-condition moduli pairs",
    sourceStem: "spaces-more-groupoids",
    startLine: 1297,
    endLine: 1308,
    sourceTextSha256: "505d4fff50a163c080a58a9777e4d8669f443eccfc73e01488de34a66d50eda7",
    ownerOccurrenceCounts: { "04PE": 2, "04PK": 1, "04QG": 2, "04RI": 1, "04RR": 1 },
  },
  {
    targetTag: "06IM",
    kind: "definition",
    title: "Bijective tangent-map condition",
    sourceStem: "formal-defos",
    startLine: 4399,
    endLine: 4403,
    sourceTextSha256: "c2f6af7287476b7c813986f6161cb416cae3124e4b0d9663eca094268d6eec44",
    ownerOccurrenceCounts: { "06IV": 1, "06IX": 2 },
  },
  {
    targetTag: "06T6",
    kind: "definition",
    title: "Bijective-on-derivation-orbits condition",
    sourceStem: "formal-defos",
    startLine: 4405,
    endLine: 4409,
    sourceTextSha256: "01f7ac665ce9ae222003b3c5adc47664718eb4b0bc84281f10c0cf6915f431a3",
    ownerOccurrenceCounts: { "06IR": 1, "06T8": 2, "06IX": 1, "06JM": 1, "06KN": 1 },
  },
  {
    targetTag: "08UF",
    kind: "definition",
    title: "Deformation problem for ringed topoi",
    sourceStem: "defos",
    startLine: 3869,
    endLine: 3902,
    sourceTextSha256: "5448054e48da2f7c8c7dd7f0f78b3020ed49f2cf081730bf4b97653299d54314",
    ownerOccurrenceCounts: { "08UK": 1, "0GQ5": 1, "0GQ9": 1, "0D17": 1, "0D3Q": 1 },
  },
];

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
      const curatedConfig = CURATED_CLAIMS.get(fullLabel);
      if (!curatedConfig) continue;
      const curatedTitle = typeof curatedConfig === "string"
        ? curatedConfig
        : curatedConfig.title;
      const tag = tags.fullLabelToTag.get(fullLabel);
      if (!tag) throw new Error(`${unit.path}:${range.startLine} has no stable tag for ${fullLabel}`);
      const nodeId = tagNodeId(tag);
      const normalizedStatement = normalizeWhitespace(rawEnvironment
        .replace(new RegExp(`^\\s*\\\\begin\\{${environment}\\}(?:\\[[^\\]]*\\])?`, "u"), "")
        .replace(new RegExp(`\\\\end\\{${environment}\\}\\s*$`, "u"), ""));
      const locator = `${unit.path}:L${range.startLine}-L${range.endLine}`;
      const label = sourceLabel("claim", tag);
      const artifactSha256 = sha256(rawEnvironment);
      if (typeof curatedConfig !== "string") {
        if (range.startLine !== curatedConfig.startLine || range.endLine !== curatedConfig.endLine) {
          throw new Error(`Curated claim ${fullLabel} moved from its audited source range`);
        }
        if (artifactSha256 !== curatedConfig.sourceTextSha256) {
          throw new Error(`Curated claim ${fullLabel} changed from its audited source text`);
        }
      }
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

  for (const [fullLabel, curatedConfig] of CURATED_PROSE_CLAIMS) {
    if (!fullLabel.startsWith(`${unit.stem}-`)) continue;
    if (!tags.fullLabelToTag.has(fullLabel)) continue;
    const localLabel = fullLabel.slice(unit.stem.length + 1);
    const range = {
      startLine: curatedConfig.startLine,
      endLine: curatedConfig.endLine,
    };
    const rawClaim = lines.slice(range.startLine - 1, range.endLine).join("\n");
    if (sha256(rawClaim) !== curatedConfig.sourceTextSha256) {
      throw new Error(`Curated prose claim ${fullLabel} changed from its audited source text`);
    }
    if (!labelArguments(rawClaim).includes(localLabel)) {
      throw new Error(`Curated prose claim ${fullLabel} is absent from its audited source range`);
    }
    const tag = tags.fullLabelToTag.get(fullLabel);
    const nodeId = tagNodeId(tag);
    const locator = `${unit.path}:L${range.startLine}-L${range.endLine}`;
    const label = sourceLabel("claim", tag);
    const artifactSha256 = sha256(rawClaim);
    const inlineProof = {
      ...range,
      title: "Inline derivation in source prose",
      rawProof: rawClaim,
      references: referencesInLines(lines, range.startLine, range.endLine),
      citations: citationsInLines(lines, range.startLine, range.endLine),
    };
    metadata.push({
      node: {
        id: nodeId,
        nodeClass: "theorem-like",
        kind: "claim",
        sourceLabel: label,
        title: curatedConfig.title,
        sourceXmlId: fullLabel,
        sourceLocator: locator,
        normalizedStatement: normalizeWhitespace(rawClaim) || label,
        sourceTextSha256: artifactSha256,
        evidence: capturedEvidence({
          sourceUnitId: unitId(unit.stem),
          locator,
          artifactSha256,
          capturedAt,
          note: "Exact labeled Stacks prose/display span promoted after source audit because it states and derives a theorem-level claim; equation labels are not promoted generally.",
        }),
      },
      unit,
      environment: "prose-claim",
      startLine: range.startLine,
      endLine: range.endLine,
      rawEnvironment: rawClaim,
      aliasFullLabels: labelArguments(rawClaim)
        .filter((labelArgument) => labelArgument !== localLabel)
        .map((labelArgument) => `${unit.stem}-${labelArgument}`),
      statementReferences: [],
      proofs: [inlineProof],
      curatedClaim: true,
    });
  }

  for (const curatedConfig of CURATED_PROSE_SUPPORT_NODES) {
    if (curatedConfig.sourceStem !== unit.stem) continue;
    const fullLabel = tags.tagToFullLabel.get(curatedConfig.targetTag);
    if (!fullLabel) continue;
    if (!fullLabel.startsWith(`${unit.stem}-`)) {
      throw new Error(`Curated prose support ${curatedConfig.targetTag} has unexpected source label ${fullLabel}`);
    }
    const localLabel = fullLabel.slice(unit.stem.length + 1);
    const range = {
      startLine: curatedConfig.startLine,
      endLine: curatedConfig.endLine,
    };
    const rawSupport = lines.slice(range.startLine - 1, range.endLine).join("\n");
    const artifactSha256 = sha256(rawSupport);
    if (artifactSha256 !== curatedConfig.sourceTextSha256) {
      throw new Error(`Curated prose support ${fullLabel} changed from its audited source text`);
    }
    if (!labelArguments(rawSupport).includes(localLabel)) {
      throw new Error(`Curated prose support ${fullLabel} is absent from its audited source range`);
    }
    const nodeId = tagNodeId(curatedConfig.targetTag);
    const locator = `${unit.path}:L${range.startLine}-L${range.endLine}`;
    const label = sourceLabel(curatedConfig.kind, curatedConfig.targetTag);
    metadata.push({
      node: {
        id: nodeId,
        nodeClass: "support",
        kind: curatedConfig.kind,
        sourceLabel: label,
        title: curatedConfig.title,
        sourceXmlId: fullLabel,
        sourceLocator: locator,
        normalizedStatement: normalizeWhitespace(rawSupport) || label,
        sourceTextSha256: artifactSha256,
        evidence: capturedEvidence({
          sourceUnitId: unitId(unit.stem),
          locator,
          artifactSha256,
          capturedAt,
          note: "Exact labeled Stacks prose/display span promoted as a source-audited definition or construction because formal proofs use it directly; no theorem-like claim is asserted.",
        }),
      },
      unit,
      environment: "prose-support",
      startLine: range.startLine,
      endLine: range.endLine,
      rawEnvironment: rawSupport,
      // Curated support spans represent exactly their own permanent label.
      // Never alias a neighbouring equation or definition into this node.
      aliasFullLabels: [],
      statementReferences: referencesInLines(lines, range.startLine, range.endLine),
      curatedSupport: true,
    });
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

function citationReferenceEntity({ group, externalInput = null, dependencyId = null, capturedAt, usedIds }) {
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
    resolution: externalInput
      ? {
        status: "resolved",
        target: { type: "external-input", id: externalInput.id },
        directDependencyId: dependencyId,
        note: "A primary-source audit resolved this exact bibliographic theorem invocation to the linked typed external mathematical input and dependency.",
      }
      : {
        status: "unresolved",
        note: "This bibliographic proof citation requires source review before it can be promoted to a typed external mathematical input and dependency.",
      },
    evidence: capturedEvidence({
      sourceUnitId: unitId(owner.unit.stem),
      locator,
      artifactSha256: sha256(canonicalJson(occurrences)),
      capturedAt,
      note: externalInput
        ? `${occurrences.length} exact bibliographic theorem invocation(s) resolved by a source-audited allowlist against a primary source; no independent mathematical review is claimed.`
        : `${occurrences.length} explicit proof citation occurrence(s) merged by bibliography key and pinpoint; not independently reviewed.`,
    }),
  };
}

export function extractStacksGraphFromUnits(
  units,
  tagText,
  { capturedAt, bibliographyText = null, sourceRevision = null },
) {
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
  const auditedCitationResolutionByGroupKey = new Map();
  const auditedNondependencyCitationGroupKeys = new Set();
  const citationAuditKey = (ownerNodeId, citationKey, pinpoint) => (
    `${ownerNodeId}|${citationKey}\u0000${pinpoint ?? ""}`
  );
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
        note: "The pinned source declares Zermelo-Fraenkel set theory with choice; six source-audited formal proofs invoke Zorn's lemma by name.",
      }),
    });
  }

  const activeExternalCitationInputs = CURATED_EXTERNAL_CITATION_INPUTS
    .map((config) => ({
      config,
      uses: config.uses
        .map((use) => ({
          use,
          owner: metadataForTag(use.ownerTag, "external-citation owner"),
        }))
        .filter(({ owner }) => owner),
    }))
    .filter(({ uses }) => uses.length > 0);
  if (activeExternalCitationInputs.length > 0
    && sourceRevision !== CURATED_CITATION_SOURCE_REVISION) {
    throw new Error(`Curated external-citation audit requires source revision ${CURATED_CITATION_SOURCE_REVISION}`);
  }
  for (const { config, uses: activeUses } of activeExternalCitationInputs) {
    if (activeUses.length !== config.uses.length) {
      throw new Error(`Curated external input ${config.id} is missing an audited owner`);
    }
    for (const guard of config.sourceSpanGuards ?? []) {
      const sourceUnit = units.find(({ stem }) => stem === guard.sourceStem);
      if (!sourceUnit) throw new Error(`Curated external input ${config.id} is missing ${guard.sourceStem}`);
      const sourceLines = sourceUnit.content.split(/\r?\n/u);
      const rawSource = sourceLines.slice(guard.startLine - 1, guard.endLine).join("\n");
      if (sha256(rawSource) !== guard.sourceTextSha256) {
        throw new Error(`Curated external input ${config.id} inherited source setup changed`);
      }
    }

    const auditedUses = activeUses.map(({ use, owner }) => {
      if (owner.node.sourceTextSha256 !== use.ownerSourceTextSha256) {
        throw new Error(`Curated external-citation owner ${use.ownerTag} statement changed`);
      }
      const matches = uniqueCitationGroups({
        citations: (owner.proofs ?? []).flatMap(({ citations }) => citations),
        owner,
      }).filter((group) => (
        group.citationKey === use.citationKey
        && group.pinpoint === use.pinpoint
      ));
      if (matches.length !== 1) {
        throw new Error(`Curated citation ${use.ownerTag}/${use.citationKey}/${use.pinpoint ?? "no pinpoint"} no longer has one exact proof group`);
      }
      const group = matches[0];
      if (sha256(canonicalJson(group.occurrences)) !== use.citationArtifactSha256) {
        throw new Error(`Curated citation ${use.ownerTag}/${use.citationKey}/${use.pinpoint ?? "no pinpoint"} changed from its audited occurrence`);
      }
      const proofStartLines = [...new Set(group.occurrences.map(({ lineNumber }) => (
        (owner.proofs ?? []).find((proof) => (
          proof.startLine <= lineNumber && proof.endLine >= lineNumber
        ))?.startLine
      )))];
      if (proofStartLines.includes(undefined)) {
        throw new Error(`Curated citation ${use.ownerTag}/${use.citationKey} moved outside its proof`);
      }
      return { use, owner, group, proofStartLines };
    });

    const input = {
      id: config.id,
      kind: "external-theorem",
      label: config.label,
      normalizedStatement: config.normalizedStatement,
      sourceTextSha256: null,
      sourceCitation: config.sourceCitation,
      evidence: {
        status: "captured",
        sourceUnitIds: [...new Set(auditedUses.map(({ owner }) => unitId(owner.unit.stem)))],
        locator: auditedUses
          .flatMap(({ owner, group }) => group.occurrences.map(({ lineNumber }) => (
            `${owner.unit.path}:L${lineNumber}`
          )))
          .join("; "),
        captureAudit: {
          actorId: "stacks-latex-importer",
          capturedAt,
          artifactSha256: sha256(canonicalJson(auditedUses.map(({ use, group }) => ({
            ownerTag: use.ownerTag,
            citationKey: use.citationKey,
            pinpoint: use.pinpoint,
            occurrences: group.occurrences,
          })))),
        },
        independentReview: null,
        note: "The exact local citation invocation was checked against the named primary-source theorem; the external source text itself is identified by the source citation and was not copied into this artifact.",
      },
    };
    externalInputs.push(input);
    for (const { use, owner, group, proofStartLines } of auditedUses) {
      auditedCitationResolutionByGroupKey.set(
        citationAuditKey(owner.node.id, use.citationKey, use.pinpoint),
        input,
      );
      addSemanticGroup({
        owner,
        basis: "audited-external-citation",
        targetNode: null,
        externalInput: input,
        occurrences: group.occurrences,
        proofStartLines,
        routeEvidenceRegions: [],
        routeDebtNotes: [],
        rationale: `A primary-source audit identifies the exact bibliographic invocation as the external theorem “${input.label}”.`,
        evidenceNote: "Exact owner, formal statement hash, bibliography key, pinpoint, occurrence hash, pinned source revision, and primary theorem locator were audited.",
      });
    }
  }

  const activeNondependencyCitations = CURATED_NONDEPENDENCY_PROOF_CITATIONS
    .map((config) => ({
      config,
      owner: metadataForTag(config.ownerTag, "nondependency-citation owner"),
    }))
    .filter(({ owner }) => owner);
  if (activeNondependencyCitations.length > 0
    && sourceRevision !== CURATED_CITATION_SOURCE_REVISION) {
    throw new Error(`Curated nondependency-citation audit requires source revision ${CURATED_CITATION_SOURCE_REVISION}`);
  }
  for (const { config, owner } of activeNondependencyCitations) {
    if (owner.node.sourceTextSha256 !== config.ownerSourceTextSha256) {
      throw new Error(`Curated nondependency-citation owner ${config.ownerTag} statement changed`);
    }
    const matches = uniqueCitationGroups({
      citations: (owner.proofs ?? []).flatMap(({ citations }) => citations),
      owner,
    }).filter((group) => (
      group.citationKey === config.citationKey
      && group.pinpoint === config.pinpoint
    ));
    if (matches.length !== 1) {
      throw new Error(`Curated nondependency citation ${config.ownerTag}/${config.citationKey}/${config.pinpoint ?? "no pinpoint"} no longer has one exact proof group`);
    }
    const group = matches[0];
    if (sha256(canonicalJson(group.occurrences)) !== config.citationArtifactSha256) {
      throw new Error(`Curated nondependency citation ${config.ownerTag}/${config.citationKey}/${config.pinpoint ?? "no pinpoint"} changed from its audited occurrence`);
    }
    auditedNondependencyCitationGroupKeys.add(citationAuditKey(
      owner.node.id,
      config.citationKey,
      config.pinpoint,
    ));
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

  for (const config of CURATED_CLAIM_DEPENDENCIES) {
    const owner = metadataForTag(config.ownerTag, "curated-claim owner");
    if (!owner) continue;
    if (!owner.curatedClaim) {
      throw new Error(`Curated claim dependency owner ${config.ownerTag} is not a promoted claim`);
    }
    const { occurrences, proofStartLines } = proofPhraseOccurrences(owner, config.phrasePattern);
    if (occurrences.length !== config.expectedOccurrenceCount) {
      throw new Error(`Curated claim audit for ${config.ownerTag}->${config.targetTag} expected ${config.expectedOccurrenceCount} occurrence(s), found ${occurrences.length}`);
    }
    const target = targetForTag(config.targetTag, "curated-claim prerequisite");
    assertTargetPrecedesOwner(target, owner, "curated-claim prerequisite");
    addSemanticGroup({
      owner,
      basis: "audited-curated-claim",
      targetNode: target.node,
      externalInput: null,
      occurrences,
      proofStartLines,
      routeEvidenceRegions: [],
      routeDebtNotes: [],
      rationale: `The exact source-audited derivation of ${owner.node.sourceLabel} directly uses ${target.node.sourceLabel}.`,
      evidenceNote: `${occurrences.length} exact phrase occurrence(s) in the promoted claim's pinned inline derivation.`,
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

  const activeSectionDelegations = CURATED_SECTION_PROOF_DEPENDENCIES
    .map((config) => ({
      config,
      owner: metadataForTag(config.ownerTag, "section-delegation owner"),
    }))
    .filter(({ owner }) => owner);
  if (activeSectionDelegations.length > 0
    && sourceRevision !== CURATED_SECTION_DELEGATION_SOURCE_REVISION) {
    throw new Error(`Curated section-delegation audit requires source revision ${CURATED_SECTION_DELEGATION_SOURCE_REVISION}`);
  }
  const curatedResolvedSectionProofGroupKeys = new Set();
  for (const { config, owner } of activeSectionDelegations) {
    if (owner.node.sourceTextSha256 !== config.ownerSourceTextSha256) {
      throw new Error(`Curated section-delegation owner ${config.ownerTag} statement changed`);
    }
    const sectionFullLabel = tags.tagToFullLabel.get(config.referenceTag);
    if (!sectionFullLabel) {
      throw new Error(`Curated section-delegation reference tag ${config.referenceTag} is absent`);
    }
    if (nodeByFullLabel.has(sectionFullLabel)) {
      throw new Error(`Curated section-delegation reference ${config.referenceTag} unexpectedly resolves to a formal node`);
    }
    const matchingProofs = (owner.proofs ?? []).filter(({ rawProof }) => (
      sha256(rawProof) === config.proofSourceTextSha256
    ));
    if (matchingProofs.length !== 1) {
      throw new Error(`Curated section-delegation proof ${config.ownerTag} changed from its audited source text`);
    }
    const proof = matchingProofs[0];
    const occurrences = (owner.proofs ?? [])
      .flatMap(({ references }) => references)
      .filter(({ ref }) => (
        resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === sectionFullLabel
      ));
    if (occurrences.length !== config.expectedSectionReferenceCount) {
      throw new Error(`Curated section-delegation ${config.ownerTag}->${config.referenceTag} expected ${config.expectedSectionReferenceCount} occurrence(s), found ${occurrences.length}`);
    }
    if (sha256(canonicalJson(occurrences)) !== config.referenceArtifactSha256) {
      throw new Error(`Curated section-delegation reference ${config.ownerTag}->${config.referenceTag} changed from its audited occurrence`);
    }
    for (const targetTag of config.targetTags) {
      const target = targetForTag(targetTag, "section-delegation prerequisite");
      assertTargetPrecedesOwner(target, owner, "section-delegation prerequisite");
      addSemanticGroup({
        owner,
        basis: "audited-section-delegation",
        targetNode: target.node,
        externalInput: null,
        occurrences,
        proofStartLines: [proof.startLine],
        routeEvidenceRegions: [],
        routeDebtNotes: config.routeDebtNote ? [config.routeDebtNote] : [],
        rationale: `An exact owner-specific audit of the pinned Stacks proof resolves the facts imported from Section (Tag ${config.referenceTag}) to ${target.node.sourceLabel}.${config.rationaleNote ? ` ${config.rationaleNote}` : ""}`,
        evidenceNote: `Exact section-reference occurrence in a proof guarded by its full source hash; the shared section label was not globally aliased.`,
      });
    }
    curatedResolvedSectionProofGroupKeys.add(`${owner.node.id}|${sectionFullLabel}`);
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

  const orderedCountEntries = (value) => Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [targetTag, expectedOwnerOccurrenceCounts]
    of CURATED_CLAIM_INCOMING_REFERENCE_COUNTS) {
    const fullLabel = tags.tagToFullLabel.get(targetTag);
    if (!fullLabel) continue;
    const target = metadataForTag(targetTag, "incoming-reference claim");
    if (!target.curatedClaim) {
      throw new Error(`Incoming-reference audit target ${targetTag} is not a promoted claim`);
    }
    const actualOwnerOccurrenceCounts = {};
    for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
      const occurrenceCount = (owner.proofs ?? [])
        .flatMap(({ references }) => references)
        .filter(({ ref }) => (
          resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === fullLabel
        )).length;
      if (occurrenceCount === 0) continue;
      const ownerTag = tags.fullLabelToTag.get(owner.node.sourceXmlId);
      actualOwnerOccurrenceCounts[ownerTag] = occurrenceCount;
    }
    if (canonicalJson(orderedCountEntries(actualOwnerOccurrenceCounts))
      !== canonicalJson(orderedCountEntries(expectedOwnerOccurrenceCounts))) {
      throw new Error(`Curated claim ${targetTag} incoming owner/count inventory changed`);
    }
  }

  for (const config of CURATED_PROSE_SUPPORT_NODES) {
    const fullLabel = tags.tagToFullLabel.get(config.targetTag);
    if (!fullLabel) continue;
    const target = metadataForTag(config.targetTag, "prose-support target");
    if (!target.curatedSupport || target.node.nodeClass !== "support") {
      throw new Error(`Curated prose support ${config.targetTag} is not an audited support node`);
    }
    const actualOwnerOccurrenceCounts = {};
    for (const owner of metadata.filter(({ node }) => node.nodeClass === "theorem-like")) {
      const occurrences = (owner.proofs ?? [])
        .flatMap(({ references }) => references)
        .filter(({ ref }) => (
          resolveFullLabel(ref, owner.unit.stem, tags.fullLabelToTag) === fullLabel
        ));
      if (occurrences.length === 0) continue;
      const ownerTag = tags.fullLabelToTag.get(owner.node.sourceXmlId);
      actualOwnerOccurrenceCounts[ownerTag] = occurrences.length;
    }
    if (canonicalJson(orderedCountEntries(actualOwnerOccurrenceCounts))
      !== canonicalJson(orderedCountEntries(config.ownerOccurrenceCounts))) {
      throw new Error(`Curated prose support ${config.targetTag} owner/count inventory changed`);
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
  let curatedClaimDependencyCount = 0;
  let externalCitationDependencyCount = 0;
  let deicticDependencyCount = 0;
  let bundledRemarkDependencyCount = 0;
  let sectionDelegationDependencyCount = 0;
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
      else if (group.basis === "audited-curated-claim") curatedClaimDependencyCount += 1;
      else if (group.basis === "audited-external-citation") externalCitationDependencyCount += 1;
      else if (group.basis.includes("deictic")) deicticDependencyCount += 1;
      else if (group.basis === "audited-bundled-remark") bundledRemarkDependencyCount += 1;
      else if (group.basis === "audited-section-delegation") sectionDelegationDependencyCount += 1;
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
          : "Source-faithful candidate route containing direct prerequisites explicitly cited or selected by owner-specific audits of semantic proof language and bibliographic theorem invocations in the pinned Stacks source.",
        evidence: capturedEvidence({
          sourceUnitId: unitId(owner.unit.stem),
          locator: locator || owner.node.sourceLocator,
          artifactSha256: sha256(routeEvidenceText),
          capturedAt,
          note: routeKind === "alternate-proof"
            ? `Candidate alternative route from a separately titled source proof${hasSemanticDependencies ? " with owner-specific audited prose dependencies" : ""}; implicit prerequisites remain pending and no independent review is claimed.${routeDebtNotes.length ? ` ${routeDebtNotes.join(" ")}` : ""}`
            : `Candidate route from ${hasSemanticDependencies ? "explicit proof references plus owner-specific audited named-result, curated-claim, external-citation, deictic, bundled-remark, or section-delegation dependencies" : "explicit proof references only"}; implicit prerequisites remain pending and no independent review is claimed.${routeDebtNotes.length ? ` ${routeDebtNotes.join(" ")}` : ""}`,
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
        if (curatedResolvedSectionProofGroupKeys.has(`${owner.node.id}|${group.fullLabel}`)) continue;
        references.push(referenceEntity({ group, dependencyId: null, capturedAt, usedIds }));
      }
      for (const group of citationGroupsByOwner.get(owner.node.id) ?? []) {
        const groupKey = citationAuditKey(
          owner.node.id,
          group.citationKey,
          group.pinpoint,
        );
        if (auditedNondependencyCitationGroupKeys.has(groupKey)) continue;
        const externalInput = auditedCitationResolutionByGroupKey.get(groupKey) ?? null;
        const dependencyId = externalInput
          ? dependencyIdByPair.get(`${owner.node.id}|${externalInput.id}`) ?? null
          : null;
        references.push(citationReferenceEntity({
          group,
          externalInput,
          dependencyId,
          capturedAt,
          usedIds,
        }));
      }
    }
  }

  const inventoryByUnitId = new Map(sourceUnits.map(({ id }) => [id, {
    theoremNodeIds: [],
    supportNodeIds: [],
    curatedClaimCount: 0,
    curatedSupportCount: 0,
  }]));
  for (const {
    node,
    unit,
    curatedClaim = false,
    curatedSupport = false,
  } of metadata) {
    const inventory = inventoryByUnitId.get(unitId(unit.stem));
    if (!inventory) throw new Error(`Missing source-unit inventory for ${unit.path}`);
    if (node.nodeClass === "theorem-like") inventory.theoremNodeIds.push(node.id);
    else inventory.supportNodeIds.push(node.id);
    if (curatedClaim) inventory.curatedClaimCount += 1;
    if (curatedSupport) inventory.curatedSupportCount += 1;
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
          : `Formal-environment plus curated-span scan assigned ${inventory.theoremNodeIds.length} theorem-like and ${inventory.supportNodeIds.length} support node(s), including ${inventory.curatedClaimCount} exact-label source-audited claim(s) and ${inventory.curatedSupportCount} source-audited prose/display support node(s); examples, exercises, and all other remarks were excluded.`,
      }),
    };
  });

  const curatedClaimCount = metadata.filter(({ curatedClaim }) => curatedClaim).length;
  const curatedSupportCount = metadata.filter(({ curatedSupport }) => curatedSupport).length;
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
  const resolvedProofCitationReferences = proofCitationReferences.filter(({ resolution }) => (
    resolution.status === "resolved"
  ));
  const unresolvedProofCitationReferences = proofCitationReferences.filter(({ resolution }) => (
    resolution.status === "unresolved"
  ));
  const citationOccurrenceCount = (citationReferences) => citationReferences
    .reduce((total, reference) => total + reference.locator.split("; ").length, 0);
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
      curatedClaimDependencyCount,
      externalCitationDependencyCount,
      deicticDependencyCount,
      bundledRemarkDependencyCount,
      sectionDelegationDependencyCount,
      semanticDependencyCount: namedResultDependencyCount
        + curatedClaimDependencyCount
        + externalCitationDependencyCount
        + deicticDependencyCount
        + bundledRemarkDependencyCount
        + sectionDelegationDependencyCount,
      suppressedProofXrefDependencyCount,
      suppressedProofCitationReferenceCount: auditedNondependencyCitationGroupKeys.size,
      curatedResolvedBundledProofXrefCount: curatedResolvedProofGroupKeys.size,
      curatedResolvedSectionProofXrefCount: curatedResolvedSectionProofGroupKeys.size,
      externalInputCount: externalInputs.length,
      proofRouteCount: proofRoutes.length,
      referenceCount: references.length,
      unresolvedReferenceCount,
      statementXrefCount: 0,
      totalProofCitationReferenceCount: proofCitationReferences.length
        + auditedNondependencyCitationGroupKeys.size,
      retainedProofCitationReferenceCount: proofCitationReferences.length,
      resolvedProofCitationReferenceCount: resolvedProofCitationReferences.length,
      resolvedProofCitationOccurrenceCount: citationOccurrenceCount(resolvedProofCitationReferences),
      proofCitationReferenceCount: unresolvedProofCitationReferences.length,
      proofCitationOccurrenceCount: citationOccurrenceCount(unresolvedProofCitationReferences),
      distinctProofCitationKeyCount: new Set(unresolvedProofCitationReferences.map(({ ref }) => ref)).size,
      proofCitationOwnerCount: new Set(unresolvedProofCitationReferences.map(({ ownerNodeId }) => ownerNodeId)).size,
      unresolvedProofXrefCount: unresolvedTaggedProofReferences.length,
      unresolvedTaggedProofReferenceCount: unresolvedTaggedProofReferences.length,
      uniqueUnresolvedTaggedProofTargetCount: new Set(
        unresolvedTaggedProofReferences.map(({ ref }) => ref),
      ).size,
      pendingTheoremCount: theoremCount - routedTheoremIds.size,
      unitInventoryCount: unitInventories.length,
      theoremFreeUnitCount: unitInventories.filter(({ theoremFreeAttestation }) => theoremFreeAttestation).length,
      curatedClaimCount,
      curatedSupportCount,
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
    sourceRevision: commit,
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
        note: `Formal-environment extraction plus ${extracted.stats.curatedClaimCount} exact-label, source-audited theorem-level claim(s) and ${extracted.stats.curatedSupportCount} proof-used definition/construction span(s) outside formal environments from all ${extracted.sourceUnits.length} chapters in the pinned official source: ${kindSummary}. Deliberately excluded ${excludedSummary}; no worked example is a graph node and no unlisted remark or display was promoted.`,
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
        note: `${extracted.stats.directDependencyCount} candidate edges comprise ${extracted.stats.explicitProofXrefDependencyCount} explicit proof-xref edges and ${extracted.stats.semanticDependencyCount} owner-specific source-audited semantic edges (${extracted.stats.namedResultDependencyCount} named-result, ${extracted.stats.curatedClaimDependencyCount} curated-claim, ${extracted.stats.externalCitationDependencyCount} external-citation, ${extracted.stats.deicticDependencyCount} deictic-proof, ${extracted.stats.bundledRemarkDependencyCount} bundled-remark, ${extracted.stats.sectionDelegationDependencyCount} section-delegation); resolved occurrences are merged into edge evidence, and ${extracted.stats.suppressedProofXrefDependencyCount} exact owner-target proof-xref record(s) were audited as notation-only or optional nonlogical uses and suppressed. The graph has ${extracted.stats.externalInputCount} typed external theorem input(s): Zorn's lemma under the declared choice convention plus primary-source-audited bibliographic results. Of ${extracted.stats.totalProofCitationReferenceCount} original bibliographic proof-citation records, ${extracted.stats.resolvedProofCitationReferenceCount} resolve to ${extracted.stats.externalCitationDependencyCount} owner-input edges, ${extracted.stats.suppressedProofCitationReferenceCount} are audited nondependencies, and ${extracted.stats.proofCitationReferenceCount} remain unresolved. ${extracted.stats.unresolvedTaggedProofReferenceCount} unresolved tagged proof-xref records (${extracted.stats.uniqueUnresolvedTaggedProofTargetCount} unique permanent labels) and ${extracted.stats.proofCitationReferenceCount} bibliographic records (${extracted.stats.distinctProofCitationKeyCount} keys) remain review candidates. ${extracted.stats.pendingTheoremCount} theorem-like nodes have no route with a resolved candidate prerequisite and remain pending, not roots. No independent mathematical review or graph-completeness claim is made.`,
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
