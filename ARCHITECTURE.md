# NisabaDB architecture

## Source graphs first, compression second

`src/data/corpus.json` is the build-time source for the paper catalog, citation explorer, reviewed paper graphs, canonical theorem pages, distilled-paper view, and Train exercise pool. `src/data/knowledge.json` and the provisional 126-chapter `src/data/knowledge-roadmap.ts` are frozen Phase-II prototypes for a future independently rewritten textbook. The active Phase I is the uncompressed theorem dependency graph of each approved source book or required volume/part component. Rendering code never owns mathematical proof text or third-party textbook prose.

`data/knowledge/source-records.json` is only the fingerprint-locked index of 688 approved rows and their 717 required components. `data/books/manifest.json` is a generated aggregate whose ordered entries preserve every component identity. A populated entry records its canonical `artifactPath`, `data/books/S####/<component>.json`; an uncreated entry records `null` and owns no placeholder file. Four candidate graphs use the v1.1 sharded representation described below, while the other 713 entries remain explicit absent artifacts.

Source-graph completion is independent of compression. A book can be exhaustively inventoried and its source-faithful graph independently reviewed while every cross-source equivalence or Knowledge mapping remains unclassified. Canonical claims, residual decisions, the legacy `data/knowledge/coverage-ledger.json`, `src/data/compression.json`, and the 126-chapter roadmap belong to Phase II and cannot be required to close a Phase-I graph. Textbook-wide Lean 4 formulation begins only after Phase II has selected simplified canonical theorem identities and routes; those formal artifacts retain traceability to the raw source nodes but do not belong to the raw extraction layer.

- **Papers** exposes the large provisional corpus, a bounded citation-ancestry projection, processing backlog, and one complete proof-dependency graph for each reviewed paper. Main results and sections are focus points inside that graph, not separate graph tabs. Paper dependency disclosures start folded; readers expand only the result branches they want to inspect.
- **Knowledge** is a frozen Phase-II prototype with 60 initial-rewrite nodes in 20 draft chapters. Its separate 126-chapter roadmap is neither source coverage nor a fixed target for the eventual compressed text.
- **Knowledge / Compression** is a frozen read-only Phase-II hypothesis atlas. It must not advance while source graphs are the active phase.
- **Knowledge / Coverage** is a manifest-only status diagnostic, not a raw-graph reader or a target for further raw-graph UI work. Phase-I progress is reported from the small registry and manifest while raw graph shards remain data-only.
- **Unsolved** remains empty until a precise problem passes an administratively reviewed, dated literature audit.
- **Train** derives proof exercises from meaningful theorem-like nodes in gold paper graphs. An eligible result must have a reviewed, complete proof route and cannot be an imported result. Selection is random, the stored proof begins hidden, and prerequisite, proof-idea, and reviewed-route help is disclosed progressively for either a human or AI trainee.
- **Materials** and **Learn** are no longer product surfaces. Their legacy URLs remain only as redirects to Knowledge and Train respectively.

### Phase-I storage migration

The v1.1 codec preserves each component's stable `.json` path as a small index containing identity, exact-edition metadata, workflow state, a conservative distribution class, logical and component digests, and ordered shard descriptors. Its sibling `<component>/` directory contains canonical LF-terminated JSONL collections for source units, unit inventories, nodes, external inputs, dependencies, proof routes, and source references. Records retain their logical array order so existing extraction and graph-audit hashes remain valid; a deterministic byte boundary splits each collection so no shard exceeds 5 MiB. This sequential split is a transport checkpoint for removing monolithic payloads, not the final bulk-authoring layout: stable source-unit or stable-ID partitions are required before iterative extraction across the full registry so an insertion cannot churn every subsequent shard.

Every shard index entry records its relative path, schema version, record count, byte count, and SHA-256 digest. A component digest covers the logical digest, distribution policy, metadata, and ordered shard descriptors. The first migration preserves every existing per-entity evidence object and logical record exactly rather than deduplicating reviews or rewriting their subjects. The root manifest contains exactly 717 registry-derived component rows, counts its four non-null artifacts separately, and represents the other 713 components with null artifact paths without losing queue identity.

Git currently stores the schemas, small manifests, four candidate JSONL datasets, review decisions, and newly written normalized descriptions. It does not store source PDFs, EPUBs, or bulk verbatim text merely because an extractor can access them. Each component declares whether its derived records may be distributed; restricted source caches remain local or private while hashes, stable locators, structural edges, and permitted descriptions retain provenance. Before full-registry extraction, a v1.2 placement layer must use stable source-unit or stable-ID/hash-prefix partitions and keep immutable content-addressed shards in license-appropriate object storage or local caches while Git retains their indexes, digests, review records, and small mergeable metadata. SQLite, DuckDB, and search indexes may be generated for workers or analysis, but they are disposable derivatives and never the review authority.

The current import command is deliberately single-writer. Its component write and root-manifest refresh are rollback-safe for an ordinary error, but they are neither crash-journaled nor protected against concurrent writers. A distributed extractor therefore must make each worker emit an isolated proposal binding the base manifest/component digests, immutable source pin, adapter digest, and candidate object references without mutating the shared manifest. One coordinator validates the proposal, promotes immutable shards, and commits a new root-manifest generation with compare-and-swap locking, a write-ahead journal, and the root pointer written last. Parallel worker fan-out is blocked until that promotion protocol and the stable partition/placement layer exist.

Raw graph shards are not copied into the GitHub Pages artifact, and the development server refuses component/shard requests. If public graph dumps are later useful, a release or object store will publish versioned compressed snapshots with the same component and shard digests, and only after the relevant distribution decision is approved. S0060, S0091, S0164, and S0262 have exact logical round-trip parity under the codec: 6, 3, 6, and 15 shards respectively, with 30 total shards and a largest shard of 5,242,811 bytes. Importers read either legacy v1 or v1.1 and perform single-writer v1.1 updates that are rollback-safe for ordinary errors; full-corpus checks reject missing, altered, or orphan shards.

### Exact-source resolution ledger

`data/book-sources/manifest.json` is a generated operational queue over the same 717 immutable component identities. Authored records are sparse: `data/book-sources/S####/<component>.json` exists only after evidence supports a source or duplicate proposal, while unresolved identities receive no neutral file. This ledger is distinct from both the raw graph manifest and Phase-II Knowledge lineage, and it is not a browser payload.

Each exact-edition proposal binds its locator, access mode, source format, license statement, immutable repository revision when applicable, source artifact hash, and source-unit-manifest hash. Source discovery, edition identity, acquisition, license/distribution clearance, importer compatibility, and graph review are separate states. Candidate license metadata does not constitute administrative clearance for a derived-data release. Administrative approval is valid only for the canonical proposal subject hash, comes from the configured administrator allowlist, and is independent of the proposer; changed evidence makes the decision stale. A populated graph must agree with its resolution proposal, but it remains candidate data until the exact edition is selected and the extraction and graph reviews independently pass.

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

KnowledgeRoadmap
  ├─ Part ── groups ──> RoadmapChapter
  ├─ RoadmapChapter ── candidatePrerequisiteChapterIds -> earlier RoadmapChapter
  ├─ Draft ── knowledgeChapterId -> KnowledgeBook.Chapter
  └─ Planned ── no learner link and no completion claim

SourceRegistry ── indexes ──> BookGraphManifest
  └─ SourceRecord               └─ one BookGraph entry per required component
       └─ required components        └─ path -> data/books/S####/<component>.json

BookGraph
  ├─ exact SourceEdition identity and artifact fingerprint
  ├─ ordered SourceUnit manifest: chapter / section / page / source file / web node
  ├─ SourceUnitInventory ── exact node IDs or reviewed theorem-free attestation per unit
  ├─ SourceGraphNode
  │    ├─ theorem-like result or supporting definition / construction / assumption
  │    ├─ exact source label and locator
  │    └─ evidence state: pending / captured / independently reviewed
  ├─ SourceDependencyEdge
  │    ├─ prerequisite node or external input -> dependent node
  │    └─ role, rationale, evidence locator, capture audit, and review state
  ├─ ProofRoute ── theorem node + the dependency IDs used by that route
  ├─ SourceReference ── explicit xref or bibliography citation with resolution and audit state
  └─ ExternalInput ── imported theorem, axiom, definition, standard fact, or citation

Phase-II mapping (frozen)
  SourceGraphNode -> CanonicalClaim -> KnowledgeNode or retained ResidualArtifact

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

Written Knowledge has two compatible orders over the same records. Chapter and section numbers support ordinary previous/next reading; prerequisite edges support local “know first” and “immediately unlocks” views, dependency closure, and later alternate reading paths. Those stored direct edges are transitively reduced. The whole-book roadmap is a third, explicitly provisional planning layer and does not masquerade as written content. The source-lineage layer records where ideas and notation were compared, but source containers are not reader-facing chapters and their wording is not copied into the textbook. A future paperback selects important portions of these same nodes instead of creating a second mathematical authority.

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

The roadmap schema separately rejects duplicate or out-of-order part and chapter identities, fewer than 101 working chapters, empty parts, missing or non-earlier candidate prerequisites, cycles, and mismatched working counts. Module-level checks require every candidate compression-cluster ID to exist and every written Knowledge chapter to be mapped exactly once. Tests keep planned chapters non-clickable and guard against redundant direct edges in the written graph.

The per-book source-graph validator separately requires:

- the generated manifest to index all 717 required components exactly once, with a safe unique path and identity matching its immutable source row/component;
- every logical component and every referenced shard to validate independently, so one damaged book cannot be hidden by aggregate counts;
- exact editions to carry stable locators, access/license notes, artifact fingerprints, and ordered content-fingerprinted source-unit manifests;
- every extracted source unit to have an evidence-bound inventory listing its theorem/support nodes or explicitly attesting that the unit is theorem-free; reviewed extraction requires independent review of every unit decision;
- every theorem-like source occurrence and every supporting graph node to retain a permanent local ID, kind, exact label, source unit, and locator;
- every direct dependency to name an existing dependent node and an existing distinct prerequisite node or external input, plus a role, rationale, evidence locator, capture audit, and review state; duplicate and self edges are rejected;
- captured candidate edges and source references to remain distinguishable from independently reviewed evidence;
- a graph-complete theorem-like node to have a reviewed source route with reviewed dependencies, or an explicit reviewed root/external-input attestation;
- a graph-complete component to cover every immutable source unit, contain every theorem-like result in scope, and carry an independent administrative review by someone other than the extractor; and
- compression dispositions and canonical Knowledge targets to remain outside the Phase-I completion predicate.

The exact-source resolver separately requires all 717 component identities in order, safe unique sparse-record paths, hash-bound proposal and license decisions, independent administrator review, explicit open blocker domains, importer results bound to their exact source pin and candidate graph hashes, and agreement between every populated graph and its source proposal. Candidate source records never count as verified editions merely because an importer produced a valid graph.

The publication build recomputes the ordered source registry, the 717-entry exact-source queue, the 717-component book manifest, every edition unit manifest, every current Knowledge-node content fingerprint, and every administrative review's subject fingerprint. A stale source, graph, target, or approval therefore fails publication instead of inheriting an old reviewed state.

The current 688-row / 717-component registry is intentionally incomplete. S0060, S0091, S0164, and S0262 contain four pinned candidate extractions in sharded v1.1 storage; the other 713 component identities have null artifact paths. All four have candidate exact-edition and importer records, while zero editions, extraction decisions, dependencies, or complete graphs are independently reviewed. S0060 exercises the original PreTeXt `.ptx` boundary; S0091 and S0164 extend it to `.xml` content roots while excluding embedded PreFigure asset XML and graph-like markup nested in examples, exercises, activities, remarks, and other pedagogical containers. S0091 captures 103 nodes but no explicit proof-xref edge, so its 65 theorem-like nodes remain dependency-pending. S0164 captures 348 nodes and 70 explicit proof-xref candidates, with 21 unresolved xrefs and an open ambiguity between GFDL-1.2-or-later and GFDL-1.3-or-later markers in the active source closure. S0262 exercises the large-scale LaTeX boundary against the permanent Stacks tag system: 116 source units, 14,993 nodes, 11 typed external theorems, and 36,289 proof-use edges. Its importer excludes examples, exercises, and ordinary remarks; promotes only seven exact-label theorem-level claims and ten proof-used definition/construction spans outside formal environments; resolves only source-audited aliases, named invocations, claim prerequisites, primary-source bibliographic invocations, deictic delegations, occurrence-specific recall-bundle uses, and exact owner-specific section delegations; separates explicitly alternate proofs into distinct routes; and retains only genuinely unresolved tagged and bibliographic proof references for review. The pinned revision and family-specific regression tests protect formal aliases; exact owner/count guards bound semantic exceptions. Section delegations additionally require the owner statement hash, full proof hash, permanent section tag, and exact occurrence artifact, while every unlisted owner of the same shared section label remains unresolved. The rejected example-heavy S0002 extraction has been restored to an absent artifact. A root-manifest entry establishes ownership and queue identity without a physical file, while a candidate extraction still cannot claim theorem coverage until its inventory and dependency decisions receive independent review.

Required **Knowledge-node** fields also keep motivation, tutorial prose, a key idea, at least one worked example, a progressively disclosed exercise, source lineage, rewrite status, read time, and tags in the canonical data rather than the React components. Those Phase-II teaching examples are distinct from Phase-I source-graph nodes: source worked examples and routine calculations are not theorem dependencies. Knowledge-node exercises are part of the future textbook; the `/train` pool is independently derived from paper results.

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

Workers may resolve sources, extract candidate records, run fixed prompt templates, and execute prover-specific checkers in isolated runners. They must not hold repository publication credentials, edit `src/data/corpus.json`, or execute generated paper-pack code. A worker source proposal binds the manifest generation, source pin, adapter, output hashes, and object references it observed; it cannot select or approve itself. The coordinator consumes only a validated, administratively approved structured changeset and runs the existing validation and build before publication.

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
- `/knowledge` — the rewritten textbook draft and provisional whole-book map; `?node=<slug>` selects a stable written node within its chapter and local DAG context
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
