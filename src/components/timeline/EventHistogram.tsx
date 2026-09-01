// Event Density Histogram for Incident Timeline
import React, { useMemo } from 'react';
import { useGraphStore } from '../../graph/graphStore';
import { DETERMINISTIC_RANSOMWARE_EVENTS } from '../../simulation/ransomwareScenario';

export const EventHistogram: React.FC = () => {
  const { timeline } = useGraphStore();

  const bins = useMemo(() => {
    const binCount = 40;
    const result = new Array(binCount).fill(0);
    const span = timeline.maxTime - timeline.minTime || 1;

    DETERMINISTIC_RANSOMWARE_EVENTS.forEach((evt) => {
      const normalized = (evt.timestamp - timeline.minTime) / span;
      const binIdx = Math.min(binCount - 1, Math.max(0, Math.floor(normalized * binCount)));
      result[binIdx] += 1;
    });

    const maxVal = Math.max(1, ...result);
    return result.map((count) => count / maxVal);
  }, [timeline.minTime, timeline.maxTime]);

  const currentProgress =
    (timeline.currentTime - timeline.minTime) / (timeline.maxTime - timeline.minTime || 1);

  return (
    <div className="relative w-full h-8 flex items-end gap-[2px] px-1 select-none pointer-events-none">
      {bins.map((val, idx) => {
        const binProgress = idx / bins.length;
        const isPast = binProgress <= currentProgress;

        return (
          <div
            key={idx}
            className="flex-1 rounded-t-sm transition-all duration-150"
            style={{
              height: `${Math.max(15, val * 100)}%`,
              backgroundColor: isPast
                ? val > 0.6
                  ? '#f43f5e'
                  : '#06b6d4'
                : '#334155',
              opacity: isPast ? 0.9 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
};
