// 2D Layout Computations: Force-Directed and Hierarchical Stage Layouts
import * as d3 from 'd3';
import { GraphNode, GraphEdge, AttackStage, NetworkZone, Layout2DMode } from '../../graph/types';

const STAGE_ORDER: Record<AttackStage, number> = {
  INITIAL_ACCESS: 0,
  EXECUTION: 1,
  CREDENTIAL_ACCESS: 2,
  LATERAL_MOVEMENT: 3,
  COLLECTION_EXFIL: 4,
  IMPACT: 5,
};

const ZONE_ORDER: Record<NetworkZone, number> = {
  EXTERNAL_INTERNET: 0,
  DMZ: 1,
  CORP_WORKSTATION: 2,
  INTERNAL_SERVERS: 3,
  CRITICAL_DATA_CENTER: 4,
};

/**
 * Calculates Hierarchical 2D coordinates arranged by Attack Stage (X) and Network Zone (Y)
 */
export function computeHierarchicalLayout(
  nodes: GraphNode[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const stageGroups: Record<AttackStage, GraphNode[]> = {
    INITIAL_ACCESS: [],
    EXECUTION: [],
    CREDENTIAL_ACCESS: [],
    LATERAL_MOVEMENT: [],
    COLLECTION_EXFIL: [],
    IMPACT: [],
  };

  nodes.forEach((n) => {
    stageGroups[n.stage].push(n);
  });

  const stages: AttackStage[] = [
    'INITIAL_ACCESS',
    'EXECUTION',
    'CREDENTIAL_ACCESS',
    'LATERAL_MOVEMENT',
    'COLLECTION_EXFIL',
    'IMPACT',
  ];

  const colWidth = (width - 160) / stages.length;
  const startX = 80 + colWidth / 2;

  stages.forEach((stage, stageIdx) => {
    const group = stageGroups[stage];
    // Sort nodes in column by zone order
    group.sort((a, b) => ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone]);

    const count = group.length;
    const x = startX + stageIdx * colWidth;

    group.forEach((node, nodeIdx) => {
      const rowSpacing = Math.min(100, (height - 120) / Math.max(1, count));
      const yStart = (height - (count - 1) * rowSpacing) / 2;
      const y = yStart + nodeIdx * rowSpacing;

      positions.set(node.id, { x, y });
    });
  });

  return positions;
}

/**
 * Runs D3 Force simulation on 2D nodes and edges
 */
export function runForceLayout2D(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  onTick: (nodes: GraphNode[]) => void
): d3.Simulation<GraphNode, GraphEdge> {
  const d3Nodes = nodes.map((d) => ({ ...d }));
  const d3Edges = edges.map((e) => ({
    ...e,
    source: e.source,
    target: e.target,
  }));

  const simulation = d3
    .forceSimulation<GraphNode>(d3Nodes)
    .force(
      'link',
      d3
        .forceLink<GraphNode, any>(d3Edges)
        .id((d) => d.id)
        .distance((d) => 80 + (1.0 - (d.confidence || 0.5)) * 60)
        .strength(0.6)
    )
    .force('charge', d3.forceManyBody().strength(-350))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(35))
    .alphaDecay(0.04)
    .on('tick', () => {
      onTick(d3Nodes);
    });

  return simulation;
}
