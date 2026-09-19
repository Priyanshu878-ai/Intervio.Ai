/**
 * Browser-native utility to convert an audio Blob (WebM/Opus) into standard 16-bit PCM WAV
 * for seamless compatibility with audio processing pipelines.
 */
export async function audioBlobToWav(audioBlob: Blob): Promise<File> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return new File([audioBlob], 'speech_recording.webm', { type: audioBlob.type || 'audio/webm' });
    }

    const audioContext = new AudioContextClass();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    const sampleRate = audioBuffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }
    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF chunk
    out.setUint32(pos, 0x46464952, false); pos += 4; // 'RIFF'
    setUint32(length - 8);
    out.setUint32(pos, 0x45564157, false); pos += 4; // 'WAVE'

    // fmt sub-chunk
    out.setUint32(pos, 0x20746d66, false); pos += 4; // 'fmt '
    setUint32(16); // subchunk1size (16 for PCM)
    setUint16(1);  // AudioFormat (1 = PCM)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample

    // data sub-chunk
    out.setUint32(pos, 0x61746164, false); pos += 4; // 'data'
    setUint32(length - pos - 4);

    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (offset < audioBuffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    await audioContext.close();
    return new File([out.buffer], 'speech_recording.wav', { type: 'audio/wav' });
  } catch {
    // Fallback directly to webm File if decodeAudioData is unsupported or fails
    return new File([audioBlob], 'speech_recording.webm', { type: audioBlob.type || 'audio/webm' });
  }
}
