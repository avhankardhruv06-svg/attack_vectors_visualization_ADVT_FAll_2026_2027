// Header Component with Incident HUD, View Modes, and Theme Controls
import React from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { ViewMode, ThemeMode } from '../../graph/types';
import {
  ShieldAlert,
  Layers,
  Box,
  Columns,
  Palette,
  RotateCcw,
  Activity,
  Share2,
  Cpu,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    theme,
    setTheme,
    filteredGraph,
    clusteringMode,
    setClusteringMode,
    reverseTraversal,
    clearReverseTraversal,
  } = useGraphStore();

  const totalNodes = filteredGraph.nodes.length;
  const totalEdges = filteredGraph.edges.length;
  const compromisedCount = filteredGraph.nodes.filter(
    (n) => n.state === 'COMPROMISED' || n.state === 'IMPACTED'
  ).length;

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 select-none shrink-0 z-20">
      {/* Left: Incident Branding & High-Level HUD */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <ShieldAlert size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100 tracking-wide">CYBER-VIS</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                INC-2026-RANSOMWARE-ALPHA
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Synchronized 2D/3D Reverse Attack-Path Investigation Engine
            </div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400">Entities:</span>
            <span className="text-cyan-400 font-bold">{totalNodes}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400">Relationships:</span>
            <span className="text-cyan-400 font-bold">{totalEdges}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400">Compromised:</span>
            <span className="text-rose-400 font-bold">{compromisedCount}</span>
          </div>
        </div>
      </div>

      {/* Center: View Mode Switcher (2D / 3D / Split) */}
      <div className="flex items-center bg-slate-950/90 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setViewMode('2D')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
            viewMode === '2D'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>2D View</span>
        </button>
        <button
          onClick={() => setViewMode('SPLIT')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
            viewMode === 'SPLIT'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Columns size={14} />
          <span>Split View</span>
        </button>
        <button
          onClick={() => setViewMode('3D')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
            viewMode === '3D'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box size={14} />
          <span>3D Space</span>
        </button>
      </div>

      {/* Right: Clustering Mode, Theme & Reset */}
      <div className="flex items-center gap-2">
        {/* Structural vs Categorical Clustering */}
        <button
          onClick={() =>
            setClusteringMode(
              clusteringMode === 'CATEGORICAL' ? 'STRUCTURAL' : 'CATEGORICAL'
            )
          }
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-950 border border-slate-800 rounded hover:border-slate-700 transition"
          title="Toggle Louvain Structural Clustering vs Categorical Grouping"
        >
          <Share2 size={13} className="text-amber-400" />
          <span>{clusteringMode === 'STRUCTURAL' ? 'Louvain Clusters' : 'Zone Groups'}</span>
        </button>

        {/* Theme Selector */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
          {(['DARK_ANALYST', 'TACTICAL_HUD', 'MONOCHROME_HIGH_CONTRAST'] as ThemeMode[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition ${
                  theme === t
                    ? 'bg-slate-800 text-cyan-300 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Theme: ${t}`}
              >
                {t === 'DARK_ANALYST' ? 'Dark' : t === 'TACTICAL_HUD' ? 'HUD' : 'Mono'}
              </button>
            )
          )}
        </div>

        {/* Clear Traversal if active */}
        {reverseTraversal.results.length > 0 && (
          <button
            onClick={clearReverseTraversal}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded transition"
            title="Clear Reverse Path Highlights"
          >
            <RotateCcw size={13} />
            <span>Clear Trace</span>
          </button>
        )}
      </div>
    </header>
  );
};
