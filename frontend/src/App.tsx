import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  History, 
  User, 
  Sparkles 
} from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { AuthScreen } from './components/AuthScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { SetupScreen } from './components/SetupScreen';
import { LiveInterviewScreen } from './components/LiveInterviewScreen';
import { InterviewHistoryScreen } from './components/InterviewHistoryScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { ReportDashboard } from './components/ReportDashboard';
import { api } from './services/api';
import { 
  InterviewSessionResponse, 
  SubmitAnswerResponse, 
  FinalInterviewReport,
  InterviewResponse,
  CandidateResponse,
  InterviewHistoryItem
} from './types/api';

type AppScreen = 'dashboard' | 'setup' | 'history' | 'profile' | 'interview' | 'report';

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<CandidateResponse | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Navigation & Data state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [activeInterview, setActiveInterview] = useState<InterviewResponse | null>(null);
  const [session, setSession] = useState<InterviewSessionResponse | null>(null);
  const [report, setReport] = useState<FinalInterviewReport | null>(null);

  // Status & Error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch History Helper
  const refreshHistory = useCallback(async () => {
    try {
      const items = await api.getMyHistory();
      setHistory(items);
    } catch {
      // Ignore background refresh errors
    }
  }, []);

  // 2. Initial Auth Session Check
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getStoredToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }
      try {
        const candidate = await api.getMe();
        setCurrentUser(candidate);
        const userHistory = await api.getMyHistory();
        setHistory(userHistory);
        setCurrentScreen('dashboard');
      } catch {
        api.removeStoredToken();
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    const handleAuthExpired = () => {
      setCurrentUser(null);
      setActiveInterview(null);
      setSession(null);
      setReport(null);
      setHistory([]);
      setCurrentScreen('dashboard');
      setError('Your session has expired. Please sign in again to continue.');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  // 3. Auth Handlers
  const handleAuthSuccess = async (candidate: CandidateResponse) => {
    setCurrentUser(candidate);
    setCurrentScreen('dashboard');
    try {
      const userHistory = await api.getMyHistory();
      setHistory(userHistory);
    } catch {
      setHistory([]);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // proceed with local signout regardless of network
    }
    api.removeStoredToken();
    setCurrentUser(null);
    setActiveInterview(null);
    setSession(null);
    setReport(null);
    setHistory([]);
    setCurrentScreen('dashboard');
  };

  // 4. Setup & Start Interview Flow
  const handleStartSetup = async (data: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    difficulty: string;
    interviewType: string;
    numberOfQuestions?: number;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      let candidateId = currentUser?.id;

      if (!candidateId) {
        const candidate = await api.createCandidate({
          name: data.candidateName,
          email: data.candidateEmail,
        });
        candidateId = candidate.id;
      }

      const interview = await api.createInterview({
        candidate_id: candidateId,
        role: data.role,
        difficulty: data.difficulty,
        interview_type: data.interviewType,
      });
      setActiveInterview(interview);

      await api.generateQuestions(interview.id, data.numberOfQuestions);

      const startedSession = await api.startInterview(interview.id);
      setSession(startedSession);
      setCurrentScreen('interview');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize interview session.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Submit Answer Flow
  const handleSubmitAnswer = async (
    answerText: string,
    audioFile?: File | null,
    videoFile?: File | null
  ): Promise<SubmitAnswerResponse> => {
    if (!activeInterview || !session?.current_question) {
      throw new Error('No active question to submit');
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.submitAnswer(
        activeInterview.id,
        session.current_question.id,
        answerText,
        audioFile,
        videoFile
      );

      const updatedSession = await api.getSession(activeInterview.id);
      setSession(updatedSession);

      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to submit response.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Complete & View Report Flow
  const handleComplete = async () => {
    if (!activeInterview) return;
    setIsLoading(true);
    setError(null);
    try {
      const finalReport = await api.getReport(activeInterview.id);
      setReport(finalReport);
      setCurrentScreen('report');
      refreshHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve final report.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. View Report from History or Dashboard
  const handleViewReport = async (interviewId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const finalReport = await api.getReport(interviewId);
      setReport(finalReport);
      setCurrentScreen('report');
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve report for this interview.');
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Reset or Return
  const handleCloseReport = () => {
    setReport(null);
    setActiveInterview(null);
    setSession(null);
    setCurrentScreen('history');
    refreshHistory();
  };

  const handleQuitInterview = () => {
    if (window.confirm('Are you sure you want to exit the current interview? Any unsaved progress will be lost.')) {
      setActiveInterview(null);
      setSession(null);
      setCurrentScreen('dashboard');
      refreshHistory();
    }
  };

  // Profile update callback
  const handleProfileUpdated = (updatedCandidate: CandidateResponse) => {
    setCurrentUser(updatedCandidate);
  };

  // Initial Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-brand-cyan flex items-center justify-center shadow-xl shadow-brand-500/25 mb-4 animate-pulse">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-semibold text-slate-300">Initializing Intervio.Ai...</div>
        <div className="text-xs text-slate-500 mt-1">Connecting to authenticated assessment engine</div>
      </div>
    );
  }

  // Unauthenticated Screen
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} initialMessage={error} />;
  }

  const isInterviewActive = currentScreen === 'interview';

  return (
    <div className="min-h-screen flex bg-dark-950 text-slate-100 relative overflow-x-hidden">
      {/* Ambient 3D Depth Layer */}
      <div className="ambient-3d-bg pointer-events-none" aria-hidden="true">
        <div className="ambient-grid" />
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
      </div>

      {/* Persistent Sidebar for Desktop (Hidden during active interview) */}
      {!isInterviewActive && (
        <Sidebar
          currentTab={
            currentScreen === 'dashboard' || currentScreen === 'setup' || currentScreen === 'history' || currentScreen === 'profile'
              ? currentScreen
              : 'dashboard'
          }
          onSelectTab={(tab: NavigationTab) => {
            if (currentScreen === 'report') {
              setReport(null);
            }
            setError(null);
            setCurrentScreen(tab);
          }}
          candidate={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header
          statusText={
            currentScreen === 'interview'
              ? 'Session In Progress'
              : currentScreen === 'report'
              ? 'Report Ready'
              : undefined
          }
          candidate={currentUser}
          onReset={isInterviewActive ? handleQuitInterview : undefined}
          onLogout={handleLogout}
        />

        {error && currentScreen !== 'setup' && (
          <div className="max-w-6xl mx-auto px-4 mt-4 w-full">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="text-xs font-bold text-rose-400 hover:text-rose-200 cursor-pointer ml-4"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Async Data Fetching Banner (e.g., retrieving reports from Dashboard / History) */}
        {isLoading && currentScreen !== 'setup' && currentScreen !== 'interview' && (
          <div className="max-w-6xl mx-auto px-4 mt-4 w-full">
            <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Loading assessment data...</span>
            </div>
          </div>
        )}

        <main className="flex-1">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              candidate={currentUser}
              history={history}
              onStartInterview={() => setCurrentScreen('setup')}
              onViewHistory={() => setCurrentScreen('history')}
              onViewReport={handleViewReport}
              onViewProfile={() => setCurrentScreen('profile')}
            />
          )}

          {currentScreen === 'setup' && (
            <SetupScreen
              candidate={currentUser}
              onStart={handleStartSetup}
              isLoading={isLoading}
              error={error}
            />
          )}

          {currentScreen === 'history' && (
            <InterviewHistoryScreen
              history={history}
              onStartInterview={() => setCurrentScreen('setup')}
              onViewReport={handleViewReport}
            />
          )}

          {currentScreen === 'profile' && (
            <ProfileScreen
              candidate={currentUser}
              onProfileUpdated={handleProfileUpdated}
              onStartInterview={() => setCurrentScreen('setup')}
            />
          )}

          {currentScreen === 'interview' && session && (
            <LiveInterviewScreen
              session={session}
              currentQuestion={session.current_question}
              onSubmitAnswer={handleSubmitAnswer}
              onComplete={handleComplete}
              isLoading={isLoading}
              error={error}
            />
          )}

          {currentScreen === 'report' && report && (
            <ReportDashboard
              report={report}
              onReset={handleCloseReport}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Hidden during active interview) */}
        {!isInterviewActive && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-xl border-t border-slate-800 flex items-center justify-around py-2 px-1">
            <button
              onClick={() => {
                if (currentScreen === 'report') setReport(null);
                setCurrentScreen('dashboard');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] cursor-pointer ${
                currentScreen === 'dashboard' ? 'text-brand-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                if (currentScreen === 'report') setReport(null);
                setCurrentScreen('setup');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] cursor-pointer ${
                currentScreen === 'setup' ? 'text-brand-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start</span>
            </button>

            <button
              onClick={() => {
                if (currentScreen === 'report') setReport(null);
                setCurrentScreen('history');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] cursor-pointer ${
                currentScreen === 'history' ? 'text-brand-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              onClick={() => {
                if (currentScreen === 'report') setReport(null);
                setCurrentScreen('profile');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] cursor-pointer ${
                currentScreen === 'profile' ? 'text-brand-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>
          </div>
        )}

        <footer className="py-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
          <p>Intervio.Ai — Multimodal Transformer & Computer Vision Assessment Architecture</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
