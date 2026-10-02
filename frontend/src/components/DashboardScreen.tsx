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
      <div className="card-3d p-6 sm:p-8 relative overflow-hidden bg-gradient-to-r from-white via-indigo-50/40 to-cyan-50/30 border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(99,102,241,0.08)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-xs font-bold mb-3 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Personal Candidate Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {candidate.name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl font-medium leading-relaxed">
              Ready to practice with the adaptive AI interviewer? Test your skills, receive real-time multimodal evaluation, and track your progress over time.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-700 font-semibold">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-600" />
                <span>Role: <strong className="text-slate-900">{candidate.target_role || 'Not specified'}</strong></span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>Level: <strong className="text-slate-900 capitalize">{candidate.experience_level || 'Mid-Level'}</strong></span>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <button
              onClick={onStartInterview}
              className="btn-3d px-6 py-3 font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/25"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start New Interview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-3d p-5 card-3d-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Total Interviews</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{history.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Practice sessions initiated</div>
        </div>

        <div className="card-3d p-5 card-3d-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{completedInterviews.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Full multimodal reports</div>
        </div>

        <div className="card-3d p-5 card-3d-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Latest Score</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">
            {latestScore !== null ? `${latestScore}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Most recent session</div>
        </div>

        <div className="card-3d p-5 card-3d-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">Average Score</span>
            <TrendingUp className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {avgScore !== null ? `${avgScore}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">Cumulative performance</div>
        </div>
      </div>

      {/* Candidate Intelligence & Progress Trajectory Card */}
      {intelligence && intelligence.has_data && intelligence.performance_trend.length > 0 && (
        <div className="card-3d p-6 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Progress Trajectory & Performance Trend
              </h3>
            </div>

            {/* Comparative recent vs prior score badge */}
            <div className="flex items-center gap-3">
              {intelligence.score_delta !== null ? (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1 border ${
                  intelligence.score_delta > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : intelligence.score_delta < 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
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
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 font-bold">
                  Initial Baseline
                </span>
              )}

              {onViewProfile && (
                <button
                  onClick={onViewProfile}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
          <div className="pt-4 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {intelligence.recent_improvements.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">Recent Trajectory:</span>
                  <span className="text-slate-600 text-[11px] leading-relaxed font-medium">
                    {intelligence.recent_improvements[0]}
                  </span>
                </div>
              </div>
            )}

            {intelligence.suggested_practice_areas.length > 0 && (
              <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">Suggested Focus:</span>
                  <span className="text-slate-600 text-[11px] leading-relaxed font-medium">
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
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Session Progression</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono font-semibold">{scores.length} recorded session(s)</span>
          </div>

          <div className="space-y-3">
            {completedInterviews.slice(0, 5).map((item, idx) => (
              <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-4 shadow-xs hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 font-bold">#{completedInterviews.length - idx}</span>
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 capitalize">{item.role}</span>
                    <span className="text-xs text-slate-500 font-semibold ml-2">({item.difficulty})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, item.overall_score || 0))}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-indigo-600 font-mono w-12 text-right">
                    {item.overall_score}%
                  </span>
                  <button
                    onClick={() => onViewReport(item.id)}
                    className="p-1.5 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    title="View Report"
                  >
                    <ArrowRight className="w-4 h-4" />
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
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Recent Interviews</h3>
          </div>
          <button
            onClick={onViewHistory}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <Clock className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
            <p className="text-xs font-semibold">No interviews attempted yet. Start your first session!</p>
            <button
              onClick={onStartInterview}
              className="btn-3d px-4 py-2 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Begin Setup</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    item.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-slate-900 capitalize">
                      {item.role} <span className="text-slate-500 font-normal">({item.interview_type})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono font-medium">
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
                  <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                    item.status === 'completed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    {item.status}
                  </span>

                  {item.status === 'completed' && (
                    <button
                      onClick={() => onViewReport(item.id)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 flex items-center gap-1 transition-all shadow-xs cursor-pointer hover:border-indigo-200"
                    >
                      <span>Report</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
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
