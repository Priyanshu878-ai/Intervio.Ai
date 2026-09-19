import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CameraOff, 
  Mic, 
  Circle, 
  Square, 
  RotateCcw, 
  Check, 
  Volume2
} from 'lucide-react';
import { audioBlobToWav } from '../utils/audioEncoder';

interface CameraCaptureProps {
  questionId?: string | number;
  onRecordingComplete: (audioFile: File | null, videoFile: File | null, durationSeconds: number) => void;
  onRecordingClear: () => void;
  isSubmitting?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  questionId,
  onRecordingComplete,
  onRecordingClear,
  isSubmitting = false,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied' | 'unsupported'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [hasRecorded, setHasRecorded] = useState(false);

  // Audio level visualizer state
  const [micLevel, setMicLevel] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recordedPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 1. Initialize camera & microphone stream
  const initMedia = async () => {
    setPermissionStatus('pending');
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionStatus('unsupported');
      setErrorMessage('Browser does not support media device capture.');
      return;
    }

    try {
      // Clean up previous stream if any
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setStream(mediaStream);
      setPermissionStatus('granted');

      // Attach to live video preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Initialize audio meter
      setupAudioMeter(mediaStream);
    } catch (err: unknown) {
      console.warn('getUserMedia error:', err);
      // Try audio-only fallback if video failed
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(audioOnlyStream);
        setPermissionStatus('granted');
        setupAudioMeter(audioOnlyStream);
      } catch {
        setPermissionStatus('denied');
        setErrorMessage('Camera and microphone access was denied or device is unavailable.');
      }
    }
  };

  // 2. Setup Audio Visualizer (Web Audio Analyser)
  const setupAudioMeter = (mediaStream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(mediaStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Audio meter setup failed:', e);
    }
  };

  // Run init on mount and cleanup on unmount
  useEffect(() => {
    initMedia();

    return () => {
      // Stop all tracks on unmount
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Ensure video element receives stream when ready
  useEffect(() => {
    if (videoRef.current && stream && !hasRecorded) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasRecorded]);

  // Reset recording state when questionId changes
  useEffect(() => {
    if (questionId === undefined) return;
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setHasRecorded(false);
    setIsRecording(false);
    setRecordingSeconds(0);
    videoChunksRef.current = [];
    audioChunksRef.current = [];
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      try { videoRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      try { audioRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [questionId]);

  // 3. Start Recording
  const startRecording = () => {
    if (!stream) return;

    videoChunksRef.current = [];
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setIsRecording(true);
    setHasRecorded(false);
    setRecordedVideoUrl(null);

    // Pick supported video MIME type
    const videoMimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    let selectedVideoMime = '';
    for (const mime of videoMimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedVideoMime = mime;
        break;
      }
    }

    // Pick supported audio MIME type
    const audioMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    let selectedAudioMime = '';
    for (const mime of audioMimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedAudioMime = mime;
        break;
      }
    }

    try {
      // 1. Video Recorder (captures full stream with video + audio)
      const vRecorder = new MediaRecorder(stream, selectedVideoMime ? { mimeType: selectedVideoMime } : undefined);
      vRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };
      videoRecorderRef.current = vRecorder;
      vRecorder.start(250); // Collect chunk every 250ms

      // 2. Audio Recorder (captures clean isolated audio track)
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        const aRecorder = new MediaRecorder(audioStream, selectedAudioMime ? { mimeType: selectedAudioMime } : undefined);
        aRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        audioRecorderRef.current = aRecorder;
        aRecorder.start(250);
      }

      // Start elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      setIsRecording(false);
    }
  };

  // 4. Stop Recording & Process Blobs
  const stopRecording = async () => {
    if (!isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);

    const finalDuration = recordingSeconds;

    // Stop video recorder
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }

    // Stop audio recorder
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }

    // Small delay to ensure final ondataavailable fired
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Construct Video File
    let videoFile: File | null = null;
    if (videoChunksRef.current.length > 0) {
      const videoBlobType = videoChunksRef.current[0]?.type || 'video/webm';
      const videoBlob = new Blob(videoChunksRef.current, { type: videoBlobType });
      const videoUrl = URL.createObjectURL(videoBlob);
      setRecordedVideoUrl(videoUrl);
      videoFile = new File([videoBlob], 'recorded_response.webm', { type: videoBlobType });
    }

    // Construct Audio File (convert to WAV for max backend compatibility)
    let audioFile: File | null = null;
    if (audioChunksRef.current.length > 0) {
      const audioBlobType = audioChunksRef.current[0]?.type || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: audioBlobType });
      audioFile = await audioBlobToWav(audioBlob);
    } else if (videoFile) {
      // If audio tracks were embedded in video blob
      const videoBlob = new Blob(videoChunksRef.current, { type: videoChunksRef.current[0]?.type || 'video/webm' });
      audioFile = await audioBlobToWav(videoBlob);
    }

    setHasRecorded(true);

    // Notify parent with prepared Files
    onRecordingComplete(audioFile, videoFile, finalDuration);
  };

  // 5. Retake Recording
  const handleRetake = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setHasRecorded(false);
    setRecordingSeconds(0);
    videoChunksRef.current = [];
    audioChunksRef.current = [];

    // Re-attach live stream
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    onRecordingClear();
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-4">
      {/* Camera & Video Box */}
      <div className="card-3d relative overflow-hidden bg-dark-950 border border-slate-800 rounded-2xl shadow-2xl">
        {/* Aspect Container */}
        <div className="relative w-full aspect-video sm:max-h-[380px] bg-dark-900 flex items-center justify-center overflow-hidden">
          {/* Permission Denied or Unsupported Screen */}
          {permissionStatus === 'denied' || permissionStatus === 'unsupported' ? (
            <div className="p-6 text-center space-y-3">
              <CameraOff className="w-12 h-12 text-rose-400 mx-auto opacity-80" />
              <h4 className="text-sm font-bold text-white">Camera & Microphone Offline</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {errorMessage || 'Browser camera/microphone permission was denied. You can continue by typing your response in the text editor below.'}
              </p>
              <button
                type="button"
                onClick={initMedia}
                className="px-4 py-2 rounded-lg bg-dark-800 border border-slate-700 hover:border-brand-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Retry Permissions
              </button>
            </div>
          ) : permissionStatus === 'pending' ? (
            /* Requesting state */
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <span className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-400 rounded-full animate-spin" />
              <span className="text-xs font-medium">Requesting camera & microphone access...</span>
            </div>
          ) : hasRecorded && recordedVideoUrl ? (
            /* Recorded Preview playback */
            <div className="relative w-full h-full">
              <video
                ref={recordedPreviewRef}
                src={recordedVideoUrl}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md">
                <Check className="w-3 h-3" />
                <span>Response Captured ({formatSec(recordingSeconds)})</span>
              </div>
            </div>
          ) : (
            /* Live Camera Feed */
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Status Overlays */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {isRecording ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold font-mono animate-pulse shadow-lg backdrop-blur-md">
                    <Circle className="w-2.5 h-2.5 fill-current" />
                    <span>REC {formatSec(recordingSeconds)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-dark-900/80 border border-slate-700 text-slate-300 text-[11px] font-semibold backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Live Camera</span>
                  </div>
                )}
              </div>

              {/* Real-time Microphone Indicator Overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900/80 border border-slate-700/80 backdrop-blur-md">
                <Volume2 className={`w-3.5 h-3.5 ${micLevel > 15 ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div className="w-16 h-1.5 bg-dark-800 rounded-full overflow-hidden flex items-center">
                  <div
                    className={`h-full transition-all duration-75 ${
                      micLevel > 50 ? 'bg-emerald-400' : micLevel > 20 ? 'bg-brand-cyan' : 'bg-slate-500'
                    }`}
                    style={{ width: `${Math.max(micLevel, 8)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        {permissionStatus === 'granted' && (
          <div className="p-4 bg-dark-900/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Camera className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Webcam</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Mic className="w-3.5 h-3.5 text-brand-emerald" />
                <span>Microphone</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isRecording && !hasRecorded && (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isSubmitting}
                  className="btn-3d px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 transition-all"
                >
                  <Circle className="w-3.5 h-3.5 fill-current" />
                  <span>Start Recording Answer</span>
                </button>
              )}

              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="btn-3d px-5 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-600" />
                  <span>Stop Recording ({formatSec(recordingSeconds)})</span>
                </button>
              )}

              {hasRecorded && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-semibold hidden sm:inline">
                    ✓ Video & Audio Ready
                  </span>
                  <button
                    type="button"
                    onClick={handleRetake}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retake</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
