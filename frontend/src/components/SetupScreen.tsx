import React, { useState } from 'react';
import { 
  Briefcase, 
  Sparkles, 
  User, 
  Layers, 
  Sliders, 
  ArrowRight, 
  ShieldCheck,
  Cpu
} from 'lucide-react';

import { CandidateResponse } from '../types/api';
import { RoleSelector } from './RoleSelector';

interface SetupScreenProps {
  onStart: (data: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    difficulty: string;
    interviewType: string;
    numberOfQuestions?: number;
  }) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
  candidate?: CandidateResponse | null;
}

const DIFFICULTIES = [
  { id: 'easy', label: 'Entry / Junior', desc: 'Core fundamentals & definitions' },
  { id: 'medium', label: 'Mid-Level', desc: 'Practical implementations & trade-offs' },
  { id: 'hard', label: 'Senior / Lead', desc: 'Deep architecture, edge-cases & scaling' },
];

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical Assessment', desc: 'Syntax, data structures, backend logic' },
  { id: 'system_design', label: 'System Design', desc: 'High-level architectures, scaling & caching' },
  { id: 'behavioral', label: 'Behavioral & Leadership', desc: 'Team communication & incident resolution' },
];

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, isLoading, error, candidate }) => {
  // Determine defaults based on candidate profile if authenticated
  const defaultRole = React.useMemo(() => {
    if (candidate?.target_role && candidate.target_role.trim()) {
      return candidate.target_role.trim();
    }
    return 'Backend Developer';
  }, [candidate]);

  const defaultDifficulty = React.useMemo(() => {
    if (!candidate?.experience_level) return 'medium';
    if (candidate.experience_level === 'junior') return 'easy';
    if (candidate.experience_level === 'senior' || candidate.experience_level === 'staff') return 'hard';
    return 'medium';
  }, [candidate]);

  const defaultType = React.useMemo(() => {
    if (!candidate?.preferred_interview_type) return 'technical';
    const found = INTERVIEW_TYPES.find(t => t.id === candidate.preferred_interview_type);
    return found ? found.id : 'technical';
  }, [candidate]);

  const [name, setName] = useState(candidate?.name || 'Alex Morgan');
  const [email, setEmail] = useState(candidate?.email || 'alex.morgan@example.com');
  const [role, setRole] = useState(defaultRole);
  const [difficulty, setDifficulty] = useState(defaultDifficulty);
  const [interviewType, setInterviewType] = useState(defaultType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!name.trim() || !email.trim()) return;
    onStart({
      candidateName: name.trim(),
      candidateEmail: email.trim(),
      role,
      difficulty,
      interviewType,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* 3D-inspired Hero Banner */}
      <div className="perspective-container mb-8">
        <div className="card-3d perspective-tilt p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Evaluation Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                AI-Orchestrated Technical Interview
              </h1>
              <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                Experience an adaptive assessment calibrated with Sentence Transformer semantic evaluation, 
                audio pacing analysis, and visual engagement tracking.
              </p>
            </div>

            {/* 3D Depth Spec Pill */}
            <div className="hidden md:flex flex-col gap-2 p-4 rounded-xl bg-dark-900/80 border border-slate-800 shadow-inner">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                <Cpu className="w-4 h-4 text-brand-cyan" />
                <span>MiniLM-L6 Semantic</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Adaptive Difficulty</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{error}</span>
        </div>
      )}

      {/* Setup Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Candidate Information Card */}
        <div className="card-3d p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-brand-400" />
              <span>Candidate Profile</span>
            </h2>
            {candidate && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Authenticated Account
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={Boolean(candidate)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-75 disabled:bg-dark-950"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={Boolean(candidate)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jordan@example.com"
                  className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-75 disabled:bg-dark-950"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="card-3d p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-cyan" />
              <span>Target Role & Track</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Select or search below
            </span>
          </div>

          <RoleSelector
            value={role}
            onChange={(newRole) => setRole(newRole)}
            disabled={isLoading}
          />
        </div>

        {/* Difficulty & Question Count */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Difficulty */}
          <div className="card-3d p-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-brand-emerald" />
              <span>Starting Difficulty</span>
            </h2>
            <div className="space-y-2.5">
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.id;
                return (
                  <label
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selected
                        ? 'bg-brand-500/15 border-brand-500 text-white shadow-md'
                        : 'bg-dark-850 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      checked={selected}
                      onChange={() => setDifficulty(d.id)}
                      className="mt-0.5 text-brand-500 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{d.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Interview Type & Questions Count */}
          <div className="card-3d p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-brand-amber" />
                <span>Interview Format</span>
              </h2>
              <div className="space-y-2.5 mb-5">
                {INTERVIEW_TYPES.map((t) => {
                  const selected = interviewType === t.id;
                  return (
                    <label
                      key={t.id}
                      onClick={() => setInterviewType(t.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selected
                          ? 'bg-brand-500/15 border-brand-500 text-white shadow-md'
                          : 'bg-dark-850 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="interviewType"
                        checked={selected}
                        onChange={() => setInterviewType(t.id)}
                        className="mt-0.5 text-brand-500 focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold">{t.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* AI-Controlled Assessment Length Indicator */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Assessment Length:</span>
                </span>
                <span className="font-bold text-brand-300 bg-brand-500/10 px-2.5 py-0.5 rounded border border-brand-500/20 font-mono text-[11px]">
                  {difficulty === 'easy' ? '5–8 Questions' : difficulty === 'hard' ? '7–12 Questions' : '6–10 Questions'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Adaptive AI dynamically evaluates your answers and concludes once sufficient assessment evidence is established.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-3d w-full py-4 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 hover:from-brand-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Initializing Interview & Generating Bank...</span>
              </>
            ) : (
              <>
                <span>Begin Adaptive Interview Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
