import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Maximize2,
  Camera,
  Mic,
  AlertTriangle,
  Play,
  CheckCircle2,
  Clock,
  FileText,
  Send,
  XCircle,
  VideoOff,
  MicOff,
  Check,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  InterviewSessionResponse,
  QuestionResponse,
  SubmitAnswerResponse
} from '../../types/api';

interface ViolationLog {
  id: string;
  type: 'fullscreen_exit' | 'tab_switch' | 'window_blur';
  timestamp: string;
  message: string;
}

type VoiceState = 'idle' | 'ai_speaking' | 'listening' | 'processing';

interface RealtimeInterviewRoomProps {
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

export const RealtimeInterviewRoom: React.FC<RealtimeInterviewRoomProps> = ({
  session,
  currentQuestion,
  onSubmitAnswer,
  onComplete,
  isLoading,
  error,
  onQuit,
}) => {
  // Session & Permission state
  const [isStarted, setIsStarted] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Proctoring & Violation state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeWarning, setActiveWarning] = useState<{
    type: 'fullscreen' | 'tab_switch';
    title: string;
    message: string;
  } | null>(null);
  const [violations, setViolations] = useState<ViolationLog[]>([]);

  // Voice Conversation State
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [aiSpeechText, setAiSpeechText] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [sttSupported, setSttSupported] = useState<boolean>(true);

  // Q&A form state
  const [answerText, setAnswerText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transitioning, setTransitioning] = useState<'none' | 'next_question' | 'completing'>('none');

  // DOM & Speech Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roomContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check STT Browser Support on Mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
    }
  }, []);

  // 1. Text-to-Speech (TTS) Engine Helper
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    setAiSpeechText(text);
    setVoiceState('ai_speaking');

    if (!('speechSynthesis' in window) || isAudioMuted) {
      // Fallback timer if TTS is unsupported or muted
      const durationMs = Math.max(1500, text.length * 50);
      const timer = setTimeout(() => {
        if (onEnd) onEnd();
      }, durationMs);
      return () => clearTimeout(timer);
    }

    try {
      window.speechSynthesis.cancel(); // Clear any ongoing utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis failed:', e);
      if (onEnd) onEnd();
    }
  }, [isAudioMuted]);

  // Stop TTS Audio
  const stopTTS = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // 2. Speech-to-Text (STT) Engine Helper
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = answerText;

      recognition.onstart = () => {
        setVoiceState('listening');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + transcriptChunk.trim();
          } else {
            currentInterim += transcriptChunk;
          }
        }
        setAnswerText(finalTranscript + (currentInterim ? ' ' + currentInterim : ''));
      };

      recognition.onerror = (err: any) => {
        console.warn('SpeechRecognition error:', err);
      };

      recognition.onend = () => {
        // Keep in listening state unless transitioned to processing
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start SpeechRecognition:', err);
      setVoiceState('idle');
    }
  }, [answerText]);

  // Stop STT Helper
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore abort errors
      }
      recognitionRef.current = null;
    }
  }, []);

  // 3. Request Media Permissions
  const requestMediaPermissions = useCallback(async () => {
    setPermissionError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });

      setStream(mediaStream);
      setHasCameraPermission(true);
      setHasMicPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Media permission error:', err);
      setHasCameraPermission(false);
      setHasMicPermission(false);
      setPermissionError(
        err.message || 'Camera and microphone permissions are required to enter the AI Interview Room.'
      );
    }
  }, []);

  // Media Stream Cleanup
  const stopMediaStream = useCallback(() => {
    stopTTS();
    stopListening();
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, stopTTS, stopListening]);

  // Clean stream & speech cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, []);

  // Sync stream to video element
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Request permissions on room load
  useEffect(() => {
    requestMediaPermissions();
  }, [requestMediaPermissions]);

  // 4. Fullscreen & Visibility Event Monitoring
  const logViolation = useCallback((type: 'fullscreen_exit' | 'tab_switch' | 'window_blur', message: string) => {
    const newViolation: ViolationLog = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      timestamp: new Date().toLocaleTimeString(),
      message,
    };
    setViolations((prev) => [...prev, newViolation]);
  }, []);

  // Monitor Fullscreen Change
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);

      if (!isFs && isStarted) {
        logViolation('fullscreen_exit', 'Exited fullscreen mode during live session.');
        setActiveWarning({
          type: 'fullscreen',
          title: 'Fullscreen Exited Warning',
          message: 'You have exited browser fullscreen. Please remain in fullscreen mode throughout the interview session for proctoring compliance.',
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isStarted, logViolation]);

  // Monitor Tab Visibility Change & Window Blur
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isStarted) {
        logViolation('tab_switch', 'Switched tab or minimized browser window.');
        setActiveWarning({
          type: 'tab_switch',
          title: 'Tab Switch / Inactive Window Warning',
          message: 'A tab switch or window minimization was detected. Please keep the interview window active and focused at all times.',
        });
      }
    };

    const handleWindowBlur = () => {
      if (isStarted && document.visibilityState === 'visible') {
        logViolation('window_blur', 'Window lost focus.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isStarted, logViolation]);

  // 5. Start Interview Action & AI Voice Intro Flow
  const handleStartInterview = async () => {
    if (!hasCameraPermission || !hasMicPermission) {
      await requestMediaPermissions();
    }

    try {
      const targetEl = roomContainerRef.current || document.documentElement;
      if (targetEl.requestFullscreen) {
        await targetEl.requestFullscreen();
      }
    } catch (err) {
      console.warn('Browser denied automatic fullscreen request:', err);
    }

    setIsStarted(true);
    setIsFullscreen(Boolean(document.fullscreenElement));

    // Natural Voice Intro Sequence
    const introSpeech = `Welcome to your AI interview for the ${session.role} role. I will be asking your technical questions today. Let's begin.`;
    speakText(introSpeech, () => {
      if (currentQuestion) {
        speakText(currentQuestion.question_text, () => {
          startListening();
        });
      } else {
        startListening();
      }
    });
  };

  // Re-enter Fullscreen
  const handleResumeFullscreen = async () => {
    try {
      const targetEl = roomContainerRef.current || document.documentElement;
      if (targetEl.requestFullscreen && !document.fullscreenElement) {
        await targetEl.requestFullscreen();
      }
    } catch (err) {
      console.warn('Could not re-enter fullscreen:', err);
    }
    setActiveWarning(null);
  };

  // Timer per question
  useEffect(() => {
    if (!isStarted) return;
    setElapsedSec(0);
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted, currentQuestion?.id]);

  // Handle Answer Submission & AI Contextual Response Voice Flow
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || transitioning !== 'none' || !answerText.trim()) return;

    stopTTS();
    stopListening();
    setVoiceState('processing');
    setTransitioning('next_question');

    try {
      const textToSubmit = answerText.trim();
      const res = await onSubmitAnswer(textToSubmit);
      setAnswerText('');

      if (res.is_completed || session.is_completed) {
        setTransitioning('completing');
        speakText('Thank you. All responses have been recorded and your assessment is now complete.', () => {
          stopMediaStream();
          onComplete();
        });
      } else {
        setTimeout(() => {
          setTransitioning('none');
          // Speak AI Contextual Feedback Bridge + Next Question
          const bridgeText = res.contextual_response || 'Good explanation. Moving to the next question.';
          speakText(bridgeText, () => {
            if (res.next_question) {
              speakText(res.next_question.question_text, () => {
                startListening();
              });
            } else {
              startListening();
            }
          });
        }, 400);
      }
    } catch {
      setTransitioning('none');
      setVoiceState('idle');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentSeq = currentQuestion?.sequence_number || session.answered_questions + 1;
  const totalQ = session.total_questions || 1;
  const progressPercent = Math.round((session.answered_questions / totalQ) * 100);

  return (
    <div
      ref={roomContainerRef}
      className="min-h-screen bg-dark-950 text-slate-100 flex flex-col justify-between relative p-4 sm:p-6 overflow-x-hidden"
    >
      {/* Proctoring Warning Modal Overlay */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 bg-dark-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="card-3d max-w-md w-full p-6 text-center border-amber-500/40 shadow-2xl shadow-amber-500/10">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{activeWarning.title}</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">{activeWarning.message}</p>

            <div className="p-3 rounded-xl bg-dark-900 border border-slate-800 text-xs text-slate-400 font-mono mb-6 flex items-center justify-between">
              <span>Recorded Violations:</span>
              <span className="font-bold text-amber-400">{violations.length}</span>
            </div>

            <button
              onClick={handleResumeFullscreen}
              className="btn-3d w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-dark-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Resume Fullscreen & Continue Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Session Header & Bar */}
      <header className="card-3d p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-white tracking-wide">Real-Time Voice AI Room</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-300 capitalize font-medium">{session.role}</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-brand-300 font-mono uppercase">{session.difficulty}</span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {/* Audio Mute/Unmute Toggle */}
            <button
              onClick={() => {
                const nextMuted = !isAudioMuted;
                setIsAudioMuted(nextMuted);
                if (nextMuted) stopTTS();
              }}
              title={isAudioMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              className="p-1.5 rounded-lg bg-dark-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-brand-400" />}
            </button>

            {/* Fullscreen status indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                isFullscreen
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isFullscreen ? 'Fullscreen Locked' : 'Windowed'}</span>
            </div>

            {/* Violation counter */}
            {violations.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Violations: <strong>{violations.length}</strong></span>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{formatTime(elapsedSec)}</span>
            </div>

            {/* Exit Room Button */}
            {onQuit && (
              <button
                onClick={() => {
                  stopMediaStream();
                  onQuit();
                }}
                className="text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer ml-2"
              >
                Exit Room
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-2.5 bg-dark-900 rounded-full overflow-hidden mt-3.5 border border-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-cyan transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </header>

      {/* Main Interview Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera & Device Status (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          <div className="card-3d p-4 overflow-hidden relative group border-slate-800">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-brand-400" />
                <span>Live Feed</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <div className="relative aspect-video rounded-xl bg-dark-950 border border-slate-800 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {!hasCameraPermission && (
                <div className="absolute inset-0 bg-dark-950/90 flex flex-col items-center justify-center p-4 text-center">
                  <VideoOff className="w-8 h-8 text-rose-400 mb-2" />
                  <p className="text-xs text-rose-300 font-medium">Camera feed unavailable</p>
                  <p className="text-[10px] text-slate-400 mt-1">Please grant camera permissions to continue</p>
                </div>
              )}
            </div>

            {/* Hardware permission indicator pills */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
              <div
                className={`p-2 rounded-lg border flex items-center gap-2 ${
                  hasCameraPermission
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                {hasCameraPermission ? <Camera className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                <span>Cam: {hasCameraPermission ? 'OK' : 'Off'}</span>
              </div>

              <div
                className={`p-2 rounded-lg border flex items-center gap-2 ${
                  hasMicPermission
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                {hasMicPermission ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>Mic: {hasMicPermission ? 'OK' : 'Off'}</span>
              </div>
            </div>
          </div>

          {/* Real-time Voice Live Status Indicator */}
          {isStarted && (
            <div className="card-3d p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-3">
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-brand-400" />
                  <span>Voice Status</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {sttSupported ? 'STT Ready' : 'Text Input Mode'}
                </span>
              </div>

              {voiceState === 'ai_speaking' && (
                <div className="p-3 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-brand-400 animate-pulse shrink-0" />
                  <div>
                    <div className="font-bold text-white">AI Interviewer Speaking...</div>
                    <div className="text-[10px] text-slate-300 truncate max-w-[200px]">{aiSpeechText}</div>
                  </div>
                </div>
              )}

              {voiceState === 'listening' && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div>
                    <div className="font-bold text-white">Listening to Candidate...</div>
                    <div className="text-[10px] text-slate-300">Speak your answer clearly into the microphone</div>
                  </div>
                </div>
              )}

              {voiceState === 'processing' && (
                <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-white">Evaluating Multimodal Answer...</div>
                    <div className="text-[10px] text-slate-300">Generating AI response & next adaptive question</div>
                  </div>
                </div>
              )}

              {voiceState === 'idle' && (
                <div className="p-3 rounded-xl bg-dark-900 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  <span>Ready for response</span>
                </div>
              )}
            </div>
          )}

          {/* Proctoring Log Card */}
          <div className="card-3d p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-brand-400" />
                <span>Proctoring Security</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {violations.length} {violations.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {violations.length === 0 ? (
              <div className="p-3 rounded-xl bg-dark-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>No security violations detected</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {violations.map((v) => (
                  <div
                    key={v.id}
                    className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-start justify-between gap-2"
                  >
                    <span>{v.message}</span>
                    <span className="text-[9px] font-mono text-rose-400 shrink-0">{v.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Q&A & Voice Interview Room Controls (8 cols) */}
        <div className="md:col-span-8 space-y-6">
          {(error || permissionError) && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error || permissionError}</span>
            </div>
          )}

          {!isStarted ? (
            /* Pre-Start Interview Room Screen */
            <div className="card-3d p-8 sm:p-10 text-center animate-fadeIn border-brand-500/30">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-indigo-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto mb-5 shadow-xl shadow-brand-500/10">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Real-Time AI Voice Interview Room</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed mb-6">
                Your AI interviewer will read each question aloud and transcribe your spoken responses in real time. Please ensure your microphone is clear.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-8 text-xs font-mono text-left">
                <div className="p-3 rounded-xl bg-dark-900 border border-slate-800 flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-white font-semibold">Voice Synthesis & STT</div>
                    <div className="text-[10px] text-slate-400">Natural voice conversation</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-dark-900 border border-slate-800 flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-white font-semibold">Proctoring Lock</div>
                    <div className="text-[10px] text-slate-400">Fullscreen & tab monitoring</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartInterview}
                className="btn-3d px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 via-indigo-600 to-brand-cyan hover:from-brand-400 hover:to-indigo-500 text-white font-bold text-sm inline-flex items-center gap-2.5 cursor-pointer shadow-xl shadow-brand-500/25"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Voice Interview</span>
              </button>
            </div>
          ) : (
            /* Active Voice Question & Response Form */
            <div className="space-y-6">
              {currentQuestion ? (
                <div className="space-y-6">
                  {/* Active Question Display */}
                  <div className="card-3d card-3d-hover p-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <span className="px-3 py-1 rounded-lg bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-bold font-mono">
                        QUESTION #{currentSeq}
                      </span>
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold font-mono">
                        {currentQuestion.question_type}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-semibold text-white leading-relaxed tracking-tight mb-4">
                      {currentQuestion.question_text}
                    </h3>

                    {/* AI Speech Utterance Indicator */}
                    {voiceState === 'ai_speaking' && (
                      <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2 font-mono">
                        <Volume2 className="w-4 h-4 text-brand-400 animate-pulse shrink-0" />
                        <span>AI Interviewer is speaking question...</span>
                      </div>
                    )}
                  </div>

                  {/* Candidate Answer Form */}
                  <form onSubmit={handleSubmit} className="card-3d p-6">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
                      <label htmlFor="interview-answer" className="flex items-center gap-2 text-xs font-semibold text-white">
                        <FileText className="w-4 h-4 text-brand-400" />
                        <span>Spoken Answer / Live Speech-to-Text Transcript</span>
                      </label>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            if (voiceState === 'listening') {
                              stopListening();
                              setVoiceState('idle');
                            } else {
                              startListening();
                            }
                          }}
                          className={`text-xs font-semibold cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
                            voiceState === 'listening'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold animate-pulse'
                              : 'bg-dark-900 border-slate-800 text-brand-300 hover:text-brand-200'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>{voiceState === 'listening' ? 'Listening (Click to Pause)' : 'Start Microphone'}</span>
                        </button>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-400">
                          {answerText.trim() ? answerText.trim().split(/\s+/).length : 0} words
                        </span>
                      </div>
                    </div>

                    <textarea
                      id="interview-answer"
                      rows={5}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={
                        voiceState === 'listening'
                          ? 'Listening to your microphone... Your spoken answer is being transcribed automatically.'
                          : 'Speak your response aloud or type your technical answer here...'
                      }
                      className="w-full bg-dark-900 border border-slate-800 focus:border-brand-500 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors leading-relaxed font-sans"
                    />

                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        {voiceState === 'listening' ? (
                          <span className="text-emerald-400">Speak into microphone or click Submit when done</span>
                        ) : (
                          <span>Spoken text is saved for evaluation</span>
                        )}
                      </span>

                      <button
                        type="submit"
                        disabled={isLoading || transitioning !== 'none' || !answerText.trim()}
                        className="btn-3d px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 hover:from-brand-400 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isLoading || transitioning !== 'none' ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span>Evaluating Response...</span>
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
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white">All Questions Submitted</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    The active voice interview session has concluded.
                  </p>
                  <button
                    onClick={() => {
                      stopMediaStream();
                      onComplete();
                    }}
                    className="btn-3d px-6 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold cursor-pointer"
                  >
                    View Final Assessment Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Room Footer */}
      <footer className="mt-8 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
        <p>Intervio.Ai Real-Time Voice Assessment Room — Hardware Sync & Conversational AI</p>
      </footer>
    </div>
  );
};
