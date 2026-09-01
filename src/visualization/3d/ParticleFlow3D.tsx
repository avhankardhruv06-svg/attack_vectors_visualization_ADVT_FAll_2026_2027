// 3D Dynamic Event Flow Particles traversing edges (u ∈ [0, 1])
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphStore } from '../../graph/graphStore';

export const ParticleFlow3D: React.FC = () => {
  const { filteredGraph, showParticles, reverseTraversal } = useGraphStore();
  const particleGroupRef = useRef<THREE.Group | null>(null);

  const activePath = reverseTraversal.results[reverseTraversal.activePathIndex];
  const activeEdgeIds = useMemo(() => new Set(activePath?.edgeIds || []), [activePath]);
  const isTracing = reverseTraversal.results.length > 0;

  // Build list of active curves for particle traversal
  const curves = useMemo(() => {
    if (!showParticles) return [];

    return filteredGraph.edges
      .map((edge) => {
        const src = filteredGraph.nodeMap.get(edge.source);
        const tgt = filteredGraph.nodeMap.get(edge.target);
        if (!src || !tgt) return null;

        const p1 = new THREE.Vector3(src.x3d ?? 0, src.y3d ?? 0, src.z3d ?? 0);
        const p2 = new THREE.Vector3(tgt.x3d ?? 0, tgt.y3d ?? 0, tgt.z3d ?? 0);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.y += 3.5;

        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const isActivePathEdge = activeEdgeIds.has(edge.id);

        return {
          id: edge.id,
          curve,
          isActivePathEdge,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [filteredGraph, showParticles, activeEdgeIds]);

  // Mesh references for particle instances
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  useFrame(({ clock }) => {
    if (!showParticles) return;
    const time = clock.getElapsedTime();

    curves.forEach((c) => {
      const mesh = meshRefs.current.get(c.id);
      if (!mesh) return;

      // Speed multiplier
      const speed = c.isActivePathEdge ? 0.7 : 0.4;
      // Progress u in [0, 1]
      const rawU = (time * speed) % 1;

      // If active path edge, travel backward from target to source (reverse flow)
      const u = c.isActivePathEdge ? 1.0 - rawU : rawU;
      const pos = c.curve.getPoint(u);

      mesh.position.copy(pos);
    });
  });

  if (!showParticles) return null;

  return (
    <group ref={particleGroupRef}>
      {curves.map((c) => {
        const isPath = c.isActivePathEdge;
        // Dim or skip non-path particles during reverse trace
        if (isTracing && !isPath) return null;

        return (
          <mesh
            key={`part-${c.id}`}
            ref={(el) => {
              if (el) meshRefs.current.set(c.id, el);
              else meshRefs.current.delete(c.id);
            }}
          >
            <sphereGeometry args={[isPath ? 0.65 : 0.4, 12, 12]} />
            <meshBasicMaterial
              color={isPath ? '#fbbf24' : '#38bdf8'}
              transparent
              opacity={isPath ? 0.95 : 0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
};
