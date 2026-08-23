# NisabaDB milestone status

Status date: 2026-08-23

## Current phase: source-book theorem graphs

The user's 2026-08-22 direction supersedes the continuation order in the earlier cloud handoff. Phase I is now to construct a source-faithful dependency graph for every theorem in every approved book or required volume/part component. Compression, simplification, equivalence merging, and expansion of the canonical Knowledge textbook are Phase II and remain frozen until the source graphs exist.

The exact workload currently represented by the approved intake is:

| Phase-I gate | Current state |
| --- | ---: |
| Approved source rows | 688 |
| Required book/volume components | 717 |
| Individual book graph files | 717 / 717 |
| Candidate exact editions identified | 2 / 717 |
| Components with complete theorem inventories | 0 / 717 |
| Components with independently reviewed dependency graphs | 0 / 717 |
| Candidate source units | 225 |
| Captured / reviewed source-unit inventories | 225 / 0 |
| Candidate theorem-like / support nodes | 13,169 / 1,919 |
| Candidate / reviewed source dependency edges | 35,757 / 0 |
| Unresolved tagged proof references | 3,239 |

The provisional 126-chapter roadmap is not corpus coverage and is not a target to enlarge now. It is an early Phase-II hypothesis for a future compressed NisabaDB book. The 717 source components must first retain their own uncompressed theorem and support-node graphs in individual JSON files.

The first pipeline pilot is `S0060`, Oscar Levin's *Discrete Mathematics: An Open Introduction*. Its official PreTeXt source is pinned to commit `730e5e3b96094148818603041222df6f3d1d96ba`. A deterministic, comment-aware pass found 109 active source files, captured an inventory for all 109 (including 93 candidate theorem-free attestations), found 38 explicitly tagged theorem-like nodes and 74 definition/notation support nodes, and retained three explicit proof-xref dependency candidates. This is an unreviewed candidate extraction, not a complete graph: 35 theorem-like nodes still have no route, exercise-embedded results still need semantic inventory, and no unit, edge, or extraction has independent review. The edition-level source says CC-BY-NC-SA-4.0 while the repository-level `LICENSE` says CC-BY-SA-4.0; the individual book JSON preserves that conflict for review.

The dense-book checkpoint is `S0262`, *The Stacks Project*. The official LaTeX source is pinned at tag-synchronized commit `ed88ff783bcb4dd9a28518a33b028841094009cf`, because the later upstream head contains six new lemmas not yet assigned permanent Stacks tags. The importer inventories all 116 chapters and captures 13,131 theorem-like nodes, 1,721 definitions, 124 formal situations/assumptions, 35,754 explicit proof-use edges, and 11,123 candidate source-proof routes. The graph has zero example nodes: 449 example environments, 386 exercises, and 1,048 remark environments are explicitly excluded. The 3,239 distinct tagged proof targets outside the strict node policy remain unresolved references, and 2,008 theorem-like nodes remain unrouted. This is a reproducible extracted graph, not an independently reviewed or complete one.

The prior `S0002` Pressbooks checkpoint was rejected because its heuristic support inventory was dominated by worked examples in an elementary-teacher methods text. Its individual JSON file has been restored to the neutral placeholder state, so none of those examples or candidate counts remain in Phase-I progress.

Phase I proceeds in this order:

1. Give every required source component its own stable JSON graph file and index it from a small manifest.
2. Resolve the component to an exact edition or an independently reviewed duplicate, recording access, license, stable locator, and artifact fingerprint.
3. Build an immutable chapter/section/page/source-file or web-node manifest.
4. Inventory every formal theorem, lemma, proposition, corollary, claim, and named result together with every definition, construction, assumption, or external input needed by those proofs. Worked examples and routine exercises are excluded; a genuinely proof-used formal claim inside one must be lifted and reviewed as a claim, not imported as an example node.
5. Extract every direct source proof dependency with its route, locator, evidence, extractor identity, and review state. Candidate edges remain visibly distinct from reviewed edges.
6. Mark a component graph complete only after every source unit and every theorem-like node has an independently reviewed dependency decision or explicit root/external-input attestation.
7. Begin cross-source equivalence matching, compression, simplification, and canonical textbook design only after the Phase-I gate passes.

## Cloud continuation snapshot

This file is the handoff for continuing NisabaDB from another machine or a cloud development environment.

- Canonical repository: `https://github.com/chen1088/nisabadb`
- Canonical branch: `main`; continue from `origin/main`, not from an old local checkout or an unmerged branch.
- Live site: `https://chen1088.github.io/nisabadb/`
- Live Knowledge book: `https://chen1088.github.io/nisabadb/knowledge`
- Dense-book checkpoint started from `779edbc2709163ecda0c95217df22b107a3d62d2` (`Build S0002 Pressbooks graph checkpoint`); that S0002 extraction is superseded and removed by this checkpoint.
- Deployment: every push to `main` runs `.github/workflows/deploy-pages.yml`, executes the full check, builds with `VITE_BASE_PATH=/nisabadb/`, and publishes GitHub Pages.
- Last verified deployment before this checkpoint: `https://github.com/chen1088/nisabadb/actions/runs/32612561177` completed successfully.
- Hosting boundary: the public site is a static browser application. It currently has no runtime backend, cloud secrets, DigitalOcean worker, or proof-submission service.
- Required runtime: Node.js 24 and the committed npm lockfile.
- Current pre-push verification: 17 test files and 138 tests pass; lint and the production build pass, and the build publishes all 717 lazy per-book graphs including the 67 MB S0262 JSON.
- The working branch began this checkpoint clean and synchronized with `origin/main` at `779edbc`; publish completion still requires the new commit's Pages workflow and live-route verification.

Resume with:

```sh
git clone https://github.com/chen1088/nisabadb.git
cd nisabadb
git switch main
git pull --ff-only origin main
npm ci
npm run check
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`. Before publishing, run `npm run check`; a push to `main` is not complete until the Pages workflow succeeds and the live route is verified. Do not commit `dist/`.

Read these files before changing the mathematical model:

| File | Authority |
| --- | --- |
| `STATUS.md` | Current verified claims, open gaps, and continuation order |
| `ARCHITECTURE.md` | Data ownership, schema boundaries, trust model, and route structure |
| `src/data/knowledge.json` | The 60 actually written Knowledge lessons, chapter order, notation use, direct prerequisite edges, and source lineage |
| `src/data/knowledge-roadmap.ts` | The provisional 126-chapter map; Draft mappings are not review claims and Planned entries are not lessons |
| `src/data/knowledge-schema.ts` and `src/data/knowledge-roadmap-schema.ts` | Executable invariants for the written book and its planning map |
| `src/data/compression.json` | Candidate whole-field compression clusters and residual hypotheses |
| `data/knowledge/source-records.json` | The approved 688-record reference registry |
| `data/books/manifest.json` | The generated index of all 717 individual book/volume graph files and their Phase-I counts |
| `data/books/S####/<component>.json` | One source-faithful theorem dependency graph per actual book/volume component |
| `src/data/corpus.json` | Generated public paper corpus; regenerate it from the immutable inputs described in `README.md` rather than hand-editing it |
| `src/pages/KnowledgePage.tsx` | Reader-first Knowledge interface; references must remain subordinate to the rewritten book |

Non-negotiable status boundaries:

1. `initial-rewrite` means written but unreviewed. All 60 Knowledge lessons have that status; the reviewed count is 0.
2. Only 20 roadmap chapters contain draft lessons. The other 106 are Planned, non-clickable, and must not be presented as written.
3. Source books are Phase-I graph units and non-omission evidence, not chapters of the eventual rewritten curriculum. Each required component owns an individual JSON graph.
4. The 688 source rows expand to 717 required components. Two candidate editions have been identified, but none of the 717 components yet has a complete theorem inventory or independently reviewed source graph.
5. The 60-node Knowledge prerequisite graph is authoritative for written material and must remain acyclic and transitively reduced. A convenient reading order does not create a dependency.
6. The 126 roadmap chapters and candidate compression clusters are frozen Phase-II hypotheses. Do not treat their count as source coverage or expand them before the source graphs are built.
7. The static GitHub Pages application is deployed. The distributed DigitalOcean prompt-worker and prover-submission service are not implemented or deployed yet.

Default continuation order is the seven-step Phase-I sequence above. Do not write `R003`, enlarge the 126-chapter roadmap, or perform new compression work while source-book graph construction is the active phase.

## Product structure

- The primary navigation is Knowledge, Papers, Unsolved, and Train; the brand remains the home link.
- Source-book theorem-graph extraction is the active phase. Papers remains a working two-paper prototype for graph shape, proof routes, and review boundaries.
- There is no public Materials/source-shelf architecture. Books, courses, notes, software labs, and other sources are retained only as editorial evidence and per-node lineage behind NisabaDB's rewritten textbook.
- Each gold paper renders one complete dependency graph. Legacy `view` query parameters remain harmless, but main-theorem and topic graph tabs are no longer user-visible. Theorem/result nodes are initially folded so readers choose which statements and proofs to inspect.
- Proof routes distinguish their dependency role (`original`, `minimized`, or `reinterpretation`) from their review state. The current 61 populated routes are reviewed original/source routes; no minimized or reinterpretation route is claimed yet.
- Knowledge is a frozen Phase-II prototype: 60 written nodes in 20 chapters, 33 notation entries, and 97 prerequisite edges. Its separate 126-chapter map contains 20 draft mappings and 106 planned entries; 126 is neither the number of source chapters nor a coverage target. All 60 nodes remain `initial-rewrite`; the reviewed count is 0.
- The compression atlas is also a frozen Phase-II prototype: 18 candidate common-core clusters, 16 comparison lenses, and 35 residual decisions. No cluster or route is administrator-reviewed.
- The exact approved registry contains 688 fingerprint-locked rows in 31 intake branches and 717 required components. Phase-I storage is one JSON graph per component plus a small aggregate manifest. S0060 and S0262 together contribute two pinned candidate editions, 225 source units, 13,169 theorem-like nodes, 1,919 support nodes, and 35,757 candidate edges; 715 components still await editions and all 717 graphs remain incomplete and unreviewed.
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

The current textbook records seven official registry-linked references spanning arithmetic, proof, discrete mathematics, sets, functions, abstract-algebra notation, and linear algebra. They are comparison evidence attached to rewritten nodes, not a public library, a list of assignments, or the architecture of Knowledge. The Phase-I source corpus now has 13,169 candidate theorem-like nodes across S0060 and S0262, but its complete and independently reviewed theorem-inventory count remains 0 of 717 components; the seven lesson references do not add to that count.

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
12. Continue Phase I across all 717 component files: resolve exact editions, build immutable unit manifests, record an inventory decision or theorem-free attestation for every unit, and give every theorem-like result a permanent local address.
13. Complete and independently review every source-local dependency route or explicit root/external-input attestation. A Phase-I graph closes without requiring a Knowledge node, canonical-claim mapping, or residual disposition.
14. Keep the 126-chapter roadmap and all new compression/simplification work frozen until the source-graph gate passes; then derive a new canonical textbook plan from the complete uncompressed corpus.
15. Define and audit Train eligibility so random exercises select meaningful paper results with enough exposed context to be attempted and never present a missing or source-omitted proof as a solved reference route.

These are labeled gaps, not hidden completion claims.
