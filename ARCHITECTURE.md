# NisabaDB architecture

## Reviewed paper graphs and one living textbook

`src/data/corpus.json` is the build-time source for the paper catalog, citation explorer, reviewed paper graphs, canonical theorem pages, distilled-paper view, and Train exercise pool. `src/data/knowledge.json` is the source for one canonical living textbook whose exposition is independently rewritten into NisabaDB's notation. Rendering code never owns mathematical proof text or third-party textbook prose. `src/data/schema.ts` and `src/data/knowledge-schema.ts` validate the paper and textbook layers as the application loads and in tests.

The source-compression control layer is separate from both. `data/knowledge/source-records.json` preserves all 688 approved candidate rows behind an ordered-manifest fingerprint. `data/knowledge/coverage-ledger.json` will hold exact editions, immutable source-unit manifests, scan segments, theorem occurrences, canonical claims, and retained residual artifacts; `data/knowledge/verification-policy.json` names the administrators allowed to approve review records. `src/data/compression.json` is a lightweight public atlas of whole-field convergence decisions. The source registry and audit files are copied as lazy data and are never eagerly imported into ordinary learner lessons.

- **Papers** exposes the large provisional corpus, a bounded citation-ancestry projection, processing backlog, and one complete proof-dependency graph for each reviewed paper. Main results and sections are focus points inside that graph, not separate graph tabs. Paper dependency disclosures start folded; readers expand only the result branches they want to inspect.
- **Knowledge** is one source-independent, living rewritten textbook rather than a shelf of books. Chapters provide a conventional reading order, while `KnowledgeNode.prerequisiteIds` provide the canonical dependency DAG. A shared notation registry fixes one main convention and records source-specific aliases. Per-node source references remain collapsed lineage and comparison evidence behind the exposition.
- **Knowledge / Compression** is a read-only atlas of candidate common cores, notation resolutions, source-family convergence, candidate source-route patterns, minimized-route hypotheses, and residual dispositions. It is a plan and audit surface, not evidence that extraction is complete.
- **Knowledge / Coverage** is the non-omission ledger. It preserves every candidate row and exposes separate derived counts for resolved rows, fully reconciled rows, inventoried editions, terminal theorem dispositions, reviewed Knowledge mappings, and reviewed residuals. Selecting a source reveals its exact editions and theorem-level addresses once they exist.
- **Unsolved** remains empty until a precise problem passes an administratively reviewed, dated literature audit.
- **Train** derives proof exercises from meaningful theorem-like nodes in gold paper graphs. An eligible result must have a reviewed, complete proof route and cannot be an imported result. Selection is random, the stored proof begins hidden, and prerequisite, proof-idea, and reviewed-route help is disclosed progressively for either a human or AI trainee.
- **Materials** and **Learn** are no longer product surfaces. Their legacy URLs remain only as redirects to Knowledge and Train respectively.

The core relationships are:

```text
Paper
  ├─ Statement ── ProofRoute ── ProofStep
  │      │              │            ├─ dependencyRefs -> Statement
  │      │              │            └─ formalDeclarationRefs
  │      ├─ SourceLocation
  │      ├─ FormalDeclaration
  │      └─ reviewed + complete theorem-like route -> Train exercise
  ├─ CitationEdge -> Paper
  ├─ ModificationRecord
  └─ ingestion queue state

KnowledgeBook
  ├─ Chapter ── reading order ──> KnowledgeNode
  ├─ KnowledgeNode
  │      ├─ prerequisiteIds -> KnowledgeNode
  │      ├─ notationIds -> NotationEntry
  │      ├─ sourceRefs -> SourceLineage
  │      └─ motivation, tutorial, examples, exercise, status
  ├─ NotationEntry
  │      ├─ canonical symbol, spoken form, and meaning
  │      ├─ firstNodeId -> KnowledgeNode
  │      └─ source-specific aliases and conflict notes
  └─ SourceLineage ── official URL and editorial use note

SourceRecord ── resolves to one or more ──> SourceEdition
  ├─ exact list row                         ├─ required volume/part component
  └─ required edition components           ├─ immutable SourceUnit manifest
                                            ├─ ScanSegment ── exact unit subset + source evidence
                                └─ TheoremOccurrence
                                     ├─ exact label and locator
                                     ├─ normalized claim
                                     ├─ disposition and mapping relation
                                     └─ targetCanonicalClaimIds -> CanonicalClaim
                                                                   └─ knowledgeNodeIds -> KnowledgeNode

CompressionAtlas
  ├─ comparison SourceFamily
  ├─ common-core Cluster
  ├─ candidate source pattern / minimized / reinterpretation Route
  ├─ canonical notation resolution
  └─ residual item: bridge, alternate, specialist, history, or unresolved

Published paperback (planned) ── selected excerpts from ──> KnowledgeBook
```

`CitationEdge` and a statement dependency are different relations. Citation edges record bibliographic discovery and provenance; they do not prove logical dependence. The raw citation network can contain cycles. The Papers interface constructs a bounded, rooted ancestry projection by placing a selected paper after the works it cites, assigning every visible paper its earliest breadth layer, and retaining only citation relations that advance exactly one layer toward the selected paper. Same-layer and backward raw edges remain in the corpus but are excluded from this view, so its displayed per-node adjacency is genuinely acyclic. Node and depth limits are disclosed. This projection is a navigation DAG, not a claim that the complete citation network is acyclic. A later whole-corpus hierarchy can condense strongly connected components explicitly.

A statement may have several proof routes. Each route owns its dependency set, proof, conceptual cost, attribution, verification status, and formal-alignment state. Selecting a route therefore changes both the prose and the graph edges. A complete route must use every displayed dependency, and every proof-step reference must be declared by the route.

Route exposition and route provenance are independent. `type` describes presentation (for example compressed source or pedagogical), while `dependencyKind` records whether the dependency route is the audited `original`, a reviewed `minimized` route, or a `reinterpretation`. `reviewStatus` keeps candidate routes visibly separate from reviewed routes. Every minimized route must identify the route from which it was minimized.

Knowledge has two compatible orders over the same canonical records. Chapter and section numbers support ordinary previous/next reading; prerequisite edges support local “know first” and “immediately unlocks” views, dependency closure, and later alternate reading paths. The source-lineage layer records where ideas and notation were compared, but source containers are not reader-facing chapters and their wording is not copied into the textbook. A future paperback selects important portions of these same nodes instead of creating a second mathematical authority.

## Validation invariants

The paper-corpus Zod schema and cross-record checks reject:

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

The Knowledge schema separately rejects:

- duplicate source, chapter, notation, or node IDs, plus duplicate node slugs or section numbers;
- empty chapters and missing chapter targets;
- notation entries whose first-use node is missing;
- missing, repeated, or self-referential prerequisite edges and any cycle in the Knowledge prerequisite graph;
- missing or repeated notation references;
- source-lineage references whose source record is missing; and
- a knowledge node marked `trainable` without a `proofGoal`, or a `proofGoal` on a node not marked `trainable`.

The source-coverage validator separately requires:

- every approved source row to retain its stable sequential ID, exact order, declared count, and ordered-manifest fingerprint;
- each row to remain unresolved, resolve every declared volume/part component to exactly one owned edition, or name an independently administrator-reviewed non-cyclic duplicate that terminates at a resolved row;
- every exact edition to carry an artifact fingerprint and an ordered, content-fingerprinted source-unit manifest;
- complete editions to cover every manifest unit exactly once, contain at least one theorem occurrence, and have independently administrator-reviewed scan segments whose evidence matches the edition artifact;
- each scan segment to record either a nonempty exact occurrence list or an explicit theorem-free attestation, with machine-checked bidirectional occurrence membership;
- every theorem occurrence to retain a permanent ID and address, exact source unit, label, locator, normalized claim, and one disposition;
- verified core/equivalent/alternate/bridge dispositions to reach reviewed canonical claims bound to content-fingerprinted nodes in the current Knowledge edition, while specialist/history dispositions reach reviewed residual artifacts;
- source-stronger and overlapping mappings to retain all unmatched mathematics in reviewed residual artifacts, while exact and source-weaker mappings cannot carry spurious residuals;
- a proposal or extraction audit before each source resolution, scan, canonical claim, residual, occurrence decision, or completed edition can be approved, with proposer/extractor and reviewer required to differ; and
- only actors named in the verification policy to issue administrative approvals.

The publication build recomputes the ordered source manifest, every edition unit manifest, every current Knowledge-node content fingerprint, and every administrative review's subject fingerprint. A stale source, target, or approval therefore fails publication instead of inheriting an old reviewed state.

The current 688-row registry is intentionally unresolved. The public site may promise that every registered theorem will be accounted for, but it may not claim completed coverage until all exact editions are exhaustively reconciled.

Required node fields also keep motivation, tutorial prose, a key idea, at least one worked example, a progressively disclosed exercise, source lineage, rewrite status, read time, and tags in the canonical data rather than the React components. Knowledge-node exercises are part of the textbook; the `/train` pool is independently derived from paper results.

Derived-behavior tests enforce that Train contains only theorem-like, non-imported results from gold papers with reviewed complete routes, and that a new random choice avoids the current result whenever the selected pool permits it. Paper-graph tests enforce an empty initial expansion set so every dependency disclosure is folded on first render.

The main dependency order is computed from the selected route at runtime. The distilled paper is therefore a topological reading of the same records—not a second manuscript.

## Import boundary

`scripts/import-dict-lean.mjs` reads `dict_lean` and the author manuscript without modifying either. It verifies the checkout's exact pinned commit, resolves current Lean declaration lines, adds NisabaDB proof distillations, and passes the primary paper, durable citation snapshot, and reviewed gold packs to `scripts/corpus-assembly.mjs`.

Each gold pack owns one paper's metadata override, theorem graph, and statements. The citation snapshot also contains a provisional record for the primary author-manuscript seed, making every edge and queue item referentially valid without an external overlay. The assembler promotes that exact seed into the primary gold paper, then promotes any additional exact gold-pack IDs. Promotion preserves citation-worker coverage and queue state, unions stable provenance/history, rejects identifier and global-statement collisions, and requires every packed statement to use the paper's global namespace. This prevents a future importer run from erasing a hand-curated paper or leaving the worker with dangling endpoints.

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

Formal declarations retain a prover/checker identity, repository, 40-character commit, file, declaration name, resolved line, checker result, placeholder scan, external-input flag, explicit axiom footprint, and audit note. Informal/formal alignment and proof-route alignment are separate review dimensions. This prevents a checker-accepted declaration from being mislabeled as a completely aligned or assumption-free proof.

Lean 4 is the first populated adapter, not a schema restriction. `FormalProofSubmission` accepts versioned artifacts from any reproducible prover, records content hashes and sandboxed verification runs, and requires a separate admin decision. Submission records belong to the future authenticated control plane; only approved artifacts enter the public corpus.

## Contribution and worker boundary

The public GitHub Pages client never accepts uploads or publishes AI output. The future service boundary is:

```text
contributor -> control plane -> sandboxed workers -> immutable proposal
            -> admin review -> deterministic publisher -> public corpus
```

Workers may resolve sources, extract candidate records, run fixed prompt templates, and execute prover-specific checkers in isolated runners. They must not hold repository publication credentials, edit `src/data/corpus.json`, or execute generated paper-pack code. The publisher consumes only an approved structured changeset and runs the existing validation and build before publication.

## Citation worker boundary

`data/citation-neighborhood.json` is the durable queue snapshot consumed by the static build. Rebuilding the reviewed baseline is a non-destructive merge by default; an explicit `--reset` is required to discard recursive progress. `scripts/ingest-citations.mjs` processes a bounded number of queued papers per invocation while allowing unbounded recursive depth across invocations. Provider responses are cached as gzip-compressed provenance envelopes. Newly discovered papers begin as metadata-only provisional records and are enqueued for their own neighborhoods. If a provider reports references whose records were not retrieved, their IDs remain on the queue for retry rather than being counted as resolved.

Source-authoritative bibliography coverage is determined from explicit author-manuscript or arXiv-source citation edges where the paper is the citing endpoint. A modification marker inherited while discovering an endpoint cannot cause that endpoint's own provider neighborhood to be skipped.

Identity merging requires an exact DOI, arXiv, OpenAlex, Semantic Scholar, ISBN, or internal ID match. Similar titles alone never trigger a merge. Every edge retains its discovery provider, provider record, retrieval time, and confidence.

Reviewed source bibliography counts outrank provider aggregates. For the multislice paper, comment-stripped TeX and the `.bbl` agree on 48 cited works, while the canonical OpenAlex journal record reports 45 and has unresolved/bad endpoints. The source-audited count is therefore durable and cannot be overwritten by a later provider pass. Incoming coverage is separately labeled provider-visible-only because it is discovered through a split FOCS-version identity rather than the journal record.

The first recursive batch processed ten identified papers and expanded the corpus to 2,143 papers and 2,284 citation records. The durable queue contains 2,103 metadata-fetched papers, 36 identity-blocked records, 3 complete direct neighborhoods, and 1 fetched neighborhood awaiting review. Queue reconciliation reactivates a blocked record whenever an exact merged OpenAlex identity makes it runnable; the schema rejects a stale `resolve-identifiers` block on a paper that already has that identity.

The current application is static-first by design and eagerly loads the committed corpus. Pagination bounds the rendered paper catalog, but a move toward tens of thousands of records should split the client artifact and move catalog search and queue mutation behind the control plane. A future database or worker can preserve these record shapes and invariants while replacing committed JSON and batch scripts. Multi-worker deployment also requires process-safe leasing, locks, rate budgeting, bounded provider pagination, retries, and recovery before DigitalOcean nodes can run the queue safely.

## Route and deployment shape

- `/` — project landing page and featured-paper entry
- `/papers` — paper-corpus command view, rooted citation projection, backlog, and paginated catalog
- `/knowledge` — the canonical living textbook; `?node=<slug>` selects a stable knowledge node within its chapter and local DAG context
- `/knowledge/compression` — read-only whole-field compression atlas and residual ledger
- `/knowledge/coverage` — lazy-loaded source, edition, and theorem-occurrence coverage audit
- `/papers/:paperId` — metadata, graph, proofs, citations, and formal coverage
- `/papers/:paperId/distilled` — generated linear reading
- `/theorems/:globalId` — canonical deep-linked statement
- `/unsolved` — administratively confirmed open problems; currently intentionally empty
- `/train` — random re-proving exercises drawn from reviewed complete paper-result routes
- `/materials` — legacy redirect to `/knowledge`; no Materials page or source shelf
- `/learn` — legacy redirect to `/train`; no Learn page

Vite builds a static artifact. The build copies the same validated application shell to every known paper, distilled-paper, catalog, theorem, Knowledge, Train, and legacy-redirect route, so GitHub Pages serves canonical deep links directly; a copied `404.html` remains as a fallback for unknown client routes. React Router resolves the requested record or redirect from that shared shell.
