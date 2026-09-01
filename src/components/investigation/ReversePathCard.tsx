// Top-K Candidate Attack Path Card Breakdown
import React from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { ReversePathResult } from '../../graph/types';
import { getConfidenceTier } from '../../graph/confidence';
import { ArrowRight, ShieldAlert, Zap, Layers, Award } from 'lucide-react';

export const ReversePathCard: React.FC = () => {
  const { reverseTraversal, selectReversePath, masterGraph } = useGraphStore();
  const { results, activePathIndex } = reverseTraversal;

  if (results.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span className="flex items-center gap-1.5 font-bold">
          <Award size={14} className="text-amber-400" />
          <span>TOP-K CANDIDATE REVERSE PATHS ({results.length})</span>
        </span>
        <span className="text-[10px] text-slate-500">Yen's Loopless Algorithm</span>
      </div>

      <div className="space-y-2">
        {results.map((path: ReversePathResult, idx: number) => {
          const isActive = activePathIndex === idx;
          const originNode = masterGraph.nodeMap.get(path.originNodeId);
          const targetNode = masterGraph.nodeMap.get(path.targetNodeId);
          const confTier = getConfidenceTier(path.pathConfidence);

          let rankBadgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
          let borderHighlight = 'border-slate-800';

          if (path.rank === 1) {
            rankBadgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            borderHighlight = isActive ? 'border-amber-500 shadow-lg shadow-amber-950/30' : 'border-slate-800';
          } else if (path.rank === 2) {
            rankBadgeBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
            borderHighlight = isActive ? 'border-cyan-500' : 'border-slate-800';
          } else if (path.rank === 3) {
            rankBadgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
            borderHighlight = isActive ? 'border-purple-500' : 'border-slate-800';
          }

          return (
            <div
              key={idx}
              onClick={() => selectReversePath(idx)}
              className={`p-3 rounded-lg border bg-slate-950/90 cursor-pointer transition-all ${borderHighlight} ${
                isActive ? 'bg-slate-900 ring-1 ring-amber-500/50' : 'hover:border-slate-700'
              }`}
            >
              {/* Header: Rank + Path Confidence */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${rankBadgeBg}`}
                  >
                    RANK {path.rank} {path.rank === 1 ? '(PRIMARY)' : '(ALTERNATIVE)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400">Confidence:</span>
                  <span
                    className="font-bold"
                    style={{ color: confTier.color }}
                  >
                    {(path.pathConfidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Traversal Summary: Origin -> Target */}
              <div className="flex items-center gap-2 text-xs font-mono mb-2">
                <div className="truncate text-rose-400 font-bold max-w-[120px]">
                  {originNode?.label || path.originNodeId}
                </div>
                <ArrowRight size={13} className="text-slate-500 shrink-0" />
                <div className="truncate text-amber-300 font-bold max-w-[120px]">
                  {targetNode?.label || path.targetNodeId}
                </div>
              </div>

              {/* Metrics: Hop Count, Path Cost, Bottlenecks */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                <div>
                  Hops: <span className="text-slate-200 font-bold">{path.hopCount}</span>
                </div>
                <div>
                  Cost: <span className="text-slate-200 font-bold">{path.totalCost.toFixed(3)}</span>
                </div>
                <div>
                  Bottlenecks:{' '}
                  <span className="text-amber-400 font-bold">
                    {path.criticalCutVertices.length}
                  </span>
                </div>
              </div>

              {/* Critical Bottlenecks Warning */}
              {path.criticalCutVertices.length > 0 && (
                <div className="mt-2 text-[10px] text-amber-400/90 flex items-center gap-1 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/40 font-mono">
                  <Zap size={11} className="shrink-0" />
                  <span className="truncate">
                    Critical Cut-Vertex: {path.criticalCutVertices.join(', ')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
