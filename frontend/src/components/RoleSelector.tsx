import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Check, 
  X, 
  Sparkles, 
  Plus, 
  ChevronDown 
} from 'lucide-react';

export interface RoleItem {
  id: string;
  title: string;
  category: string;
  icon: string;
  keywords: string[];
}

export const POPULAR_ROLES = [
  'Full Stack Developer',
  'Backend Developer',
  'Frontend Developer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'Data Scientist',
];

export const TECHNICAL_ROLES: RoleItem[] = [
  { id: 'backend-developer', title: 'Backend Developer', category: 'Backend & Systems', icon: '⚡', keywords: ['api', 'database', 'sql', 'microservices', 'server'] },
  { id: 'frontend-developer', title: 'Frontend Developer', category: 'Frontend & Web', icon: '🎨', keywords: ['ui', 'ux', 'html', 'css', 'javascript', 'web'] },
  { id: 'fullstack-developer', title: 'Full Stack Developer', category: 'Full Stack', icon: '🚀', keywords: ['web', 'backend', 'frontend', 'database', 'rest'] },
  { id: 'java-developer', title: 'Java Developer', category: 'Backend & Systems', icon: '☕', keywords: ['spring', 'springboot', 'jvm', 'hibernate', 'microservices'] },
  { id: 'python-developer', title: 'Python Developer', category: 'Backend & Systems', icon: '🐍', keywords: ['django', 'fastapi', 'flask', 'automation', 'backend'] },
  { id: 'cpp-developer', title: 'C++ Developer', category: 'Systems & Embedded', icon: '⚙️', keywords: ['c++', 'embedded', 'low-level', 'memory', 'performance', 'concurrency'] },
  { id: 'react-developer', title: 'React Developer', category: 'Frontend & Web', icon: '⚛️', keywords: ['redux', 'next.js', 'typescript', 'ui', 'hooks'] },
  { id: 'nodejs-developer', title: 'Node.js Developer', category: 'Backend & Systems', icon: '🟢', keywords: ['javascript', 'express', 'nest.js', 'npm', 'backend'] },
  { id: 'software-engineer', title: 'Software Engineer', category: 'General Engineering', icon: '💻', keywords: ['algorithms', 'system', 'architecture', 'swe', 'code'] },
  { id: 'data-analyst', title: 'Data Analyst', category: 'Data & Analytics', icon: '📊', keywords: ['sql', 'bi', 'tableau', 'excel', 'reporting', 'analytics'] },
  { id: 'data-scientist', title: 'Data Scientist', category: 'Data & AI', icon: '📈', keywords: ['python', 'statistics', 'pandas', 'modeling', 'ml'] },
  { id: 'ml-engineer', title: 'Machine Learning Engineer', category: 'Data & AI', icon: '🧠', keywords: ['ai', 'deep learning', 'pytorch', 'tensorflow', 'nlp', 'llm'] },
  { id: 'ai-engineer', title: 'AI Engineer', category: 'Data & AI', icon: '🤖', keywords: ['genai', 'rag', 'llm', 'prompts', 'transformers', 'agents'] },
  { id: 'devops-engineer', title: 'DevOps Engineer', category: 'Cloud & Infrastructure', icon: '🔄', keywords: ['ci/cd', 'docker', 'kubernetes', 'jenkins', 'automation'] },
  { id: 'cloud-engineer', title: 'Cloud Engineer', category: 'Cloud & Infrastructure', icon: '☁️', keywords: ['aws', 'azure', 'gcp', 'terraform', 'infrastructure'] },
  { id: 'cybersecurity-engineer', title: 'Cybersecurity Engineer', category: 'Security & Quality', icon: '🛡️', keywords: ['security', 'penetration', 'encryption', 'infosec', 'firewall'] },
  { id: 'qa-engineer', title: 'QA / Test Engineer', category: 'Security & Quality', icon: '🧪', keywords: ['testing', 'selenium', 'cypress', 'automation', 'quality'] },
  { id: 'mobile-developer', title: 'Mobile Developer', category: 'Mobile & Apps', icon: '📱', keywords: ['ios', 'android', 'flutter', 'react native', 'apps'] },
  { id: 'android-developer', title: 'Android Developer', category: 'Mobile & Apps', icon: '🤖', keywords: ['kotlin', 'java', 'gradle', 'jetpack compose', 'android sdk'] },
  { id: 'ios-developer', title: 'iOS Developer', category: 'Mobile & Apps', icon: '🍏', keywords: ['swift', 'swiftui', 'xcode', 'cocoapods', 'ios sdk'] },
  { id: 'ui-ux-developer', title: 'UI/UX Developer', category: 'Frontend & Web', icon: '✨', keywords: ['design', 'css', 'tailwind', 'figma', 'responsive', 'animation'] },
  { id: 'system-design-engineer', title: 'System Design Engineer', category: 'Architecture', icon: '🏛️', keywords: ['distributed', 'scalability', 'caching', 'microservices', 'high availability'] },
  { id: 'database-engineer', title: 'Database Engineer', category: 'Backend & Systems', icon: '🗄️', keywords: ['sql', 'postgresql', 'mysql', 'mongodb', 'sharding', 'indexing'] },
  { id: 'sre-engineer', title: 'Site Reliability Engineer (SRE)', category: 'Cloud & Infrastructure', icon: '⏱️', keywords: ['reliability', 'monitoring', 'observability', 'incident', 'sla'] },
  { id: 'blockchain-developer', title: 'Blockchain Developer', category: 'Specialized', icon: '⛓️', keywords: ['solidity', 'web3', 'smart contracts', 'ethereum', 'crypto'] },
  { id: 'embedded-systems-engineer', title: 'Embedded Systems Engineer', category: 'Systems & Embedded', icon: '🔌', keywords: ['c', 'firmware', 'rtos', 'microcontrollers', 'hardware'] },
];

interface RoleSelectorProps {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange, disabled = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered suggestions algorithm
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      // Return top 8 general recommendations when query is blank
      return TECHNICAL_ROLES.slice(0, 8);
    }

    const matched = TECHNICAL_ROLES.filter((item) => {
      const titleLower = item.title.toLowerCase();
      // 1. Prefix match (e.g. "jav", "rea", "dat", "clo")
      if (titleLower.startsWith(q)) return true;
      // 2. Individual word prefix match (e.g. "dev", "eng", "sci")
      const words = titleLower.split(/\s+/);
      if (words.some((w) => w.startsWith(q))) return true;
      // 3. Substring match
      if (titleLower.includes(q)) return true;
      // 4. Keyword match
      if (item.keywords.some((k) => k.includes(q))) return true;
      return false;
    });

    // Rank matched items: Exact match > Title prefix > Word prefix > Substring/Keyword
    return matched.sort((a, b) => {
      const aLower = a.title.toLowerCase();
      const bLower = b.title.toLowerCase();
      if (aLower === q) return -1;
      if (bLower === q) return 1;

      const aStarts = aLower.startsWith(q);
      const bStarts = bLower.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aWordStarts = aLower.split(/\s+/).some((w) => w.startsWith(q));
      const bWordStarts = bLower.split(/\s+/).some((w) => w.startsWith(q));
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;

      const aIncludes = aLower.includes(q);
      const bIncludes = bLower.includes(q);
      if (aIncludes && !bIncludes) return -1;
      if (!aIncludes && bIncludes) return 1;

      return a.title.localeCompare(b.title);
    });
  }, [searchQuery]);

  // Is exact match found?
  const hasExactMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return TECHNICAL_ROLES.some((r) => r.title.toLowerCase() === q);
  }, [searchQuery]);

  // Find info about currently selected role
  const selectedRoleInfo = useMemo(() => {
    if (!value) return null;
    const found = TECHNICAL_ROLES.find(
      (r) => r.title.toLowerCase() === value.toLowerCase() || r.id === value.toLowerCase()
    );
    if (found) return found;
    return {
      id: 'custom',
      title: value,
      category: 'Custom Role',
      icon: '🎯',
      keywords: [],
    };
  }, [value]);

  const handleSelectRole = (roleTitle: string) => {
    onChange(roleTitle);
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalOptions = suggestions.length + (!hasExactMatch && searchQuery.trim() ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < totalOptions ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalOptions - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectRole(suggestions[highlightedIndex].title);
      } else if (!hasExactMatch && searchQuery.trim()) {
        handleSelectRole(searchQuery.trim());
      } else if (suggestions.length > 0) {
        handleSelectRole(suggestions[0].title);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4 relative z-30">
      {/* 1. Selected Role Pill / Card */}
      <div className="p-3.5 rounded-xl bg-dark-900/90 border border-slate-800 shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-brand-500/20 to-brand-cyan/20 border border-brand-500/30 flex items-center justify-center text-lg shrink-0">
            {selectedRoleInfo?.icon || '⚡'}
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span>Active Target Track</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>{selectedRoleInfo?.title || 'Backend Developer'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/25 text-brand-300 font-mono">
                {selectedRoleInfo?.category || 'Standard Track'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
          className="text-xs font-semibold text-brand-400 hover:text-brand-300 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-colors self-start sm:self-auto cursor-pointer"
        >
          Change Role
        </button>
      </div>

      {/* 2. Searchable Input & Dropdown */}
      <div className="relative z-40">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search roles (e.g. Java, React, Data, Cloud) or type custom..."
            className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          )}
        </div>

        {/* Floating Suggestion Dropdown */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-2 bg-dark-900/95 border border-slate-700/90 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden animate-fadeIn max-h-80 flex flex-col">
            <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400 bg-dark-950/70">
              <span>SUGGESTED ROLES ({suggestions.length})</span>
              <span className="font-normal text-slate-500">Press ↵ Enter to select</span>
            </div>

            <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-800/40 overscroll-contain">
              {suggestions.map((item, idx) => {
                const isSelected = value.toLowerCase() === item.title.toLowerCase();
                const isHighlighted = highlightedIndex === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectRole(item.title)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isHighlighted
                        ? 'bg-brand-500/20 text-white border border-brand-500/40'
                        : isSelected
                        ? 'bg-brand-500/10 text-white'
                        : 'text-slate-300 hover:bg-dark-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{item.icon}</span>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{item.title}</span>
                          {isSelected && (
                            <span className="text-[10px] text-emerald-400 font-normal">
                              (Current)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.category}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}

              {/* Custom Role Option when query is typed and not exactly matched */}
              {!hasExactMatch && searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectRole(searchQuery.trim())}
                  onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    highlightedIndex === suggestions.length
                      ? 'bg-brand-500/20 text-white border border-brand-500/40'
                      : 'text-brand-300 bg-brand-500/5 hover:bg-brand-500/15'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-brand-500/20 flex items-center justify-center text-brand-300">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Use custom role: <span className="text-brand-400 underline">"{searchQuery.trim()}"</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Create custom interview assessment track
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono">
                    Custom
                  </span>
                </button>
              )}

              {suggestions.length === 0 && hasExactMatch && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No predefined roles match your query.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Popular Roles Quick Select Section */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-brand-400" />
          <span>Popular Roles</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_ROLES.map((popRole) => {
            const isSelected = value.toLowerCase() === popRole.toLowerCase();
            return (
              <button
                key={popRole}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectRole(popRole)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand-500 text-white border-brand-400 shadow-md shadow-brand-500/20'
                    : 'bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                {popRole}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
