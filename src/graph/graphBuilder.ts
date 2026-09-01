// Graph Builder & Event Normalization Engine
import {
  AttackGraph,
  GraphNode,
  GraphEdge,
  NetworkZone,
  AttackStage,
  EntityType,
  NodeSecurityState,
} from './types';
import { RawSecurityEvent } from '../simulation/types';
import { confidenceToWeight } from './confidence';

// Semantic X coordinate mapping by Network Zone
export const ZONE_X_MAP: Record<NetworkZone, number> = {
  EXTERNAL_INTERNET: -36,
  DMZ: -18,
  CORP_WORKSTATION: 0,
  INTERNAL_SERVERS: 18,
  CRITICAL_DATA_CENTER: 36,
};

// Semantic Y coordinate mapping by Attack Lifecycle Stage
export const STAGE_Y_MAP: Record<AttackStage, number> = {
  INITIAL_ACCESS: 25,
  EXECUTION: 15,
  CREDENTIAL_ACCESS: 5,
  LATERAL_MOVEMENT: -5,
  COLLECTION_EXFIL: -15,
  IMPACT: -25,
};

// Base API scores (A-priori importance) by Entity Type
const TYPE_API_BASE: Record<EntityType, number> = {
  ATTACKER: 0.95,
  HOST: 0.85,
  CREDENTIAL: 0.80,
  FILE: 0.70,
  PROCESS: 0.65,
  NETWORK_ENDPOINT: 0.60,
  USER: 0.75,
};

// State severity multiplier
const STATE_SEVERITY_BOOST: Record<NodeSecurityState, number> = {
  IMPACTED: 0.3,
  COMPROMISED: 0.2,
  LATERAL_MOVEMENT_SOURCE: 0.25,
  SUSPICIOUS: 0.1,
  NORMAL: 0.0,
};

/**
 * Normalizes an array of raw security events into an AttackGraph
 */
export function buildAttackGraphFromEvents(events: RawSecurityEvent[]): AttackGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, GraphEdge[]>();
  const reverseAdjacency = new Map<string, GraphEdge[]>();

  if (events.length === 0) {
    return {
      nodes: [],
      edges: [],
      nodeMap,
      adjacency,
      reverseAdjacency,
    };
  }

  // Calculate min and max timestamps for time normalization
  const timestamps = events.map((e) => e.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeSpan = maxTime === minTime ? 1 : maxTime - minTime;

  // Process all events and extract nodes
  events.forEach((evt, idx) => {
    // 1. Process Source Entity
    const src = evt.sourceEntity;
    if (!nodeMap.has(src.id)) {
      const srcState: NodeSecurityState = src.state || 'COMPROMISED';
      const baseApi = TYPE_API_BASE[src.type] || 0.5;
      const apiScore = Math.min(1.0, baseApi + STATE_SEVERITY_BOOST[srcState]);

      nodeMap.set(src.id, {
        id: src.id,
        label: src.label,
        type: src.type,
        state: srcState,
        zone: src.zone,
        stage: evt.stage,
        timestamp: evt.timestamp,
        apiScore,
        properties: { ...src.properties },
      });
    }

    // 2. Process Target Entity
    const tgt = evt.targetEntity;
    if (!nodeMap.has(tgt.id)) {
      const tgtState: NodeSecurityState = tgt.state || (evt.stage === 'IMPACT' ? 'IMPACTED' : 'COMPROMISED');
      const baseApi = TYPE_API_BASE[tgt.type] || 0.5;
      const apiScore = Math.min(1.0, baseApi + STATE_SEVERITY_BOOST[tgtState]);

      nodeMap.set(tgt.id, {
        id: tgt.id,
        label: tgt.label,
        type: tgt.type,
        state: tgtState,
        zone: tgt.zone,
        stage: evt.stage,
        timestamp: evt.timestamp,
        apiScore,
        properties: { ...tgt.properties },
      });
    } else {
      // Update target state if later stage or higher severity
      const existing = nodeMap.get(tgt.id)!;
      if (tgt.state && tgt.state === 'IMPACTED') {
        existing.state = 'IMPACTED';
      }
    }

    // 3. Process Edge
    const edgeWeight = confidenceToWeight(evt.confidence);
    const edge: GraphEdge = {
      id: evt.id || `edge-${idx}-${src.id}-${tgt.id}`,
      source: src.id,
      target: tgt.id,
      type: evt.relationshipType,
      timestamp: evt.timestamp,
      confidence: evt.confidence,
      weight: edgeWeight,
      description: evt.description,
      mitreTactic: evt.mitreTactic,
      mitreTechnique: evt.mitreTechnique,
      properties: {
        severity: evt.severity,
        sourceSystem: evt.sourceSystem,
        timestampStr: evt.timestampStr,
      },
    };

    edges.push(edge);

    // Populate adjacency lists
    const outList = adjacency.get(src.id) || [];
    outList.push(edge);
    adjacency.set(src.id, outList);

    const inList = reverseAdjacency.get(tgt.id) || [];
    inList.push(edge);
    reverseAdjacency.set(tgt.id, inList);
  });

  const nodes = Array.from(nodeMap.values());

  // Compute deterministic semantic 3D coordinates and initial 2D layout
  const zoneCounts: Record<string, number> = {};

  nodes.forEach((node, idx) => {
    // 3D Coordinates:
    // X = Network Zone (with small spread based on count)
    const baseZoneX = ZONE_X_MAP[node.zone] ?? 0;
    const countInZone = zoneCounts[node.zone] || 0;
    zoneCounts[node.zone] = countInZone + 1;
    const xSpread = ((countInZone % 4) - 1.5) * 4.5;
    const x3d = baseZoneX + xSpread;

    // Y = Attack Lifecycle Stage (with minor offset)
    const baseY = STAGE_Y_MAP[node.stage] ?? 0;
    const yOffset = ((idx % 3) - 1) * 3.0;
    const y3d = baseY + yOffset;

    // Z = Chronological Event Time (normalized -30 to 30)
    const normalizedTime = (node.timestamp - minTime) / timeSpan; // 0.0 to 1.0
    const z3d = -30 + normalizedTime * 60;

    node.x3d = parseFloat(x3d.toFixed(2));
    node.y3d = parseFloat(y3d.toFixed(2));
    node.z3d = parseFloat(z3d.toFixed(2));

    // 2D Initial Coordinates (Hierarchical baseline)
    const x2d = (baseZoneX + 40) * 12 + xSpread * 8;
    const y2d = (30 - baseY) * 14 + yOffset * 8;
    node.x2d = x2d;
    node.y2d = y2d;
  });

  return {
    nodes,
    edges,
    nodeMap,
    adjacency,
    reverseAdjacency,
  };
}
