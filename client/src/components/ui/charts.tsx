/**
 * Lightweight hand-rolled SVG charts (no chart library) — dark-theme styled,
 * rendered only when real data exists.
 */
import type { BadgeTone } from '../../lib/constants';

const TONE_HEX: Record<BadgeTone, string> = {
  violet: '#a78bfa',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  sky: '#38bdf8',
  zinc: '#a1a1aa',
  fuchsia: '#e879f9',
};

export interface DonutSlice {
  label: string;
  value: number;
  tone: BadgeTone;
}

export function DonutChart({ data, centerLabel }: { data: DonutSlice[]; centerLabel?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#18181b" strokeWidth="16" />
        {data.map((slice) => {
          const length = (slice.value / total) * circumference;
          const el = (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={TONE_HEX[slice.tone]}
              strokeWidth="16"
              strokeLinecap="butt"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return el;
        })}
        <title>{`${centerLabel ?? 'Total'}: ${total}`}</title>
      </svg>
      <ul className="w-full space-y-2">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE_HEX[slice.tone] }} />
              {slice.label}
            </span>
            <span className="font-medium text-zinc-200">
              {slice.value}
              <span className="ml-1.5 text-xs text-zinc-600">{Math.round((slice.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  tone: BadgeTone;
}

export function BarList({ data }: { data: BarItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.every((d) => d.value === 0)) return null;
  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{item.label}</span>
            <span className="font-medium text-zinc-200">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, background: TONE_HEX[item.tone] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SparklineArea({ points, tone = 'violet' }: { points: { date: string; count: number }[]; tone?: BadgeTone }) {
  if (points.length === 0) return null;
  const width = 560;
  const height = 140;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.count), 1);
  const stepX = (width - pad * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => [
    pad + i * stepX,
    height - pad - (p.count / max) * (height - pad * 2),
  ] as [number, number]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height - pad} L${coords[0][0].toFixed(1)},${height - pad} Z`;
  const color = TONE_HEX[tone];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
        <defs>
          <linearGradient id={`grad-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${tone})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
