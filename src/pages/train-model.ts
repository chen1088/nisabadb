import {
  corpus,
  getLearningRoute,
  isTheoremLike,
  paperById,
} from "../components/content";
import type { Statement } from "../data/schema";

export const trainCandidates = corpus.statements.filter((statement) => {
  if (!isTheoremLike(statement) || statement.kind === "imported-result") return false;
  const paper = paperById.get(statement.paperId);
  const route = getLearningRoute(statement);
  return paper?.status === "gold" && route?.status === "complete" && route.reviewStatus === "reviewed";
});

export function pickTrainCandidate(
  candidates: Statement[],
  currentId?: string,
  random: () => number = Math.random,
): Statement | undefined {
  if (!candidates.length) return undefined;
  const alternatives = candidates.length > 1
    ? candidates.filter((candidate) => candidate.id !== currentId)
    : candidates;
  return alternatives[Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length))];
}
