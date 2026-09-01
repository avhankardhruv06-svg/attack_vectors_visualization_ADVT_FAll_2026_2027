// Central Graph Store (Zustand) - Single Source of Truth
import { create } from 'zustand';
import {
  AttackGraph,
  ReversePathResult,
  ActiveFilterState,
  ViewMode,
  Layout2DMode,
  ThemeMode,
} from './types';
import { RawSecurityEvent } from '../simulation/types';
import { DETERMINISTIC_RANSOMWARE_EVENTS } from '../simulation/ransomwareScenario';
import { buildAttackGraphFromEvents } from './graphBuilder';
import { filterGraph, createDefaultFilterState } from './graphUtils';
import { executeReverseTraversal } from '../algorithms/reverseTraversal';
import { calculateDegreeOfInterest } from '../algorithms/degreeOfInterest';
import { detectCommunities, CommunityDetectionResult } from '../algorithms/louvain';

export interface GraphStoreState {
  // Master graph data & active filtered view
  masterGraph: AttackGraph;
  filteredGraph: AttackGraph;
  
  // Investigation and Selection state
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;

  // Reverse Traversal analysis state
  reverseTraversal: {
    targetNodeId: string | null;
    results: ReversePathResult[];
    activePathIndex: number;
    activeStepIndex: number; // For step-by-step path stepping
    isTracing: boolean;
  };

  // Algorithmic augmentations
  doiMap: Map<string, number>;
  communityData: CommunityDetectionResult | null;
  clusteringMode: 'CATEGORICAL' | 'STRUCTURAL';

  // Timeline & Playback state
  timeline: {
    minTime: number;
    maxTime: number;
    currentTime: number;
    isPlaying: boolean;
    playbackSpeed: number; // 1x, 2x, 5x
  };

  // Multi-faceted filtering
  filters: ActiveFilterState;

  // Viewport and UI state
  viewMode: ViewMode;
  layout2D: Layout2DMode;
  theme: ThemeMode;
  showParticles: boolean;
  semanticZoomLevel: 'NETWORK' | 'HOST' | 'EVENT';

  // Actions
  loadEvents: (events: RawSecurityEvent[]) => void;
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  
  // Reverse Traversal Actions
  traceAttackOrigin: (targetNodeId: string, k?: number) => void;
  selectReversePath: (index: number) => void;
  setReversePathStep: (stepIndex: number) => void;
  stepReversePath: (direction: 'next' | 'prev') => void;
  clearReverseTraversal: () => void;

  // Filter actions
  updateFilters: (updater: (prev: ActiveFilterState) => ActiveFilterState) => void;
  resetFilters: () => void;

  // Timeline actions
  setTimelineTime: (timestamp: number) => void;
  toggleTimelinePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  stepTimeline: (deltaSeconds?: number) => void;

  // Display toggles
  setViewMode: (mode: ViewMode) => void;
  setLayout2D: (layout: Layout2DMode) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleParticles: () => void;
  setClusteringMode: (mode: 'CATEGORICAL' | 'STRUCTURAL') => void;
  setSemanticZoomLevel: (level: 'NETWORK' | 'HOST' | 'EVENT') => void;
}

// Initial setup from deterministic scenario
const initialEvents = DETERMINISTIC_RANSOMWARE_EVENTS;
const initialMasterGraph = buildAttackGraphFromEvents(initialEvents);
const initialTimestamps = initialEvents.map((e) => e.timestamp);
const initialMinTime = initialTimestamps.length ? Math.min(...initialTimestamps) : 0;
const initialMaxTime = initialTimestamps.length ? Math.max(...initialTimestamps) : 1000;
const initialFilters = createDefaultFilterState(initialMinTime, initialMaxTime);
const initialFilteredGraph = filterGraph(initialMasterGraph, initialFilters, initialMaxTime);
const initialCommunities = detectCommunities(initialMasterGraph);
const initialDoiMap = calculateDegreeOfInterest(null, initialMasterGraph);

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  masterGraph: initialMasterGraph,
  filteredGraph: initialFilteredGraph,

  selectedNodeId: null,
  hoveredNodeId: null,
  focusedNodeId: null,

  reverseTraversal: {
    targetNodeId: null,
    results: [],
    activePathIndex: 0,
    activeStepIndex: -1,
    isTracing: false,
  },

  doiMap: initialDoiMap,
  communityData: initialCommunities,
  clusteringMode: 'CATEGORICAL',

  timeline: {
    minTime: initialMinTime,
    maxTime: initialMaxTime,
    currentTime: initialMaxTime,
    isPlaying: false,
    playbackSpeed: 1,
  },

  filters: initialFilters,

  viewMode: 'SPLIT',
  layout2D: 'HIERARCHICAL',
  theme: 'DARK_ANALYST',
  showParticles: true,
  semanticZoomLevel: 'HOST',

  loadEvents: (events: RawSecurityEvent[]) => {
    const masterGraph = buildAttackGraphFromEvents(events);
    const timestamps = events.map((e) => e.timestamp);
    const minTime = timestamps.length ? Math.min(...timestamps) : 0;
    const maxTime = timestamps.length ? Math.max(...timestamps) : 1000;
    const filters = createDefaultFilterState(minTime, maxTime);
    const filteredGraph = filterGraph(masterGraph, filters, maxTime);
    const communityData = detectCommunities(masterGraph);
    const doiMap = calculateDegreeOfInterest(null, masterGraph);

    set({
      masterGraph,
      filteredGraph,
      communityData,
      doiMap,
      selectedNodeId: null,
      hoveredNodeId: null,
      focusedNodeId: null,
      reverseTraversal: {
        targetNodeId: null,
        results: [],
        activePathIndex: 0,
        activeStepIndex: -1,
        isTracing: false,
      },
      timeline: {
        minTime,
        maxTime,
        currentTime: maxTime,
        isPlaying: false,
        playbackSpeed: 1,
      },
      filters,
    });
  },

  selectNode: (nodeId: string | null) => {
    const { masterGraph, reverseTraversal } = get();
    const newDoi = calculateDegreeOfInterest(nodeId, masterGraph);

    // If reverse traversal is active and the selected node is part of the active path, sync step
    let newStepIndex = reverseTraversal.activeStepIndex;
    const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
    if (activePath && nodeId) {
      const idx = activePath.nodeIds.indexOf(nodeId);
      if (idx !== -1) {
        newStepIndex = idx;
      }
    }

    set({
      selectedNodeId: nodeId,
      focusedNodeId: nodeId,
      doiMap: newDoi,
      reverseTraversal: {
        ...reverseTraversal,
        activeStepIndex: newStepIndex,
      },
    });
  },

  hoverNode: (nodeId: string | null) => {
    set({ hoveredNodeId: nodeId });
  },

  focusNode: (nodeId: string | null) => {
    set({ focusedNodeId: nodeId });
  },

  traceAttackOrigin: (targetNodeId: string, k = 3) => {
    const { masterGraph } = get();
    const targetNode = masterGraph.nodeMap.get(targetNodeId);
    if (!targetNode) return;

    set((state) => ({
      reverseTraversal: {
        ...state.reverseTraversal,
        isTracing: true,
      },
    }));

    // Execute actual Dijkstra + Yen reverse traversal
    const results = executeReverseTraversal(targetNodeId, masterGraph, k);
    const activeResult = results[0];
    const initialStep = activeResult ? 0 : -1;
    const initialOriginNode = activeResult ? activeResult.nodeIds[0] : targetNodeId;

    const newDoi = calculateDegreeOfInterest(targetNodeId, masterGraph);

    set({
      selectedNodeId: targetNodeId,
      focusedNodeId: initialOriginNode,
      doiMap: newDoi,
      reverseTraversal: {
        targetNodeId,
        results,
        activePathIndex: 0,
        activeStepIndex: initialStep,
        isTracing: false,
      },
    });
  },

  selectReversePath: (index: number) => {
    const { reverseTraversal } = get();
    if (index >= 0 && index < reverseTraversal.results.length) {
      set({
        reverseTraversal: {
          ...reverseTraversal,
          activePathIndex: index,
          activeStepIndex: 0,
        },
      });
    }
  },

  setReversePathStep: (stepIndex: number) => {
    const { reverseTraversal, masterGraph } = get();
    const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
    if (!activePath) return;

    if (stepIndex >= 0 && stepIndex < activePath.nodeIds.length) {
      const currentNodeId = activePath.nodeIds[stepIndex];
      const newDoi = calculateDegreeOfInterest(currentNodeId, masterGraph);

      set({
        selectedNodeId: currentNodeId,
        focusedNodeId: currentNodeId,
        doiMap: newDoi,
        reverseTraversal: {
          ...reverseTraversal,
          activeStepIndex: stepIndex,
        },
      });
    }
  },

  stepReversePath: (direction: 'next' | 'prev') => {
    const { reverseTraversal, setReversePathStep } = get();
    const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
    if (!activePath) return;

    const current = reverseTraversal.activeStepIndex;
    if (direction === 'next') {
      const nextStep = Math.min(activePath.nodeIds.length - 1, current + 1);
      setReversePathStep(nextStep);
    } else {
      const prevStep = Math.max(0, current - 1);
      setReversePathStep(prevStep);
    }
  },

  clearReverseTraversal: () => {
    const { masterGraph } = get();
    set({
      reverseTraversal: {
        targetNodeId: null,
        results: [],
        activePathIndex: 0,
        activeStepIndex: -1,
        isTracing: false,
      },
      doiMap: calculateDegreeOfInterest(null, masterGraph),
    });
  },

  updateFilters: (updater) => {
    const { masterGraph, filters: prevFilters, timeline } = get();
    const newFilters = updater(prevFilters);
    const filteredGraph = filterGraph(masterGraph, newFilters, timeline.currentTime);

    set({
      filters: newFilters,
      filteredGraph,
    });
  },

  resetFilters: () => {
    const { masterGraph, timeline } = get();
    const defaultFilters = createDefaultFilterState(timeline.minTime, timeline.maxTime);
    const filteredGraph = filterGraph(masterGraph, defaultFilters, timeline.currentTime);

    set({
      filters: defaultFilters,
      filteredGraph,
    });
  },

  setTimelineTime: (timestamp: number) => {
    const { masterGraph, filters, timeline } = get();
    const clampedTime = Math.max(timeline.minTime, Math.min(timeline.maxTime, timestamp));
    const filteredGraph = filterGraph(masterGraph, filters, clampedTime);

    set({
      timeline: {
        ...timeline,
        currentTime: clampedTime,
      },
      filteredGraph,
    });
  },

  toggleTimelinePlayback: () => {
    const { timeline } = get();
    set({
      timeline: {
        ...timeline,
        isPlaying: !timeline.isPlaying,
      },
    });
  },

  setPlaybackSpeed: (speed: number) => {
    const { timeline } = get();
    set({
      timeline: {
        ...timeline,
        playbackSpeed: speed,
      },
    });
  },

  stepTimeline: (deltaSeconds = 60) => {
    const { timeline, setTimelineTime } = get();
    const nextTime = timeline.currentTime + deltaSeconds;
    if (nextTime > timeline.maxTime) {
      setTimelineTime(timeline.minTime);
    } else {
      setTimelineTime(nextTime);
    }
  },

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setLayout2D: (layout: Layout2DMode) => set({ layout2D: layout }),
  setTheme: (theme: ThemeMode) => set({ theme }),
  toggleParticles: () => set((state) => ({ showParticles: !state.showParticles })),
  setClusteringMode: (mode: 'CATEGORICAL' | 'STRUCTURAL') => set({ clusteringMode: mode }),
  setSemanticZoomLevel: (level: 'NETWORK' | 'HOST' | 'EVENT') => set({ semanticZoomLevel: level }),
}));
