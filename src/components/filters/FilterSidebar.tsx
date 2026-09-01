// Multi-Faceted Filter Sidebar Component
import React from 'react';
import { useGraphStore } from '../../graph/graphStore';
import {
  ALL_ENTITY_TYPES,
  ALL_ATTACK_STAGES,
  ALL_SECURITY_STATES,
} from '../../graph/graphUtils';
import { EntityType, AttackStage, NodeSecurityState } from '../../graph/types';
import {
  ENTITY_COLORS,
  STATE_COLORS,
  STAGE_LABELS,
} from '../../visualization/theme/themeManager';
import {
  Filter,
  Search,
  RotateCcw,
  Sliders,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FilterSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ isOpen, onToggle }) => {
  const { filters, updateFilters, resetFilters, masterGraph, filteredGraph } = useGraphStore();

  const handleSearchChange = (val: string) => {
    updateFilters((prev) => ({ ...prev, searchQuery: val }));
  };

  const handleTypeToggle = (type: EntityType) => {
    updateFilters((prev) => {
      const nextSet = new Set(prev.selectedEntityTypes);
      if (nextSet.has(type)) {
        if (nextSet.size > 1) nextSet.delete(type);
      } else {
        nextSet.add(type);
      }
      return { ...prev, selectedEntityTypes: nextSet };
    });
  };

  const handleStageToggle = (stage: AttackStage) => {
    updateFilters((prev) => {
      const nextSet = new Set(prev.selectedStages);
      if (nextSet.has(stage)) {
        if (nextSet.size > 1) nextSet.delete(stage);
      } else {
        nextSet.add(stage);
      }
      return { ...prev, selectedStages: nextSet };
    });
  };

  const handleStateToggle = (state: NodeSecurityState) => {
    updateFilters((prev) => {
      const nextSet = new Set(prev.selectedSecurityStates);
      if (nextSet.has(state)) {
        if (nextSet.size > 1) nextSet.delete(state);
      } else {
        nextSet.add(state);
      }
      return { ...prev, selectedSecurityStates: nextSet };
    });
  };

  const handleConfidenceChange = (val: number) => {
    updateFilters((prev) => ({ ...prev, minConfidence: val }));
  };

  // Node count by type in master graph
  const countByType: Record<string, number> = {};
  masterGraph.nodes.forEach((n) => {
    countByType[n.type] = (countByType[n.type] || 0) + 1;
  });

  return (
    <aside
      className={`relative bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 z-10 select-none ${
        isOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-slate-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Filter size={15} className="text-cyan-400" />
          <span>INVESTIGATION FILTERS</span>
        </div>
        <button
          onClick={resetFilters}
          className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition"
          title="Reset All Filters"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      {/* Filter Options Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* 1. Free-Text Search */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            SEARCH ENTITIES
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="IP, host, user, hash..."
              value={filters.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* 2. Minimum Confidence Slider */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-slate-400">MIN CONFIDENCE:</span>
            <span className="text-cyan-400 font-bold">
              {(filters.minConfidence * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.95}
            step={0.05}
            value={filters.minConfidence}
            onChange={(e) => handleConfidenceChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* 3. Entity Types */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            ENTITY TYPES
          </label>
          <div className="space-y-1">
            {ALL_ENTITY_TYPES.map((type) => {
              const checked = filters.selectedEntityTypes.has(type);
              const color = ENTITY_COLORS[type];
              const count = countByType[type] || 0;

              return (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition ${
                    checked
                      ? 'bg-slate-800/80 text-slate-200'
                      : 'bg-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-mono">{type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Attack Lifecycle Stages */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            ATTACK STAGES
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ATTACK_STAGES.map((stage) => {
              const checked = filters.selectedStages.has(stage);
              return (
                <button
                  key={stage}
                  onClick={() => handleStageToggle(stage)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition border ${
                    checked
                      ? 'bg-amber-950/50 border-amber-600/50 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Security States */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            SECURITY STATES
          </label>
          <div className="space-y-1">
            {ALL_SECURITY_STATES.map((state) => {
              const checked = filters.selectedSecurityStates.has(state);
              const color = STATE_COLORS[state];

              return (
                <button
                  key={state}
                  onClick={() => handleStateToggle(state)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                    checked
                      ? 'bg-slate-800/80 text-slate-200'
                      : 'bg-transparent text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-mono">{state}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collapse Toggle Handle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-3.5 h-10 bg-slate-800 border border-slate-700 rounded-r flex items-center justify-center text-slate-400 hover:text-cyan-300 z-30"
        title={isOpen ? 'Collapse Filters' : 'Expand Filters'}
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </aside>
  );
};
