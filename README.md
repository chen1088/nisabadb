# NisabaDB

**Graph every source theorem. Then compress mathematics into one living textbook.**

NisabaDB is a source-faithful theorem-graph corpus and, later, one canonical living mathematics textbook for a person starting with no mathematics background. Phase I preserves the uncompressed theorem and proof-dependency structure of every approved source book. Phase II will compare, simplify, and rewrite that mathematics into one notation and exposition. Its current paper prototype contains *A Dimension-Free Dictatorship Tester on the Symmetric Group* and Braverman--Khot--Lifshitz--Minzer's *An Invariance Principle for the Multi-slice, with Applications*.

The Knowledge textbook is organized simultaneously as chapters for reading and as an acyclic prerequisite graph for reuse, search, and alternate routes. The planned paperback is a curated set of important excerpts from this canonical text, not a competing edition or a bundle of source materials.

The intended canonical domain is `nisabadb.org`. Until that domain is configured, the project is deployable through GitHub Pages.

## What works

- Navigation for Knowledge, Papers, Unsolved, and Train
- An exact 688-row registry expanding to 717 required book/volume components
- One independently validated JSON graph file per required component, plus a small generated manifest for indexing and aggregate counts
- A Phase-I source graph model for exact editions, chapter/section/page/source-file units, per-unit inventory decisions, theorem and support nodes, proof routes, evidence-bearing direct dependencies, external inputs, and independent review
- A strict theorem-graph policy: formal results and proof-relevant definitions/assumptions are nodes; exact-label source-audited theorem-level claims may be promoted from prose, but worked examples, exercises, ordinary remarks, and routine calculations are not
- A frozen Phase-II Knowledge prototype with chapter reading order, stable knowledge nodes, an acyclic prerequisite DAG, and a canonical notation registry
- A frozen Phase-II compression atlas with 18 candidate mathematical clusters and explicit residual hypotheses
- A bounded, cycle-safe citation-ancestry DAG projection, processing backlog, and paginated paper catalog
- One expandable dependency DAG per paper, containing every paper-facing result without topic sub-tabs; theorem/result nodes start folded so a paper opens as a readable map rather than a wall of statements
- Search, status filters, route-sensitive dependency highlighting, and stable deep links
- Explicit original, minimized, and candidate-reinterpretation route roles with independent review state
- Persistent statement/proof reader with source locations, Lean declarations, and axiom audit
- Prover-neutral formal-artifact schema and reproducible submission lifecycle; Lean 4 is the first populated adapter
- Topologically generated distilled-paper view with optional prerequisite expansion
- A Train surface defined around meaningful theorem-like nodes sampled from the paper DAGs and presented as re-proving exercises for a human or AI
- An intentionally empty Unsolved surface until a conjecture passes a dated literature-status review
- Thousands of provisional paper records discovered through a resumable recursive citation queue
- Validated TypeScript content model and a persistent OpenAlex ingestion queue
- Responsive, keyboard-accessible React interface with KaTeX rendering

The corpus contains 2,143 paper records: 2 gold rewrites and 2,141 provisional papers, connected by 2,284 citation records. The two reviewed paper graphs contain 93 mathematical nodes. The current Knowledge draft and its 126-chapter roadmap are frozen Phase-II prototypes: 126 is not a source-chapter count or a corpus-coverage target. Human-readable compressed paper routes are complete for 36 of 61 theorem-like paper nodes; source-omitted proofs and unresolved inconsistencies are never promoted to complete routes.

The agreed whole-field intake contains 688 preserved source rows in 31 branches and 717 required book/volume components. The ordered list and component identities are fingerprint-locked. Each component owns `data/books/S####/<component>.json`; multi-volume rows therefore produce multiple files. A Phase-I graph becomes complete only after its exact edition is fingerprinted, every immutable source unit has a reviewed node inventory or theorem-free attestation, every theorem-like result and needed support node is inventoried, and every direct source dependency or explicit root/external input is independently reviewed. No canonical Knowledge mapping is required for source-graph completion.

## Phase I book graph files

[`THEOREM_GRAPH_POLICY.md`](THEOREM_GRAPH_POLICY.md) fixes the dictatorship-paper graph as the extraction model and defines the strict result/support inclusion and example-exclusion rules.

`data/knowledge/source-records.json` is the approved index, not the theorem database. `data/books/manifest.json` is a generated summary. The mathematical data is sharded into one file per actual component, for example:

```text
data/books/S0042/complete-source.json
data/books/S0074/volume-1.json
data/books/S0074/volume-2.json
data/books/S0074/volume-3.json
```

This boundary keeps each source graph reviewable, allows workers to process different books without editing one giant JSON file, and makes a book's completeness claim depend only on its own immutable evidence. Candidate extractor edges remain visibly distinct from reviewed proof dependencies. Compression mappings will live in a later layer and must never overwrite source-faithful nodes or routes.

The old `data/knowledge/coverage-ledger.json` and its source-to-Knowledge disposition rules are retained only as a frozen Phase-II prototype. They are no longer published by the coverage page and cannot decide whether a Phase-I book graph is complete.

`S0060/complete-source.json` is the first populated pilot. It pins Oscar Levin's official PreTeXt source for *Discrete Mathematics: An Open Introduction, 4th Edition* and currently contains captured inventories for 109 active source files, 38 explicitly tagged theorem-like nodes, 74 definition/notation nodes, and three candidate edges where a theorem proof explicitly cross-references another inventoried result. The pilot remains unreviewed and incomplete: 35 theorem-like nodes have no route, implicit prerequisites and exercise-embedded results are still pending, and the file discloses a conflict between the active edition's license statement and the repository-level license.

`S0262/complete-source.json` is the first dense-book checkpoint. It pins the official LaTeX source of *The Stacks Project* at tag-synchronized commit `ed88ff783bcb4dd9a28518a33b028841094009cf`, inventories all 116 chapters, and gives every included result its permanent Stacks tag. The candidate graph contains 13,134 theorem-like nodes (12,587 lemmas, 330 propositions, 214 theorems, and 3 exact-label source-audited claims), 1,721 definitions, 124 formal situations/assumptions, one typed external theorem (Zorn's lemma), 36,076 proof-use edges, and 11,240 source or explicitly alternate proof routes. The edges comprise 35,929 explicit proof-xref edges and 147 owner-specific audited prose-use edges: 13 named-result invocations, 109 deictic-proof dependencies, and 25 occurrence-level resolutions of a mixed recall remark. It contains zero example nodes: 449 example environments, 386 exercises, and 1,045 ordinary remark environments remain excluded; no remark category was bulk-imported. There are 2,716 remaining unresolved theorem-target records (1,328 unique permanent labels) and 30 bibliographic proof citations. The graph is extracted but not independently reviewed or complete; 1,931 theorem-like nodes still have no route with a resolved candidate prerequisite.

The rejected example-heavy `S0002` checkpoint has been returned to its placeholder state. *Mathematics for Elementary Teachers* is not being counted as an extracted theorem graph and is not the next book in the queue.

The PreTeXt importer defaults to a dry run. It requires a clean checkout at the exact requested commit, derives repository provenance from its GitHub origin, traverses only active comment-stripped includes, validates the candidate against the book schema, and writes only the requested component. A write also refreshes the generated manifest atomically:

```sh
node scripts/import-pretext-book.mjs \
  --source <clean-checkout> \
  --record-id S0060 \
  --component-id complete-source \
  --commit 730e5e3b96094148818603041222df6f3d1d96ba \
  --entry-file source/dmoi.ptx

node scripts/import-pretext-book.mjs \
  --source <clean-checkout> \
  --record-id S0060 \
  --component-id complete-source \
  --commit 730e5e3b96094148818603041222df6f3d1d96ba \
  --entry-file source/dmoi.ptx \
  --captured-at <ISO-8601-time> \
  --write
```

The Stacks importer also defaults to a dry run. It accepts only a clean checkout of the official repository at the exact requested commit, reads the official ordered chapter and permanent-tag manifests, masks comments and verbatim examples, excludes worked examples/exercises/ordinary remarks, applies only source-audited exact owner/target overrides with drift guards, validates the complete candidate, and atomically updates only S0262 plus the generated manifest:

```sh
node scripts/import-stacks-book.mjs \
  --source <clean-stacks-project-checkout> \
  --record-id S0262 \
  --component-id complete-source \
  --commit ed88ff783bcb4dd9a28518a33b028841094009cf \
  --captured-at <ISO-8601-time> \
  --write
```

## Phase II prototype: one living textbook

`src/data/knowledge.json` is the written textbook source. Each knowledge node belongs to a chapter and section, declares its prerequisite nodes, uses entries from the shared notation registry, and carries registry-linked references for editorial traceability. The validated graph rejects missing relations, duplicate identifiers, self-dependencies, and prerequisite cycles; tests also require the stored direct edges to be transitively reduced. Reader-facing prose, examples, and exercises are NisabaDB rewrites rather than stitched excerpts from the source texts.

`src/data/knowledge-roadmap.ts` is a separate provisional whole-book map. It currently contains 126 chapters in 21 parts, but this Phase-II outline is frozen while source graphs are built. Its size will be reconsidered from the complete source corpus rather than enlarged speculatively.

The chapter order is a curated reading route through that DAG, not the definition of the mathematics itself. A concept can therefore support several later chapters without being duplicated, and alternate reading routes can be generated without changing its canonical statement. The notation registry records one preferred symbol and meaning together with source-specific aliases, allowing material from different traditions to be unified explicitly instead of silently mixing conventions.

Per-node source lineage and internal editorial research still guide extraction, comparison, licensing review, and provenance. They do not appear as a public Materials architecture and are never assignments to read whole books. The published paperback will excerpt selected chapters and results from the same canonical text.

`/knowledge/compression` exposes the frozen Phase-II atlas. `/knowledge/coverage` is the active Phase-I command surface: it loads the small registry and manifest, reports component/file/edition/node/edge/review counts, and lazily fetches only a selected book's graph. Every extracted node receives a permanent address. Extraction and graph evidence must be approved by a different reviewer before becoming reviewed.

Train is separate from textbook navigation. It samples meaningful theorem-like nodes from the paper DAGs and asks a human or AI to reconstruct a proof as an exercise; dependency context, hints, and the reviewed route can be disclosed progressively rather than shown up front.

## Run locally

Use Node.js 24 or a compatible current release.

```sh
npm ci
npm run dev
```

The development server prints its local URL. Other useful commands are:

```sh
npm run lint
npm test
npm run build
npm run check
npm run books:sync
npm run books:check
```

`books:sync` creates missing component files and refreshes the generated manifest without overwriting a populated book graph. `books:check` rejects missing, extra, misnamed, or internally inconsistent book files. `npm run check` runs linting, all tests, TypeScript compilation, and the production build.

## Rebuild the mathematical corpus

The generated public corpus is committed at `src/data/corpus.json`. Its immutable inputs are:

- `chen1088/dict_lean` at commit `4b6c455234729dd554df5e35058cdd2940fd2c2b`
- the 2026-07-15 shortened author manuscript with SHA-256 `ea9950ff8e7c7114386dc24536b1ce13a74aed40a7116f47f7b2725910a6e239`
- the reviewed citation audit at `data/citations/direct-neighborhood-audit.json`
- the pinned `arXiv:2110.10725v2` source audit and original NisabaDB paper pack at `scripts/paper-packs/bklm-invariance.mjs`
- the multislice citation audit at `data/citations/multislice-neighborhood-audit.json`

The manuscript is not committed because no public full-text reuse license was found. With read-only local checkouts of both inputs, regenerate the corpus with:

```sh
npm run citations:snapshot
node scripts/import-dict-lean.mjs --source <dict_lean-checkout> --manuscript <shortened-manuscript.tex> --timestamp <ISO-8601-time>
npm run content:validate
```

The snapshot command merges the reviewed direct-neighborhood baseline into the existing queue and preserves recursively discovered papers, edges, and progress. Use `npm run citations:snapshot -- --reset` only when an intentional return to the audited baseline is required.

The importer verifies that the supplied Lean checkout is at the pinned commit, retains an untouched copy of the legacy graph data under `data/source-snapshots/`, then assembles reviewed paper packs over the durable citation snapshot. It never commits either source paper. The promotion and merge rules are described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Continue citation ingestion

Preview the next safe no-write invocation:

```sh
npm run citations:ingest -- --max-items 1
```

Fetch and persist one queued paper neighborhood:

```sh
npm run citations:ingest -- --live --max-items 1
```

Provider responses are stored as gzip-compressed provenance envelopes under `data/citations/cache/`, including their URL and retrieval time. Deduplication uses exact stable identifiers only—never title similarity alone. The batch size limits work per invocation, not graph depth; newly discovered records and unresolved provider IDs remain queued for later runs.

The first recursive batch processed ten identified papers. The durable queue now has 2,143 records: 2,103 metadata-fetched papers ready for neighborhood work, 36 blocked on stable provider identity, 3 complete direct neighborhoods, and 1 `neighbors-fetched` record awaiting deduplication/review. Twelve initially blocked records were reactivated after the crawl supplied exact OpenAlex identities. After accepting queue updates, regenerate `src/data/corpus.json` using the import command above and run `npm run check`.

Citation records are discovery and provenance evidence, not theorem dependencies. A raw citation network can contain cycles; the Papers page therefore shows a bounded rooted ancestry projection with explicit layer-respecting paper-to-paper relations and disclosed truncation, without claiming that the underlying citation network is itself a DAG.

## Deployment

Pushes to `main` run the GitHub Pages workflow in `.github/workflows/deploy-pages.yml`. It installs locked dependencies, runs the complete check, builds with the `/nisabadb/` base path, and deploys the `dist` artifact. Client-side route fallbacks are included for deep links.

No `CNAME` is committed yet: configure DNS for `nisabadb.org` first, then add the verified custom domain in GitHub Pages.

The public site remains static. Authenticated contributions, automated prover runs, mathematical review, and admin-only publication require the separate control-plane and worker service described in [ARCHITECTURE.md](ARCHITECTURE.md); they are not simulated by the public client.

## Provenance and reuse

NisabaDB stores metadata, exact source locations, source links, small original descriptions, and newly written proof distillations. It does not republish source manuscripts or third-party textbook text merely because they are free to read. Openly licensed sources are adapted only under their terms; cite-only and no-derivatives sources support independently written explanations. Every formal link is pinned to a commit, and verification labels distinguish kernel checking, axiom auditing, and still-pending human–formal alignment.

See [STATUS.md](STATUS.md) for precise coverage and remaining gaps, and [ARCHITECTURE.md](ARCHITECTURE.md) for the data model and continuation path.
