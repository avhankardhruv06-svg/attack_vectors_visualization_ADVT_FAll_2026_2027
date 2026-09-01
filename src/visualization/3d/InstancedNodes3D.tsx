// 3D Node Mesh Renderer with Security States & Semantic Coordinates
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '../../graph/graphStore';
import { GraphNode } from '../../graph/types';
import { ENTITY_COLORS, STATE_COLORS } from '../theme/themeManager';

export const InstancedNodes3D: React.FC = () => {
  const {
    filteredGraph,
    selectedNodeId,
    hoveredNodeId,
    selectNode,
    hoverNode,
    reverseTraversal,
    doiMap,
  } = useGraphStore();

  const pulseRef = useRef<number>(0);
  const glowMeshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // Active reverse path nodes
  const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
  const activeNodeSet = new Set(activePath?.nodeIds || []);
  const bottleneckSet = new Set(activePath?.criticalCutVertices || []);
  const isTracingActive = reverseTraversal.results.length > 0;

  useFrame((_, delta) => {
    pulseRef.current += delta * 3;
    glowMeshRefs.current.forEach((mesh, id) => {
      const isSelected = selectedNodeId === id;
      const node = filteredGraph.nodeMap.get(id);
      const isImpacted = node?.state === 'IMPACTED';

      if (mesh && (isSelected || isImpacted)) {
        const scale = 1.0 + Math.sin(pulseRef.current) * 0.15;
        mesh.scale.set(scale, scale, scale);
      }
    });
  });

  return (
    <group>
      {filteredGraph.nodes.map((node: GraphNode) => {
        const x = node.x3d ?? 0;
        const y = node.y3d ?? 0;
        const z = node.z3d ?? 0;

        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeId === node.id;
        const isInPath = activeNodeSet.has(node.id);
        const isBottleneck = bottleneckSet.has(node.id);
        const doi = doiMap.get(node.id) ?? 0.5;

        const entityColor = ENTITY_COLORS[node.type] || '#38bdf8';
        const stateColor = STATE_COLORS[node.state] || '#64748b';

        // Scale & Opacity
        let baseScale = 1.0;
        if (isSelected) baseScale = 1.5;
        else if (isHovered) baseScale = 1.3;
        else if (node.type === 'HOST' || node.type === 'ATTACKER') baseScale = 1.2;

        let opacity = isTracingActive
          ? isInPath
            ? 1.0
            : Math.max(0.18, doi * 0.35)
          : Math.max(0.3, doi);

        return (
          <group key={`node-3d-${node.id}`} position={[x, y, z]}>
            {/* Clickable Core Node Mesh */}
            <mesh
              scale={[baseScale, baseScale, baseScale]}
              onClick={(e) => {
                e.stopPropagation();
                selectNode(node.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hoverNode(node.id);
              }}
              onPointerOut={() => {
                hoverNode(null);
              }}
            >
              {/* Distinct 3D Geometries based on Entity Type */}
              {node.type === 'HOST' && <boxGeometry args={[2.2, 2.2, 2.2]} />}
              {node.type === 'ATTACKER' && <octahedronGeometry args={[2.2, 0]} />}
              {node.type === 'USER' && <sphereGeometry args={[1.5, 24, 24]} />}
              {node.type === 'PROCESS' && <cylinderGeometry args={[1.2, 1.2, 2.0, 16]} />}
              {node.type === 'CREDENTIAL' && <torusGeometry args={[1.2, 0.4, 16, 24]} />}
              {node.type === 'FILE' && <boxGeometry args={[1.8, 2.2, 0.5]} />}
              {node.type === 'NETWORK_ENDPOINT' && <icosahedronGeometry args={[1.6, 0]} />}

              <meshStandardMaterial
                color={isInPath && isTracingActive ? '#fbbf24' : entityColor}
                roughness={0.3}
                metalness={0.7}
                emissive={isSelected ? '#38bdf8' : isInPath ? '#f59e0b' : entityColor}
                emissiveIntensity={isSelected ? 0.8 : isInPath ? 0.6 : 0.2}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* Security State Halo Ring */}
            <mesh
              ref={(el) => {
                if (el) glowMeshRefs.current.set(node.id, el);
                else glowMeshRefs.current.delete(node.id);
              }}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[baseScale * 1.6, baseScale * 2.0, 32]} />
              <meshBasicMaterial
                color={stateColor}
                side={THREE.DoubleSide}
                transparent
                opacity={isSelected ? 0.9 : opacity * 0.75}
              />
            </mesh>

            {/* Selection Outline Box */}
            {isSelected && (
              <mesh>
                <boxGeometry args={[baseScale * 3.2, baseScale * 3.2, baseScale * 3.2]} />
                <meshBasicMaterial
                  color="#38bdf8"
                  wireframe
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}

            {/* HTML Label Billboard on Selected, Hovered, or Active Path */}
            {(isSelected || isHovered || isInPath) && (
              <Html
                position={[0, baseScale * 2.2 + 0.8, 0]}
                center
                distanceFactor={35}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className={`px-2.5 py-1 rounded-md text-xs font-mono select-none shadow-xl border whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-sky-950/95 border-sky-400 text-sky-200 font-bold scale-110'
                      : isInPath
                      ? 'bg-amber-950/95 border-amber-400 text-amber-200 font-bold'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isBottleneck && <span className="text-amber-400">⚡</span>}
                    <span>{node.label}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-sans mt-0.5">
                    {node.type} • <span style={{ color: stateColor }}>{node.state}</span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};
