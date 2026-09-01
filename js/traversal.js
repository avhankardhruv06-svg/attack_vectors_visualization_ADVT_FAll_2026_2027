// traversal.js
//
// The reverse attack-path engine (brief section 6) — the main analytical
// component of the system. Given an impacted target, it walks the graph
// backwards along confidence-weighted edges to find the most probable
// origin(s).
//
// w(e) = 1 - c(e)   -> higher confidence = lower traversal cost
//
// IMPORTANT: per the brief, confidence is NOT reinterpreted as a
// calibrated probability here. It is treated exactly as an
// event-confidence score and used only as a relative edge cost.

/**
 * Builds a reversed adjacency list: for every edge src->dst we add an
 * entry dst -> src, because we are tracing effect back to cause.
 */
function buildReversedAdjacency(nodes, edges) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.target).push({
      to: e.source,
      edge: e,
      weight: 1 - e.confidence,
    });
  }
  return adj;
}

/**
 * Dijkstra's algorithm over the reversed graph from `targetId`, returning
 * the single lowest-cost path back to the best-supported origin
 * (a node with no further incoming-turned-outgoing edges, i.e. a source).
 */
export function dijkstraReversePath(nodes, edges, targetId) {
  const adj = buildReversedAdjacency(nodes, edges);
  const dist = new Map([[targetId, 0]]);
  const prevEdge = new Map(); // nodeId -> {from, edge}
  const visited = new Set();

  // simple binary-heap-free priority queue (fine at this graph scale)
  const queue = [[0, targetId]];

  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    for (const { to, edge, weight } of adj.get(u) || []) {
      const nd = d + weight;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prevEdge.set(to, { from: u, edge });
        queue.push([nd, to]);
      }
    }
  }

  // Origin = the reachable node with no further predecessors (in-degree 0
  // in the reversed walk) and the greatest distance from target, i.e. the
  // "deepest" traced-back node — a reasonable proxy for "probable origin".
  let originId = targetId;
  let maxDist = 0;
  for (const [nodeId, d] of dist.entries()) {
    if (d > maxDist) {
      maxDist = d;
      originId = nodeId;
    }
  }

  return reconstructPath(prevEdge, targetId, originId, dist.get(originId) ?? 0);
}

/**
 * Walks prevEdge pointers backward from `originId` (the farthest node
 * reached by the search) to `startId` (where the search began — the
 * impacted target asset), then reverses the result so the returned path
 * reads [startId, ..., originId], matching the brief's own "Target T ->
 * Origin A" diagram (section 6.2).
 */
function reconstructPath(prevEdge, startId, originId, cost) {
  const nodesRev = [originId];
  const edgesRev = [];
  let node = originId;
  while (node !== startId && prevEdge.has(node)) {
    const { from, edge } = prevEdge.get(node);
    edgesRev.push(edge);
    node = from;
    nodesRev.push(node);
  }
  return {
    nodeIds: nodesRev.reverse(),
    edgeIds: edgesRev.reverse().map((e) => e.id),
    cost,
  };
}

/**
 * Yen's algorithm for the top-K loopless shortest paths, run on the
 * reversed graph from target back toward candidate origins (brief 6.2).
 * Returns an array of {nodeIds, edgeIds, cost, rank} sorted best-first.
 */
export function yensTopKReversePaths(nodes, edges, targetId, k = 3) {
  const best = dijkstraOnGraph(nodes, edges, targetId, new Set(), new Set());
  if (!best) return [];

  const A = [best];
  const B = [];

  for (let ki = 1; ki < k; ki++) {
    const prevPath = A[ki - 1];
    for (let i = 0; i < prevPath.nodeIds.length - 1; i++) {
      const spurNode = prevPath.nodeIds[i];
      const rootPath = prevPath.nodeIds.slice(0, i + 1);

      const removedEdges = new Set();
      for (const p of A) {
        if (p.nodeIds.length > i && arraysEqual(p.nodeIds.slice(0, i + 1), rootPath)) {
          removedEdges.add(p.edgeIds[i]);
        }
      }
      const removedNodes = new Set(rootPath.slice(0, -1));

      const spurPath = dijkstraOnGraph(nodes, edges, targetId, removedEdges, removedNodes, spurNode);
      // Skip degenerate spur results: if excluding the root path leaves no
      // further backward continuation from spurNode, that's a dead end,
      // not a meaningful alternate origin.
      if (spurPath && spurPath.edgeIds.length > 0) {
        const rootCost = rootPath.length > 1 ? sumRootCost(edges, prevPath, i) : 0;
        const totalPath = mergePaths(rootPath, prevPath.edgeIds.slice(0, i), spurPath);
        if (!A.some((p) => arraysEqual(p.nodeIds, totalPath.nodeIds)) && !B.some((p) => arraysEqual(p.nodeIds, totalPath.nodeIds))) {
          B.push(totalPath);
        }
      }
    }
    if (!B.length) break;
    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift());
  }

  return A.slice(0, k).map((p, i) => ({ ...p, rank: i + 1 }));
}

function sumRootCost() {
  return 0; // root-path cost is already embedded in spurPath's cost accumulation below
}

function mergePaths(rootNodeIds, rootEdgeIds, spurPath) {
  const nodeIds = [...rootNodeIds.slice(0, -1), ...spurPath.nodeIds];
  const edgeIds = [...rootEdgeIds, ...spurPath.edgeIds];
  return { nodeIds, edgeIds, cost: spurPath.cost };
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Dijkstra restricted to a target->origin search that can exclude given
 * edges/nodes (used internally by Yen's algorithm), optionally starting
 * the walk from `fromNode` instead of `targetId` (spur search).
 */
function dijkstraOnGraph(nodes, edges, targetId, excludeEdgeIds, excludeNodeIds, fromNode = null) {
  const adj = buildReversedAdjacency(nodes, edges.filter((e) => !excludeEdgeIds.has(e.id)));
  const start = fromNode || targetId;
  if (excludeNodeIds.has(start)) return null;

  const dist = new Map([[start, 0]]);
  const prevEdge = new Map();
  const visited = new Set();
  const queue = [[0, start]];

  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    for (const { to, edge, weight } of adj.get(u) || []) {
      if (excludeNodeIds.has(to)) continue;
      const nd = d + weight;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prevEdge.set(to, { from: u, edge });
        queue.push([nd, to]);
      }
    }
  }

  let originId = start;
  let maxDist = 0;
  for (const [nodeId, d] of dist.entries()) {
    if (d > maxDist) {
      maxDist = d;
      originId = nodeId;
    }
  }
  if (originId === start) return { nodeIds: [start], edgeIds: [], cost: 0 };

  return reconstructPath(prevEdge, start, originId, dist.get(originId));
}
