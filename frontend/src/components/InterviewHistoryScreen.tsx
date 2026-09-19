import React from 'react';
import { 
  History, 
  Play, 
  ArrowRight, 
  Calendar,
  Layers,
  Award
} from 'lucide-react';
import { InterviewHistoryItem } from '../types/api';

interface InterviewHistoryScreenProps {
  history: InterviewHistoryItem[];
  onStartInterview: () => void;
  onViewReport: (interviewId: string) => void;
}

export const InterviewHistoryScreen: React.FC<InterviewHistoryScreenProps> = ({
  history,
  onStartInterview,
  onViewReport,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Interview Records</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Interview History</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Review past assessment sessions, evaluation metrics, and full reports.
          </p>
        </div>

        <button
          onClick={onStartInterview}
          className="btn-3d px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/20 self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>New Interview</span>
        </button>
      </div>

      {/* History Content */}
      {history.length === 0 ? (
        <div className="card-3d p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-dark-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">No Previous Interviews Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            You haven't conducted any practice interviews yet. Start your first session to receive comprehensive multimodal feedback.
          </p>
          <button
            onClick={onStartInterview}
            className="btn-3d px-5 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Practice Interview</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((item) => {
            const formattedDate = new Date(item.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                className="card-3d card-3d-hover p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-bold text-white capitalize">{item.role}</span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs font-medium text-slate-300 capitalize">{item.difficulty}</span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="text-xs font-medium text-slate-400 capitalize">{item.interview_type}</span>

                    <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                      item.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      <span>{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <Layers className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>{item.answered_questions} of {item.total_questions} questions answered</span>
                    </div>
                  </div>
                </div>

                {/* Score & Action */}
                <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  {item.overall_score !== null && item.overall_score !== undefined ? (
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-1.5 text-lg font-bold font-mono text-brand-400">
                        <Award className="w-4 h-4 text-indigo-400" />
                        <span>{item.overall_score}%</span>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        item.performance_level === 'strong'
                          ? 'text-emerald-400'
                          : item.performance_level === 'average'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {item.performance_level || 'Evaluated'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Incomplete</span>
                  )}

                  {item.status === 'completed' && (
                    <button
                      onClick={() => onViewReport(item.id)}
                      className="btn-3d px-4 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 border border-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                    >
                      <span>View Report</span>
                      <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
