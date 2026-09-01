// Weighted Shortest Path via Dijkstra's Algorithm
import { GraphNode, GraphEdge } from '../graph/types';

export interface DijkstraResult {
  sourceId: string;
  targetId: string;
  found: boolean;
  totalCost: number;
  nodePath: string[];
  edgePath: GraphEdge[];
  distanceMap: Map<string, number>;
  previousMap: Map<string, { nodeId: string; edge: GraphEdge }>;
}

/**
 * Executes Dijkstra's algorithm from a starting node to a target node.
 * If targetId is null/undefined, explores all reachable nodes.
 *
 * @param startNodeId ID of the starting node
 * @param targetNodeId Optional ID of the destination node to stop search early
 * @param adjacency Map of nodeId -> outgoing GraphEdge[]
 * @param excludedEdges Set of edge IDs to ignore (used by Yen's algorithm)
 * @param excludedNodes Set of node IDs to ignore (used by Yen's algorithm)
 */
export function dijkstra(
  startNodeId: string,
  targetNodeId: string | null,
  adjacency: Map<string, GraphEdge[]>,
  excludedEdges: Set<string> = new Set(),
  excludedNodes: Set<string> = new Set()
): DijkstraResult {
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: GraphEdge }>();
  const visited = new Set<string>();

  // Priority queue elements: [nodeId, cost]
  const unvisited: { nodeId: string; cost: number }[] = [];

  distances.set(startNodeId, 0);
  unvisited.push({ nodeId: startNodeId, cost: 0 });

  while (unvisited.length > 0) {
    // Sort to extract lowest cost node
    unvisited.sort((a, b) => a.cost - b.cost);
    const current = unvisited.shift()!;
    const u = current.nodeId;

    if (visited.has(u)) continue;
    visited.add(u);

    // If we reached the target node, we can stop early
    if (targetNodeId && u === targetNodeId) {
      break;
    }

    const outgoingEdges = adjacency.get(u) || [];
    for (const edge of outgoingEdges) {
      if (excludedEdges.has(edge.id)) continue;
      const v = edge.target;
      if (excludedNodes.has(v) || visited.has(v)) continue;

      const edgeWeight = edge.weight ?? (1.0 - edge.confidence + 0.0001);
      const currentDistU = distances.get(u) ?? Infinity;
      const alt = currentDistU + edgeWeight;
      const currentDistV = distances.get(v) ?? Infinity;

      if (alt < currentDistV) {
        distances.set(v, alt);
        previous.set(v, { nodeId: u, edge });
        unvisited.push({ nodeId: v, cost: alt });
      }
    }
  }

  // If a specific target was requested, reconstruct path
  if (targetNodeId) {
    if (!distances.has(targetNodeId) || distances.get(targetNodeId) === Infinity) {
      return {
        sourceId: startNodeId,
        targetId: targetNodeId,
        found: false,
        totalCost: Infinity,
        nodePath: [],
        edgePath: [],
        distanceMap: distances,
        previousMap: previous,
      };
    }

    const nodePath: string[] = [];
    const edgePath: GraphEdge[] = [];
    let curr: string | null = targetNodeId;

    while (curr && curr !== startNodeId) {
      nodePath.unshift(curr);
      const prevInfo = previous.get(curr);
      if (prevInfo) {
        edgePath.unshift(prevInfo.edge);
        curr = prevInfo.nodeId;
      } else {
        break;
      }
    }
    nodePath.unshift(startNodeId);

    return {
      sourceId: startNodeId,
      targetId: targetNodeId,
      found: true,
      totalCost: distances.get(targetNodeId)!,
      nodePath,
      edgePath,
      distanceMap: distances,
      previousMap: previous,
    };
  }

  return {
    sourceId: startNodeId,
    targetId: '',
    found: true,
    totalCost: 0,
    nodePath: [],
    edgePath: [],
    distanceMap: distances,
    previousMap: previous,
  };
}
