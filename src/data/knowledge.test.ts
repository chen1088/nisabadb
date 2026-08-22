import { describe, expect, it } from "vitest";
import rawBook from "./knowledge.json";
import { knowledgeBookSchema, validateKnowledgeBook } from "./knowledge-schema";
import {
  getKnowledgeNode,
  knowledgeBook,
  knowledgeDependents,
  knowledgeNodes,
  knowledgePrerequisiteClosure,
} from "./knowledge";

describe("unified knowledge textbook", () => {
  it("validates one acyclic book with stable semantic nodes", () => {
    expect(() => validateKnowledgeBook(rawBook)).not.toThrow();
    expect(knowledgeBook.title).toMatch(/Nisaba Mathematics Text/i);
    expect(knowledgeNodes).toHaveLength(30);
    expect(knowledgeBook.chapters).toHaveLength(6);
    expect(knowledgeBook.notation).toHaveLength(21);
    expect(new Set(knowledgeNodes.map((node) => node.id)).size).toBe(knowledgeNodes.length);
  });

  it("uses the canonical unambiguous notation policy", () => {
    expect(knowledgeBook.notationPolicy).toContain("definitions use :=");
    expect(knowledgeBook.notationPolicy).toContain("include 0");
    expect(knowledgeBook.notationPolicy).toContain("⊆");
    expect(knowledgeBook.notation.find((entry) => entry.id === "subset")?.aliases)
      .toContainEqual(expect.objectContaining({ form: "A \\subset B" }));
  });

  it("computes prerequisite closure and immediate dependents", () => {
    const setOperations = getKnowledgeNode("set-operations");
    if (!setOperations) throw new Error("missing set operations node");
    const closure = knowledgePrerequisiteClosure(setOperations.id);
    expect(closure.has("K04")).toBe(true);
    expect(closure.has("K11")).toBe(true);
    expect(closure.has(setOperations.id)).toBe(true);
    expect(knowledgeDependents("K04").length).toBeGreaterThan(0);
  });

  it("trains only nodes with an explicit proof goal", () => {
    expect(knowledgeNodes.filter((node) => node.trainable).every((node) => node.proofGoal)).toBe(true);
    expect(knowledgeNodes.filter((node) => node.kind === "definition").every((node) => !node.trainable)).toBe(true);
  });
});

describe("knowledge schema failure cases", () => {
  it("rejects missing prerequisites", () => {
    const invalid = structuredClone(knowledgeBook);
    invalid.nodes[0]?.prerequisiteIds.push("K99");
    expect(() => knowledgeBookSchema.parse(invalid)).toThrow(/missing prerequisite/i);
  });

  it("rejects prerequisite cycles", () => {
    const invalid = structuredClone(knowledgeBook);
    const first = invalid.nodes.find((node) => node.id === "K01");
    if (!first) throw new Error("missing knowledge fixture");
    first.prerequisiteIds = ["K22"];
    expect(() => knowledgeBookSchema.parse(invalid)).toThrow(/cycle/i);
  });
});
