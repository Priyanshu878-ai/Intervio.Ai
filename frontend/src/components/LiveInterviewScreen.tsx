import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Send, 
  Clock, 
  HelpCircle, 
  AlertCircle, 
  FileText, 
  Check
} from 'lucide-react';
import { 
  InterviewSessionResponse, 
  QuestionResponse, 
  SubmitAnswerResponse 
} from '../types/api';
import { RealtimeInterviewRoom } from './interview/RealtimeInterviewRoom';
import { CameraCapture } from './CameraCapture';

interface LiveInterviewScreenProps {
  session: InterviewSessionResponse;
  currentQuestion: QuestionResponse | null;
  onSubmitAnswer: (
    answerText: string, 
    audioFile?: File | null, 
    videoFile?: File | null
  ) => Promise<SubmitAnswerResponse>;
  onComplete: () => void;
  isLoading: boolean;
  error?: string | null;
  onQuit?: () => void;
}

export const LiveInterviewScreen: React.FC<LiveInterviewScreenProps> = ({
  session,
  currentQuestion,
  onSubmitAnswer,
  onComplete,
  isLoading,
  error,
  onQuit,
}) => {
  const [viewMode, setViewMode] = useState<'realtime' | 'classic'>('realtime');
  const [answerText, setAnswerText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transitioning, setTransitioning] = useState<'none' | 'next_question' | 'completing'>('none');

  // Elapsed time tracker per question
  useEffect(() => {
    setElapsedSec(0);
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion?.id]);

  // Auto-complete if session marks is_completed
  useEffect(() => {
    if (session.is_completed) {
      setTransitioning('completing');
      onComplete();
    }
  }, [session.is_completed]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || transitioning !== 'none') return;
    if (!answerText.trim() && !audioFile && !videoFile) return;

    const textToSubmit = answerText;
    const audioToSubmit = audioFile;
    const videoToSubmit = videoFile;

    setTransitioning('next_question');

    try {
      const res = await onSubmitAnswer(textToSubmit, audioToSubmit, videoToSubmit);
      
      setAnswerText('');
      setAudioFile(null);
      setVideoFile(null);
      setRecordingDuration(0);

      if (res.is_completed || session.is_completed) {
        setTransitioning('completing');
        await onComplete();
      } else {
        setTimeout(() => {
          setTransitioning('none');
        }, 600);
      }
    } catch {
      setTransitioning('none');
    }
  };

  const currentSeq = currentQuestion?.sequence_number || (session.answered_questions + 1);
  const totalQ = session.total_questions || 1;
  const progressPercent = Math.round(((session.answered_questions) / totalQ) * 100);

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  if (viewMode === 'realtime') {
    return (
      <div className="space-y-4">
        <div className="max-w-5xl mx-auto px-4 pt-4 flex justify-end">
          <div className="p-1 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('realtime')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold cursor-pointer shadow-xs"
            >
              Real-Time AI Room
            </button>
            <button
              onClick={() => setViewMode('classic')}
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
            >
              Classic View
            </button>
          </div>
        </div>
        <RealtimeInterviewRoom
          session={session}
          currentQuestion={currentQuestion}
          onSubmitAnswer={async (text, audio, video) => {
            return onSubmitAnswer(text, audio, video);
          }}
          onComplete={onComplete}
          isLoading={isLoading}
          error={error}
          onQuit={onQuit}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fadeIn">
      {/* View Mode Selector */}
      <div className="flex items-center justify-end mb-4">
        <div className="p-1 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-1 text-xs">
          <button
            onClick={() => setViewMode('realtime')}
            className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Real-Time AI Room
          </button>
          <button
            onClick={() => setViewMode('classic')}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold cursor-pointer shadow-xs"
          >
            Classic View
          </button>
        </div>
      </div>

      {/* Session Progress Bar */}
      <div className="card-3d p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs text-slate-700 font-bold">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-extrabold text-slate-900">Live Evaluation</span>
            <span className="text-slate-300">|</span>
            <span className="capitalize">{session.role}</span>
            <span className="text-slate-300">|</span>
            <span className="capitalize">{session.difficulty}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-600 font-mono">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{formatTime(elapsedSec)}</span>
            </div>
            <div className="text-slate-600 font-bold flex items-center gap-1.5">
              <span>Question <strong className="text-slate-900">{currentSeq}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-indigo-600 font-mono font-bold">AI Adaptive</span>
            </div>
          </div>
        </div>

        {/* 3D Progress Bar */}
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 transition-all duration-500 shadow-xs"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {error && !(transitioning === 'completing' || session.is_completed) && (
        <div role="alert" aria-live="assertive" className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3 font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Interview Completed Screen */}
      {(transitioning === 'completing' || session.is_completed) ? (
        <div className="card-3d p-10 sm:p-12 text-center animate-fadeIn border-indigo-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mb-2">Interview completed</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto leading-relaxed font-medium">
            All interview questions have been submitted.
          </p>
          {error ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs max-w-md mx-auto font-semibold">
                {error}
              </div>
              <button
                type="button"
                onClick={onComplete}
                disabled={isLoading}
                className="btn-3d px-6 py-2.5 text-white font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Loading Report...</span>
                  </>
                ) : (
                  <span>Retry Loading Report</span>
                )}
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-bold shadow-xs">
              <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing your responses...</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 2. Transition State */}
          {transitioning === 'next_question' && (
            <div className="card-3d p-10 sm:p-12 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Answer recorded</h3>
              <div className="inline-flex items-center gap-2 text-xs text-slate-600 font-semibold">
                <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Preparing next question...</span>
              </div>
            </div>
          )}

          {/* 3. Active Question Display */}
          {currentQuestion ? (
            <div className={transitioning === 'next_question' ? 'hidden' : 'space-y-6'}>
              {/* Question Card */}
              <div aria-live="polite" className="card-3d card-3d-hover p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold font-mono">
                    QUESTION #{currentQuestion.sequence_number}
                  </span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">
                    {currentQuestion.question_type}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed tracking-tight">
                  {currentQuestion.question_text}
                </h2>
              </div>

              {/* Camera & Microphone Capture */}
              <CameraCapture
                questionId={currentQuestion.id}
                onRecordingComplete={(audio, video, duration) => {
                  setAudioFile(audio);
                  setVideoFile(video);
                  setRecordingDuration(duration);
                }}
                onRecordingClear={() => {
                  setAudioFile(null);
                  setVideoFile(null);
                  setRecordingDuration(0);
                }}
                isSubmitting={isLoading || transitioning !== 'none'}
              />

              {/* Written Answer */}
              <form onSubmit={handleSubmit} className="card-3d p-6">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/80">
                  <label htmlFor="written-answer" className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Written Answer / Accompanying Notes</span>
                    {(audioFile || videoFile) && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono font-bold">
                        <Check className="w-3 h-3" />
                        Recording attached
                      </span>
                    )}
                  </label>

                  <div className="text-[11px] text-slate-500 font-mono font-semibold">
                    {wordCount} words | {answerText.length} chars
                  </div>
                </div>

                <div>
                  <textarea
                    id="written-answer"
                    rows={4}
                    value={answerText}
                    aria-label="Written Answer / Accompanying Notes"
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={
                      audioFile || videoFile
                        ? "Optional: Answer recorded via camera. You can also add written notes or submit directly..."
                        : "Explain your technical reasoning, architecture choices, implementation details, or record your answer using the camera above..."
                    }
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors leading-relaxed resize-y font-sans font-medium shadow-sm"
                  />
                </div>

                {/* Submit Action */}
                <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 font-semibold">
                    {audioFile || videoFile ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Multimodal response ready ({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Record video/audio above or submit your written answer
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || transitioning !== 'none' || (!answerText.trim() && !audioFile && !videoFile)}
                    aria-busy={isLoading || transitioning !== 'none'}
                    className="btn-3d px-6 py-2.5 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    {isLoading || transitioning !== 'none' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Submitting Response...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Answer</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card-3d p-8 text-center">
              <HelpCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-extrabold text-slate-900">No Active Question Available</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                All scheduled questions may have been completed.
              </p>
              <button
                onClick={onComplete}
                className="btn-3d mt-4 px-5 py-2 text-white text-xs font-bold cursor-pointer"
              >
                Check Final Report
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
