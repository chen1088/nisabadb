# NisabaDB

**Graph every source theorem. Then compress mathematics into one living textbook.**

NisabaDB is a source-faithful theorem-graph corpus and, later, one canonical living mathematics textbook for a person starting with no mathematics background. Phase I preserves the uncompressed theorem and proof-dependency structure of every approved source book. Phase II will compare, simplify, and rewrite that mathematics into one notation and exposition. Its current paper prototype contains *A Dimension-Free Dictatorship Tester on the Symmetric Group* and Braverman--Khot--Lifshitz--Minzer's *An Invariance Principle for the Multi-slice, with Applications*.

The Knowledge textbook is organized simultaneously as chapters for reading and as an acyclic prerequisite graph for reuse, search, and alternate routes. The planned paperback is a curated set of important excerpts from this canonical text, not a competing edition or a bundle of source materials.

The intended canonical domain is `nisabadb.org`. Until that domain is configured, the project is deployable through GitHub Pages.

## What works

- Navigation for Knowledge, Papers, Unsolved, and Train
- An exact 688-row registry expanding to 717 required book/volume components
- One registry identity per required component, with both populated pilots stored as validated, content-addressed v1.1 JSONL shards
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

The agreed whole-field intake contains 688 preserved source rows in 31 branches and 717 required book/volume components. The ordered list and component identities are fingerprint-locked. Each component keeps a stable `data/books/S####/<component>.json` index path; multi-volume rows therefore have distinct component identities. A Phase-I graph becomes complete only after its exact edition is fingerprinted, every immutable source unit has a reviewed node inventory or theorem-free attestation, every theorem-like result and needed support node is inventoried, and every direct source dependency or explicit root/external input is independently reviewed. No canonical Knowledge mapping is required for source-graph completion.

## Phase I book graph files

[`THEOREM_GRAPH_POLICY.md`](THEOREM_GRAPH_POLICY.md) fixes the dictatorship-paper graph as the extraction model and defines the strict result/support inclusion and example-exclusion rules.

`data/knowledge/source-records.json` is the approved index, not the theorem database. `data/books/manifest.json` is a generated summary. A populated v1.1 component uses a small index plus content-addressed collection shards, for example:

```text
data/books/S0042/complete-source.json
data/books/S0042/complete-source/nodes/000000-<sha256>.jsonl
data/books/S0042/complete-source/direct-dependencies/000000-<sha256>.jsonl
data/books/S0042/complete-source/proof-routes/000000-<sha256>.jsonl
```

The logical component boundary remains, while v1.1 removes the 53 MB single-file bottleneck exposed by S0262. S0060 and S0262 now occupy 6 and 15 deterministic shards respectively; every shard is at most 5 MiB and carries its own schema version, record count, byte count, and SHA-256 digest. The component index also binds the exact reconstructed logical graph and a digest over its metadata and shard descriptors. The 715 awaiting-edition components remain small transitional placeholders until the root index gains an absent-artifact state.

Raw shards are data-only: neither the development server nor GitHub Pages serves them, and the coverage route reads only the small registry and aggregate status manifest. Generated SQLite/DuckDB indexes and compressed snapshots are derivatives, never review authority. The current 5 MiB sequential layout is a v1.1 transport checkpoint; before bulk iterative extraction, collection shards should move to stable source-unit or stable-ID partitions so a local edit does not churn every later shard. Full-registry storage also needs an object-placement layer and a single promotion coordinator: current importers must not update the shared manifest concurrently. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the digest, licensing, migration, and review boundaries.

Candidate extractor edges remain visibly distinct from reviewed proof dependencies. Compression mappings live in a later layer and never overwrite source-faithful nodes or routes. After all source graphs have been built and reviewed, Phase II will unify and simplify them; textbook-wide Lean 4 formulations are attached only to the resulting canonical theorem identities, with traceability back to their raw source nodes.

The old `data/knowledge/coverage-ledger.json` and its source-to-Knowledge disposition rules are retained only as a frozen Phase-II prototype. They are no longer published by the coverage page and cannot decide whether a Phase-I book graph is complete.

The `S0060/complete-source.json` index and its component shards form the first populated pilot dataset. They pin Oscar Levin's official PreTeXt source for *Discrete Mathematics: An Open Introduction, 4th Edition* and currently contain captured inventories for 109 active source files, 38 explicitly tagged theorem-like nodes, 74 definition/notation nodes, and three candidate edges where a theorem proof explicitly cross-references another inventoried result. The pilot remains unreviewed and incomplete: 35 theorem-like nodes have no route, implicit prerequisites and exercise-embedded results are still pending, and the dataset discloses a conflict between the active edition's license statement and the repository-level license.

The `S0262/complete-source.json` index and its component shards form the first dense-book checkpoint dataset. They pin the official LaTeX source of *The Stacks Project* at tag-synchronized commit `ed88ff783bcb4dd9a28518a33b028841094009cf`, inventory all 116 chapters, and give every included result its permanent Stacks tag. The candidate graph contains 13,138 theorem-like nodes (12,587 lemmas, 330 propositions, 214 theorems, and 7 exact-label source-audited claims), 1,855 support nodes (1,726 definitions, 124 formal situations/assumptions, and 5 constructions), 11 typed external theorems, 36,289 proof-use edges, and 11,282 source or explicitly alternate proof routes. The edges comprise 36,036 explicit proof-xref edges and 253 owner-specific audited semantic edges: 71 named-result invocations, 4 curated-claim prerequisites, 12 primary-source bibliographic dependencies, 109 deictic-proof dependencies, 25 occurrence-level resolutions of a mixed recall remark, and 32 owner-specific section-delegation dependencies. The dataset contains zero example nodes: 449 example environments, 386 exercises, and 1,042 ordinary remark environments remain excluded; no remark category was bulk-imported. Exact audits suppress 3 notation/optional proof xrefs and 11 attribution, corroboration, background, or example-based citation records instead of creating false dependencies. There are 2,596 remaining unresolved theorem-target records (1,302 unique permanent labels) and 6 unresolved bibliographic proof citations. The graph is extracted but not independently reviewed or complete; 1,893 theorem-like nodes still have no route with a resolved candidate prerequisite. Section-delegation mappings are guarded by exact owner, revision, statement, proof, and occurrence evidence; the cited section labels are never global aliases.

The rejected example-heavy `S0002` checkpoint has been returned to its placeholder state. *Mathematics for Elementary Teachers* is not being counted as an extracted theorem graph and is not the next book in the queue.

The PreTeXt importer defaults to a dry run. It requires a clean checkout at the exact requested commit, derives repository provenance from its GitHub origin, traverses only active comment-stripped includes, validates the candidate against the book schema, and writes only the requested component. A single-writer update also refreshes the generated manifest and is rollback-safe for ordinary errors:

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

The Stacks importer also defaults to a dry run. It accepts only a clean checkout of the official repository at the exact requested commit, reads the official ordered chapter and permanent-tag manifests, masks comments and verbatim examples, excludes worked examples/exercises/ordinary remarks, applies only source-audited exact owner/target overrides with drift guards, validates the complete candidate, and performs a single-writer, ordinary-error-rollback-safe update of only S0262 plus the generated manifest:

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

`/knowledge/compression` exposes the frozen Phase-II atlas. `/knowledge/coverage` is a manifest-only Phase-I status diagnostic; no raw-graph UI is planned, and v1.1 shards are not a browser payload. Phase-I progress comes from small manifests and command-line validation. Every extracted node still receives a permanent address, and extraction and graph evidence must be approved by a different reviewer before becoming reviewed.

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
npm run books:migrate-storage
```

`books:sync` creates missing transitional placeholders and refreshes the generated manifest without overwriting a populated graph. `books:check` reconstructs v1.1 components, validates all logical graphs, and rejects missing, altered, or orphan shards. `books:migrate-storage` performs a dry-run parity audit of S0060 and S0262; add `-- --write` only when migrating legacy pilot files. `npm run check` runs linting, all tests, TypeScript compilation, and the production build.

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
