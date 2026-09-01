// Yen's Top-K Loopless Shortest Paths Unit Tests
import { describe, it, expect } from 'vitest';
import { yenKShortestPaths } from '../algorithms/yen';
import { GraphEdge } from '../graph/types';

describe("Yen's K-Shortest Loopless Paths", () => {
  // Setup diamond graph with 3 distinct paths:
  // Path 1: S -> A -> T (cost: 1 + 1 = 2)
  // Path 2: S -> B -> T (cost: 2 + 1 = 3)
  // Path 3: S -> C -> T (cost: 3 + 1 = 4)
  const edges: GraphEdge[] = [
    { id: 'e_sa', source: 'S', target: 'A', type: 'SPAWNED', timestamp: 1, confidence: 0.5, weight: 1.0 },
    { id: 'e_at', source: 'A', target: 'T', type: 'SPAWNED', timestamp: 2, confidence: 0.5, weight: 1.0 },

    { id: 'e_sb', source: 'S', target: 'B', type: 'SPAWNED', timestamp: 1, confidence: 0.5, weight: 2.0 },
    { id: 'e_bt', source: 'B', target: 'T', type: 'SPAWNED', timestamp: 2, confidence: 0.5, weight: 1.0 },

    { id: 'e_sc', source: 'S', target: 'C', type: 'SPAWNED', timestamp: 1, confidence: 0.5, weight: 3.0 },
    { id: 'e_ct', source: 'C', target: 'T', type: 'SPAWNED', timestamp: 2, confidence: 0.5, weight: 1.0 },
  ];

  const adjacency = new Map<string, GraphEdge[]>();
  edges.forEach((e) => {
    const list = adjacency.get(e.source) || [];
    list.push(e);
    adjacency.set(e.source, list);
  });

  it('should discover top-3 distinct loopless paths in sorted cost order', () => {
    const paths = yenKShortestPaths('S', 'T', adjacency, 3);
    expect(paths.length).toBe(3);

    // Rank 1: S -> A -> T (cost 2)
    expect(paths[0].nodePath).toEqual(['S', 'A', 'T']);
    expect(paths[0].totalCost).toBe(2.0);

    // Rank 2: S -> B -> T (cost 3)
    expect(paths[1].nodePath).toEqual(['S', 'B', 'T']);
    expect(paths[1].totalCost).toBe(3.0);

    // Rank 3: S -> C -> T (cost 4)
    expect(paths[2].nodePath).toEqual(['S', 'C', 'T']);
    expect(paths[2].totalCost).toBe(4.0);
  });
});
