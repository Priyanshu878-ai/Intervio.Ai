import React from 'react';
import { Sparkles, Activity, User, LogOut } from 'lucide-react';
import { CandidateResponse } from '../types/api';

interface HeaderProps {
  statusText?: string;
  onReset?: () => void;
  candidate?: CandidateResponse | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  statusText, 
  onReset, 
  candidate, 
  onLogout 
}) => {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          role={onReset ? 'button' : undefined}
          tabIndex={onReset ? 0 : undefined}
          aria-label={onReset ? 'Intervio.Ai Home, New Interview' : undefined}
          onKeyDown={(e) => {
            if (onReset && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onReset();
            }
          }}
          className={`flex items-center gap-3 group ${onReset ? 'cursor-pointer' : ''}`}
          onClick={onReset}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Intervio<span className="text-indigo-600">.Ai</span>
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/70">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block font-medium">
              Multimodal Adaptive AI Interviewer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {candidate && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 shadow-sm">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold">{candidate.name}</span>
            </div>
          )}

          {statusText ? (
            <div aria-live="polite" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-700 font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{statusText}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200/70 text-xs text-indigo-700 font-semibold hidden sm:flex shadow-sm">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Engine Ready</span>
            </div>
          )}

          {onReset && (
            <button
              onClick={onReset}
              className="text-xs text-slate-700 font-bold hover:text-indigo-600 px-3 py-1.5 rounded-xl border border-slate-200/90 hover:border-indigo-300 bg-white hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              New Interview
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Sign Out"
              className="p-1.5 rounded-xl border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors md:hidden cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
