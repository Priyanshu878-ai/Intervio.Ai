import React from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  History, 
  User, 
  LogOut, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { CandidateResponse } from '../types/api';

export type NavigationTab = 'dashboard' | 'setup' | 'history' | 'profile';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  candidate: CandidateResponse;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  candidate,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'setup' as NavigationTab, label: 'Start Interview', icon: PlayCircle },
    { id: 'history' as NavigationTab, label: 'Interview History', icon: History },
    { id: 'profile' as NavigationTab, label: 'Profile', icon: User },
  ];

  return (
    <aside className="w-64 bg-dark-900/80 border-r border-slate-800 hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                <span>Intervio</span>
                <span className="text-brand-400">.Ai</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-normal">v2.0</span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">Multimodal AI Assessor</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Evaluation Engine Ready</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-md shadow-brand-500/25 border border-brand-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-dark-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-dark-950/80 border border-slate-800/80 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-cyan/20 to-indigo-500/20 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan text-xs font-bold shrink-0">
              {candidate.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">{candidate.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{candidate.target_role || candidate.email}</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
