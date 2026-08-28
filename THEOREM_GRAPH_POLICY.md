# Phase-I theorem graph policy

The model is the reviewed *Dimension-Free Dictatorship Tester* graph, not a chapter outline or a collection of teaching boxes. That graph has 51 mathematical nodes—16 definitions, 2 notation nodes, 2 imported results, 24 lemmas, 3 propositions, and 4 theorems—joined by 117 proof dependencies. It has no example or calculation nodes.

## Nodes in scope

- Formal results: theorem, lemma, proposition, corollary, claim, and a genuinely named result.
- Formal infrastructure: definition, notation, axiom, assumption, and construction when it establishes the language or objects used by proofs.
- Imported results and external facts only when a source proof actually relies on them; they must be represented explicitly rather than hidden in prose.
- A result embedded in an exercise or example only after review determines that it is genuinely a formal claim needed by another proof. It is then classified as a claim/result, never as an example node.
- A result stated and derived inside a remark or labeled prose/display span only after an exact-label, source-hash audit establishes that it is theorem-level. It is classified as a claim, never as a remark or equation node; this exception cannot be generalized to the surrounding environment class.
- An exact excluded label imported by a source proof may be retained as a `source-artifact` node on the original route. This separate class preserves the section, equation, item, remark, example, exercise, or prose fragment that the source actually cites without counting it as mathematical theorem/support knowledge. Classification as a claim/support node, decomposition into particular results, or closure as a nondependency remains explicit graph-audit debt.

## Material outside the graph

- Worked examples and nonexamples.
- Routine exercises, calculations, algorithms, key-takeaway boxes, and pedagogical activities.
- Ordinary remarks, motivation, tutorial prose, chapter order, and thematic similarity.
- Unreferenced section headings and ordinary hyperlinks.

These may remain source evidence. Mere presence never increases theorem/support counts or creates an edge; only an exact proof reference may create a candidate original-route edge to a separately classified source artifact.

## Edges and routes

- A direct edge means that a source proof uses the prerequisite result, definition, assumption, construction, or external input.
- Repetition, proximity, terminology, chapter order, and statement-level cross-references do not manufacture proof edges.
- Repeated citations of the same prerequisite in one proof merge into one direct edge while retaining source locators in the edge evidence.
- Every captured source proof receives a source route even when it contains no resolved cross-reference. An empty captured route records the raw proof boundary and remains dependency-audit debt; it is not a root attestation.
- A theorem with no reviewed mathematical dependency remains dependency-review pending even if its raw source route is captured. It is not declared a root until independent review confirms a root attestation.
- A proof citation to excluded material or the bibliography remains an unresolved review item until its mathematical role is reviewed. An exact bibliographic invocation may become a typed external theorem only after its owner, occurrence, hypotheses, statement, and primary-source theorem locator are audited; attribution, corroboration, background, and example provenance create no dependency.
- A source-audited nested or expository label may resolve to an existing formal owner. A reviewed notation-only mention or optional after-proof citation may instead be closed as an exact owner-occurrence nondependency; proof-used definitions and constructions remain support nodes. Excluded container classes are never bulk-imported as theorem/support nodes or bulk-aliased to formal results. Exact proof-referenced labels may be captured as source artifacts on the original route, and an audited owner occurrence may later be promoted, decomposed, or suppressed without changing unrelated occurrences.

## Completion

Deterministic extraction creates candidates, not reviewed mathematics. A component becomes `reviewed-complete` only when an independent reviewer confirms every source-unit inventory, every included node, every dependency/root decision, and every unresolved external or excluded target. Empty captured source routes do not satisfy the mathematical-route gate, and raw source artifacts block `reviewed-complete` until they are promoted, decomposed, or closed as occurrence-specific nondependencies. Compression and simplification begin only after the source-local graph gate passes.
