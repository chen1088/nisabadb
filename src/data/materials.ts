import rawCollection from "./materials.json";
import {
  validateMaterialCollection,
  type Material,
  type MaterialGoal,
} from "./material-schema";

export const materialCollection = validateMaterialCollection(rawCollection);
export const materials = materialCollection.materials;
export const materialGoals = materialCollection.goals;
export const materialById = new Map(materials.map((material) => [material.id, material]));
export const materialGoalById = new Map(materialGoals.map((goal) => [goal.id, goal]));

export const materialLevelLabels: Record<Material["level"], string> = {
  "starting-from-zero": "Starting from zero",
  foundation: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced",
  "research-bridge": "Research bridge",
};

export const materialKindLabels: Record<Material["kind"], string> = {
  textbook: "Textbook",
  course: "Course",
  "lecture-notes": "Lecture notes",
  "software-lab": "Software lab",
  "interactive-tool": "Interactive tool",
};

export const materialRoleLabels: Record<Material["role"], string> = {
  diagnostic: "Diagnostic bank",
  core: "Core source",
  bridge: "Bridge source",
  alternate: "Alternate route",
  lab: "Executable lab",
  reference: "On-demand reference",
};

export const materialAvailabilityLabels: Record<Material["access"]["availability"], string> = {
  free: "Free access",
  "free-software": "Free software",
  "paid-or-library": "Paid or library",
};

export const derivativeRightsLabels: Record<Material["access"]["derivativeRights"], string> = {
  open: "Open adaptation",
  "limited-open": "Limited open adaptation",
  "no-derivatives": "No derivatives",
  "cite-only": "Cite only",
  mixed: "Check each item",
};

export function getMaterial(id: string | undefined): Material | undefined {
  return id ? materialById.get(id) : undefined;
}

export function getMaterialGoal(id: string | undefined): MaterialGoal | undefined {
  return id ? materialGoalById.get(id) : undefined;
}

export function materialRoute(goal: MaterialGoal) {
  const included = new Set<string>();
  const visit = (id: string) => {
    if (included.has(id)) return;
    const material = materialById.get(id);
    if (!material) return;
    material.prerequisiteIds.forEach(visit);
    included.add(id);
  };
  goal.targetMaterialIds.forEach(visit);

  const depthById = new Map<string, number>();
  const depth = (id: string): number => {
    const existing = depthById.get(id);
    if (existing !== undefined) return existing;
    const material = materialById.get(id);
    const value = material
      ? Math.max(0, ...material.prerequisiteIds.filter((prerequisite) => included.has(prerequisite)).map((prerequisite) => depth(prerequisite) + 1))
      : 0;
    depthById.set(id, value);
    return value;
  };

  const routeMaterials = [...included]
    .map((id) => materialById.get(id))
    .filter((material): material is Material => Boolean(material));
  routeMaterials.forEach((material) => depth(material.id));
  const maxDepth = Math.max(0, ...depthById.values());
  const layers = Array.from({ length: maxDepth + 1 }, (_, layer) =>
    routeMaterials
      .filter((material) => depthById.get(material.id) === layer)
      .sort((left, right) => left.title.localeCompare(right.title)),
  ).filter((layer) => layer.length > 0);

  return {
    included,
    layers,
    materialCount: routeMaterials.length,
    targetCount: goal.targetMaterialIds.length,
  };
}
