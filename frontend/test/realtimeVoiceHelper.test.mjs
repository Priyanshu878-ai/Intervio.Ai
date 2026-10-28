import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInterviewerSpeechEvent,
  createWelcomeSpeech,
  createAcknowledgementSpeech,
  isValidSelfIntroduction,
  OpeningSequenceManager,
  runStartupVoiceSequence,
  detectConversationalCommand,
  isSubstantiveCandidateAnswer,
  simplifyQuestionText,
  calculateSpokenDurationMs,
  createClosingSpeech,
  ClosingSequenceManager,
  AnswerTurnManager,
} from '../src/utils/realtimeVoiceHelper.ts';

describe('Realtime Voice Helper - Startup Voice Flow', () => {
  test('creates interviewer speech event as direct instructions, never as candidate/user message', () => {
    const promptText = 'Welcome to your AI interview for the Backend Engineer role.';
    const event = createInterviewerSpeechEvent(promptText);

    // 1. Must be response.create
    assert.strictEqual(event.type, 'response.create');

    // 2. Must request audio and text modalities
    assert.deepStrictEqual(event.response.modalities, ['audio', 'text']);

    // 3. Instructions must contain prompt text and establish interviewer persona
    assert.ok(event.response.instructions.includes(promptText));
    assert.ok(event.response.instructions.includes('You are Intervio.Ai, the interviewer'));

    // 4. Must NOT have candidate/user role attributes
    assert.strictEqual(event.role, undefined);
    assert.strictEqual(event.item, undefined);
  });

  test('createWelcomeSpeech covers welcome, interviewer identity, format, repeat/clarify/skip, and intro request', () => {
    const welcome = createWelcomeSpeech('Full Stack Developer');

    // 1. Welcome greeting
    assert.ok(welcome.toLowerCase().includes('welcome'));

    // 2. Name & role
    assert.ok(welcome.includes('Intervio'));
    assert.ok(welcome.includes('Full Stack Developer'));

    // 3. Interview format explanation
    assert.ok(welcome.toLowerCase().includes('technical questions'));

    // 4. Conversational commands: repeat, clarify, skip
    assert.ok(welcome.toLowerCase().includes('repeat'));
    assert.ok(welcome.toLowerCase().includes('clarify'));
    assert.ok(welcome.toLowerCase().includes('skip'));

    // 5. Asks candidate to introduce themselves
    assert.ok(welcome.toLowerCase().includes('introduce yourself'));
  });

  test('isValidSelfIntroduction rejects empty, whitespace, and trivial noise', () => {
    assert.strictEqual(isValidSelfIntroduction(null), false);
    assert.strictEqual(isValidSelfIntroduction(undefined), false);
    assert.strictEqual(isValidSelfIntroduction(''), false);
    assert.strictEqual(isValidSelfIntroduction('   \n  \t  '), false);
    assert.strictEqual(isValidSelfIntroduction('uh'), false);
    assert.strictEqual(isValidSelfIntroduction('hello'), false);

    // Valid introductions (2+ meaningful words)
    assert.strictEqual(isValidSelfIntroduction('Hi, I am Alex.'), true);
    assert.strictEqual(
      isValidSelfIntroduction('I am a frontend developer with 4 years of experience building web apps.'),
      true
    );
  });

  test('createAcknowledgementSpeech provides natural spoken acknowledgment', () => {
    const ack = createAcknowledgementSpeech('I am Alex, a developer');
    assert.ok(typeof ack === 'string');
    assert.ok(ack.length > 20);
    assert.ok(ack.toLowerCase().includes('thank you') || ack.toLowerCase().includes('pleasure'));
  });

  test('OpeningSequenceManager executes strict sequential opening order', () => {
    const events = [];
    const speakCallbacks = [];

    const mockSpeakText = (text, onEnd) => {
      events.push(`speak:${text}`);
      if (onEnd) speakCallbacks.push(onEnd);
    };

    const mockStartListening = () => {
      events.push('startListening');
    };

    const phaseLog = [];
    const manager = new OpeningSequenceManager({
      role: 'Backend Engineer',
      questionText: 'What is ACID in database systems?',
      speakText: mockSpeakText,
      startListening: mockStartListening,
      onPhaseChange: (phase) => phaseLog.push(phase),
    });

    // 1. Initial state
    assert.strictEqual(manager.getPhase(), 'not_started');
    assert.strictEqual(manager.hasStarted(), false);
    assert.strictEqual(manager.hasFinished(), false);

    // 2. Start opening
    const started = manager.start();
    assert.strictEqual(started, true);
    assert.strictEqual(manager.getPhase(), 'welcome');
    assert.strictEqual(phaseLog[0], 'welcome');
    assert.strictEqual(events.length, 1);
    assert.ok(events[0].startsWith('speak:Hello and welcome'));

    // Question 1 must NOT start before welcome finishes
    assert.ok(!events.some((e) => e.includes('What is ACID')));

    // 3. Welcome audio finishes
    const finishWelcome = speakCallbacks.shift();
    finishWelcome();

    assert.strictEqual(manager.getPhase(), 'waiting_for_intro');
    assert.strictEqual(phaseLog[1], 'waiting_for_intro');
    assert.strictEqual(events[1], 'startListening');

    // 4. Candidate speech arrives - empty or single syllable rejected
    assert.strictEqual(manager.handleCandidateSpeech(''), false);
    assert.strictEqual(manager.handleCandidateSpeech('uh'), false);
    assert.strictEqual(manager.confirmIntroductionAndProceed(), false);
    assert.strictEqual(manager.getPhase(), 'waiting_for_intro');

    // Candidate speaks valid self introduction
    const valid = manager.handleCandidateSpeech("Hi, I'm Jordan. I have worked with Python and PostgreSQL for 5 years.");
    assert.strictEqual(valid, true);

    // Confirm candidate introduction
    const proceeded = manager.confirmIntroductionAndProceed();
    assert.strictEqual(proceeded, true);
    assert.strictEqual(manager.getPhase(), 'acknowledging');
    assert.strictEqual(phaseLog[2], 'acknowledging');

    // Question 1 must NOT start before acknowledgement audio finishes
    assert.ok(!events.some((e) => e.includes('What is ACID')));

    // 5. Complete acknowledgement audio
    const finishAck = speakCallbacks.shift();
    finishAck();

    // Now it transitions to first question
    assert.strictEqual(manager.getPhase(), 'completed');
    assert.strictEqual(manager.hasFinished(), true);
    assert.strictEqual(phaseLog[3], 'completed');

    // Question 1 speech begins
    assert.ok(events.some((e) => e.includes('What is ACID')));

    // Complete Question 1 speech
    const finishQ1 = speakCallbacks.shift();
    finishQ1();

    // Candidate is now listening for Question 1 answer
    assert.strictEqual(events[events.length - 1], 'startListening');
  });

  test('OpeningSequenceManager prevents duplicate startup and multiple Q1 transitions', () => {
    let speakCount = 0;
    const mockSpeakText = (text, onEnd) => {
      speakCount++;
      if (onEnd) onEnd();
    };

    let listenCount = 0;
    const mockStartListening = () => {
      listenCount++;
    };

    const manager = new OpeningSequenceManager({
      role: 'DevOps Engineer',
      questionText: 'Explain Kubernetes pods.',
      speakText: mockSpeakText,
      startListening: mockStartListening,
    });

    // First start
    assert.strictEqual(manager.start(), true);

    // Duplicate start attempt must be rejected
    assert.strictEqual(manager.start(), false);

    // Provide intro and proceed
    manager.handleCandidateSpeech('Hello, I am a DevOps engineer with 3 years of Kubernetes experience.');
    manager.confirmIntroductionAndProceed();

    assert.strictEqual(manager.getPhase(), 'completed');

    // Duplicate transition attempt must be rejected
    assert.strictEqual(manager.transitionToFirstQuestion(), false);
  });

  test('OpeningSequenceManager handles interruption during welcome without freezing', () => {
    const events = [];
    const manager = new OpeningSequenceManager({
      role: 'Frontend Engineer',
      questionText: 'Explain Virtual DOM.',
      speakText: (text) => events.push(`speak:${text}`),
      startListening: () => events.push('startListening'),
    });

    manager.start();
    assert.strictEqual(manager.getPhase(), 'welcome');

    // Candidate interrupts welcome by speaking
    const interrupted = manager.handleInterruption();
    assert.strictEqual(interrupted, true);
    assert.strictEqual(manager.getPhase(), 'waiting_for_intro');
    assert.ok(events.includes('startListening'));
  });

  test('OpeningSequenceManager handles interruption during acknowledgment without freezing', () => {
    const events = [];
    const manager = new OpeningSequenceManager({
      role: 'Security Engineer',
      questionText: 'What is CSRF?',
      speakText: (text) => events.push(`speak:${text}`),
      startListening: () => events.push('startListening'),
    });

    manager.start();
    // Simulate welcome end
    manager.handleWelcomeFinished();
    manager.handleCandidateSpeech('Hello, I am a security engineer with expertise in application pen-testing.');
    manager.confirmIntroductionAndProceed();
    assert.strictEqual(manager.getPhase(), 'acknowledging');

    // Candidate interrupts acknowledgment
    const interrupted = manager.handleInterruption();
    assert.strictEqual(interrupted, true);
    assert.strictEqual(manager.getPhase(), 'completed');
    assert.ok(events.some((e) => e.includes('What is CSRF')));
  });

  test('detectConversationalCommand detects repeat, simplify, and skip accurately', () => {
    // Repeat requests
    assert.strictEqual(detectConversationalCommand('Can you repeat the question?'), 'repeat');
    assert.strictEqual(detectConversationalCommand('Could you please repeat that?'), 'repeat');
    assert.strictEqual(detectConversationalCommand('Pardon me, say it again'), 'repeat');

    // Simplify requests
    assert.strictEqual(detectConversationalCommand('Please explain in easier words.'), 'simplify');
    assert.strictEqual(detectConversationalCommand('Can you simplify the question?'), 'simplify');
    assert.strictEqual(detectConversationalCommand('Explain that in simple terms'), 'simplify');

    // Skip requests
    assert.strictEqual(detectConversationalCommand('Please skip this question'), 'skip');
    assert.strictEqual(detectConversationalCommand("I don't know this concept; let's move on."), 'skip');
    assert.strictEqual(detectConversationalCommand("Let's skip this and move to the next question"), 'skip');
    assert.strictEqual(detectConversationalCommand('[SKIPPED]'), 'skip');
  });

  test('detectConversationalCommand does NOT mistake normal answers with uncertainty for commands', () => {
    // Answers starting with "let me think"
    const thinkingAnswer =
      'Let me think about this. Database indexing uses B-trees or hash tables to speed up search lookups from O(N) to O(log N).';
    assert.strictEqual(detectConversationalCommand(thinkingAnswer), null);
    assert.strictEqual(isSubstantiveCandidateAnswer(thinkingAnswer), true);

    // Answers containing "I am not sure, but..."
    const uncertainAnswer =
      "I'm not sure about the exact RFC number, but HTTP/2 introduces multiplexing and binary framing over a single TCP stream.";
    assert.strictEqual(detectConversationalCommand(uncertainAnswer), null);
    assert.strictEqual(isSubstantiveCandidateAnswer(uncertainAnswer), true);

    // Answers containing "I don't know, however..."
    const partialAnswer =
      "I don't know the exact syntax in Python 3.12, however context managers implement __enter__ and __exit__ methods.";
    assert.strictEqual(detectConversationalCommand(partialAnswer), null);
    assert.strictEqual(isSubstantiveCandidateAnswer(partialAnswer), true);

    // Standalone thinking pauses without substantive answer SHOULD be recognized as not substantive
    assert.strictEqual(isSubstantiveCandidateAnswer('let me think'), false);
    assert.strictEqual(isSubstantiveCandidateAnswer('give me a moment'), false);
  });

  test('simplifyQuestionText restates questions in plain language without altering assessment objective', () => {
    const complexQuestion = 'Explain the fundamental mechanisms of database indexing.';
    const simplified = simplifyQuestionText(complexQuestion);

    assert.ok(typeof simplified === 'string');
    assert.ok(simplified.toLowerCase().includes('database indexing'));
    assert.ok(simplified.toLowerCase().includes('simple terms') || simplified.toLowerCase().includes('own words'));
    // Must NOT contain an answer snippet
    assert.ok(!simplified.includes('B-tree'));
  });

  test('Transcript isolation and duplicate advancement prevention logic', () => {
    let answerText = '';
    let submitCount = 0;
    let isSubmitting = false;

    const mockProcessTranscript = (incomingChunk) => {
      const cmd = detectConversationalCommand(incomingChunk);
      if (cmd === 'repeat' || cmd === 'simplify') {
        // Command speech isolated: do NOT append to candidate answer
        return `handled_command:${cmd}`;
      } else if (cmd === 'skip') {
        // Trigger skip
        if (isSubmitting) return 'duplicate_blocked';
        isSubmitting = true;
        submitCount++;
        return 'skipped';
      } else {
        // Normal answer: append
        answerText += (answerText ? ' ' : '') + incomingChunk;
        return 'appended';
      }
    };

    // 1. Repeat speech received -> isolated, not appended to answer
    const r1 = mockProcessTranscript('Can you repeat the question?');
    assert.strictEqual(r1, 'handled_command:repeat');
    assert.strictEqual(answerText, '');

    // 2. Simplify speech received -> isolated, not appended to answer
    const r2 = mockProcessTranscript('Please explain in easier words.');
    assert.strictEqual(r2, 'handled_command:simplify');
    assert.strictEqual(answerText, '');

    // 3. Normal answer with uncertainty received -> preserved and appended
    const r3 = mockProcessTranscript(
      "I'm not sure about the exact RFC, but HTTP/2 has multiplexing and header compression."
    );
    assert.strictEqual(r3, 'appended');
    assert.ok(answerText.includes('HTTP/2 has multiplexing'));

    // 4. Duplicate submission blocked when submitting
    const r4 = mockProcessTranscript('Please skip this question');
    assert.strictEqual(r4, 'skipped');
    assert.strictEqual(submitCount, 1);

    // Overlapping concurrent skip event arrives while submitting
    const r5 = mockProcessTranscript('Please skip this question');
    assert.strictEqual(r5, 'duplicate_blocked');
    assert.strictEqual(submitCount, 1); // Advanced exactly once!
  });

  test('Interim progression: replaces live interim updates without duplicating prefixes', () => {
    let capturedTranscript = '';
    const manager = new OpeningSequenceManager({
      role: 'Full Stack Engineer',
      questionText: 'Explain REST.',
      speakText: (_t, onEnd) => onEnd?.(),
      startListening: () => {},
      onCandidateSpeech: (text) => {
        capturedTranscript = text;
      },
    });

    manager.start();
    assert.strictEqual(manager.getPhase(), 'waiting_for_intro');

    // Feed sequential interim results as user speaks:
    manager.updateLiveIntroTranscript('my');
    assert.strictEqual(capturedTranscript, 'my');
    assert.strictEqual(manager.getIntroTranscript(), 'my');

    manager.updateLiveIntroTranscript('my name');
    assert.strictEqual(capturedTranscript, 'my name');
    assert.strictEqual(manager.getIntroTranscript(), 'my name');

    manager.updateLiveIntroTranscript('my name is');
    assert.strictEqual(capturedTranscript, 'my name is');
    assert.strictEqual(manager.getIntroTranscript(), 'my name is');

    manager.updateLiveIntroTranscript('my name is Priyanshu');
    assert.strictEqual(capturedTranscript, 'my name is Priyanshu');
    assert.strictEqual(manager.getIntroTranscript(), 'my name is Priyanshu');

    // Final result commits:
    manager.updateLiveIntroTranscript('my name is Priyanshu');
    assert.strictEqual(manager.getIntroTranscript(), 'my name is Priyanshu');

    // Must be exactly once, with zero duplicated prefixes
    const occurrences = manager.getIntroTranscript().match(/my name is Priyanshu/g) || [];
    assert.strictEqual(occurrences.length, 1);
  });

  test('Multi-sentence speech concatenates finalized sentences cleanly with live interim text', () => {
    let finalBuffer = '';
    let livePreview = '';

    const simulateSpeechEvent = (chunk, isFinal) => {
      let interim = '';
      if (isFinal) {
        finalBuffer += (finalBuffer ? ' ' : '') + chunk.trim();
      } else {
        interim = chunk.trim();
      }
      livePreview = (finalBuffer + (interim ? (finalBuffer ? ' ' : '') + interim : '')).trim();
      return livePreview;
    };

    // Sentence 1 interim -> final
    simulateSpeechEvent('My', false);
    simulateSpeechEvent('My name is', false);
    simulateSpeechEvent('My name is Priyanshu.', true);
    assert.strictEqual(livePreview, 'My name is Priyanshu.');

    // Sentence 2 interim -> final
    simulateSpeechEvent('I am', false);
    assert.strictEqual(livePreview, 'My name is Priyanshu. I am');

    simulateSpeechEvent('I am a full stack', false);
    assert.strictEqual(livePreview, 'My name is Priyanshu. I am a full stack');

    simulateSpeechEvent('I am a full stack developer.', true);
    assert.strictEqual(livePreview, 'My name is Priyanshu. I am a full stack developer.');
    assert.strictEqual(finalBuffer, 'My name is Priyanshu. I am a full stack developer.');
  });

  test('Introduction text does not leak into Question 1 answer buffer', () => {
    let answerText = '';
    let introText = '';
    const events = [];

    const manager = new OpeningSequenceManager({
      role: 'Backend Engineer',
      questionText: 'Explain database indexing.',
      speakText: (t, onEnd) => {
        events.push(t);
        onEnd?.();
      },
      startListening: () => {},
      onCandidateSpeech: (text) => {
        introText = text;
      },
      onQuestionStarted: () => {
        // Question 1 starts with a clean answer buffer
        answerText = '';
      },
    });

    manager.start();
    // Candidate delivers intro
    manager.updateLiveIntroTranscript('Hello, I am Priyanshu, a backend engineer with 4 years experience.');
    assert.ok(introText.includes('Priyanshu'));

    // Complete intro and proceed
    manager.confirmIntroductionAndProceed();
    assert.strictEqual(manager.getPhase(), 'completed');

    // Answer buffer for Question 1 must be clean and not contaminated by candidate intro
    assert.strictEqual(answerText, '');
    assert.ok(!answerText.includes('Priyanshu'));
  });

  test('runStartupVoiceSequence backward compatibility', () => {
    const introText = 'Welcome to the interview.';
    const questionText = 'Explain indexing in databases.';
    const callLog = [];
    const callbacks = [];

    runStartupVoiceSequence(
      introText,
      questionText,
      (text, onEnd) => {
        callLog.push(text);
        if (onEnd) callbacks.push(onEnd);
      },
      () => callLog.push('listen')
    );

    assert.strictEqual(callLog[0], introText);
    callbacks.shift()();
    assert.strictEqual(callLog[1], questionText);
    callbacks.shift()();
    assert.strictEqual(callLog[2], 'listen');
  });
});

describe('Realtime Voice Helper — Closing Flow & Audio Playback Completion', () => {
  test('calculateSpokenDurationMs scales appropriately with word count and punctuation pauses', () => {
    const shortPhrase = 'Thank you.';
    const longClosing =
      'Thank you so much for completing your interview assessment today. All your responses have been recorded, and your final performance report is now ready.';

    const shortDuration = calculateSpokenDurationMs(shortPhrase);
    const longDuration = calculateSpokenDurationMs(longClosing);

    assert.ok(shortDuration >= 2500, 'Minimum floor applied');
    assert.ok(longDuration > shortDuration, 'Longer speech has longer duration');
    assert.ok(longDuration >= 8000, '24 words with punctuation takes at least 8 seconds');
    assert.ok(longDuration <= 18000, 'Does not exceed realistic maximum bounds');
  });

  test('createClosingSpeech provides default speech and preserves custom backend contextual response', () => {
    const defaultSpeech = createClosingSpeech();
    assert.ok(defaultSpeech.includes('All your responses have been recorded'));
    assert.ok(defaultSpeech.includes('performance report is now ready'));

    const custom = 'Understood, skipping this question. All responses have been recorded, and your assessment is now complete.';
    assert.strictEqual(createClosingSpeech(custom), custom);
  });

  test('waits for audio playback completion before calling onComplete', async () => {
    let completedCalled = false;
    let stopStreamCalled = false;
    let speechSpokenText = '';
    const events = [];

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-123',
      minDurationMs: 60,
      maxTimeoutMs: 500,
      speakText: (text, onEnd) => {
        speechSpokenText = text;
        events.push('speech_started');
        // Simulate audio draining over 60ms
        setTimeout(() => {
          events.push('audio_playback_finished');
          if (onEnd) onEnd();
        }, 60);
      },
      verifyReportReady: async () => {
        events.push('report_ready');
        return true;
      },
      stopMediaStream: () => {
        stopStreamCalled = true;
        events.push('stream_stopped');
      },
      onComplete: () => {
        completedCalled = true;
        events.push('on_complete');
      },
    });

    assert.strictEqual(manager.getPhase(), 'not_started');
    assert.strictEqual(manager.hasStarted(), false);

    const startPromise = manager.start();
    assert.strictEqual(manager.getPhase(), 'speaking');
    assert.strictEqual(manager.hasStarted(), true);

    // Audio has NOT finished yet at 10ms
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(completedCalled, false, 'Must not navigate while audio is playing');
    assert.strictEqual(stopStreamCalled, false, 'Must not stop media stream while audio is playing');

    // Wait for full completion
    await startPromise;

    assert.strictEqual(completedCalled, true);
    assert.strictEqual(stopStreamCalled, true);
    assert.strictEqual(manager.getPhase(), 'completed');
    assert.strictEqual(manager.hasFinished(), true);
    assert.ok(speechSpokenText.includes('All your responses have been recorded'));

    // Sequence check: speech started -> audio finished -> stream stopped -> on_complete
    assert.ok(events.indexOf('speech_started') < events.indexOf('audio_playback_finished'));
    assert.ok(events.indexOf('audio_playback_finished') < events.indexOf('stream_stopped'));
    assert.ok(events.indexOf('stream_stopped') <= events.indexOf('on_complete'));
  });

  test('does not rely on response.done alone: waits for minDuration audio buffer drain if response.done arrives prematurely', async () => {
    let completedTime = 0;
    const startTime = Date.now();

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-456',
      minDurationMs: 80, // Minimum expected duration for audio
      maxTimeoutMs: 500,
      speakText: (_text, onEnd) => {
        // Simulate OpenAI Realtime response.done arriving extremely early (e.g. 10ms)
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 10);
      },
      verifyReportReady: async () => true,
      stopMediaStream: () => {},
      onComplete: () => {
        completedTime = Date.now();
      },
    });

    await manager.start();

    const elapsed = completedTime - startTime;
    // Must NOT have resolved at 10ms when response.done arrived; must wait at least minDuration (80ms)
    assert.ok(
      elapsed >= 70,
      `Expected elapsed time >= 70ms to drain audio, but got ${elapsed}ms`
    );
  });

  test('verifies report readiness in parallel and does not navigate until report is ready', async () => {
    let reportChecked = false;
    let completedCalled = false;

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-789',
      minDurationMs: 30,
      maxTimeoutMs: 500,
      speakText: (_text, onEnd) => {
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 30);
      },
      verifyReportReady: async () => {
        // Report takes 60ms to generate
        await new Promise((r) => setTimeout(r, 60));
        reportChecked = true;
        return true;
      },
      stopMediaStream: () => {},
      onComplete: () => {
        assert.strictEqual(reportChecked, true, 'Report must be verified before onComplete');
        completedCalled = true;
      },
    });

    await manager.start();
    assert.strictEqual(completedCalled, true);
    assert.strictEqual(reportChecked, true);
  });

  test('safety timeout prevents hanging if audio callback or report never resolves', async () => {
    let completedCalled = false;
    let streamStopped = false;

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-hang-test',
      minDurationMs: 20,
      maxTimeoutMs: 60, // Hard safety ceiling of 60ms
      speakText: () => {
        // Simulates audio callback hanging / never firing
      },
      verifyReportReady: () => {
        // Simulates network hanging forever
        return new Promise(() => {});
      },
      stopMediaStream: () => {
        streamStopped = true;
      },
      onComplete: () => {
        completedCalled = true;
      },
    });

    await manager.start();

    assert.strictEqual(completedCalled, true, 'Safety timeout must trigger onComplete');
    assert.strictEqual(streamStopped, true, 'Safety timeout must stop media stream');
    assert.strictEqual(manager.getPhase(), 'completed');
  });

  test('handles report verification failure gracefully without throwing or leaving interview stuck', async () => {
    let completedCalled = false;

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-fail-report',
      minDurationMs: 30,
      maxTimeoutMs: 200,
      speakText: (_text, onEnd) => {
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 30);
      },
      verifyReportReady: async () => {
        throw new Error('500 Internal Server Error generating report');
      },
      stopMediaStream: () => {},
      onComplete: () => {
        completedCalled = true;
      },
    });

    await manager.start();
    assert.strictEqual(completedCalled, true);
    assert.strictEqual(manager.getPhase(), 'completed');
  });

  test('prevent duplicate closing runs: subsequent start calls are strictly idempotent', async () => {
    let speakCount = 0;
    let completeCount = 0;

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-idempotent',
      minDurationMs: 40,
      maxTimeoutMs: 200,
      speakText: (_text, onEnd) => {
        speakCount++;
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 40);
      },
      verifyReportReady: async () => true,
      stopMediaStream: () => {},
      onComplete: () => {
        completeCount++;
      },
    });

    // Call start twice in parallel
    const p1 = manager.start();
    const p2 = manager.start();

    await Promise.all([p1, p2]);

    assert.strictEqual(speakCount, 1, 'speakText should only be called once');
    assert.strictEqual(completeCount, 1, 'onComplete should only be called once');
  });

  test('cancel cleans up timers and active audio context immediately', async () => {
    let completedCalled = false;

    const manager = new ClosingSequenceManager({
      interviewId: 'interview-cancel-test',
      minDurationMs: 100,
      maxTimeoutMs: 300,
      speakText: () => {},
      verifyReportReady: async () => true,
      stopMediaStream: () => {},
      onComplete: () => {
        completedCalled = true;
      },
    });

    manager.start();
    manager.cancel();

    await new Promise((r) => setTimeout(r, 120));
    // After cancel, onComplete must NOT have been called
    assert.strictEqual(completedCalled, false);
  });
});

describe('AnswerTurnManager — Automatic Turn, Silence & Timeout Management', () => {
  test('initializes with default config and fires initial tick on start', () => {
    let tickCount = 0;
    let initialRemaining = -1;

    const manager = new AnswerTurnManager(
      { timeLimitSec: 90 },
      {
        onCountdownTick: (remaining, elapsed) => {
          tickCount++;
          initialRemaining = remaining;
        },
      }
    );

    manager.startQuestionTurn('q-1');
    assert.strictEqual(manager.getIsTurnActive(), true);
    assert.strictEqual(manager.getRemainingSec(), 90);
    assert.strictEqual(manager.getElapsedSec(), 0);
    assert.strictEqual(tickCount, 1);
    assert.strictEqual(initialRemaining, 90);

    manager.stopTurn();
    assert.strictEqual(manager.getIsTurnActive(), false);
  });

  test('prolonged silence triggers prompt and marks question unanswered after grace period', async () => {
    let silencePromptFired = false;
    let unansweredReason = null;

    const manager = new AnswerTurnManager(
      {
        initialSilenceTimeoutMs: 30,
        silenceGracePeriodMs: 30,
        timeLimitSec: 60,
      },
      {
        onSilencePrompt: (prompt) => {
          silencePromptFired = true;
          assert.ok(prompt.toLowerCase().includes('repeat') || prompt.toLowerCase().includes('simpler'));
        },
        onMarkUnanswered: (reason) => {
          unansweredReason = reason;
        },
      }
    );

    manager.startQuestionTurn('q-silence');

    // At 40ms, initial silence prompt should have fired, but not yet unanswered
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(silencePromptFired, true);
    assert.strictEqual(unansweredReason, null);

    // At 80ms, grace period should have expired and marked unanswered
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(unansweredReason, 'silence_timeout');
    assert.strictEqual(manager.getIsTurnActive(), false);
  });

  test('candidate speech cancels silence prompt and grace period', async () => {
    let silencePromptFired = false;
    let unansweredFired = false;

    const manager = new AnswerTurnManager(
      {
        initialSilenceTimeoutMs: 40,
        silenceGracePeriodMs: 40,
        timeLimitSec: 60,
      },
      {
        onSilencePrompt: () => {
          silencePromptFired = true;
        },
        onMarkUnanswered: () => {
          unansweredFired = true;
        },
      }
    );

    manager.startQuestionTurn('q-speech-cancels');

    // Candidate begins speaking before silence timeout
    setTimeout(() => {
      manager.onSpeechStarted();
      manager.onTranscriptUpdate('I would use an index on the foreign key column.');
    }, 20);

    await new Promise((r) => setTimeout(r, 90));
    assert.strictEqual(silencePromptFired, false, 'Silence prompt should not fire if candidate speaks');
    assert.strictEqual(unansweredFired, false, 'Unanswered should not fire if candidate speaks');
    assert.strictEqual(manager.hasSpoken(), true);

    manager.stopTurn();
  });

  test('mid-answer pause triggers encouragement hint without spoiling answer', async () => {
    let hintFiredCount = 0;
    let hintText = '';

    const manager = new AnswerTurnManager(
      {
        midAnswerPauseTimeoutMs: 35,
        timeLimitSec: 60,
      },
      {
        onMidAnswerHint: (hint) => {
          hintFiredCount++;
          hintText = hint;
        },
      }
    );

    manager.startQuestionTurn('q-mid-pause');
    manager.onSpeechStarted();
    manager.onTranscriptUpdate('In distributed systems, the CAP theorem states...');

    // Wait for mid-answer pause timeout
    await new Promise((r) => setTimeout(r, 55));

    assert.strictEqual(hintFiredCount, 1);
    assert.ok(hintText.length > 10);
    assert.ok(!hintText.toLowerCase().includes('consistency and partition')); // Does not spoil the technical answer

    // If candidate continues speaking, hint is not fired again (one-shot per turn)
    manager.onTranscriptUpdate('...states that you can only guarantee two out of three properties.');
    await new Promise((r) => setTimeout(r, 55));
    assert.strictEqual(hintFiredCount, 1);

    manager.stopTurn();
  });

  test('VAD end-of-turn: speech stopped debounces and auto-submits substantive answer', async () => {
    let submittedAnswer = null;
    let submitReason = null;

    const manager = new AnswerTurnManager(
      {
        endOfTurnSilenceMs: 35,
        minSpeechLengthForAutoSubmit: 10,
        timeLimitSec: 60,
      },
      {
        onAutoSubmit: (answer, reason) => {
          submittedAnswer = answer;
          submitReason = reason;
        },
      }
    );

    manager.startQuestionTurn('q-vad-submit');
    manager.onSpeechStarted();
    manager.onTranscriptUpdate('A binary search tree maintains sorted order with logarithmic lookup time.');
    manager.onSpeechStopped();

    // Before debounce expires, submit has not fired
    await new Promise((r) => setTimeout(r, 15));
    assert.strictEqual(submittedAnswer, null);

    // After debounce expires, auto-submit fires
    await new Promise((r) => setTimeout(r, 35));
    assert.strictEqual(submitReason, 'vad_end_of_turn');
    assert.strictEqual(
      submittedAnswer,
      'A binary search tree maintains sorted order with logarithmic lookup time.'
    );
    assert.strictEqual(manager.getIsTurnActive(), false);
  });

  test('resuming speech before VAD silence debounce cancels auto-submit', async () => {
    let submitFired = false;

    const manager = new AnswerTurnManager(
      {
        endOfTurnSilenceMs: 50,
        minSpeechLengthForAutoSubmit: 10,
        timeLimitSec: 60,
      },
      {
        onAutoSubmit: () => {
          submitFired = true;
        },
      }
    );

    manager.startQuestionTurn('q-vad-resume');
    manager.onSpeechStarted();
    manager.onTranscriptUpdate('First, we calculate the prefix sum array.');
    manager.onSpeechStopped();

    // At 20ms, candidate speaks again before the 50ms silence debounce finishes
    await new Promise((r) => setTimeout(r, 20));
    manager.onSpeechStarted();
    manager.onTranscriptUpdate('First, we calculate the prefix sum array, then we query in O(1) time.');

    // Wait past the original 50ms mark
    await new Promise((r) => setTimeout(r, 45));
    assert.strictEqual(submitFired, false, 'Auto-submit should be aborted when speech resumes');

    manager.stopTurn();
  });

  test('per-question countdown expiry auto-submits accumulated answer when substantive', async () => {
    let submittedAnswer = null;
    let submitReason = null;

    const manager = new AnswerTurnManager(
      {
        timeLimitSec: 1, // 1 second expiry for fast unit test
        initialSilenceTimeoutMs: 5000,
      },
      {
        onAutoSubmit: (answer, reason) => {
          submittedAnswer = answer;
          submitReason = reason;
        },
      }
    );

    manager.startQuestionTurn('q-timer-submit');
    manager.onTranscriptUpdate('PostgreSQL uses Multi-Version Concurrency Control.');

    // Wait for 1-second countdown tick to expire
    await new Promise((r) => setTimeout(r, 1150));

    assert.strictEqual(submitReason, 'time_expired');
    assert.strictEqual(submittedAnswer, 'PostgreSQL uses Multi-Version Concurrency Control.');
    assert.strictEqual(manager.getIsTurnActive(), false);
  });

  test('per-question countdown expiry marks unanswered if candidate provided no answer', async () => {
    let unansweredReason = null;

    const manager = new AnswerTurnManager(
      {
        timeLimitSec: 1,
        initialSilenceTimeoutMs: 5000,
      },
      {
        onMarkUnanswered: (reason) => {
          unansweredReason = reason;
        },
      }
    );

    manager.startQuestionTurn('q-timer-unanswered');

    // Wait for 1-second countdown tick to expire without any transcript
    await new Promise((r) => setTimeout(r, 1150));

    assert.strictEqual(unansweredReason, 'time_expired');
    assert.strictEqual(manager.getIsTurnActive(), false);
  });

  test('stopTurn cleans up all timers and prevents subsequent callbacks', async () => {
    let anyCallbackCalled = false;

    const manager = new AnswerTurnManager(
      {
        timeLimitSec: 1,
        initialSilenceTimeoutMs: 25,
        silenceGracePeriodMs: 25,
      },
      {
        onCountdownTick: () => {
          // Handled during start
        },
        onSilencePrompt: () => {
          anyCallbackCalled = true;
        },
        onMidAnswerHint: () => {
          anyCallbackCalled = true;
        },
        onAutoSubmit: () => {
          anyCallbackCalled = true;
        },
        onMarkUnanswered: () => {
          anyCallbackCalled = true;
        },
      }
    );

    manager.startQuestionTurn('q-cleanup');
    manager.stopTurn();

    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(anyCallbackCalled, false);
  });
});

