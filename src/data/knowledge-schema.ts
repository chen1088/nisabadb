import { z } from "zod";

export const knowledgeNodeKindSchema = z.enum([
  "language",
  "definition",
  "law",
  "method",
  "theorem",
]);

export const knowledgeSourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  officialUrl: z.url(),
  useNote: z.string().min(1),
});

export const knowledgeChapterSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  number: z.number().int().nonnegative(),
  title: z.string().min(1),
  summary: z.string().min(1),
});

export const notationEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  symbol: z.string().min(1),
  spokenAs: z.string().min(1),
  meaning: z.string().min(1),
  firstNodeId: z.string().min(1),
  aliases: z.array(z.object({
    form: z.string().min(1),
    note: z.string().min(1),
  })),
});

export const knowledgeNodeSchema = z.object({
  id: z.string().regex(/^K\d{2,6}$/),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  chapterId: z.string().min(1),
  section: z.string().regex(/^\d+\.\d+$/),
  title: z.string().min(1),
  kind: knowledgeNodeKindSchema,
  purpose: z.string().min(1),
  prerequisiteIds: z.array(z.string().min(1)),
  notationIds: z.array(z.string().min(1)),
  motivation: z.string().min(1),
  tutorial: z.string().min(1),
  keyIdea: z.string().min(1),
  examples: z.array(z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  })).min(1),
  exercise: z.object({
    prompt: z.string().min(1),
    hints: z.array(z.string().min(1)).min(1),
    solution: z.string().min(1),
  }),
  sourceRefs: z.array(z.object({
    sourceId: z.string().min(1),
    note: z.string().min(1),
  })).min(1),
  status: z.enum(["initial-rewrite", "reviewed"]),
  trainable: z.boolean(),
  proofGoal: z.string().min(1).optional(),
  readMinutes: z.number().int().positive(),
  tags: z.array(z.string().min(1)).min(1),
});

export const knowledgeBookSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  edition: z.string().min(1),
  updatedAt: z.iso.date(),
  notationPolicy: z.string().min(1),
  sources: z.array(knowledgeSourceSchema).min(1),
  chapters: z.array(knowledgeChapterSchema).min(1),
  notation: z.array(notationEntrySchema),
  nodes: z.array(knowledgeNodeSchema).min(1),
}).superRefine((book, context) => {
  const unique = (values: readonly string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) context.addIssue({ code: "custom", message: `Duplicate ${label}: ${value}` });
      seen.add(value);
    }
    return seen;
  };

  const sourceIds = unique(book.sources.map((source) => source.id), "knowledge source ID");
  const chapterIds = unique(book.chapters.map((chapter) => chapter.id), "knowledge chapter ID");
  const notationIds = unique(book.notation.map((entry) => entry.id), "notation ID");
  const nodeIds = unique(book.nodes.map((node) => node.id), "knowledge node ID");
  unique(book.nodes.map((node) => node.slug), "knowledge node slug");
  unique(book.nodes.map((node) => node.section), "knowledge section number");

  for (const chapter of book.chapters) {
    if (!book.nodes.some((node) => node.chapterId === chapter.id)) {
      context.addIssue({ code: "custom", message: `Knowledge chapter ${chapter.id} is empty` });
    }
  }

  for (const entry of book.notation) {
    if (!nodeIds.has(entry.firstNodeId)) {
      context.addIssue({ code: "custom", message: `Notation ${entry.id} has missing first node ${entry.firstNodeId}` });
    }
  }

  for (const node of book.nodes) {
    if (!chapterIds.has(node.chapterId)) {
      context.addIssue({ code: "custom", message: `${node.id} has missing chapter ${node.chapterId}` });
    }
    for (const [relation, ids] of [
      ["prerequisite", node.prerequisiteIds],
      ["notation", node.notationIds],
    ] as const) {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) context.addIssue({ code: "custom", message: `${node.id} repeats ${relation} ${id}` });
        seen.add(id);
        if (relation === "prerequisite" && id === node.id) {
          context.addIssue({ code: "custom", message: `${node.id} depends on itself` });
        }
        if (relation === "prerequisite" && !nodeIds.has(id)) {
          context.addIssue({ code: "custom", message: `${node.id} has missing prerequisite ${id}` });
        }
        if (relation === "notation" && !notationIds.has(id)) {
          context.addIssue({ code: "custom", message: `${node.id} has missing notation ${id}` });
        }
      }
    }
    for (const source of node.sourceRefs) {
      if (!sourceIds.has(source.sourceId)) {
        context.addIssue({ code: "custom", message: `${node.id} has missing source ${source.sourceId}` });
      }
    }
    if (node.trainable !== Boolean(node.proofGoal)) {
      context.addIssue({ code: "custom", message: `${node.id} must pair trainable with a proof goal` });
    }
    if (node.trainable && !["law", "method", "theorem"].includes(node.kind)) {
      context.addIssue({ code: "custom", message: `${node.id} cannot train on a ${node.kind}` });
    }
  }

  const prerequisites = new Map(book.nodes.map((node) => [node.id, node.prerequisiteIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) {
      context.addIssue({ code: "custom", message: `Knowledge prerequisite cycle includes ${id}` });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of prerequisites.get(id) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of nodeIds) visit(id);
});

export type KnowledgeBook = z.infer<typeof knowledgeBookSchema>;
export type KnowledgeNode = z.infer<typeof knowledgeNodeSchema>;
export type KnowledgeChapter = z.infer<typeof knowledgeChapterSchema>;
export type NotationEntry = z.infer<typeof notationEntrySchema>;

export function validateKnowledgeBook(value: unknown): KnowledgeBook {
  return knowledgeBookSchema.parse(value);
}
