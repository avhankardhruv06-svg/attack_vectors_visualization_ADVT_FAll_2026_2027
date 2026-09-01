// 3D Semantic Coordinate Planes & Axis Labels
// X = Network Zone (WHERE)
// Y = Attack Lifecycle Stage (WHICH STAGE)
// Z = Event Time (WHEN)
import React from 'react';
import { Html } from '@react-three/drei';
import { ZONE_X_MAP, STAGE_Y_MAP } from '../../graph/graphBuilder';
import { NetworkZone, AttackStage } from '../../graph/types';
import { ZONE_LABELS, STAGE_LABELS } from '../theme/themeManager';

export const SemanticAxes3D: React.FC = () => {
  const zones: NetworkZone[] = [
    'EXTERNAL_INTERNET',
    'DMZ',
    'CORP_WORKSTATION',
    'INTERNAL_SERVERS',
    'CRITICAL_DATA_CENTER',
  ];

  const stages: AttackStage[] = [
    'INITIAL_ACCESS',
    'EXECUTION',
    'CREDENTIAL_ACCESS',
    'LATERAL_MOVEMENT',
    'COLLECTION_EXFIL',
    'IMPACT',
  ];

  return (
    <group>
      {/* 3D Grid Plane for Spatial Context (Base Floor) */}
      <gridHelper
        args={[90, 30, '#1e293b', '#0f172a']}
        position={[0, -32, 0]}
      />

      {/* Vertical Reference Wall */}
      <gridHelper
        args={[90, 20, '#1e293b', '#0c1524']}
        position={[0, 0, -35]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* --- X-AXIS: NETWORK ZONE MARKERS (WHERE) --- */}
      {zones.map((zone) => {
        const x = ZONE_X_MAP[zone];
        return (
          <group key={`zone-${zone}`} position={[x, -31, 0]}>
            {/* Guide strip along Z axis for each zone */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.3, 0.1, 64]} />
              <meshBasicMaterial color="#334155" transparent opacity={0.3} />
            </mesh>

            {/* Label Billboard */}
            <Html position={[0, 1.5, 34]} center distanceFactor={45}>
              <div className="bg-slate-900/90 border border-slate-700/70 rounded px-2 py-0.5 text-[10px] font-mono text-cyan-300 shadow-lg whitespace-nowrap pointer-events-none select-none">
                {ZONE_LABELS[zone]}
              </div>
            </Html>
          </group>
        );
      })}

      {/* --- Y-AXIS: ATTACK LIFECYCLE STAGE MARKERS (WHICH STAGE) --- */}
      {stages.map((stage) => {
        const y = STAGE_Y_MAP[stage];
        return (
          <group key={`stage-${stage}`} position={[-46, y, -32]}>
            {/* Horizontal guide strip along X axis */}
            <mesh position={[46, 0, 0]}>
              <boxGeometry args={[92, 0.2, 0.2]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.4} />
            </mesh>

            {/* Stage Label Billboard */}
            <Html position={[-2, 0, 0]} center distanceFactor={45}>
              <div className="bg-slate-900/90 border border-amber-600/50 rounded px-2 py-0.5 text-[10px] font-mono text-amber-300 shadow-lg whitespace-nowrap pointer-events-none select-none">
                {STAGE_LABELS[stage]}
              </div>
            </Html>
          </group>
        );
      })}

      {/* --- Z-AXIS: EVENT TIME ARROWS (WHEN) --- */}
      <group position={[48, -30, 0]}>
        <Html position={[0, 2, -28]} center distanceFactor={40}>
          <div className="bg-slate-950 border border-emerald-500/50 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded shadow">
            TIME T₀ (Incident Start)
          </div>
        </Html>
        <Html position={[0, 2, 28]} center distanceFactor={40}>
          <div className="bg-slate-950 border border-rose-500/50 text-rose-400 font-mono text-[9px] px-1.5 py-0.5 rounded shadow">
            TIME T_FINAL (Detonation)
          </div>
        </Html>
      </group>
    </group>
  );
};
