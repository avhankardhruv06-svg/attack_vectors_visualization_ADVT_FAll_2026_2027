// 3D Curved Edge Connections with Reverse Path Highlighting
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGraphStore } from '../../graph/graphStore';
import { THEMES } from '../theme/themeManager';

export const CurvedEdges3D: React.FC = () => {
  const { filteredGraph, reverseTraversal, theme } = useGraphStore();
  const themeConfig = THEMES[theme];

  const rank1 = reverseTraversal.results[0];
  const rank2 = reverseTraversal.results[1];
  const rank3 = reverseTraversal.results[2];

  const rank1EdgeSet = useMemo(() => new Set(rank1?.edgeIds || []), [rank1]);
  const rank2EdgeSet = useMemo(() => new Set(rank2?.edgeIds || []), [rank2]);
  const rank3EdgeSet = useMemo(() => new Set(rank3?.edgeIds || []), [rank3]);

  const isTracingActive = reverseTraversal.results.length > 0;

  // Build curve geometries and line objects
  const edgeCurves = useMemo(() => {
    return filteredGraph.edges
      .map((edge) => {
        const src = filteredGraph.nodeMap.get(edge.source);
        const tgt = filteredGraph.nodeMap.get(edge.target);
        if (!src || !tgt) return null;

        const p1 = new THREE.Vector3(src.x3d ?? 0, src.y3d ?? 0, src.z3d ?? 0);
        const p2 = new THREE.Vector3(tgt.x3d ?? 0, tgt.y3d ?? 0, tgt.z3d ?? 0);

        // Control point: mid-point raised along Y / perpendicular vector for 3D arch
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.y += 3.5;

        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const points = curve.getPoints(24);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const isRank1 = rank1EdgeSet.has(edge.id);
        const isRank2 = rank2EdgeSet.has(edge.id);
        const isRank3 = rank3EdgeSet.has(edge.id);

        let color = themeConfig.edgeDefault;
        let lineWidth = 1.0;
        let opacity = 0.35;

        if (isTracingActive) {
          if (isRank1) {
            color = themeConfig.rank1Path;
            lineWidth = 3.0;
            opacity = 1.0;
          } else if (isRank2) {
            color = themeConfig.rank2Path;
            lineWidth = 2.0;
            opacity = 0.75;
          } else if (isRank3) {
            color = themeConfig.rank3Path;
            lineWidth = 1.5;
            opacity = 0.55;
          } else {
            opacity = 0.08; // Dim background
          }
        }

        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity,
          linewidth: lineWidth,
        });

        const lineObject = new THREE.Line(geometry, material);

        return {
          id: edge.id,
          lineObject,
          color,
          opacity,
          p2,
          mid,
          isRank1,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [filteredGraph, rank1EdgeSet, rank2EdgeSet, rank3EdgeSet, isTracingActive, themeConfig]);

  return (
    <group>
      {edgeCurves.map((curveData) => (
        <group key={`edge-3d-${curveData.id}`}>
          {/* Main 3D Curve Line Primitive */}
          <primitive object={curveData.lineObject} />

          {/* Directional Indicator Cone near target */}
          <mesh
            position={[
              curveData.p2.x - (curveData.p2.x - curveData.mid.x) * 0.25,
              curveData.p2.y - (curveData.p2.y - curveData.mid.y) * 0.25,
              curveData.p2.z - (curveData.p2.z - curveData.mid.z) * 0.25,
            ]}
          >
            <coneGeometry args={[0.5, 1.2, 8]} />
            <meshBasicMaterial
              color={curveData.color}
              transparent
              opacity={curveData.opacity}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};
