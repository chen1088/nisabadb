import rawBook from "./knowledge.json";
import {
  validateKnowledgeBook,
  type KnowledgeNode,
} from "./knowledge-schema";

export const knowledgeBook = validateKnowledgeBook(rawBook);
export const knowledgeNodes = [...knowledgeBook.nodes].sort((left, right) => {
  const [leftChapter = 0, leftSection = 0] = left.section.split(".").map(Number);
  const [rightChapter = 0, rightSection = 0] = right.section.split(".").map(Number);
  return leftChapter - rightChapter || leftSection - rightSection;
});
export const knowledgeNodeById = new Map(knowledgeNodes.map((node) => [node.id, node]));
export const knowledgeNodeBySlug = new Map(knowledgeNodes.map((node) => [node.slug, node]));
export const knowledgeChapterById = new Map(
  knowledgeBook.chapters.map((chapter) => [chapter.id, chapter]),
);
export const knowledgeSourceById = new Map(
  knowledgeBook.sources.map((source) => [source.id, source]),
);
export const notationById = new Map(
  knowledgeBook.notation.map((entry) => [entry.id, entry]),
);

export function getKnowledgeNode(idOrSlug: string | undefined): KnowledgeNode | undefined {
  if (!idOrSlug) return undefined;
  return knowledgeNodeById.get(idOrSlug) ?? knowledgeNodeBySlug.get(idOrSlug);
}

export function knowledgeNodesForChapter(chapterId: string): KnowledgeNode[] {
  return knowledgeNodes.filter((node) => node.chapterId === chapterId);
}

export function knowledgeDependents(nodeId: string): KnowledgeNode[] {
  return knowledgeNodes.filter((node) => node.prerequisiteIds.includes(nodeId));
}

export function knowledgePrerequisiteClosure(nodeId: string): Set<string> {
  const included = new Set<string>();
  const visit = (id: string) => {
    const node = knowledgeNodeById.get(id);
    if (!node) return;
    for (const prerequisite of node.prerequisiteIds) visit(prerequisite);
    included.add(id);
  };
  visit(nodeId);
  return included;
}

export function previousKnowledgeNode(nodeId: string): KnowledgeNode | undefined {
  const index = knowledgeNodes.findIndex((node) => node.id === nodeId);
  return index > 0 ? knowledgeNodes[index - 1] : undefined;
}

export function nextKnowledgeNode(nodeId: string): KnowledgeNode | undefined {
  const index = knowledgeNodes.findIndex((node) => node.id === nodeId);
  return index >= 0 ? knowledgeNodes[index + 1] : undefined;
}
