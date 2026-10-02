import React from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  History, 
  User, 
  LogOut, 
  Sparkles,
  ChevronRight,
  FileSearch,
  FileText,
  Settings
} from 'lucide-react';
import { CandidateResponse } from '../types/api';

export type NavigationTab = 'dashboard' | 'setup' | 'history' | 'profile';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  candidate: CandidateResponse;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  candidate,
  onLogout,
  onOpenSettings,
}) => {
  const mainNavItems = [
    { id: 'dashboard' as NavigationTab, label: 'Interviews & Dashboard', icon: LayoutDashboard },
    { id: 'setup' as NavigationTab, label: 'Start Interview', icon: PlayCircle },
    { id: 'history' as NavigationTab, label: 'Interview History', icon: History },
  ];

  const comingSoonItems = [
    { label: 'Resume Analyzer', icon: FileSearch },
    { label: 'Resume Builder', icon: FileText },
  ];

  return (
    <aside 
      aria-label="Application Sidebar" 
      className="w-64 bg-white/85 border-r border-slate-200/80 hidden md:flex flex-col justify-between shrink-0 h-screen fixed top-0 left-0 bottom-0 z-30 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
    >
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>Intervio</span>
                <span className="text-indigo-600">.Ai</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/70 font-semibold">v2.0</span>
              </h2>
              <p className="text-[11px] text-slate-500 truncate font-medium">Multimodal AI Assessor</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-[11px] text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Evaluation Engine Active</span>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="p-4 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
              Core Platform
            </div>
            <nav aria-label="Main Navigation" className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/80 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-90" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* AI Tools / Future Modules */}
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
              AI Tools
            </div>
            <div className="space-y-1">
              {comingSoonItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-50/60 border border-slate-200/50 cursor-not-allowed opacity-75"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 border border-slate-300/60">
                      Soon
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account & Settings */}
          <div>
            <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
              Account
            </div>
            <div className="space-y-1">
              <button
                onClick={() => onSelectTab('profile')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <User className={`w-4 h-4 ${currentTab === 'profile' ? 'text-white' : 'text-slate-500'}`} />
                  <span>Profile</span>
                </div>
                {currentTab === 'profile' && <ChevronRight className="w-3.5 h-3.5 opacity-90" />}
              </button>

              <button
                onClick={() => {
                  if (onOpenSettings) onOpenSettings();
                  else onSelectTab('profile');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-100/80 border border-transparent transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Card & Logout Footer */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/10 to-cyan-500/10 border border-indigo-200/80 flex items-center justify-center text-indigo-600 text-xs font-extrabold shrink-0">
              {candidate.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-extrabold text-slate-900 truncate">{candidate.name}</div>
              <div className="text-[10px] text-slate-500 truncate font-medium">{candidate.target_role || candidate.email}</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Sign Out of Account"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-all cursor-pointer shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
