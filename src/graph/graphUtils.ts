// Graph Utilities and Subgraph Filtering
import {
  AttackGraph,
  GraphNode,
  GraphEdge,
  ActiveFilterState,
  EntityType,
  NetworkZone,
  AttackStage,
  NodeSecurityState,
} from './types';

export const ALL_ENTITY_TYPES: EntityType[] = [
  'ATTACKER',
  'HOST',
  'USER',
  'PROCESS',
  'CREDENTIAL',
  'FILE',
  'NETWORK_ENDPOINT',
];

export const ALL_NETWORK_ZONES: NetworkZone[] = [
  'EXTERNAL_INTERNET',
  'DMZ',
  'CORP_WORKSTATION',
  'INTERNAL_SERVERS',
  'CRITICAL_DATA_CENTER',
];

export const ALL_ATTACK_STAGES: AttackStage[] = [
  'INITIAL_ACCESS',
  'EXECUTION',
  'CREDENTIAL_ACCESS',
  'LATERAL_MOVEMENT',
  'COLLECTION_EXFIL',
  'IMPACT',
];

export const ALL_SECURITY_STATES: NodeSecurityState[] = [
  'NORMAL',
  'SUSPICIOUS',
  'COMPROMISED',
  'LATERAL_MOVEMENT_SOURCE',
  'IMPACTED',
];

export function createDefaultFilterState(minTime = 0, maxTime = Infinity): ActiveFilterState {
  return {
    searchQuery: '',
    selectedEntityTypes: new Set(ALL_ENTITY_TYPES),
    selectedSecurityStates: new Set(ALL_SECURITY_STATES),
    selectedZones: new Set(ALL_NETWORK_ZONES),
    selectedStages: new Set(ALL_ATTACK_STAGES),
    minConfidence: 0.0,
    minTimestamp: minTime,
    maxTimestamp: maxTime,
    highlightCommunityId: null,
  };
}

/**
 * Filters the AttackGraph based on active filter criteria and timeline cutoff.
 */
export function filterGraph(
  masterGraph: AttackGraph,
  filters: ActiveFilterState,
  currentTimelineTime?: number
): AttackGraph {
  const query = filters.searchQuery.trim().toLowerCase();
  const maxTime = currentTimelineTime !== undefined ? currentTimelineTime : filters.maxTimestamp;

  // Filter nodes
  const filteredNodes = masterGraph.nodes.filter((node) => {
    // Timeline check
    if (node.timestamp > maxTime) return false;
    if (node.timestamp < filters.minTimestamp) return false;

    // Entity type check
    if (!filters.selectedEntityTypes.has(node.type)) return false;

    // Zone check
    if (!filters.selectedZones.has(node.zone)) return false;

    // Stage check
    if (!filters.selectedStages.has(node.stage)) return false;

    // Security state check
    if (!filters.selectedSecurityStates.has(node.state)) return false;

    // Search query check
    if (query) {
      const matchLabel = node.label.toLowerCase().includes(query);
      const matchId = node.id.toLowerCase().includes(query);
      const matchProps = Object.values(node.properties).some((val) =>
        String(val).toLowerCase().includes(query)
      );
      if (!matchLabel && !matchId && !matchProps) return false;
    }

    return true;
  });

  const validNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredNodeMap = new Map<string, GraphNode>();
  filteredNodes.forEach((n) => filteredNodeMap.set(n.id, n));

  // Filter edges
  const filteredEdges = masterGraph.edges.filter((edge) => {
    // Both endpoints must exist in filtered nodes
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) return false;

    // Confidence threshold
    if (edge.confidence < filters.minConfidence) return false;

    // Timeline check
    if (edge.timestamp > maxTime) return false;
    if (edge.timestamp < filters.minTimestamp) return false;

    return true;
  });

  // Rebuild filtered adjacency
  const filteredAdjacency = new Map<string, GraphEdge[]>();
  const filteredReverseAdjacency = new Map<string, GraphEdge[]>();

  for (const edge of filteredEdges) {
    const outList = filteredAdjacency.get(edge.source) || [];
    outList.push(edge);
    filteredAdjacency.set(edge.source, outList);

    const inList = filteredReverseAdjacency.get(edge.target) || [];
    inList.push(edge);
    filteredReverseAdjacency.set(edge.target, inList);
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    nodeMap: filteredNodeMap,
    adjacency: filteredAdjacency,
    reverseAdjacency: filteredReverseAdjacency,
  };
}

/**
 * Gets 1-hop neighboring node IDs for a given node
 */
export function getNeighbors(nodeId: string, graph: AttackGraph): {
  outgoing: GraphNode[];
  incoming: GraphNode[];
  all: GraphNode[];
} {
  const outgoingEdges = graph.adjacency.get(nodeId) || [];
  const incomingEdges = graph.reverseAdjacency.get(nodeId) || [];

  const outgoing = outgoingEdges
    .map((e) => graph.nodeMap.get(e.target))
    .filter((n): n is GraphNode => !!n);

  const incoming = incomingEdges
    .map((e) => graph.nodeMap.get(e.source))
    .filter((n): n is GraphNode => !!n);

  const allMap = new Map<string, GraphNode>();
  outgoing.forEach((n) => allMap.set(n.id, n));
  incoming.forEach((n) => allMap.set(n.id, n));

  return {
    outgoing,
    incoming,
    all: Array.from(allMap.values()),
  };
}
