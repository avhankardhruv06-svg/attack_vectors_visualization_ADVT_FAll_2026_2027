// Yen's Algorithm for K-Shortest Loopless Paths
import { GraphEdge } from '../graph/types';
import { dijkstra } from './dijkstra';

export interface YenPath {
  nodePath: string[];
  edgePath: GraphEdge[];
  totalCost: number;
}

/**
 * Computes top-K shortest loopless paths between source and target
 * @param startNodeId Start node ID
 * @param targetNodeId Target node ID
 * @param adjacency Outgoing adjacency map (nodeId -> GraphEdge[])
 * @param K Number of alternative paths to discover (default: 3)
 */
export function yenKShortestPaths(
  startNodeId: string,
  targetNodeId: string,
  adjacency: Map<string, GraphEdge[]>,
  K: number = 3
): YenPath[] {
  // A holds the list of shortest paths
  const A: YenPath[] = [];
  // B holds candidate paths
  const B: YenPath[] = [];

  // Find 1st shortest path using Dijkstra
  const initial = dijkstra(startNodeId, targetNodeId, adjacency);
  if (!initial.found || initial.nodePath.length === 0) {
    return [];
  }

  A.push({
    nodePath: [...initial.nodePath],
    edgePath: [...initial.edgePath],
    totalCost: initial.totalCost,
  });

  // Helper to compare paths for uniqueness
  const isSamePath = (p1: string[], p2: string[]) => {
    if (p1.length !== p2.length) return false;
    return p1.every((node, idx) => node === p2[idx]);
  };

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1];
    if (!prevPath) break;

    // Iterate over all spur nodes in previous path
    for (let i = 0; i < prevPath.nodePath.length - 1; i++) {
      const spurNode = prevPath.nodePath[i];
      const rootPathNodes = prevPath.nodePath.slice(0, i + 1);
      const rootPathEdges = prevPath.edgePath.slice(0, i);

      const excludedEdges = new Set<string>();
      const excludedNodes = new Set<string>();

      // Exclude edges that are part of previous paths that share the same root path
      for (const p of A) {
        if (p.nodePath.length > i + 1) {
          const pRoot = p.nodePath.slice(0, i + 1);
          if (isSamePath(rootPathNodes, pRoot)) {
            const nextEdge = p.edgePath[i];
            if (nextEdge) {
              excludedEdges.add(nextEdge.id);
            }
          }
        }
      }

      // Exclude root path nodes (except spur node) so path remains loopless
      for (let r = 0; r < rootPathNodes.length - 1; r++) {
        excludedNodes.add(rootPathNodes[r]);
      }

      // Calculate spur path from spurNode to targetNode
      const spurResult = dijkstra(
        spurNode,
        targetNodeId,
        adjacency,
        excludedEdges,
        excludedNodes
      );

      if (spurResult.found && spurResult.nodePath.length > 0) {
        const totalNodePath = [...rootPathNodes.slice(0, -1), ...spurResult.nodePath];
        const totalEdgePath = [...rootPathEdges, ...spurResult.edgePath];

        // Calculate total cost
        const totalCost = totalEdgePath.reduce(
          (sum, e) => sum + (e.weight ?? (1.0 - e.confidence + 0.0001)),
          0
        );

        const candidate: YenPath = {
          nodePath: totalNodePath,
          edgePath: totalEdgePath,
          totalCost,
        };

        // Check if candidate already in B or A
        const inA = A.some((p) => isSamePath(p.nodePath, candidate.nodePath));
        const inB = B.some((p) => isSamePath(p.nodePath, candidate.nodePath));

        if (!inA && !inB) {
          B.push(candidate);
        }
      }
    }

    if (B.length === 0) {
      break;
    }

    // Sort candidate paths by lowest total cost
    B.sort((a, b) => a.totalCost - b.totalCost);
    const bestCandidate = B.shift()!;
    A.push(bestCandidate);
  }

  return A;
}
