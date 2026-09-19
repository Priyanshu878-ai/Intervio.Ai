import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Award, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  Sparkles,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Zap
} from 'lucide-react';
import { CandidateResponse, InterviewHistoryItem, CandidateIntelligenceResponse } from '../types/api';
import { api } from '../services/api';
import { ProgressTrendChart } from './ProgressTrendChart';

interface DashboardScreenProps {
  candidate: CandidateResponse;
  history: InterviewHistoryItem[];
  onStartInterview: () => void;
  onViewHistory: () => void;
  onViewReport: (interviewId: string) => void;
  onViewProfile?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  candidate,
  history,
  onStartInterview,
  onViewHistory,
  onViewReport,
  onViewProfile,
}) => {
  const completedInterviews = history.filter((i) => i.status === 'completed');
  const scores = completedInterviews
    .map((i) => i.overall_score)
    .filter((s): s is number => s !== null && s !== undefined);

  const latestScore = scores.length > 0 ? scores[0] : null;
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;

  // Intelligence state
  const [intelligence, setIntelligence] = useState<CandidateIntelligenceResponse | null>(null);

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        const data = await api.getMyIntelligence();
        setIntelligence(data);
      } catch {
        setIntelligence(null);
      }
    };

    fetchIntelligence();
  }, [candidate.id, history.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Welcome Banner Card */}
      <div className="card-3d p-6 sm:p-8 relative overflow-hidden bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Candidate Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {candidate.name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Ready to practice with the adaptive AI interviewer? Test your skills, receive real-time multimodal evaluation, and track your progress over time.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Role: <strong className="text-white">{candidate.target_role || 'Not specified'}</strong></span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-brand-emerald" />
                <span>Level: <strong className="text-white capitalize">{candidate.experience_level || 'Mid-Level'}</strong></span>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <button
              onClick={onStartInterview}
              className="btn-3d px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-brand-500/25 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start New Interview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-3d p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Interviews</span>
            <Clock className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">{history.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Practice sessions initiated</div>
        </div>

        <div className="card-3d p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">{completedInterviews.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Full multimodal reports</div>
        </div>

        <div className="card-3d p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Latest Score</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-brand-400 font-mono">
            {latestScore !== null ? `${latestScore}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Most recent session</div>
        </div>

        <div className="card-3d p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Score</span>
            <TrendingUp className="w-4 h-4 text-brand-cyan" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">
            {avgScore !== null ? `${avgScore}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cumulative performance</div>
        </div>
      </div>

      {/* Candidate Intelligence & Progress Trajectory Card */}
      {intelligence && intelligence.has_data && intelligence.performance_trend.length > 0 && (
        <div className="card-3d p-6 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Progress Trajectory & Performance Trend
              </h3>
            </div>

            {/* Comparative recent vs prior score badge */}
            <div className="flex items-center gap-3">
              {intelligence.score_delta !== null ? (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1 border ${
                  intelligence.score_delta > 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : intelligence.score_delta < 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                }`}>
                  {intelligence.score_delta > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : intelligence.score_delta < 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : null}
                  <span>
                    {intelligence.score_delta > 0
                      ? `+${intelligence.score_delta}% vs prior avg`
                      : intelligence.score_delta < 0
                      ? `${intelligence.score_delta}% vs prior avg`
                      : 'Matching prior avg'}
                  </span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-slate-400 bg-dark-900 border border-slate-800">
                  Initial Baseline
                </span>
              )}

              {onViewProfile && (
                <button
                  onClick={onViewProfile}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Detailed Intelligence</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Embedded Compact Trend Visual */}
          <div className="pt-2 pb-4">
            <ProgressTrendChart
              compact
              performanceTrend={intelligence.performance_trend}
              communicationTrend={intelligence.communication_trend}
            />
          </div>

          {/* Quick Intelligence Insights Footer */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {intelligence.recent_improvements.length > 0 && (
              <div className="p-3 rounded-xl bg-dark-900/60 border border-slate-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Recent Trajectory:</span>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    {intelligence.recent_improvements[0]}
                  </span>
                </div>
              </div>
            )}

            {intelligence.suggested_practice_areas.length > 0 && (
              <div className="p-3 rounded-xl bg-dark-900/60 border border-slate-800 flex items-start gap-2">
                <Zap className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Suggested Focus:</span>
                  <span className="text-slate-300 text-[11px] leading-relaxed">
                    {intelligence.suggested_practice_areas[0]}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress & Score Progression List */}
      {scores.length > 0 && (
        <div className="card-3d p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Session Progression</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{scores.length} recorded session(s)</span>
          </div>

          <div className="space-y-3">
            {completedInterviews.slice(0, 5).map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl bg-dark-900 border border-slate-800/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 font-bold">#{completedInterviews.length - idx}</span>
                  <div>
                    <span className="text-xs font-bold text-white capitalize">{item.role}</span>
                    <span className="text-xs text-slate-400 ml-2">({item.difficulty})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-dark-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-cyan rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, item.overall_score || 0))}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-brand-300 font-mono w-12 text-right">
                    {item.overall_score}%
                  </span>
                  <button
                    onClick={() => onViewReport(item.id)}
                    className="p-1 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="View Report"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity List */}
      <div className="card-3d p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Interviews</h3>
          </div>
          <button
            onClick={onViewHistory}
            className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <Clock className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs">No interviews attempted yet. Start your first session!</p>
            <button
              onClick={onStartInterview}
              className="btn-3d px-4 py-2 rounded-lg bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Begin Setup</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    item.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-white capitalize">
                      {item.role} <span className="text-slate-400 font-normal">({item.interview_type})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    item.status === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}>
                    {item.status}
                  </span>

                  {item.status === 'completed' && (
                    <button
                      onClick={() => onViewReport(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-slate-700 text-xs font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Report</span>
                      <ArrowRight className="w-3 h-3 text-brand-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
