import { z } from "zod";

export const materialKindSchema = z.enum([
  "textbook",
  "course",
  "lecture-notes",
  "software-lab",
  "interactive-tool",
]);

export const materialLevelSchema = z.enum([
  "starting-from-zero",
  "foundation",
  "intermediate",
  "advanced",
  "research-bridge",
]);

export const materialRoleSchema = z.enum([
  "diagnostic",
  "core",
  "bridge",
  "alternate",
  "lab",
  "reference",
]);

export const materialAvailabilitySchema = z.enum([
  "free",
  "free-software",
  "paid-or-library",
]);

export const derivativeRightsSchema = z.enum([
  "open",
  "limited-open",
  "no-derivatives",
  "cite-only",
  "mixed",
]);

export const materialSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  kind: materialKindSchema,
  level: materialLevelSchema,
  role: materialRoleSchema,
  edition: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  officialUrl: z.url(),
  licenseUrl: z.url().optional(),
  access: z.object({
    availability: materialAvailabilitySchema,
    derivativeRights: derivativeRightsSchema,
    note: z.string().min(1),
  }),
  domains: z.array(z.string().min(1)).min(1),
  prerequisiteIds: z.array(z.string().min(1)),
  alternativeIds: z.array(z.string().min(1)),
  plainLanguageRole: z.string().min(1),
  extractFocus: z.array(z.string().min(1)).min(1),
  compressionNote: z.string().min(1),
  verifiedAt: z.iso.date(),
});

export const materialGoalSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  targetMaterialIds: z.array(z.string().min(1)).min(1),
  destination: z.object({
    label: z.string().min(1),
    path: z.string().regex(/^\/[a-z0-9./-]+$/),
  }).optional(),
});

export const compressionCandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  hypothesis: z.string().min(1),
  evidenceMaterialIds: z.array(z.string().min(1)).min(2),
  status: z.literal("hypothesis"),
});

export const materialCollectionSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  verifiedAt: z.iso.date(),
  principle: z.string().min(1),
  materials: z.array(materialSchema).min(1),
  goals: z.array(materialGoalSchema).min(1),
  compressionCandidates: z.array(compressionCandidateSchema),
}).superRefine((collection, context) => {
  const materialIds = new Set<string>();
  const goalIds = new Set<string>();
  const candidateIds = new Set<string>();

  for (const material of collection.materials) {
    if (materialIds.has(material.id)) {
      context.addIssue({ code: "custom", message: `Duplicate material ID: ${material.id}` });
    }
    materialIds.add(material.id);
  }

  for (const material of collection.materials) {
    for (const [relation, ids] of [
      ["prerequisite", material.prerequisiteIds],
      ["alternative", material.alternativeIds],
    ] as const) {
      const seen = new Set<string>();
      for (const id of ids) {
        if (id === material.id) {
          context.addIssue({ code: "custom", message: `${material.id} has itself as a ${relation}` });
        }
        if (seen.has(id)) {
          context.addIssue({ code: "custom", message: `${material.id} repeats ${relation} ${id}` });
        }
        seen.add(id);
        if (!materialIds.has(id)) {
          context.addIssue({ code: "custom", message: `${material.id} has missing ${relation} ${id}` });
        }
      }
    }
  }

  const prerequisitesById = new Map(
    collection.materials.map((material) => [material.id, material.prerequisiteIds]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      context.addIssue({ code: "custom", message: `Material prerequisite cycle includes ${id}` });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of prerequisitesById.get(id) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of materialIds) visit(id);

  for (const goal of collection.goals) {
    if (goalIds.has(goal.id)) {
      context.addIssue({ code: "custom", message: `Duplicate material goal ID: ${goal.id}` });
    }
    goalIds.add(goal.id);
    const targetIds = new Set<string>();
    for (const id of goal.targetMaterialIds) {
      if (targetIds.has(id)) {
        context.addIssue({ code: "custom", message: `Goal ${goal.id} repeats target ${id}` });
      }
      targetIds.add(id);
      if (!materialIds.has(id)) {
        context.addIssue({ code: "custom", message: `Goal ${goal.id} has missing target ${id}` });
      }
    }
  }

  for (const candidate of collection.compressionCandidates) {
    if (candidateIds.has(candidate.id)) {
      context.addIssue({ code: "custom", message: `Duplicate compression candidate ID: ${candidate.id}` });
    }
    candidateIds.add(candidate.id);
    const evidenceIds = new Set<string>();
    for (const id of candidate.evidenceMaterialIds) {
      if (evidenceIds.has(id)) {
        context.addIssue({ code: "custom", message: `Compression candidate ${candidate.id} repeats evidence ${id}` });
      }
      evidenceIds.add(id);
      if (!materialIds.has(id)) {
        context.addIssue({ code: "custom", message: `Compression candidate ${candidate.id} has missing evidence ${id}` });
      }
    }
  }
});

export type Material = z.infer<typeof materialSchema>;
export type MaterialGoal = z.infer<typeof materialGoalSchema>;
export type MaterialCollection = z.infer<typeof materialCollectionSchema>;

export function validateMaterialCollection(value: unknown): MaterialCollection {
  return materialCollectionSchema.parse(value);
}
