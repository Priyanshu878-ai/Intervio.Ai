import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTrackState,
  validateLiveTracks,
  verifyCameraFrames,
  verifyMicrophoneSignal,
  parseMediaDeviceError,
} from '../src/utils/deviceVerification.ts';

// Helper mock classes
class MockMediaStreamTrack {
  constructor(kind, options = {}) {
    this.kind = kind;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.readyState = options.readyState || 'live';
    this.muted = options.muted || false;
    this._settings = options.settings || { width: 1280, height: 720 };
  }

  getSettings() {
    return this._settings;
  }

  stop() {
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  constructor(tracks = []) {
    this._tracks = tracks;
  }

  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }

  getTracks() {
    return [...this._tracks];
  }
}

class MockAnalyserNode {
  constructor(audioPattern = 'signal') {
    this.audioPattern = audioPattern; // 'signal' | 'silence'
    this.frequencyBinCount = 128;
    this.fftSize = 256;
    this.smoothingTimeConstant = 0.2;
  }

  connect() {}
  disconnect() {}

  getByteTimeDomainData(array) {
    if (this.audioPattern === 'signal') {
      // Return wave fluctuating around 128
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.round(15 * Math.sin(i));
      }
    } else {
      // Digital silence: flat 128
      for (let i = 0; i < array.length; i++) {
        array[i] = 128;
      }
    }
  }

  getByteFrequencyData(array) {
    if (this.audioPattern === 'signal') {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.max(0, 40 - i);
      }
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = 0;
      }
    }
  }
}

class MockAudioContext {
  constructor(audioPattern = 'signal') {
    this.state = 'running';
    this.audioPattern = audioPattern;
  }

  createMediaStreamSource() {
    return {
      connect: () => {},
      disconnect: () => {},
    };
  }

  createAnalyser() {
    return new MockAnalyserNode(this.audioPattern);
  }

  async resume() {
    this.state = 'running';
  }

  async close() {
    this.state = 'closed';
  }
}

describe('Device Verification — Track State Validation', () => {
  test('fails when track is null or undefined', () => {
    const res = validateTrackState(null, 'video');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason?.includes('No video track found'));
  });

  test('fails when track kind does not match expected kind', () => {
    const track = new MockMediaStreamTrack('audio');
    const res = validateTrackState(track, 'video');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason?.includes('Expected track of kind video, received audio'));
  });

  test('fails when track is ended or disconnected', () => {
    const track = new MockMediaStreamTrack('video', { readyState: 'ended' });
    const res = validateTrackState(track, 'video');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason?.includes('Camera track has ended'));
  });

  test('fails when track is disabled', () => {
    const track = new MockMediaStreamTrack('audio', { enabled: false });
    const res = validateTrackState(track, 'audio');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason?.includes('Microphone track is disabled'));
  });

  test('fails when track is muted by hardware or system', () => {
    const track = new MockMediaStreamTrack('audio', { muted: true });
    const res = validateTrackState(track, 'audio');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.reason?.includes('Microphone track is muted'));
  });

  test('passes when track is live, enabled, and unmuted', () => {
    const track = new MockMediaStreamTrack('video', { readyState: 'live', enabled: true, muted: false });
    const res = validateTrackState(track, 'video');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.reason, undefined);
  });
});

describe('Device Verification — validateLiveTracks Gate', () => {
  test('blocks startup if stream is null (missing devices)', () => {
    const res = validateLiveTracks(null);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.cameraOk, false);
    assert.strictEqual(res.micOk, false);
    assert.ok(res.reason?.includes('Media stream is unavailable'));
  });

  test('blocks startup if video track is missing but mic is live', () => {
    const micTrack = new MockMediaStreamTrack('audio');
    const stream = new MockMediaStream([micTrack]);
    const res = validateLiveTracks(stream);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.cameraOk, false);
    assert.strictEqual(res.micOk, true);
    assert.ok(res.reason?.includes('No video track found'));
  });

  test('blocks startup if audio track is missing but video is live', () => {
    const videoTrack = new MockMediaStreamTrack('video');
    const stream = new MockMediaStream([videoTrack]);
    const res = validateLiveTracks(stream);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.cameraOk, true);
    assert.strictEqual(res.micOk, false);
    assert.ok(res.reason?.includes('No audio track found'));
  });

  test('blocks startup if microphone was disconnected or ended after check', () => {
    const videoTrack = new MockMediaStreamTrack('video');
    const micTrack = new MockMediaStreamTrack('audio', { readyState: 'ended' });
    const stream = new MockMediaStream([videoTrack, micTrack]);
    const res = validateLiveTracks(stream);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.cameraOk, true);
    assert.strictEqual(res.micOk, false);
    assert.ok(res.reason?.includes('Microphone track has ended'));
  });

  test('allows startup when both video and audio tracks are verified live and enabled', () => {
    const videoTrack = new MockMediaStreamTrack('video');
    const micTrack = new MockMediaStreamTrack('audio');
    const stream = new MockMediaStream([videoTrack, micTrack]);
    const res = validateLiveTracks(stream);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.cameraOk, true);
    assert.strictEqual(res.micOk, true);
  });
});

describe('Device Verification — verifyCameraFrames', () => {
  test('fails if camera track is disabled', async () => {
    const videoTrack = new MockMediaStreamTrack('video', { enabled: false });
    const stream = new MockMediaStream([videoTrack]);
    const res = await verifyCameraFrames(null, stream);
    assert.strictEqual(res.passed, false);
    assert.ok(res.message.includes('disabled'));
  });

  test('fails if camera track has ended', async () => {
    const videoTrack = new MockMediaStreamTrack('video', { readyState: 'ended' });
    const stream = new MockMediaStream([videoTrack]);
    const res = await verifyCameraFrames(null, stream);
    assert.strictEqual(res.passed, false);
    assert.ok(res.message.includes('ended'));
  });

  test('passes when video track is active with valid resolution settings', async () => {
    const videoTrack = new MockMediaStreamTrack('video', { settings: { width: 1280, height: 720 } });
    const stream = new MockMediaStream([videoTrack]);
    const res = await verifyCameraFrames(null, stream);
    assert.strictEqual(res.passed, true);
    assert.ok(res.message.includes('Camera feed verified'));
  });

  test('fails when video element produces 0x0 frame dimensions after timeout', async () => {
    const videoTrack = new MockMediaStreamTrack('video');
    const stream = new MockMediaStream([videoTrack]);

    const mockVideoEl = {
      videoWidth: 0,
      videoHeight: 0,
      paused: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      play: async () => {},
    };

    const res = await verifyCameraFrames(mockVideoEl, stream, 100);
    assert.strictEqual(res.passed, false);
    assert.ok(res.message.includes('No camera frames received'));
  });

  test('passes when video element produces active dimensions > 0', async () => {
    const videoTrack = new MockMediaStreamTrack('video');
    const stream = new MockMediaStream([videoTrack]);

    const mockVideoEl = {
      videoWidth: 1280,
      videoHeight: 720,
      paused: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      play: async () => {},
    };

    const res = await verifyCameraFrames(mockVideoEl, stream, 100);
    assert.strictEqual(res.passed, true);
    assert.ok(res.message.includes('rendering live frames'));
  });
});

describe('Device Verification — verifyMicrophoneSignal', () => {
  test('fails if audio track is muted at hardware level', async () => {
    const audioTrack = new MockMediaStreamTrack('audio', { muted: true });
    const stream = new MockMediaStream([audioTrack]);
    const res = await verifyMicrophoneSignal(stream);
    assert.strictEqual(res.passed, false);
    assert.ok(res.message.includes('muted'));
  });

  test('fails when microphone input is completely silent (no audio signal)', async () => {
    const audioTrack = new MockMediaStreamTrack('audio');
    const stream = new MockMediaStream([audioTrack]);

    const res = await verifyMicrophoneSignal(stream, {
      sampleDurationMs: 100,
      audioContextFactory: () => new MockAudioContext('silence'),
    });

    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.peakLevel, 0);
    assert.ok(res.message.includes('silent input'));
  });

  test('passes when microphone audio signal is detected', async () => {
    const audioTrack = new MockMediaStreamTrack('audio');
    const stream = new MockMediaStream([audioTrack]);

    const res = await verifyMicrophoneSignal(stream, {
      sampleDurationMs: 100,
      audioContextFactory: () => new MockAudioContext('signal'),
    });

    assert.strictEqual(res.passed, true);
    assert.ok(res.peakLevel > 0);
    assert.ok(res.message.includes('audio signal detected successfully'));
    // Crucial requirement: Must never claim speech recognition is verified
    assert.strictEqual(res.message.includes('speech recognition'), false);
    assert.strictEqual(res.message.includes('transcription'), false);
  });
});

describe('Device Verification — Error Parsing & Retry Handling', () => {
  test('maps NotAllowedError to actionable permission blocked instructions', () => {
    const err = { name: 'NotAllowedError', message: 'Permission denied' };
    const parsed = parseMediaDeviceError(err);
    assert.strictEqual(parsed.cameraMessage, 'Permission denied');
    assert.strictEqual(parsed.micMessage, 'Permission denied');
    assert.ok(parsed.userAdvice.includes('permissions were blocked'));
    assert.ok(parsed.userAdvice.includes('Retry Check'));
  });

  test('maps NotFoundError to missing hardware device instructions', () => {
    const err = { name: 'NotFoundError', message: 'Requested device not found' };
    const parsed = parseMediaDeviceError(err);
    assert.strictEqual(parsed.cameraMessage, 'Device not found');
    assert.strictEqual(parsed.micMessage, 'Device not found');
    assert.ok(parsed.userAdvice.includes('No camera or microphone found'));
  });

  test('maps NotReadableError to device busy/in-use instructions', () => {
    const err = { name: 'NotReadableError', message: 'Device in use' };
    const parsed = parseMediaDeviceError(err);
    assert.strictEqual(parsed.cameraMessage, 'Device in use');
    assert.strictEqual(parsed.micMessage, 'Device in use');
    assert.ok(parsed.userAdvice.includes('already in use by another application'));
  });

  test('simulates retry cleanup: stops old tracks before requesting new stream', () => {
    const track1 = new MockMediaStreamTrack('video');
    const track2 = new MockMediaStreamTrack('audio');
    const oldStream = new MockMediaStream([track1, track2]);

    // Simulate cleanup function run on Retry Check
    const cleanupStream = (stream) => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };

    cleanupStream(oldStream);

    assert.strictEqual(track1.readyState, 'ended');
    assert.strictEqual(track2.readyState, 'ended');
  });
});

describe('Device Verification — Start Gate Enforcing Simulation', () => {
  function simulateStartInterviewGate({ cameraStatus, micStatus, stream }) {
    const canStart = cameraStatus === 'passed' && micStatus === 'passed';
    if (!canStart) {
      return { started: false, reason: 'Device checks have not passed.' };
    }

    const revalidation = validateLiveTracks(stream);
    if (!revalidation.isValid) {
      return { started: false, reason: revalidation.reason };
    }

    return { started: true };
  }

  test('blocks interview start when camera is needs_attention', () => {
    const stream = new MockMediaStream([new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio')]);
    const res = simulateStartInterviewGate({ cameraStatus: 'needs_attention', micStatus: 'passed', stream });
    assert.strictEqual(res.started, false);
    assert.strictEqual(res.reason, 'Device checks have not passed.');
  });

  test('blocks interview start when mic is checking or not_checked', () => {
    const stream = new MockMediaStream([new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio')]);
    const res = simulateStartInterviewGate({ cameraStatus: 'passed', micStatus: 'checking', stream });
    assert.strictEqual(res.started, false);
  });

  test('blocks interview start on immediate revalidation failure even if status was passed', () => {
    // Microphone was unplugged or ended right before click
    const micTrack = new MockMediaStreamTrack('audio', { readyState: 'ended' });
    const stream = new MockMediaStream([new MockMediaStreamTrack('video'), micTrack]);

    const res = simulateStartInterviewGate({ cameraStatus: 'passed', micStatus: 'passed', stream });
    assert.strictEqual(res.started, false);
    assert.ok(res.reason?.includes('Microphone track has ended'));
  });

  test('allows interview start only when checks passed and revalidation succeeds', () => {
    const stream = new MockMediaStream([new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio')]);
    const res = simulateStartInterviewGate({ cameraStatus: 'passed', micStatus: 'passed', stream });
    assert.strictEqual(res.started, true);
  });
});

describe('Device Verification — Out-of-Order Verification Generation Counter Simulation', () => {
  // Simulates the exact state machine and generation counter in RealtimeInterviewRoom.tsx
  class RealtimeRoomVerificationSimulator {
    constructor() {
      this.verificationSeq = 0;
      this.activeStream = null;
      this.cameraCheck = { status: 'not_checked', message: '' };
      this.micCheck = { status: 'not_checked', message: '' };
      this.deviceError = null;
      this.isCheckingDevices = false;
      this.discardedRuns = [];
      this.appliedRuns = [];
    }

    get canStartInterview() {
      return this.cameraCheck.status === 'passed' && this.micCheck.status === 'passed';
    }

    async runVerifyDevices({
      durationMs,
      stream,
      cameraPass = true,
      micPass = true,
      throwError = null,
    }) {
      const seq = ++this.verificationSeq;

      this.isCheckingDevices = true;
      this.deviceError = null;
      this.cameraCheck = { status: 'checking', message: 'Checking camera...' };
      this.micCheck = { status: 'checking', message: 'Testing microphone...' };

      // Clean up previous active stream before re-checking
      if (this.activeStream) {
        this.activeStream.getTracks().forEach((t) => t.stop());
        this.activeStream = null;
      }

      // Simulate async getUserMedia & hardware frame/audio testing
      await new Promise((resolve) => setTimeout(resolve, durationMs));

      // 1. Check if superseded while waiting
      if (seq !== this.verificationSeq) {
        if (stream && stream !== this.activeStream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        this.discardedRuns.push({ seq, reason: 'superseded_by_newer_generation' });
        return { seq, applied: false, reason: 'superseded' };
      }

      // 2. Handle simulated error
      if (throwError) {
        this.cameraCheck = { status: 'needs_attention', message: 'Error' };
        this.micCheck = { status: 'needs_attention', message: 'Error' };
        this.deviceError = throwError.message || 'Verification error';
        this.isCheckingDevices = false;
        this.appliedRuns.push({ seq, error: true });
        return { seq, applied: true, error: true };
      }

      // 3. Commit successful or failed device state
      this.activeStream = stream;
      this.cameraCheck = {
        status: cameraPass ? 'passed' : 'needs_attention',
        message: cameraPass ? 'Camera active' : 'Camera failed',
      };
      this.micCheck = {
        status: micPass ? 'passed' : 'needs_attention',
        message: micPass ? 'Mic active' : 'Mic failed',
      };
      if (!cameraPass || !micPass) {
        this.deviceError = 'Device test failed. Please retry.';
      } else {
        this.deviceError = null;
      }
      this.isCheckingDevices = false;
      this.appliedRuns.push({ seq, error: false });

      return { seq, applied: true, error: false };
    }
  }

  test('two verification runs completing out of order: ignores stale failure from Run 1 and preserves Run 2 success', async () => {
    const simulator = new RealtimeRoomVerificationSimulator();

    const trackCam1 = new MockMediaStreamTrack('video');
    const trackMic1 = new MockMediaStreamTrack('audio');
    const stream1 = new MockMediaStream([trackCam1, trackMic1]);

    const trackCam2 = new MockMediaStreamTrack('video');
    const trackMic2 = new MockMediaStreamTrack('audio');
    const stream2 = new MockMediaStream([trackCam2, trackMic2]);

    // Run 1 starts first (seq 1), but takes 50ms and fails (cameraPass = false)
    const run1Promise = simulator.runVerifyDevices({
      durationMs: 50,
      stream: stream1,
      cameraPass: false,
      micPass: false,
    });

    // Run 2 starts 10ms later (seq 2, e.g. user clicked Retry Check), completes in 15ms (finishes at 25ms total) and passes
    await new Promise((resolve) => setTimeout(resolve, 10));
    const run2Promise = simulator.runVerifyDevices({
      durationMs: 15,
      stream: stream2,
      cameraPass: true,
      micPass: true,
    });

    // Wait for both to complete
    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);

    // Verification results
    assert.strictEqual(res2.applied, true);
    assert.strictEqual(res2.seq, 2);

    assert.strictEqual(res1.applied, false);
    assert.strictEqual(res1.reason, 'superseded');

    // Run 2 state MUST be preserved in the simulator
    assert.strictEqual(simulator.cameraCheck.status, 'passed');
    assert.strictEqual(simulator.micCheck.status, 'passed');
    assert.strictEqual(simulator.deviceError, null);
    assert.strictEqual(simulator.isCheckingDevices, false);
    assert.strictEqual(simulator.canStartInterview, true);

    // Active stream is stream2 and its tracks remain live
    assert.strictEqual(simulator.activeStream, stream2);
    assert.strictEqual(trackCam2.readyState, 'live');
    assert.strictEqual(trackMic2.readyState, 'live');

    // Temporary stream1 tracks from stale Run 1 were stopped safely
    assert.strictEqual(trackCam1.readyState, 'ended');
    assert.strictEqual(trackMic1.readyState, 'ended');

    // History logs
    assert.deepStrictEqual(simulator.appliedRuns, [{ seq: 2, error: false }]);
    assert.strictEqual(simulator.discardedRuns.length, 1);
    assert.strictEqual(simulator.discardedRuns[0].seq, 1);
  });

  test('stale getUserMedia error from earlier run does not overwrite later passed run', async () => {
    const simulator = new RealtimeRoomVerificationSimulator();

    const stream2 = new MockMediaStream([
      new MockMediaStreamTrack('video'),
      new MockMediaStreamTrack('audio'),
    ]);

    // Run 1 will reject after 40ms with a permission error
    const run1Promise = simulator.runVerifyDevices({
      durationMs: 40,
      stream: null,
      throwError: new Error('Permission denied'),
    });

    // Run 2 starts 10ms later, completes in 15ms and passes
    await new Promise((resolve) => setTimeout(resolve, 10));
    const run2Promise = simulator.runVerifyDevices({
      durationMs: 15,
      stream: stream2,
      cameraPass: true,
      micPass: true,
    });

    const [res1, res2] = await Promise.all([run1Promise, run2Promise]);

    assert.strictEqual(res2.applied, true);
    assert.strictEqual(res1.applied, false);

    // Final state remains passed and deviceError is null
    assert.strictEqual(simulator.cameraCheck.status, 'passed');
    assert.strictEqual(simulator.micCheck.status, 'passed');
    assert.strictEqual(simulator.deviceError, null);
    assert.strictEqual(simulator.canStartInterview, true);
  });
});
