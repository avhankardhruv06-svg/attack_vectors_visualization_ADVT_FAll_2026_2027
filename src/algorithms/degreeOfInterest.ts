// Degree of Interest (DOI) Implementation
// Formula: DOI(x | y) = API(x) - alpha * D(x, y)
import { AttackGraph, GraphNode } from '../graph/types';

/**
 * Computes shortest unweighted hop distance from focus node to all other nodes (undirected BFS)
 */
function computeHopDistances(
  focusNodeId: string,
  graph: AttackGraph
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: [string, number][] = [[focusNodeId, 0]];
  distances.set(focusNodeId, 0);

  while (queue.length > 0) {
    const [curr, dist] = queue.shift()!;

    // Check outgoing and incoming neighbors
    const outgoing = graph.adjacency.get(curr) || [];
    const incoming = graph.reverseAdjacency.get(curr) || [];

    const neighbors = [
      ...outgoing.map((e) => e.target),
      ...incoming.map((e) => e.source),
    ];

    for (const neighbor of neighbors) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, dist + 1);
        queue.push([neighbor, dist + 1]);
      }
    }
  }

  return distances;
}

/**
 * Calculates dynamic Degree of Interest for every node in the graph.
 *
 * @param focusNodeId Currently selected or focused node (or null)
 * @param graph The central attack graph
 * @param alpha Distance penalty factor (default: 0.2)
 */
export function calculateDegreeOfInterest(
  focusNodeId: string | null,
  graph: AttackGraph,
  alpha: number = 0.2
): Map<string, number> {
  const doiMap = new Map<string, number>();

  if (!focusNodeId || !graph.nodeMap.has(focusNodeId)) {
    // If no focus node, DOI is purely based on API (A-priori Importance)
    for (const node of graph.nodes) {
      doiMap.set(node.id, Math.max(0.2, node.apiScore || 0.5));
    }
    return doiMap;
  }

  const hopDistances = computeHopDistances(focusNodeId, graph);

  for (const node of graph.nodes) {
    const api = node.apiScore || 0.5;

    if (node.id === focusNodeId) {
      doiMap.set(node.id, 1.0); // Maximum DOI for focus node
      continue;
    }

    const dist = hopDistances.has(node.id) ? hopDistances.get(node.id)! : 5;
    // DOI = API(x) - alpha * D(x, y)
    const rawDoi = api - alpha * dist;
    // Normalize to [0.15, 1.0] so background nodes remain slightly visible
    const normalized = Math.max(0.15, Math.min(1.0, 0.5 + rawDoi * 0.5));
    doiMap.set(node.id, parseFloat(normalized.toFixed(3)));
  }

  return doiMap;
}
