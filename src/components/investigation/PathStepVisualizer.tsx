// Step-by-Step Reverse Path Traversal Stepper
import React from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { getConfidenceTier } from '../../graph/confidence';
import {
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  Target,
  FileSearch,
  Zap,
} from 'lucide-react';

export const PathStepVisualizer: React.FC = () => {
  const {
    reverseTraversal,
    stepReversePath,
    setReversePathStep,
  } = useGraphStore();

  const { results, activePathIndex, activeStepIndex } = reverseTraversal;
  const activePath = results[activePathIndex];

  if (!activePath || activePath.steps.length === 0) return null;

  const currentStep =
    activeStepIndex >= 0 && activeStepIndex < activePath.steps.length
      ? activePath.steps[activeStepIndex]
      : activePath.steps[0];

  const totalSteps = activePath.steps.length;
  const currentStepNum = (activeStepIndex >= 0 ? activeStepIndex : 0) + 1;

  const stepConf = getConfidenceTier(currentStep.confidence);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
      {/* Stepper Header with Prev/Next Controls */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <FileSearch size={15} className="text-amber-400" />
          <span className="text-xs font-mono font-bold text-slate-200">
            ATTACK PATH STEPPER
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            Step {currentStepNum} of {totalSteps}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => stepReversePath('prev')}
            disabled={activeStepIndex <= 0}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Previous Attack Step"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => stepReversePath('next')}
            disabled={activeStepIndex >= totalSteps - 1}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Next Attack Step"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Step Hop Breakdown */}
      <div className="space-y-2 text-xs">
        {/* Transition Verb Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center justify-between">
          <div className="font-mono text-cyan-400 font-bold text-[11px]">
            {currentStep.edge.type}
          </div>
          <div
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
            style={{
              color: stepConf.color,
              borderColor: `${stepConf.color}40`,
              backgroundColor: `${stepConf.color}15`,
            }}
          >
            Conf: {(currentStep.confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Source Node -> Target Node */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <div className="text-slate-500 text-[9px] uppercase">Actor / Source:</div>
            <div className="text-rose-400 font-bold truncate mt-0.5">
              {currentStep.fromNode.label}
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              {currentStep.fromNode.type}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
            <div className="text-slate-500 text-[9px] uppercase">Target Entity:</div>
            <div className="text-amber-300 font-bold truncate mt-0.5">
              {currentStep.toNode.label}
            </div>
            <div className="text-slate-400 text-[10px] mt-0.5">
              {currentStep.toNode.type}
            </div>
          </div>
        </div>

        {/* Forensic Description */}
        <div className="text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-800/50 leading-relaxed font-sans">
          {currentStep.explanation}
        </div>

        {/* MITRE Technique Badge */}
        {currentStep.edge.mitreTechnique && (
          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 pt-1">
            <span className="text-cyan-400 font-bold">MITRE ATT&CK:</span>
            <span className="text-slate-300">{currentStep.edge.mitreTechnique}</span>
          </div>
        )}
      </div>

      {/* Step Timeline Indicator Dots */}
      <div className="flex items-center gap-1.5 pt-1">
        {activePath.steps.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setReversePathStep(idx)}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              idx === activeStepIndex
                ? 'bg-amber-400 ring-2 ring-amber-400/40'
                : idx < activeStepIndex
                ? 'bg-cyan-600'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title={`Jump to Step ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
