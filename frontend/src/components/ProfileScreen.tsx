import React, { useState, useEffect } from 'react';
import { 
  User, 
  Briefcase, 
  Code, 
  Check, 
  AlertCircle, 
  Save,
  ShieldCheck,
  TrendingUp,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Layers,
  HelpCircle,
  Play
} from 'lucide-react';
import { CandidateResponse, CandidateProfileUpdate, CandidateIntelligenceResponse } from '../types/api';
import { api } from '../services/api';
import { ProgressTrendChart } from './ProgressTrendChart';

interface ProfileScreenProps {
  candidate: CandidateResponse;
  onProfileUpdated: (updated: CandidateResponse) => void;
  onStartInterview?: () => void;
}

const ROLES = [
  'Full Stack Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Machine Learning Engineer',
  'DevOps / Cloud SRE',
  'System Architect',
];

const EXPERIENCE_LEVELS = [
  { id: 'junior', label: 'Entry / Junior (0-2 years)' },
  { id: 'mid', label: 'Mid-Level (2-5 years)' },
  { id: 'senior', label: 'Senior / Lead (5+ years)' },
  { id: 'staff', label: 'Staff / Principal (8+ years)' },
];

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical & Algorithmic' },
  { id: 'system_design', label: 'Distributed Systems & Architecture' },
  { id: 'behavioral', label: 'Behavioral & Leadership' },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  candidate,
  onProfileUpdated,
  onStartInterview,
}) => {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'settings'>('intelligence');
  
  // Profile settings state
  const [name, setName] = useState(candidate.name);
  const [targetRole, setTargetRole] = useState(candidate.target_role || 'Full Stack Engineer');
  const [experienceLevel, setExperienceLevel] = useState(candidate.experience_level || 'mid');
  const [skills, setSkills] = useState(candidate.skills || 'React, TypeScript, Python, FastAPI, PostgreSQL');
  const [preferredInterviewType, setPreferredInterviewType] = useState(candidate.preferred_interview_type || 'technical');

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intelligence data state
  const [intelligence, setIntelligence] = useState<CandidateIntelligenceResponse | null>(null);
  const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(true);
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);

  const fetchIntelligence = async () => {
    setIsIntelligenceLoading(true);
    setIntelligenceError(null);
    try {
      const data = await api.getMyIntelligence();
      setIntelligence(data);
    } catch (err: any) {
      setIntelligenceError(err?.message || 'Failed to load candidate intelligence analytics.');
      setIntelligence(null);
    } finally {
      setIsIntelligenceLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsIntelligenceLoading(true);
      setIntelligenceError(null);
      try {
        const data = await api.getMyIntelligence();
        if (isMounted) setIntelligence(data);
      } catch (err: any) {
        if (isMounted) {
          setIntelligenceError(err?.message || 'Failed to load candidate intelligence analytics.');
          setIntelligence(null);
        }
      } finally {
        if (isMounted) setIsIntelligenceLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [candidate.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setSuccessMsg(null);
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('Name must be at least 2 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: CandidateProfileUpdate = {
        name: trimmedName,
        target_role: targetRole.trim(),
        experience_level: experienceLevel,
        skills: skills.trim(),
        preferred_interview_type: preferredInterviewType,
      };
      const updated = await api.updateProfile(updateData);
      onProfileUpdated(updated);
      setSuccessMsg('Profile information updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Top Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-xs font-bold mb-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Candidate Intelligence & Progress</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{candidate.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Deterministic competency analytics, trajectory trends, and actionable skill recommendations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div role="tablist" aria-label="Candidate Profile Sections" className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-2xl">
          <button
            id="tab-intelligence"
            role="tab"
            aria-selected={activeTab === 'intelligence'}
            aria-controls="tabpanel-intelligence"
            onClick={() => setActiveTab('intelligence')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'intelligence'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Intelligence & Progress</span>
          </button>

          <button
            id="tab-settings"
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-controls="tabpanel-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account & Targets</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INTELLIGENCE & PROGRESS TRACKING */}
      {activeTab === 'intelligence' && (
        <div id="tabpanel-intelligence" role="tabpanel" aria-labelledby="tab-intelligence" className="space-y-6 animate-fadeIn">
          {isIntelligenceLoading ? (
            <div className="card-3d p-12 text-center text-slate-500 space-y-3 font-semibold">
              <span className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block" />
              <div className="text-xs font-bold">Synthesizing candidate intelligence...</div>
            </div>
          ) : intelligenceError ? (
            <div className="card-3d p-10 sm:p-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto shadow-xs">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Failed to Load Candidate Intelligence</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
                {intelligenceError}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={fetchIntelligence}
                  className="btn-3d-secondary px-6 py-2.5 text-slate-900 font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Retry Loading</span>
                </button>
              </div>
            </div>
          ) : !intelligence || !intelligence.has_data ? (
            /* Empty State */
            <div className="card-3d p-10 sm:p-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto shadow-xs">
                <HelpCircle className="w-8 h-8 opacity-60 text-slate-400" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">No Completed Evaluations Recorded Yet</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
                Complete your first adaptive interview session to establish an initial performance baseline. 
                Once evaluated, your multi-session performance trend, communication analytics, technical strengths, 
                and targeted practice areas will appear here automatically.
              </p>
              {onStartInterview && (
                <div className="pt-2">
                  <button
                    onClick={onStartInterview}
                    className="btn-3d px-6 py-2.5 text-white font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start First Interview Session</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Intelligence Analytics Grid */
            <>
              {/* 1. Overall Progress Summary Banner */}
              <div className="card-3d p-6 relative overflow-hidden bg-gradient-to-r from-white via-indigo-50/40 to-cyan-50/30 border border-slate-200/90 shadow-sm">
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                      <TrendingUp className="w-4 h-4" />
                      <span>Executive Trajectory Summary</span>
                    </div>

                    {/* Comparative Score Delta Badge */}
                    {intelligence.score_delta !== null ? (
                      <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 border ${
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
                            ? `+${intelligence.score_delta}% vs previous avg`
                            : intelligence.score_delta < 0
                            ? `${intelligence.score_delta}% vs previous avg`
                            : 'Consistent with previous avg'}
                        </span>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 font-bold">
                        Baseline Session Established
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed max-w-3xl font-medium">
                    {intelligence.overall_progress_summary}
                  </p>

                  {/* Core KPI metrics row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase font-extrabold block">Overall Average</span>
                      <span className="text-xl font-black font-mono text-slate-900 mt-0.5 block">
                        {intelligence.overall_average_score !== null ? `${intelligence.overall_average_score}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase font-extrabold block">Latest Score</span>
                      <span className="text-xl font-black font-mono text-indigo-600 mt-0.5 block">
                        {intelligence.recent_score !== null ? `${intelligence.recent_score}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase font-extrabold block">Technical Average</span>
                      <span className="text-xl font-black font-mono text-emerald-600 mt-0.5 block">
                        {intelligence.technical_average !== null ? `${intelligence.technical_average}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase font-extrabold block">Delivery / Comm</span>
                      <span className="text-xl font-black font-mono text-cyan-600 mt-0.5 block">
                        {intelligence.communication_average !== null ? `${intelligence.communication_average}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Visual Trends */}
              <div className="card-3d p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                      Performance & Communication Trajectory
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono font-semibold">
                    Session-by-Session Evolution
                  </span>
                </div>

                <ProgressTrendChart
                  performanceTrend={intelligence.performance_trend}
                  communicationTrend={intelligence.communication_trend}
                />
              </div>

              {/* 3. Strengths & Weak Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technical Strengths */}
                <div className="card-3d p-6 border-emerald-200">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-4">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>Technical Strengths & Competencies</span>
                  </div>
                  {intelligence.technical_strengths.length === 0 ? (
                    <p className="text-xs text-slate-500 font-medium">Complete more evaluations to identify persistent strengths.</p>
                  ) : (
                    <ul className="space-y-3">
                      {intelligence.technical_strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                          <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                          <span className="leading-relaxed">{str}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Weak Areas / Growth Focus */}
                <div className="card-3d p-6 border-amber-200">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700 mb-4">
                    <Target className="w-4 h-4 text-amber-600" />
                    <span>Targeted Growth & Weak Areas</span>
                  </div>
                  {intelligence.weak_areas.length === 0 ? (
                    <p className="text-xs text-slate-500 font-medium">No persistent deficiencies detected.</p>
                  ) : (
                    <ul className="space-y-3">
                      {intelligence.weak_areas.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                          <span className="text-amber-600 font-bold mt-0.5">→</span>
                          <span className="leading-relaxed">{area}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 4. Roles & Interview Formats Attempted */}
              <div className="card-3d p-6">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-4">
                  <Layers className="w-4 h-4 text-cyan-600" />
                  <span>Coverage: Roles & Formats Attempted</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Roles */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Target Tracks
                    </span>
                    <div className="space-y-2">
                      {intelligence.roles_attempted.map((r) => (
                        <div
                          key={r.role}
                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-medium shadow-xs"
                        >
                          <span className="font-extrabold text-slate-900 capitalize">{r.role}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-mono font-semibold">
                              {r.count} session(s)
                            </span>
                            {r.average_score !== null && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-[10px]">
                                {r.average_score}% avg
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interview Types */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Interview Formats
                    </span>
                    <div className="space-y-2">
                      {intelligence.interview_types_attempted.map((t) => (
                        <div
                          key={t.interview_type}
                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-medium shadow-xs"
                        >
                          <span className="font-extrabold text-slate-900 capitalize">
                            {t.interview_type.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-mono font-semibold">
                              {t.count} session(s)
                            </span>
                            {t.average_score !== null && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-mono font-bold text-[10px]">
                                {t.average_score}% avg
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Recent Improvements & Practice Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-3d p-6">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-600 mb-4">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Recent Session Improvements</span>
                  </div>
                  <ul className="space-y-2.5">
                    {intelligence.recent_improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                        <span className="text-indigo-600 mt-0.5 font-bold">↑</span>
                        <span className="leading-relaxed">{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card-3d p-6">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan-600 mb-4">
                    <Target className="w-4 h-4 text-cyan-600" />
                    <span>Suggested Actionable Practice</span>
                  </div>
                  <ul className="space-y-2.5">
                    {intelligence.suggested_practice_areas.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                        <span className="text-cyan-600 mt-0.5 font-bold">✦</span>
                        <span className="leading-relaxed">{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: ACCOUNT SETTINGS & PROFILE DETAILS */}
      {activeTab === 'settings' && (
        <div id="tabpanel-settings" role="tabpanel" aria-labelledby="tab-settings" className="animate-fadeIn space-y-6">
          {successMsg && (
            <div role="status" aria-live="polite" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5 font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div role="alert" aria-live="assertive" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="card-3d p-6 sm:p-8 space-y-6">
            {/* Personal Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Personal Identity</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-sm"
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address (Registered)
                  </label>
                  <div className="relative">
                    <input
                      id="profile-email"
                      type="email"
                      value={candidate.email}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none font-medium"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Target Role and Experience */}
            <div className="border-t border-slate-200/80 pt-6 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-cyan-600" />
                <span>Career & Interview Target</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-target-role" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Role
                  </label>
                  <select
                    id="profile-target-role"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-medium shadow-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-white text-slate-900">{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="profile-experience-level" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Experience Level
                  </label>
                  <select
                    id="profile-experience-level"
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-medium shadow-sm"
                  >
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <option key={lvl.id} value={lvl.id} className="bg-white text-slate-900">{lvl.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="profile-interview-type" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Preferred Interview Format
                </label>
                <select
                  id="profile-interview-type"
                  value={preferredInterviewType}
                  onChange={(e) => setPreferredInterviewType(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-medium shadow-sm"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t.id} value={t.id} className="bg-white text-slate-900">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skills */}
            <div className="border-t border-slate-200/80 pt-6 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                <span>Technical Skills & Stacks</span>
              </h3>

              <div>
                <label htmlFor="profile-skills" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Skills (Comma-separated)
                </label>
                <input
                  id="profile-skills"
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, TypeScript, Python, Docker, Kubernetes, PostgreSQL"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  These skill tags are utilized by the adaptive engine to tailor interview question generation.
                </p>
              </div>
            </div>

            {/* Save Action */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end">
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="btn-3d px-6 py-2.5 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
