// Raw Security Event Schema for Ingestion and Normalization
import { EntityType, NetworkZone, AttackStage, EdgeType, NodeSecurityState } from '../graph/types';

export interface RawSecurityEvent {
  id: string;
  timestamp: number; // Unix timestamp in seconds or epoch ms
  timestampStr: string; // ISO / HH:MM:SS format
  sourceEntity: {
    id: string;
    label: string;
    type: EntityType;
    zone: NetworkZone;
    state?: NodeSecurityState;
    properties?: Record<string, any>;
  };
  targetEntity: {
    id: string;
    label: string;
    type: EntityType;
    zone: NetworkZone;
    state?: NodeSecurityState;
    properties?: Record<string, any>;
  };
  relationshipType: EdgeType;
  stage: AttackStage;
  confidence: number; // 0.0 to 1.0
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceSystem: string;
  description: string;
  mitreTactic: string;
  mitreTechnique: string;
}
