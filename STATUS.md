# NisabaDB milestone status

Status date: 2026-08-27

## Current phase: source-book theorem graphs

The user's 2026-08-22 direction supersedes the continuation order in the earlier cloud handoff. Phase I is now to construct a source-faithful dependency graph for every theorem in every approved book or required volume/part component. Compression, simplification, equivalence merging, and expansion of the canonical Knowledge textbook are Phase II and remain frozen until the source graphs exist.

The exact workload currently represented by the approved intake is:

| Phase-I gate | Current state |
| --- | ---: |
| Approved source rows | 688 |
| Required book/volume components | 717 |
| Indexed component identities | 717 / 717 |
| Candidate exact editions identified / administrator-verified | 4 / 0 |
| Components with complete theorem inventories | 0 / 717 |
| Components with independently reviewed dependency graphs | 0 / 717 |
| Candidate source units | 335 |
| Captured / reviewed source-unit inventories | 335 / 0 |
| Candidate theorem-like / support nodes | 13,527 / 2,051 |
| Candidate / reviewed source dependency edges | 36,423 / 0 |
| Unresolved source-reference records | 2,557 |

The provisional 126-chapter roadmap is not corpus coverage and is not a target to enlarge now. It is an early Phase-II hypothesis for a future compressed NisabaDB book. The 717 source components must first retain their own uncompressed theorem and support-node graphs under stable component identities. Four candidates now use ignored local sharded v1.1 storage; all 717 tracked manifest entries have absent artifacts. A generated exact-source queue covers all 717 identities, but its four sparse proposals are still candidates and zero editions or distributions are administrator-verified.

The chronologically first pipeline pilot is `S0060`, Oscar Levin's *Discrete Mathematics: An Open Introduction*. Its official PreTeXt source is pinned to commit `730e5e3b96094148818603041222df6f3d1d96ba`. A deterministic, comment-aware pass found 109 active source files, captured an inventory for all 109 (including 93 candidate theorem-free attestations), found 38 explicitly tagged theorem-like nodes and 72 definition/notation support nodes, and retained three explicit proof-xref dependency candidates. This is an unreviewed candidate extraction, not a complete graph: 35 theorem-like nodes still have no route, exercise-embedded results still need semantic review, and no unit, edge, or extraction has independent review. The edition-level source says CC-BY-NC-SA-4.0 while the repository-level `LICENSE` says CC-BY-SA-4.0; the individual book JSON preserves that conflict for review.

`S0091`, David Austin's *Understanding Linear Algebra: PROTEUS Version, 2026 Update*, is pinned to the official PreTeXt repository at commit `a895a539d9972bde1cc85aea5e9516fc7b0f4b25`. The candidate inventories 78 active content files, including 54 theorem-free attestations, and captures 65 theorem-like nodes and 38 support nodes. No proof contains a resolvable theorem xref, so there are zero candidate edges and all 65 results remain dependency-pending rather than being called roots. The source traversal excludes 382 embedded PreFigure XML asset includes and graph-like tags nested in pedagogical/remark containers. The active-source CC-BY-4.0 metadata remains unreviewed.

`S0164`, Thomas W. Judson's *Abstract Algebra: Theory and Applications, Annual Edition 2026*, is pinned to the official PreTeXt repository at commit `043274d5dead03ff007a461ffe4c2b8477be1248`. The candidate inventories 32 content files, captures 277 theorem-like and 71 support nodes, and records 70 explicit proof-xref dependency candidates in 58 routes. Twenty-one proof xrefs remain unresolved and 219 theorem-like nodes remain dependency-pending. The active source closure contains both GFDL-1.2-or-later and GFDL-1.3-or-later markers, while the repository `COPYING` file states GFDL-1.3-or-later; the importer selects no governing SPDX license, and the source ledger keeps an open license blocker.

The dense-book checkpoint is `S0262`, *The Stacks Project*. It is the first and highest-priority book under the descending-complexity work order; its raw source-proof/xref pass is now materialized, and no second-ranked successor has been selected or started. The official LaTeX source is pinned at tag-synchronized commit `ed88ff783bcb4dd9a28518a33b028841094009cf`, because the later upstream head contains six new lemmas not yet assigned permanent Stacks tags. The importer inventories all 116 chapters and stores 16,288 nodes in three disjoint classes: 13,157 theorem-like nodes, 1,894 mathematical support nodes, and 1,237 raw source artifacts. The theorem-like inventory comprises 12,587 lemmas, 330 propositions, 214 theorems, and 26 exact source-audited claims; support comprises 1,739 definitions, 134 assumptions/situations, and 21 constructions. Raw artifacts preserve 572 sections, 370 remarks, 3 plural-remark environments, 171 equations, 119 examples, and 2 list items that proofs cite without treating them as mathematical nodes.

The raw graph has 11 typed external theorems, 38,904 candidate edges, and 13,201 captured source or alternate proof routes. Its 38,644 explicit proof-xref edges include 2,435 `source-reference` provenance edges to raw artifacts; 260 exact owner-specific audited semantic edges comprise 71 named-result, 6 curated-claim, 12 external-citation, 109 deictic, 25 occurrence-level recall-bundle, and 37 section-delegation dependencies. Exact audits suppress 16 notation, optional, conclusion/restatement, or goal-statement proof xrefs and 11 nondependency citations. Every tagged proof xref is structurally accounted for, every theorem-like node has a captured source route, and 1,737 empty source routes record proofs with no resolved xref without declaring them roots. Six bibliographic proof citations remain unresolved. This finishes raw capture for the first book, not its mathematical review: 1,883 theorem-like nodes still lack a route with a mathematical prerequisite, raw artifacts still require classification/decomposition/suppression, and no extraction, dependency, or graph-completeness decision has independent approval.

The earlier bounded S0262 slice resolves exactly fifteen section-delegating proof occurrences without introducing a global alias. Owners `03Z1`, `0CFQ`, and `03XD` use the exact target triple `03BX`/`03H5`/`03H4`; `04P1` uses `03BX`/`03BZ`; and `0E07` uses the points definition `03BU`. Owners `06U1`, `0CHX`, `0512`, `0CI1`, and `0CI6` use `04XL`/`04XI`/`04XH`, while `0E86` uses only the topology theorem `04XL`. Owners `04ZX`, `0501`, `0CHR`, and `0CHV` use Tag `045C`. The two points-section labels now have no unresolved owner because every occurrence was audited individually; the properties-of-morphisms section still has 24 unresolved contexts, proving that no section-wide mapping leaked into the graph.

The preceding five-edge batch resolves the exact Section Tag `0261` occurrences of `0BB4`, `06QZ`, `07SK`, and `0DUJ` to Tag `0262`: respectively the quotient identifying $U \mathbin{\times_X} Z$, the presentation equality $X=U/R$, the presentation $Y=W/R'$, and the coequalizer used to glue the compatible $h_i$ into a unique $Y\to W$. It also resolves `09CN`'s Section Tag `07JV` invocation to the snake lemma in Tag `07JW`. Every mapping is guarded by the pinned source revision, owner statement hash, full proof hash, permanent section tag, and exact reference occurrence; neither section label is globally aliased. The source's omissions remain visible rather than being silently filled: `0BB4` retains missing functoriality for descent to $Z\to X^\nu$, `07SK` retains the omitted statement that $R'$ is of finite presentation over $R$, and `09CN` retains omitted bilinearity details plus an unresolved appeal to an excluded free-module example. The `06QZ` and `0DUJ` routes remain captured candidates with implicit prerequisites and independent review pending. These five edges add one source route and remove one theorem from the dependency-pending count; they do not complete any reviewed graph.

The previous source audit promotes the exact labeled Cauchy-Binet prose/list span to local claim Tag `0F0K` and resolves the single explicit occurrence in owner `07DQ`'s proof to that claim. The edge is a normal explicit proof-xref dependency, not a semantic override, and no general item-label promotion is permitted. The source states the Cauchy-Binet determinant formula but supplies no proof there, so `0F0K` has no route and remains proof debt. Owner `07DQ` gains a captured source route through the claim, while the new route-less claim takes its place in the dependency-pending set at that checkpoint. The claim span, owner statement, full owner proof, source revision, and exact reference occurrence are hash-guarded. Neither node, edge, nor route has independent review, and this batch does not complete the Stacks graph.

The final bounded promotion batches add exact item/equation/remark claims and proof-used assumption, definition, and construction spans only where their pinned source ranges and owner inventories support that classification. All remaining proof-referenced excluded labels are stored as raw source artifacts with exact locators and hashes; owner-specific semantic decompositions and nondependency decisions remove only their own artifact edges. This prevents a section, remark, equation, example, or item from becoming mathematical knowledge merely because a proof cites its label, while still making the original dependency route non-omissive.

The prior `S0002` Pressbooks checkpoint was rejected because its heuristic support inventory was dominated by worked examples in an elementary-teacher methods text. Its artifact is absent and its root-manifest entry has neutral queue state, so none of those examples or candidate counts remain in Phase-I progress.

A separately audited PreTeXt candidate is `S0072`, *Active Prelude to Calculus*, but it is not the second book under the descending-complexity order and has not been imported. Its exact source states CC-BY-SA-4.0 while the general project page links CC-BY-SA-2.0; that discrepancy must be recorded before any import. Current holds are explicit rather than silently skipped: `S0027` mixes partially released Edition 3 and Edition 2 parts; the located `S0043` repository says it is an unofficial adaptation; `S0062` states conflicting CC-BY-NC-SA 3.0 US and 4.0 licenses; `S0073` needs component-aware edition selection; and `S0400` has both license and changing online/print-edition ambiguity.

Phase I proceeds in this order:

1. Give every required source component a stable manifest identity and store every populated graph in deterministic, size-bounded JSONL shards before dense extraction fans out.
2. Resolve the component to an exact edition or an independently reviewed duplicate, recording access, license, stable locator, and artifact fingerprint.
3. Build an immutable chapter/section/page/source-file or web-node manifest.
4. Inventory every formal theorem, lemma, proposition, corollary, claim, and named result together with every definition, construction, assumption, or external input needed by those proofs. Worked examples and routine exercises are excluded; a genuinely proof-used formal claim inside one must be lifted and reviewed as a claim, not imported as an example node.
5. Extract every direct source proof dependency with its route, locator, evidence, extractor identity, and review state. Candidate edges remain visibly distinct from reviewed edges.
6. Mark a component graph complete only after every source unit and every theorem-like node has an independently reviewed dependency decision or explicit root/external-input attestation.
7. Begin cross-source equivalence matching, compression, simplification, and canonical textbook design only after the Phase-I gate passes; formulate the simplified canonical results in Lean 4 only after that Phase-II selection.

## Local continuation snapshot

This file is the handoff for continuing NisabaDB in the current local checkout. GitHub remains the version-control and static-publication target. Raw graph work is data-only, and only user-approved checkpoints are pushed to `main`.

- Canonical repository: `https://github.com/chen1088/nisabadb`
- Canonical branch: `main`; continue from `origin/main`, not from an old local checkout or an unmerged branch.
- Live site: `https://chen1088.github.io/nisabadb/`
- Live Knowledge book: `https://chen1088.github.io/nisabadb/knowledge`
- Dense-book checkpoint started from `779edbc2709163ecda0c95217df22b107a3d62d2` (`Build S0002 Pressbooks graph checkpoint`); that S0002 extraction is superseded and removed by this checkpoint.
- Deployment: every push to `main` runs `.github/workflows/deploy-pages.yml`, executes the full check, builds with `VITE_BASE_PATH=/nisabadb/`, and publishes GitHub Pages.
- Superseded deployment: `https://github.com/chen1088/nisabadb/actions/runs/33123258523` completed for `f6e4c32`, but that commit kept rights-unreviewed raw graphs in public Git even though Pages returned 404. Do not use it as publication-boundary evidence.
- Hosting boundary: the public site is a static browser application. It currently has no runtime backend, cloud secrets, DigitalOcean worker, or proof-submission service.
- Required runtime: Node.js 24 and the committed npm lockfile.
- Current validation: lint passes; 22 test files / 222 tests pass; the combined 30-test graph/source-ledger/boundary check validates all 717 identities, four sparse source records, four ignored local graph candidates, 32 local shards, four candidate editions, zero verified editions or distributions, and both open license blockers. Git tracks only `data/books/manifest.json` under `data/books`; that manifest has zero payload paths, and the production build remains queue-only.
- Verified rights-boundary deployment: `https://github.com/chen1088/nisabadb/actions/runs/33124750143` completed for remediation commit `c282afe6f0d6b99d672eab5c839814b733b06ee8`; later status-only commits do not change that application/data payload.
- Live verification for `c282afe`: the public queue manifest returned 200 with 717 components, zero artifacts, and zero theorem/dependency counts; representative Pages graph/ledger paths and representative current-`main` raw GitHub graph paths returned 404.
- Removing payloads from current `main` does not erase their blobs from earlier public commits. A full historical purge would require a separately authorized history rewrite and force-push; none has been performed.

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
| `data/book-sources/manifest.json` | Generated 717-component source-resolution queue; sparse records are candidates until independent administrator approval |
| `data/book-sources/S####/<component>.json` | Authored source/duplicate proposals, license blockers, importer assessments, and hash-bound review decisions; unresolved components have no file |
| `data/books/manifest.json` | Queue-only public index of all 717 book/volume components; every tracked `artifactPath` is null |
| `data/books/S####/<component>.json` | Canonical ignored local v1.1 candidate index; its sibling directory holds content-addressed shards and neither is tracked |
| `src/data/corpus.json` | Generated public paper corpus; regenerate it from the immutable inputs described in `README.md` rather than hand-editing it |
| `src/pages/KnowledgePage.tsx` | Reader-first Knowledge interface; references must remain subordinate to the rewritten book |

Non-negotiable status boundaries:

1. `initial-rewrite` means written but unreviewed. All 60 Knowledge lessons have that status; the reviewed count is 0.
2. Only 20 roadmap chapters contain draft lessons. The other 106 are Planned, non-clickable, and must not be presented as written.
3. Source books are Phase-I graph units and non-omission evidence, not chapters of the eventual rewritten curriculum. Each required component owns a stable manifest identity; S0060, S0091, S0164, and S0262 now own ignored local sharded v1.1 data directories, while Git stores only metadata and hashes.
4. The 688 source rows expand to 717 required components. Four candidate editions have been identified, zero are administrator-verified, and none of the 717 components yet has a complete theorem inventory or independently reviewed source graph.
5. The 60-node Knowledge prerequisite graph is authoritative for written material and must remain acyclic and transitively reduced. A convenient reading order does not create a dependency.
6. The 126 roadmap chapters and candidate compression clusters are frozen Phase-II hypotheses. Do not treat their count as source coverage or expand them before the source graphs are built.
7. The static GitHub Pages application is deployed. The distributed DigitalOcean prompt-worker and prover-submission service are not implemented or deployed yet.

Default continuation order is the seven-step Phase-I sequence above. The ignored local v1.1 checkpoint has exact identity, record, evidence, reference, and logical-digest parity on S0060, S0091, S0164, and S0262. The tracked v1.2 graph manifest preserves all 717 identities with null artifact paths while separately reporting source-route and mathematical-dependency debt; the source-resolution manifest records four candidate editions and graph hashes without redistributing raw payloads. The next raw extraction may now select the second source by descending complexity, while S0262's mathematical classification and independent-review debt stays explicit. Do not write `R003`, enlarge the 126-chapter roadmap, perform new compression work, or begin textbook-wide Lean 4 formulation during raw source-book graph construction.

## Product structure

- The primary navigation is Knowledge, Papers, Unsolved, and Train; the brand remains the home link.
- Source-book theorem-graph extraction is the active phase. Papers remains a working two-paper prototype for graph shape, proof routes, and review boundaries.
- There is no public Materials/source-shelf architecture. Books, courses, notes, software labs, and other sources are retained only as editorial evidence and per-node lineage behind NisabaDB's rewritten textbook.
- Each gold paper renders one complete dependency graph. Legacy `view` query parameters remain harmless, but main-theorem and topic graph tabs are no longer user-visible. Theorem/result nodes are initially folded so readers choose which statements and proofs to inspect.
- Proof routes distinguish their dependency role (`original`, `minimized`, or `reinterpretation`) from their review state. The current 61 populated routes are reviewed original/source routes; no minimized or reinterpretation route is claimed yet.
- Knowledge is a frozen Phase-II prototype: 60 written nodes in 20 chapters, 33 notation entries, and 97 prerequisite edges. Its separate 126-chapter map contains 20 draft mappings and 106 planned entries; 126 is neither the number of source chapters nor a coverage target. All 60 nodes remain `initial-rewrite`; the reviewed count is 0.
- The compression atlas is also a frozen Phase-II prototype: 18 candidate common-core clusters, 16 comparison lenses, and 35 residual decisions. No cluster or route is administrator-reviewed.
- The exact approved registry contains 688 fingerprint-locked rows in 31 intake branches and 717 required components. Its v1.2 queue-only graph manifest has 0 payload artifacts and 717 null paths. Ignored local S0060, S0091, S0164, and S0262 use 32 content-addressed JSONL shards (largest 5,242,802 bytes) behind stable component indexes and contribute 335 source units, 13,537 theorem-like nodes, 2,075 mathematical support nodes, 1,237 raw source artifacts, and 38,977 candidate edges. All 717 graphs remain incomplete and unreviewed. The tracked source-resolution queue has four candidate exact-edition/importer-hash records, zero verified selections or distributions, and open license blockers on S0060 and S0164.
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

The current textbook records seven official registry-linked references spanning arithmetic, proof, discrete mathematics, sets, functions, abstract-algebra notation, and linear algebra. They are comparison evidence attached to rewritten nodes, not a public library, a list of assignments, or the architecture of Knowledge. The Phase-I source corpus now has 13,537 candidate theorem-like nodes across S0060, S0091, S0164, and S0262, but its complete and independently reviewed theorem-inventory count remains 0 of 717 components; the seven lesson references do not add to that count.

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
12. Continue Phase I across all 717 components through the source-resolution queue: resolve exact editions or reviewed duplicates, clear acquisition/license/importer blockers, build immutable unit manifests, record an inventory decision or theorem-free attestation for every unit, and give every theorem-like result a permanent local address. New importers must emit the v1.1 sharded format and pass exact logical reconstruction checks.
13. Complete and independently review every source-local dependency route or explicit root/external-input attestation. A Phase-I graph closes without requiring a Knowledge node, canonical-claim mapping, or residual disposition.
14. Keep SQLite, DuckDB, search indexes, and compressed release/object-store bundles derived and non-authoritative; raw graph shards remain outside the Pages and reader-UI payload.
15. Keep the 126-chapter roadmap and all new compression/simplification work frozen until the source-graph gate passes; then derive the canonical textbook from the complete uncompressed corpus and attach Lean 4 formulations to its simplified theorem identities with source traceability.
16. Define and audit Train eligibility so random exercises select meaningful paper results with enough exposed context to be attempted and never present a missing or source-omitted proof as a solved reference route.

These are labeled gaps, not hidden completion claims.
