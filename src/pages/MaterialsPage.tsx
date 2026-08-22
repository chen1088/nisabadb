import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  derivativeRightsLabels,
  getMaterial,
  materialAvailabilityLabels,
  materialCollection,
  materialGoals,
  materialKindLabels,
  materialLevelLabels,
  materialRoleLabels,
  materialRoute,
  materials,
} from "../data/materials";

function personList(names: readonly string[]) {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

export function MaterialsPage() {
  const [goalId, setGoalId] = useState("mathematical-common-core");
  const [selectedMaterialId, setSelectedMaterialId] = useState("mit-mathematics-computer-science");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [domain, setDomain] = useState("all");

  const selectedGoal = materialGoals.find((goal) => goal.id === goalId) ?? materialGoals[0]!;
  const route = materialRoute(selectedGoal);
  const selectedMaterial = getMaterial(selectedMaterialId) ?? route.layers.at(-1)?.[0] ?? materials[0];
  const openAdaptationCount = materials.filter(
    (material) => material.access.derivativeRights === "open",
  ).length;
  const domains = useMemo(
    () => [...new Set(materials.flatMap((material) => material.domains))].sort(),
    [],
  );
  const filteredMaterials = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return materials.filter((material) => {
      if (level !== "all" && material.level !== level) return false;
      if (domain !== "all" && !material.domains.includes(domain)) return false;
      if (!normalized) return true;
      return [
        material.title,
        material.authors.join(" "),
        material.plainLanguageRole,
        material.extractFocus.join(" "),
        material.domains.join(" "),
      ].join(" ").toLocaleLowerCase().includes(normalized);
    });
  }, [domain, level, query]);

  return (
    <div className="materials-page page-shell">
      <header className="page-hero compact-page-hero materials-hero">
        <p className="eyebrow">First source collection · checked {materialCollection.verifiedAt}</p>
        <h1>Start at zero. Carry only what a goal needs.</h1>
        <p>
          These books, courses, notes, and software labs are raw evidence for rebuilding
          mathematics around the learner. They are not a syllabus, and an entire book is
          never treated as one piece of Knowledge.
        </p>
      </header>

      <section className="materials-contract" aria-labelledby="materials-contract-title">
        <div>
          <p className="eyebrow">What this collection means</p>
          <h2 id="materials-contract-title">Sources first. Extraction and compression later.</h2>
          <p>
            NisabaDB will extract small ideas, examples, algorithms, and proof dependencies
            from each source; compare overlaps and alternate routes; then let administrators
            approve a smaller, independently written Knowledge DAG. No source's chapter order
            is accepted as the shape of mathematics.
          </p>
        </div>
        <dl aria-label="Materials collection status">
          <div>
            <dt>Checked sources</dt>
            <dd>{materials.length}</dd>
          </div>
          <div>
            <dt>Candidate goal routes</dt>
            <dd>{materialGoals.length}</dd>
          </div>
          <div>
            <dt>Openly adaptable</dt>
            <dd>{openAdaptationCount}</dd>
          </div>
          <div>
            <dt>Canonical Knowledge nodes</dt>
            <dd>0</dd>
          </div>
        </dl>
      </section>

      <section className="material-route-stage" aria-labelledby="material-route-title">
        <header>
          <div>
            <p className="eyebrow">Candidate source DAG</p>
            <h2 id="material-route-title">Choose a destination, then inspect its evidence route.</h2>
            <p>
              This graph relates source containers, not final concepts. It helps us find
              overlap and missing bridges; its {route.materialCount} records are not a demand
              to read {route.materialCount} books.
            </p>
          </div>
          <label>
            <span>What should the learner reach?</span>
            <select
              aria-label="Mathematics destination"
              value={selectedGoal.id}
              onChange={(event) => {
                const nextGoal = materialGoals.find((goal) => goal.id === event.target.value);
                setGoalId(event.target.value);
                const nextRoute = nextGoal ? materialRoute(nextGoal) : undefined;
                const nextSelection = nextRoute?.layers.at(-1)?.[0];
                if (nextSelection) setSelectedMaterialId(nextSelection.id);
              }}
            >
              {materialGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.title}</option>
              ))}
            </select>
          </label>
        </header>

        <div className="material-goal-summary">
          <div>
            <strong>{selectedGoal.title}</strong>
            <p>{selectedGoal.description}</p>
          </div>
          {selectedGoal.destination ? (
            <Link className="button-link primary-button" to={selectedGoal.destination.path}>
              {selectedGoal.destination.label} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>

        <div className="material-route-layout">
          <div
            className="material-source-dag"
            aria-label={`Candidate source route for ${selectedGoal.title}`}
          >
            {route.layers.map((layer, index) => (
              <section key={layer.map((material) => material.id).join("-")}>
                <span>Source layer {index + 1}</span>
                <div>
                  {layer.map((material) => (
                    <button
                      className={material.id === selectedMaterial?.id ? "is-selected" : ""}
                      key={material.id}
                      type="button"
                      aria-pressed={material.id === selectedMaterial?.id}
                      onClick={() => setSelectedMaterialId(material.id)}
                    >
                      <small>{materialLevelLabels[material.level]} · {materialRoleLabels[material.role]}</small>
                      <strong>{material.title}</strong>
                      <span>{materialKindLabels[material.kind]}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {selectedMaterial ? (
            <aside className="material-route-reader" aria-label="Selected source details">
              <span>{materialRoleLabels[selectedMaterial.role]}</span>
              <h3>{selectedMaterial.title}</h3>
              <p className="material-byline">{personList(selectedMaterial.authors)} · {selectedMaterial.edition}</p>
              <p>{selectedMaterial.plainLanguageRole}</p>
              <div>
                <h4>What we would extract</h4>
                <ul className="material-focus-list">
                  {selectedMaterial.extractFocus.map((focus) => <li key={focus}>{focus}</li>)}
                </ul>
              </div>
              <div>
                <h4>Compression question</h4>
                <p>{selectedMaterial.compressionNote}</p>
              </div>
              <div>
                <h4>Source before this one</h4>
                {selectedMaterial.prerequisiteIds.length ? (
                  <ul className="material-relation-list">
                    {selectedMaterial.prerequisiteIds.map((id) => (
                      <li key={id}>{getMaterial(id)?.title ?? id}</li>
                    ))}
                  </ul>
                ) : <p>No source prerequisite; begin with a diagnostic.</p>}
              </div>
              <a href={selectedMaterial.officialUrl} target="_blank" rel="noreferrer">
                Open the official source <span aria-hidden="true">↗</span>
              </a>
            </aside>
          ) : null}
        </div>
        <p className="material-route-caveat">
          Alternate and reference sources stay outside a route unless selected. Every route is
          a comparison candidate; none is claimed to be the minimum yet.
        </p>
      </section>

      <section className="compression-lab" aria-labelledby="compression-lab-title">
        <header>
          <p className="eyebrow">Questions to test, not conclusions</p>
          <h2 id="compression-lab-title">The first compression hypotheses</h2>
          <p>
            These proposals tell future contributors what to compare. They cannot become
            Knowledge until the extracted mathematics and dependency costs have been reviewed.
          </p>
        </header>
        <div>
          {materialCollection.compressionCandidates.map((candidate, index) => (
            <article key={candidate.id}>
              <span>Hypothesis {String(index + 1).padStart(2, "0")}</span>
              <h3>{candidate.title}</h3>
              <p>{candidate.hypothesis}</p>
              <small>{candidate.evidenceMaterialIds.length} sources to compare</small>
            </article>
          ))}
        </div>
      </section>

      <section className="material-catalog" aria-labelledby="material-catalog-title">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Basic to research level</p>
            <h2 id="material-catalog-title">The source collection</h2>
          </div>
          <p>
            Search by an ordinary idea such as “fractions,” “proof,” “groups,” or “testing.”
            Access and permission to rewrite are reported separately.
          </p>
        </header>

        <div className="catalog-controls material-controls" aria-label="Material catalog filters">
          <label className="search-control">
            Search sources
            <span className="input-shell">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search materials"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try proof, algebra, probability…"
              />
            </span>
          </label>
          <label>
            Starting level
            <select aria-label="Filter materials by level" value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="all">Every level</option>
              {Object.entries(materialLevelLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select aria-label="Filter materials by subject" value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="all">Every subject</option>
              {domains.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}
            </select>
          </label>
          <p>{filteredMaterials.length} of {materials.length} sources</p>
        </div>

        <div className="material-card-grid">
          {filteredMaterials.map((material) => (
            <article className="material-card" key={material.id}>
              <div className="material-card-topline">
                <span>{materialKindLabels[material.kind]}</span>
                <span>{materialLevelLabels[material.level]}</span>
              </div>
              <h3>{material.title}</h3>
              <p className="material-byline">{personList(material.authors)} · {material.year}</p>
              <p>{material.plainLanguageRole}</p>
              <ul className="material-domain-list" aria-label="Subjects">
                {material.domains.slice(0, 4).map((value) => <li key={value}>{value.replaceAll("-", " ")}</li>)}
              </ul>
              <div className="material-access-line">
                <span>{materialAvailabilityLabels[material.access.availability]}</span>
                <span>{derivativeRightsLabels[material.access.derivativeRights]}</span>
              </div>
              <details>
                <summary>Access and reuse note</summary>
                <p>{material.access.note}</p>
              </details>
              <a href={material.officialUrl} target="_blank" rel="noreferrer">
                Official source <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
        {filteredMaterials.length === 0 ? (
          <p className="material-empty">No source matches those filters.</p>
        ) : null}
      </section>

      <aside className="materials-rights-note" aria-labelledby="materials-rights-title">
        <div>
          <p className="eyebrow">A legal and scholarly boundary</p>
          <h2 id="materials-rights-title">Free to read does not always mean free to rewrite.</h2>
        </div>
        <p>
          NisabaDB stores metadata, links, small original descriptions, and precise citations.
          It does not copy a textbook merely because a PDF is available. Openly licensed sources
          may support adaptation under their terms; cite-only and no-derivatives sources require
          independently written tutorials and examples.
        </p>
      </aside>
    </div>
  );
}
