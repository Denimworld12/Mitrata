import { useState } from 'react';

// Single-series bar chart: daily signups over the selected window.
// One hue (brand-500), thin bars with rounded data-ends, hover tooltip.
export default function GrowthChart({ data, height = 160 }) {
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) {
    return <p className="text-sm text-neutral-400 py-8 text-center">No signups in this window yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = (d.count / max) * (height - 24);
          const x = i * barWidth;
          return (
            <g key={d._id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={x + barWidth * 0.2}
                y={height - 20 - barHeight}
                width={barWidth * 0.6}
                height={Math.max(barHeight, 2)}
                rx={2}
                className={hover === i ? 'fill-brand-600' : 'fill-brand-500'}
              />
            </g>
          );
        })}
        <line x1="0" y1={height - 20} x2="100" y2={height - 20} stroke="var(--color-neutral-200)" strokeWidth="0.5" />
      </svg>

      {hover !== null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full bg-neutral-900 text-white text-xs rounded-md px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{ left: `${(hover + 0.5) * barWidth}%`, top: height - 24 - (data[hover].count / max) * (height - 24) }}
        >
          {data[hover]._id}: {data[hover].count} signup{data[hover].count === 1 ? '' : 's'}
        </div>
      )}

      <div className="flex justify-between text-xs text-neutral-400 mt-1">
        <span>{data[0]._id}</span>
        <span>{data[data.length - 1]._id}</span>
      </div>
    </div>
  );
}
