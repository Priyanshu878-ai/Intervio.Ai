import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { PerformanceTrendPoint, CommunicationTrendPoint } from '../types/api';

interface ProgressTrendChartProps {
  performanceTrend: PerformanceTrendPoint[];
  communicationTrend?: CommunicationTrendPoint[];
  compact?: boolean;
}

export const ProgressTrendChart: React.FC<ProgressTrendChartProps> = ({
  performanceTrend,
  communicationTrend = [],
  compact = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!performanceTrend || performanceTrend.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs font-medium">
        No evaluation trend points available yet.
      </div>
    );
  }

  // Width and height of SVG coordinate system
  const width = compact ? 500 : 700;
  const height = compact ? 140 : 200;
  const paddingX = 40;
  const paddingY = 25;

  const validPoints = performanceTrend.map((p, idx) => ({
    ...p,
    index: idx,
    score: p.overall_score !== null && p.overall_score !== undefined ? Math.round(p.overall_score) : 0,
    commScore:
      communicationTrend[idx]?.communication_score !== null && communicationTrend[idx]?.communication_score !== undefined
        ? Math.round(communicationTrend[idx].communication_score!)
        : null,
  }));

  const n = validPoints.length;

  const getX = (i: number) => {
    if (n === 1) return width / 2;
    return paddingX + (i / (n - 1)) * (width - 2 * paddingX);
  };

  const getY = (score: number) => {
    const clamped = Math.max(0, Math.min(100, score));
    return height - paddingY - (clamped / 100) * (height - 2 * paddingY);
  };

  // Build SVG Path for Overall Performance
  const linePath = validPoints.reduce((acc, p, i) => {
    const x = getX(i);
    const y = getY(p.score);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const areaPath =
    n > 1
      ? `${linePath} L ${getX(n - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`
      : '';

  // Build SVG Path for Communication Score
  const validComm = validPoints.filter((p) => p.commScore !== null);
  const commLinePath =
    validComm.length > 1
      ? validComm.reduce((acc, p, i) => {
          const x = getX(p.index);
          const y = getY(p.commScore!);
          return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
        }, '')
      : '';

  return (
    <div className="w-full select-none">
      {/* Chart Legend */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-400 border border-brand-300 shadow-sm shadow-brand-500/30" />
              <span className="text-slate-300 font-semibold">Overall Score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 border border-cyan-300 shadow-sm shadow-cyan-500/30" />
              <span className="text-slate-300 font-semibold">Communication</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {n} evaluated session(s)
          </div>
        </div>
      )}

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: compact ? '160px' : '230px' }}
        >
          <defs>
            {/* Area gradient for overall score */}
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
            </linearGradient>

            {/* Overall line gradient */}
            <linearGradient id="perf-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            {/* Communication line gradient */}
            <linearGradient id="comm-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>

          {/* Background Grid Guidelines */}
          {[25, 50, 75, 100].map((level) => {
            const y = getY(level);
            return (
              <g key={level}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#334155"
                  strokeOpacity="0.3"
                  strokeDasharray="4 4"
                />
                {!compact && (
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-slate-500 font-mono"
                  >
                    {level}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#area-grad)" />}

          {/* Communication Score Line */}
          {commLinePath && (
            <path
              d={commLinePath}
              fill="none"
              stroke="url(#comm-line-grad)"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
          )}

          {/* Overall Performance Line */}
          {n > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#perf-line-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Data Points */}
          {validPoints.map((p, i) => {
            const cx = getX(i);
            const cy = getY(p.score);
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={p.interview_id}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Subtle vertical indicator on hover */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingY}
                    x2={cx}
                    y2={height - paddingY}
                    stroke="#818cf8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="opacity-75"
                  />
                )}

                {/* Outer halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 8 : 5}
                  className="fill-brand-500/30 transition-all duration-150"
                />

                {/* Point dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 3.5}
                  className="fill-white stroke-brand-500 stroke-2 transition-all duration-150"
                />

                {/* Score label on point */}
                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono font-bold transition-opacity ${
                    isHovered ? 'fill-white opacity-100' : 'fill-slate-400 opacity-80'
                  }`}
                >
                  {p.score}%
                </text>

                {/* X-axis Session Label */}
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-slate-500 uppercase"
                >
                  S{i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card for Active Point */}
      {hoveredIdx !== null && validPoints[hoveredIdx] && (
        <div className="mt-3 p-3 rounded-xl bg-dark-900/95 border border-slate-700/80 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white capitalize">
                Session #{hoveredIdx + 1} • {validPoints[hoveredIdx].role}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {new Date(validPoints[hoveredIdx].created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                | {validPoints[hoveredIdx].difficulty}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">Overall</span>
              <span className="text-brand-300 font-bold">{validPoints[hoveredIdx].score}%</span>
            </div>
            {validPoints[hoveredIdx].commScore !== null && (
              <div>
                <span className="text-slate-400 text-[10px] block">Delivery</span>
                <span className="text-cyan-400 font-bold">{validPoints[hoveredIdx].commScore}%</span>
              </div>
            )}
            {validPoints[hoveredIdx].technical_score !== null && (
              <div>
                <span className="text-slate-400 text-[10px] block">Technical</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round(validPoints[hoveredIdx].technical_score!)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
