# NisabaDB

**Graph every source theorem. Then compress mathematics into one living textbook.**

NisabaDB is a source-faithful theorem-graph corpus and, later, one canonical living mathematics textbook for a person starting with no mathematics background. Phase I preserves the uncompressed theorem and proof-dependency structure of every approved source book. Phase II will compare, simplify, and rewrite that mathematics into one notation and exposition. Its current paper prototype contains *A Dimension-Free Dictatorship Tester on the Symmetric Group* and Braverman--Khot--Lifshitz--Minzer's *An Invariance Principle for the Multi-slice, with Applications*.

The Knowledge textbook is organized simultaneously as chapters for reading and as an acyclic prerequisite graph for reuse, search, and alternate routes. The planned paperback is a curated set of important excerpts from this canonical text, not a competing edition or a bundle of source materials.

The intended canonical domain is `nisabadb.org`. Until that domain is configured, the project is deployable through GitHub Pages.

## What works

- Navigation for Knowledge, Papers, Unsolved, and Train
- An exact 688-row registry expanding to 717 required book/volume components
- One registry identity per required component, with four ignored local candidate graphs stored as validated, content-addressed v1.1 JSONL shards
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

The agreed whole-field intake contains 688 preserved source rows in 31 branches and 717 required book/volume components. The ordered list and component identities are fingerprint-locked. Each component keeps a stable local `data/books/S####/<component>.json` index path; multi-volume rows therefore have distinct component identities. Those component directories are an ignored candidate cache, not public repository payload. A Phase-I graph becomes complete only after its exact edition is fingerprinted, every immutable source unit has a reviewed node inventory or theorem-free attestation, every theorem-like result and needed support node is inventoried, and every direct source dependency or explicit root/external input is independently reviewed. No canonical Knowledge mapping is required for source-graph completion.

## Phase I book graph files

[`THEOREM_GRAPH_POLICY.md`](THEOREM_GRAPH_POLICY.md) fixes the dictatorship-paper graph as the extraction model and defines the strict result/support inclusion and example-exclusion rules.

`data/knowledge/source-records.json` is the approved index, not the theorem database. `data/books/manifest.json` is a generated, queue-only public summary. A locally populated v1.1 component uses a small index plus content-addressed collection shards, for example:

```text
data/books/S0042/complete-source.json
data/books/S0042/complete-source/nodes/000000-<sha256>.jsonl
data/books/S0042/complete-source/direct-dependencies/000000-<sha256>.jsonl
data/books/S0042/complete-source/proof-routes/000000-<sha256>.jsonl
```

The logical component boundary remains, while v1.1 removes the 53 MB single-file bottleneck exposed by S0262. The ignored local candidates S0060, S0091, S0164, and S0262 occupy 6, 3, 6, and 15 deterministic shards respectively; every shard is at most 5 MiB and carries its own schema version, record count, byte count, and SHA-256 digest. The component index also binds the exact reconstructed logical graph and a digest over its metadata and shard descriptors. The tracked root manifest retains all 717 component identities with `artifactPath: null`; it never reveals whether an ignored local candidate exists. The four sparse source-resolution records retain the exact source pins and importer graph hashes without redistributing the graph payloads.

Raw shards are data-only: they are ignored by Git, refused by the development server, omitted from GitHub Pages, and absent from the coverage payload. `npm run books:public-boundary` fails if any component index or shard is tracked. Generated SQLite/DuckDB indexes and compressed snapshots are derivatives, never review authority. The current 5 MiB sequential layout is a v1.1 transport checkpoint; before bulk iterative extraction, collection shards should move to stable source-unit or stable-ID partitions so a local edit does not churn every later shard. Full-registry storage also needs a license-appropriate private object-placement layer and a single promotion coordinator: current importers must not update shared remote state concurrently. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the digest, licensing, migration, and review boundaries.

`data/book-sources/manifest.json` is the generated exact-source work queue for all 717 component identities. Sparse authored records under `data/book-sources/S####/<component>.json` exist only when evidence has produced a source or duplicate proposal; unresolved components have no placeholder record. Edition selection, acquisition, license/distribution clearance, importer compatibility, and independent administrative approval remain separate, hash-bound states. The current four exact editions and importer outputs are candidates, not administrator-verified selections. This operational ledger is not copied into the website.

Candidate extractor edges remain visibly distinct from reviewed proof dependencies. Compression mappings live in a later layer and never overwrite source-faithful nodes or routes. After all source graphs have been built and reviewed, Phase II will unify and simplify them; textbook-wide Lean 4 formulations are attached only to the resulting canonical theorem identities, with traceability back to their raw source nodes.

The old `data/knowledge/coverage-ledger.json` and its source-to-Knowledge disposition rules are retained only as a frozen Phase-II prototype. They are no longer published by the coverage page and cannot decide whether a Phase-I book graph is complete.

The ignored local `S0060/complete-source.json` index and its component shards form the chronologically first populated pipeline pilot. They pin Oscar Levin's official PreTeXt source for *Discrete Mathematics: An Open Introduction, 4th Edition* and currently contain captured inventories for 109 active source files, 38 explicitly tagged theorem-like nodes, 72 definition/notation nodes, and three candidate edges where a theorem proof explicitly cross-references another inventoried result. The pilot remains unreviewed and incomplete: 35 theorem-like nodes have no route, implicit prerequisites and exercise-embedded results still need semantic review, and the dataset discloses a conflict between the active edition's license statement and the repository-level license.

The ignored local `S0091/complete-source.json` candidate pins David Austin's official PreTeXt source for *Understanding Linear Algebra: PROTEUS Version, 2026 Update* at commit `a895a539d9972bde1cc85aea5e9516fc7b0f4b25`. It inventories 78 active content files, including 54 theorem-free attestations, and captures 65 theorem-like nodes and 38 support nodes. There are no explicit proof-xref dependencies, so all 65 results remain dependency-pending rather than being declared roots. The traversal excludes 382 embedded PreFigure XML asset includes and also excludes graph-like markup nested inside PreFigure, example, exercise, activity, and ordinary-remark containers. Its CC-BY-4.0 metadata is still a candidate pending independent review.

The ignored local `S0164/complete-source.json` candidate pins Thomas W. Judson's official PreTeXt source for *Abstract Algebra: Theory and Applications, Annual Edition 2026* at commit `043274d5dead03ff007a461ffe4c2b8477be1248`. It inventories 32 active content files, captures 277 theorem-like and 71 support nodes, and records 70 explicit proof-xref dependency candidates in 58 routes. Twenty-one proof xrefs remain unresolved and 219 theorem-like nodes remain dependency-pending. The active source closure contains both GFDL-1.2-or-later and GFDL-1.3-or-later markers, while the repository `COPYING` file states GFDL-1.3-or-later; the importer therefore selects no governing SPDX license and leaves distribution blocked on review.

The ignored local `S0262/complete-source.json` index and its component shards form the first dense-book checkpoint dataset. Under the descending-complexity work order, *The Stacks Project* is the first and highest-priority source book; it remains the active target, and no second-ranked successor has been selected or started. The candidate pins the official LaTeX source at tag-synchronized commit `ed88ff783bcb4dd9a28518a33b028841094009cf`, inventories all 116 chapters, and gives every included result its permanent Stacks tag. It contains 14,994 nodes: 13,139 theorem-like nodes (12,587 lemmas, 330 propositions, 214 theorems, and 8 exact-label source-audited claims) and 1,855 support nodes (1,726 definitions, 124 formal situations/assumptions, and 5 constructions). It also contains 11 typed external theorems, 36,295 proof-use edges, and 11,284 source or explicitly alternate proof routes. The edges comprise 36,037 explicit proof-xref edges and 258 owner-specific audited semantic edges: 71 named-result invocations, 4 curated-claim prerequisites, 12 primary-source bibliographic dependencies, 109 deictic-proof dependencies, 25 occurrence-level resolutions of a mixed recall remark, and 37 owner-specific section-delegation dependencies. The dataset contains zero example nodes: 449 example environments, 386 exercises, and 1,042 ordinary remark environments remain excluded; no remark category was bulk-imported. Exact audits suppress 3 notation/optional proof xrefs and 11 attribution, corroboration, background, or example-based citation records instead of creating false dependencies. There are 2,590 remaining unresolved theorem-target records (1,299 unique permanent labels) and 6 unresolved bibliographic proof citations. The graph is reproducibly extracted but not independently reviewed or complete; 1,892 theorem-like nodes still have no route with a resolved candidate prerequisite.

The preceding five-edge batch resolves four exact owner occurrences of presentations Section Tag `0261` to the quotient/coequalizer result in Tag `0262`: `0BB4` uses it to identify $U \mathbin{\times_X} Z$ with the displayed étale-groupoid quotient, `06QZ` uses the presentation equality $X=U/R$, `07SK` uses the quotient presentation $Y=W/R'$, and `0DUJ` uses the coequalizer property to glue the compatible $h_i$ into a unique $Y\to W$. The fifth mapping resolves `09CN`'s Section Tag `07JV` invocation to the snake lemma in Tag `07JW`. Each mapping is guarded by the exact owner, source revision, statement hash, full proof hash, section tag, and reference occurrence; neither section label becomes a global alias. The new edges deliberately preserve the source's remaining proof debt: `0BB4` still lacks a precise formulation and proof of the functoriality used for descent to $Z\to X^\nu$; `07SK` still omits why $R'$ is of finite presentation over $R$; and `09CN` still omits bilinearity details and appeals to an excluded free-module example whose occurrence remains unresolved. The `06QZ` and `0DUJ` routes likewise remain captured candidates with implicit prerequisites and independent review pending.

The next source audit promotes the exact labeled prose/list span `algebra-item-cauchy-binet` to the local claim Tag `0F0K`, *Cauchy-Binet determinant formula*, and resolves the single explicit occurrence in the proof of owner `07DQ` to that claim. This is one additional explicit proof-xref edge, not a semantic override or a policy that promotes item labels generally. The source gives no proof for `0F0K`, so the claim has no route and remains visible proof debt. Owner `07DQ` gains a captured source route through `0F0K`, while the new claim replaces it in the dependency-pending set; consequently the pending total remains 1,892. The exact claim span, owner statement, owner proof, source revision, and reference occurrence are hash-guarded, and neither the claim nor the route is independently reviewed.

The rejected example-heavy `S0002` checkpoint has been returned to the root manifest's absent-artifact state. *Mathematics for Elementary Teachers* is not being counted as an extracted theorem graph and is not the next book in the queue.

The PreTeXt importer defaults to a dry run. It requires a clean checkout at the exact requested commit, derives repository provenance from its GitHub origin, traverses active comment-stripped `.ptx` and `.xml` content includes while excluding embedded PreFigure asset XML, validates the candidate against the book schema, and writes only the requested component. `--write` refuses any destination that is tracked or not ignored, then updates the local candidate and refreshes the queue-only manifest with ordinary-error rollback safety:

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

The Stacks importer also defaults to a dry run. It accepts only a clean checkout of the official repository at the exact requested commit, reads the official ordered chapter and permanent-tag manifests, masks comments and verbatim examples, excludes worked examples/exercises/ordinary remarks, applies only source-audited exact owner/target overrides with drift guards, validates the complete candidate, and performs a single-writer, ordinary-error-rollback-safe update of only the ignored local S0262 candidate plus the queue-only manifest:

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
npm run books:public-boundary
npm run books:sources:sync
npm run books:sources:bootstrap
npm run books:sources:check
npm run books:check
npm run books:prune-placeholders
npm run books:migrate-storage
```

`books:sync` regenerates the complete ordered graph-identity manifest with all 717 `artifactPath` values null, while opportunistically validating any ignored local candidate indexes and shards. `books:public-boundary` rejects every raw graph payload tracked by Git. `books:sources:sync` regenerates the 717-entry source-resolution queue from the fingerprinted registry and sparse authored resolution records; after a new local importer succeeds, run `books:sources:bootstrap` once to create only its missing sparse source record and refresh that queue. Bootstrap never overwrites an authored record and rolls back new records if validation fails. `books:sources:check` validates hashes, review boundaries, blockers, and agreement with local candidate graphs when they are present. The explicit one-time `books:prune-placeholders` command removes only artifacts that exactly equal the canonical neutral template; ordinary sync never deletes an artifact. `books:check` enforces the Git boundary, validates both ledgers, reconstructs each locally available v1.1 component, and rejects missing, altered, or orphan local shards. `books:migrate-storage` performs a dry-run parity audit of S0060 and S0262; `--write` is allowed only for ignored, untracked destinations. `npm run check` runs linting, all tests, TypeScript compilation, and the production build.

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
