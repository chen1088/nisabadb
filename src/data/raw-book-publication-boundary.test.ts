import { describe, expect, it } from "vitest";
import { classifyRawBookDataRequest } from "./raw-book-publication-boundary";

describe("raw book-graph publication boundary", () => {
  it.each([
    "/data/books/S0060/complete-source.json",
    "/nisabadb/data/books/S0262/complete-source/nodes/example.jsonl",
    "/data%2Fbooks%2FS0060%2Fcomplete-source.json",
    "/data%5Cbooks%5CS0262%5Ccomplete-source.json",
    "/data%5Cbooks%5CS0262%5Ccomplete-source%5Cnodes%5Cexample.jsonl",
    "/data/not-books/%2E%2E/books/S0060/complete-source.json",
    "/DATA/BOOKS/S0262/complete-source.json",
    "/data/BOOKS/S0262/complete-source.json",
  ])("refuses direct repository data at %s", (url) => {
    expect(classifyRawBookDataRequest(url)).toBe(404);
  });

  it("rejects malformed URL encoding", () => {
    expect(classifyRawBookDataRequest("/data/books/%E0%A4%A")).toBe(400);
  });

  it("leaves unrelated development assets to Vite", () => {
    expect(classifyRawBookDataRequest("/src/main.tsx")).toBeNull();
  });
});
