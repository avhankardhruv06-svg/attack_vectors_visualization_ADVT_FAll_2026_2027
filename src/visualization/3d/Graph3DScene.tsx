// 3D Scene Viewport using Three.js & React Three Fiber
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { SemanticAxes3D } from './SemanticAxes3D';
import { InstancedNodes3D } from './InstancedNodes3D';
import { CurvedEdges3D } from './CurvedEdges3D';
import { ParticleFlow3D } from './ParticleFlow3D';
import { CameraController3D } from './CameraController3D';
import { useGraphStore } from '../../graph/graphStore';
import { THEMES } from '../theme/themeManager';
import { Box, Sparkles, Activity, Layers } from 'lucide-react';

export const Graph3DScene: React.FC = () => {
  const { theme, showParticles, toggleParticles, semanticZoomLevel, setSemanticZoomLevel } = useGraphStore();
  const themeConfig = THEMES[theme];

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      <Canvas
        camera={{ position: [0, 25, 85], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: themeConfig.background }}
      >
        <color attach="background" args={[themeConfig.background]} />
        <fog attach="fog" args={[themeConfig.background, 60, 250]} />

        {/* Dynamic Studio Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[30, 50, 40]} intensity={1.2} />
        <pointLight position={[-40, 20, -30]} intensity={0.8} color="#0ea5e9" />
        <pointLight position={[40, -10, 30]} intensity={0.8} color="#f59e0b" />

        <Suspense fallback={null}>
          <SemanticAxes3D />
          <CurvedEdges3D />
          <ParticleFlow3D />
          <InstancedNodes3D />
          <CameraController3D />
        </Suspense>
      </Canvas>

      {/* Floating 3D Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg p-1.5 shadow-xl z-10">
        <button
          onClick={toggleParticles}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition ${
            showParticles
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle Event Flow Particles"
        >
          <Sparkles size={14} />
          <span>Flow Particles: {showParticles ? 'ON' : 'OFF'}</span>
        </button>

        <div className="w-px h-4 bg-slate-700 mx-1" />

        {/* Semantic Zoom Level Selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-800">
          {(['NETWORK', 'HOST', 'EVENT'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSemanticZoomLevel(lvl)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition ${
                semanticZoomLevel === lvl
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Semantic Axis Explanatory Badge */}
      <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2.5 shadow-xl pointer-events-none z-10">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1.5 font-bold">
          <Box size={14} />
          <span>3D SEMANTIC COORDINATE SPACE</span>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-4 h-4 rounded bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-[9px] text-cyan-300 font-bold">
              X
            </span>
            <span className="text-slate-400">WHERE:</span>
            <span className="text-cyan-300">Network Zone (DMZ → DC)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-4 h-4 rounded bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-[9px] text-amber-300 font-bold">
              Y
            </span>
            <span className="text-slate-400">STAGE:</span>
            <span className="text-amber-300">Lifecycle (Access → Impact)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-4 h-4 rounded bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-[9px] text-emerald-300 font-bold">
              Z
            </span>
            <span className="text-slate-400">WHEN:</span>
            <span className="text-emerald-300">Chronological Event Time</span>
          </div>
        </div>
      </div>
    </div>
  );
};
