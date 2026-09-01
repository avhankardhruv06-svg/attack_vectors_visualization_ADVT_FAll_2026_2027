// Theme and Visual Styling Definitions for 2D & 3D Projections
import { EntityType, NodeSecurityState, AttackStage, NetworkZone, ThemeMode } from '../../graph/types';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  gridLine: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  edgeDefault: string;
  edgeDimmed: string;
  edgeSelected: string;
  rank1Path: string;
  rank2Path: string;
  rank3Path: string;
}

export const THEMES: Record<ThemeMode, ThemeColors> = {
  DARK_ANALYST: {
    background: '#090d16',
    surface: '#111827',
    surfaceBorder: '#1f293d',
    gridLine: '#1e293b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    edgeDefault: '#334155',
    edgeDimmed: '#1e293b',
    edgeSelected: '#38bdf8',
    rank1Path: '#f59e0b', // Glowing Amber
    rank2Path: '#06b6d4', // Cyan
    rank3Path: '#8b5cf6', // Purple
  },
  TACTICAL_HUD: {
    background: '#040b0e',
    surface: '#08171e',
    surfaceBorder: '#0f3342',
    gridLine: '#0c2633',
    textPrimary: '#67e8f9',
    textSecondary: '#22d3ee',
    textMuted: '#155e75',
    edgeDefault: '#164e63',
    edgeDimmed: '#082f49',
    edgeSelected: '#38bdf8',
    rank1Path: '#fbbf24',
    rank2Path: '#34d399',
    rank3Path: '#818cf8',
  },
  MONOCHROME_HIGH_CONTRAST: {
    background: '#000000',
    surface: '#121212',
    surfaceBorder: '#2e2e2e',
    gridLine: '#262626',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textMuted: '#777777',
    edgeDefault: '#525252',
    edgeDimmed: '#262626',
    edgeSelected: '#ffffff',
    rank1Path: '#ffffff',
    rank2Path: '#aaaaaa',
    rank3Path: '#666666',
  },
};

export const ENTITY_COLORS: Record<EntityType, string> = {
  ATTACKER: '#ef4444',        // Red
  HOST: '#0ea5e9',            // Sky blue
  USER: '#f59e0b',            // Amber
  PROCESS: '#a855f7',         // Purple
  CREDENTIAL: '#10b981',      // Emerald
  FILE: '#f97316',            // Orange
  NETWORK_ENDPOINT: '#6366f1',// Indigo
};

export const ENTITY_ICONS: Record<EntityType, string> = {
  ATTACKER: 'Skull',
  HOST: 'Server',
  USER: 'User',
  PROCESS: 'Cpu',
  CREDENTIAL: 'Key',
  FILE: 'FileCode',
  NETWORK_ENDPOINT: 'Globe',
};

export const STATE_COLORS: Record<NodeSecurityState, string> = {
  NORMAL: '#64748b',                  // Slate
  SUSPICIOUS: '#f59e0b',              // Amber
  COMPROMISED: '#ef4444',             // Red
  LATERAL_MOVEMENT_SOURCE: '#d946ef', // Magenta
  IMPACTED: '#dc2626',                // Crimson
};

export const STAGE_LABELS: Record<AttackStage, string> = {
  INITIAL_ACCESS: 'Initial Access',
  EXECUTION: 'Execution',
  CREDENTIAL_ACCESS: 'Credential Access',
  LATERAL_MOVEMENT: 'Lateral Movement',
  COLLECTION_EXFIL: 'Collection & Exfil',
  IMPACT: 'Impact',
};

export const ZONE_LABELS: Record<NetworkZone, string> = {
  EXTERNAL_INTERNET: 'External / Internet',
  DMZ: 'DMZ Perimeter',
  CORP_WORKSTATION: 'Corporate Workstations',
  INTERNAL_SERVERS: 'Internal Servers / Core',
  CRITICAL_DATA_CENTER: 'Critical Data Center',
};
