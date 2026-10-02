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
import { api } from '../../services/api';

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

  // DOM & Speech & WebRTC Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roomContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // OpenAI Realtime WebRTC state & refs
  const [useRealtimeWebRTC, setUseRealtimeWebRTC] = useState<boolean>(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const disconnectWebRTC = useCallback(() => {
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch {}
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch {}
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch {}
      remoteAudioRef.current = null;
    }
    setUseRealtimeWebRTC(false);
  }, []);

  const connectOpenAIRealtime = useCallback(async (clientSecret: string) => {
    try {
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      if (!remoteAudioRef.current) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        remoteAudioRef.current = audio;
      }

      pc.ontrack = (e) => {
        if (remoteAudioRef.current && e.streams[0]) {
          remoteAudioRef.current.srcObject = e.streams[0];
        }
      };

      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      } else {
        const localMic = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(localMic);
        localMic.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localMic);
        });
      }

      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('OpenAI Realtime DataChannel connected via WebRTC.');
        setUseRealtimeWebRTC(true);

        // Configure VAD turn-taking over DataChannel
        const sessionUpdate = {
          type: 'session.update',
          session: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
              create_response: true,
            },
            input_audio_transcription: {
              model: 'whisper-1',
            },
          },
        };
        dc.send(JSON.stringify(sessionUpdate));
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          // 1. Candidate Interruption Detection (candidate speaks while AI speaks)
          if (event.type === 'input_audio_buffer.speech_started') {
            console.log('Interruption detected: candidate started speaking.');
            if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
              dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.pause();
              remoteAudioRef.current.currentTime = 0;
            }
            setVoiceState('listening');
            setAiSpeechText('');
          }

          // 2. Candidate Speech End Detection (candidate stops speaking)
          if (event.type === 'input_audio_buffer.speech_stopped') {
            console.log('Candidate finished turn: speech_stopped received.');
            setVoiceState('processing');
          }

          // 3. Candidate Speech Transcript Completed
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = event.transcript || '';
            if (transcript.trim()) {
              setAnswerText((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
            }
          }

          // 4. Response Turn Lifecycle
          if (event.type === 'response.created') {
            setVoiceState('ai_speaking');
            setAiSpeechText('');
          } else if (event.type === 'response.audio.delta') {
            setVoiceState('ai_speaking');
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(() => {});
            }
          } else if (event.type === 'response.audio_transcript.delta') {
            setAiSpeechText((prev) => prev + (event.delta || ''));
          } else if (event.type === 'response.done') {
            setVoiceState('listening');
          }
        } catch (err) {
          console.warn('Realtime event parse error:', err);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAI Realtime WebRTC connection failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      setUseRealtimeWebRTC(true);
    } catch (err) {
      console.warn('WebRTC OpenAI Realtime connection failed. Falling back to browser Speech synthesis/recognition.', err);
      setUseRealtimeWebRTC(false);
    }
  }, [stream]);

  const syncRealtimeSessionContext = useCallback((questionText: string, seq: number, total: number) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        const updateMsg = {
          type: 'session.update',
          session: {
            instructions: `You are Intervio.Ai conducting a live technical interview for the ${session.role} role (${session.difficulty} level). Current active question #${seq} of ${total}: "${questionText}". Maintain full awareness of candidate answers and never repeat a question unless requested.`,
          },
        };
        dataChannelRef.current.send(JSON.stringify(updateMsg));
      } catch (err) {
        console.warn('Failed to sync Realtime session context:', err);
      }
    }
  }, [session.role, session.difficulty]);

  useEffect(() => {
    if (useRealtimeWebRTC && currentQuestion) {
      syncRealtimeSessionContext(
        currentQuestion.question_text,
        currentQuestion.sequence_number || session.answered_questions + 1,
        session.total_questions || 1
      );
    }
  }, [currentQuestion, useRealtimeWebRTC, syncRealtimeSessionContext, session.answered_questions, session.total_questions]);

  // Helper to pick the best natural English voice available
  const selectBestVoice = useCallback(() => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Try Google US English or Google UK English
    let selected = voices.find(
      (v) => v.name.includes('Google US English') || v.name.includes('Google UK English')
    );

    // 2. Try Microsoft Natural / Online English voices
    if (!selected) {
      selected = voices.find(
        (v) =>
          (v.name.includes('Natural') || v.name.includes('Online')) &&
          (v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en'))
      );
    }

    // 3. Try macOS / iOS natural voices (Samantha, Alex, Karen, Daniel)
    if (!selected) {
      selected = voices.find(
        (v) =>
          ['Samantha', 'Alex', 'Karen', 'Daniel', 'Victoria', 'Fiona'].some((name) =>
            v.name.includes(name)
          ) && v.lang.startsWith('en')
      );
    }

    // 4. Try any en-US voice
    if (!selected) {
      selected = voices.find((v) => v.lang === 'en-US');
    }

    // 5. Try any English voice
    if (!selected) {
      selected = voices.find((v) => v.lang.startsWith('en'));
    }

    preferredVoiceRef.current = selected || voices[0] || null;
    return preferredVoiceRef.current;
  }, []);

  // Populate voices on mount & handle Chrome onvoiceschanged async event
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    selectBestVoice();

    const handleVoicesChanged = () => {
      selectBestVoice();
    };

    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectBestVoice]);

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

    if (useRealtimeWebRTC) {
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        try {
          const itemEvent = {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Interviewer Prompt: ${text}`,
                },
              ],
            },
          };
          const responseEvent = { type: 'response.create' };
          dataChannelRef.current.send(JSON.stringify(itemEvent));
          dataChannelRef.current.send(JSON.stringify(responseEvent));
        } catch (err) {
          console.warn('DataChannel send prompt failed:', err);
        }
      }
      if (onEnd) onEnd();
      return;
    }

    if (!('speechSynthesis' in window) || isAudioMuted) {
      const durationMs = Math.max(1500, text.length * 45);
      const timer = setTimeout(() => {
        if (onEnd) onEnd();
      }, durationMs);
      return () => clearTimeout(timer);
    }

    try {
      window.speechSynthesis.cancel(); // Clear any ongoing or queued utterances

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.08; // Natural conversational cadence (1.05 - 1.1)
      utterance.pitch = 1.0;
      utterance.volume = 1.0; // Clear maximum volume

      const voice = preferredVoiceRef.current || selectBestVoice();
      if (voice) {
        utterance.voice = voice;
      }

      let isCompleted = false;

      utterance.onend = () => {
        if (!isCompleted) {
          isCompleted = true;
          if (onEnd) onEnd();
        }
      };

      utterance.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        if (!isCompleted) {
          isCompleted = true;
          if (onEnd) onEnd();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis failed:', e);
      if (onEnd) onEnd();
    }
  }, [isAudioMuted, selectBestVoice, useRealtimeWebRTC]);

  // Stop TTS Audio
  const stopTTS = useCallback(() => {
    if (useRealtimeWebRTC && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try { dataChannelRef.current.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [useRealtimeWebRTC]);

  // 2. Speech-to-Text (STT) Engine Helper
  const startListening = useCallback(() => {
    if (useRealtimeWebRTC) {
      setVoiceState('listening');
      return;
    }

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
  }, [answerText, useRealtimeWebRTC]);

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
    disconnectWebRTC();
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
  }, [stream, stopTTS, stopListening, disconnectWebRTC]);

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

    // Establish OpenAI Realtime Session over WebRTC using ephemeral client token
    try {
      const sessionRes = await api.createRealtimeSession(session.interview_id);
      if (sessionRes && sessionRes.client_secret) {
        await connectOpenAIRealtime(sessionRes.client_secret);
      }
    } catch (err) {
      console.warn('Could not establish OpenAI Realtime WebRTC session token, falling back to Web Speech:', err);
    }

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
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between relative p-4 sm:p-6 overflow-x-hidden animate-fadeIn"
    >
      {/* Proctoring Warning Modal Overlay */}
      {activeWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
          <div className="card-3d max-w-md w-full p-6 text-center border-amber-300 shadow-2xl bg-white">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 mb-2">{activeWarning.title}</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed font-medium">{activeWarning.message}</p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono mb-6 flex items-center justify-between font-bold">
              <span>Recorded Violations:</span>
              <span className="font-extrabold text-amber-600">{violations.length}</span>
            </div>

            <button
              onClick={handleResumeFullscreen}
              className="btn-3d w-full py-3 text-slate-900 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#FFF' }}
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
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-extrabold text-slate-900 tracking-wide">Real-Time Voice AI Room</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-600 capitalize font-bold">{session.role}</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-indigo-700 font-mono font-extrabold uppercase">{session.difficulty}</span>
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
              className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Fullscreen status indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${
                isFullscreen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isFullscreen ? 'Fullscreen Locked' : 'Windowed'}</span>
            </div>

            {/* Violation counter */}
            {violations.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Violations: <strong>{violations.length}</strong></span>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{formatTime(elapsedSec)}</span>
            </div>

            {/* Exit Room Button */}
            {onQuit && (
              <button
                onClick={() => {
                  stopMediaStream();
                  onQuit();
                }}
                className="text-slate-500 hover:text-slate-900 text-xs font-bold cursor-pointer ml-2"
              >
                Exit Room
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-3.5 border border-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 transition-all duration-500 shadow-xs"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </header>

      {/* Main Interview Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera & Device Status (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          <div className="card-3d p-4 overflow-hidden relative group">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-extrabold text-slate-900 flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live Feed</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <div className="relative aspect-video rounded-2xl bg-slate-900 border border-slate-200 overflow-hidden flex items-center justify-center shadow-md">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {!hasCameraPermission && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                  <VideoOff className="w-8 h-8 text-rose-400 mb-2" />
                  <p className="text-xs text-rose-300 font-bold">Camera feed unavailable</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Please grant camera permissions to continue</p>
                </div>
              )}
            </div>

            {/* Hardware permission indicator pills */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono font-bold">
              <div
                className={`p-2 rounded-xl border flex items-center gap-2 ${
                  hasCameraPermission
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {hasCameraPermission ? <Camera className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                <span>Cam: {hasCameraPermission ? 'OK' : 'Off'}</span>
              </div>

              <div
                className={`p-2 rounded-xl border flex items-center gap-2 ${
                  hasMicPermission
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {hasMicPermission ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>Mic: {hasMicPermission ? 'OK' : 'Off'}</span>
              </div>
            </div>
          </div>

          {/* 3D AI Interviewer Avatar Focal Card */}
          {isStarted && (
            <div className="card-3d p-5 relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/30 to-white border border-indigo-200/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.12)]">
              <div className="text-xs font-extrabold text-slate-900 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>AI Interviewer Avatar</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {useRealtimeWebRTC ? 'OpenAI Realtime WebRTC' : sttSupported ? 'Speech STT Active' : 'Text Input Mode'}
                </span>
              </div>

              {/* 3D Orb & Waveform Centerpiece */}
              <div className="relative flex flex-col items-center justify-center my-3 py-2">
                {/* Concentric Pulsing Soundwave Rings */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-500 ${
                      voiceState === 'ai_speaking'
                        ? 'bg-indigo-500/20 animate-ping opacity-75'
                        : voiceState === 'listening'
                        ? 'bg-emerald-500/20 animate-ping opacity-60'
                        : 'bg-indigo-500/10 opacity-30'
                    }`}
                  />
                  <div
                    className={`absolute inset-2 rounded-full border-2 transition-all duration-300 ${
                      voiceState === 'ai_speaking'
                        ? 'border-indigo-500/60 scale-110 shadow-lg shadow-indigo-500/30'
                        : voiceState === 'listening'
                        ? 'border-emerald-500/60 scale-105 shadow-lg shadow-emerald-500/20'
                        : voiceState === 'processing'
                        ? 'border-violet-500/60 animate-spin'
                        : 'border-slate-200'
                    }`}
                  />

                  {/* 3D Core Sphere */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30 relative z-10 transform hover:scale-105 transition-transform">
                    <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
                  </div>
                </div>

                {/* State Badge & Spoken Subtitle */}
                <div className="mt-3 text-center">
                  {voiceState === 'ai_speaking' && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold shadow-xs">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                        <span>AI Interviewer Speaking...</span>
                      </div>
                      {aiSpeechText && (
                        <div className="text-[11px] text-slate-600 font-medium max-w-xs mx-auto truncate px-2 italic">
                          "{aiSpeechText}"
                        </div>
                      )}
                    </div>
                  )}

                  {voiceState === 'listening' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold animate-fadeIn shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Listening to Candidate...</span>
                    </div>
                  )}

                  {voiceState === 'processing' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-extrabold animate-fadeIn shadow-xs">
                      <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                      <span>Evaluating Multimodal Response...</span>
                    </div>
                  )}

                  {voiceState === 'idle' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ready for Candidate Response</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Proctoring Log Card */}
          <div className="card-3d p-4">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                <span>Proctoring Security</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono font-bold">
                {violations.length} {violations.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {violations.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>No security violations detected</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {violations.map((v) => (
                  <div
                    key={v.id}
                    className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start justify-between gap-2 font-medium"
                  >
                    <span>{v.message}</span>
                    <span className="text-[9px] font-mono text-rose-600 font-bold shrink-0">{v.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Q&A & Voice Interview Room Controls (8 cols) */}
        <div className="md:col-span-8 space-y-6">
          {(error || permissionError) && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3 font-semibold">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error || permissionError}</span>
            </div>
          )}

          {!isStarted ? (
            /* Pre-Start Interview Room Screen */
            <div className="card-3d p-8 sm:p-10 text-center animate-fadeIn border-indigo-200 shadow-[0_20px_40px_-15px_rgba(99,102,241,0.08)]">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto mb-5 shadow-sm">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Real-Time AI Voice Interview Room</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed mb-6 font-medium">
                Your AI interviewer will read each question aloud and transcribe your spoken responses in real time. Please ensure your microphone is clear.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto mb-8 text-xs font-mono text-left">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-extrabold">Voice Synthesis & STT</div>
                    <div className="text-[10px] text-slate-500 font-medium">Natural voice conversation</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-slate-900 font-extrabold">Proctoring Lock</div>
                    <div className="text-[10px] text-slate-500 font-medium">Fullscreen & tab monitoring</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartInterview}
                className="btn-3d px-8 py-3.5 text-white font-extrabold text-sm inline-flex items-center gap-2.5 cursor-pointer shadow-lg shadow-indigo-500/25"
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
                      <span className="px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold font-mono">
                        QUESTION #{currentSeq}
                      </span>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-extrabold font-mono">
                        {currentQuestion.question_type}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed tracking-tight mb-4">
                      {currentQuestion.question_text}
                    </h3>

                    {/* AI Speech Utterance Indicator */}
                    {voiceState === 'ai_speaking' && (
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs flex items-center gap-2 font-mono font-bold">
                        <Volume2 className="w-4 h-4 text-indigo-600 animate-pulse shrink-0" />
                        <span>AI Interviewer is speaking question...</span>
                      </div>
                    )}
                  </div>

                  {/* Candidate Answer Form */}
                  <form onSubmit={handleSubmit} className="card-3d p-6">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/80">
                      <label htmlFor="interview-answer" className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                        <FileText className="w-4 h-4 text-indigo-600" />
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
                          className={`text-xs font-bold cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${
                            voiceState === 'listening'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold animate-pulse'
                              : 'bg-slate-50 border-slate-200 text-indigo-700 hover:bg-slate-100'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>{voiceState === 'listening' ? 'Listening (Click to Pause)' : 'Start Microphone'}</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500 font-semibold">
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
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed font-sans font-medium shadow-sm"
                    />

                    <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500 font-medium">
                        {voiceState === 'listening' ? (
                          <span className="text-emerald-700 font-bold">Speak into microphone or click Submit when done</span>
                        ) : (
                          <span>Spoken text is saved for evaluation</span>
                        )}
                      </span>

                      <button
                        type="submit"
                        disabled={isLoading || transitioning !== 'none' || !answerText.trim()}
                        className="btn-3d px-6 py-2.5 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-indigo-500/20"
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
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                  <h3 className="text-base font-extrabold text-slate-900">All Questions Submitted</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 font-semibold">
                    The active voice interview session has concluded.
                  </p>
                  <button
                    onClick={() => {
                      stopMediaStream();
                      onComplete();
                    }}
                    className="btn-3d px-6 py-2.5 text-white text-xs font-bold cursor-pointer"
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
      <footer className="mt-8 pt-4 border-t border-slate-200/80 text-center text-xs text-slate-500 font-medium">
        <p>Intervio.Ai Real-Time Voice Assessment Room — Hardware Sync & Conversational AI</p>
      </footer>
    </div>
  );
};
