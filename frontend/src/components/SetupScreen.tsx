import React, { useState } from 'react';
import { 
  Briefcase, 
  Sparkles, 
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

  const candidateName = candidate?.name || 'Alex Morgan';
  const candidateEmail = candidate?.email || 'alex.morgan@example.com';
  const [role, setRole] = useState(defaultRole);
  const [difficulty, setDifficulty] = useState(defaultDifficulty);
  const [interviewType, setInterviewType] = useState(defaultType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onStart({
      candidateName,
      candidateEmail,
      role,
      difficulty,
      interviewType,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-fadeIn">
      {/* 3D Hero Banner */}
      <div className="perspective-container mb-8">
        <div className="card-3d perspective-tilt p-6 sm:p-8 relative overflow-hidden bg-gradient-to-r from-white via-indigo-50/40 to-cyan-50/30 border border-slate-200/90 shadow-[0_20px_40px_-15px_rgba(99,102,241,0.08)]">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold mb-3 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Next-Gen Evaluation Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                AI-Orchestrated Technical Interview
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-xl font-medium leading-relaxed">
                Experience an adaptive assessment calibrated with Sentence Transformer semantic evaluation, 
                audio pacing analysis, and visual engagement tracking.
              </p>
            </div>

            {/* 3D Depth Spec Pill */}
            <div className="hidden md:flex flex-col gap-2 p-4 rounded-2xl bg-white/90 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-bold font-mono">
                <Cpu className="w-4 h-4 text-cyan-600" />
                <span>MiniLM-L6 Semantic</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 font-bold font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Adaptive Difficulty</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3 font-semibold">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Setup Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection */}
        <div className="card-3d p-6 relative z-30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>Target Role & Track</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono font-semibold hidden sm:inline">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Difficulty */}
          <div className="card-3d p-6">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Starting Difficulty</span>
            </h2>
            <div role="radiogroup" aria-label="Starting Difficulty" className="space-y-2.5">
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.id;
                return (
                  <label
                    key={d.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setDifficulty(d.id);
                      }
                    }}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selected
                        ? 'bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      aria-label={d.label}
                      checked={selected}
                      onChange={() => setDifficulty(d.id)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{d.label}</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">{d.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Interview Type & Questions Count */}
          <div className="card-3d p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-cyan-600" />
                <span>Interview Format</span>
              </h2>
              <div role="radiogroup" aria-label="Interview Format" className="space-y-2.5 mb-5">
                {INTERVIEW_TYPES.map((t) => {
                  const selected = interviewType === t.id;
                  return (
                    <label
                      key={t.id}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setInterviewType(t.id);
                        }
                      }}
                      onClick={() => setInterviewType(t.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        selected
                          ? 'bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="interviewType"
                        aria-label={t.label}
                        checked={selected}
                        onChange={() => setInterviewType(t.id)}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">{t.label}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{t.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* AI-Controlled Assessment Length Indicator */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-700 font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Assessment Length:</span>
                </span>
                <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/70 font-mono text-[11px]">
                  {difficulty === 'easy' ? '5–8 Questions' : difficulty === 'hard' ? '7–12 Questions' : '6–10 Questions'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
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
            aria-busy={isLoading}
            className="btn-3d w-full py-4 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-500/25"
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
