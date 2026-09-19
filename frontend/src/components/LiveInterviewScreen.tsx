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
}

export const LiveInterviewScreen: React.FC<LiveInterviewScreenProps> = ({
  session,
  currentQuestion,
  onSubmitAnswer,
  onComplete,
  isLoading,
  error,
}) => {
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
    if (!answerText.trim() && !audioFile && !videoFile) return;

    const textToSubmit = answerText;
    const audioToSubmit = audioFile;
    const videoToSubmit = videoFile;

    // Show neutral transition immediately
    setTransitioning('next_question');

    try {
      const res = await onSubmitAnswer(textToSubmit, audioToSubmit, videoToSubmit);
      
      // Clear inputs upon success
      setAnswerText('');
      setAudioFile(null);
      setVideoFile(null);
      setRecordingDuration(0);

      if (res.is_completed || session.is_completed) {
        setTransitioning('completing');
        await onComplete();
      } else {
        // Brief smooth pause before revealing the next question
        setTimeout(() => {
          setTransitioning('none');
        }, 600);
      }
    } catch {
      // Revert transition if error occurs so candidate can retry
      setTransitioning('none');
    }
  };

  const currentSeq = currentQuestion?.sequence_number || (session.answered_questions + 1);
  const totalQ = session.total_questions || 1;
  const progressPercent = Math.round(((session.answered_questions) / totalQ) * 100);

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Session Progress Bar */}
      <div className="card-3d p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">Live Evaluation</span>
            <span className="text-slate-500">|</span>
            <span className="capitalize">{session.role}</span>
            <span className="text-slate-500">|</span>
            <span className="capitalize">{session.difficulty}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{formatTime(elapsedSec)}</span>
            </div>
            <div className="text-slate-400 font-medium flex items-center gap-1.5">
              <span>Question <strong className="text-white">{currentSeq}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-brand-300 font-mono">AI Adaptive</span>
            </div>
          </div>
        </div>

        {/* 3D-styled Progress Bar */}
        <div className="relative w-full h-3 bg-dark-900 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-cyan transition-all duration-500 shadow-md shadow-brand-500/20"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Interview Completed Screen */}
      {(transitioning === 'completing' || session.is_completed) ? (
        <div className="card-3d p-10 sm:p-12 text-center animate-fadeIn border-brand-500/30">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Interview completed</h3>
          <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
            All interview questions have been submitted.
          </p>
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-dark-900 border border-slate-800 text-xs text-brand-300 font-semibold shadow-inner">
            <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <span>Analyzing your responses...</span>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Transition State: Answer Recorded — Preparing Next Question */}
          {transitioning === 'next_question' && (
            <div className="card-3d p-10 sm:p-12 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Answer recorded</h3>
              <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                <span className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                <span>Preparing next question...</span>
              </div>
            </div>
          )}

          {/* 3. Active Question Display & Answer Box (Kept in DOM so camera stream stays live) */}
          {currentQuestion ? (
            <div className={transitioning === 'next_question' ? 'hidden' : 'space-y-6'}>
              {/* Question Card */}
              <div className="card-3d card-3d-hover p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span className="px-3 py-1 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-bold font-mono">
                    QUESTION #{currentQuestion.sequence_number}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    {currentQuestion.question_type}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed tracking-tight">
                  {currentQuestion.question_text}
                </h2>
              </div>

              {/* Real-time Camera & Microphone Capture */}
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

              {/* Written Answer / Accompanying Notes */}
              <form onSubmit={handleSubmit} className="card-3d p-6">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <FileText className="w-4 h-4 text-brand-400" />
                    <span>Written Answer / Accompanying Notes</span>
                    {(audioFile || videoFile) && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" />
                        Recording attached
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    {wordCount} words | {answerText.length} chars
                  </div>
                </div>

                <div>
                  <textarea
                    rows={4}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={
                      audioFile || videoFile
                        ? "Optional: Answer recorded via camera. You can also add written notes or submit directly..."
                        : "Explain your technical reasoning, architecture choices, implementation details, or record your answer using the camera above..."
                    }
                    className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors leading-relaxed resize-y font-sans"
                  />
                </div>

                {/* Submit Action */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    {audioFile || videoFile ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                        <Check className="w-3.5 h-3.5" />
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
                    className="btn-3d px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 hover:from-brand-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            /* 4. Empty Fallback */
            <div className="card-3d p-8 text-center">
              <HelpCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Active Question Available</h3>
              <p className="text-xs text-slate-400 mt-1">
                All scheduled questions may have been completed.
              </p>
              <button
                onClick={onComplete}
                className="btn-3d mt-4 px-5 py-2 rounded-lg bg-brand-500 text-white text-xs font-bold cursor-pointer"
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
