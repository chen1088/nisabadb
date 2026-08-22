# NisabaDB milestone status

Status date: 2026-08-22

## Product structure

- The primary navigation is Knowledge, Papers, Unsolved, and Train; the brand remains the home link.
- Papers is the active first phase: 2,143 catalog records, a bounded rooted citation-ancestry projection, a processing backlog, and 50-record catalog pagination.
- There is no public Materials/source-shelf architecture. Books, courses, notes, software labs, and other sources are retained only as editorial evidence and per-node lineage behind NisabaDB's rewritten textbook.
- Each gold paper renders one complete dependency graph. Legacy `view` query parameters remain harmless, but main-theorem and topic graph tabs are no longer user-visible. Theorem/result nodes are initially folded so readers choose which statements and proofs to inspect.
- Proof routes distinguish their dependency role (`original`, `minimized`, or `reinterpretation`) from their review state. The current 61 populated routes are reviewed original/source routes; no minimized or reinterpretation route is claimed yet.
- Knowledge is one independently rewritten textbook, not a catalog of textbooks. Its current draft contains 60 written nodes in 20 chapters, arranged both in reading order and by a validated, transitively reduced prerequisite DAG, with 33 canonical notation entries and seven registry-linked references. A separate provisional map contains 126 chapters in 21 parts: 20 map to draft chapters and 106 remain visibly planned and non-clickable. All 60 nodes currently have `initial-rewrite` status; the reviewed count is 0.
- The nested compression atlas currently maps the whole field into 18 candidate common-core clusters across six non-linear bands and 16 overlapping comparison lenses. A validated crosswalk names and links all 31 intake branches, and every representative anchor names an exact source-record ID. It records 35 visible residual decisions and keeps candidate source-route patterns separate from minimized-route hypotheses. No cluster or route is yet labeled administrator-reviewed.
- The exact approved source registry contains 688 fingerprint-locked rows in 31 intake branches. The earlier 662-record research pool was expanded by 26 gap-filling entries before the final list. Required components prevent a multi-volume or multi-part row from being completed with only part of the work. All records are presently edition-unresolved; there are 0 exact editions, 0 inventoried theorem occurrences, and therefore 0 verified source-to-Knowledge mappings. These zeros are deliberate non-omission gates, not missing UI.
- The 93 reviewed paper-local statements remain distinct from the canonical textbook nodes. Reusable content can be rewritten into Knowledge with explicit source lineage, notation normalization, and prerequisite review rather than copied or automatically promoted.
- Train is the re-proving exercise surface. It randomly selects meaningful theorem-like nodes from the paper DAGs for a human or AI to prove, with dependency context and reviewed proof routes available for progressive disclosure.
- A future published paperback is a curated excerpt of important parts of the same canonical Knowledge text, not a separate source collection.
- Unsolved is intentionally empty. The one source conjecture is a literature-review candidate, not a confirmed-current open problem.
- Formal artifacts are now prover-neutral. The 191 current artifacts are Lean 4 declarations; the schema also validates reproducible submissions from other checkers, but automated submission and execution await the worker service.

## Gold rewrites

The featured record is *A Dimension-Free Dictatorship Tester on the Symmetric Group* by Chaowen Guan, Chen Xu, Xiangyu Guo, and GPT-5.5.

| Area | Current state |
| --- | --- |
| Mathematical inventory | 51 nodes: 33 results, 16 definitions/constructions, 2 notation nodes |
| Curated dependency graph | 117 edges, acyclic |
| Human proof coverage | 31/33 theorem-like nodes have complete compressed routes |
| Explicit proof gaps | `S02_T01` Boolean-\(U_1\) classification; `S02_T02` symmetric-group FKN stability |
| Lean source | `chen1088/dict_lean@4b6c455234729dd554df5e35058cdd2940fd2c2b` |
| Lean builds | `DictatorshipTesting` and `AlgebraicLibrary` succeeded |
| Admitted-code scan | No `sorry`, `admit`, `opaque`, or `unsafe` declarations found |
| Direct citation neighborhood | 17/17 actual in-text references represented; 17 provisional pages |
| Incoming citations | Indeterminate: the featured manuscript is unindexed after five provider searches |
| Recursive citation closure | Not complete; the combined durable queue has 2,143 records |

The second gold record is *An Invariance Principle for the Multi-slice, with Applications* by Mark Braverman, Subhash Khot, Noam Lifshitz, and Dor Minzer.

| Area | Current state |
| --- | --- |
| Selection rationale | Most complex provisional research paper: 66 pages and 21 unique numbered results spanning representation theory, couplings, invariance, noisy influence, and conditional PCP hardness |
| Mathematical inventory | 42 nodes: all 21 numbered results, 3 indispensable Section 4 claims, 13 definition/notation nodes, 1 conjecture, and 4 additional imported proof/application inputs |
| Human proof coverage | 5/28 theorem-like nodes have complete compressed routes; all 23 remaining routes are explicitly proof ideas or not-yet-distilled gaps |
| Main theorem route | The top-level triangle-inequality route is complete relative to Claims 4.1--4.3; Claim 4.1's induced-coupling bridge and the deep Lemmas 3.11 and 3.25 remain visible gaps below it |
| Formal status | Statement only; no Lean declarations or formal-verification claims are attached |
| Source pin | `arXiv:2110.10725v2`; TeX SHA-256 `8e8e14cfe1f530e3d80997a9a11ab1b166a97a869b047c211340e0e6e36554f4` |
| Numbered-result extraction | Complete; duplicate restatement environments are treated as aliases, not extra nodes |
| Source audit | 23 statement/proof audit records disclose normalized typos, missing hypotheses, counterexamples, omitted bridges, or unresolved inconsistencies alongside preserved source wording |
| Outgoing references | 48 unique uncommented citation keys, exactly matching 48 bibliography entries and Crossref's reference count |
| Incoming citations | 28 non-XPAC provider-visible records through the split FOCS OpenAlex identity; not asserted to be a deduplicated intellectual-work count |
| Recursive citation closure | Not complete |

## Formal trust boundaries

The development contains two named mathematical inputs:

- `booleanU1_dictator_classification_input`
- `fknStability_input`

Several finite checks also expose Lean's generated `native_decide` trust axiom. Every displayed formal declaration lists its full audited footprint, including the standard logical axioms `propext`, `Classical.choice`, and `Quot.sound`. The site therefore uses granular labels such as `conditional formalization`, `axiom audited`, and `human–formal alignment pending`; it currently makes no `fully certified` claims.

NisabaDB corrects eleven source statements or definitions whose displayed manuscript wording omitted a necessary range. Each record preserves the uncorrected wording in a disclosure rather than silently replacing it:

- Theorem 2.1 is displayed for `n >= 1`; the Lean wrapper assumes the same, its named input assumes `3 <= n`, and the small positive ranks are handled separately. The unrestricted formal `n = 0` formulation is false.
- Theorem 2.2 is displayed for `n >= 4`, matching its Lean wrapper and named FKN input.
- Proposition 4.5 and Lemma 4.6 are displayed for `n >= 4`, matching their proofs and Lean declarations. Proposition 4.5's unrestricted claim is false at `n = 3`.
- Definition 5.10 makes `m >= 1` explicit; Lean additionally supplies a coherent `m = 0` extension.
- Lemma 5.12's matching-count clause, Lemmas 5.13 and 5.15, Proposition 5.16, and Lemma 5.18 make `m >= 1` explicit because their matching-indexed objects are introduced only in that range.
- Lemma 5.17 is displayed for `m >= 2`, the range in which the manuscript's recursive expression is defined.
- Theorem 2.1 attribution differs between the manuscript (Ellis–Friedgut–Pilpel 2011 and Ellis–Filmus–Friedgut 2017) and `dict_lean/ASSUMPTIONS.md` (Filmus 2021, Theorem 2.8). NisabaDB preserves the discrepancy pending review.
- Human–formal route alignment has not yet been signed off by a mathematical reviewer, even where both representations are present.

## Citation coverage

The author manuscript contains 19 bibliography entries, but only 17 are cited in the text. NisabaDB represents exactly those 17 as direct outgoing edges. `DFLLV2021` and `BowmanDeVisscherOrellana2013` remain audit-only bibliography entries and are not falsely presented as direct citations.

The featured manuscript has no DOI, arXiv ID, OpenAlex ID, DataCite record, or Semantic Scholar match. OpenAlex, Crossref, arXiv, DataCite, and Semantic Scholar returned no exact target identity. Consequently, zero provider-visible incoming edges does **not** establish zero real citations. The featured record is blocked on identity resolution. Of its 17 known outgoing neighbors, 16 have OpenAlex identities and are independently runnable; the James–Kerber book record is also blocked pending resolution of a provider work identity.

For the multislice paper, comment-stripped TeX contains 77 citation commands and 48 unique keys; the `.bbl` has exactly the same 48 keys, and Crossref independently reports 48 references. All 48 outgoing endpoints are represented. The canonical journal OpenAlex record reports only 45 references, 23 of whose IDs did not resolve during audit, so it is not allowed to overwrite the source count.

Incoming identity is split across journal, arXiv, and FOCS provider records. The journal and arXiv records returned zero OpenAlex incoming works; the FOCS identity returned 28 non-XPAC records (29 with XPAC, where the extra record is a later-version duplicate). NisabaDB persists the 28 provider records as version-family evidence and labels them `provider-visible-only`, not as a complete deduplicated intellectual-work count.

The first bounded recursive run processed ten identified papers and expanded the corpus to 2,143 papers and 2,284 citation records. The queue has one record per paper: 2,103 `metadata-fetched`, 36 blocked on stable provider identity, 3 `complete-direct-neighborhood`, and 1 `neighbors-fetched` pending deduplication/review. Twelve initially blocked records were reactivated after exact merged OpenAlex identities made them runnable. Raw provider envelopes are retained in losslessly gzip-compressed form. Exact identifiers—not title similarity—control merging.

These citation records are bibliographic evidence, not mathematical prerequisite edges. The raw directed network may contain cycles; the Papers interface exposes a bounded, cycle-safe ancestry projection for navigation without asserting that the full citation network is a DAG.

## Editorial source lineage and notation

The current textbook records seven official registry-linked references spanning arithmetic, proof, discrete mathematics, sets, functions, abstract-algebra notation, and linear algebra. They are comparison evidence attached to rewritten nodes, not a public library, a list of assignments, or the architecture of Knowledge. The exact source-theorem inventory remains at 0; these lesson references do not claim theorem-level extraction or coverage.

The initial compression hypotheses remain editorial questions:

1. selected algebra/functions, one proof bridge, and the MIT discrete-math core may replace repeated portions of several conventional introductory courses;
2. algebra may admit a smaller common language organized around executable structures, structure-preserving maps, invariants, and decomposition;
3. representation-first and tableaux-first routes to Young diagrams should be compared rather than accumulated;
4. much finite Boolean analysis may avoid making a full measure-theory course a mandatory ancestor.

The current source-lineage entries are citations and comparison points, not permission claims. Any future ingestion or adaptation must review access and derivative rights separately. NisabaDB writes independent tutorials and examples rather than assuming that free-to-read material may be reproduced.

The living textbook has one notation registry. Each entry records NisabaDB's canonical symbol and meaning, its first knowledge node, and aliases or conflicts found in source traditions. Knowledge nodes point to those entries and to their source lineage, while their main exposition uses only the canonical convention.

## Remaining mathematical work

1. Distill complete proofs of the two imported Section 2 inputs from their primary literature and expose any additional prerequisite nodes they need.
2. Resolve the Theorem 2.1 attribution discrepancy and rank-edge cases with the authors/formalizers.
3. Perform independent mathematical review of the 31 compressed proofs.
4. Review human statement-to-Lean and proof-step-to-declaration alignment before elevating any status.
5. Add examples/nonexamples to more definition nodes where they materially improve understanding.
6. For the multislice paper, independently distill Theorem 3.10, Claim 4.1, and Lemmas 3.11, 3.25, 6.13, 6.16, and 6.21; reconcile the documented source inconsistencies and induced-coupling bridges before marking any of them complete.
7. Supply the two proofs explicitly omitted by the source (Theorems 5.2 and 6.29), or retain their current gap status.
8. Supply the exact-statistics connectedness and projection-equivariance bridges in Theorem 6.7, audit the connectedness condition used for Corollary 1.18, and expand Corollary 1.19 beyond the source's proof sketch.
9. Continue the recursive citation queue, resolve the 36 identity-blocked records (starting with exact DOI/arXiv candidates), and promote provisional papers to gold only after source-level mathematical review.
10. Add process-safe leases/locks, bounded provider pagination, rate budgets, retries, and recovery before distributing queue work across DigitalOcean nodes.
11. Split the static client artifact or add a catalog service before scaling substantially beyond the current 2,143 records.
12. Expand the canonical textbook by rewriting reusable concepts from source evidence and paper proof DAGs, comparing overlaps, notation conflicts, alternate routes, and actual prerequisite costs before merging nodes.
13. Resolve all 688 candidate records and every required volume/part component to exact editions or an independently administrator-reviewed duplicate, build immutable unit manifests, independently scan every unit, and give every theorem-like occurrence a permanent address plus a reviewed current-Knowledge or residual target before claiming source coverage.
14. Mathematically and pedagogically review the 60 current Knowledge nodes, then write the 106 planned chapters while repeatedly minimizing the prerequisite DAG and avoiding concepts that already have a canonical home.
15. Define and audit Train eligibility so random exercises select meaningful paper results with enough exposed context to be attempted and never present a missing or source-omitted proof as a solved reference route.

These are labeled gaps, not hidden completion claims.
