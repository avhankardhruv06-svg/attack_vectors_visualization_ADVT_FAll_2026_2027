// Attack Graph Core Type Definitions

export type EntityType =
  | 'ATTACKER'
  | 'HOST'
  | 'USER'
  | 'PROCESS'
  | 'CREDENTIAL'
  | 'FILE'
  | 'NETWORK_ENDPOINT';

export type NodeSecurityState =
  | 'NORMAL'
  | 'SUSPICIOUS'
  | 'COMPROMISED'
  | 'LATERAL_MOVEMENT_SOURCE'
  | 'IMPACTED';

export type NetworkZone =
  | 'EXTERNAL_INTERNET'
  | 'DMZ'
  | 'CORP_WORKSTATION'
  | 'INTERNAL_SERVERS'
  | 'CRITICAL_DATA_CENTER';

export type AttackStage =
  | 'INITIAL_ACCESS'
  | 'EXECUTION'
  | 'CREDENTIAL_ACCESS'
  | 'LATERAL_MOVEMENT'
  | 'COLLECTION_EXFIL'
  | 'IMPACT';

export type EdgeType =
  | 'PHISHED'
  | 'EXPLOITED'
  | 'SPAWNED'
  | 'INJECTED'
  | 'DUMPED_CREDENTIAL'
  | 'ACCESSED'
  | 'AUTHENTICATED_AS'
  | 'REMOTE_EXECUTION'
  | 'FILE_MODIFICATION'
  | 'RANSOMWARE_ENCRYPT'
  | 'C2_BEACON'
  | 'LATERAL_PIVOT';

export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  state: NodeSecurityState;
  zone: NetworkZone;
  stage: AttackStage;
  timestamp: number; // Incident timestamp in epoch ms or relative seconds
  apiScore: number; // A-priori importance for DOI calculation (0.0 to 1.0)
  properties: {
    ip?: string;
    hostname?: string;
    username?: string;
    domain?: string;
    pid?: number;
    commandLine?: string;
    filePath?: string;
    fileHash?: string;
    cveId?: string;
    mitreTechnique?: string;
    privilege?: 'STANDARD' | 'ELEVATED' | 'SYSTEM' | 'DOMAIN_ADMIN';
    description?: string;
    [key: string]: any;
  };
  // 2D & 3D layout coordinates (assigned by layout engines)
  x2d?: number;
  y2d?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  x3d?: number;
  y3d?: number;
  z3d?: number;
  clusterId?: number;
  doiScore?: number; // Calculated dynamic Degree of Interest
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  timestamp: number;
  confidence: number; // 0 <= confidence <= 1
  weight: number;     // 1 - confidence (used for shortest path)
  description?: string;
  mitreTactic?: string;
  mitreTechnique?: string;
  properties?: Record<string, any>;
}

export interface AttackGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeMap: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;          // outgoing edges: node -> edge[]
  reverseAdjacency: Map<string, GraphEdge[]>;   // incoming edges: node -> edge[]
}

export interface PathStepDetail {
  stepNumber: number;
  fromNode: GraphNode;
  toNode: GraphNode;
  edge: GraphEdge;
  stage: AttackStage;
  timestamp: number;
  confidence: number;
  explanation: string;
}

export interface ReversePathResult {
  rank: number;
  originNodeId: string;
  targetNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  totalCost: number;
  pathConfidence: number; // Geometric or harmonic confidence product
  hopCount: number;
  criticalCutVertices: string[]; // Nodes whose removal breaks this attack chain
  steps: PathStepDetail[];
}

export interface ActiveFilterState {
  searchQuery: string;
  selectedEntityTypes: Set<EntityType>;
  selectedSecurityStates: Set<NodeSecurityState>;
  selectedZones: Set<NetworkZone>;
  selectedStages: Set<AttackStage>;
  minConfidence: number;
  maxTimestamp: number;
  minTimestamp: number;
  highlightCommunityId: number | null;
}

export type ViewMode = '2D' | '3D' | 'SPLIT';
export type Layout2DMode = 'FORCE' | 'HIERARCHICAL' | 'RADIAL';
export type ThemeMode = 'DARK_ANALYST' | 'TACTICAL_HUD' | 'MONOCHROME_HIGH_CONTRAST';
