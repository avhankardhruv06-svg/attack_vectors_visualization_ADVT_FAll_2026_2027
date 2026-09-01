// Interactive Incident Timeline Playback Bar
import React, { useEffect, useRef } from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { EventHistogram } from './EventHistogram';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  FastForward,
} from 'lucide-react';

export const TimelineBar: React.FC = () => {
  const {
    timeline,
    setTimelineTime,
    toggleTimelinePlayback,
    setPlaybackSpeed,
    stepTimeline,
    filteredGraph,
  } = useGraphStore();

  const playTimerRef = useRef<number | null>(null);

  // Playback loop effect
  useEffect(() => {
    if (timeline.isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        const { currentTime, minTime, maxTime, playbackSpeed } = useGraphStore.getState().timeline;
        const step = 15 * playbackSpeed;
        if (currentTime + step > maxTime) {
          setTimelineTime(minTime);
        } else {
          setTimelineTime(currentTime + step);
        }
      }, 200);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [timeline.isPlaying, setTimelineTime]);

  const formatTimestamp = (epochSec: number) => {
    const d = new Date(epochSec * 1000);
    return d.toTimeString().split(' ')[0];
  };

  const elapsedSeconds = timeline.currentTime - timeline.minTime;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedRemainderSeconds = elapsedSeconds % 60;

  return (
    <div className="h-20 bg-slate-900/95 border-t border-slate-800 px-4 py-2 flex flex-col justify-between shrink-0 z-20 select-none">
      {/* Top: Scrubber with integrated event density histogram */}
      <div className="relative w-full flex flex-col justify-end">
        <EventHistogram />
        <input
          type="range"
          min={timeline.minTime}
          max={timeline.maxTime}
          step={10}
          value={timeline.currentTime}
          onChange={(e) => setTimelineTime(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Bottom: Playback Controls & Time Readouts */}
      <div className="flex items-center justify-between mt-1 text-xs">
        {/* Left: Playback buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimelineTime(timeline.minTime)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Jump to Incident Start (T0)"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={() => stepTimeline(-60)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Step Backward (1 Min)"
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={toggleTimelinePlayback}
            className="flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded shadow transition"
          >
            {timeline.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{timeline.isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            onClick={() => stepTimeline(60)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Step Forward (1 Min)"
          >
            <SkipForward size={15} />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] font-mono ml-2">
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-1.5 py-0.5 rounded transition ${
                  timeline.playbackSpeed === speed
                    ? 'bg-cyan-500/30 text-cyan-300 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live Time Display */}
        <div className="flex items-center gap-2 font-mono">
          <Clock size={14} className="text-cyan-400" />
          <span className="text-slate-200 font-bold text-sm">
            {formatTimestamp(timeline.currentTime)}
          </span>
          <span className="text-slate-500">
            (+{String(elapsedMinutes).padStart(2, '0')}:{String(elapsedRemainderSeconds).padStart(2, '0')})
          </span>
        </div>

        {/* Right: Active Event Horizon Status */}
        <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <div>
            Active Entities: <span className="text-cyan-400 font-bold">{filteredGraph.nodes.length}</span>
          </div>
          <div>
            Active Edges: <span className="text-cyan-400 font-bold">{filteredGraph.edges.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
