const proof = (idea, text, steps) => ({ idea, proof: text, steps });

export const proofOverrides = {
  S01_T01: proof(
    "Amplify a perfectly complete four-query trial whose rejection probability is quadratic in the distance from dictators.",
    String.raw`Use the finite-seed model of [Definition 2.1](#statement:S02_D01) and the amplified tester supplied by [Lemma 4.7](#statement:S04_L07). For \(n<4\), query the whole (constant-size) domain. For \(n\ge 4\), run

$$
r=\left\lceil \frac{2}{c_0\epsilon^2}\right\rceil
$$

independent copies of the four-query matching-square trial and reject if any copy rejects. Lemma 4.7 preserves perfect completeness. If \(\operatorname{dist}(f,\mathcal D)\ge\epsilon\), each copy rejects with probability \(p\ge c_0\epsilon^2\), so \(rp\ge2\) and Lemma 4.7 gives

$$
\Pr[\mathrm{reject}]=1-(1-p)^r\ge 1-\frac1{1+rp}\ge\frac23.
$$

All queries can be sampled before any answer is read, so the tester is nonadaptive, and it uses \(4r=O(\epsilon^{-2})\) queries.`,
    [
      { id: "choose-tester", text: "Choose the finite-seed repeated tester and handle the constant-size ranks.", dependencyRefs: ["S02_D01"], formalDeclarationRefs: [] },
      { id: "amplify", text: "Apply independent repetition to obtain soundness 2/3, perfect completeness, and the query bound.", dependencyRefs: ["S04_L07"], formalDeclarationRefs: ["S01_Thm1_01_MainIntro"] },
    ],
  ),

  S02_L03: proof(
    "The cube characters are an orthonormal basis; Fourier inversion and Parseval are the coordinate and norm identities in that basis.",
    String.raw`For subsets \(S,T\subseteq[m]\), \(\chi_S\chi_T=\chi_{S\triangle T}\). If \(S=T\), this character is identically one. Otherwise choose a coordinate in \(S\triangle T\); pairing each cube point with the point obtained by flipping that coordinate cancels the two character values. Hence

$$
\mathbb E_x\chi_S(x)\chi_T(x)=\mathbf 1[S=T].
$$

There are \(2^m\) characters in the \(2^m\)-dimensional real vector space of functions on the cube, so this orthonormal family is a basis. Expanding \(g\) in it gives \(g=\sum_S\widehat g(S)\chi_S\), because the coefficient of \(\chi_S\) is its inner product with \(g\). Taking the squared norm of this orthogonal expansion gives Parseval:

$$
\mathbb E_x g(x)^2=\sum_{S\subseteq[m]}\widehat g(S)^2.
$$`,
    [
      { id: "orthogonality", text: "Pair cube points to prove character orthogonality.", dependencyRefs: [], formalDeclarationRefs: [] },
      { id: "basis", text: "Use the dimension count to obtain Fourier inversion and Parseval.", dependencyRefs: [], formalDeclarationRefs: ["S02_Lem2_03_CubeParseval"] },
    ],
  ),

  S03_L01: proof(
    "A matching moves any fixed point along at most one matching edge, so a dictator sees at most one cube coordinate.",
    String.raw`Use the matching-cube coordinates of [Construction 3.1](#statement:S03_D03): let \(M\) have edge transpositions \(\tau_1,\ldots,\tau_m\), put \(\tau_x=\prod_{r:x_r=1}\tau_r\), and restrict to \(g_{\pi,M}(x)=f(\pi\tau_x)\).

If \(f(\sigma)=h(\sigma(i))\) is an image dictator, then

$$
g_{\pi,M}(x)=h\bigl(\pi(\tau_x(i))\bigr).
$$

When \(i\) is unmatched this is constant. When \(i\) lies in the unique edge \(e_r\), the point \(\tau_x(i)\) depends only on \(x_r\). Thus the restriction depends on at most one bit. If \(f(\sigma)=h(\sigma^{-1}(j))\) is a preimage dictator, then

$$
g_{\pi,M}(x)=h\bigl(\tau_x(\pi^{-1}(j))\bigr),
$$

and the same unmatched/unique-edge argument applies to \(\pi^{-1}(j)\). Constants are included, so every dictator restricts to a Boolean \(1\)-junta.`,
    [
      { id: "image", text: "Use matching-cube coordinates to show that an image dictator sees at most its distinguished point's incident edge.", dependencyRefs: ["S03_D03"], formalDeclarationRefs: ["S03_Lem3_01_ImageDictatorToJunta"] },
      { id: "preimage", text: "Apply the same argument to the preimage point.", dependencyRefs: [], formalDeclarationRefs: ["S03_Lem3_01_DictatorToJunta"] },
    ],
  ),

  S03_L02: proof(
    "A mixed square derivative vanishes for every function of at most one cube coordinate.",
    String.raw`By [Lemma 3.1](#statement:S03_L01), on every sampled matching cube a dictator restricts to a Boolean \(1\)-junta \(g\). [Construction 3.1](#statement:S03_D03) assigns every matching coordinate to at most one of the trial's two disjoint directions \(u,v\). If \(g\) is constant, its alternating square sum is zero. If \(g\) depends on coordinate \(r\), then at least one of \(u_r,v_r\) is zero; pairing the two terms in the direction that does not move \(r\) again gives

$$
g(x)-g(x+u)-g(x+v)+g(x+u+v)=0.
$$

The trial therefore never rejects a dictator.`,
    [
      { id: "restrict", text: "Restrict the dictator to a one-junta on the sampled cube.", dependencyRefs: ["S03_L01"], formalDeclarationRefs: [] },
      { id: "square", text: "Use the trial's disjoint directions and rejection rule to cancel the mixed square derivative of a one-junta.", dependencyRefs: ["S03_D03", "S03_L01"], formalDeclarationRefs: ["cubeOneJunta_square_zero", "S03_Lem3_02_PerfectCompleteness"] },
    ],
  ),

  S04_L01: proof(
    "The square derivative kills Fourier levels zero and one and has a uniform multiplier on every higher level.",
    String.raw`For one character, multiplicativity gives

$$
\Delta_{u,v}\chi_S(x)=\chi_S(x)(1-\chi_S(u))(1-\chi_S(v)).
$$

For \(k=|S|\), the factor is nonzero precisely when the parities of \(u\) and \(v\) on \(S\) are both odd. Because each coordinate independently chooses \((u_r,v_r)\in\{(0,0),(1,0),(0,1)\}\), that event has probability

$$
p_k=\tfrac14\bigl(1-2\cdot3^{-k}+(-3)^{-k}\bigr).
$$

It is zero for \(k=0,1\), and \(p_k\ge2/9\) for \(k\ge2\). Expand \(g\) in the characters and apply [Lemma 2.3](#statement:S02_L03) (Parseval) in the \(x\)-variable. The expected squared derivative is

$$
16\sum_Sp_{|S|}\widehat g(S)^2
=4\sum_S\bigl(1-2\cdot3^{-|S|}+(-3)^{-|S|}\bigr)\widehat g(S)^2.
$$

The lower bound on \(p_k\), together with the truncation in [Definition 2.2](#statement:S02_D02), yields \(\mathbb E\Delta^2\ge(32/9)\lVert g-P_{\le1}g\rVert_2^2\).`,
    [
      { id: "character", text: "Compute the square multiplier and its probability for one character.", dependencyRefs: [], formalDeclarationRefs: [] },
      { id: "parseval", text: "Use Parseval to sum the character contributions.", dependencyRefs: ["S02_L03"], formalDeclarationRefs: [] },
      { id: "truncate", text: "Identify the higher-level Fourier mass with the truncation error.", dependencyRefs: ["S02_D02"], formalDeclarationRefs: ["S04_Lem4_01_CubeSquare"] },
    ],
  ),

  S04_P02: proof(
    "On every matching coset, the global operator is exactly the ordinary orthogonal projection onto cube Fourier levels zero and one.",
    String.raw`Fix a coset \(C\). Replacing a representative \(\rho_C\) by \(\rho_C\tau_z\) translates cube coordinates by \(z\); the Fourier coefficient at \(S\) is multiplied by \(\chi_S(z)\), which cancels the same factor in evaluation. Thus the construction in [Definition 4.1](#statement:S04_D01) is representative-independent.

On \(C\), its formula is exactly the truncation \(P_{\le1}g_{C,M}\) from [Definition 2.2](#statement:S02_D02). By [Lemma 2.3](#statement:S02_L03), this truncation fixes precisely the span of the constant and singleton characters and is orthogonal to all characters of weight at least two. Averaging the coset identities gives

$$
\lVert(I-P_M)f\rVert_2^2
=\mathbb E_C\lVert g_{C,M}-P_{\le1}g_{C,M}\rVert_2^2
=\mathbb E_C\sum_{|S|\ge2}\widehat g_{C,M}(S)^2.
$$

The same orthogonality shows that \((I-P_M)f\perp P_Mf\), and therefore \(\langle f,(I-P_M)f\rangle=\lVert(I-P_M)f\rVert_2^2\).`,
    [
      { id: "well-defined", text: "Check invariance under changing the coset representative.", dependencyRefs: ["S04_D01"], formalDeclarationRefs: ["S04_Prop4_02_PMIndependentOfRepresentatives"] },
      { id: "projection", text: "Identify each restriction with cube Fourier truncation.", dependencyRefs: ["S02_D02", "S02_L03"], formalDeclarationRefs: ["S04_Prop4_02_CosetwiseDescriptionOfPM", "S04_Prop4_02_fixedSpace"] },
      { id: "energy", text: "Average Parseval and orthogonality over cosets.", dependencyRefs: ["S02_L03", "S04_D01"], formalDeclarationRefs: ["S04_Prop4_02_errorFormula", "S04_Prop4_02_perpendicular"] },
    ],
  ),

  S04_L03: proof(
    "Each 1-coset indicator becomes a constant or a one-bit function on every matching cube; linearity handles all of the global degree-one space.",
    String.raw`For \(t_{ij}(\sigma)=\mathbf1[\sigma(i)=j]\), its restriction to a matching coset is \(t_{ij}(\rho_C\tau_x)=\mathbf1[\rho_C(\tau_x(i))=j]\). As in [Lemma 3.1](#statement:S03_L01), this is constant if \(i\) is unmatched and depends only on the coordinate of the unique edge incident with \(i\) otherwise. Its Fourier expansion therefore has only levels zero and one, by [Lemma 2.3](#statement:S02_L03), so it belongs to the local space of [Definition 4.1](#statement:S04_D01).

The global space \(U_1\) is the span of the \(t_{ij}\), hence \(U_1\subseteq\mathcal W_M\). [Proposition 4.2](#statement:S04_P02) says \(P_M\) fixes every member of \(\mathcal W_M\), so \(P_MH=H\) for \(H\in U_1\).`,
    [
      { id: "indicator", text: "Show each basic 1-coset indicator has local degree at most one.", dependencyRefs: ["S03_L01", "S02_L03", "S04_D01"], formalDeclarationRefs: ["S04_Lem4_03_TijLocalDegree"] },
      { id: "span", text: "Pass to the span and apply the fixed-space property of the projection.", dependencyRefs: ["S04_P02"], formalDeclarationRefs: ["S04_Lem4_03_GlobalDegreeOneIsLocallyDegreeOne"] },
    ],
  ),

  S04_T04: proof(
    "Average local rejection is diagonal on Young blocks, and the combinatorial certificates uniformly bound every block outside degree one.",
    String.raw`By [Lemma 4.3](#statement:S04_L03), every \(P_M\) fixes \(U_1\), so the averaged operator \(\mathcal A=\mathbb E_M(I-P_M)\) vanishes there. [Proposition 5.16](#statement:S05_P16) decomposes its quadratic form into Young-block energies. For \(n=2m\), the scalar on block \(\lambda\) is \(h_m(\lambda)/d_\lambda\); for \(n=2m+1\), it is \(h_m^{\mathrm{odd}}(\lambda)/d_\lambda\).

The non-degree-one blocks are exactly those outside the one-row and standard shapes. [Lemma 5.19](#statement:S05_L19) gives \(h_m(\lambda)/d_\lambda\ge1/5\) on every such even block, and [Lemma 5.20](#statement:S05_L20) gives the odd bound \(h_m^{\mathrm{odd}}(\lambda)/d_\lambda\ge1/6\). Summing these scalar inequalities against the nonnegative block energies yields

$$
\mathbb E_M\lVert(I-P_M)f\rVert_2^2
\ge \tfrac16\lVert f-P_{U_1}f\rVert_2^2,
$$

with \(1/5\) when \(n\) is even.`,
    [
      { id: "kernel", text: "Show the averaged operator vanishes on global degree one.", dependencyRefs: ["S04_L03"], formalDeclarationRefs: [] },
      { id: "diagonalize", text: "Use the Young-block weighted identity for the averaged operator.", dependencyRefs: ["S05_P16"], formalDeclarationRefs: [] },
      { id: "certificates", text: "Apply the even and odd certificate bounds block by block.", dependencyRefs: ["S05_L19", "S05_L20"], formalDeclarationRefs: ["S04_Thm4_04_MatchingGap"] },
    ],
  ),

  S04_P05: proof(
    "Translate the four group queries to one cube square, then combine the local square estimate with the global matching gap.",
    String.raw`Assume \(n\ge4\). By [Construction 3.1](#statement:S03_D03), for fixed \(M\), a uniform \(\pi\) is obtained by choosing a coset \(C\) and uniform \(x\), then writing \(\pi=\rho_C\tau_x\). The trial's edge colors give disjoint directions \(u,v\), so its four queried values are the four corners of \(g_{C,M}\) and its alternating sum is \(\Delta_{u,v}g_{C,M}(x)\).

Apply [Lemma 4.1](#statement:S04_L01) on each coset, then average. [Proposition 4.2](#statement:S04_P02) identifies the averaged local high-degree energy with \(\lVert(I-P_M)f\rVert_2^2\), giving

$$
\mathbb E[\Delta^2]\ge\frac{32}{9}\mathbb E_M\lVert(I-P_M)f\rVert_2^2.
$$

Finally [Theorem 4.4](#statement:S04_T04) lower-bounds the last expectation by \(\frac16\lVert f-P_{U_1}f\rVert_2^2\). Multiplication gives \(\mathbb E[\Delta^2]\ge\frac{16}{27}\lVert f-P_{U_1}f\rVert_2^2\).`,
    [
      { id: "coordinates", text: "Identify the group trial with a square on a matching cube.", dependencyRefs: ["S03_D03"], formalDeclarationRefs: ["S04_Prop4_05_TrialCubeCoordinates"] },
      { id: "local", text: "Apply the cube-square estimate and the cosetwise projection identity.", dependencyRefs: ["S04_L01", "S04_P02"], formalDeclarationRefs: ["oneTrialDeltaSqExpectation_ge_matchingMeanProjectionError"] },
      { id: "global", text: "Apply the matching-cube spectral gap and multiply constants.", dependencyRefs: ["S04_T04"], formalDeclarationRefs: ["S04_Prop4_05_SquareEnergyControlsGlobalDegree"] },
    ],
  ),

  S04_L06: proof(
    "For Boolean inputs, square energy lower-bounds the probability of seeing a nonzero square; FKN turns distance into global high-degree energy.",
    String.raw`Assume \(n\ge4\). By the decision rule in [Construction 3.1](#statement:S03_D03), the trial rejects exactly when its alternating sum \(\Delta\) is nonzero. Because all four queried values are Boolean, \(\Delta\in\{-2,-1,0,1,2\}\), so pointwise \(\Delta^2\le4\mathbf1[\Delta\ne0]\). Therefore

$$
\Pr[\mathrm{reject}]\ge\tfrac14\mathbb E[\Delta^2].
$$

[Proposition 4.5](#statement:S04_P05) makes the right side at least \(\frac4{27}\lVert f-P_{U_1}f\rVert_2^2\). The imported FKN inequality [Theorem 2.2](#statement:S02_T02) gives \(\lVert f-P_{U_1}f\rVert_2^2\ge c_{\mathrm{FKN}}\operatorname{dist}(f,\mathcal D)^2\). Hence one trial rejects with probability at least \(c_0\operatorname{dist}(f,\mathcal D)^2\), where \(c_0=4c_{\mathrm{FKN}}/27\).`,
    [
      { id: "indicator", text: "Use the trial's rejection rule and bound its indicator below by one quarter of the squared alternating sum.", dependencyRefs: ["S03_D03"], formalDeclarationRefs: ["bool_four_query_delta_sq_le_indicator", "matchingTrialDelta_sq_le_four_rejectIndicator", "oneTrialRejectProbability_ge_deltaSqExpectation"] },
      { id: "energy", text: "Use global square-energy control.", dependencyRefs: ["S04_P05"], formalDeclarationRefs: [] },
      { id: "fkn", text: "Convert global high-degree energy to squared distance from dictators.", dependencyRefs: ["S02_T02"], formalDeclarationRefs: ["S04_Lem4_06_OneTrialSoundness"] },
    ],
  ),

  S04_L07: proof(
    "Independent repetition converts quadratic one-trial soundness into constant soundness without losing one-sidedness.",
    String.raw`Start with the four-query matching-square trial of [Construction 3.1](#statement:S03_D03), viewed in the finite-seed model of [Definition 2.1](#statement:S02_D01). By [Lemma 3.2](#statement:S03_L02), every dictator is accepted by every seed, so any number of independent copies is still one-sided. By [Lemma 4.6](#statement:S04_L06), a fixed \(f\) at distance \(\delta\) is rejected by one copy with probability \(p\ge c_0\delta^2\).

For \(k\) independent copies, rejecting if any rejects, the probability that all accept is \((1-p)^k\); hence rejection probability is \(1-(1-p)^k\). The elementary inequality \((1-p)^k\le1/(1+kp)\) shows that \(kp\ge2\) makes rejection at least \(2/3\). Taking \(k=\lceil2/(c_0\epsilon^2)\rceil\) therefore handles every \(\epsilon\)-far input and uses \(4k=O(\epsilon^{-2})\) queries.`,
    [
      { id: "model", text: "Place the four-query matching-square trial in the finite-seed model and form independent repetitions.", dependencyRefs: ["S02_D01", "S03_D03"], formalDeclarationRefs: [] },
      { id: "one-sided", text: "Preserve perfect completeness under repetition.", dependencyRefs: ["S03_L02"], formalDeclarationRefs: [] },
      { id: "soundness", text: "Amplify the one-trial rejection probability and count queries.", dependencyRefs: ["S04_L06"], formalDeclarationRefs: ["S04_Lem4_07_repetition_rejection_probability", "S04_Lem4_07_dimension_free_amplification"] },
    ],
  ),

  S05_L01: proof(
    "The explicit Young matrices satisfy the Coxeter relations for adjacent transpositions.",
    String.raw`Use the local formulas of [Definition 5.5](#statement:S05_D05). On each same-row or same-column basis line, \(S_i^\lambda=\pm I\). On a swappable pair \((e_T,e_{s_iT})\), its matrix is

$$
\begin{pmatrix}a&b\\ b&-a\end{pmatrix},
\qquad b^2=1-a^2,
$$

whose square is \(I\). Thus \((S_i^\lambda)^2=I\). If \(|i-j|>1\), swapping \(i,i+1\) does not alter the cells, axial distance, or swappability of \(j,j+1\), and conversely. The two operators therefore give the same support tableaux and coefficient products in either order.

For the braid relation, fix \(T\). Write \(x=c_T(i)\), \(y=c_T(i+1)\), \(z=c_T(i+2)\), and put

$$
p=y-x,\quad q=z-y,\quad r=z-x=p+q,
$$

$$
\alpha=p^{-1},\quad \beta=q^{-1},\quad \gamma=r^{-1},\qquad
u=\sqrt{1-\alpha^2},\quad v=\sqrt{1-\beta^2},\quad w=\sqrt{1-\gamma^2}.
$$

The denominators are nonzero. In particular, if the cells of \(i\) and \(i+2\) had equal content, they would lie on one diagonal; the boxes immediately east and south of the northwestern one would then be two distinct boxes whose entries are both strictly between \(i\) and \(i+2\), which is impossible.

Number the original cells \(x,y,z\) by \(1,2,3\). For a permutation \((a,b,c)\) of \((1,2,3)\), let \(e_{abc}\) denote the tableau vector in which the entries \(i,i+1,i+2\) occupy, respectively, the \(a\)-th, \(b\)-th, and \(c\)-th original cells. Applying the \(2\times2\) formula gives

$$
\begin{array}{c|cc}
&S_iS_{i+1}S_i e_{123}&S_{i+1}S_iS_{i+1}e_{123}\\ \hline
e_{123}&\alpha^2\beta+u^2\gamma&\alpha\beta^2+v^2\gamma\\
e_{213}&\alpha u(\beta-\gamma)&\beta\gamma u\\
e_{132}&\alpha\gamma v&\beta v(\alpha-\gamma)\\
e_{312}&\alpha vw&\alpha vw\\
e_{231}&\beta uw&\beta uw\\
e_{321}&uvw&uvw.
\end{array}
$$

If a labeling in the table is not standard, the first swap entering it is a same-row or same-column swap; its axial distance is \(1\) or \(-1\), so the corresponding radical is zero. Thus the table remains valid after omitting nonstandard tableaux. Since \(r=p+q\),

$$
\alpha\beta=\gamma(\alpha+\beta),
$$

which gives \(\alpha(\beta-\gamma)=\beta\gamma\), \(\beta(\alpha-\gamma)=\alpha\gamma\), and, using \(u^2=1-\alpha^2\) and \(v^2=1-\beta^2\),

$$
\alpha^2\beta+u^2\gamma=\alpha\beta^2+v^2\gamma.
$$

Every row agrees, proving the braid relation on every basis vector.`,
    [
      { id: "involution", text: "Check the involution relation in each local Young block.", dependencyRefs: ["S05_D05"], formalDeclarationRefs: ["S05_Lem5_01_youngAdjacentOperator_sq"] },
      { id: "commutation", text: "Show disjoint swaps preserve each other's Young data.", dependencyRefs: ["S05_D05"], formalDeclarationRefs: ["S05_Lem5_01_youngAdjacentOperator_comm_of_disjoint_indices"] },
      { id: "braid", text: "Compare all six braid coefficients and discharge them with the axial-distance identity.", dependencyRefs: ["S05_D05"], formalDeclarationRefs: ["youngAdjacentOperator_braid_basis_of_succ", "S05_Lem5_01_youngAdjacentOperator_braid_of_succ", "S05_Lem5_01_youngAdjacent_coxeter_relations"] },
    ],
  ),

  S05_T02: proof(
    "Coxeter relations make the product of adjacent Young operators independent of the chosen word.",
    String.raw`By [Lemma 5.1](#statement:S05_L01), the operators \(S_i^\lambda\) satisfy cancellation, distant commutation, and braid moves. Let

$$
A_r=s_rs_{r+1}\cdots s_{N-1}\quad(1\le r<N),
\qquad A_N=1,
$$

and let \(\iota\) embed words in \(s_1,\ldots,s_{N-2}\). The Coxeter moves give

$$
s_iA_r\sim
\begin{cases}
A_r\,\iota(s_i),&i\le r-2,\\
A_{r-1},&i=r-1,\\
A_{r+1},&i=r,\\
A_r\,\iota(s_{i-1}),&i\ge r+1.
\end{cases}
$$

The first case is distant commutation, the second extends the segment, and the third cancels \(s_r^2\). In the fourth, commute \(s_i\) through \(s_r,\ldots,s_{i-2}\), apply the braid relation, and commute the final \(s_{i-1}\) past \(s_{i+1},\ldots,s_{N-1}\). Induction on word length therefore converts every adjacent word—reduced or not—to \(A_r\iota(v)\) for a lower-rank word \(v\). The cancellation case is what includes nonreduced words.

These moves are complete, by induction on \(N\). If \(A_r\iota(v)\) and \(A_{r'}\iota(v')\) represent the same permutation, the lifted lower-rank words fix \(N\), while \(A_r(N)=r\); hence \(r=r'\). Cancel \(A_r\), restrict to \(\{1,\ldots,N-1\}\), and apply the induction hypothesis to \(v,v'\). Thus any two adjacent words for the same permutation are Coxeter-equivalent. Conversely, every permutation has an adjacent word: for \(r=\pi(N)\), the permutation \(A_r^{-1}\pi\) fixes \(N\), and induction represents its restriction.

For a word \(w=(i_1,\ldots,i_k)\), set

$$
P(w)=S_{i_1}^\lambda\cdots S_{i_k}^\lambda.
$$

Lemma 5.1 makes \(P(w)\) invariant under every Coxeter move, so completeness makes it depend only on the represented permutation. Define \(\rho^\lambda(\pi)=P(w)\). Concatenating words proves multiplicativity; the empty and one-letter words give the identity and \(\rho^\lambda(s_i)=S_i^\lambda\). Each generator is orthogonal by its local matrix, so every \(\rho^\lambda(\pi)\) is orthogonal.`,
    [
      { id: "normal-form", text: "Reduce arbitrary adjacent words to an ascending-segment normal form.", dependencyRefs: ["S05_L01"], formalDeclarationRefs: ["adjacent_cons_ascendingSegment_normalForm", "exists_ascendingSegment_lift_normalForm"] },
      { id: "well-defined", text: "Prove completeness of Coxeter moves and surjectivity of adjacent words.", dependencyRefs: ["S05_L01"], formalDeclarationRefs: ["adjacentWordPerm_complete", "adjacentWordPerm_surjective", "S05_Thm5_02_typeA_adjacentWord_presentation"] },
      { id: "representation", text: "Define the action and verify multiplication, generators, and orthogonality.", dependencyRefs: ["S05_L01"], formalDeclarationRefs: ["youngPermutationOperator_mul", "youngPermutationOperator_adjacent", "youngOrthogonalActionData_nonempty", "S05_Thm5_02_youngOrthogonalAction", "S05_youngAdjacentOperator_inner"] },
    ],
  ),

  S05_T03: proof(
    "The group-algebra Jucys–Murphy elements and the diagonal content operators obey the same recurrence.",
    String.raw`Under the Young action of [Theorem 5.2](#statement:S05_T02), compare

$$
J_{k+1}=s_kJ_ks_k+s_k
\quad\text{and}\quad
C_{k+1}^\lambda=S_k^\lambda C_k^\lambda S_k^\lambda+S_k^\lambda.
$$

The first identity follows by conjugating each transposition \((i,k)\) to \((i,k+1)\), leaving the missing term \(s_k\). For the second, use the adjacent-operator cases certified by [Lemma 5.1](#statement:S05_L01): when \(k,k+1\) share a row or column, their contents differ by \(+1\) or \(-1\); in the swappable case, direct multiplication of the \(2\times2\) Young matrix gives the recurrence. Both sides start at \(J_1=C_1^\lambda=0\), so induction gives \(\rho^\lambda(J_k)=C_k^\lambda\) for all \(k\).`,
    [
      { id: "recurrences", text: "Establish parallel recurrences in the group algebra and tableau model.", dependencyRefs: ["S05_L01", "S05_T02"], formalDeclarationRefs: ["S05_Thm5_03_jucysMurphyElement_succ_recurrence", "S05_Thm5_03_tableauContent_succ_recurrence"] },
      { id: "induction", text: "Use the common zero base case to identify the two actions.", dependencyRefs: ["S05_T02"], formalDeclarationRefs: ["S05_Thm5_03_jucysMurphyContentAction"] },
    ],
  ),

  S05_L04: proof(
    "A tableau is reconstructed from its content sequence, and linear extensions of the Young poset are connected by adjacent incomparable swaps.",
    String.raw`For a standard tableau as in [Definition 5.3](#statement:S05_D03), the boxes occupied by \(1,\ldots,r\) form a Young diagram. At step \(r\), the added box is determined by its content because distinct addable corners have distinct contents. Thus the content sequence reconstructs the tableau. The content operators of [Definition 5.5](#statement:S05_D05)—identified with the Jucys–Murphy action by [Theorem 5.3](#statement:S05_T03)—are diagonal, so their common eigenspaces are precisely the individual coordinate lines.

For connectivity, read a standard tableau as a linear extension of the Young poset. Any two linear extensions are joined by swapping adjacent incomparable elements: move the first target element left across the incomparable elements before it, delete the now-common first element, and induct. These swaps are exactly the valid adjacent tableau swaps implemented by the operators in [Lemma 5.1](#statement:S05_L01).`,
    [
      { id: "separate", text: "Reconstruct the tableau from the successive contents and identify common eigenspaces.", dependencyRefs: ["S05_D03", "S05_D05", "S05_T03"], formalDeclarationRefs: ["S05_Lem5_04_diagonalContentEigenspaces"] },
      { id: "connect", text: "Connect linear extensions by valid adjacent swaps.", dependencyRefs: ["S05_D03", "S05_L01"], formalDeclarationRefs: ["S05_Lem5_04_standardTableauxSwapConnectedness"] },
    ],
  ),

  S05_L05: proof(
    "Commuting with contents forces diagonality, and commuting with adjacent swaps equalizes all diagonal entries.",
    String.raw`By [Lemma 5.4](#statement:S05_L04), the joint eigenspaces of the content operators are the lines \(\mathbb C e_T\). Hence an operator \(B\) commuting with every content operator has \(Be_T=b_Te_T\). Whenever \(s_iT\) is standard, the Young matrix for \(S_i^\lambda\) has a nonzero off-diagonal entry; commuting with it forces \(b_T=b_{s_iT}\). The tableau-swap graph is connected by the same lemma, so all \(b_T\) equal one scalar. Taking traces identifies it as \(\operatorname{tr}(B)/d_\lambda\).`,
    [
      { id: "diagonal", text: "Use content separation to diagonalize the commutant.", dependencyRefs: ["S05_L04"], formalDeclarationRefs: [] },
      { id: "scalar", text: "Use tableau connectivity and the adjacent operators to make every diagonal entry equal.", dependencyRefs: ["S05_L04"], formalDeclarationRefs: ["S05_Lem5_05_youngModelOperator_scalar_on_basis"] },
    ],
  ),

  S05_L06: proof(
    "Average a rank-one operator over the group and apply the scalar-commutant lemma.",
    String.raw`For \(X:V^\mu\to V^\lambda\), average its conjugates under the Young actions:

$$
\mathcal R_{\lambda,\mu}(X)=\mathbb E_{\pi\in S_n}\rho^\lambda(\pi)X\rho^\mu(\pi)^{-1}.
$$

This is an intertwiner. If \(\lambda=\mu\), it commutes with every adjacent operator and, using [Theorem 5.3](#statement:S05_T03), every content operator. [Lemma 5.5](#statement:S05_L05) therefore makes it \((\operatorname{tr}X/d_\lambda)I\). Applying this to the rank-one coordinate operators defining the coefficients in [Definition 5.6](#statement:S05_D06) gives the same-shape formula.

If \(\lambda\ne\mu\), an intertwiner must preserve all joint content eigenvalues, but a content sequence determines both the tableau and its shape. Hence the averaged intertwiner is zero, giving cross-shape orthogonality.`,
    [
      { id: "same-shape", text: "Average a coordinate operator and use the scalar commutant on one shape.", dependencyRefs: ["S05_L05", "S05_T03", "S05_D06"], formalDeclarationRefs: ["S05_Lem5_06_same_shape"] },
      { id: "different-shape", text: "Use content sequences to rule out intertwiners between different shapes.", dependencyRefs: ["S05_T03", "S05_D06"], formalDeclarationRefs: ["S05_Lem5_06_distinct_shapes"] },
    ],
  ),

  S05_L07: proof(
    "Young-lattice deletion and addition recurrences turn the sum of squared tableau counts into the factorial recurrence.",
    String.raw`Using the one-box relation in [Definition 5.7](#statement:S05_D07), delete the box containing \(n\) from a standard tableau to obtain

$$
d_\lambda=\sum_{\mu\nearrow\lambda}d_\mu.
$$

The Young lattice also satisfies \(\sum_{\lambda:\mu\nearrow\lambda}d_\lambda=(n+1)d_\mu\): expand each upper dimension by deletion; common upper covers of distinct diagrams pair with common lower covers by exchanging their two differing corners, while a diagram has one more addable than removable corner.

For \(A_n=\sum_{\lambda\vdash n}d_\lambda^2\), interchange the two cover sums and apply those recurrences:

$$
A_{n+1}=\sum_{\mu\vdash n}d_\mu\sum_{\lambda:\mu\nearrow\lambda}d_\lambda=(n+1)A_n.
$$

Since \(A_0=1\), induction yields \(A_n=n!\).`,
    [
      { id: "branching", text: "Establish the downward and upward Young-lattice dimension recurrences.", dependencyRefs: ["S05_D07"], formalDeclarationRefs: [] },
      { id: "factorial", text: "Apply both recurrences to the squared-dimension sum.", dependencyRefs: ["S05_D07"], formalDeclarationRefs: ["S05_Lem5_07_youngTableau_sum_of_squares"] },
    ],
  ),

  S05_L08: proof(
    "An orthogonal family with exactly n! elements is a basis of the n!-dimensional regular function space.",
    String.raw`By [Lemma 5.6](#statement:S05_L06), the normalized matrix coefficients from [Definition 5.6](#statement:S05_D06) are orthonormal. Their number is \(\sum_{\lambda\vdash n}d_\lambda^2=n!\) by [Lemma 5.7](#statement:S05_L07), equal to \(\dim L^2(S_n;\mathbb C)=|S_n|\). Therefore they form an orthonormal basis. Grouping basis vectors by \(\lambda\) gives the orthogonal direct sum of Young blocks; the block dimensions and Parseval identity follow at once.`,
    [
      { id: "orthogonal", text: "Obtain an orthonormal coefficient family.", dependencyRefs: ["S05_L06", "S05_D06"], formalDeclarationRefs: ["S05_Lem5_08_globalYoungMatrixCoefficient_linearIndependent"] },
      { id: "complete", text: "Use the sum-of-squares dimension count to prove spanning and Parseval.", dependencyRefs: ["S05_L07", "S05_D06"], formalDeclarationRefs: ["S05_Lem5_08_globalYoungMatrixCoefficient_span_all", "S05_Lem5_08_parseval"] },
    ],
  ),

  S05_L09: proof(
    "The permutation-coordinate representation splits into the trivial and standard Young actions, whose coefficient spaces are exactly global degree one.",
    String.raw`Let \(P=\mathbb C^n\) carry the natural permutation action. By [Definition 5.6](#statement:S05_D06), its matrix coefficients are

$$
\pi\longmapsto\langle e_j,\pi e_i\rangle=\mathbf1[\pi(i)=j],
$$

so its coefficient space is \(U_1\otimes_{\mathbb R}\mathbb C\). Split

$$
P=\mathbb C\mathbf1\oplus P_0,
\qquad P_0=\{x:\textstyle\sum_i x_i=0\}.
$$

The constant line is the one-row representation. Index the tableaux of shape \((n-1,1)\) by the lower-box entry \(r\in\{2,\ldots,n\}\), and put

$$
u_r=\frac{e_1+\cdots+e_{r-1}-(r-1)e_r}{\sqrt{r(r-1)}}.
$$

The numerator has squared norm \(r(r-1)\), and for \(r<s\) the inner product of the two numerators is \((r-1)-(r-1)=0\). Thus these vectors form an orthonormal basis of \(P_0\).

Let \(s_i=(i,i+1)\). If \(r\notin\{i,i+1\}\), then \(s_i u_r=u_r\), while \(s_1u_2=-u_2\). For \(i\ge2\), substitution gives

$$
\begin{aligned}
s_i u_i&=\frac1i u_i+\sqrt{1-\frac1{i^2}}\,u_{i+1},\\
s_i u_{i+1}&=\sqrt{1-\frac1{i^2}}\,u_i-\frac1i u_{i+1}.
\end{aligned}
$$

For the tableau whose lower entry is \(i\), the axial distance between \(i\) and \(i+1\) is \(i\). These are therefore exactly the same-row, same-column, and \(2\times2\) Young matrices of [Theorem 5.2](#statement:S05_T02). The map \(e_{T_r}\mapsto u_r\) intertwines every adjacent generator and hence the whole \(S_n\)-action. Consequently \(P_0\cong V^{(n-1,1)}\).

[Lemma 5.8](#statement:S05_L08) now identifies the coefficient space with \(\mathcal H_{(n)}\oplus\mathcal H_{(n-1,1)}\), and orthogonality gives the complementary-energy identity. When \(n=1\), only the one-row summand occurs.`,
    [
      { id: "coefficients", text: "Identify the permutation-coordinate coefficient space with complexified U1.", dependencyRefs: ["S05_D06"], formalDeclarationRefs: ["natAdjacentCoordinateSwap_degreeOneCoordinateVector_right"] },
      { id: "standard", text: "Calculate every adjacent generator in the explicit zero-sum basis and match the standard Young action.", dependencyRefs: ["S05_T02"], formalDeclarationRefs: ["standardCoordinateMap_youngAdjacentOperator_basis", "standardCoordinateMap_intertwines_youngAction"] },
      { id: "blocks", text: "Read the two coefficient blocks and their orthogonal complement from the regular decomposition.", dependencyRefs: ["S05_L08"], formalDeclarationRefs: ["U1_eq_concreteDegreeOneYoungBlockSum", "l2DistSqToU1_eq_sum_concreteYoungBlockEnergy", "S05_Lem5_09_degreeOneYoungBlockIdentification"] },
    ],
  ),

  S05_L10: proof(
    "Resolve each two-box extension fibre into the signs of the last adjacent transposition.",
    String.raw`Fix one of the signed extension spaces from [Definition 5.8](#statement:S05_D08). Its fibre over a child tableau is one-dimensional when the two new boxes share a row or column; the final adjacent operator acts there by \(+1\) or \(-1\). If the boxes are disconnected, the fibre is two-dimensional and the explicit Young matrix of [Definition 5.5](#statement:S05_D05) has orthonormal \(+1\) and \(-1\) eigenvectors. Distinct fibres are orthogonal, and resolving every fibre into these signed lines gives the claimed mutually orthogonal direct sum. Deletion sends each chosen unit vector to the child basis, hence is unitary.

For \(i\le N-3\), the operator \(S_i\) only moves labels among \(1,\ldots,N-2\), leaving the two new boxes fixed. Their row, column, content, and swappability data are unchanged by deletion, so the same Young matrix acts before and after deletion. This is the intertwining identity.`,
    [
      { id: "fibres", text: "Resolve each extension fibre into orthogonal sign eigenspaces.", dependencyRefs: ["S05_D08", "S05_D05"], formalDeclarationRefs: ["S05_signedTwoBoxChild_orthogonal_decomposition", "S05_signedTwoBoxChildEmbedding_isometry", "S05_signedTwoBoxChildEmbedding_finalOperator", "S05_signedTwoBoxChildEmbedding_ranges_orthogonal", "S05_signedTwoBoxChildEmbeddings_span"] },
      { id: "intertwine", text: "Show earlier adjacent operators are unchanged by deleting the last two boxes.", dependencyRefs: ["S05_D05"], formalDeclarationRefs: ["S05_signedTwoBoxChildEmbedding_intertwinesEarlierAdjacent"] },
    ],
  ),

  S05_L11: proof(
    "Partition the tableau basis by the removable corner containing the maximum entry and delete that entry.",
    String.raw`The maximum entry of a standard tableau lies in a unique removable corner, using the one-box branching data of [Definition 5.7](#statement:S05_D07). The possible locations therefore partition the Young basis and give the orthogonal decomposition into the spaces of [Definition 5.9](#statement:S05_D09). Deleting that corner is a bijection from the orthonormal basis of \(W_u\) to the basis of the child space, so \(D_u\) is unitary.

For \(i\le N-2\), the adjacent operator of [Lemma 5.1](#statement:S05_L01) never moves the maximum entry. Deletion preserves the row, column, content, and swap data of \(i,i+1\), so the same Young matrix acts on both sides of \(D_uS_i^\lambda=S_i^{\mu_u}D_u\).`,
    [
      { id: "decompose", text: "Partition tableaux by the unique removable corner occupied by the maximum.", dependencyRefs: ["S05_D07", "S05_D09"], formalDeclarationRefs: ["S05_Lem5_11_tableau_unique_removable_corner", "S05_Lem5_11_deleteMaxEntry_bijective", "S05_Lem5_11_deletionCoordinateMap_inner"] },
      { id: "intertwine", text: "Show deleting the maximum preserves every earlier adjacent Young operator.", dependencyRefs: ["S05_L01", "S05_D09"], formalDeclarationRefs: ["S05_Lem5_11_deletionCoordinateMap_youngAdjacentOperator_intertwines"] },
    ],
  ),

  S05_L12: proof(
    "Take dimensions in the one- and two-box orthogonal decompositions, then mirror those recurrences in the sign-pattern multisets.",
    String.raw`Taking dimensions in the signed two-box decomposition of [Lemma 5.10](#statement:S05_L10) gives the sum over horizontal and vertical signed children; a disconnected removal occurs twice because its extension fibre has both signs. Taking dimensions in the one-box decomposition of [Lemma 5.11](#statement:S05_L11) gives \(d_\lambda=\sum_{\mu\nearrow\lambda}d_\mu\).

For the cardinality assertions assume \(m\ge1\), the range of [Definition 5.10](#statement:S05_D10). The even and odd multisets satisfy exactly these same recurrences, including multiplicity, and have the correct size at \(m=1\). Induction therefore gives \(|\mathsf X_m(\lambda)|=d_\lambda\) and \(|\mathsf X_m^{\mathrm{odd}}(\lambda)|=d_\lambda\).`,
    [
      { id: "dimensions", text: "Take dimensions in the signed two-box and one-box decompositions.", dependencyRefs: ["S05_L10", "S05_L11"], formalDeclarationRefs: ["S05_Lem5_12_tableauDim_twoStrip_branching_sized", "S05_Lem5_12_tableauDim_oneBox_branching"] },
      { id: "multisets", text: "Induct through the matching sign-pattern recurrences.", dependencyRefs: ["S05_D10"], formalDeclarationRefs: ["S05_Lem5_12_evenSignPatternMultiset_card", "S05_Lem5_12_oddSignPatternMultiset_card"] },
    ],
  ),

  S05_L13: proof(
    "Inductively lift eigenbases through signed two-box branching, then use one-box branching for odd rank and conjugation for arbitrary matchings.",
    String.raw`Assume \(m\ge1\). For the canonical perfect matching, induct on \(m\). The two rank-two shapes have the required \(+\) and \(-\) eigenvectors and the initial labels of [Definition 5.10](#statement:S05_D10). For a shape \(\lambda\vdash2m\), [Lemma 5.10](#statement:S05_L10) and the signed spaces of [Definition 5.8](#statement:S05_D08) decompose \(V^\lambda\) into child spaces. Lift the inductive eigenbasis of each child through the unitary deletion map. Earlier matching generators retain their eigenvalues by intertwining; the final generator has the sign of the child. Adjoin \(m\) to the label exactly for negative children. This is precisely the even multiset recursion, whose total cardinality is correct by [Lemma 5.12](#statement:S05_L12). Multiplying the commuting generator equations gives the character action defined in [Definition 5.11](#statement:S05_D11), under the representation of [Theorem 5.2](#statement:S05_T02).

Any ordered perfect matching is conjugate to the canonical one; applying the unitary Young action of the conjugating permutation transports the basis without changing labels. For odd rank, [Lemma 5.11](#statement:S05_L11) decomposes according to the unmatched maximum point. Lift the even bases from the one-box children; their label multiset is the odd recursion in Definition 5.10. Conjugation again handles an arbitrary near-perfect matching.`,
    [
      { id: "canonical-even", text: "Lift child eigenbases through signed two-box branching and assign the final sign label.", dependencyRefs: ["S05_D08", "S05_D10", "S05_L10", "S05_L12", "S05_D11", "S05_T02"], formalDeclarationRefs: ["S05_Lem5_13_canonicalEvenMatchingEigenbasis", "S05_canonicalEvenMatchingBasis_character_action"] },
      { id: "arbitrary-even", text: "Transport the canonical basis to any ordered perfect matching by conjugation.", dependencyRefs: ["S05_T02", "S05_D11"], formalDeclarationRefs: ["S05_Lem5_13_arbitraryEvenMatchingEigenbasis_toOrdered"] },
      { id: "odd", text: "Use one-box deletion for the unmatched point, then relabel arbitrary near-perfect matchings.", dependencyRefs: ["S05_L11", "S05_D10", "S05_D11", "S05_T02"], formalDeclarationRefs: ["S05_Lem5_13_canonicalOddMatchingEigenbasis", "S05_Lem5_13_arbitraryOddMatchingEigenbasis_toOrdered"] },
    ],
  ),

  S05_L14: proof(
    "The matching group-algebra idempotents are exactly its character projections on every coset.",
    String.raw`For the matching characters in [Definition 5.11](#statement:S05_D11), character orthogonality on the abelian group \(A_M\) gives \(e_R^Me_{R'}^M=\mathbf1[R=R']e_R^M\) and \(\sum_Re_R^M=1\). Hence the elements of [Definition 5.12](#statement:S05_D12) are pairwise orthogonal idempotents, and convolution by \(e_R^M\) projects each right coset onto its \(\chi_R\)-component.

Summing over \(|R|\le1\) gives exactly the cosetwise low-degree projection in [Definition 4.1](#statement:S04_D01); the complementary sum gives \(I-P_M\). A pure matching character is therefore preserved when its label has size at most one and killed otherwise.`,
    [
      { id: "idempotents", text: "Use character orthogonality to prove the matching idempotent identities.", dependencyRefs: ["S05_D11", "S05_D12"], formalDeclarationRefs: [] },
      { id: "projection", text: "Identify convolution by the low and high idempotent sums with local truncation and its complement.", dependencyRefs: ["S04_D01", "S05_D12"], formalDeclarationRefs: ["S05_Lem5_14_matchingLocalProjection_preserves_low_matchingCharacter", "S05_Lem5_14_matchingLocalProjection_kills_high_matchingCharacter", "S05_Lem5_14_local_truncation_as_convolution"] },
    ],
  ),

  S05_L15: proof(
    "Diagonalize local truncation in the matching eigenbasis and count its high-character diagonal entries.",
    String.raw`Assume \(m\ge1\). Choose the labeled orthonormal matching eigenbasis \(v_1,\ldots,v_{d_\lambda}\) from [Lemma 5.13](#statement:S05_L13), with labels \(R_a\), and use [Definition 5.6](#statement:S05_D06) to form

$$
F_{S,a}(\pi)=\langle e_S,\rho^\lambda(\pi)v_a\rangle.
$$

Write \(v_a=\sum_TU_{T,a}e_T\). Since both \((e_T)\) and \((v_a)\) are orthonormal, \(U\) is unitary. For fixed \(S\), the family \((F_{S,a})_a\) is obtained from the usual matrix coefficients \((\Phi^\lambda_{S,T})_T\) by this same unitary change of basis, up to the conjugation fixed by the inner-product convention. Thus [Lemma 5.8](#statement:S05_L08) implies that

$$
\{\sqrt{d_\lambda}F_{S,a}:S,a\}
$$

is an orthonormal basis of \(\mathcal H_\lambda\).

The matching-eigenvalue equation gives

$$
F_{S,a}(\omega\tau_x)=\chi_{R_a}(\tau_x)F_{S,a}(\omega).
$$

[Lemma 5.14](#statement:S05_L14), using the idempotents of [Definition 5.12](#statement:S05_D12), therefore gives

$$
(I-P_M)F_{S,a}=\mathbf1[|R_a|\ge2]F_{S,a}.
$$

The operator is diagonal in the preceding basis. There are \(d_\lambda\) choices of \(S\), while Lemma 5.13 supplies exactly \(h_m(\lambda)\) high labels in even rank and \(h_m^{\mathrm{odd}}(\lambda)\) in odd rank. Summing the diagonal entries gives \(d_\lambda h_m(\lambda)\) and its odd analogue.`,
    [
      { id: "basis-change", text: "Use the unitary matching eigenbasis to obtain an orthonormal matrix-coefficient basis of the Young block.", dependencyRefs: ["S05_L13", "S05_L08", "S05_D06"], formalDeclarationRefs: ["S05_Lem5_15_fixedMatching_tableauTrace_even_of_eigenbasis", "S05_Lem5_15_fixedMatching_tableauTrace_odd_of_eigenbasis"] },
      { id: "diagonalize", text: "Identify local truncation as the indicator of high matching-character labels.", dependencyRefs: ["S05_L14", "S05_D12"], formalDeclarationRefs: ["S05_Lem5_15_fixedMatching_youngBlockTrace_even_of_eigenbasis", "S05_Lem5_15_fixedMatching_youngBlockTrace_odd_of_eigenbasis"] },
      { id: "count", text: "Count high labels across all tableau coordinates to obtain the block trace.", dependencyRefs: ["S05_L13"], formalDeclarationRefs: ["S05_Lem5_15_fixedMatching_youngBlockTrace_even", "S05_Lem5_15_fixedMatching_youngBlockTrace_odd"] },
    ],
  ),

  S05_P16: proof(
    "Conjugation symmetry makes the averaged local-rejection operator scalar on each Young block; its scalar is the normalized trace counted by matching labels.",
    String.raw`Assume \(n\ge2\), so the matching size is \(m\ge1\) in either parity. By [Lemma 5.14](#statement:S05_L14), \(I-P_M=C_{q_M}\). Averaging and using [Definition 5.12](#statement:S05_D12) gives

$$
\mathcal A=\mathbb E_M(I-P_M)=C_q,
\qquad q=\mathbb E_Mq_M.
$$

Relabeling sends \(q_M\) to \(q_{\sigma M}\), and the uniform matching distribution is invariant under relabeling. Hence \(\sigma q\sigma^{-1}=q\), so \(q\) is central.

Fix \(\lambda\) and let \(B_\lambda=\rho^\lambda(q)\). Centrality makes \(B_\lambda\) commute with every adjacent Young operator and every represented Jucys–Murphy element. [Theorem 5.3](#statement:S05_T03) identifies the latter with the content operators, so [Lemma 5.5](#statement:S05_L05) makes \(B_\lambda=\theta_\lambda I\).

To pass from the representation to the function block, write \(q=\sum_gq_g g\). For every matrix coefficient from [Definition 5.6](#statement:S05_D06), right convolution gives

$$
\begin{aligned}
(C_q\Phi_{S,T}^\lambda)(\pi)
&=\sum_gq_g\langle e_S,\rho^\lambda(\pi g)e_T\rangle\\
&=\langle e_S,\rho^\lambda(\pi)B_\lambda e_T\rangle\\
&=\theta_\lambda\Phi_{S,T}^\lambda(\pi).
\end{aligned}
$$

Thus \(C_q=\mathcal A\) acts by the same scalar on all of \(\mathcal H_\lambda\).

In even rank, [Lemma 5.15](#statement:S05_L15) and linearity of trace give

$$
\operatorname{tr}(\mathcal A|_{\mathcal H_\lambda})
=\mathbb E_M\operatorname{tr}((I-P_M)|_{\mathcal H_\lambda})
=d_\lambda h_m(\lambda).
$$

[Lemma 5.8](#statement:S05_L08) gives \(\dim\mathcal H_\lambda=d_\lambda^2\), with \(d_\lambda>0\). The left side is also \(\theta_\lambda d_\lambda^2\), so \(\theta_\lambda=h_m(\lambda)/d_\lambda\). The identical calculation gives \(h_m^{\mathrm{odd}}(\lambda)/d_\lambda\) in odd rank.

Decompose \(F=\sum_\lambda F_\lambda\) orthogonally as in Lemma 5.8. [Proposition 4.2](#statement:S04_P02) makes every \(P_M\) an orthogonal projection, whence

$$
\mathbb E_M\lVert(I-P_M)F\rVert_2^2
=\langle F,\mathcal AF\rangle
=\sum_\lambda\theta_\lambda\lVert F_\lambda\rVert_2^2.
$$

Finally, [Lemma 4.3](#statement:S04_L03) gives \(P_MG=G\) for every \(G\in U_1\), so \(\mathcal AG=0\). [Lemma 5.9](#statement:S05_L09) identifies the complexification of \(U_1\) with the one-row and standard blocks. Their contributions vanish, leaving exactly the displayed even and odd weighted sums.`,
    [
      { id: "convolution", text: "Identify local truncation with high-character convolution and prove its average is central.", dependencyRefs: ["S05_L14", "S05_D12"], formalDeclarationRefs: ["S05_averagedHighMatchingElement_rightConvolution", "S05_averagedHighMatchingElement_central", "S05_Prop5_16_matchingMeanProjectionError_eq_high_idempotent_average"] },
      { id: "scalar", text: "Use the Jucys–Murphy content action and scalar-commutant lemma on each block.", dependencyRefs: ["S05_T03", "S05_L05"], formalDeclarationRefs: ["S05_averagedRejectionYoungOperator_scalar_from_section5", "S05_Prop5_16_scalar_eq_trace_div_dimension"] },
      { id: "matrix-coefficients", text: "Translate the scalar representation action into scalar right convolution on the Young matrix-coefficient block.", dependencyRefs: ["S05_D06"], formalDeclarationRefs: [] },
      { id: "trace", text: "Normalize the matching-label trace by the Young-block dimension.", dependencyRefs: ["S05_L15", "S05_L08"], formalDeclarationRefs: ["S05_Prop5_16_even_scalar_eq_hEven_div_dim", "S05_Prop5_16_odd_scalar_eq_hOdd_div_dim"] },
      { id: "quadratic-form", text: "Convert mean projection error to the scalar Young-block quadratic form.", dependencyRefs: ["S04_P02", "S05_L08"], formalDeclarationRefs: ["matchingMeanProjectionError_eq_inner_averagedHighConvolution"] },
      { id: "kernel", text: "Use preservation of U1 and its block identification to remove exactly the one-row and standard terms.", dependencyRefs: ["S04_L03", "S05_L09"], formalDeclarationRefs: ["matchingHighIdempotent_eq_zero_of_mem_U1", "rightConvolution_averagedHigh_eq_zero_of_mem_U1", "S05_Prop5_16_global_weighted_matching_identity_even", "S05_Prop5_16_global_weighted_matching_identity_odd"] },
    ],
  ),

  S05_L17: proof(
    "Read the two recurrences directly from whether the final matching edge is added horizontally or vertically.",
    String.raw`Assume \(m\ge2\), the range in which the displayed recursion of [Definition 5.10](#statement:S05_D10) is defined. In a horizontal occurrence \(\mu\in\mathsf H_2(\lambda)\), every old label \(R\in\mathsf X_{m-1}(\mu)\) is copied unchanged. It therefore contributes \(z_{m-1}(\mu)\) empty labels and \(h_{m-1}(\mu)\) labels of size at least two.

In a vertical occurrence, \(R\) is replaced by \(R\cup\{m\}\). Since \(R\subseteq[m-1]\), the result is never empty and has size at least two exactly when \(R\ne\varnothing\). By [Lemma 5.12](#statement:S05_L12), \(|\mathsf X_{m-1}(\mu)|=d_\mu\), so the vertical occurrence contributes \(d_\mu-z_{m-1}(\mu)\) high labels. Summing all signed occurrences—with a disconnected child appearing once in each multiset sum—gives both recurrences.`,
    [
      { id: "horizontal", text: "Count copied empty and high labels from horizontal children.", dependencyRefs: ["S05_D10"], formalDeclarationRefs: [] },
      { id: "vertical", text: "Use multiset cardinality to count nonempty old labels promoted by vertical children.", dependencyRefs: ["S05_D10", "S05_L12"], formalDeclarationRefs: ["S05_Lem5_17_CountingOneMoreMatchingEdge"] },
    ],
  ),

  S05_L18: proof(
    "Induct through horizontal children, isolating the two shapes where a one-row child prevents the generic half-dimension bound.",
    String.raw`For \(m=1\), the only non-one-row shape is \((1,1)\), and [Definition 5.10](#statement:S05_D10) gives \(\mathsf X_1((1,1))=\{\{1\}\}\). Thus \(z_1=0\le d_{(1,1)}/2\).

Assume \(m\ge2\). By [Lemma 5.17](#statement:S05_L17),

$$
z_m(\lambda)=\sum_{\mu\in\mathsf H_2(\lambda)}z_{m-1}(\mu).
$$

If no horizontal child is one-row, induction bounds every summand by \(d_\mu/2\). The two-box dimension identity in [Lemma 5.12](#statement:S05_L12) includes every horizontal child with its multiplicity, so

$$
z_m(\lambda)\le\frac12\sum_{\mu\in\mathsf H_2(\lambda)}d_\mu
\le\frac12d_\lambda.
$$

A non-one-row parent with a horizontal one-row child is either \((2m-1,1)\) or \((2m-2,2)\). The same recurrence gives

$$
z_m(2m-1,1)=1+z_{m-1}(2m-3,1)=m-1,
$$

starting from \(z_1(1,1)=0\). The one-box dimension recurrence in Lemma 5.12 gives, by induction, \(d_{(N-1,1)}=N-1\); hence \(d_{(2m-1,1)}=2m-1\) and \(d/2-z=1/2\).

For \((2m-2,2)\), first \(z_2(2,2)=1\). For \(m\ge3\), its horizontal children are \((2m-2)\), \((2m-3,1)\), and \((2m-4,2)\), so

$$
z_m=1+(m-2)+z_{m-1}=\binom m2.
$$

Another induction in the one-box recurrence, based at \(d_{(2,2)}=2\), gives \(d_{(N-2,2)}=N(N-3)/2\). Thus \(d_{(2m-2,2)}=m(2m-3)\), and

$$
\frac d2-z=\frac{m(2m-3)-m(m-1)}2=\frac{m(m-2)}2\ge0.
$$

This covers every shape.`,
    [
      { id: "base", text: "Check the unique non-one-row base shape directly from the sign-pattern definition.", dependencyRefs: ["S05_D10"], formalDeclarationRefs: [] },
      { id: "induction", text: "Apply the empty-label recurrence and two-box dimension sum to generic horizontal children.", dependencyRefs: ["S05_L17", "S05_L12"], formalDeclarationRefs: [] },
      { id: "exceptions", text: "Derive the needed dimensions from one-box branching and check the standard and two-row families.", dependencyRefs: ["S05_D10", "S05_L17", "S05_L12"], formalDeclarationRefs: ["S05_Lem5_18_tableau_weightZeroEntries_never_majority"] },
    ],
  ),

  S05_L19: proof(
    "Induct on matching size; generic children contribute at least one fifth, and four boundary shapes admit explicit recurrences.",
    String.raw`We use only the one-box recurrence in [Lemma 5.12](#statement:S05_L12) for the small dimension formulas below. In their natural partition ranges—respectively \(N\ge2\), \(N\ge4\), \(N\ge3\), \(N\ge6\), and \(N\ge5\)—induction from the one-tableau shapes gives

$$
\begin{aligned}
d_{(N-1,1)}&=N-1,&
d_{(N-2,2)}&=\frac{N(N-3)}2,\\
d_{(N-2,1,1)}&=\frac{(N-1)(N-2)}2,&
d_{(N-3,3)}&=\frac{N(N-1)(N-5)}6,\\
d_{(N-3,2,1)}&=\frac{N(N-2)(N-4)}3.
\end{aligned}
$$

Each formula follows by deleting the largest entry and summing the preceding one-box shapes. The last two start with \(d_{(3,3)}=5\) and \(d_{(2,2,1)}=5\); the same recurrence then gives \(d_{(3,2,1)}=16\).

For \(m=2\), the recursion in [Definition 5.10](#statement:S05_D10) gives

$$
\begin{array}{c|ccc}
\lambda&(2,2)&(2,1,1)&(1^4)\\ \hline
d_\lambda&2&3&1\\
h_2(\lambda)&1&1&1.
\end{array}
$$

Thus every base shape satisfies the claim. Assume \(m\ge3\) and use the high-label recurrence of [Lemma 5.17](#statement:S05_L17). Outside the four shapes

$$
(2m-2,2),\quad(2m-2,1,1),\quad(2m-3,3),\quad(2m-3,2,1),
$$

every horizontal child is neither one-row nor standard, and every vertical child is non-one-row. Induction gives at least \(d_\mu/5\) from each horizontal occurrence. [Lemma 5.18](#statement:S05_L18) gives \(d_\mu-z_{m-1}(\mu)\ge d_\mu/2\ge d_\mu/5\) from each vertical occurrence. Lemma 5.12 sums these signed child dimensions to \(d_\lambda\).

For both level-two shapes, the recurrence gives \(h_m=h_{m-1}+(m-1)\), with \(h_2=1\): the new vertical standard child contributes

$$
d_{(2m-3,1)}-z_{m-1}(2m-3,1)=(2m-3)-(m-2)=m-1.
$$

Hence both have \(h_m=\binom m2\). The dimension formulas above give

$$
\begin{aligned}
5\binom m2-d_{(2m-2,2)}&=\frac{m(m+1)}2,\\
5\binom m2-d_{(2m-2,1,1)}&=\frac{(m-1)(m+2)}2,
\end{aligned}
$$

so both surpluses are nonnegative.

For \(\lambda=(2m-3,3)\), the \(m=3\) child calculation gives \(h_3(3,3)=0+(2-1)=1=d_{(3,3)}/5\). For \(m\ge4\), put

$$
D=d_{(2m-3,1)}=2m-3,
\qquad A=d_{(2m-4,2)}=\frac{(2m-2)(2m-5)}2.
$$

Writing \(B=d_{(2m-5,3)}\), the signed children and the generic bounds give

$$
h_m\ge\frac7{10}A+\frac15B,
\qquad d_\lambda=D+2A+B.
$$

Therefore

$$
h_m-\frac15d_\lambda
\ge\frac{3A-2D}{10}
=\frac{(m-3)(6m-7)}{10}\ge0.
$$

Finally take \(\lambda=(2m-3,2,1)\). At \(m=3\), the three relevant children are \((3,1),(2,2),(2,1,1)\); the two signed lists give

$$
h_3=(0+1+1)+((3-1)+(2-1)+(3-0))=8,
$$

while \(d_{(3,2,1)}=16\). For \(m\ge4\), set

$$
\begin{aligned}
D&=d_{(2m-3,1)},& A&=d_{(2m-4,2)},\\
B&=d_{(2m-4,1,1)},& C&=d_{(2m-5,2,1)}.
\end{aligned}
$$

The first three children occur in both signed lists and \(C\) horizontally, so

$$
h_m\ge\frac7{10}(A+B)+\frac15C+(m-1),
\qquad d_\lambda=2D+2A+2B+C.
$$

Substituting \(D=2m-3\), \(A=(2m-2)(2m-5)/2\), and \(B=(2m-3)(2m-4)/2\) leaves

$$
h_m-\frac15d_\lambda
\ge\frac3{10}(A+B)+(m-1)-\frac25D
=\frac{12m^2-40m+35}{10}>0.
$$

All exceptional shapes satisfy the same one-fifth bound.`,
    [
      { id: "dimensions", text: "Derive the required near-row dimension formulas from one-box branching.", dependencyRefs: ["S05_L12"], formalDeclarationRefs: [] },
      { id: "base", text: "Check every rank-four base shape from the sign-pattern recursion.", dependencyRefs: ["S05_D10", "S05_L12"], formalDeclarationRefs: [] },
      { id: "generic", text: "Use induction, the high-label recurrence, the half bound, and signed branching dimensions.", dependencyRefs: ["S05_L12", "S05_L17", "S05_L18"], formalDeclarationRefs: [] },
      { id: "boundary", text: "Compute all four exceptional families, including their low-rank cases and explicit surpluses.", dependencyRefs: ["S05_D10", "S05_L12", "S05_L17", "S05_L18"], formalDeclarationRefs: ["S05_Lem5_19_tableau_even_certificate"] },
    ],
  ),

  S05_L20: proof(
    "Pass from odd shapes to their even one-box children and check the only two level-two exceptions explicitly.",
    String.raw`The odd recursion in [Definition 5.10](#statement:S05_D10) and the one-box dimension identity in [Lemma 5.12](#statement:S05_L12) give

$$
h_m^{\mathrm{odd}}(\lambda)=\sum_{\mu\nearrow\lambda}h_m(\mu),
\qquad d_\lambda=\sum_{\mu\nearrow\lambda}d_\mu.
$$

If \(\lambda\) is neither excluded nor one of \((2m-1,2)\), \((2m-1,1,1)\), every child is neither one-row nor standard. [Lemma 5.19](#statement:S05_L19) then yields the stronger inequality \(h_m^{\mathrm{odd}}(\lambda)\ge d_\lambda/5\).

For \((2m-1,2)\), the children are \((2m-2,2)\) and the standard shape. The displayed sign-pattern recursion, starting with \(h_2(2,2)=1\), gives \(h_m(2m-2,2)=\binom m2\), while the standard child has high count zero. The one-box recurrence gives \(d_{(N-2,2)}=N(N-3)/2\), so

$$
h_m^{\mathrm{odd}}=\binom m2,
\qquad d_{(2m-1,2)}=(2m+1)(m-1).
$$

Consequently

$$
\frac{h_m^{\mathrm{odd}}}{d}-\frac16
=\frac{m}{2(2m+1)}-\frac16
=\frac{m-1}{6(2m+1)}\ge0.
$$

For \((2m-1,1,1)\), the children are \((2m-2,1,1)\) and the standard shape. The same sign-pattern induction gives high count \(\binom m2\), and one-box branching gives \(d_{(N-2,1,1)}=(N-1)(N-2)/2\). Hence

$$
h_m^{\mathrm{odd}}=\binom m2,
\qquad d_{(2m-1,1,1)}=m(2m-1),
$$

and

$$
\frac{h_m^{\mathrm{odd}}}{d}-\frac16
=\frac{m-1}{2(2m-1)}-\frac16
=\frac{m-2}{6(2m-1)}\ge0.
$$

At \(m=2\), the second family is the equality case. These are all non-degree-one exceptions.`,
    [
      { id: "generic", text: "Sum the even one-fifth certificate over ordinary one-box children.", dependencyRefs: ["S05_D10", "S05_L12", "S05_L19"], formalDeclarationRefs: [] },
      { id: "exceptions", text: "Derive the two near-row dimensions and compute both exceptional odd ratios explicitly.", dependencyRefs: ["S05_D10", "S05_L12", "S05_L19"], formalDeclarationRefs: ["S05_Lem5_20_tableau_odd_certificate"] },
    ],
  ),
};
