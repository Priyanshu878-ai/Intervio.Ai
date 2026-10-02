import React from 'react';
import { Award } from 'lucide-react';

interface ScoreGauge3DProps {
  score: number | null;
  performanceLevel: 'weak' | 'average' | 'strong' | string | null;
  relevanceScore?: number | null;
  technicalScore?: number | null;
  communicationScore?: number | null;
}

export const ScoreGauge3D: React.FC<ScoreGauge3DProps> = ({
  score,
  performanceLevel,
  relevanceScore,
  technicalScore,
  communicationScore,
}) => {
  const displayScore = score !== null ? Math.round(score * 10) / 10 : 0;
  
  // Radial calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (Math.min(Math.max(score, 0), 100) / 100) : 0;
  const strokeDashoffset = circumference - progress * circumference;

  const isStrong = performanceLevel === 'strong';
  const isAvg = performanceLevel === 'average';

  const levelColor = isStrong 
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80' 
    : isAvg 
    ? 'text-indigo-700 bg-indigo-50 border-indigo-200/80' 
    : 'text-amber-700 bg-amber-50 border-amber-200/80';

  const motivationalMessage = isStrong
    ? 'Outstanding Competency & Technical Depth'
    : isAvg
    ? 'Solid Foundation — High Growth Potential'
    : 'Foundational Skillset — Clear Growth Focus';

  const gradientId = isStrong 
    ? 'score-grad-strong' 
    : isAvg 
    ? 'score-grad-avg' 
    : 'score-grad-weak';

  return (
    <div role="region" aria-label="Holistic Evaluation Score" className="card-3d p-6 relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background ambient depth glow */}
      <div 
        className={`absolute w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none ${
          isStrong ? 'bg-emerald-400' : isAvg ? 'bg-indigo-400' : 'bg-amber-400'
        }`} 
      />

      <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
        <Award className="w-4 h-4 text-indigo-600" />
        <span>Holistic Evaluation Score</span>
      </div>

      {/* 3D Gauge Circle */}
      <div className="relative w-44 h-44 flex items-center justify-center my-2">
        <svg aria-hidden="true" className="w-full h-full transform -rotate-90 score-ring-3d" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="score-grad-strong" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="score-grad-avg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="score-grad-weak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FB923C" />
            </linearGradient>
          </defs>

          {/* Track background */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="11"
            className="text-slate-100"
            fill="transparent"
          />

          {/* Animated Value Stroke */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth="11"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            fill="transparent"
          />
        </svg>

        {/* Center 3D Plate */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-black text-slate-900 tracking-tight drop-shadow-sm">
            {displayScore}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold font-mono">/ 100</span>
        </div>
      </div>

      {/* Performance Badge & Motivating Subtitle */}
      <div className="mt-3 flex flex-col items-center gap-1.5 text-center">
        <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${levelColor}`}>
          {performanceLevel ? `${performanceLevel} tier` : 'EVALUATION RECORD'}
        </div>
        <div className="text-[11px] text-slate-600 font-semibold">
          {motivationalMessage}
        </div>
      </div>

      {/* Mini Dimensions */}
      <div className="w-full mt-6 pt-5 border-t border-slate-200/80 grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] text-slate-500 uppercase font-extrabold">Technical</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
            {technicalScore !== null && technicalScore !== undefined ? Math.round(technicalScore) : '—'}
          </div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] text-slate-500 uppercase font-extrabold">Relevance</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
            {relevanceScore !== null && relevanceScore !== undefined ? Math.round(relevanceScore) : '—'}
          </div>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[10px] text-slate-500 uppercase font-extrabold">Delivery</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
            {communicationScore !== null && communicationScore !== undefined ? Math.round(communicationScore) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
