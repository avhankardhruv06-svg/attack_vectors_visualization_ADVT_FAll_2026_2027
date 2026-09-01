// Investigation Inspector Panel Component
import React from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { getNeighbors } from '../../graph/graphUtils';
import { ReversePathCard } from './ReversePathCard';
import { PathStepVisualizer } from './PathStepVisualizer';
import {
  ENTITY_COLORS,
  STATE_COLORS,
  STAGE_LABELS,
  ZONE_LABELS,
} from '../../visualization/theme/themeManager';
import {
  ShieldAlert,
  Compass,
  Crosshair,
  Server,
  Zap,
  Activity,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface InvestigationPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const InvestigationPanel: React.FC<InvestigationPanelProps> = ({ isOpen, onToggle }) => {
  const {
    selectedNodeId,
    masterGraph,
    selectNode,
    traceAttackOrigin,
    reverseTraversal,
    doiMap,
  } = useGraphStore();

  const selectedNode = selectedNodeId ? masterGraph.nodeMap.get(selectedNodeId) : null;
  const isTracing = reverseTraversal.results.length > 0;

  // Neighbors of selected node
  const neighbors = selectedNode ? getNeighbors(selectedNode.id, masterGraph) : null;
  const doiScore = selectedNode ? doiMap.get(selectedNode.id) ?? 0.5 : 0.5;

  return (
    <aside
      className={`relative bg-slate-900/95 border-l border-slate-800 flex flex-col shrink-0 transition-all duration-300 z-10 select-none ${
        isOpen ? 'w-80 md:w-96' : 'w-0 overflow-hidden'
      }`}
    >
      {/* Panel Header */}
      <div className="h-12 border-b border-slate-800 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-mono">
          <Compass size={15} className="text-amber-400" />
          <span>INVESTIGATION CONSOLE</span>
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* 1. If Reverse Traversal results exist, show Top-K Paths & Stepper */}
        {isTracing && (
          <div className="space-y-3 pb-3 border-b border-slate-800">
            <ReversePathCard />
            <PathStepVisualizer />
          </div>
        )}

        {/* 2. Selected Entity Inspector */}
        {selectedNode ? (
          <div className="space-y-3.5">
            {/* Entity Header Banner */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: `${ENTITY_COLORS[selectedNode.type]}20`,
                    color: ENTITY_COLORS[selectedNode.type],
                    border: `1px solid ${ENTITY_COLORS[selectedNode.type]}40`,
                  }}
                >
                  {selectedNode.type}
                </span>

                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                  style={{
                    backgroundColor: `${STATE_COLORS[selectedNode.state]}20`,
                    color: STATE_COLORS[selectedNode.state],
                    border: `1px solid ${STATE_COLORS[selectedNode.state]}40`,
                  }}
                >
                  {selectedNode.state}
                </span>
              </div>

              <div className="text-sm font-bold text-slate-100 font-mono break-all">
                {selectedNode.label}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono border-t border-slate-800/80">
                <div>
                  <div className="text-slate-500 text-[9px]">ZONE:</div>
                  <div className="text-cyan-300 font-bold truncate">
                    {ZONE_LABELS[selectedNode.zone]}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px]">STAGE:</div>
                  <div className="text-amber-300 font-bold truncate">
                    {STAGE_LABELS[selectedNode.stage]}
                  </div>
                </div>
              </div>

              {/* DOI Gauge */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-400">DEGREE OF INTEREST (DOI):</span>
                  <span className="text-cyan-400 font-bold">{(doiScore * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${doiScore * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* PRIMARY ACTION: Trace Attack Origin Button */}
            <button
              onClick={() => traceAttackOrigin(selectedNode.id, 3)}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-bold font-mono text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
            >
              <Zap size={16} />
              <span>TRACE ATTACK ORIGIN (REVERSE)</span>
            </button>

            {/* Forensic Properties Table */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                <FileText size={13} className="text-cyan-400" />
                <span>FORENSIC ARTIFACT PROPERTIES</span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                {Object.entries(selectedNode.properties).map(([key, val]) => {
                  if (typeof val === 'object') return null;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between py-1 border-b border-slate-800/50"
                    >
                      <span className="text-slate-500 text-[10px] uppercase">{key}:</span>
                      <span className="text-slate-300 text-right font-medium max-w-[200px] break-all">
                        {String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connected Graph Neighborhood */}
            {neighbors && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                  <Activity size={13} className="text-cyan-400" />
                  <span>CONNECTED RELATIONSHIPS ({neighbors.all.length})</span>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {neighbors.all.map((neighbor) => (
                    <button
                      key={neighbor.id}
                      onClick={() => selectNode(neighbor.id)}
                      className="w-full flex items-center justify-between p-1.5 rounded hover:bg-slate-800 text-left transition"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: ENTITY_COLORS[neighbor.type] }}
                        />
                        <span className="text-slate-200 font-mono truncate">
                          {neighbor.label}
                        </span>
                      </div>
                      <ChevronRight size={13} className="text-slate-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty Selection State */
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center space-y-3">
            <Crosshair size={28} className="mx-auto text-slate-600" />
            <div className="text-xs font-bold text-slate-300 font-mono">
              NO ASSET SELECTED
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Click on any node in the 2D or 3D graph, or select an impacted target asset
              below to reconstruct preceding attack vectors.
            </p>

            {/* Quick Demo Launch Button */}
            <button
              onClick={() => {
                selectNode('HOST-FILE-SERVER-01');
                traceAttackOrigin('HOST-FILE-SERVER-01', 3);
              }}
              className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md font-mono text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Zap size={14} />
              <span>Trace FILE-SERVER-01 (Demo)</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
