// Graph Store & Synchronization Unit Tests
import { describe, it, expect } from 'vitest';
import { useGraphStore } from '../graph/graphStore';

describe('Central Graph Store & State Synchronization', () => {
  it('should initialize with deterministic scenario and single source of truth', () => {
    const state = useGraphStore.getState();
    expect(state.masterGraph.nodes.length).toBeGreaterThan(0);
    expect(state.filteredGraph.nodes.length).toBe(state.masterGraph.nodes.length);
    expect(state.timeline.isPlaying).toBe(false);
  });

  it('should synchronize selection and update Degree of Interest (DOI)', () => {
    const store = useGraphStore.getState();
    store.selectNode('HOST-FILE-SERVER-01');

    const updated = useGraphStore.getState();
    expect(updated.selectedNodeId).toBe('HOST-FILE-SERVER-01');
    expect(updated.focusedNodeId).toBe('HOST-FILE-SERVER-01');
    expect(updated.doiMap.get('HOST-FILE-SERVER-01')).toBe(1.0);
  });

  it('should execute reverse traversal and sync Top-K results', () => {
    const store = useGraphStore.getState();
    store.traceAttackOrigin('HOST-FILE-SERVER-01', 3);

    const updated = useGraphStore.getState();
    expect(updated.reverseTraversal.targetNodeId).toBe('HOST-FILE-SERVER-01');
    expect(updated.reverseTraversal.results.length).toBeGreaterThanOrEqual(1);
    expect(updated.reverseTraversal.activePathIndex).toBe(0);
  });

  it('should step through reverse path forwards and backwards', () => {
    const store = useGraphStore.getState();
    store.traceAttackOrigin('HOST-FILE-SERVER-01', 3);

    const initialStep = useGraphStore.getState().reverseTraversal.activeStepIndex;
    store.stepReversePath('next');
    expect(useGraphStore.getState().reverseTraversal.activeStepIndex).toBe(initialStep + 1);

    store.stepReversePath('prev');
    expect(useGraphStore.getState().reverseTraversal.activeStepIndex).toBe(initialStep);
  });

  it('should filter graph dynamically on timeline scrubbing', () => {
    const store = useGraphStore.getState();
    const minTime = store.timeline.minTime;
    
    // Scrub to earliest time
    store.setTimelineTime(minTime + 130);
    const updated = useGraphStore.getState();
    expect(updated.filteredGraph.nodes.length).toBeLessThan(updated.masterGraph.nodes.length);
    expect(updated.filteredGraph.edges.length).toBeLessThan(updated.masterGraph.edges.length);
  });
});
