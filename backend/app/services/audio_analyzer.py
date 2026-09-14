"""
Audio Analysis Service for Intervio.Ai using faster-whisper and librosa/soundfile.
Analyzes audio files for duration, speech-to-text transcript, speaking rate (WPM),
pause/silence statistics, filler word frequencies, and audio communication scoring.
"""

import os
import re
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Default lightweight Whisper model size for local development
DEFAULT_WHISPER_MODEL_SIZE = "tiny"

# Default list of common spoken filler words/phrases
DEFAULT_FILLER_WORDS: List[str] = [
    "um",
    "uh",
    "like",
    "basically",
    "literally",
    "you know",
]


class AudioAnalyzer:
    """
    Singleton-style Audio Analyzer using faster-whisper for speech transcription
    and soundfile/librosa for audio duration and pause metrics computation.
    """

    def __init__(self, model_size: str = DEFAULT_WHISPER_MODEL_SIZE):
        self.model_size = model_size
        self._model = None
        self._load_attempted = False
        self.filler_words = list(DEFAULT_FILLER_WORDS)

    def _get_model(self):
        if self._model is None and not self._load_attempted:
            self._load_attempted = True
            try:
                from faster_whisper import WhisperModel

                logger.info(f"Loading faster-whisper model: {self.model_size}")
                # Load on CPU with int8 quantization for speed & memory efficiency
                self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                logger.info("faster-whisper model loaded successfully!")
            except Exception as e:
                logger.warning(
                    f"Failed to load faster-whisper model ({e}). Speech-to-Text transcription will be disabled."
                )
                self._model = None
        return self._model

    def _get_audio_duration(self, audio_path: str) -> Optional[float]:
        try:
            import soundfile as sf

            info = sf.info(audio_path)
            return float(info.duration)
        except Exception:
            try:
                import librosa

                duration = librosa.get_duration(path=audio_path)
                return float(duration)
            except Exception as e:
                logger.warning(f"Could not determine audio duration for {audio_path}: {e}")
                return None

    def _analyze_fillers(self, transcript: str) -> Tuple[int, Dict[str, int]]:
        lowered = transcript.lower()
        detected: Dict[str, int] = {}
        total = 0

        for filler in self.filler_words:
            pattern = r"\b" + re.escape(filler) + r"\b"
            matches = len(re.findall(pattern, lowered))
            if matches > 0:
                detected[filler] = matches
                total += matches

        return total, detected

    def _calculate_audio_score(
        self,
        speaking_rate_wpm: float,
        silence_ratio: float,
        total_filler_count: int,
        word_count: int,
        total_duration: float,
    ) -> Tuple[float, str]:
        score = 85.0
        feedback_items: List[str] = []

        # 1. Speaking rate (Ideal range: 110.0 - 165.0 WPM)
        if 110.0 <= speaking_rate_wpm <= 165.0:
            feedback_items.append("Optimal speaking pace.")
        elif speaking_rate_wpm < 90.0 and speaking_rate_wpm > 0:
            score -= min(25.0, (90.0 - speaking_rate_wpm) * 0.4)
            feedback_items.append("Speaking pace is slow.")
        elif speaking_rate_wpm > 180.0:
            score -= min(20.0, (speaking_rate_wpm - 180.0) * 0.3)
            feedback_items.append("Speaking pace is fast.")

        # 2. Silence ratio (Ideal < 0.25)
        if silence_ratio > 0.4:
            score -= min(25.0, (silence_ratio - 0.4) * 50.0)
            feedback_items.append("Frequent or lengthy pauses detected.")

        # 3. Filler word density (per 100 words)
        filler_density = (total_filler_count / max(1, word_count)) * 100.0
        if filler_density > 3.0:
            score -= min(25.0, (filler_density - 3.0) * 5.0)
            feedback_items.append(f"Noticeable filler word usage ({total_filler_count} fillers).")

        final_score = max(10.0, min(100.0, score))
        summary = (
            " ".join(feedback_items)
            if feedback_items
            else "Clear speech pacing and low filler usage."
        )
        return final_score, summary

    def analyze_audio(self, audio_path: str) -> Dict[str, Any]:
        """
        Main entry point to analyze an audio file. Safe against missing, corrupt,
        or empty audio files and audio without detectable speech.
        """
        if not os.path.exists(audio_path):
            return self._empty_result("Audio file not found")

        total_duration = self._get_audio_duration(audio_path)
        if total_duration is None or total_duration <= 0.1:
            return self._empty_result(
                "Invalid, corrupt, or empty audio file", duration=total_duration or 0.0
            )

        model = self._get_model()
        if model is None:
            return self._empty_result(
                "Speech-to-Text Whisper model unavailable", duration=total_duration
            )

        try:
            segments, info = model.transcribe(audio_path, beam_size=1, word_timestamps=True)
            segment_list = list(segments)
        except Exception as e:
            logger.error(f"Error transcribing audio file {audio_path}: {e}")
            return self._empty_result(
                f"Transcription error: {str(e)}", duration=total_duration
            )

        full_transcript_parts: List[str] = []
        speech_duration = 0.0
        word_count = 0

        last_end = 0.0
        pause_count = 0

        for seg in segment_list:
            text = seg.text.strip()
            if text:
                full_transcript_parts.append(text)
                seg_duration = max(0.0, seg.end - seg.start)
                speech_duration += seg_duration

                if seg.start - last_end > 0.5 and last_end > 0.0:
                    pause_count += 1
                last_end = seg.end

                if hasattr(seg, "words") and seg.words:
                    word_count += len(seg.words)
                else:
                    words_in_text = re.findall(r"\b[\w'-]+\b", text)
                    word_count += len(words_in_text)

        full_transcript = " ".join(full_transcript_parts).strip()

        # Handle case with no detectable speech
        if not full_transcript or speech_duration <= 0.0:
            return {
                "audio_duration_seconds": round(total_duration, 2),
                "transcript": "",
                "speech_duration_seconds": 0.0,
                "pause_duration_seconds": round(total_duration, 2),
                "pause_count": 1 if total_duration > 1.0 else 0,
                "silence_ratio": 1.0,
                "speaking_rate_wpm": 0.0,
                "total_filler_count": 0,
                "detected_fillers": {},
                "audio_communication_score": 20.0,
                "feedback": "No speech detected in audio recording.",
            }

        pause_duration = max(0.0, total_duration - speech_duration)
        silence_ratio = round(min(1.0, pause_duration / total_duration), 2)

        effective_duration_minutes = (
            speech_duration if speech_duration > 1.0 else total_duration
        ) / 60.0
        speaking_rate_wpm = (
            round(word_count / effective_duration_minutes, 1)
            if effective_duration_minutes > 0
            else 0.0
        )

        total_filler_count, detected_fillers = self._analyze_fillers(full_transcript)

        audio_score, audio_feedback = self._calculate_audio_score(
            speaking_rate_wpm=speaking_rate_wpm,
            silence_ratio=silence_ratio,
            total_filler_count=total_filler_count,
            word_count=word_count,
            total_duration=total_duration,
        )

        return {
            "audio_duration_seconds": round(total_duration, 2),
            "transcript": full_transcript,
            "speech_duration_seconds": round(speech_duration, 2),
            "pause_duration_seconds": round(pause_duration, 2),
            "pause_count": pause_count,
            "silence_ratio": silence_ratio,
            "speaking_rate_wpm": speaking_rate_wpm,
            "total_filler_count": total_filler_count,
            "detected_fillers": detected_fillers,
            "audio_communication_score": round(audio_score, 1),
            "feedback": audio_feedback,
        }

    def _empty_result(self, error_msg: str, duration: float = 0.0) -> Dict[str, Any]:
        return {
            "audio_duration_seconds": round(duration, 2),
            "transcript": "",
            "speech_duration_seconds": 0.0,
            "pause_duration_seconds": round(duration, 2),
            "pause_count": 0,
            "silence_ratio": 0.0 if duration == 0.0 else 1.0,
            "speaking_rate_wpm": 0.0,
            "total_filler_count": 0,
            "detected_fillers": {},
            "audio_communication_score": 0.0,
            "feedback": error_msg,
        }


audio_analyzer = AudioAnalyzer()
