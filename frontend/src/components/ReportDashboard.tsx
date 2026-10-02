import React from 'react';
import { 
  Briefcase, 
  ArrowLeft, 
  BarChart3, 
  Layers, 
  Mic, 
  Video, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert
} from 'lucide-react';
import { FinalInterviewReport } from '../types/api';
import { ScoreGauge3D } from './ScoreGauge3D';

interface ReportDashboardProps {
  report: FinalInterviewReport;
  onReset: () => void;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ report, onReset }) => {
  const { 
    interview_summary, 
    overall_performance, 
    technical_performance, 
    text_performance, 
    audio_performance, 
    vision_performance, 
    question_analytics,
    strengths,
    improvement_areas,
    final_summary
  } = report;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
            <span>Official Evaluation Record</span>
            <span>•</span>
            <span className="text-emerald-600 font-extrabold">Status: {interview_summary.status}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Final Performance Analytics & Report
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Comprehensive multi-modal synthesis for {interview_summary.candidate.name} ({interview_summary.candidate.email})
          </p>
        </div>

        <button
          onClick={onReset}
          className="btn-3d-secondary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>New Session</span>
        </button>
      </div>

      {/* Main 3D KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 3D Holistic Score Gauge */}
        <div className="lg:col-span-1">
          <ScoreGauge3D
            score={overall_performance.overall_score}
            performanceLevel={overall_performance.performance_level}
            relevanceScore={text_performance.relevance_score}
            technicalScore={technical_performance.aggregate_technical_score}
            communicationScore={text_performance.communication_score}
          />
        </div>

        {/* Right: Interview Overview & Category Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="card-3d p-6">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>Assessment Profile</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500 uppercase font-extrabold">Target Role</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 capitalize">{interview_summary.role}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500 uppercase font-extrabold">Difficulty</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 capitalize">{interview_summary.difficulty}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500 uppercase font-extrabold">Answered</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1 font-mono">
                  {interview_summary.answered_questions} / {interview_summary.total_questions}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500 uppercase font-extrabold">Completion</div>
                <div className="text-sm font-extrabold text-emerald-600 mt-1 font-mono">
                  {interview_summary.completion_percentage}%
                </div>
              </div>
            </div>

            {/* Answer Tier Breakdown Pills */}
            <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-600 font-bold">Assessment Distribution:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {overall_performance.strong_answers_count} Strong
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {overall_performance.average_answers_count} Competent
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {overall_performance.weak_answers_count} Growth Focus
              </span>
            </div>
          </div>

          {/* AI Deterministic Final Verdict Card */}
          <div className="card-3d p-6 relative overflow-hidden border-indigo-200 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Executive Synthesis</span>
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              {final_summary}
            </p>
          </div>
        </div>
      </div>

      {/* Strengths & Improvement Areas Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths Card */}
        <div className="card-3d p-6 border-emerald-200/80">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Key Competencies & Strengths</span>
          </div>
          <ul className="space-y-2.5">
            {strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                <span className="text-emerald-600 font-extrabold mt-0.5">✓</span>
                <span className="leading-relaxed">{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvement Areas Card */}
        <div className="card-3d p-6 border-amber-200/80">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Targeted Skill Growth Areas</span>
          </div>
          <ul className="space-y-2.5">
            {improvement_areas.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                <span className="text-amber-600 font-extrabold mt-0.5">→</span>
                <span className="leading-relaxed">{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Acoustic & Visual Engagement Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-3d p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
            <Mic className="w-4 h-4 text-indigo-600" />
            <span>Acoustic Modality Summary</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {audio_performance.note}
          </p>
          <div className="mt-3 text-[11px] text-slate-500 font-mono font-semibold">
            Submissions with Audio: {audio_performance.audio_answered_count}
          </div>
        </div>

        <div className="card-3d p-5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
            <Video className="w-4 h-4 text-cyan-600" />
            <span>Visual Engagement Summary</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {vision_performance.note}
          </p>
          <div className="mt-3 text-[10px] text-slate-500 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{vision_performance.disclaimer}</span>
          </div>
        </div>
      </div>

      {/* Question-Wise Analytics Progression */}
      <div className="card-3d p-6">
        <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Sequential Question Breakdown & Analytics</span>
          </div>
          <span className="text-xs text-slate-500 font-mono font-semibold">
            {question_analytics.length} Total Questions
          </span>
        </div>

        <div className="space-y-4">
          {question_analytics.map((q) => {
            const hasScore = q.score !== null;
            return (
              <div 
                key={q.question_id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:border-indigo-200 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold font-mono">
                      Q#{q.sequence_number}
                    </span>
                    <span className="text-xs text-slate-500 uppercase font-bold">
                      {q.question_type}
                    </span>
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                      q.answer_status === 'answered'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200 text-slate-600 border border-slate-300'
                    }`}>
                      {q.answer_status}
                    </span>
                  </div>

                  {hasScore && (
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono font-extrabold text-slate-900">
                        Score: <span className="text-indigo-600">{q.score}</span>
                      </div>
                      <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                        q.performance_level === 'strong'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : q.performance_level === 'average'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {q.performance_level === 'weak' ? 'Growth Focus' : q.performance_level}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm font-bold text-slate-900 mb-3 leading-relaxed">
                  {q.question_text}
                </p>

                {q.evaluation_feedback && (
                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed mb-3 font-medium shadow-xs">
                    <span className="font-extrabold text-indigo-600">Evaluation Insight: </span>
                    {q.evaluation_feedback}
                  </div>
                )}

                {/* Sub-scores & Modalities */}
                {hasScore && (
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 font-mono font-semibold">
                    {q.technical_score !== null && (
                      <span>Technical: <strong className="text-slate-900">{q.technical_score}</strong></span>
                    )}
                    {q.relevance_score !== null && (
                      <span>Relevance: <strong className="text-slate-900">{q.relevance_score}</strong></span>
                    )}
                    {q.completeness_score !== null && (
                      <span>Completeness: <strong className="text-slate-900">{q.completeness_score}</strong></span>
                    )}
                    {q.communication_score !== null && (
                      <span>Communication: <strong className="text-slate-900">{q.communication_score}</strong></span>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto text-slate-500">
                      {q.has_audio && <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">Audio</span>}
                      {q.has_video && <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px] font-bold border border-cyan-200">Video</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
