// Reverse Traversal Engine for Cybersecurity Root-Cause & Attack-Origin Analysis
import {
  AttackGraph,
  GraphNode,
  GraphEdge,
  ReversePathResult,
  PathStepDetail,
} from '../graph/types';
import { calculatePathConfidence } from '../graph/confidence';
import { dijkstra } from './dijkstra';
import { yenKShortestPaths } from './yen';

/**
 * Builds the reversed adjacency map: for edge u -> v, reverse edge is v -> u
 */
export function buildReversedAdjacency(
  edges: GraphEdge[]
): Map<string, GraphEdge[]> {
  const reversedAdjacency = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    // In reversed graph, source is original target, target is original source
    const revEdge: GraphEdge = {
      ...edge,
      id: `${edge.id}__rev`,
      source: edge.target,
      target: edge.source,
    };

    const list = reversedAdjacency.get(edge.target) || [];
    list.push(revEdge);
    reversedAdjacency.set(edge.target, list);
  }

  return reversedAdjacency;
}

/**
 * Identifies candidate entrypoints / root origin nodes in the graph
 * (e.g. ATTACKER entities, INITIAL_ACCESS stage nodes, or nodes with in-degree 0)
 */
export function findCandidateOrigins(
  graph: AttackGraph,
  targetNodeId: string
): string[] {
  const candidateSet = new Set<string>();

  // 1. Root nodes with in-degree 0 in the original forward graph
  for (const node of graph.nodes) {
    if (node.id === targetNodeId) continue;
    const incoming = graph.reverseAdjacency.get(node.id) || [];
    if (incoming.length === 0) {
      candidateSet.add(node.id);
    }
  }

  // 2. All ATTACKER or external internet nodes
  for (const node of graph.nodes) {
    if (node.id === targetNodeId) continue;
    if (node.type === 'ATTACKER' || node.zone === 'EXTERNAL_INTERNET') {
      candidateSet.add(node.id);
    }
  }

  // 3. Fallback: If no root nodes found, include initial access stage nodes
  if (candidateSet.size === 0) {
    for (const node of graph.nodes) {
      if (node.id !== targetNodeId && node.stage === 'INITIAL_ACCESS') {
        candidateSet.add(node.id);
      }
    }
  }

  return Array.from(candidateSet);
}

/**
 * Identifies cut-vertices (critical bottleneck nodes) across discovered paths
 */
export function findCriticalBottlenecks(paths: ReversePathResult[]): string[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    // Return intermediate nodes
    return paths[0].nodeIds.slice(1, -1);
  }

  // Nodes that appear in every top-K path
  const nodeSets = paths.map((p) => new Set(p.nodeIds.slice(1, -1)));
  const commonNodes: string[] = [];

  const firstSet = nodeSets[0];
  for (const nodeId of firstSet) {
    const inAll = nodeSets.every((set) => set.has(nodeId));
    if (inAll) {
      commonNodes.push(nodeId);
    }
  }

  return commonNodes;
}

/**
 * Executes Reverse Traversal starting from an impacted target node backward to candidate origins.
 * Calculates Top-K weighted loopless candidate attack paths.
 *
 * @param targetNodeId The compromised or impacted asset selected by investigator
 * @param graph The central attack graph
 * @param k Number of candidate paths to return (default: 3)
 */
export function executeReverseTraversal(
  targetNodeId: string,
  graph: AttackGraph,
  k: number = 3
): ReversePathResult[] {
  const targetNode = graph.nodeMap.get(targetNodeId);
  if (!targetNode) return [];

  // Build reversed adjacency
  const reversedAdjacency = buildReversedAdjacency(graph.edges);

  // Run Dijkstra from target on reversed graph to explore reachable origins
  const initialDijkstra = dijkstra(targetNodeId, null, reversedAdjacency);
  const distanceMap = initialDijkstra.distanceMap;

  // Identify candidate origins that are reachable in reversed graph
  const potentialOrigins = findCandidateOrigins(graph, targetNodeId);
  const reachableOrigins = potentialOrigins
    .filter((originId) => distanceMap.has(originId) && distanceMap.get(originId)! < Infinity)
    .sort((a, b) => distanceMap.get(a)! - distanceMap.get(b)!);

  const rawCandidatePaths: {
    originId: string;
    nodePath: string[]; // in original forward order (origin -> target)
    edgePath: GraphEdge[]; // in original forward order
    totalCost: number;
  }[] = [];

  // If we have reachable specific origins, compute Top-K to them
  if (reachableOrigins.length > 0) {
    for (const originId of reachableOrigins) {
      // Find paths from target to origin in reversed graph
      const revPaths = yenKShortestPaths(targetNodeId, originId, reversedAdjacency, k);

      for (const revP of revPaths) {
        // Reverse path back to forward chronological order (Origin -> Target)
        const forwardNodePath = [...revP.nodePath].reverse();
        
        // Match edges in forward graph
        const forwardEdgePath: GraphEdge[] = [];
        for (let i = 0; i < forwardNodePath.length - 1; i++) {
          const u = forwardNodePath[i];
          const v = forwardNodePath[i + 1];
          const outEdges = graph.adjacency.get(u) || [];
          const matchedEdge = outEdges.find((e) => e.target === v) || {
            id: `inferred__${u}__${v}`,
            source: u,
            target: v,
            type: 'ACCESSED',
            timestamp: graph.nodeMap.get(v)?.timestamp || 0,
            confidence: 0.5,
            weight: 0.5,
          };
          forwardEdgePath.push(matchedEdge);
        }

        rawCandidatePaths.push({
          originId,
          nodePath: forwardNodePath,
          edgePath: forwardEdgePath,
          totalCost: revP.totalCost,
        });
      }
    }
  } else {
    // Fallback: If no explicit origin reached, pick furthest reachable node on reverse graph
    let maxDist = -1;
    let furthestNodeId: string | null = null;

    for (const [nodeId, dist] of distanceMap.entries()) {
      if (nodeId !== targetNodeId && dist < Infinity && dist > maxDist) {
        maxDist = dist;
        furthestNodeId = nodeId;
      }
    }

    if (furthestNodeId) {
      const revPaths = yenKShortestPaths(targetNodeId, furthestNodeId, reversedAdjacency, k);
      for (const revP of revPaths) {
        const forwardNodePath = [...revP.nodePath].reverse();
        const forwardEdgePath: GraphEdge[] = [];
        for (let i = 0; i < forwardNodePath.length - 1; i++) {
          const u = forwardNodePath[i];
          const v = forwardNodePath[i + 1];
          const outEdges = graph.adjacency.get(u) || [];
          const matchedEdge = outEdges.find((e) => e.target === v);
          if (matchedEdge) forwardEdgePath.push(matchedEdge);
        }

        rawCandidatePaths.push({
          originId: furthestNodeId,
          nodePath: forwardNodePath,
          edgePath: forwardEdgePath,
          totalCost: revP.totalCost,
        });
      }
    }
  }

  // Sort all raw candidate paths by total cost (ascending = highest confidence first)
  rawCandidatePaths.sort((a, b) => a.totalCost - b.totalCost);

  // Deduplicate and take top K
  const uniquePaths: typeof rawCandidatePaths = [];
  const seenPathKeys = new Set<string>();

  for (const p of rawCandidatePaths) {
    const key = p.nodePath.join('->');
    if (!seenPathKeys.has(key)) {
      seenPathKeys.add(key);
      uniquePaths.push(p);
      if (uniquePaths.length >= k) break;
    }
  }

  // Convert to formatted ReversePathResult
  const results: ReversePathResult[] = uniquePaths.map((p, index) => {
    const edgeConfidences = p.edgePath.map((e) => e.confidence);
    const pathConfidence = calculatePathConfidence(edgeConfidences);

    const steps: PathStepDetail[] = [];
    for (let i = 0; i < p.nodePath.length - 1; i++) {
      const fromNode = graph.nodeMap.get(p.nodePath[i])!;
      const toNode = graph.nodeMap.get(p.nodePath[i + 1])!;
      const edge = p.edgePath[i];

      steps.push({
        stepNumber: i + 1,
        fromNode,
        toNode,
        edge,
        stage: toNode?.stage || fromNode?.stage || 'INITIAL_ACCESS',
        timestamp: edge?.timestamp || toNode?.timestamp || 0,
        confidence: edge?.confidence || 0.5,
        explanation: edge?.description || `${fromNode.label} acted upon ${toNode.label} via ${edge.type}`,
      });
    }

    return {
      rank: index + 1,
      originNodeId: p.originId,
      targetNodeId,
      nodeIds: p.nodePath,
      edgeIds: p.edgePath.map((e) => e.id),
      totalCost: parseFloat(p.totalCost.toFixed(4)),
      pathConfidence,
      hopCount: p.edgePath.length,
      criticalCutVertices: [],
      steps,
    };
  });

  // Calculate bottlenecks
  const bottlenecks = findCriticalBottlenecks(results);
  results.forEach((r) => {
    r.criticalCutVertices = bottlenecks;
  });

  return results;
}
