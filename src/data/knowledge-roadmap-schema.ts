import { z } from "zod";

const roadmapPartSchema = z.object({
  id: z.string().regex(/^P\d{2}$/),
  number: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
});

const roadmapPublicationSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("planned") }),
  z.object({
    state: z.literal("draft"),
    knowledgeChapterId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  }),
]);

const roadmapChapterSchema = z.object({
  id: z.string().regex(/^R\d{3}$/),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  number: z.number().int().positive(),
  partId: z.string().regex(/^P\d{2}$/),
  title: z.string().min(1),
  goal: z.string().min(1),
  candidatePrerequisiteChapterIds: z.array(z.string().regex(/^R\d{3}$/)),
  compressionClusterIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).min(1),
  publication: roadmapPublicationSchema,
});

export const knowledgeRoadmapSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  title: z.string().min(1),
  updatedAt: z.iso.date(),
  workingChapterCount: z.number().int().positive(),
  parts: z.array(roadmapPartSchema).min(1),
  chapters: z.array(roadmapChapterSchema).min(101),
}).superRefine((roadmap, context) => {
  const unique = (values: readonly string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) context.addIssue({ code: "custom", message: `Duplicate ${label}: ${value}` });
      seen.add(value);
    }
    return seen;
  };

  const partIds = unique(roadmap.parts.map((part) => part.id), "roadmap part ID");
  unique(roadmap.parts.map((part) => String(part.number)), "roadmap part number");
  const chapterIds = unique(roadmap.chapters.map((chapter) => chapter.id), "roadmap chapter ID");
  const chapterById = new Map(roadmap.chapters.map((chapter) => [chapter.id, chapter]));
  unique(roadmap.chapters.map((chapter) => chapter.slug), "roadmap chapter slug");
  unique(roadmap.chapters.map((chapter) => String(chapter.number)), "roadmap chapter number");

  if (roadmap.workingChapterCount !== roadmap.chapters.length) {
    context.addIssue({ code: "custom", message: "Roadmap working chapter count does not match its chapters" });
  }
  roadmap.parts.forEach((part, index) => {
    if (part.number !== index + 1) {
      context.addIssue({ code: "custom", message: `Roadmap part ${part.id} loses order` });
    }
    if (!roadmap.chapters.some((chapter) => chapter.partId === part.id)) {
      context.addIssue({ code: "custom", message: `Roadmap part ${part.id} is empty` });
    }
  });
  roadmap.chapters.forEach((chapter, index) => {
    const expectedId = `R${String(index + 1).padStart(3, "0")}`;
    if (chapter.id !== expectedId) {
      context.addIssue({ code: "custom", message: `Roadmap chapter ${chapter.id} does not match number ${index + 1}` });
    }
    if (chapter.number !== index + 1) {
      context.addIssue({ code: "custom", message: `Roadmap chapter ${chapter.id} loses order` });
    }
    if (!partIds.has(chapter.partId)) {
      context.addIssue({ code: "custom", message: `${chapter.id} has missing part ${chapter.partId}` });
    }
    unique(chapter.candidatePrerequisiteChapterIds, `${chapter.id} prerequisite`);
    unique(chapter.compressionClusterIds, `${chapter.id} compression cluster`);
    for (const prerequisiteId of chapter.candidatePrerequisiteChapterIds) {
      if (!chapterIds.has(prerequisiteId)) {
        context.addIssue({ code: "custom", message: `${chapter.id} has missing prerequisite ${prerequisiteId}` });
      }
      if (prerequisiteId === chapter.id) {
        context.addIssue({ code: "custom", message: `${chapter.id} depends on itself` });
      }
      const prerequisite = chapterById.get(prerequisiteId);
      if (prerequisite && prerequisite.number >= chapter.number) {
        context.addIssue({ code: "custom", message: `${chapter.id} has a non-earlier prerequisite ${prerequisiteId}` });
      }
    }
  });
  roadmap.chapters.slice(1).forEach((chapter, index) => {
    const previous = roadmap.chapters[index];
    const chapterPart = roadmap.parts.find((part) => part.id === chapter.partId);
    const previousPart = roadmap.parts.find((part) => part.id === previous?.partId);
    if (chapterPart && previousPart && chapterPart.number < previousPart.number) {
      context.addIssue({ code: "custom", message: `Roadmap part ${chapter.partId} is not contiguous` });
    }
  });

  const prerequisites = new Map(
    roadmap.chapters.map((chapter) => [chapter.id, chapter.candidatePrerequisiteChapterIds]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      context.addIssue({ code: "custom", message: `Roadmap prerequisite cycle includes ${id}` });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of prerequisites.get(id) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of chapterIds) visit(id);
});

export type KnowledgeRoadmap = z.infer<typeof knowledgeRoadmapSchema>;
export type KnowledgeRoadmapPart = KnowledgeRoadmap["parts"][number];
export type KnowledgeRoadmapChapter = KnowledgeRoadmap["chapters"][number];

export function validateKnowledgeRoadmap(value: unknown): KnowledgeRoadmap {
  return knowledgeRoadmapSchema.parse(value);
}
