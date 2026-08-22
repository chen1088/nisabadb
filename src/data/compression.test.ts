import { describe, expect, it } from "vitest";
import rawRegistry from "../../data/knowledge/source-records.json";
import rawProgram from "./compression.json";
import {
  compressionBands,
  compressionClusters,
  compressionResiduals,
  compressionSourceFamilies,
} from "./compression";
import {
  compressionProgramSchema,
  validateCompressionProgram,
  validateCompressionRegistryCrosswalk,
} from "./compression-schema";

describe("whole-field compression atlas", () => {
  it("validates an acyclic atlas with one minimized route per cluster", () => {
    expect(() => validateCompressionProgram(rawProgram)).not.toThrow();
    expect(compressionBands).toHaveLength(6);
    expect(compressionClusters).toHaveLength(18);
    expect(compressionSourceFamilies.length).toBeGreaterThanOrEqual(16);
    expect(compressionResiduals.length).toBeGreaterThan(compressionClusters.length);
    for (const cluster of compressionClusters) {
      expect(cluster.routes.filter((route) => route.kind === "canonical")).toHaveLength(1);
      expect(cluster.routes.some((route) => route.dependencyKind === "original")).toBe(true);
      const minimized = cluster.routes.find((route) => route.dependencyKind === "minimized");
      const original = cluster.routes.find((route) => route.dependencyKind === "original");
      expect(minimized?.derivedFromRouteId).toBe(original?.id);
      expect(cluster.residuals.length).toBeGreaterThan(0);
    }
    expect(() => validateCompressionRegistryCrosswalk(
      validateCompressionProgram(rawProgram),
      rawRegistry,
    )).not.toThrow();
    expect(new Set(compressionSourceFamilies.flatMap((lens) => lens.registryBranches.map((branch) => branch.id))).size).toBe(31);
    expect(compressionClusters.some((cluster) => cluster.status === "reviewed")).toBe(false);
  });

  it("keeps candidate reinterpretations visibly unreviewed", () => {
    const candidates = compressionClusters.flatMap((cluster) => cluster.routes)
      .filter((route) => route.equivalence === "editorial-hypothesis");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((route) => route.reviewState === "candidate")).toBe(true);
  });
});

describe("compression schema failure cases", () => {
  it("rejects clusters with two canonical routes", () => {
    const invalid = structuredClone(rawProgram);
    const cluster = invalid.clusters[0];
    if (!cluster) throw new Error("missing cluster fixture");
    const originalRoute = cluster.routes[0];
    if (!originalRoute) throw new Error("missing route fixture");
    cluster.routes.push({ ...originalRoute, id: "second-canonical" });
    expect(() => compressionProgramSchema.parse(invalid)).toThrow(/exactly one canonical route/i);
  });

  it("rejects route cycles", () => {
    const invalid = structuredClone(rawProgram);
    const first = invalid.clusters.find((cluster) => cluster.id === "precise-mathematical-language");
    if (!first) throw new Error("missing cluster fixture");
    const firstRoute = first.routes[0];
    if (!firstRoute) throw new Error("missing route fixture");
    firstRoute.prerequisiteClusterIds = ["proof-certificates-verification"];
    expect(() => compressionProgramSchema.parse(invalid)).toThrow(/cycle/i);
  });

  it("rejects a minimized route without original-route provenance", () => {
    const invalid = structuredClone(rawProgram);
    const minimized = invalid.clusters[0]?.routes.find((route) => route.dependencyKind === "minimized");
    if (!minimized) throw new Error("missing minimized route fixture");
    delete minimized.derivedFromRouteId;
    expect(() => compressionProgramSchema.parse(invalid)).toThrow(/derive from an original route/i);
  });

  it("rejects a reviewed compression claim without administrative evidence", () => {
    const invalid = structuredClone(rawProgram);
    const cluster = invalid.clusters[0];
    if (!cluster) throw new Error("missing cluster fixture");
    cluster.status = "reviewed";
    expect(() => compressionProgramSchema.parse(invalid)).toThrow(/administrative evidence disagree/i);
  });
});
