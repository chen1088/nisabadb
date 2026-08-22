import { compressionProgram } from "./compression";
import { knowledgeBook } from "./knowledge";
import {
  validateKnowledgeRoadmap,
  type KnowledgeRoadmapChapter,
  type KnowledgeRoadmapPart,
} from "./knowledge-roadmap-schema";

type ChapterSeed = readonly [
  slug: string,
  title: string,
  goal: string,
  draftChapterId?: string,
];

type PartSeed = {
  id: `P${string}`;
  title: string;
  summary: string;
  compressionClusterIds: string[];
  entryPrerequisiteSlugs: string[];
  chapters: ChapterSeed[];
};

const partSeeds: PartSeed[] = [
  {
    id: "P01",
    title: "Meaning, notation, and mathematical objects",
    summary: "Separate things from their names, quantities from numerals, and valid expressions from meaningless symbol pushing.",
    compressionClusterIds: ["precise-mathematical-language"],
    entryPrerequisiteSlugs: [],
    chapters: [
      ["quantities-objects-units", "Quantities, objects, units, and symbols", "Separate objects, attributes, values, units, typed symbols, equality, and definition before calculation begins.", "quantity-units"],
      ["variables-domains-collections", "Variables, domains, and collections", "Control allowed substitutions and describe collections by explicit membership conditions.", "language"],
      ["scope-binding-substitution", "Scope, binding, and substitution", "Track where names are introduced, where they remain active, and which replacements preserve meaning."],
      ["diagrams-tables-representations", "Diagrams, tables, and representations", "Move between equivalent representations while retaining the information each one exposes."],
      ["formal-syntax-semantics", "Formal syntax and semantics", "Separate well-formed expressions, interpretations, denotations, and truth conditions."],
      ["questions-specifications", "Mathematical questions and specifications", "Turn an informal problem into explicit inputs, outputs, assumptions, and success conditions."],
    ],
  },
  {
    id: "P02",
    title: "Quantity and exact computation",
    summary: "Build number systems and arithmetic from matching, order, reversible operations, and exact units.",
    compressionClusterIds: ["numbers-and-algebraic-laws"],
    entryPrerequisiteSlugs: ["quantities-objects-units"],
    chapters: [
      ["matching-counting-place-value", "Matching, counting, and place value", "Construct whole numbers by one-to-one matching and encode them efficiently in positional notation.", "counting-place-value"],
      ["addition-subtraction-multiplication", "Addition, subtraction, and multiplication", "Understand the basic operations as combining, undoing, repeated grouping, and scaling.", "arithmetic-operations"],
      ["division-divisibility", "Division, remainders, and divisibility", "Separate exact division from quotient-with-remainder and record divisibility with explicit witnesses.", "division-divisibility"],
      ["signed-numbers-distance", "Signed numbers and distance", "Extend order and arithmetic to directed change while treating absolute value as distance.", "signed-numbers"],
      ["fractions-exact-quotients", "Fractions and exact quotients", "Treat fractions as numbers, compare equivalent forms, and compute using common units.", "fractions"],
      ["decimals-ratios-proportion", "Decimals, ratios, rates, and percent", "Unify base-ten fractions, relative comparison, unit rates, proportional scaling, and percent.", "proportional-reasoning"],
    ],
  },
  {
    id: "P03",
    title: "Algebraic rewriting and equations",
    summary: "Compress arithmetic and symbolic manipulation into laws with explicit domains, inverses, and preserved solution sets.",
    compressionClusterIds: ["numbers-and-algebraic-laws", "presentations-rewriting-normal-forms"],
    entryPrerequisiteSlugs: ["decimals-ratios-proportion"],
    chapters: [
      ["powers-roots-estimation", "Powers, roots, units, and estimation", "Use repeated scaling, inverse powers, dimensional checks, and bounds without losing side conditions.", "powers-roots-estimation"],
      ["expressions-operation-laws", "Expressions and operation laws", "Parse expressions and justify each rewrite by a named law valid in the current number system.", "numbers-algebra"],
      ["equations-solution-sets", "Equations and solution sets", "Transform equations while tracking when a step preserves, loses, or introduces solutions."],
      ["inequalities-feasible-regions", "Inequalities and feasible regions", "Reason about order-preserving transformations and interpret constraints geometrically."],
      ["polynomials-factorization", "Polynomials and factorization", "Represent finite algebraic combinations in canonical forms and move between expanded and factored structure."],
      ["algebraic-structures-homomorphisms", "Algebraic structures and homomorphisms", "Extract the shared operational laws behind number systems, matrices, permutations, and computational objects."],
    ],
  },
  {
    id: "P04",
    title: "Logic, proof, induction, and recursion",
    summary: "Make reasoning reusable by exposing truth conditions, proof obligations, recursive construction, and invariant certificates.",
    compressionClusterIds: ["precise-mathematical-language", "induction-recursion-decomposition", "proof-certificates-verification"],
    entryPrerequisiteSlugs: ["variables-domains-collections", "expressions-operation-laws"],
    chapters: [
      ["statements-predicates-connectives", "Statements, predicates, and connectives", "Translate claims into truth-valued forms whose logical structure can be inspected.", "logic"],
      ["quantifiers-logical-transformations", "Quantifiers and logical transformations", "Control domains, quantifier order, negation, converse, inverse, and contrapositive forms."],
      ["direct-proof-witness-counterexample", "Direct proof, witnesses, and counterexamples", "Match universal and existential goals with the shortest checkable proof construction.", "proof"],
      ["induction-recursive-definitions", "Induction and recursive definitions", "Use a base case and a preservation step to define and prove claims over generated structures.", "sequences-recursion"],
      ["invariants-extremal-descent", "Invariants, extremal arguments, and descent", "Prove progress or impossibility by tracking what cannot change or must strictly improve.", "algorithms-invariants"],
      ["proof-planning-lemmas", "Proof planning and reusable lemmas", "Factor a long argument into named interfaces whose hypotheses and conclusions compose."],
    ],
  },
  {
    id: "P05",
    title: "Relations, functions, order, and finite structure",
    summary: "Use sets, relations, maps, and universal constructions as one interoperable language for structure.",
    compressionClusterIds: ["precise-mathematical-language", "composition-gluing-universal-properties"],
    entryPrerequisiteSlugs: ["direct-proof-witness-counterexample"],
    chapters: [
      ["sets-set-operations", "Sets and set operations", "Describe collections extensionally and compute with membership rather than notation alone.", "sets"],
      ["relations-equivalence", "Relations and equivalence", "Model pairwise structure and compress interchangeable objects into quotient classes.", "relations-equivalence"],
      ["functions-images-composition", "Functions, images, and composition", "Treat a function as a typed assignment and compose maps only when their interfaces match.", "functions"],
      ["orders-lattices-closure", "Orders, lattices, and closure operators", "Generalize comparison and completion processes beyond the ordinary number line."],
      ["finite-structures-morphisms", "Finite structures and morphisms", "Describe finite mathematical objects by operations and relations together with structure-preserving maps."],
      ["universal-constructions-categories", "Universal constructions and categories", "Recognize products, quotients, and free constructions through the maps they uniquely support."],
    ],
  },
  {
    id: "P06",
    title: "Counting and combinatorial construction",
    summary: "Count without duplication by decomposing choices, building bijections, and encoding finite objects.",
    compressionClusterIds: ["induction-recursion-decomposition", "presentations-rewriting-normal-forms"],
    entryPrerequisiteSlugs: ["sets-set-operations", "induction-recursive-definitions"],
    chapters: [
      ["sum-product-bijection", "Sum, product, and bijective counting", "Reduce counting to disjoint alternatives, staged choices, and reversible encodings."],
      ["permutations-combinations", "Permutations and combinations", "Count ordered and unordered selections while making repeated objects explicit."],
      ["inclusion-exclusion-mobius", "Inclusion-exclusion and Möbius inversion", "Recover exact counts from overlapping aggregates by alternating correction."],
      ["generating-functions", "Generating functions", "Encode a sequence as an algebraic object whose operations implement combinatorial constructions."],
      ["extremal-probabilistic-methods", "Extremal and probabilistic methods", "Prove existence through bounds, averaging, and carefully chosen random constructions."],
      ["designs-matroids-dependence", "Designs, matroids, and abstract dependence", "Extract the common independence laws behind vectors, graphs, and set systems."],
    ],
  },
  {
    id: "P07",
    title: "Geometry, measurement, and transformation",
    summary: "Study shape through invariants under motion, coordinate descriptions, measurement, and constructive decomposition.",
    compressionClusterIds: ["symmetry-actions-invariants", "topology-continuity-completion"],
    entryPrerequisiteSlugs: ["decimals-ratios-proportion", "functions-images-composition"],
    chapters: [
      ["measurement-congruence-similarity", "Measurement, congruence, and similarity", "Separate exact shape from scale and connect ratios to geometric measurement."],
      ["coordinates-vectors-geometry", "Coordinates and vectors for geometry", "Translate points and displacements into computations without losing geometric meaning."],
      ["transformations-geometric-symmetry", "Transformations and geometric symmetry", "Classify motions by the distances, angles, orientation, and incidence they preserve."],
      ["euclidean-proof-construction", "Euclidean proof and construction", "Combine incidence, congruence, similarity, and auxiliary constructions into checkable arguments."],
      ["curvature-non-euclidean", "Curvature and non-Euclidean geometry", "Understand which familiar geometric laws depend on flatness and how curvature changes them."],
      ["computational-discrete-geometry", "Computational and discrete geometry", "Represent geometric objects so intersection, visibility, hull, and partition questions become algorithms."],
    ],
  },
  {
    id: "P08",
    title: "Linearity, matrices, and spectra",
    summary: "Use linearity as a shared computational engine for equations, geometry, approximation, probability, and dynamics.",
    compressionClusterIds: ["linearity-as-common-engine"],
    entryPrerequisiteSlugs: ["functions-images-composition", "coordinates-vectors-geometry"],
    chapters: [
      ["vectors-linear-systems", "Vectors and linear systems as computation", "Represent simultaneous constraints with vectors and solve them by reversible elimination.", "linear-computation"],
      ["matrices-linear-maps", "Matrices and linear maps", "Keep an abstract linear transformation distinct from any chosen coordinate matrix."],
      ["subspaces-bases-dimension", "Subspaces, bases, and dimension", "Describe the degrees of freedom of a linear system through independent generators."],
      ["determinants-exterior-structure", "Determinants and exterior structure", "Interpret determinants as oriented volume scaling rather than a memorized formula."],
      ["eigenvalues-decomposition", "Eigenvalues and structural decomposition", "Find directions and components on which a transformation acts independently."],
      ["inner-products-least-squares", "Inner products, orthogonality, and least squares", "Turn geometry into measurement, projection, best approximation, and stable computation."],
    ],
  },
  {
    id: "P09",
    title: "Symmetry, actions, invariants, and quotients",
    summary: "Compress repeated algebraic and geometric arguments into actions, orbit structure, representations, and invariant data.",
    compressionClusterIds: ["symmetry-actions-invariants"],
    entryPrerequisiteSlugs: ["algebraic-structures-homomorphisms", "transformations-geometric-symmetry"],
    chapters: [
      ["groups-actions-orbits", "Groups, actions, orbits, and stabilizers", "Model reversible symmetry operations and decompose a space into transformation classes."],
      ["permutation-groups", "Permutation groups and finite symmetry", "Compute abstract group structure through explicit rearrangements of finite objects."],
      ["representations-characters", "Representations and characters", "Translate symmetry into linear operators and retain only the spectral data needed for comparison."],
      ["lie-groups-lie-algebras", "Lie groups and Lie algebras", "Connect continuous symmetries to infinitesimal generators and differential equations."],
      ["invariant-theory-quotients", "Invariant theory and quotients", "Describe objects up to symmetry using functions and constructions unchanged by the action."],
      ["computational-symmetry", "Computational symmetry and canonical forms", "Exploit symmetry to reduce search, choose representatives, and avoid duplicate computation."],
    ],
  },
  {
    id: "P10",
    title: "Topology, continuity, compactness, and completion",
    summary: "Unify closeness, convergence, and global finiteness principles across analysis, geometry, probability, and computation.",
    compressionClusterIds: ["topology-continuity-completion"],
    entryPrerequisiteSlugs: ["functions-images-composition", "signed-numbers-distance"],
    chapters: [
      ["metric-spaces-convergence", "Metric spaces and convergence", "Express approximation through a distance and distinguish local closeness from eventual convergence."],
      ["continuity-homeomorphism", "Continuity and homeomorphism", "Identify properties preserved by small perturbations and reversible continuous changes of coordinates."],
      ["compactness-completeness", "Compactness and completeness", "Separate finite subcover control from the existence of limits for internally convergent processes."],
      ["connectedness-separation", "Connectedness and separation", "Detect whether a space decomposes and which points or sets can be distinguished by neighborhoods."],
      ["homotopy-fundamental-invariants", "Homotopy and fundamental invariants", "Classify shapes through continuous deformation and algebraic records of holes."],
      ["manifolds-bundles", "Manifolds and bundles", "Build curved global spaces from compatible local coordinate models and attached data."],
    ],
  },
  {
    id: "P11",
    title: "Local-to-global calculus and geometry",
    summary: "Pass from local rates and linear approximations to global accumulation, geometry, and analytic structure.",
    compressionClusterIds: ["local-to-global-calculus"],
    entryPrerequisiteSlugs: ["powers-roots-estimation", "metric-spaces-convergence", "vectors-linear-systems"],
    chapters: [
      ["limits-derivatives", "Limits and derivatives", "Define instantaneous change through controlled approximation rather than infinitesimal symbolism alone."],
      ["integrals-accumulation", "Integrals and accumulation", "Recover total change from local contributions and connect area, mass, probability, and work."],
      ["multivariable-calculus", "Multivariable calculus", "Generalize derivative and integral constructions to several interacting coordinates."],
      ["differential-forms-stokes", "Differential forms and Stokes principles", "Unify the fundamental theorems of calculus as boundary-versus-interior identities."],
      ["tangent-cotangent-geometry", "Tangent and cotangent geometry", "Separate directions of motion from measurements of those directions on curved spaces."],
      ["complex-analytic-structure", "Complex and analytic structure", "Use complex differentiability to obtain rigidity, contour methods, and powerful local-to-global conclusions."],
    ],
  },
  {
    id: "P12",
    title: "Measure, integration, expectation, and function spaces",
    summary: "Treat size, accumulation, averages, and spaces of functions through one measure-theoretic language.",
    compressionClusterIds: ["measure-integration-expectation", "linearity-as-common-engine"],
    entryPrerequisiteSlugs: ["integrals-accumulation", "sets-set-operations"],
    chapters: [
      ["sigma-algebras-measures", "Sigma-algebras and measures", "Specify measurable questions and assign sizes compatibly under countable decomposition."],
      ["measurable-functions", "Measurable functions", "Identify transformations for which threshold events and pullbacks remain measurable."],
      ["lebesgue-integration", "Lebesgue integration", "Build integration from simple values and measurable level sets rather than partitions of the domain alone."],
      ["convergence-theorems", "Convergence theorems", "State the domination, monotonicity, or integrability needed to exchange limits and integrals."],
      ["lp-spaces-duality", "Lp spaces and duality", "Measure functions by average size and understand how linear measurements act on them."],
      ["operators-function-spaces", "Operators on function spaces", "Extend linear algebra to infinite-dimensional transformations with topology and domain conditions."],
    ],
  },
  {
    id: "P13",
    title: "Randomness, inference, causality, and information",
    summary: "Connect finite chance, conditioning, concentration, statistical evidence, causal structure, and information loss.",
    compressionClusterIds: ["randomness-conditioning-concentration", "information-coding-learning"],
    entryPrerequisiteSlugs: ["sum-product-bijection", "sigma-algebras-measures"],
    chapters: [
      ["finite-probability", "Finite probability and random experiments", "Model equally and unequally weighted outcomes and compute events without double counting.", "finite-probability"],
      ["conditioning-bayes", "Conditioning and Bayes rules", "Update a probability model after learning an event while tracking the new sample space."],
      ["random-variables-distributions", "Random variables and distributions", "Treat a random variable as a measurable map and a distribution as its pushed-forward law."],
      ["concentration-martingales", "Concentration and martingales", "Control deviations from typical behavior using independence, bounded change, and conditional expectation."],
      ["stochastic-processes", "Stochastic processes", "Study random evolution through state, transition, filtration, stationarity, and stopping structure."],
      ["statistics-causality-information", "Inference, causality, and information", "Separate description, prediction, intervention, and compression when learning from data."],
    ],
  },
  {
    id: "P14",
    title: "Approximation, numerical computation, and asymptotics",
    summary: "Make approximation trustworthy by exposing error, conditioning, stability, convergence rate, and scale.",
    compressionClusterIds: ["approximation-error-stability", "asymptotics-scale-universality"],
    entryPrerequisiteSlugs: ["inner-products-least-squares", "limits-derivatives"],
    chapters: [
      ["error-conditioning-stability", "Error, conditioning, and stability", "Separate sensitivity of a problem from amplification introduced by an algorithm."],
      ["numerical-linear-algebra", "Numerical linear algebra", "Solve linear problems with factorizations and iterative methods that respect finite precision."],
      ["numerical-calculus-equations", "Numerical calculus and differential equations", "Approximate derivatives, integrals, roots, and trajectories with explicit consistency and stability tests."],
      ["approximation-interpolation", "Approximation and interpolation", "Choose finite representations that balance expressiveness, fit, regularity, and error."],
      ["asymptotic-expansions", "Asymptotic bounds and expansions", "Compare growth and extract leading behavior while stating the regime and remainder."],
      ["optimization-algorithms", "Optimization algorithms", "Use gradients, projections, curvature, and certificates to find or bound good solutions."],
    ],
  },
  {
    id: "P15",
    title: "Evolution, dynamical systems, ODEs, PDEs, and generators",
    summary: "Describe changing states with updates, flows, semigroups, conserved quantities, and infinitesimal generators.",
    compressionClusterIds: ["evolution-transitions-flows"],
    entryPrerequisiteSlugs: ["induction-recursive-definitions", "multivariable-calculus", "operators-function-spaces"],
    chapters: [
      ["discrete-dynamical-systems", "Discrete dynamical systems", "Iterate a state update and classify fixed, periodic, stable, and chaotic behavior."],
      ["ode-flows", "Ordinary differential equations and flows", "Relate local velocity laws to trajectories, existence, uniqueness, and stability."],
      ["pde-conservation-diffusion", "PDEs, conservation, waves, and diffusion", "Connect local balance laws to transport, propagation, smoothing, and boundary conditions."],
      ["semigroups-generators", "Semigroups and generators", "Unify repeated discrete transitions and continuous evolution through composition laws."],
      ["ergodic-chaotic-behavior", "Ergodic and chaotic behavior", "Distinguish long-run statistical regularity from sensitive trajectory-level behavior."],
      ["multiscale-perturbation", "Multiscale and perturbation methods", "Separate interacting scales and track how small parameter changes alter qualitative dynamics."],
    ],
  },
  {
    id: "P16",
    title: "Optimization, duality, equilibrium, games, and control",
    summary: "Turn choices and constraints into primal objects, dual certificates, equilibria, and feedback policies.",
    compressionClusterIds: ["optimization-duality-equilibrium"],
    entryPrerequisiteSlugs: ["inequalities-feasible-regions", "inner-products-least-squares"],
    chapters: [
      ["convexity-certificates", "Convexity and optimality certificates", "Use shape and separating inequalities to distinguish local from global optima."],
      ["lagrange-duality", "Lagrange multipliers and duality", "Convert constraints into prices or witnesses that bound and sometimes identify optimal solutions."],
      ["combinatorial-optimization", "Combinatorial optimization", "Exploit discrete structure, relaxations, exchange arguments, and integrality."],
      ["games-equilibrium", "Games and equilibrium", "Model interacting objectives and determine when no participant benefits from unilateral change."],
      ["control-dynamic-programming", "Control and dynamic programming", "Choose actions over time using state, cost-to-go, feedback, and the principle of optimality."],
      ["variational-principles", "Variational principles", "Characterize equations and equilibria as stationary or minimal points of global functionals."],
    ],
  },
  {
    id: "P17",
    title: "Networks, flows, Laplacians, and discrete dynamics",
    summary: "Use graph structure to unify connectivity, transport, cuts, matching, diffusion, and distributed systems.",
    compressionClusterIds: ["networks-paths-flows-laplacians"],
    entryPrerequisiteSlugs: ["relations-equivalence", "vectors-linear-systems"],
    chapters: [
      ["graphs-relations", "Graphs as relations", "Represent pairwise connections as a reusable object with local neighborhoods and global structure.", "graphs"],
      ["paths-trees-connectivity", "Paths, trees, and connectivity", "Build and certify connected structure with paths, cycles, spanning trees, and separators."],
      ["flows-cuts-matchings", "Flows, cuts, and matchings", "Relate feasible transport and pairing to obstruction certificates and duality."],
      ["laplacians-spectral-graphs", "Laplacians and spectral graph structure", "Translate network geometry into linear operators, energies, and eigenmodes."],
      ["random-networks", "Random networks", "Study typical and threshold behavior when edges, vertices, or weights are random."],
      ["distributed-network-dynamics", "Distributed and network dynamics", "Understand consensus, contagion, synchronization, and local algorithms on a graph."],
    ],
  },
  {
    id: "P18",
    title: "Presentations, rewriting, algorithms, automata, and complexity",
    summary: "Turn mathematical descriptions into executable transformations, canonical forms, state machines, and resource bounds.",
    compressionClusterIds: ["presentations-rewriting-normal-forms", "proof-certificates-verification"],
    entryPrerequisiteSlugs: ["invariants-extremal-descent", "finite-structures-morphisms"],
    chapters: [
      ["algorithms-state-invariants", "Algorithms, state, and invariants", "Specify a finite process by its state transitions, maintained facts, and termination measure."],
      ["complexity-reductions", "Complexity and reductions", "Compare computational problems by resource bounds and structure-preserving transformations."],
      ["automata-languages", "Automata and formal languages", "Connect finite state, accepted descriptions, algebraic transition structure, and logical expressibility."],
      ["rewriting-normal-forms", "Rewriting systems and normal forms", "Compute by local replacement while proving termination, confluence, and canonical output."],
      ["symbolic-computation", "Symbolic and computational algebra", "Represent exact mathematical objects so algebraic laws become verified algorithms."],
      ["randomized-approximation-algorithms", "Randomized and approximation algorithms", "Trade certainty or exactness for speed while proving probability and error guarantees."],
    ],
  },
  {
    id: "P19",
    title: "Composition, gluing, universal properties, and homological structure",
    summary: "Build global objects from compatible local pieces and measure the obstructions to exact composition.",
    compressionClusterIds: ["composition-gluing-universal-properties", "local-to-global-calculus"],
    entryPrerequisiteSlugs: ["universal-constructions-categories", "manifolds-bundles"],
    chapters: [
      ["categories-functors-natural", "Categories, functors, and natural transformations", "Reason through objects and composable maps while preserving constructions across settings."],
      ["limits-colimits-adjunctions", "Limits, colimits, and adjunctions", "Recognize universal ways to impose compatibility, combine data, or translate between structures."],
      ["sheaves-local-global", "Sheaves and local-to-global consistency", "Track when locally defined data agree and glue to a global object."],
      ["chain-complexes-homology", "Chain complexes and homology", "Measure failures of exactness through cycles, boundaries, and derived invariants."],
      ["exact-sequences-derived-tools", "Exact sequences and derived tools", "Transport information through composable maps and isolate obstructions systematically."],
      ["higher-structures-homotopy", "Higher structures and homotopy", "Retain transformations between transformations rather than collapsing all equivalence to equality."],
    ],
  },
  {
    id: "P20",
    title: "Foundations, computability, and formal verification",
    summary: "Expose the assumptions, expressive limits, computational content, and machine-checkable evidence behind mathematics.",
    compressionClusterIds: ["proof-certificates-verification", "precise-mathematical-language"],
    entryPrerequisiteSlugs: ["proof-planning-lemmas", "automata-languages"],
    chapters: [
      ["sets-cardinality-choice", "Sets, cardinality, and choice", "Compare sizes beyond the finite and state the selection principles used to build global objects."],
      ["logic-models-completeness", "Logic, models, and completeness", "Separate syntactic derivability from semantic truth and study when they coincide."],
      ["computability-incompleteness", "Computability and incompleteness", "Identify effective procedures and the formal statements no sufficiently strong computable theory settles internally."],
      ["type-theory-dependent-types", "Type theory and dependent types", "Treat propositions as structured types and proofs as constructions checked by local rules."],
      ["proof-assistants-formalization", "Proof assistants and formalization", "Translate definitions and proofs into reproducible artifacts without confusing checking with discovery."],
      ["certificates-audits", "Certificates, audits, and cross-prover evidence", "Design proof evidence that can be independently replayed, compared, and administratively reviewed."],
    ],
  },
  {
    id: "P21",
    title: "Mathematical modeling and domain bridges",
    summary: "Forge explicit bridges from the common core into physical, biological, economic, social, and research-specific models.",
    compressionClusterIds: ["asymptotics-scale-universality", "information-coding-learning", "evolution-transitions-flows"],
    entryPrerequisiteSlugs: ["error-conditioning-stability", "statistics-causality-information", "multiscale-perturbation"],
    chapters: [
      ["dimensional-modeling-scaling", "Dimensional modeling and scaling", "Choose state variables, parameters, units, and nondimensional groups before fitting equations."],
      ["inverse-problems-data-assimilation", "Inverse problems and data assimilation", "Recover hidden causes from indirect observations while exposing nonuniqueness and instability."],
      ["physical-models", "Physical models and conservation principles", "Build mechanics, fields, thermodynamics, and quantum descriptions from symmetry, conservation, and scale."],
      ["biological-economic-social-models", "Biological, economic, and social models", "Represent adaptive interacting agents without importing assumptions invisibly from one domain to another."],
      ["information-learning-pseudorandomness", "Information, learning, and pseudorandomness", "Relate distinguishability, compression, prediction, testing, and limited observation."],
      ["research-bridges-open-problems", "Research bridges and open problems", "Assemble the minimal reviewed prerequisite route to a paper theorem and isolate what remains genuinely unsolved."],
    ],
  },
];

const chapterSeeds = partSeeds.flatMap((part) => part.chapters.map((chapter) => ({ part, chapter })));
const chapterIdBySlug = new Map(
  chapterSeeds.map(({ chapter }, index) => [chapter[0], `R${String(index + 1).padStart(3, "0")}`]),
);

const rawRoadmap = {
  schemaVersion: "1.0.0" as const,
  title: "Whole-book working map",
  updatedAt: "2026-08-22",
  workingChapterCount: chapterSeeds.length,
  parts: partSeeds.map((part, index) => ({
    id: part.id,
    number: index + 1,
    title: part.title,
    summary: part.summary,
  })),
  chapters: chapterSeeds.map(({ part, chapter }, index) => {
    const prerequisiteSlugs = part.entryPrerequisiteSlugs;
    return {
      id: `R${String(index + 1).padStart(3, "0")}`,
      slug: chapter[0],
      number: index + 1,
      partId: part.id,
      title: chapter[1],
      goal: chapter[2],
      candidatePrerequisiteChapterIds: prerequisiteSlugs.map((slug) => {
        const id = chapterIdBySlug.get(slug);
        if (!id) throw new Error(`Roadmap chapter ${chapter[0]} has missing prerequisite slug ${slug}`);
        return id;
      }),
      compressionClusterIds: part.compressionClusterIds,
      publication: chapter[3]
        ? { state: "draft" as const, knowledgeChapterId: chapter[3] }
        : { state: "planned" as const },
    };
  }),
};

export const knowledgeRoadmap = validateKnowledgeRoadmap(rawRoadmap);
export const roadmapParts = knowledgeRoadmap.parts;
export const roadmapChapters = knowledgeRoadmap.chapters;

const compressionClusterIds = new Set(compressionProgram.clusters.map((cluster) => cluster.id));
for (const chapter of roadmapChapters) {
  for (const clusterId of chapter.compressionClusterIds) {
    if (!compressionClusterIds.has(clusterId)) {
      throw new Error(`${chapter.id} has missing compression cluster ${clusterId}`);
    }
  }
}

const draftMappings = roadmapChapters.flatMap((chapter) => (
  chapter.publication.state === "draft" ? [chapter.publication.knowledgeChapterId] : []
));
const knowledgeChapterIds = knowledgeBook.chapters.map((chapter) => chapter.id);
if (new Set(draftMappings).size !== draftMappings.length
  || draftMappings.length !== knowledgeChapterIds.length
  || knowledgeChapterIds.some((id) => !draftMappings.includes(id))) {
  throw new Error("Roadmap draft chapters must map one-to-one onto every written Knowledge chapter");
}

export const roadmapPartById = new Map(roadmapParts.map((part) => [part.id, part]));
export const roadmapChapterById = new Map(roadmapChapters.map((chapter) => [chapter.id, chapter]));
export const draftRoadmapChapterByKnowledgeChapterId = new Map(
  roadmapChapters.flatMap((chapter) => chapter.publication.state === "draft"
    ? [[chapter.publication.knowledgeChapterId, chapter] as const]
    : []),
);

export function roadmapChaptersForPart(partId: string): KnowledgeRoadmapChapter[] {
  return roadmapChapters.filter((chapter) => chapter.partId === partId);
}

export function draftChapterCountForPart(partId: string): number {
  return roadmapChaptersForPart(partId).filter((chapter) => chapter.publication.state === "draft").length;
}

export type { KnowledgeRoadmapChapter, KnowledgeRoadmapPart };
