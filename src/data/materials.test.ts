import { describe, expect, it } from "vitest";
import rawCollection from "./materials.json";
import { materialCollectionSchema, validateMaterialCollection } from "./material-schema";
import { getMaterialGoal, materialCollection, materialRoute, materials } from "./materials";

describe("materials collection", () => {
  it("validates the official-source collection and its relationships", () => {
    expect(() => validateMaterialCollection(rawCollection)).not.toThrow();
    expect(materials.length).toBeGreaterThanOrEqual(20);
    expect(materials.every((material) => material.officialUrl.startsWith("https://"))).toBe(true);
    expect(materials.some((material) => material.level === "starting-from-zero")).toBe(true);
    expect(materials.some((material) => material.level === "research-bridge")).toBe(true);
  });

  it("keeps access separate from derivative rights", () => {
    const freeButCiteOnly = materials.filter((material) =>
      material.access.availability === "free" && material.access.derivativeRights === "cite-only"
    );
    expect(freeButCiteOnly.length).toBeGreaterThan(0);
    expect(materials.some((material) => material.access.derivativeRights === "open")).toBe(true);
  });

  it("builds a layered candidate route without silently adding alternatives", () => {
    const goal = getMaterialGoal("young-diagrams");
    if (!goal) throw new Error("missing young-diagrams goal");
    const route = materialRoute(goal);
    expect(route.layers.length).toBeGreaterThan(3);
    expect(route.included.has("sagan-symmetric-group")).toBe(true);
    expect(route.included.has("fulton-young-tableaux")).toBe(false);
  });

  it("keeps on-demand analysis outside the finite dictatorship route", () => {
    const goal = getMaterialGoal("dictatorship-testing");
    if (!goal) throw new Error("missing dictatorship-testing goal");
    const route = materialRoute(goal);
    expect(route.included.has("odonnell-boolean-functions")).toBe(true);
    expect(route.included.has("axler-measure-real-analysis")).toBe(false);
  });
});

describe("materials failure cases", () => {
  it("rejects missing prerequisites", () => {
    const invalid = structuredClone(materialCollection);
    invalid.materials[0]?.prerequisiteIds.push("missing-source");
    expect(() => materialCollectionSchema.parse(invalid)).toThrow(/missing prerequisite/i);
  });

  it("rejects prerequisite cycles", () => {
    const invalid = structuredClone(materialCollection);
    const first = invalid.materials.find((material) => material.id === "openstax-prealgebra-2e");
    if (!first) throw new Error("missing material fixture");
    first.prerequisiteIds = ["sundstrom-writing-proof"];
    expect(() => materialCollectionSchema.parse(invalid)).toThrow(/cycle/i);
  });
});
