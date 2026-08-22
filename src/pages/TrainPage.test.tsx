import { describe, expect, it } from "vitest";
import { getLearningRoute, isTheoremLike, paperById } from "../components/content";
import { pickTrainCandidate, trainCandidates } from "./train-model";

describe("Train exercise pool", () => {
  it("contains only meaningful reviewed results with complete proof routes", () => {
    expect(trainCandidates.length).toBeGreaterThan(0);
    for (const statement of trainCandidates) {
      const route = getLearningRoute(statement);
      expect(isTheoremLike(statement)).toBe(true);
      expect(statement.kind).not.toBe("imported-result");
      expect(paperById.get(statement.paperId)?.status).toBe("gold");
      expect(route?.reviewStatus).toBe("reviewed");
      expect(route?.status).toBe("complete");
    }
  });

  it("chooses a different result when the pool permits it", () => {
    const pool = trainCandidates.slice(0, 3);
    expect(pool.length).toBe(3);
    const selected = pickTrainCandidate(pool, pool[0]?.id, () => 0);
    expect(selected?.id).not.toBe(pool[0]?.id);
    expect(pool).toContain(selected);
  });
});
