# NisabaDB architecture

## One corpus, three readings

`src/data/corpus.json` is the build-time source for the graph explorer, canonical theorem pages, and distilled-paper view. Rendering code never owns mathematical proof text. `src/data/schema.ts` validates the corpus as the application loads and in tests.

The core relationships are:

```text
Paper
  ├─ Statement ── ProofRoute ── ProofStep
  │      │              │            ├─ dependencyRefs -> Statement
  │      │              │            └─ formalDeclarationRefs
  │      ├─ SourceLocation
  │      └─ FormalDeclaration
  ├─ CitationEdge -> Paper
  ├─ ModificationRecord
  └─ ingestion queue state
```

A statement may have several proof routes. Each route owns its dependency set, proof, conceptual cost, attribution, verification status, and formal-alignment state. Selecting a route therefore changes both the prose and the graph edges. A complete route must use every displayed dependency, and every proof-step reference must be declared by the route.

## Validation invariants

The Zod schema and cross-record checks reject:

- duplicate paper, statement, global-statement, proof-route, proof-step, or citation IDs, and duplicate queue entries for one paper;
- duplicate stable paper identifiers or citation endpoint pairs;
- missing dependency, paper, citation, graph-root, or queue targets;
- self-dependencies and unreviewed graph cycles;
- route dependencies inconsistent with their statement;
- undeclared proof-step or Lean-declaration references;
- complete routes that display unused dependencies;
- theorem-like nodes without a proof route;
- more than one featured paper, gold papers without statements or graph views, non-local gold dependencies, and duplicate graph-view IDs;
- mismatched source-statement repair records or missing modification history;
- impossible citation coverage, recursive-closure, or completed-queue claims;
- `fully-certified` statement or route claims without reviewed alignment and a clean, input-free formal audit.

The main dependency order is computed from the selected route at runtime. The distilled paper is therefore a topological reading of the same records—not a second manuscript.

## Import boundary

`scripts/import-dict-lean.mjs` reads `dict_lean` and the author manuscript without modifying either. It verifies the checkout's exact pinned commit, resolves current Lean declaration lines, adds NisabaDB proof distillations, and passes the primary paper, durable citation snapshot, and reviewed gold packs to `scripts/corpus-assembly.mjs`.

Each gold pack owns one paper's metadata override, theorem graph, and statements. The assembler promotes only an exact provisional paper ID, preserves citation-worker coverage and queue state, unions stable provenance/history, rejects identifier and global-statement collisions, and requires every packed statement to use the paper's global namespace. This prevents a future importer run from erasing a hand-curated second paper.

The current second pack, `scripts/paper-packs/bklm-invariance.mjs`, pins `arXiv:2110.10725v2` by TeX, source-archive, and PDF hashes. It contains original NisabaDB restatements—not copied paper text—and records all 21 unique numbered results, the three Section 4 claims required by the main theorem, key definitions, external inputs, correction notes, and explicit proof gaps.

The untouched legacy graph snapshot is retained separately. Reviewed repairs applied to the curated corpus include:

- Definition 5.8 depends on Definitions 5.7, 5.3, and 5.5.
- Lemma 5.9 explicitly depends on Definition 5.6 for its matrix-coefficient space.
- Lemma 5.10 depends on Definitions 5.8 and 5.5, and links the later orthogonal-decomposition, isometry, eigenvalue, and intertwining declarations.
- Lemma 5.15 additionally depends on Lemma 5.8 and Definition 5.6, matching the block-basis argument used in its proof.
- Construction 3.1 records the matching-cube coordinates and one matching-square trial omitted by the legacy graph, and the Section 3–4 sampling, perfect-completeness, energy, rejection, and repetition routes depend on it explicitly.
- Proposition 5.16 uses Definition 5.6 for matrix coefficients and convolution, and Theorem 5.3 directly to turn centrality into commutation with content operators; the redundant Lemma 5.6 edge is removed.
- Lemma 5.17 depends on Lemma 5.12 for the identity `|X| = d` in its vertical-child count.
- The Section 2 FKN route exposes its Boolean degree-one classification input.

The curated graph has 117 dependency edges; the preserved legacy snapshot has 103.

The importer also keeps statement repair separate from source preservation. When a manuscript statement omits a necessary rank range, `exactStatement` contains the audited display used by NisabaDB, while `sourceStatement` retains the uncorrected wording and `statementNote` explains the difference. The eleven current repairs cover Theorems 2.1–2.2, Proposition 4.5, Lemma 4.6, Definition 5.10, Lemmas 5.12–5.13, Lemma 5.15, Proposition 5.16, and Lemmas 5.17–5.18.

Every paper and statement also carries appendable modification-history records with a version, timestamp, contributors, and summary. This is distinct from source provenance and review-role fields.

## Formal evidence model

Formal declarations retain repository, 40-character commit, file, declaration name, resolved line, kernel-check result, admitted-term scan, external-input flag, explicit axiom footprint, and audit note. Informal/formal alignment and proof-route alignment are separate review dimensions. This prevents a kernel-checked declaration from being mislabeled as a completely aligned or assumption-free proof.

## Citation worker boundary

`data/citation-neighborhood.json` is the durable queue snapshot consumed by the static build. Rebuilding the reviewed baseline is a non-destructive merge by default; an explicit `--reset` is required to discard recursive progress. `scripts/ingest-citations.mjs` processes a bounded number of queued papers per invocation while allowing unbounded recursive depth across invocations. Provider responses are cached as provenance envelopes. Newly discovered papers begin as metadata-only provisional records and are enqueued for their own neighborhoods. If a provider reports references whose records were not retrieved, their IDs remain on the queue for retry rather than being counted as resolved.

Identity merging requires an exact DOI, arXiv, OpenAlex, Semantic Scholar, ISBN, or internal ID match. Similar titles alone never trigger a merge. Every edge retains its discovery provider, provider record, retrieval time, and confidence.

Reviewed source bibliography counts outrank provider aggregates. For the multislice paper, comment-stripped TeX and the `.bbl` agree on 48 cited works, while the canonical OpenAlex journal record reports 45 and has unresolved/bad endpoints. The source-audited count is therefore durable and cannot be overwritten by a later provider pass. Incoming coverage is separately labeled provider-visible-only because it is discovered through a split FOCS-version identity rather than the journal record.

The current application is static-first by design. A future database or worker can preserve these record shapes and invariants while replacing committed JSON and batch scripts.

## Route and deployment shape

- `/` — project landing page and featured-paper entry
- `/papers` — searchable catalog
- `/papers/:paperId` — metadata, graph, proofs, citations, and formal coverage
- `/papers/:paperId/distilled` — generated linear reading
- `/theorems/:statementId` — canonical deep-linked statement

Vite builds a static artifact. The build copies the same validated application shell to every known paper, distilled-paper, catalog, and theorem route, so GitHub Pages serves canonical deep links directly; a copied `404.html` remains as a fallback for unknown client routes. React Router resolves the requested record from that shared shell.
