# NisabaDB

**The distilled, verified graph of mathematics.**

NisabaDB is a proof-bearing mathematical dependency graph. Its gold corpus currently contains *A Dimension-Free Dictatorship Tester on the Symmetric Group* and Braverman--Khot--Lifshitz--Minzer's *An Invariance Principle for the Multi-slice, with Applications*. The website presents the same validated mathematical records as interactive dependency graphs, theorem pages, and linearized distilled papers.

The intended canonical domain is `nisabadb.org`. Until that domain is configured, the project is deployable through GitHub Pages.

## What works

- Expandable dependency DAGs with paper-specific main-theorem and topic views
- Search, status filters, route-sensitive dependency highlighting, and stable deep links
- Persistent statement/proof reader with source locations, Lean declarations, and axiom audit
- Topologically generated distilled-paper view with optional prerequisite expansion
- Paper catalog plus resumable provisional records for the direct citation neighborhoods of both gold papers
- Validated TypeScript content model and a persistent OpenAlex ingestion queue
- Responsive, keyboard-accessible React interface with KaTeX rendering

The corpus contains 92 paper records: 2 gold rewrites and 90 provisional citation neighbors. The gold rewrites contain 93 mathematical nodes. Human-readable compressed routes are complete for 36 of 61 theorem-like nodes. Every remaining item is labeled as a proof idea or a proof not yet distilled; source-omitted proofs and unresolved source inconsistencies are never promoted to complete routes.

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

Inspect the next resumable batch without changing files:

```sh
npm run citations:ingest -- --max-items 1
```

Fetch and persist one queued paper neighborhood:

```sh
npm run citations:ingest -- --live --max-items 1
```

Provider responses are cached under `data/citations/cache/` with their URL and retrieval time. Deduplication uses exact stable identifiers only—never title similarity alone. The batch size limits work per invocation, not graph depth; newly discovered records and unresolved provider IDs remain queued for later runs. The durable queue currently has 92 records: 43 metadata-fetched records ready for neighborhood work, 48 blocked on stable provider identity, and the multislice paper at `neighbors-fetched` pending deduplication/review. After accepting queue updates, regenerate `src/data/corpus.json` using the import command above and run `npm run check`.

## Deployment

Pushes to `main` run the GitHub Pages workflow in `.github/workflows/deploy-pages.yml`. It installs locked dependencies, runs the complete check, builds with the `/nisabadb/` base path, and deploys the `dist` artifact. Client-side route fallbacks are included for deep links.

No `CNAME` is committed yet: configure DNS for `nisabadb.org` first, then add the verified custom domain in GitHub Pages.

## Provenance and reuse

NisabaDB stores metadata, exact source locations, source links, and newly written proof distillations. It does not republish the source manuscript or third-party full text. Every formal link is pinned to a commit, and verification labels distinguish kernel checking, axiom auditing, and still-pending human–formal alignment.

See [STATUS.md](STATUS.md) for precise coverage and remaining gaps, and [ARCHITECTURE.md](ARCHITECTURE.md) for the data model and continuation path.
