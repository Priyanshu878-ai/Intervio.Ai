/**
 * Realtime Voice Helper for Intervio.Ai
 * Formats interviewer voice prompts and coordinates sequential startup dialogue.
 */

export interface RealtimeInterviewerEvent {
  type: 'response.create';
  response: {
    modalities: string[];
    instructions: string;
  };
}

export type OpeningPhase =
  | 'not_started'
  | 'welcome'
  | 'waiting_for_intro'
  | 'acknowledging'
  | 'completed';

export interface OpeningSequenceOptions {
  role: string;
  questionText?: string | null;
  speakText: (text: string, onEnd?: () => void) => void;
  startListening: () => void;
  onPhaseChange?: (phase: OpeningPhase) => void;
  onCandidateSpeech?: (introText: string) => void;
  onQuestionStarted?: () => void;
}

/**
 * Creates the OpenAI Realtime event for delivering interviewer speech.
 * Prompts are delivered as direct interviewer instructions, NEVER as candidate/user messages.
 */
export function createInterviewerSpeechEvent(text: string): RealtimeInterviewerEvent {
  return {
    type: 'response.create',
    response: {
      modalities: ['audio', 'text'],
      instructions: `You are Intervio.Ai, the interviewer. Deliver the following message directly to the candidate in a clear, professional voice: "${text}"`,
    },
  };
}

/**
 * Generates the professional opening welcome speech.
 * Introduces name/role, explains interview format and conversational commands (repeat, clarify, skip),
 * and prompts candidate for self-introduction.
 */
export function createWelcomeSpeech(role: string): string {
  const cleanRole = role && role.trim() ? role.trim() : 'Software Engineer';
  return `Hello and welcome to your AI interview! I am Intervio, your technical interviewer for today's ${cleanRole} session. I will present your technical questions one by one. You can speak naturally, and if you ever need me to repeat a question, clarify something, or if you wish to skip, just let me know. To begin, could you please introduce yourself and briefly share your background?`;
}

/**
 * Validates candidate self-introduction transcript.
 * Does not treat empty, whitespace, or trivial single-word noise as a valid self-introduction.
 */
export function isValidSelfIntroduction(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 2;
}

/**
 * Generates a natural spoken acknowledgment for the candidate's introduction.
 */
export function createAcknowledgementSpeech(_introText?: string): string {
  return "Thank you for introducing yourself! It's a pleasure to meet you. Let's move into your first technical question.";
}

/**
 * State machine managing the professional interview opening sequence:
 * 1. AI Welcomes candidate, introduces name/role, explains format & repeat/clarify commands, asks for self-intro.
 * 2. Waits for candidate's spoken introduction (rejects empty/failed transcription).
 * 3. AI acknowledges introduction naturally.
 * 4. AI transitions to the first technical question exactly once after acknowledgement audio finishes.
 */
export class OpeningSequenceManager {
  private phase: OpeningPhase = 'not_started';
  private options: OpeningSequenceOptions;
  private introTranscript: string = '';
  private isStarted: boolean = false;
  private hasTransitionedToQ1: boolean = false;

  constructor(options: OpeningSequenceOptions) {
    this.options = options;
  }

  getPhase(): OpeningPhase {
    return this.phase;
  }

  getIntroTranscript(): string {
    return this.introTranscript;
  }

  hasStarted(): boolean {
    return this.isStarted;
  }

  hasFinished(): boolean {
    return this.hasTransitionedToQ1;
  }

  /**
   * Starts the opening sequence. Returns false if already started (duplicate prevention).
   */
  start(): boolean {
    if (this.isStarted) {
      return false;
    }
    this.isStarted = true;
    this.phase = 'welcome';
    this.options.onPhaseChange?.('welcome');

    const welcomeSpeech = createWelcomeSpeech(this.options.role);
    this.options.speakText(welcomeSpeech, () => {
      this.handleWelcomeFinished();
    });
    return true;
  }

  /**
   * Called when AI finishes speaking the welcome and introduction request.
   */
  handleWelcomeFinished(): void {
    if (this.phase !== 'welcome') return;
    this.phase = 'waiting_for_intro';
    this.options.onPhaseChange?.('waiting_for_intro');
    this.options.startListening();
  }

  /**
   * Replaces/updates the candidate's introduction transcript with the latest full live text (final + interim).
   * Prevents repeated concatenation when interim speech results arrive continuously.
   */
  updateLiveIntroTranscript(fullTranscript: string): boolean {
    if (this.phase !== 'waiting_for_intro') return false;
    this.introTranscript = (fullTranscript || '').trim();
    this.options.onCandidateSpeech?.(this.introTranscript);
    return isValidSelfIntroduction(this.introTranscript);
  }

  /**
   * Handles incoming candidate speech transcription during the introduction phase.
   */
  handleCandidateSpeech(transcript: string): boolean {
    if (this.phase !== 'waiting_for_intro') return false;
    if (!transcript || !transcript.trim()) return false;

    const trimmed = transcript.trim();
    this.introTranscript = this.introTranscript
      ? `${this.introTranscript} ${trimmed}`
      : trimmed;

    this.options.onCandidateSpeech?.(this.introTranscript);
    return isValidSelfIntroduction(this.introTranscript);
  }

  /**
   * Confirms candidate self-introduction and proceeds to natural acknowledgment.
   * Rejects empty or invalid self-introductions.
   */
  confirmIntroductionAndProceed(): boolean {
    if (this.phase !== 'waiting_for_intro') return false;
    if (!isValidSelfIntroduction(this.introTranscript)) {
      return false;
    }

    this.phase = 'acknowledging';
    this.options.onPhaseChange?.('acknowledging');

    const ackSpeech = createAcknowledgementSpeech(this.introTranscript);
    this.options.speakText(ackSpeech, () => {
      this.transitionToFirstQuestion();
    });
    return true;
  }

  /**
   * Transitions to the first technical question exactly once.
   */
  transitionToFirstQuestion(): boolean {
    if (this.hasTransitionedToQ1) return false;
    this.hasTransitionedToQ1 = true;
    this.phase = 'completed';
    this.options.onPhaseChange?.('completed');
    this.options.onQuestionStarted?.();

    if (this.options.questionText) {
      this.options.speakText(this.options.questionText, () => {
        this.options.startListening();
      });
    } else {
      this.options.startListening();
    }
    return true;
  }

  /**
   * Handles candidate speech interruption during opening to prevent audio freeze or stuck state.
   */
  handleInterruption(): boolean {
    if (this.phase === 'welcome') {
      // Candidate started speaking during welcome; stop welcome and listen to candidate
      this.phase = 'waiting_for_intro';
      this.options.onPhaseChange?.('waiting_for_intro');
      this.options.startListening();
      return true;
    }

    if (this.phase === 'acknowledging') {
      // Candidate interrupted acknowledgment; advance directly to Question 1
      return this.transitionToFirstQuestion();
    }

    return false;
  }
}

const STOP_WORDS_SET = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'just', 'me', 'more', 'most', 'my', 'no', 'nor',
  'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your'
]);

/**
 * Checks if speech containing uncertainty phrases or thinking pauses
 * is actually part of a substantive technical answer.
 */
export function isSubstantiveCandidateAnswer(text: string): boolean {
  if (!text || !text.trim()) return false;
  const cleaned = text.trim().toLowerCase();

  // 1. Contrast connector: "not sure, but...", "don't know, however..."
  const contrastMatch = /\b(not sure|don't know|dont know|not certain)\b.*?\b(but|however|although|though|except)\b/i.exec(cleaned);
  if (contrastMatch) {
    const after = cleaned.slice(contrastMatch.index + contrastMatch[0].length).trim();
    const wordsAfter = after.match(/\b[a-zA-Z0-9_-]+\b/g) || [];
    const meaningfulAfter = wordsAfter.filter(w => !STOP_WORDS_SET.has(w.toLowerCase()));
    if (meaningfulAfter.length >= 2 || wordsAfter.length >= 4) {
      return true;
    }
  }

  // 2. Thinking pauses followed by substantive answer: "let me think...", "give me a moment..."
  const thinkingPhrases = [
    'let me think',
    'give me a moment',
    'give me a second',
    'hold on',
    'one moment',
    'wait a second',
    'just a minute',
    'need a minute',
  ];
  for (const tp of thinkingPhrases) {
    if (cleaned.includes(tp)) {
      let stripped = cleaned.replace(tp, ' ');
      for (const filler of ['well', 'um', 'uh', 'about', 'this', 'that']) {
        stripped = stripped.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
      }
      const tokens = stripped.match(/\b[a-zA-Z0-9_-]+\b/g) || [];
      const meaningful = tokens.filter(w => !STOP_WORDS_SET.has(w.toLowerCase()));
      if (meaningful.length >= 3 || tokens.length >= 6) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Restates a technical question in plain language without altering assessment objective.
 */
export function simplifyQuestionText(questionText: string): string {
  if (!questionText || !questionText.trim()) {
    return 'Could you explain the core concept in your own words?';
  }

  const cleaned = questionText.trim();
  const replacements: Array<[RegExp, string]> = [
    [/\bexplain\s+(?:the\s+)?fundamental\s+(?:mechanisms|principles)\s+of\b/i, 'In simple terms, how does'],
    [/\bdiscuss\s+(?:the\s+)?architectural\s+trade-offs\s+of\b/i, 'In basic words, what are the pros and cons of'],
    [/\belaborate\s+on\b/i, 'Can you explain'],
    [/\bdescribe\s+(?:the\s+)?intricacies\s+of\b/i, 'In simple words, how does'],
    [/\bcompare\s+and\s+contrast\b/i, 'In plain language, what are the main differences between'],
    [/\bhow\s+do\s+you\s+approach\s+the\s+design\s+and\s+implementation\s+of\b/i, 'In simple terms, how would you build'],
  ];

  let rephrased = cleaned;
  for (const [pattern, sub] of replacements) {
    if (pattern.test(rephrased)) {
      rephrased = rephrased.replace(pattern, sub);
      break;
    }
  }

  if (rephrased === cleaned) {
    const coreQ = cleaned.replace(/[.?!]+$/, '');
    return `In plain words: ${coreQ}? Focus on the basic core idea in your own terms.`;
  } else {
    return `${rephrased.replace(/[.?!]+$/, '')}? Please describe the basic idea in your own words.`;
  }
}

/**
 * Detects client-side conversational commands (repeat, simplify, skip).
 * Returns null if the text is a normal candidate answer.
 */
export function detectConversationalCommand(text: string): 'repeat' | 'simplify' | 'skip' | null {
  if (!text || !text.trim()) return null;
  const cleaned = text.trim().toLowerCase();

  // If candidate gave a substantive technical answer, do not mistake it for a command
  if (isSubstantiveCandidateAnswer(cleaned)) {
    return null;
  }

  const repeatPatterns = [
    'repeat the question',
    'repeat that',
    'say that again',
    'say it again',
    'what was the question',
    'can you repeat',
    'could you repeat',
    'please repeat',
    'repeat please',
    'one more time',
    'pardon me',
    "didn't catch that",
    'did not catch that',
  ];
  if (repeatPatterns.some(p => cleaned.includes(p))) {
    return 'repeat';
  }

  const simplifyPatterns = [
    'explain in easier words',
    'easier words',
    'simpler words',
    'in simple terms',
    'in simpler terms',
    'simple words',
    'in plain english',
    'in plain language',
    'can you simplify',
    'could you simplify',
    'please simplify',
    'simplify the question',
    'simplify that',
    'make it simpler',
    'explain that more simply',
    'break it down simply',
  ];
  if (simplifyPatterns.some(p => cleaned.includes(p))) {
    return 'simplify';
  }

  const skipPatterns = [
    'skip this question',
    'skip the question',
    'please skip',
    'skip it',
    'can we skip',
    'could we skip',
    "let's skip",
    'lets skip',
    'i want to skip',
    'skip to the next',
    'move on to the next',
    'move on to next question',
    "let's move on",
    'lets move on',
    "i don't know this concept; let's move on",
    "i don't know this concept let's move on",
    "i don't know, let's move on",
    "i dont know, move on",
    'i do not know, move on',
    'pass on this question',
    '[skipped]',
    'next question please',
  ];
  if (skipPatterns.some(p => cleaned.includes(p))) {
    return 'skip';
  }

  return null;
}

/**
 * Legacy startup voice flow helper (preserved for backwards compatibility).
 */
export function runStartupVoiceSequence(
  introText: string,
  questionText: string | null | undefined,
  speakText: (text: string, onEnd?: () => void) => void,
  startListening: () => void
): void {
  speakText(introText, () => {
    if (questionText) {
      speakText(questionText, () => {
        startListening();
      });
    } else {
      startListening();
    }
  });
}

/**
 * Calculates estimated natural spoken duration in milliseconds.
 * Accounts for speaking rate (~145 words/min) plus punctuation pauses.
 */
export function calculateSpokenDurationMs(text: string, wordsPerMinute = 145): number {
  if (!text || !text.trim()) return 1000;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const msPerWord = (60 * 1000) / wordsPerMinute;
  const pauses = (text.match(/[.!?:]/g) || []).length;
  const commas = (text.match(/[,;]/g) || []).length;
  const pauseMs = pauses * 400 + commas * 200;

  const estimated = Math.round(words * msPerWord + pauseMs);
  return Math.max(2500, Math.min(estimated, 25000));
}

/**
 * Generates the professional closing speech.
 */
export function createClosingSpeech(customMessage?: string | null): string {
  if (customMessage && customMessage.trim()) {
    return customMessage.trim();
  }
  return 'Thank you so much for completing your interview assessment today. All your responses have been recorded, and your final performance report is now ready.';
}

export type ClosingPhase = 'not_started' | 'speaking' | 'completed';

export interface ClosingSequenceOptions {
  interviewId?: string;
  closingText?: string;
  speakText: (text: string, onEnd?: () => void) => void;
  stopMediaStream: () => void;
  onComplete: () => void;
  verifyReportReady?: (interviewId: string) => Promise<boolean>;
  getAudioStream?: () => MediaStream | null;
  audioContextFactory?: () => any;
  minDurationMs?: number;
  maxTimeoutMs?: number;
  silenceDurationMs?: number;
  onPhaseChange?: (phase: ClosingPhase) => void;
}

/**
 * State machine managing the professional interview closing sequence:
 * 1. AI delivers polite closing speech and thanks the candidate.
 * 2. Monitors outgoing audio playback until full audio drains out (does NOT cut off on response.done alone).
 * 3. Verifies final report readiness and persisted interview state in parallel.
 * 4. Ensures idempotency (no duplicate closing runs) and safety timeout (never hangs).
 * 5. Cleans up media streams and navigates to report screen cleanly.
 */
export class ClosingSequenceManager {
  private phase: ClosingPhase = 'not_started';
  private options: ClosingSequenceOptions;
  private isStarted: boolean = false;
  private isFinished: boolean = false;
  private timeoutId: any = null;
  private cancelToken: boolean = false;
  private activeAudioContext: any = null;

  constructor(options: ClosingSequenceOptions) {
    this.options = options;
  }

  getPhase(): ClosingPhase {
    return this.phase;
  }

  hasStarted(): boolean {
    return this.isStarted;
  }

  hasFinished(): boolean {
    return this.isFinished;
  }

  cancel(): void {
    this.cancelToken = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.activeAudioContext) {
      try {
        this.activeAudioContext.close();
      } catch {}
      this.activeAudioContext = null;
    }
  }

  async start(): Promise<void> {
    if (this.isStarted || this.isFinished) return;
    this.isStarted = true;
    this.phase = 'speaking';
    this.options.onPhaseChange?.('speaking');

    const closingText = createClosingSpeech(this.options.closingText);
    const calculatedDuration = calculateSpokenDurationMs(closingText);
    const minDuration = this.options.minDurationMs ?? calculatedDuration;
    const maxTimeout = this.options.maxTimeoutMs ?? Math.min(18000, minDuration + 5000);

    const startTime = Date.now();

    // 1. Parallel Report Verification
    const reportPromise = (async () => {
      if (!this.options.verifyReportReady || !this.options.interviewId) {
        return true;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.cancelToken) return false;
        try {
          const ready = await this.options.verifyReportReady(this.options.interviewId);
          if (ready) return true;
        } catch {
          // Transient error / waiting for backend report generation
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return false;
    })();

    // 2. Outgoing Audio Playback Completion
    const audioPromise = new Promise<void>((resolve) => {
      let isResolved = false;
      const finishAudio = () => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      };

      let speechCallbackFired = false;
      this.options.speakText(closingText, () => {
        speechCallbackFired = true;
        const elapsed = Date.now() - startTime;
        if (elapsed >= minDuration) {
          finishAudio();
        } else {
          setTimeout(finishAudio, minDuration - elapsed);
        }
      });

      // Stream Silence Analyser (Optional live audio level inspection)
      try {
        const stream = this.options.getAudioStream?.();
        const AudioCtx =
          this.options.audioContextFactory ||
          (typeof window !== 'undefined'
            ? window.AudioContext || (window as any).webkitAudioContext
            : null);

        if (stream && AudioCtx && stream.getAudioTracks().length > 0) {
          const audioCtx =
            typeof AudioCtx === 'function' && !AudioCtx.prototype
              ? (AudioCtx as any)()
              : new (AudioCtx as any)();
          this.activeAudioContext = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let consecutiveSilenceMs = 0;
          const silenceTarget = this.options.silenceDurationMs || 500;
          const pollInterval = 100;

          const intervalId = setInterval(() => {
            if (isResolved || this.cancelToken) {
              clearInterval(intervalId);
              try {
                audioCtx.close();
              } catch {}
              return;
            }

            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            if (average < 5) {
              consecutiveSilenceMs += pollInterval;
            } else {
              consecutiveSilenceMs = 0;
            }

            const elapsed = Date.now() - startTime;
            if (
              speechCallbackFired &&
              consecutiveSilenceMs >= silenceTarget &&
              elapsed >= minDuration * 0.8
            ) {
              clearInterval(intervalId);
              try {
                audioCtx.close();
              } catch {}
              finishAudio();
            }
          }, pollInterval);
        }
      } catch {
        // Fallback to speech callback & min duration
      }

      // Hard audio fallback timer at minDuration
      setTimeout(() => {
        finishAudio();
      }, minDuration);
    });

    // 3. Safety timeout to prevent hanging under any failure
    const safetyTimeoutPromise = new Promise<void>((resolve) => {
      this.timeoutId = setTimeout(() => {
        console.warn('ClosingSequenceManager safety timeout reached. Concluding session.');
        resolve();
      }, maxTimeout);
    });

    await Promise.race([
      Promise.all([audioPromise, reportPromise]),
      safetyTimeoutPromise,
    ]);

    if (this.cancelToken) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.phase = 'completed';
    this.isFinished = true;
    this.options.onPhaseChange?.('completed');

    this.options.stopMediaStream();
    this.options.onComplete();
  }
}

export interface AnswerTurnConfig {
  timeLimitSec?: number;
  initialSilenceTimeoutMs?: number;
  silenceGracePeriodMs?: number;
  midAnswerPauseTimeoutMs?: number;
  endOfTurnSilenceMs?: number;
  minSpeechLengthForAutoSubmit?: number;
}

export interface AnswerTurnCallbacks {
  onCountdownTick?: (remainingSec: number, elapsedSec: number) => void;
  onSilencePrompt?: (promptText: string) => void;
  onMidAnswerHint?: (hintText: string) => void;
  onAutoSubmit?: (finalAnswer: string, reason: 'vad_end_of_turn' | 'time_expired') => void;
  onMarkUnanswered?: (reason: 'silence_timeout' | 'time_expired') => void;
}

/**
 * Manages per-question turn lifecycle, visible countdown, silence handling,
 * mid-answer pauses, and automatic end-of-turn submission.
 */
export class AnswerTurnManager {
  private config: Required<AnswerTurnConfig>;
  private callbacks: AnswerTurnCallbacks;
  private currentQuestionId: string | null = null;
  private isTurnActive: boolean = false;
  private hasCandidateSpoken: boolean = false;
  private hasOfferedSilenceHelp: boolean = false;
  private hasOfferedMidAnswerHint: boolean = false;
  private isSubmitting: boolean = false;
  private elapsedSec: number = 0;
  private remainingSec: number = 0;
  private accumulatedAnswer: string = '';

  private countdownIntervalId: any = null;
  private initialSilenceTimerId: any = null;
  private silenceGraceTimerId: any = null;
  private midAnswerTimerId: any = null;
  private endOfTurnTimerId: any = null;

  constructor(config: AnswerTurnConfig = {}, callbacks: AnswerTurnCallbacks = {}) {
    this.config = {
      timeLimitSec: config.timeLimitSec ?? 120,
      initialSilenceTimeoutMs: config.initialSilenceTimeoutMs ?? 15000,
      silenceGracePeriodMs: config.silenceGracePeriodMs ?? 15000,
      midAnswerPauseTimeoutMs: config.midAnswerPauseTimeoutMs ?? 10000,
      endOfTurnSilenceMs: config.endOfTurnSilenceMs ?? 2000,
      minSpeechLengthForAutoSubmit: config.minSpeechLengthForAutoSubmit ?? 5,
    };
    this.callbacks = callbacks;
    this.remainingSec = this.config.timeLimitSec;
  }

  getIsTurnActive(): boolean {
    return this.isTurnActive;
  }

  getRemainingSec(): number {
    return this.remainingSec;
  }

  getElapsedSec(): number {
    return this.elapsedSec;
  }

  getAccumulatedAnswer(): string {
    return this.accumulatedAnswer;
  }

  hasSpoken(): boolean {
    return this.hasCandidateSpoken;
  }

  getCurrentQuestionId(): string | null {
    return this.currentQuestionId;
  }

  hasOfferedSilence(): boolean {
    return this.hasOfferedSilenceHelp;
  }

  startQuestionTurn(questionId: string) {
    this.stopTurn();

    this.currentQuestionId = questionId;
    this.isTurnActive = true;
    this.hasCandidateSpoken = false;
    this.hasOfferedSilenceHelp = false;
    this.hasOfferedMidAnswerHint = false;
    this.isSubmitting = false;
    this.elapsedSec = 0;
    this.remainingSec = this.config.timeLimitSec;
    this.accumulatedAnswer = '';

    // Notify initial tick
    this.callbacks.onCountdownTick?.(this.remainingSec, this.elapsedSec);

    // 1. Countdown interval (1 sec)
    this.countdownIntervalId = setInterval(() => {
      if (!this.isTurnActive) return;
      this.elapsedSec += 1;
      this.remainingSec = Math.max(0, this.config.timeLimitSec - this.elapsedSec);
      this.callbacks.onCountdownTick?.(this.remainingSec, this.elapsedSec);

      if (this.remainingSec <= 0) {
        this.handleTimeExpired();
      }
    }, 1000);

    // 2. Initial silence detection timer
    this.startInitialSilenceTimer();
  }

  private startInitialSilenceTimer() {
    this.clearTimer('initialSilence');
    this.clearTimer('silenceGrace');

    this.initialSilenceTimerId = setTimeout(() => {
      if (!this.isTurnActive || this.hasCandidateSpoken || this.isSubmitting) return;

      this.hasOfferedSilenceHelp = true;
      const prompt =
        'Would you like me to repeat the question or explain it in simpler terms? Or let me know if you would like to move on.';
      this.callbacks.onSilencePrompt?.(prompt);

      // Start grace period timer
      this.silenceGraceTimerId = setTimeout(() => {
        if (!this.isTurnActive || this.hasCandidateSpoken || this.isSubmitting) return;
        this.handleSilenceTimeout();
      }, this.config.silenceGracePeriodMs);
    }, this.config.initialSilenceTimeoutMs);
  }

  onSpeechStarted() {
    if (!this.isTurnActive || this.isSubmitting) return;

    // Candidate is actively speaking: cancel initial silence and end of turn timers
    this.hasCandidateSpoken = true;
    this.clearTimer('initialSilence');
    this.clearTimer('silenceGrace');
    this.clearTimer('endOfTurn');
    this.clearTimer('midAnswer');
  }

  onTranscriptUpdate(text: string) {
    if (!this.isTurnActive || this.isSubmitting) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    this.accumulatedAnswer = trimmed;
    this.hasCandidateSpoken = true;
    this.clearTimer('initialSilence');
    this.clearTimer('silenceGrace');
    this.clearTimer('endOfTurn');

    // Reset mid-answer pause timer
    this.resetMidAnswerPauseTimer();
  }

  private resetMidAnswerPauseTimer() {
    this.clearTimer('midAnswer');
    if (!this.isTurnActive || this.isSubmitting || this.hasOfferedMidAnswerHint) return;

    this.midAnswerTimerId = setTimeout(() => {
      if (!this.isTurnActive || this.isSubmitting || this.hasOfferedMidAnswerHint) return;
      if (this.accumulatedAnswer.length > 0) {
        this.hasOfferedMidAnswerHint = true;
        const hint =
          'Take your time. Feel free to explain the core concept, or let me know if you would like a simpler version.';
        this.callbacks.onMidAnswerHint?.(hint);
      }
    }, this.config.midAnswerPauseTimeoutMs);
  }

  onSpeechStopped() {
    if (!this.isTurnActive || this.isSubmitting) return;

    this.clearTimer('midAnswer');
    this.clearTimer('endOfTurn');

    // Only auto-submit if candidate has spoken substantive answer
    if (this.hasCandidateSpoken && this.accumulatedAnswer.length >= this.config.minSpeechLengthForAutoSubmit) {
      this.endOfTurnTimerId = setTimeout(() => {
        if (!this.isTurnActive || this.isSubmitting) return;
        this.handleAutoSubmit('vad_end_of_turn');
      }, this.config.endOfTurnSilenceMs);
    }
  }

  private handleAutoSubmit(reason: 'vad_end_of_turn' | 'time_expired') {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.stopTurn();
    this.callbacks.onAutoSubmit?.(this.accumulatedAnswer, reason);
  }

  private handleSilenceTimeout() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.stopTurn();
    this.callbacks.onMarkUnanswered?.('silence_timeout');
  }

  private handleTimeExpired() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.stopTurn();

    if (this.accumulatedAnswer.trim().length >= this.config.minSpeechLengthForAutoSubmit) {
      this.callbacks.onAutoSubmit?.(this.accumulatedAnswer, 'time_expired');
    } else {
      this.callbacks.onMarkUnanswered?.('time_expired');
    }
  }

  private clearTimer(timerName: 'initialSilence' | 'silenceGrace' | 'midAnswer' | 'endOfTurn') {
    if (timerName === 'initialSilence' && this.initialSilenceTimerId) {
      clearTimeout(this.initialSilenceTimerId);
      this.initialSilenceTimerId = null;
    } else if (timerName === 'silenceGrace' && this.silenceGraceTimerId) {
      clearTimeout(this.silenceGraceTimerId);
      this.silenceGraceTimerId = null;
    } else if (timerName === 'midAnswer' && this.midAnswerTimerId) {
      clearTimeout(this.midAnswerTimerId);
      this.midAnswerTimerId = null;
    } else if (timerName === 'endOfTurn' && this.endOfTurnTimerId) {
      clearTimeout(this.endOfTurnTimerId);
      this.endOfTurnTimerId = null;
    }
  }

  stopTurn() {
    this.isTurnActive = false;
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.clearTimer('initialSilence');
    this.clearTimer('silenceGrace');
    this.clearTimer('midAnswer');
    this.clearTimer('endOfTurn');
  }
}
