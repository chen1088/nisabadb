const paperId = "braverman-khot-lifshitz-minzer-2025-invariance-principle-multislice";
const sourceVersion = "arXiv:2110.10725v2";
const sourceUrl = "https://arxiv.org/abs/2110.10725v2";
const sourceTexHash = "8e8e14cfe1f530e3d80997a9a11ab1b166a97a869b047c211340e0e6e36554f4";
const sourceTarHash = "1bf0c03e573579678e7fe0031728f5d995568e5947f25a82867451140e964278";
const sourcePdfHash = "11aa02b7d4257df4a75db89309b27062d070730bad8e3b00ef38ba3617d3093b";
const importedAt = "2026-08-21T21:30:00.000Z";

function globalId(id) {
  return `${paperId}.${id.toLowerCase().replaceAll("_", "-")}`;
}

function sourceLocation(localLabel, lineStart, locator = localLabel) {
  return [{
    type: "paper",
    label: "Pinned arXiv v2 source",
    url: sourceUrl,
    locator: `${locator}; inv_nonprod.tex line ${lineStart}`,
    version: `${sourceVersion}; tex-sha256:${sourceTexHash}`,
    file: "inv_nonprod.tex",
    lineStart,
  }];
}

function modificationHistory(summary) {
  return [{
    version: "1.0.0",
    timestamp: importedAt,
    contributors: ["NisabaDB project"],
    summary,
  }];
}

function proofRoute({
  dependencies = [],
  proof,
  steps = [],
  status = "complete",
  conceptualCost = "specialist",
  type = "compressed-source",
  label = "Compressed source",
  sourceAttribution = "New NisabaDB compression of arXiv:2110.10725v2, checked against the pinned TeX source.",
}) {
  return {
    id: type === "historical" ? "literature-source" : "compressed-source",
    label,
    type,
    conceptualCost,
    dependencies,
    status,
    proof,
    steps,
    sourceAttribution,
    verificationStatus: "statement-only",
    formalAlignment: "not-applicable",
  };
}

function step(id, text, dependencyRefs = []) {
  return { id, text, dependencyRefs, formalDeclarationRefs: [] };
}

function statement({
  id,
  localLabel,
  kind,
  title,
  section,
  importance = "normal",
  exactStatement,
  idea,
  dependencies = [],
  lineStart,
  locator,
  route,
  tags = [],
  intuition,
  examples,
  nonExamples,
  sourceStatement,
  statementNote,
}) {
  return {
    id,
    paperId,
    localLabel,
    globalStatementId: globalId(id),
    kind,
    title,
    section,
    importance,
    exactStatement,
    ...(sourceStatement ? { sourceStatement } : {}),
    ...(statementNote ? { statementNote } : {}),
    idea,
    proofRoutes: route ? [proofRoute({ ...route, dependencies })] : [],
    dependencies,
    sourceLocations: sourceLocation(localLabel, lineStart, locator),
    formalDeclarations: [],
    formalStatus: "statement-only",
    formalAlignment: "not-applicable",
    contributors: {
      distillers: ["NisabaDB project"],
      mathematicalReviewers: [],
      formalizers: [],
      alignmentReviewers: [],
    },
    version: "1.0.0",
    modificationHistory: modificationHistory(
      `Added a source-located mathematical restatement and ${route ? "proof-route audit" : "definition record"} from ${sourceVersion}.`,
    ),
    tags: ["multislice", ...tags],
    ...(intuition ? { intuition } : {}),
    ...(examples ? { examples } : {}),
    ...(nonExamples ? { nonExamples } : {}),
  };
}

const gapProof = (reason) =>
  `**Proof not yet distilled.** ${reason} The pinned source statement and dependency boundary are recorded, but NisabaDB does not claim a complete human-readable route.`;

const definitions = [
  statement({
    id: "BKLM_D01",
    localLabel: "Definition 1.1",
    kind: "definition",
    title: "Balanced multislices",
    section: "1.1 The multislice",
    importance: "major",
    lineStart: 186,
    exactStatement: String.raw`Let $m,n\in\mathbb N$ and let $\vec k=(k_1,\ldots,k_m)$ be nonnegative integers with $\sum_{a=1}^m k_a=n$. The **multislice**

$$
\mathcal U_{\vec k}=\{x\in[m]^n: |\{i:x_i=a\}|=k_a\text{ for every }a\in[m]\}
$$

is equipped with the uniform measure. It is **$\alpha$-balanced** when $k_a\ge \alpha n$ for every symbol $a$. Its product analogue has one-coordinate law $\nu_{\vec k}(a)=k_a/n$ and measure $\nu_{\vec k}^{\otimes n}$.`,
    idea: "A multislice is a product alphabet conditioned on the exact histogram of its symbols.",
    tags: ["definition", "probability-space"],
    intuition: "The product space allows the histogram to fluctuate; the multislice fixes it exactly. The paper constructs couplings that change only a small fraction of coordinates when moving between them.",
    examples: [String.raw`The Boolean slice of all $k$-subsets of $[n]$ is $\mathcal U_{(k,n-k)}$.`],
    nonExamples: ["The whole cube $[m]^n$ is not one multislice because its symbol counts vary."],
  }),
  statement({
    id: "BKLM_D02",
    localLabel: "Definitions 1.2–1.3",
    kind: "definition",
    title: "Juntas and degree on a multislice",
    section: "1.1 The multislice",
    importance: "major",
    lineStart: 223,
    dependencies: ["BKLM_D01"],
    exactStatement: String.raw`A function $f:\mathcal U_{\vec k}\to\mathbb R$ is a **$d$-junta** if it depends on at most $d$ coordinates. Let $V_d(\mathcal U_{\vec k})$ be the linear span of all $d$-juntas, with $V_{-1}=\{0\}$, and define the pure-degree space

$$
V_{=d}=V_d\cap V_{d-1}^{\perp}.
$$

Write $f^{\le d}$ and $f^{>d}$ for the orthogonal projections of $f$ onto $V_d$ and $V_d^\perp$, respectively.`,
    sourceStatement: "Definition 1.2 calls $\\mathcal U_{\\vec k}$ a multislice over alphabet $[n]$ while its functions and surrounding setup use alphabet $[m]$.",
    statementNote: "NisabaDB normalizes the alphabet to $[m]$.",
    idea: "Degree is defined intrinsically by spans of coordinate juntas, not by choosing a polynomial representation.",
    tags: ["definition", "degree", "junta"],
    intuition: "The orthogonal levels play the role of Fourier degrees on a product space, while respecting the fixed-histogram constraint.",
  }),
  statement({
    id: "BKLM_D03",
    localLabel: "Definitions 1.4–1.5",
    kind: "definition",
    title: "Symmetric couplings and transfer operators",
    section: "1.1 The multislice",
    importance: "hero",
    lineStart: 240,
    dependencies: ["BKLM_D01"],
    exactStatement: String.raw`A distribution on coordinate strings is **symmetric** if simultaneous permutation of all $n$ coordinates leaves it invariant. For symmetric measures $\nu_1,\nu_2$ on $[m]^n$, an **$(\alpha,\zeta)$-coupling** is a symmetric joint law $\mathcal C=(\mathbf x,\mathbf y)$ with marginals $\nu_1,\nu_2$ such that

1. $\Pr[x_i\ne y_i]\le\zeta$ for every coordinate $i$; and
2. for every $\epsilon>0$,
   $$
   \Pr\bigl[|\{i:x_i\ne y_i\}|\ge\epsilon n\bigr]
   \le \alpha^{-1}e^{-\alpha\epsilon^2n}.
   $$

The transfer operator and its adjoint are

$$
(T_{\mathcal C}f)(y)=\mathbb E[f(\mathbf x)\mid\mathbf y=y],\qquad
(T_{\mathcal C}^*g)(x)=\mathbb E[g(\mathbf y)\mid\mathbf x=x].
$$`,
    idea: "The coupling compares two different probability spaces; conditional expectation transports functions between them.",
    tags: ["definition", "coupling", "operator"],
    intuition: "A good coupling makes corresponding samples coordinatewise close, while the transfer operator averages over the compatible source samples.",
  }),
  statement({
    id: "BKLM_D04",
    localLabel: "Definitions 1.7–1.10",
    kind: "definition",
    title: "Admissibility, connectedness, and the product analogue",
    section: "1.1 The multislice",
    importance: "major",
    lineStart: 303,
    dependencies: ["BKLM_D01", "BKLM_D03"],
    exactStatement: String.raw`For a symmetric law $\mu$ on $\prod_{j=1}^r\mathcal U_{\vec k(j)}$, let $\mu_{\vec a}$ be the probability that a uniformly chosen coordinate has symbol tuple $\vec a$. The law is **$\alpha$-admissible** if every $\mu_{\vec a}$ is either $0$ or at least $\alpha$.

It is **connected** if, for each component $j$, the bipartite support graph between that component and the other $r-1$ components is connected. Its **product analogue** is

$$
\widetilde\mu=\prod_{i=1}^n\widetilde\mu_i,
$$

where $\widetilde\mu_i$ is the one-coordinate joint marginal of $\mu$ at coordinate $i$.`,
    idea: "Admissibility prevents tiny nonzero atoms; connectedness supplies a spectral gap; the product analogue keeps one-coordinate statistics but removes cross-coordinate dependence.",
    tags: ["definition", "admissibility", "connectedness"],
  }),
  statement({
    id: "BKLM_D12",
    localLabel: "Section 2.1 representation decomposition",
    kind: "notation",
    title: "Partition-isotypic refinement of multislice degree",
    section: "2.1 Representation-theoretic preliminaries",
    importance: "major",
    lineStart: 935,
    dependencies: ["BKLM_D01", "BKLM_D02"],
    exactStatement: String.raw`Lift $f:\mathcal U_{\vec k}\to\mathbb R$ to a right-coset-constant function $\widetilde f:S_n\to\mathbb R$. For every partition $\lambda\vdash n$, define

$$
V_\lambda(\mathcal U_{\vec k})=\{f:\widetilde f\in V_\lambda(S_n)\},
\qquad
V_{=\lambda}(\mathcal U_{\vec k})=\{f:\widetilde f\in V_{=\lambda}(S_n)\}.
$$

The partition refinement respects degree: if $\lambda_1=n-d$, then $V_{=\lambda}\subseteq V_{=d}$. A nonzero orbit inside $V_{=\lambda}$ spans a space of dimension at least $\dim(\lambda)$.`,
    idea: "This dictionary is what lets the trace method trade representation multiplicity for small operator eigenvalues.",
    tags: ["notation", "representation-theory", "partition"],
  }),
  statement({
    id: "BKLM_D05",
    localLabel: "Simplex lift before Theorem 4.4",
    kind: "definition",
    title: "Simplex-valued label assignments",
    section: "4.2 Invariance for label assignments",
    lineStart: 2575,
    dependencies: ["BKLM_D03"],
    exactStatement: String.raw`Identify a symbol $a\in[m]$ with the vertex $e_a$ of the simplex

$$
\Delta_m=\{z\in\mathbb R^m:z_a\ge0,\ \sum_a z_a=1\}.
$$

For a predicate $P:\prod_{j=1}^r[m_j]\to[-1,1]$, its multilinear extension is

$$
\widetilde P(z_1,\ldots,z_r)=
\sum_{a_1,\ldots,a_r}P(a_1,\ldots,a_r)\prod_{j=1}^r(z_j)_{a_j}.
$$

The transfer operator acts coordinatewise on simplex-valued functions.`,
    idea: "The simplex embedding turns discrete labels into bounded real coordinate functions to which the scalar invariance theorem applies.",
    tags: ["definition", "simplex", "predicate"],
  }),
  statement({
    id: "BKLM_D06",
    localLabel: "Definition 4.5",
    kind: "definition",
    title: "Negative correlation for multislice laws",
    section: "4.3 Construction of a useful coupling",
    lineStart: 2658,
    dependencies: ["BKLM_D04", "BKLM_I16"],
    exactStatement: String.raw`A law $\mu$ on $\prod_{j=1}^r\mathcal U_{\vec k(j)}$ is **negatively correlated** if, for every symbol tuple $\vec a$, the coordinate indicators

$$
\mathbf 1[(x(1)_i,\ldots,x(r)_i)=\vec a],\qquad i\in[n],
$$

are negatively associated under $\mu$.`,
    sourceStatement: "Definition 4.5 introduces each component as $\\mathcal U_{\\vec k(1)}$ instead of the indexed family $\\mathcal U_{\\vec k(i)}$.",
    statementNote: "NisabaDB restores the component index. The operative property is negative association, despite the definition's shorter name.",
    idea: "Negative association gives concentration for every joint-symbol count, which is precisely what the histogram coupling needs.",
    tags: ["definition", "negative-association"],
  }),
  statement({
    id: "BKLM_D07",
    localLabel: "Definition 5.1",
    kind: "definition",
    title: "Annihilation of high-degree functions",
    section: "5 Beyond connected distributions",
    importance: "major",
    lineStart: 2754,
    dependencies: ["BKLM_D02"],
    exactStatement: String.raw`A sequence of $r$-coordinate laws $\mu_n$ **annihilates high-degree functions** if, for every $\epsilon>0$ and moment bound $M$, there are $q,d,N$ such that for all $n\ge N$: whenever $\mathbb E|f_j|^q\le M$ for all $j$ and at least one $f_j$ lies in $V_{>d}$,

$$
\left|\mathbb E_{\mu_n}\prod_{j=1}^r f_j\right|\le\epsilon.
$$`,
    sourceStatement: "The source writes $\\mathbb E[f_j^q]\\le M$ without requiring $q$ to be even.",
    statementNote: "NisabaDB uses the absolute moment $\\mathbb E|f_j|^q$, which is the norm condition used by the surrounding argument.",
    idea: "This abstracts the only high-degree estimate used by the multilinear invariance proof.",
    tags: ["definition", "high-degree"],
  }),
  statement({
    id: "BKLM_D08",
    localLabel: "Definitions 1.13–1.16",
    kind: "definition",
    title: "Rich 2-to-1 Games",
    section: "1.2 Applications to hardness",
    importance: "major",
    lineStart: 439,
    exactStatement: String.raw`A **2-to-1 Games** instance is a bipartite projection game with alphabets $\Sigma_L,\Sigma_R$ satisfying $|\Sigma_L|=n$ and $|\Sigma_R|=n/2$, and with a two-to-one projection $\pi_e:\Sigma_L\to\Sigma_R$ on every edge. Each projection induces the partition

$$
\bigl\{\pi_e^{-1}(\rho):\rho\in\Sigma_R\bigr\}
$$

of $\Sigma_L$ into pairs. The instance is **rich** when, at every left vertex, the partition induced by a uniformly random incident edge is uniform over all partitions of $\Sigma_L$ into pairs.`,
    sourceStatement: "Definition 1.16 requires only a uniform induced partition into pairs. The proof of Theorem 6.7 later says that the full projection is uniform over all two-to-one maps, which does not follow from this definition because the fibers may be labeled nonuniformly.",
    statementNote: "NisabaDB preserves the partition-rich source definition and records the stronger map-uniform step as an unresolved alignment gap at Theorem 6.7.",
    idea: "Richness randomizes which left labels are paired; it does not, as stated, randomize the names assigned to those pairs.",
    tags: ["definition", "hardness", "projection-game", "source-mismatch"],
  }),
  statement({
    id: "BKLM_A01",
    localLabel: "Conjecture 1.17",
    kind: "conjecture",
    title: "Rich 2-to-1 Games Conjecture",
    section: "1.2 Applications to hardness",
    importance: "hero",
    lineStart: 509,
    dependencies: ["BKLM_D08"],
    exactStatement: String.raw`For every $\delta>0$, there is a sufficiently large even alphabet size $n$ for which it is NP-hard to distinguish satisfiable Rich 2-to-1 Games instances with $|\Sigma_L|=n$ and $|\Sigma_R|=n/2$ from such instances of value at most $\delta$.`,
    idea: "This is an explicit unproved complexity assumption. Every conditional hardness result below displays it as a dependency.",
    tags: ["conjecture", "hardness", "assumption"],
  }),
  statement({
    id: "BKLM_D13",
    localLabel: "Definitions 6.3–6.5 and Appendix B.2",
    kind: "definition",
    title: "Product Efron–Stein degree, influence, and regularity",
    section: "6 Applications to hardness and Appendix B.2",
    importance: "major",
    lineStart: 2815,
    locator: "Definitions 6.3–6.5; Appendix B.2 Efron–Stein decomposition",
    exactStatement: String.raw`For a product law $\mathcal D=\nu_1\otimes\cdots\otimes\nu_n$, every scalar $g$ has the orthogonal Efron--Stein decomposition

$$
g=\sum_{S\subseteq[n]}g^{=S},
\qquad
g^{\le d}=\sum_{|S|\le d}g^{=S}.
$$

If $\mathbb E_i$ averages coordinate $i$, then

$$
I_i[g;\mathcal D]=\|g-\mathbb E_i g\|_2^2
=\sum_{S\ni i}\|g^{=S}\|_2^2,
\qquad
I_i^{\le d}[g;\mathcal D]=I_i[g^{\le d};\mathcal D].
$$

For vector-valued $f=(f_1,\ldots,f_m)$, sum these influences over its coordinates. If $\mathcal D$ is a law on $[m]^r$, then $f:[m]^n\to[m]$ is **$(d,\tau)$-regular** when every coordinate has low-degree influence at most $\tau$ under every marginal product law $\mathcal D_j^{\otimes n}$. It is **$(\gamma,d,\tau)$-regular** for a test family when this holds for a random test index with probability at least $1-\gamma$.`,
    idea: "Efron–Stein components are the product-space degree levels used by hypercontractivity, contraction, and dictatorship-test soundness.",
    tags: ["definition", "product-space", "degree", "influence", "regularity"],
  }),
  statement({
    id: "BKLM_D09",
    localLabel: "Definitions 6.1–6.2 and 6.6",
    kind: "definition",
    title: "Perfect-completeness dictatorship tests",
    section: "6 Applications to hardness",
    importance: "major",
    lineStart: 2799,
    dependencies: ["BKLM_D13"],
    exactStatement: String.raw`For predicates $\mathcal P\subseteq\{P:[m]^r\to\{0,1\}\}$, a **$(c,s)$ dictatorship test** consists of measures $w$ on predicates and $p$ on test indices, together with query laws $\mathcal D(t,P)$ on $[m]^r$, such that:

1. for every input length, every coordinate dictator has expected acceptance at least $c$; and
2. for every $\gamma,\epsilon>0$, there are $\tau>0$ and $d,N\in\mathbb N$ such that, whenever $n\ge N$ and $f:[m]^n\to[m]$ is $(\gamma,d,\tau)$-regular for the family $\{\mathcal D(t,P)\}$, its expected acceptance is at most $s+\epsilon$.

The paper focuses on perfect completeness, $c=1$. A test is called **connected** here when every query law used by it is connected.`,
    idea: "The test is specified by completeness on dictators and a quantified soundness guarantee for functions regular under most sampled query laws.",
    tags: ["definition", "dictatorship-test", "hardness"],
  }),
  statement({
    id: "BKLM_D10",
    localLabel: "Definitions 6.8–6.11",
    kind: "definition",
    title: "Multislice noise and noisy influence",
    section: "6.1 Noisy influences",
    importance: "major",
    lineStart: 2911,
    dependencies: ["BKLM_D01", "BKLM_D02"],
    exactStatement: String.raw`Assume $0<\beta\le\alpha$ and $\beta n\in\mathbb N$. The operator $S_{1-\beta}$ cyclically recolors exactly $\beta n$ randomly chosen occurrences of each symbol and averages over that move. For $f:\mathcal U_{\vec k}\to\mathbb R$, define

$$
I_i[f]=\mathbb E_{\mathbf x,j}\bigl(f(\mathbf x^{(ij)})-f(\mathbf x)\bigr)^2,\qquad
I_i^{(\beta)}[f]=I_i[S_{1-\beta}f],qquad
I^{(\beta)}[f]=\sum_i I_i^{(\beta)}[f].
$$`,
    sourceStatement: "Definition 6.10 displays an expectation only over the random transposition partner $j$, leaving the sample $x$ free even though the ensuing influence is a scalar.",
    statementNote: "NisabaDB makes the uniform multislice sample $\\mathbf x$ explicit in the expectation.",
    idea: "Noise smooths the function before transposition influence is measured, producing short candidate label lists.",
    tags: ["definition", "noise", "influence"],
  }),
  statement({
    id: "BKLM_D11",
    localLabel: "Definition 6.20",
    kind: "definition",
    title: "Projection along a two-to-one map",
    section: "6.2 Projection of a high influence",
    lineStart: 3493,
    dependencies: ["BKLM_D01"],
    exactStatement: String.raw`Suppose all entries of $\vec k$ are even and $\pi:[n]\to[n/2]$ is two-to-one. For $x\in\mathcal U_{\vec k/2}$, let $\pi^{-1}(x)\in\mathcal U_{\vec k}$ repeat $x_{\pi(i)}$ at coordinate $i$. The projection of $f:\mathcal U_{\vec k}\to\mathbb R$ is

$$
(f|_\pi)(x)=f(\pi^{-1}(x)).
$$`,
    sourceStatement: "The source gives the malformed codomain $f|_\\pi:\\mathcal U_{\\vec k/2}\\to[m]^{n/2}\\to\\mathbb R$.",
    statementNote: "NisabaDB normalizes the projection to $f|_\\pi:\\mathcal U_{\\vec k/2}\\to\\mathbb R$.",
    idea: "This is the exact operation induced by a two-to-one label projection in the PCP reduction.",
    tags: ["definition", "projection", "influence"],
  }),
];

const importedResults = [
  statement({
    id: "BKLM_I05",
    localLabel: "Lemma 2.7",
    kind: "imported-result",
    title: "Dimension lower bounds for symmetric-group irreducibles",
    section: "2 Representation-theoretic preliminaries",
    lineStart: 846,
    dependencies: ["BKLM_D02"],
    exactStatement: String.raw`Let $\lambda=(\lambda_1,\ldots,\lambda_k)\vdash n$ and $d=\min(n-\lambda_1,k-1)$. Then $\dim(\lambda)=1$ for $\lambda=(n)$; if $d>0$,

$$
\dim(\lambda)\ge\left(\frac{n}{de}\right)^d;
$$

and for every $c>0$ there is $\delta>0$ such that $d>cn$ implies $\dim(\lambda)\ge(1+\delta)^n$.`,
    idea: "Large irreducible multiplicity converts a trace bound into a strong eigenvalue bound.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper imports the hook-formula consequence from Ellis–Friedgut–Pilpel, Claim 1 and Theorem 19."),
      steps: [],
      sourceAttribution: "Imported in arXiv:2110.10725v2 from Ellis, Friedgut, and Pilpel, Intersecting families of permutations (2011), Claim 1 and Theorem 19.",
    },
    tags: ["imported", "representation-theory"],
  }),
  statement({
    id: "BKLM_I11",
    localLabel: "Theorem 2.11",
    kind: "imported-result",
    title: "Hypercontractivity on finite product spaces",
    section: "2.3 Hypercontractivity",
    lineStart: 1015,
    dependencies: ["BKLM_D13"],
    exactStatement: String.raw`Let $\nu=\prod_{i=1}^n\nu_i$ on $\prod_i\Omega_i$, and assume every atom of every $\nu_i$ has mass at least $\alpha\in(0,1/2)$. If $f$ has degree at most $d$ and $q\ge2$, then

$$
\|f\|_q\le\left(\frac{10q}{\alpha}\right)^d\|f\|_2.
$$`,
    sourceStatement: "The source quantifies $p\\ge2$ but uses $q$ in the inequality.",
    statementNote: "NisabaDB normalizes the quantified exponent to $q\\ge2$.",
    idea: "Bounded degree upgrades an $L^2$ bound to the higher moments needed by Hölder's inequality.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper cites O'Donnell, Analysis of Boolean Functions, Theorem 10.21."),
      steps: [],
      sourceAttribution: "Imported from Ryan O'Donnell, Analysis of Boolean Functions (2014), Theorem 10.21.",
    },
    tags: ["imported", "hypercontractivity"],
  }),
  statement({
    id: "BKLM_I12",
    localLabel: "Theorem 2.12",
    kind: "imported-result",
    title: "Hypercontractivity on balanced multislices",
    section: "2.3 Hypercontractivity",
    lineStart: 1024,
    dependencies: ["BKLM_D01", "BKLM_D02"],
    exactStatement: String.raw`For every $c>0$, degree $d$, and integer $q$, there are $N,C>0$ such that if $n\ge N$, $\mathcal U_{\vec k}$ is $c$-balanced, and $f$ has degree at most $d$, then

$$
\|f\|_q\le C\|f\|_2.
$$`,
    idea: "The constants may depend on balance, degree, and moment order, but not on the ambient dimension.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper imports this multislice hypercontractive estimate from Filmus–Kindler–Lifshitz–Minzer."),
      steps: [],
      sourceAttribution: "Imported from Filmus, Kindler, Lifshitz, and Minzer, Hypercontractivity on the symmetric group.",
    },
    tags: ["imported", "hypercontractivity"],
  }),
  statement({
    id: "BKLM_I13",
    localLabel: "Theorem 2.13",
    kind: "imported-result",
    title: "Hoeffding–Chernoff bound",
    section: "2.4 Tail bounds",
    lineStart: 1033,
    exactStatement: String.raw`If $Z_1,\ldots,Z_n$ are independent bits with common mean $p$, then for every $\epsilon>0$,

$$
\Pr\left[\left|\sum_i Z_i-pn\right|\ge\epsilon n\right]\le2e^{-2\epsilon^2n}.
$$`,
    idea: String.raw`Independent symbol counts deviate from their means by only $O(\sqrt n)$ with exponentially decaying tails.`,
    route: {
      type: "historical",
      label: "Standard inequality",
      status: "proof-not-yet-distilled",
      proof: gapProof("The source invokes the standard tail inequality without reproducing a proof."),
      steps: [],
      sourceAttribution: "Standard Hoeffding–Chernoff inequality as stated in arXiv:2110.10725v2.",
      conceptualCost: "low",
    },
    tags: ["imported", "concentration"],
  }),
  statement({
    id: "BKLM_I16",
    localLabel: "Theorem 2.16",
    kind: "imported-result",
    title: "Chernoff bound under negative association",
    section: "2.4 Tail bounds",
    lineStart: 1059,
    exactStatement: String.raw`If $Z_1,\ldots,Z_n$ are negatively associated bits with common mean $p$, then

$$
\Pr\left[\sum_i Z_i\ge(p+\epsilon)n\right]\le e^{-2\epsilon^2n}.
$$`,
    sourceStatement: "The theorem display says the bits are negatively correlated, while Definition 2.14 and the cited proposition use negative association.",
    statementNote: "NisabaDB records the stronger, proof-relevant negative-association hypothesis.",
    idea: "Sampling without replacement retains the upper-tail bound needed for multislice histograms.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper cites Dubhashi–Ranjan, Proposition 5."),
      steps: [],
      sourceAttribution: "Imported from Dubhashi and Ranjan, Balls and bins: A study in negative dependence, Proposition 5.",
      conceptualCost: "moderate",
    },
    tags: ["imported", "concentration", "negative-association"],
  }),
  statement({
    id: "BKLM_I14",
    localLabel: "External input to Lemma B.3",
    kind: "imported-result",
    title: "One-coordinate connected-kernel contraction",
    section: "Appendix B.1 Contraction of high degrees",
    lineStart: 4252,
    dependencies: ["BKLM_D04"],
    exactStatement: String.raw`Let $\mu$ be a connected law on $[m]\times[m]$ with equal marginal $\nu$, and assume every positive atom has mass at least $\alpha$. Its conditional-expectation operator contracts the mean-zero subspace by a factor at most

$$
1-\frac{\alpha^2}{2}.
$$`,
    idea: "Connectivity plus a lower bound on positive edge weights gives a dimension-free one-coordinate spectral gap.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The appendix cites this as Lemma 2.9 of Mossel (2010) and does not reproduce its proof."),
      steps: [],
      sourceAttribution: "Imported in Appendix B as Lemma 2.9 of Elchanan Mossel, Gaussian bounds for noise correlation of functions (2010).",
    },
    tags: ["imported", "spectral-gap", "product-space"],
  }),
  statement({
    id: "BKLM_I19",
    localLabel: "Claim 6.12 from FOW inputs",
    kind: "imported-result",
    title: "Degree-weighted bound for multislice influence",
    section: "6.1 Noisy influences",
    lineStart: 2973,
    dependencies: ["BKLM_D02", "BKLM_D10", "BKLM_D12"],
    exactStatement: String.raw`For every $f:\mathcal U_{\vec k}\to\mathbb R$,

$$
I[f]\le\sum_{d>0}d\,\|f^{=d}\|_2^2.
$$`,
    idea: "The transposition Laplacian has eigenvalue at most proportional to partition height, which is exactly multislice degree.",
    route: {
      type: "historical",
      label: "Literature reduction",
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper derives the claim from inequality (32) and Corollary 21 of Filmus--O'Donnell--Wu after lifting the function to $S_n$; those external estimates have not been independently distilled."),
      steps: [],
      sourceAttribution: "Derived in the pinned paper from Filmus, O'Donnell, and Wu, A log-Sobolev inequality for the multislice, with applications (2019), inequality (32) and Corollary 21.",
    },
    tags: ["imported", "influence", "multislice"],
  }),
];

const invarianceResults = [
  statement({
    id: "BKLM_L01",
    localLabel: "Lemma 1.6",
    kind: "lemma",
    title: "Low-degree coupling invariance",
    section: "1.1 The multislice",
    importance: "hero",
    lineStart: 287,
    dependencies: ["BKLM_D01", "BKLM_D02", "BKLM_D03"],
    exactStatement: String.raw`Let $f:\mathcal U_{\vec k}\to\mathbb R$ have degree at most $d$, and let $\mathcal C,\mathcal C'$ be $(\alpha,\zeta)$-couplings between the multislice and its product analogue. Then

$$
\mathbb E_{(\mathbf x,\mathbf y)\sim\mathcal C'}
\left(f(\mathbf x)-T_{\mathcal C}f(\mathbf y)\right)^2
\le 8\sqrt{d\zeta}\,\|f\|_2^2.
$$`,
    sourceStatement: "Claim 3.8 in the source turns the coupling's unconditional per-coordinate mismatch bound into the same bound after conditioning on an arbitrary multislice point.",
    statementNote: String.raw`That conditioning step is invalid under Definition 1.5. For example, take $m=2$, $n=1000$, $\vec k=(1,999)$, $\alpha=10^{-3}$, and let both couplings make the multislice point and its Bernoulli product analogue independent. Then $\zeta=2\alpha(1-\alpha)$ and the tail condition is vacuous, but for $f(x)=1_{\{x_1=1\}}$ the claimed left side is $\alpha(1-\alpha)$ while the right side is only $8\sqrt{2\alpha(1-\alpha)}\,\alpha$. A repair appears available after adding the absent hypothesis $\min_a k_a/n\ge\alpha$: symmetry and this balance bound the symbol-conditioned mismatch by $\zeta/\alpha$, yielding the weaker factor $8\sqrt{d\zeta/\alpha}$. Theorem 1.11 has this extra balance hypothesis, but Lemma 1.6 as printed does not.`,
    idea: "A symmetric coupling acts almost like the identity on every fixed low-degree representation.",
    route: {
      status: "proof-not-yet-distilled",
      conceptualCost: "high",
      proof: gapProof("The operator decomposition is explicit, but Claim 3.8's pointwise $2d\\zeta$ estimate does not follow from the unconditional mismatch clause and the displayed lemma has a concrete counterexample. An $\\alpha$-dependent weakening appears to repair the later applications only after adding a balance hypothesis absent from this lemma, and it has not been substituted for the source statement."),
      steps: [
        step("L01-S1", "Rewrite the mean-square coupling error using the multislice measure and transfer operator, reducing it to the quadratic form of an error operator.", ["BKLM_D01", "BKLM_D03"]),
        step("L01-S2", "Use simultaneous-coordinate symmetry to show that the operator preserves the junta filtration and each pure-degree space.", ["BKLM_D02", "BKLM_D03"]),
        step("L01-S3", "Represent a degree-at-most-$d$ eigenvector by a $d$-junta and bound the chance that the coupling changes its relevant coordinates by $2d\\zeta$.", ["BKLM_D02", "BKLM_D03"]),
        step("L01-S4", "Apply the source's maximum-principle eigenvalue bound and Parseval to obtain $8\\sqrt{d\\zeta}\\|f\\|_2^2$.", []),
      ],
    },
    tags: ["low-degree", "invariance", "coupling", "gap", "source-mismatch", "counterexample"],
  }),
  statement({
    id: "BKLM_L03",
    localLabel: "Lemma 3.11",
    kind: "lemma",
    title: "Strong contraction of high degrees on connected multislices",
    section: "3.3 Strong contraction for high-degree functions",
    importance: "hero",
    lineStart: 1512,
    dependencies: ["BKLM_D01", "BKLM_D02", "BKLM_D04", "BKLM_D12", "BKLM_I05", "BKLM_I13", "BKLM_I16"],
    exactStatement: String.raw`For every $\alpha>0$ and alphabet size $m$, there are $\delta,C>0$ such that, whenever $\mathcal U_{\vec k}$ is $\alpha$-balanced, $\mu$ is a connected $\alpha$-admissible self-coupling of $\mathcal U_{\vec k}$, and $\mu$ admits the required coupling to its product analogue, then for every $d$ and $f\in V_{>d}(\mathcal U_{\vec k})$,

$$
\|T_\mu f\|_2\le C(1+\delta)^{-d}\|f\|_2.
$$`,
    sourceStatement: "The pinned source writes $f\\in V_{>d}(\\mathcal U_{\\vec k'})$ although only $\\mathcal U_{\\vec k}$ is introduced in the lemma. Remark 3.12 also reduces a nonsymmetric operator to $T_\\mu^*T_\\mu$ and merely says the original coupling naturally induces one for the composed self-law.",
    statementNote: "NisabaDB treats the prime on $\\vec k'$ as a typographical error and uses the operator's declared domain $\\mathcal U_{\\vec k}$. The claimed induced coupling is a separate unresolved quantitative bridge: its symmetry, marginals, mismatch, connectedness, and atom bounds are needed by the contraction proof but are not established.",
    idea: "The paper combines representation multiplicity, a trace bound, and a restriction-to-$3d$ argument to force exponential spectral decay.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("This is the longest technical lemma in the paper. Before its representation-theoretic argument, the nonsymmetric case uses an unproved induced-coupling bridge for $T_\\mu^*T_\\mu$. The remaining proof splits linear and sublinear degrees, uses symmetric-group irreducible dimension bounds, bounds traces of high powers, and then localizes a junta to $3d$ coordinates; those estimates have not yet been compressed line by line."),
      steps: [],
    },
    tags: ["high-degree", "spectral-contraction", "representation-theory", "gap"],
  }),
  statement({
    id: "BKLM_L04",
    localLabel: "Lemma 3.25",
    kind: "lemma",
    title: "Transfer almost commutes with degree truncation",
    section: "3.6 Transfer and truncation",
    importance: "major",
    lineStart: 2208,
    dependencies: ["BKLM_D01", "BKLM_D02", "BKLM_D03", "BKLM_D13"],
    exactStatement: String.raw`If $\mathcal C$ is an $(\alpha,\zeta)$-coupling between $\mathcal U_{\vec k}$ and its product analogue, then for every $f$ and $d$,

$$
\left\|(T_{\mathcal C}f)^{\le d}-T_{\mathcal C}(f^{\le d})\right\|_2
\le O\!\left(d^{7/4}\alpha^{-1/4}\zeta^{1/4}\|f\|_2\right).
$$`,
    idea: "A pure multislice degree becomes an approximate eigenspace of product noise after transfer; separating the noise eigenvalues recovers the truncation.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The source supplies a full proof through approximate noise eigenvectors and a degree-separation calculation, but the chain of operator estimates has not yet been independently compressed."),
      steps: [],
    },
    tags: ["degree", "transfer-operator", "gap"],
  }),
  statement({
    id: "BKLM_L09",
    localLabel: "Lemma B.3",
    kind: "lemma",
    title: "Product-space high-degree contraction",
    section: "Appendix B.1 Contraction of high degrees",
    importance: "major",
    lineStart: 4301,
    dependencies: ["BKLM_D04", "BKLM_D13", "BKLM_I14"],
    exactStatement: String.raw`For every $\alpha>0$ there is $\beta>0$ such that, if a one-coordinate law $\mu$ on $[m]\times[m]$ is connected, has equal marginals $\nu$, and every positive atom has probability at least $\alpha$, then for
$T=T_\mu^{\otimes n}$ and every product-space $f\in V_{>d}$,

$$
\|Tf\|_{2,\nu^{\otimes n}}\le(1-\beta)^d\|f\|_{2,\nu^{\otimes n}}.
$$`,
    sourceStatement: "The source quantifies an $\\epsilon>0$ but uses an unquantified $\\beta$ in the conclusion.",
    statementNote: "NisabaDB uses $\\beta$ for the positive spectral-gap constant supplied by the preceding one-coordinate claim.",
    idea: "A one-coordinate spectral gap tensorizes: every Efron--Stein component above degree $d$ is contracted in more than $d$ coordinates.",
    route: {
      status: "proof-not-yet-distilled",
      type: "historical",
      label: "Literature plus source tensorization",
      proof: gapProof("The tensorization argument is proved in the appendix, but its one-coordinate spectral-gap input remains an imported, not-yet-distilled dependency."),
      steps: [],
      sourceAttribution: "The appendix combines the displayed Mossel one-coordinate contraction input with an in-paper Efron--Stein tensorization.",
    },
    tags: ["product-space", "high-degree", "spectral-gap", "gap"],
  }),
  statement({
    id: "BKLM_T03",
    localLabel: "Theorem 3.10",
    kind: "theorem",
    title: "Bilinear multislice invariance",
    section: "3.2 The bilinear case",
    importance: "major",
    lineStart: 1422,
    dependencies: ["BKLM_D02", "BKLM_D03", "BKLM_D04", "BKLM_D13", "BKLM_L01", "BKLM_L03", "BKLM_L04", "BKLM_L09"],
    exactStatement: String.raw`Under the balancedness, connectedness, admissibility, and coupling hypotheses for two multislices and their product analogue, for every $\epsilon>0$ the coupling quality can be chosen so that

$$
\left|\mathbb E_\mu[f(\mathbf x)g(\mathbf x')]
-\mathbb E_{\widetilde\mu}[T_{\mathcal C}f(\mathbf y)T_{\mathcal C'}g(\mathbf y')]\right|
\le\epsilon\|f\|_2\|g\|_2.
$$`,
    sourceStatement: "To control a high-degree term, the source composes the transfer operator with its adjoint, identifies the composition with an induced self-coupling, and says that the original coupling naturally induces one for this new law with similar parameters.",
    statementNote: "The source does not construct or quantify that induced coupling. Since applying Lemma 3.11 depends on its symmetry, marginals, mismatch, connectedness, and atom bounds, NisabaDB leaves the bilinear route uncertified pending that bridge.",
    idea: "Cut both functions at degree $d$: contraction kills the high parts, transfer/truncation alignment matches the low parts, and Lemma 1.6 compares those low parts.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The low/high-degree decomposition and final parameter choice are explicit, but suppressing a multislice high-degree term passes through $T_\\mu^*T_\\mu$ and an induced self-coupling whose required parameters are only asserted, not established, in the source."),
      steps: [
        step("T03-S1", "Use the multislice and product degree decompositions, admissibility, connectedness, and the transfer couplings to form comparable low- and high-degree parts.", ["BKLM_D02", "BKLM_D03", "BKLM_D04", "BKLM_D13"]),
        step("T03-S2", "Suppress multislice high-degree terms exponentially.", ["BKLM_L03"]),
        step("T03-S3", "Suppress product-side high-degree terms exponentially.", ["BKLM_L09"]),
        step("T03-S4", "Align the two notions of truncation across transfer.", ["BKLM_L04"]),
        step("T03-S5", "Compare the surviving low-degree terms and choose $d$ before $\\zeta$.", ["BKLM_L01"]),
      ],
    },
    tags: ["bilinear", "invariance", "gap", "alignment-pending"],
  }),
  statement({
    id: "BKLM_C04",
    localLabel: "Claim 4.1",
    kind: "proposition",
    title: "Multislice multilinear truncation",
    section: "4.1 The multilinear invariance theorem",
    lineStart: 2420,
    dependencies: ["BKLM_D02", "BKLM_D03", "BKLM_D04", "BKLM_L03", "BKLM_I12"],
    exactStatement: String.raw`For a suitably nested choice $d_1\le\cdots\le d_r$ under Theorem 1.11's hypotheses,

$$
\left|\mathbb E_\mu\prod_{i=1}^r f_i-\mathbb E_\mu\prod_{i=1}^r f_i^{\le d_i}\right|\le\epsilon/3.
$$`,
    sourceStatement: "The source represents each telescoping high-degree term using $T_{j+1}^*T_{j+1}$ and says one may easily construct an induced coupling for the resulting self-law. Its displayed Cauchy--Schwarz estimate takes a square root of the contraction term, but two later lines print the unsquared decay exponent.",
    statementNote: "No construction verifies that the induced law and coupling satisfy every hypothesis needed by Lemma 3.11. The displayed estimate also yields decay $(1+\\delta)^{-d/2}$, not $(1+\\delta)^{-d}$ as later printed; either rate still suffices for the conclusion. NisabaDB records the intended telescoping argument but does not certify the missing bridge.",
    idea: "Replace one factor at a time; strong contraction controls the replaced high part and hypercontractivity controls the other truncated factors.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The telescoping and hypercontractive estimates are explicit, but applying high-degree contraction requires an induced self-law and coupling for $T_{j+1}^*T_{j+1}$. The source calls that coupling easy to construct without proving the required quantitative properties."),
      steps: [
        step("C04-S1", "Use the admissible joint law, transfer-operator setup, and degree decomposition to telescope through the $r$ factors.", ["BKLM_D02", "BKLM_D03", "BKLM_D04"]),
        step("C04-S2", "Apply strong contraction to the current high-degree tail.", ["BKLM_L03"]),
        step("C04-S3", "Use Hölder and multislice hypercontractivity on the remaining factors.", ["BKLM_I12"]),
      ],
    },
    tags: ["multilinear", "truncation", "gap", "alignment-pending"],
  }),
  statement({
    id: "BKLM_C05",
    localLabel: "Claim 4.2",
    kind: "proposition",
    title: "Product multilinear truncation",
    section: "4.1 The multilinear invariance theorem",
    lineStart: 2511,
    dependencies: ["BKLM_D03", "BKLM_D04", "BKLM_D13", "BKLM_L09", "BKLM_I11"],
    exactStatement: String.raw`For the same degree sequence,

$$
\left|\mathbb E_{\widetilde\mu}\prod_{i=1}^rT_{\mathcal C_i}f_i
-\mathbb E_{\widetilde\mu}\prod_{i=1}^r(T_{\mathcal C_i}f_i)^{\le d_i}\right|
\le\epsilon/3.
$$`,
    idea: "It is the product-space twin of Claim 4.1.",
    route: {
      status: "complete",
      proof: "Repeat Claim 4.1's telescoping argument on the product analogue. If $\\pi(a,b)$ is the relevant one-coordinate joint law, the self-composition has kernel $\\kappa(a,a')=\\sum_b \\pi(a,b)\\pi(a',b)/\\pi_B(b)$ and $T_j^*T_j=T_{\\kappa}^{\\otimes n}$. Connectedness of the bipartite support makes the two-step graph on $a$ connected, and each positive kernel atom is at least the square of the original atom bound, so Lemma B.3 applies. Product hypercontractivity controls the truncated factors, and conditional expectation is an $L^p$ contraction, so transferred functions retain the required moment bounds.",
      steps: [
        step("C05-S1", "Telescope the transferred factors using the product Efron–Stein decomposition under the product analogue of the admissible joint law.", ["BKLM_D03", "BKLM_D04", "BKLM_D13"]),
        step("C05-S2", "Identify the tensor-product self-composition kernel and use product high-degree contraction.", ["BKLM_L09"]),
        step("C05-S3", "Bound low-degree moments by product hypercontractivity.", ["BKLM_I11"]),
      ],
    },
    tags: ["multilinear", "product-space", "truncation"],
  }),
  statement({
    id: "BKLM_C06",
    localLabel: "Claim 4.3",
    kind: "proposition",
    title: "Low-degree multilinear hybrid",
    section: "4.1 The multilinear invariance theorem",
    lineStart: 2527,
    dependencies: ["BKLM_D03", "BKLM_D04", "BKLM_L01", "BKLM_L04", "BKLM_I11", "BKLM_I12"],
    exactStatement: String.raw`For the same degree sequence,

$$
\left|\mathbb E_\mu\prod_{i=1}^r f_i^{\le d_i}
-\mathbb E_{\widetilde\mu}\prod_{i=1}^r(T_{\mathcal C_i}f_i)^{\le d_i}\right|
\le\epsilon/3.
$$`,
    sourceStatement: "The source proof invokes Lemma 1.6 with its printed mismatch bound in the mean-square estimate for each changed factor.",
    statementNote: "Lemma 1.6 is false as printed, but Claim 4.3 is under Theorem 1.11's fixed $\\alpha$-balance hypothesis. The apparent repaired bound $8\\sqrt{d\\zeta/\\alpha}$ therefore still tends to zero as the coupling accuracy is chosen, so the hybrid route is complete relative to that explicitly unresolved prerequisite rather than an unconditional certification of Lemma 1.6.",
    idea: "A coupling hybrid swaps one low-degree factor at a time; transfer/truncation commutation and low-degree invariance make each swap small.",
    route: {
      status: "complete",
      proof: "Couple $\\mu$ to $\\widetilde\\mu$ and telescope between the two products. Cauchy--Schwarz splits each hybrid error. Lemma 3.25 first replaces $(T_{\\mathcal C_i}f_i)^{\\le d_i}$ by $T_{\\mathcal C_i}(f_i^{\\le d_i})$; Lemma 1.6 then bounds its mean-square discrepancy from $f_i^{\\le d_i}$. Hölder and the two hypercontractive estimates uniformly bound the product of the untouched factors. Take $\\zeta$ small and sum.",
      steps: [
        step("C06-S1", "Telescope along the coupling between the admissible joint law and its product analogue.", ["BKLM_D03", "BKLM_D04"]),
        step("C06-S2", "Move degree truncation through transfer.", ["BKLM_L04"]),
        step("C06-S3", "Apply low-degree coupling invariance to the changed factor.", ["BKLM_L01"]),
        step("C06-S4", "Use hypercontractivity and sum the hybrid errors.", ["BKLM_I11", "BKLM_I12"]),
      ],
    },
    tags: ["multilinear", "hybrid", "low-degree", "alignment-pending"],
  }),
  statement({
    id: "BKLM_T01",
    localLabel: "Theorem 1.11",
    kind: "theorem",
    title: "Multilinear invariance principle for the multislice",
    section: "1.1 Main result",
    importance: "hero",
    lineStart: 345,
    dependencies: ["BKLM_C04", "BKLM_C05", "BKLM_C06"],
    exactStatement: String.raw`Fix $\alpha\in(0,1)$, $M,r,m_1,\ldots,m_r$, and $\epsilon>0$. For all sufficiently large $n$, if the component multislices are $\alpha$-balanced, the component transfer couplings and a coupling from a connected $\alpha$-admissible joint law $\mu$ to its product analogue $\widetilde\mu$ have sufficiently small mismatch, then every collection with $\|f_i\|_{2r}\le M$ satisfies

$$
\left|
\mathbb E_{\mu}\prod_{i=1}^r f_i(\mathbf x(i))
-\mathbb E_{\widetilde\mu}\prod_{i=1}^r T_{\mathcal C_i}f_i(\mathbf y(i))
\right|\le\epsilon.
$$`,
    sourceStatement: "The Section 4 proof invokes Lemma 1.6 with its printed mismatch bound.",
    statementNote: "Lemma 1.6 is false under the paper's coupling definition as printed. Its apparent repair loses a factor depending on the fixed balance parameter $\\alpha$; because Theorem 1.11 already chooses coupling accuracy after fixing $\\alpha$, that weaker bound appears sufficient, but the source does not carry out the repaired proof. NisabaDB therefore marks only this theorem's top-level three-claim combination complete, relative to unresolved prerequisites.",
    idea: "Both expectations are reduced to the same low-degree middle expression.",
    route: {
      status: "complete",
      conceptualCost: "moderate",
      proof: "Claim 4.1 changes the multislice expression to its degree-truncated version with error at most $\\epsilon/3$. Claim 4.3 moves that truncated expression across the coupling with another $\\epsilon/3$. Claim 4.2 restores the full transferred product expression with the final $\\epsilon/3$. The triangle inequality proves the theorem.",
      steps: [
        step("T01-S1", "Truncate the multislice expression.", ["BKLM_C04"]),
        step("T01-S2", "Transport the low-degree expression to the product analogue.", ["BKLM_C06"]),
        step("T01-S3", "Undo truncation on the product side and add the three errors.", ["BKLM_C05"]),
      ],
    },
    tags: ["main-theorem", "invariance", "multilinear"],
  }),
];

const applicationResults = [
  statement({
    id: "BKLM_T04",
    localLabel: "Theorem 4.4",
    kind: "theorem",
    title: "Invariance for label assignments",
    section: "4.2 Invariance for label assignments",
    importance: "major",
    lineStart: 2605,
    dependencies: ["BKLM_D05", "BKLM_T01"],
    exactStatement: String.raw`Under Theorem 1.11's balancedness, admissibility, connectedness, and coupling hypotheses, let $f_i:\mathcal U_{\vec k(i)}\to[m_i]$ and $P:\prod_i[m_i]\to[-1,1]$. Then, for sufficiently accurate couplings,

$$
\left|\mathbb E_\mu P(f_1(\mathbf x(1)),\ldots,f_r(\mathbf x(r)))
-\mathbb E_{\widetilde\mu}\widetilde P(T_{\mathcal C_1}f_1(\mathbf y(1)),\ldots,T_{\mathcal C_r}f_r(\mathbf y(r)))\right|
\le\epsilon.
$$`,
    sourceStatement: "The source's first expectation ends with $f_1(\\mathbf x(r))$, repeating the first function in the last slot.",
    statementNote: "NisabaDB restores the indexed family $f_1,\\ldots,f_r$, as required by the theorem's setup and proof.",
    idea: "Expand the multilinear predicate into scalar coordinate indicators and invoke Theorem 1.11 once for every label tuple.",
    route: {
      status: "complete",
      conceptualCost: "low",
      proof: "Embed each label as a simplex vertex. Expand $\\widetilde P$ over all $m_1\\cdots m_r$ label tuples. Every summand is a product of scalar indicator coordinates bounded in every $L^p$ norm by $1$. Apply Theorem 1.11 with tolerance $\\epsilon/(m_1\\cdots m_r)$ to each summand, multiply by $|P|\\le1$, and sum.",
      steps: [
        step("T04-S1", "Embed labels into simplices and expand the predicate multilinearly.", ["BKLM_D05"]),
        step("T04-S2", "Apply scalar multilinear invariance to each label tuple.", ["BKLM_T01"]),
        step("T04-S3", "Sum at most $m_1\\cdots m_r$ errors.", []),
      ],
    },
    tags: ["label-assignment", "PCP", "invariance"],
  }),
  statement({
    id: "BKLM_P04",
    localLabel: "Proposition 4.6",
    kind: "proposition",
    title: "Coupling a negatively associated multislice law to its product analogue",
    section: "4.3 Construction of a useful coupling",
    importance: "major",
    lineStart: 2666,
    dependencies: ["BKLM_D03", "BKLM_D04", "BKLM_D06", "BKLM_I13", "BKLM_I16"],
    exactStatement: String.raw`For fixed $\alpha,r,m_1,\ldots,m_r$, there are $\alpha',K>0$ such that every $\alpha$-admissible, negatively correlated law $\mu$ on a product of $\alpha$-balanced multislices has an

$$
\left(\alpha',\frac{K}{\sqrt n}\right)\text{-coupling}
$$

with its product analogue $\widetilde\mu$.`,
    sourceStatement: "In the proof, the source changes two histogram error bounds into the equality $|k_{\\vec a}-r_{\\vec a}|=2m\\epsilon'n$.",
    statementNote: "The proof only needs and only establishes the corresponding upper bound; NisabaDB records this as a proof-text typo, not a change to the proposition.",
    idea: "Sample both joint histograms, lay their symbol blocks along the same random coordinate order, and use concentration to show that only block boundaries disagree.",
    route: {
      status: "complete",
      proof: "Sample the joint-symbol counts $k_{\\vec a}$ under $\\mu$ and $r_{\\vec a}$ under $\\widetilde\\mu$. In one random coordinate order, place constant-symbol blocks of the two respective lengths. This produces the correct symmetric marginals. Negative-association and independent Chernoff bounds put every count within $O(\\epsilon n)$ of its mean with exponentially high probability, so the union of block-boundary symmetric differences has size below $\\epsilon n$. Second-moment bounds give expected total disagreement $O(\\sqrt n)$; symmetry turns this into coordinate mismatch $O(1/\\sqrt n)$.",
      steps: [
        step("P04-S1", "Use the admissible law and coupling definition to sample the two histograms and align their symbol blocks by one random permutation.", ["BKLM_D03", "BKLM_D04"]),
        step("P04-S2", "Use negative association to concentrate the multislice and product histograms.", ["BKLM_D06", "BKLM_I13", "BKLM_I16"]),
        step("P04-S3", "Bound boundary displacement to obtain the global tail condition.", []),
        step("P04-S4", "Use the $O(\\sqrt n)$ expected displacement and symmetry for the coordinatewise condition.", []),
      ],
    },
    tags: ["coupling", "negative-association", "concentration"],
  }),
  statement({
    id: "BKLM_T05",
    localLabel: "Theorem 5.2",
    kind: "theorem",
    title: "Invariance under high-degree annihilation",
    section: "5 Beyond connected distributions",
    importance: "major",
    lineStart: 2769,
    dependencies: ["BKLM_D03", "BKLM_D07", "BKLM_D13", "BKLM_L01", "BKLM_L04", "BKLM_I11", "BKLM_I12", "BKLM_C04", "BKLM_C05", "BKLM_C06"],
    exactStatement: String.raw`Let $\mu_n$ be joint laws on products of balanced multislices, with product analogues $\widetilde\mu_n$. If both sequences annihilate high-degree functions, then for every $\epsilon>0$, all sufficiently large $n$, sufficiently accurate component and joint couplings, and all $f_i:\mathcal U_{\vec k(i)}\to[-1,1]$,

$$
\left|\mathbb E_{\mu_n}\prod_i f_i-\mathbb E_{\widetilde\mu_n}\prod_iT_{\mathcal C_i}f_i\right|\le\epsilon.
$$`,
    idea: "The proof architecture of Theorem 1.11 only needs high-degree terms to vanish; connectedness was one sufficient mechanism.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The paper explicitly omits the proof, saying to replace the two contraction lemmas in Section 4 by the annihilation assumptions. The adaptation still needs the product and multislice hypercontractive estimates and the three Section 4 truncation/hybrid claims; a full quantifier-by-quantifier argument is not supplied."),
      steps: [],
    },
    tags: ["annihilation", "invariance", "source-omitted-proof", "gap"],
  }),
  statement({
    id: "BKLM_L06",
    localLabel: "Lemma 6.13",
    kind: "lemma",
    title: "Total noisy influence is dimension-free",
    section: "6.1 Noisy influences",
    importance: "major",
    lineStart: 3002,
    dependencies: ["BKLM_D10", "BKLM_I19", "BKLM_L03", "BKLM_P04"],
    exactStatement: String.raw`If $0<\beta\le\alpha<1$, $\mathcal U_{\vec k}\subseteq[m]^n$ is $\alpha$-balanced, and $\beta n$ is integral, then every $f:\mathcal U_{\vec k}\to\mathbb R$ satisfies

$$
I^{(\beta)}[f]\le O_{m,\beta}(\|f\|_2^2).
$$`,
    sourceStatement: "The source proof calls the joint law of the input and its multislice-noised output $\\beta$-admissible for every $0<\\beta\\le\\alpha$.",
    statementNote: "The admissibility assertion is false at the stated boundary: its positive atoms include $\\beta$ and $k_a/n-\\beta$, and the latter can lie strictly between $0$ and $\\beta$. The sufficient restriction $\\beta\\le\\alpha/2$ would repair that step, but it is not in the lemma.",
    idea: "Noise contracts degree $d$ exponentially, while the transposition influence operator costs only a factor linear in $d$.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The intended spectral summation is clear, and the external transposition-Laplacian input is recorded as Claim 6.12. However, the source applies its contraction lemma after asserting $\\beta$-admissibility of the noise pair law; that assertion fails when some positive atom $k_a/n-\\beta$ is smaller than $\\beta$. The argument works under the stronger restriction $\\beta\\le\\alpha/2$, but NisabaDB does not silently add that hypothesis to the theorem."),
      steps: [
        step("L06-S1", "Use the multislice noise definition and the transposition-Laplacian input to bound total noisy influence by the degree-weighted spectral mass.", ["BKLM_D10", "BKLM_I19"]),
        step("L06-S2", "Identify multislice noise as a connected admissible operator and construct its product coupling.", ["BKLM_P04"]),
        step("L06-S3", "Apply high-degree contraction on each pure degree and sum the convergent series.", ["BKLM_L03"]),
      ],
      sourceAttribution: "Audit of the source proof, including the cited Filmus--O'Donnell--Wu transposition-Laplacian input and the unresolved admissibility step.",
    },
    tags: ["noise", "influence", "dimension-free", "gap", "alignment-pending", "source-mismatch"],
  }),
  statement({
    id: "BKLM_L07",
    localLabel: "Lemma 6.16",
    kind: "lemma",
    title: "Small noisy influences survive transfer",
    section: "6.1 Noisy influences",
    importance: "hero",
    lineStart: 3172,
    dependencies: ["BKLM_D03", "BKLM_D10", "BKLM_D13", "BKLM_L01", "BKLM_L03", "BKLM_L04"],
    exactStatement: String.raw`For fixed $\tau,\alpha,m,d$, there are $\beta_0,\tau'>0$ such that, for $0<\beta\le\beta_0$, all sufficiently large $n$ with $\beta n/2\in\mathbb N$, every $\alpha$-balanced multislice $\mathcal U_{\vec k}\subseteq[m]^n$, and every $(\alpha,\zeta)$-coupling $\mathcal C$ from $\mathcal U_{\vec k}$ to $\nu_{\vec k}^{\otimes n}$ with $\zeta\le1/\log^3n$,

$$
\max_i I_i^{(\beta)}[f]\le\tau'
\quad\Longrightarrow\quad
\max_i I_i^{\le d}[T_{\mathcal C}f]\le\tau
$$

for every $f:\mathcal U_{\vec k}\to[-1,1]$.`,
    sourceStatement: "In the auxiliary Claim 6.14 used here, the source prints a positive contraction factor $(1+\\Omega_{m,\\beta}(1))^d$ where contraction requires a negative exponent. An intermediate sentence also states an $O(\\sqrt{\\zeta+\\zeta'})$ bound, while the displayed derivation gives a fourth-root dependence.",
    statementNote: "Claim 6.14 must use $(1+\\Omega_{m,\\beta}(1))^{-d}$ and propagate that negative exponent. The surrounding proof also has a fourth-root/square-root mismatch and later influence terms that drop the noise operator. NisabaDB therefore does not certify the route.",
    idea: "Smooth first, transport the smoothed function, and then show that low product degrees cannot distinguish this from transporting first.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("Although the paper contains a long proof and auxiliary claims, Claim 6.14's contraction-sign error, the recorded fourth-root/square-root mismatch, and dropped noise operators must be reconciled before a complete route can be asserted."),
      steps: [],
    },
    tags: ["noise", "influence", "transfer", "gap"],
  }),
  statement({
    id: "BKLM_L08",
    localLabel: "Lemma 6.21",
    kind: "lemma",
    title: "A random two-to-one projection preserves a high noisy influence",
    section: "6.2 Projection of a high influence",
    importance: "hero",
    lineStart: 3503,
    dependencies: ["BKLM_D01", "BKLM_D10", "BKLM_D11", "BKLM_L06"],
    exactStatement: String.raw`Fix $\tau',\alpha>0$ and $m$. There are $\beta_1,\tau''>0$ and $N$ such that, for $n\ge N$, $0<\beta\le\beta_1$ with $\beta n/2\in\mathbb N$, an $\alpha$-balanced multislice with even histogram $\vec k$, and $f:\mathcal U_{\vec k}\to[-1,1]$,

$$
I_i^{(\beta)}[f]\ge\tau'
\quad\Longrightarrow\quad
\Pr_{\boldsymbol\pi}\!\left[
I_{\boldsymbol\pi(i)}^{(\beta)}[f|_{\boldsymbol\pi}]\ge\tau''
\right]\ge\tau''.
$$`,
    sourceStatement: "The source statement quantifies $\\alpha$ but does not state that the multislice is $\\alpha$-balanced, while an earlier global convention requires $\\beta n/2$ to be integral so noise is defined on both $\\mathcal U_{\\vec k}$ and $\\mathcal U_{\\vec k/2}$.",
    statementNote: "NisabaDB restores $\\alpha$-balance because the proof repeatedly invokes it and makes the global integrality convention explicit. The source proof also mixes $\\beta_0,\\beta_1$ and once uses an undefined $g$.",
    idea: "Average influence over random pairings, control its second moment, and use the dimension-free total-influence bound to obtain a constant-probability lower bound.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The source supplies a multi-claim proof, but the missing balance hypothesis and variable-name inconsistencies require a fresh audit before the projection argument can be certified."),
      steps: [],
    },
    tags: ["projection", "influence", "two-to-one", "gap"],
  }),
  statement({
    id: "BKLM_T06",
    localLabel: "Theorem 6.7",
    kind: "theorem",
    title: "From connected dictatorship tests to conditional hardness",
    section: "6 Applications to hardness",
    importance: "hero",
    lineStart: 2888,
    dependencies: ["BKLM_A01", "BKLM_D09", "BKLM_T04", "BKLM_P04", "BKLM_L06", "BKLM_L07", "BKLM_L08"],
    exactStatement: String.raw`Let $\mathcal P$ be a collection of $r$-ary predicates over $[m]$. If $\mathcal P$ has a connected $(1,s)$ dictatorship test, then, assuming the Rich 2-to-1 Games Conjecture, for every $\epsilon>0$,

$$
\mathsf{Gap}\text{-}\mathcal P[1,s+\epsilon]
$$

is NP-hard.`,
    sourceStatement: "The theorem display writes the test family as $\\{\\mathcal D(t)\\}_{t\\in\\mathcal T}$. In the proof, an application of Theorem 4.4 repeats $\\mathcal C_1$ where the component couplings must be indexed by $i$, declares the exact-statistics lift connected without proof, and says a random incident projection is uniform over all two-to-one maps.",
    statementNote: "Definition 6.6 indexes test laws by both $t$ and $P$, and the coupling display must use $\\mathcal C_i$. Two bridge arguments are missing: connectedness of the exact-statistics lift before Theorem 4.4, and passage from uniform unlabeled fiber partitions in Definition 1.16 to the projection event used in decoding. Both appear repairable (respectively by a line-graph connectivity argument and equivariance under relabeling the projection output), but the source supplies neither proof.",
    idea: "Use exact-statistics multislice clouds so two-to-one projections preserve measure; invariance exposes influential coordinates, and short influence lists decode the Rich game.",
    route: {
      status: "proof-not-yet-distilled",
      conceptualCost: "specialist",
      proof: gapProof("The source outlines the standard multislice-cloud and influence-list reduction, but it does not prove connectedness of the exact-statistics lift used by Theorem 4.4. Its final decoding sentence also replaces uniformity of the induced unlabeled pair partition by uniformity of the full two-to-one map. The latter event appears equivariant under output relabeling, so the gap need not strengthen the conjecture, but the bridge is absent. Until both lemmas are supplied, the route is not certified."),
      steps: [
        step("T06-S1", "Build exact-histogram multislice long-code clouds and prove perfect completeness.", ["BKLM_D09"]),
        step("T06-S2", "Transfer soundness to the product dictatorship test.", ["BKLM_T04", "BKLM_P04"]),
        step("T06-S3", "Pull low-degree product influence back to multislice noisy influence.", ["BKLM_L07"]),
        step("T06-S4", "Use bounded total noisy influence to form constant-size label lists.", ["BKLM_L06"]),
        step("T06-S5", "Transport influence through random two-to-one projections and decode.", ["BKLM_L08", "BKLM_A01"]),
      ],
    },
    tags: ["hardness", "PCP", "conditional", "dictatorship-test", "alignment-pending", "source-mismatch"],
  }),
  statement({
    id: "BKLM_T07",
    localLabel: "Theorem 6.29",
    kind: "theorem",
    title: "Hardness under high-degree annihilation",
    section: "6.3 Extension beyond connected tests",
    importance: "major",
    lineStart: 4119,
    dependencies: ["BKLM_A01", "BKLM_D07", "BKLM_D09", "BKLM_T05", "BKLM_L06", "BKLM_L07", "BKLM_L08"],
    exactStatement: String.raw`Let $\mathcal P$ admit a perfect-completeness dictatorship test. If every product test-distribution sequence and its rounded multislice analogue annihilate high-degree functions, then, assuming the Rich 2-to-1 Games Conjecture, for every $\epsilon>0$,

$$
\mathsf{Gap}\text{-}\mathcal P[1,s+\epsilon]
$$

is NP-hard.`,
    sourceStatement: "After stating Theorem 6.29, the source says that its proof follows analogously to Theorem 6.7 and omits the details.",
    statementNote: "The source omits this adaptation, and the advertised reduction inherits Theorem 6.7's missing exact-statistics connectedness and projection-equivariance bridges.",
    idea: "Replace connected-distribution invariance in Theorem 6.7 by Theorem 5.2.",
    route: {
      status: "proof-not-yet-distilled",
      proof: gapProof("The source explicitly omits the full proof as a straightforward adaptation. The omitted argument inherits both Theorem 5.2's omitted proof and Theorem 6.7's two missing bridge lemmas."),
      steps: [],
    },
    tags: ["hardness", "annihilation", "source-omitted-proof", "gap", "alignment-pending", "source-mismatch"],
  }),
  statement({
    id: "BKLM_I17",
    localLabel: "External result used for Corollary 1.18",
    kind: "imported-result",
    title: "BKT perfect-completeness dictatorship test",
    section: "6.4 Proof of the applications",
    lineStart: 4142,
    dependencies: ["BKLM_D09"],
    exactStatement: String.raw`For $r=2^m-1$, Bhangale--Khot--Thiruvenkatachari construct an $r$-ary Boolean predicate with $2r+1$ accepting assignments and a perfect-completeness test whose acceptance above

$$
\frac{2r+1}{2^r}+\epsilon
$$

forces a coordinate with nonnegligible bounded-degree influence (with parameters depending only on $\epsilon$).`,
    idea: "This supplies the concrete dictatorship test inserted into Theorem 6.7.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The external FSTTCS result is quoted and adapted to unfolded $[-1,1]$-valued functions, but its proof is outside the pinned paper."),
      steps: [],
      sourceAttribution: "Imported as used from Bhangale, Khot, and Thiruvenkatachari, An improved dictatorship test with perfect completeness (FSTTCS 2017), Theorem 1.1 and Observation 4.1.",
    },
    tags: ["imported", "dictatorship-test", "CSP"],
  }),
  statement({
    id: "BKLM_I18",
    localLabel: "External result used for Corollary 1.19",
    kind: "imported-result",
    title: "DMR three-coloring soundness input",
    section: "6.4 Proof of the applications",
    lineStart: 4194,
    dependencies: ["BKLM_D09"],
    exactStatement: "For the uniform distribution on unequal pairs of three colors, the Dinur--Mossel--Regev soundness theorem used by the paper turns a nontrivial function with negligible forbidden-pair acceptance into a coordinate of nonnegligible bounded-degree influence.",
    idea: "This is the external analytic input used to decode a large independent set.",
    route: {
      type: "historical",
      label: "Literature source",
      status: "proof-not-yet-distilled",
      proof: gapProof("The pinned paper cites DMR Theorem 3.1 and gives only the way it is used; the external theorem and its parameter translation have not been distilled."),
      steps: [],
      sourceAttribution: "Imported as used from Dinur, Mossel, and Regev, Conditional hardness for approximate coloring, SIAM Journal on Computing 39(3), Theorem 3.1.",
    },
    tags: ["imported", "graph-coloring", "soundness"],
  }),
  statement({
    id: "BKLM_C18",
    localLabel: "Corollary 1.18",
    kind: "corollary",
    title: "Conditional near-optimal Boolean CSP hardness",
    section: "1.2 Applications to hardness",
    importance: "major",
    lineStart: 546,
    dependencies: ["BKLM_A01", "BKLM_T06", "BKLM_I17"],
    exactStatement: String.raw`Assuming the Rich 2-to-1 Games Conjecture, for every $r=2^m-1$ there is a collection $\mathcal P_r$ of $r$-ary Boolean predicates such that, for all $\epsilon>0$,

$$
\mathsf{Gap\text{-}CSP}_{\mathcal P_r}
\left[1,\frac{2r+1}{2^r}+\epsilon\right]
$$

is NP-hard.`,
    idea: "Unfold the BKT test into a finite predicate family and invoke the general reduction.",
    route: {
      status: "proof-idea",
      proof: "The source randomizes the BKT predicate by all sign shifts, converts a folded test into the paper's dictatorship-test format, and verifies the same soundness through the folded part $g(x)=(f(x)-f(-x))/2$. It then invokes Theorem 6.7.",
      steps: [
        step("C18-S1", "Turn folding into a family of sign-shifted predicates.", ["BKLM_I17"]),
        step("C18-S2", "Verify perfect completeness and the $(2r+1)/2^r$ soundness threshold.", ["BKLM_I17"]),
        step("C18-S3", "Invoke the conditional hardness conversion.", ["BKLM_T06", "BKLM_A01"]),
      ],
      sourceAttribution: "Source proof compressed with one unresolved bridge: the paper does not separately verify connectedness for every BKT test distribution required by Theorem 6.7.",
    },
    tags: ["CSP", "hardness", "conditional", "alignment-pending"],
  }),
  statement({
    id: "BKLM_C19",
    localLabel: "Corollary 1.19",
    kind: "corollary",
    title: "Conditional hardness for three-colorable graphs",
    section: "1.2 Applications to hardness",
    importance: "major",
    lineStart: 562,
    dependencies: ["BKLM_A01", "BKLM_T06", "BKLM_I18"],
    exactStatement: "Assuming the Rich 2-to-1 Games Conjecture, for every $\\delta>0$ it is NP-hard to distinguish a 3-colorable graph from a graph with no independent set of fractional size $\\delta$.",
    sourceStatement: "The proof sketch says an independent-set edge forces $f(x)=0$ or $f(y)=1$.",
    statementNote: "The source explicitly labels its argument a proof sketch. It also says an independent-set edge forces $f(x)=0$ or $f(y)=1$; for an indicator of an independent set the second value must also be $0$.",
    idea: "Encode unequal colors as the test predicate; a large independent set violates product-space soundness and yields a decodable influence.",
    route: {
      status: "proof-idea",
      proof: "Use the unequal-colors predicate on three symbols in Theorem 6.7's reduction. A large independent set gives cloud indicators whose product on every unequal query pair vanishes. Invariance transfers this vanishing to the product domain. The imported DMR theorem exposes a bounded-degree influential coordinate, after which Theorem 6.7's influence-list decoding applies unchanged.",
      steps: [
        step("C19-S1", "Instantiate the reduction with the unequal-colors predicate.", ["BKLM_T06"]),
        step("C19-S2", "Convert a large independent set into vanishing forbidden-pair acceptance.", []),
        step("C19-S3", "Use DMR soundness and continue the influence-list decoding.", ["BKLM_I18", "BKLM_T06"]),
      ],
    },
    tags: ["graph-coloring", "hardness", "conditional", "proof-sketch", "alignment-pending"],
  }),
];

const canonicalResultRoots = [
  "BKLM_L01",
  "BKLM_T01",
  "BKLM_C18",
  "BKLM_C19",
  "BKLM_I05",
  "BKLM_I11",
  "BKLM_I12",
  "BKLM_I13",
  "BKLM_I16",
  "BKLM_T03",
  "BKLM_L03",
  "BKLM_L04",
  "BKLM_T04",
  "BKLM_P04",
  "BKLM_T05",
  "BKLM_T06",
  "BKLM_L06",
  "BKLM_L07",
  "BKLM_L08",
  "BKLM_T07",
  "BKLM_L09",
];

const paper = {
  id: paperId,
  title: "An Invariance Principle for the Multi-slice, with Applications",
  authors: ["Mark Braverman", "Subhash Khot", "Noam Lifshitz", "Dor Minzer"],
  date: "2025-11",
  venue: "Advances in Mathematics 480 (2025), article 110460",
  status: "gold",
  identifiers: {
    doi: "10.1016/j.aim.2025.110460",
    arxiv: "2110.10725v2",
    openAlex: "W4413142925",
    internal: "related-doi:10.1109/focs52979.2021.00030",
  },
  sourceLinks: [
    { label: "Pinned arXiv v2", url: sourceUrl },
    { label: "Pinned arXiv v2 source archive", url: "https://arxiv.org/src/2110.10725v2" },
    { label: "Journal DOI", url: "https://doi.org/10.1016/j.aim.2025.110460" },
    { label: "FOCS 2021 version", url: "https://doi.org/10.1109/FOCS52979.2021.00030" },
  ],
  contributionSummary: "Builds a quantitative invariance principle that transfers multilinear expectations from fixed-histogram multislices to product spaces, then uses noisy-influence and projection machinery to derive conditional perfect-completeness hardness results.",
  abstract: "NisabaDB's theorem map separates the analytic spine—low-degree transfer, high-degree contraction, truncation, and multilinear invariance—from the conditional Rich 2-to-1 Games reduction. It records all 21 unique numbered results, the three indispensable Section 4 claims, major definitions, imported inputs, source corrections, and explicit proof gaps.",
  abstractLicense: "Original NisabaDB summary; reusable with attribution.",
  importProvenance: [
    {
      provider: "arXiv",
      retrievedAt: importedAt,
      recordId: "2110.10725v2;source-sha256:" + sourceTarHash,
    },
    {
      provider: "Crossref",
      retrievedAt: importedAt,
      recordId: "10.1016/j.aim.2025.110460",
    },
    {
      provider: "NisabaDB source audit",
      retrievedAt: importedAt,
      recordId: "tex-sha256:" + sourceTexHash + ";pdf-sha256:" + sourcePdfHash,
    },
  ],
  license: {
    metadata: "Bibliographic metadata and original NisabaDB restatements may be redistributed with attribution.",
    fullText: "The pinned arXiv source uses the arXiv perpetual non-exclusive license, and publisher reuse evidence conflicts. NisabaDB does not republish the paper text or source archive; it publishes newly written, source-located mathematical restatements and proof audits.",
  },
  rewriteStatus: "partial-distillation",
  theoremExtractionStatus: "complete",
  formalizationStatus: "statement-only",
  version: "arXiv:2110.10725v2;tex-sha256:" + sourceTexHash,
  modificationHistory: modificationHistory(
    "Promoted the provisional record to a gold theorem-level distillation from pinned arXiv v2, including all 21 unique numbered results, the Section 4 proof spine, applications, correction notes, and honest proof gaps.",
  ),
  featured: false,
  graph: {
    mainRoot: "BKLM_T01",
    paperRoots: canonicalResultRoots,
    views: [
      {
        id: "main-invariance",
        label: "Main invariance theorem",
        roots: ["BKLM_T01"],
        initiallyExpanded: [
          "BKLM_T01",
          "BKLM_C04",
          "BKLM_C05",
          "BKLM_C06",
          "BKLM_L01",
          "BKLM_L03",
          "BKLM_L04",
          "BKLM_L09",
        ],
      },
      {
        id: "hardness",
        label: "Hardness applications",
        roots: ["BKLM_C18", "BKLM_C19", "BKLM_T07"],
        initiallyExpanded: [
          "BKLM_C18",
          "BKLM_C19",
          "BKLM_T06",
          "BKLM_T07",
          "BKLM_A01",
          "BKLM_T04",
          "BKLM_L06",
          "BKLM_L07",
          "BKLM_L08",
        ],
      },
      {
        id: "paper",
        label: "Complete numbered-result map",
        roots: canonicalResultRoots,
        initiallyExpanded: [
          "BKLM_T01",
          "BKLM_T03",
          "BKLM_T04",
          "BKLM_T05",
          "BKLM_T06",
          "BKLM_T07",
        ],
      },
    ],
  },
};

export const bklmPaperPack = {
  paper,
  statements: [
    ...definitions,
    ...importedResults,
    ...invarianceResults,
    ...applicationResults,
  ],
};
