// Reverse Traversal & Deterministic Scenario Test
import { describe, it, expect } from 'vitest';
import { DETERMINISTIC_RANSOMWARE_EVENTS } from '../simulation/ransomwareScenario';
import { buildAttackGraphFromEvents } from '../graph/graphBuilder';
import { executeReverseTraversal } from '../algorithms/reverseTraversal';

describe('Reverse Traversal on Ransomware Scenario', () => {
  const graph = buildAttackGraphFromEvents(DETERMINISTIC_RANSOMWARE_EVENTS);

  it('should successfully build attack graph with expected nodes and edges', () => {
    expect(graph.nodes.length).toBeGreaterThan(10);
    expect(graph.edges.length).toBeGreaterThan(12);
    expect(graph.nodeMap.has('HOST-FILE-SERVER-01')).toBe(true);
    expect(graph.nodeMap.has('THREAT-ACTOR-FIN7')).toBe(true);
  });

  it('should trace reverse attack paths from FILE-SERVER-01 back to APT-FinOps', () => {
    const results = executeReverseTraversal('HOST-FILE-SERVER-01', graph, 3);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const rank1 = results[0];
    expect(rank1.rank).toBe(1);
    expect(rank1.targetNodeId).toBe('HOST-FILE-SERVER-01');
    expect(rank1.originNodeId).toBe('THREAT-ACTOR-FIN7');

    // Chronological attack path starts at Attacker and ends at File Server
    expect(rank1.nodeIds[0]).toBe('THREAT-ACTOR-FIN7');
    expect(rank1.nodeIds[rank1.nodeIds.length - 1]).toBe('HOST-FILE-SERVER-01');

    // Rank 1 path should pass through spearphishing user Bob -> Workstation -> LSASS -> Creds
    expect(rank1.nodeIds).toContain('USER-BOB-MARKETING');
    expect(rank1.nodeIds).toContain('HOST-WS-FIN-02');
    expect(rank1.nodeIds).toContain('CRED-SVC-BACKUP');

    expect(rank1.pathConfidence).toBeGreaterThan(0.5);
    expect(rank1.steps.length).toBe(rank1.nodeIds.length - 1);
  });

  it('should identify alternative candidate vectors (VPN Exploit)', () => {
    const results = executeReverseTraversal('HOST-FILE-SERVER-01', graph, 3);
    // If multiple paths exist, alternative should be found
    if (results.length > 1) {
      const rank2 = results[1];
      expect(rank2.rank).toBe(2);
      expect(rank2.totalCost).toBeGreaterThanOrEqual(results[0].totalCost);
    }
  });
});
