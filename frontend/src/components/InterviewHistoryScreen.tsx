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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-xs font-bold mb-2 shadow-xs">
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>Interview Records</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Interview History</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Review past assessment sessions, evaluation metrics, and full reports.
          </p>
        </div>

        <button
          onClick={onStartInterview}
          className="btn-3d px-5 py-2.5 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>New Interview</span>
        </button>
      </div>

      {/* History Content */}
      {history.length === 0 ? (
        <div className="card-3d p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
            <History className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">No Previous Interviews Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
            You haven't conducted any practice interviews yet. Start your first session to receive comprehensive multimodal feedback.
          </p>
          <button
            onClick={onStartInterview}
            className="btn-3d px-5 py-2.5 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
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
                    <span className="text-sm font-extrabold text-slate-900 capitalize">{item.role}</span>
                    <span className="text-xs text-slate-300">|</span>
                    <span className="text-xs font-bold text-slate-600 capitalize">{item.difficulty}</span>
                    <span className="text-xs text-slate-300">|</span>
                    <span className="text-xs font-semibold text-slate-500 capitalize">{item.interview_type}</span>

                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                      item.status === 'completed'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-semibold">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <Layers className="w-3.5 h-3.5 text-cyan-600" />
                      <span>{item.answered_questions} of {item.total_questions} questions answered</span>
                    </div>
                  </div>
                </div>

                {/* Score & Action */}
                <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/80">
                  {item.overall_score !== null && item.overall_score !== undefined ? (
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-1.5 text-lg font-black font-mono text-indigo-600">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span>{item.overall_score}%</span>
                      </div>
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider ${
                        item.performance_level === 'strong'
                          ? 'text-emerald-700'
                          : item.performance_level === 'average'
                          ? 'text-indigo-700'
                          : 'text-amber-700'
                      }`}>
                        {item.performance_level || 'Evaluated'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic font-medium">Incomplete</span>
                  )}

                  {item.status === 'completed' && (
                    <button
                      onClick={() => onViewReport(item.id)}
                      className="btn-3d-secondary px-4 py-2 text-slate-900 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>View Report</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
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
