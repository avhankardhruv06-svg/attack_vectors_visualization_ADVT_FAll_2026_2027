// Dijkstra Shortest Path Unit Tests
import { describe, it, expect } from 'vitest';
import { dijkstra } from '../algorithms/dijkstra';
import { GraphEdge } from '../graph/types';

describe('Dijkstra Algorithm', () => {
  // Setup simple test DAG
  // A -(w:0.1)-> B -(w:0.2)-> D (Total: 0.3)
  // A -(w:0.5)-> C -(w:0.1)-> D (Total: 0.6)
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'A', target: 'B', type: 'SPAWNED', timestamp: 1, confidence: 0.9, weight: 0.1 },
    { id: 'e2', source: 'B', target: 'D', type: 'SPAWNED', timestamp: 2, confidence: 0.8, weight: 0.2 },
    { id: 'e3', source: 'A', target: 'C', type: 'SPAWNED', timestamp: 1, confidence: 0.5, weight: 0.5 },
    { id: 'e4', source: 'C', target: 'D', type: 'SPAWNED', timestamp: 2, confidence: 0.9, weight: 0.1 },
  ];

  const adjacency = new Map<string, GraphEdge[]>();
  edges.forEach((e) => {
    const list = adjacency.get(e.source) || [];
    list.push(e);
    adjacency.set(e.source, list);
  });

  it('should find minimum cost shortest path from A to D', () => {
    const res = dijkstra('A', 'D', adjacency);
    expect(res.found).toBe(true);
    expect(res.nodePath).toEqual(['A', 'B', 'D']);
    expect(res.totalCost).toBeCloseTo(0.3, 3);
    expect(res.edgePath.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('should avoid excluded edges', () => {
    const excluded = new Set<string>(['e1']); // Block A->B
    const res = dijkstra('A', 'D', adjacency, excluded);
    expect(res.found).toBe(true);
    expect(res.nodePath).toEqual(['A', 'C', 'D']);
    expect(res.totalCost).toBeCloseTo(0.6, 3);
  });

  it('should return found=false if destination unreachable', () => {
    const res = dijkstra('A', 'NON_EXISTENT', adjacency);
    expect(res.found).toBe(false);
    expect(res.nodePath).toEqual([]);
  });
});
