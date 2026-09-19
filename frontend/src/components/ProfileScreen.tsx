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

  useEffect(() => {
    const fetchIntelligence = async () => {
      setIsIntelligenceLoading(true);
      try {
        const data = await api.getMyIntelligence();
        setIntelligence(data);
      } catch {
        // graceful empty fallback if network/auth issues
        setIntelligence(null);
      } finally {
        setIsIntelligenceLoading(false);
      }
    };

    fetchIntelligence();
  }, [candidate.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Candidate Intelligence & Progress</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{candidate.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic competency analytics, trajectory trends, and actionable skill recommendations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-dark-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'intelligence'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Intelligence & Progress</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account & Targets</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INTELLIGENCE & PROGRESS TRACKING */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6 animate-fadeIn">
          {isIntelligenceLoading ? (
            <div className="card-3d p-12 text-center text-slate-400 space-y-3">
              <span className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin inline-block" />
              <div className="text-xs font-semibold">Synthesizing candidate intelligence...</div>
            </div>
          ) : !intelligence || !intelligence.has_data ? (
            /* Clear, Constructive Empty State */
            <div className="card-3d p-10 sm:p-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-dark-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto shadow-inner">
                <HelpCircle className="w-8 h-8 opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-white">No Completed Evaluations Recorded Yet</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Complete your first adaptive interview session to establish an initial performance baseline. 
                Once evaluated, your multi-session performance trend, communication analytics, technical strengths, 
                and targeted practice areas will appear here automatically.
              </p>
              {onStartInterview && (
                <div className="pt-2">
                  <button
                    onClick={onStartInterview}
                    className="btn-3d px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-500/25"
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
              {/* 1. Overall Progress & Comparative Summary Banner */}
              <div className="card-3d p-6 relative overflow-hidden bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-slate-800">
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>Executive Trajectory Summary</span>
                    </div>

                    {/* Comparative Score Delta Badge */}
                    {intelligence.score_delta !== null ? (
                      <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 border ${
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
                            ? `+${intelligence.score_delta}% vs previous avg`
                            : intelligence.score_delta < 0
                            ? `${intelligence.score_delta}% vs previous avg`
                            : 'Consistent with previous avg'}
                        </span>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[11px] font-mono text-slate-400 bg-dark-900 border border-slate-800">
                        Baseline Session Established
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed max-w-3xl">
                    {intelligence.overall_progress_summary}
                  </p>

                  {/* Core KPI metrics row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="bg-dark-900/70 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[11px] text-slate-400 block">Overall Average</span>
                      <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                        {intelligence.overall_average_score !== null ? `${intelligence.overall_average_score}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-dark-900/70 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[11px] text-slate-400 block">Latest Score</span>
                      <span className="text-xl font-bold font-mono text-brand-300 mt-0.5 block">
                        {intelligence.recent_score !== null ? `${intelligence.recent_score}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-dark-900/70 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[11px] text-slate-400 block">Technical Average</span>
                      <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
                        {intelligence.technical_average !== null ? `${intelligence.technical_average}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-dark-900/70 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-[11px] text-slate-400 block">Delivery / Comm</span>
                      <span className="text-xl font-bold font-mono text-cyan-400 mt-0.5 block">
                        {intelligence.communication_average !== null ? `${intelligence.communication_average}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Visual Trends: Performance & Communication Progression */}
              <div className="card-3d p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Performance & Communication Trajectory
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Session-by-Session Evolution
                  </span>
                </div>

                <ProgressTrendChart
                  performanceTrend={intelligence.performance_trend}
                  communicationTrend={intelligence.communication_trend}
                />
              </div>

              {/* 3. Strengths & Weak Areas (Growth Focus) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Technical Strengths */}
                <div className="card-3d p-6 border-emerald-500/20">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">
                    <Award className="w-4 h-4" />
                    <span>Technical Strengths & Competencies</span>
                  </div>
                  {intelligence.technical_strengths.length === 0 ? (
                    <p className="text-xs text-slate-400">Complete more evaluations to identify persistent strengths.</p>
                  ) : (
                    <ul className="space-y-3">
                      {intelligence.technical_strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                          <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                          <span className="leading-relaxed">{str}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Weak Areas / Growth Focus */}
                <div className="card-3d p-6 border-amber-500/20">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
                    <Target className="w-4 h-4" />
                    <span>Targeted Growth & Weak Areas</span>
                  </div>
                  {intelligence.weak_areas.length === 0 ? (
                    <p className="text-xs text-slate-400">No persistent deficiencies detected.</p>
                  ) : (
                    <ul className="space-y-3">
                      {intelligence.weak_areas.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                          <span className="text-amber-400 font-bold mt-0.5">→</span>
                          <span className="leading-relaxed">{area}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 4. Roles & Interview Formats Attempted */}
              <div className="card-3d p-6">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-4">
                  <Layers className="w-4 h-4 text-brand-cyan" />
                  <span>Coverage: Roles & Formats Attempted</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Roles */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Target Tracks
                    </span>
                    <div className="space-y-2">
                      {intelligence.roles_attempted.map((r) => (
                        <div
                          key={r.role}
                          className="p-2.5 rounded-xl bg-dark-900 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-white capitalize">{r.role}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {r.count} session(s)
                            </span>
                            {r.average_score !== null && (
                              <span className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 font-mono font-bold text-[10px]">
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
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Interview Formats
                    </span>
                    <div className="space-y-2">
                      {intelligence.interview_types_attempted.map((t) => (
                        <div
                          key={t.interview_type}
                          className="p-2.5 rounded-xl bg-dark-900 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-white capitalize">
                            {t.interview_type.replace('_', ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {t.count} session(s)
                            </span>
                            {t.average_score !== null && (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono font-bold text-[10px]">
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

              {/* 5. Recent Improvements & Suggested Practice Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recent Improvements */}
                <div className="card-3d p-6">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-4">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Recent Session Improvements</span>
                  </div>
                  <ul className="space-y-2.5">
                    {intelligence.recent_improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="text-indigo-400 mt-0.5 font-bold">↑</span>
                        <span className="leading-relaxed">{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Practice Areas */}
                <div className="card-3d p-6">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-cyan mb-4">
                    <Target className="w-4 h-4" />
                    <span>Suggested Actionable Practice</span>
                  </div>
                  <ul className="space-y-2.5">
                    {intelligence.suggested_practice_areas.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="text-brand-cyan mt-0.5 font-bold">✦</span>
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
        <div className="animate-fadeIn space-y-6">
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="card-3d p-6 sm:p-8 space-y-6">
            {/* Personal Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-brand-400" />
                <span>Personal Identity</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address (Registered)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={candidate.email}
                      disabled
                      className="w-full bg-dark-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed select-none"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Target Role and Experience */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Career & Interview Target</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-dark-900">{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Experience Level
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer"
                  >
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <option key={lvl.id} value={lvl.id} className="bg-dark-900">{lvl.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preferred Interview Format
                </label>
                <select
                  value={preferredInterviewType}
                  onChange={(e) => setPreferredInterviewType(e.target.value)}
                  className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors cursor-pointer"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t.id} value={t.id} className="bg-dark-900">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skills */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>Technical Skills & Stacks</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, TypeScript, Python, Docker, Kubernetes, PostgreSQL"
                  className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  These skill tags are utilized by the adaptive engine to tailor interview question generation.
                </p>
              </div>
            </div>

            {/* Save Action */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-3d px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-500/25 disabled:opacity-50 transition-all"
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
