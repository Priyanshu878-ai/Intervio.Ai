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
    <header className="border-b border-slate-800/80 bg-dark-900/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onReset}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Intervio<span className="text-brand-400">.Ai</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multimodal Adaptive AI Interviewer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {candidate && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-slate-800 text-xs text-slate-200">
              <User className="w-3.5 h-3.5 text-brand-400" />
              <span className="font-semibold">{candidate.name}</span>
            </div>
          )}

          {statusText ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{statusText}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-slate-800 text-xs text-slate-400 hidden sm:flex">
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              <span>Engine Ready</span>
            </div>
          )}

          {onReset && (
            <button
              onClick={onReset}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-dark-850 transition-colors cursor-pointer"
            >
              New Interview
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors md:hidden cursor-pointer"
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
