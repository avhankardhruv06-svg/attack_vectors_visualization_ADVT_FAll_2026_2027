// 3D Smooth Camera Controller & Focus Tracking
import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGraphStore } from '../../graph/graphStore';

export const CameraController3D: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPosRef = useRef<THREE.Vector3 | null>(null);

  const { focusedNodeId, filteredGraph } = useGraphStore();

  useEffect(() => {
    if (focusedNodeId) {
      const node = filteredGraph.nodeMap.get(focusedNodeId);
      if (node && node.x3d !== undefined && node.y3d !== undefined && node.z3d !== undefined) {
        targetPosRef.current = new THREE.Vector3(node.x3d, node.y3d, node.z3d);
      }
    }
  }, [focusedNodeId, filteredGraph]);

  useFrame(() => {
    if (targetPosRef.current && controlsRef.current) {
      // Smoothly interpolate orbit control target toward focused node
      controlsRef.current.target.lerp(targetPosRef.current, 0.08);
      controlsRef.current.update();

      // Clear once sufficiently close
      if (controlsRef.current.target.distanceTo(targetPosRef.current) < 0.2) {
        targetPosRef.current = null;
      }
    }
  });

  return (
    <DreiOrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={15}
      maxDistance={220}
      maxPolarAngle={Math.PI / 2 + 0.15}
    />
  );
};
