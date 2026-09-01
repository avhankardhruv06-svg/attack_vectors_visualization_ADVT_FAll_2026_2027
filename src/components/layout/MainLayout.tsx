// Main Layout Component: Synchronized 2D/3D Viewport with Filter & Investigation Sidebars
import React, { useState } from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { Header } from './Header';
import { FilterSidebar } from '../filters/FilterSidebar';
import { InvestigationPanel } from '../investigation/InvestigationPanel';
import { TimelineBar } from '../timeline/TimelineBar';
import { Graph2DCanvas } from '../../visualization/2d/Graph2DCanvas';
import { Graph3DScene } from '../../visualization/3d/Graph3DScene';

export const MainLayout: React.FC = () => {
  const { viewMode } = useGraphStore();
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isInvestigateOpen, setIsInvestigateOpen] = useState(true);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 1. Header */}
      <Header />

      {/* 2. Middle Body: Filters + Viewport(s) + Investigation */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Filter Sidebar */}
        <FilterSidebar
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        />

        {/* Central Dynamic Viewport: 2D, 3D, or Split */}
        <main className="flex-1 flex overflow-hidden relative">
          {viewMode === '2D' && (
            <div className="w-full h-full relative">
              <Graph2DCanvas />
            </div>
          )}

          {viewMode === '3D' && (
            <div className="w-full h-full relative">
              <Graph3DScene />
            </div>
          )}

          {viewMode === 'SPLIT' && (
            <div className="w-full h-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800">
              {/* Left: 2D Analytical Projection */}
              <div className="flex-1 h-1/2 md:h-full relative overflow-hidden">
                <Graph2DCanvas />
              </div>

              {/* Right: 3D Semantic Projection */}
              <div className="flex-1 h-1/2 md:h-full relative overflow-hidden">
                <Graph3DScene />
              </div>
            </div>
          )}
        </main>

        {/* Investigation Inspector Sidebar */}
        <InvestigationPanel
          isOpen={isInvestigateOpen}
          onToggle={() => setIsInvestigateOpen(!isInvestigateOpen)}
        />
      </div>

      {/* 3. Interactive Timeline Bar */}
      <TimelineBar />
    </div>
  );
};
