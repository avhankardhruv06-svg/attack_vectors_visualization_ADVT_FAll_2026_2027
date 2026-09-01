// Structural Community Detection (Louvain / Modularity Optimization)
import { AttackGraph, GraphEdge } from '../graph/types';

export interface CommunityDetectionResult {
  communityMap: Map<string, number>;
  bridgeEdgeIds: Set<string>;
  communityCount: number;
}

/**
 * Computes structural graph communities and identifies bridge edges
 */
export function detectCommunities(graph: AttackGraph): CommunityDetectionResult {
  const nodes = graph.nodes;
  const nodeCount = nodes.length;
  if (nodeCount === 0) {
    return {
      communityMap: new Map(),
      bridgeEdgeIds: new Set(),
      communityCount: 0,
    };
  }

  // Initialize each node in its own community
  const communityMap = new Map<string, number>();
  nodes.forEach((n, idx) => communityMap.set(n.id, idx));

  // Build undirected adjacency with weights
  const neighbors = new Map<string, Map<string, number>>();
  for (const node of nodes) {
    neighbors.set(node.id, new Map());
  }

  let totalWeight = 0;
  for (const edge of graph.edges) {
    const weight = edge.confidence || 0.5;
    totalWeight += weight;

    const uMap = neighbors.get(edge.source);
    if (uMap) {
      uMap.set(edge.target, (uMap.get(edge.target) || 0) + weight);
    }
    const vMap = neighbors.get(edge.target);
    if (vMap) {
      vMap.set(edge.source, (vMap.get(edge.source) || 0) + weight);
    }
  }

  if (totalWeight === 0) totalWeight = 1;

  // Modularity optimization passes (Label propagation with weighted voting)
  let changed = true;
  let iterations = 0;
  const maxIterations = 15;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const node of nodes) {
      const u = node.id;
      const currentComm = communityMap.get(u)!;
      const uNeighbors = neighbors.get(u)!;

      // Count weights per community in neighborhood
      const communityWeights = new Map<number, number>();
      for (const [v, w] of uNeighbors.entries()) {
        const vComm = communityMap.get(v)!;
        communityWeights.set(vComm, (communityWeights.get(vComm) || 0) + w);
      }

      // Find best community
      let bestComm = currentComm;
      let maxWeight = communityWeights.get(currentComm) || 0;

      for (const [comm, weight] of communityWeights.entries()) {
        if (weight > maxWeight) {
          maxWeight = weight;
          bestComm = comm;
        }
      }

      if (bestComm !== currentComm) {
        communityMap.set(u, bestComm);
        changed = true;
      }
    }
  }

  // Normalize community IDs to contiguous integers 0..C-1
  const uniqueComms = Array.from(new Set(communityMap.values()));
  const commIdMap = new Map<number, number>();
  uniqueComms.forEach((oldId, newId) => commIdMap.set(oldId, newId));

  for (const [nodeId, oldId] of communityMap.entries()) {
    communityMap.set(nodeId, commIdMap.get(oldId)!);
  }

  // Identify bridge edges (edges connecting nodes from different communities)
  const bridgeEdgeIds = new Set<string>();
  for (const edge of graph.edges) {
    const commSource = communityMap.get(edge.source);
    const commTarget = communityMap.get(edge.target);

    if (commSource !== undefined && commTarget !== undefined && commSource !== commTarget) {
      bridgeEdgeIds.add(edge.id);
    }
  }

  return {
    communityMap,
    bridgeEdgeIds,
    communityCount: uniqueComms.length,
  };
}
