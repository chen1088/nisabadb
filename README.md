# NisabaDB

**Map papers. Rewrite their mathematical foundations into one living textbook.**

NisabaDB is a paper corpus, a collection of proof-bearing paper graphs, and one canonical living mathematics textbook for a person starting with no mathematics background. Its gold corpus currently contains *A Dimension-Free Dictatorship Tester on the Symmetric Group* and Braverman--Khot--Lifshitz--Minzer's *An Invariance Principle for the Multi-slice, with Applications*. The website presents reviewed paper-local mathematics as interactive dependency graphs and rewrites the reusable knowledge behind those papers into a unified exposition with one notation policy. Source books, courses, notes, and software remain editorial evidence and lineage behind the textbook; they are not a public shelf or separate curricula.

The Knowledge textbook is organized simultaneously as chapters for reading and as an acyclic prerequisite graph for reuse, search, and alternate routes. The planned paperback is a curated set of important excerpts from this canonical text, not a competing edition or a bundle of source materials.

The intended canonical domain is `nisabadb.org`. Until that domain is configured, the project is deployable through GitHub Pages.

## What works

- Navigation for Knowledge, Papers, Unsolved, and Train
- One living Knowledge textbook with chapter reading order, stable knowledge nodes, an acyclic prerequisite DAG, a canonical notation registry, and source lineage kept behind the exposition
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

The corpus contains 2,143 paper records: 2 gold rewrites and 2,141 provisional papers, connected by 2,284 citation records. The two reviewed paper graphs contain 93 mathematical nodes. The initial living Knowledge edition contains 30 independently written nodes across six chapters, with 21 canonical notation entries and six source-lineage records. Human-readable compressed paper routes are complete for 36 of 61 theorem-like nodes. Every remaining item is labeled as a proof idea or a proof not yet distilled; source-omitted proofs and unresolved source inconsistencies are never promoted to complete routes. The initial textbook nodes remain labeled as initial rewrites until mathematical and pedagogical review is complete.

## Knowledge is one living textbook

`src/data/knowledge.json` is the canonical textbook source. Each knowledge node belongs to a chapter and section, declares its prerequisite nodes, uses entries from the shared notation registry, and carries source references for editorial traceability. The validated graph rejects missing relations, duplicate identifiers, self-dependencies, and prerequisite cycles. Reader-facing prose, examples, and exercises are NisabaDB rewrites rather than stitched excerpts from the source texts.

The chapter order is a curated reading route through that DAG, not the definition of the mathematics itself. A concept can therefore support several later chapters without being duplicated, and alternate reading routes can be generated without changing its canonical statement. The notation registry records one preferred symbol and meaning together with source-specific aliases, allowing material from different traditions to be unified explicitly instead of silently mixing conventions.

Per-node source lineage and internal editorial research still guide extraction, comparison, licensing review, and provenance. They do not appear as a public Materials architecture and are never assignments to read whole books. The published paperback will excerpt selected chapters and results from the same canonical text.

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
```

`npm run check` runs linting, all tests, TypeScript compilation, and the production build.

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
