import rawProgram from "./compression.json";
import rawVerificationPolicy from "../../data/knowledge/verification-policy.json";
import {
  validateCompressionProgram,
  validateCompressionReviewPolicy,
} from "./compression-schema";
import { knowledgeNodeById } from "./knowledge";

export const compressionProgram = validateCompressionReviewPolicy(
  validateCompressionProgram(rawProgram),
  rawVerificationPolicy,
);
export const compressionSourceFamilies = compressionProgram.sourceFamilies;
export const compressionBands = compressionProgram.bands;
export const compressionClusters = compressionProgram.clusters;
export const compressionSourceFamilyById = new Map(
  compressionSourceFamilies.map((family) => [family.id, family]),
);
export const compressionClusterById = new Map(
  compressionClusters.map((cluster) => [cluster.id, cluster]),
);
export const compressionResiduals = compressionClusters.flatMap((cluster) =>
  cluster.residuals.map((residual) => ({ ...residual, clusterId: cluster.id })),
);
export const compressionBandByClusterId = new Map(
  compressionBands.flatMap((band) => band.clusterIds.map((clusterId) => [clusterId, band] as const)),
);

for (const cluster of compressionClusters) {
  for (const nodeId of cluster.knowledgeNodeIds) {
    if (!knowledgeNodeById.has(nodeId)) {
      throw new Error(`Compression cluster ${cluster.id} has missing knowledge node ${nodeId}`);
    }
  }
}
