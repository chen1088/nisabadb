import { describe, expect, it } from "vitest";
import { knowledgeBook } from "./knowledge";
import {
  knowledgeRoadmap,
  roadmapChapters,
  roadmapChaptersForPart,
  roadmapParts,
} from "./knowledge-roadmap";
import { knowledgeRoadmapSchema, validateKnowledgeRoadmap } from "./knowledge-roadmap-schema";

describe("whole-book working map", () => {
  it("validates an honest 126-chapter map separately from the written book", () => {
    expect(() => validateKnowledgeRoadmap(knowledgeRoadmap)).not.toThrow();
    expect(roadmapParts).toHaveLength(21);
    expect(roadmapChapters).toHaveLength(126);
    expect(roadmapChapters.filter((chapter) => chapter.publication.state === "draft")).toHaveLength(20);
    expect(roadmapChapters.filter((chapter) => chapter.publication.state === "planned")).toHaveLength(106);
    for (const part of roadmapParts) expect(roadmapChaptersForPart(part.id)).toHaveLength(6);
  });

  it("maps every written Knowledge chapter exactly once", () => {
    const mappings = roadmapChapters.flatMap((chapter) => (
      chapter.publication.state === "draft" ? [chapter.publication.knowledgeChapterId] : []
    ));
    expect(new Set(mappings)).toEqual(new Set(knowledgeBook.chapters.map((chapter) => chapter.id)));
    expect(mappings).toHaveLength(knowledgeBook.chapters.length);
  });

  it("uses only earlier candidate prerequisites and does not invent adjacency chains", () => {
    const chapterById = new Map(roadmapChapters.map((chapter) => [chapter.id, chapter]));
    for (const chapter of roadmapChapters) {
      for (const prerequisiteId of chapter.candidatePrerequisiteChapterIds) {
        expect(chapterById.get(prerequisiteId)?.number).toBeLessThan(chapter.number);
      }
    }
    const computationalGeometry = roadmapChapters.find((chapter) => chapter.slug === "computational-discrete-geometry");
    const curvature = roadmapChapters.find((chapter) => chapter.slug === "curvature-non-euclidean");
    expect(computationalGeometry?.candidatePrerequisiteChapterIds).not.toContain(curvature?.id);
  });

  it("rejects a future prerequisite even when the graph would otherwise be acyclic", () => {
    const invalid = structuredClone(knowledgeRoadmap);
    const first = invalid.chapters[0];
    if (!first) throw new Error("missing roadmap fixture");
    first.candidatePrerequisiteChapterIds = ["R002"];
    expect(() => knowledgeRoadmapSchema.parse(invalid)).toThrow(/non-earlier prerequisite/i);
  });
});
