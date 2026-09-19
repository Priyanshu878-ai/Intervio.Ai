"""
Multimodal Fusion Engine for Intervio.Ai.
Combines Text/Semantic, Audio, and Vision evaluations into a unified
multimodal performance evaluation with dynamic weight normalization,
cross-modal strengths, improvement areas, and performance categorization.
"""

from typing import Any, Dict, List, Optional, Tuple

# Default modality weights
DEFAULT_WEIGHTS = {
    "text": 0.50,
    "audio": 0.25,
    "vision": 0.25,
}

# Performance level thresholds
WEAK_THRESHOLD = 50.0
STRONG_THRESHOLD = 75.0


class MultimodalFusionEngine:
    """
    Fuses Text, Audio, and Vision assessment dimensions into a single
    holistic interview performance report.
    """

    def __init__(self, base_weights: Optional[Dict[str, float]] = None):
        self.base_weights = base_weights or dict(DEFAULT_WEIGHTS)

    def normalize_weights(
        self,
        has_text: bool,
        has_audio: bool,
        has_vision: bool,
    ) -> Dict[str, float]:
        """
        Dynamically normalizes modality weights based on available inputs.
        """
        active_weights = {}
        if has_text:
            active_weights["text"] = self.base_weights.get("text", 0.50)
        if has_audio:
            active_weights["audio"] = self.base_weights.get("audio", 0.25)
        if has_vision:
            active_weights["vision"] = self.base_weights.get("vision", 0.25)

        total_weight = sum(active_weights.values())
        if total_weight == 0:
            return {"text": 1.0}

        return {
            k: round(v / total_weight, 4) for k, v in active_weights.items()
        }

    def fuse(
        self,
        text_analysis: Optional[Dict[str, Any]] = None,
        audio_analysis: Optional[Dict[str, Any]] = None,
        vision_analysis: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes multimodal fusion over available modality analyses.
        """
        has_text = text_analysis is not None and "overall_score" in text_analysis
        has_audio = (
            audio_analysis is not None
            and "audio_communication_score" in audio_analysis
            and audio_analysis.get("audio_duration_seconds", 0) > 0
        )
        has_vision = (
            vision_analysis is not None
            and "visual_communication_score" in vision_analysis
            and vision_analysis.get("processed_frames", 0) > 0
        )

        weights = self.normalize_weights(has_text, has_audio, has_vision)

        text_score = (
            float(text_analysis["overall_score"]) if has_text else None
        )
        audio_score = (
            float(audio_analysis["audio_communication_score"]) if has_audio else None
        )
        vision_score = (
            float(vision_analysis["visual_communication_score"]) if has_vision else None
        )

        # Weighted score fusion
        weighted_sum = 0.0
        if has_text and text_score is not None:
            weighted_sum += weights["text"] * text_score
        if has_audio and audio_score is not None:
            weighted_sum += weights["audio"] * audio_score
        if has_vision and vision_score is not None:
            weighted_sum += weights["vision"] * vision_score

        final_score = round(weighted_sum, 1)

        # Performance level categorization
        if final_score >= STRONG_THRESHOLD:
            performance_level = "strong"
        elif final_score >= WEAK_THRESHOLD:
            performance_level = "average"
        else:
            performance_level = "weak"

        # Generate Strengths & Improvement Areas
        strengths, improvements = self._extract_insights(
            text_analysis=text_analysis if has_text else None,
            audio_analysis=audio_analysis if has_audio else None,
            vision_analysis=vision_analysis if has_vision else None,
        )

        # Generate concise overall summary
        overall_feedback = self._generate_feedback(
            performance_level=performance_level,
            final_score=final_score,
            text_analysis=text_analysis if has_text else None,
            audio_analysis=audio_analysis if has_audio else None,
            vision_analysis=vision_analysis if has_vision else None,
        )

        return {
            "text_score": text_score,
            "audio_score": audio_score,
            "vision_score": vision_score,
            "final_score": final_score,
            "performance_level": performance_level,
            "modality_weights_used": weights,
            "feedback": overall_feedback,
            "strengths": strengths,
            "improvement_areas": improvements,
            "text_analysis": text_analysis,
            "audio_analysis": audio_analysis,
            "vision_analysis": vision_analysis,
        }

    def _extract_insights(
        self,
        text_analysis: Optional[Dict[str, Any]],
        audio_analysis: Optional[Dict[str, Any]],
        vision_analysis: Optional[Dict[str, Any]],
    ) -> Tuple[List[str], List[str]]:
        strengths: List[str] = []
        improvements: List[str] = []

        # Text insights
        if text_analysis:
            if text_analysis.get("relevance_score", 0) >= 75.0:
                strengths.append("Strong semantic alignment with question concepts.")
            elif text_analysis.get("relevance_score", 0) < 50.0:
                improvements.append("Answer lacks clear relevance to the core technical question.")

            if text_analysis.get("technical_score", 0) >= 70.0:
                strengths.append("Demonstrates solid domain terminology and technical depth.")
            elif text_analysis.get("technical_score", 0) < 50.0:
                improvements.append("Incorporate more domain-specific technical details.")

            if text_analysis.get("completeness_score", 0) >= 75.0:
                strengths.append("Comprehensive and well-structured written explanation.")
            elif text_analysis.get("completeness_score", 0) < 50.0:
                improvements.append("Provide a more detailed and complete answer structure.")

        # Audio insights
        if audio_analysis:
            wpm = audio_analysis.get("speaking_rate_wpm", 0)
            fillers = audio_analysis.get("total_filler_count", 0)
            silence = audio_analysis.get("silence_ratio", 0)

            if 110.0 <= wpm <= 165.0:
                strengths.append(f"Optimal verbal delivery pace ({wpm:.0f} WPM).")
            elif wpm > 180.0:
                improvements.append(f"Fast speaking pace ({wpm:.0f} WPM); consider moderating speed.")
            elif wpm < 90.0 and wpm > 0:
                improvements.append(f"Slow speaking pace ({wpm:.0f} WPM); aim for a brisker delivery.")

            if fillers == 0:
                strengths.append("Clean articulation with zero filler words.")
            elif fillers >= 3:
                improvements.append(f"Reduce filler word frequency ({fillers} detected).")

            if silence > 0.4:
                improvements.append("Reduce frequent or prolonged pauses during speech.")

        # Vision insights
        if vision_analysis:
            presence = vision_analysis.get("face_presence_score", 0)
            gaze = vision_analysis.get("gaze_engagement_score", 0)
            stability = vision_analysis.get("landmark_stability_score", 0)

            if presence >= 80.0:
                strengths.append("Consistent visual framing and face presence.")
            elif presence < 50.0:
                improvements.append("Maintain steady on-camera visibility.")

            if gaze >= 75.0:
                strengths.append("Good direct camera engagement.")
            elif gaze < 60.0:
                improvements.append("Improve camera framing and direct eye engagement.")

            if stability >= 80.0:
                strengths.append("Controlled head posture and minimal camera jitter.")

        # Fallback defaults if empty
        if not strengths:
            strengths.append("Basic requirements met across evaluated modalities.")
        if not improvements:
            improvements.append("Continue maintaining balanced technical depth and confident delivery.")

        return strengths, improvements

    def _generate_feedback(
        self,
        performance_level: str,
        final_score: float,
        text_analysis: Optional[Dict[str, Any]],
        audio_analysis: Optional[Dict[str, Any]],
        vision_analysis: Optional[Dict[str, Any]],
    ) -> str:
        parts: List[str] = []

        if performance_level == "strong":
            parts.append(f"Strong overall interview performance (Score: {final_score}).")
        elif performance_level == "average":
            parts.append(f"Satisfactory interview performance with areas for refinement (Score: {final_score}).")
        else:
            parts.append(f"Performance fell below expectations across evaluated dimensions (Score: {final_score}).")

        if text_analysis:
            parts.append(text_analysis.get("feedback", ""))
        if audio_analysis and audio_analysis.get("audio_duration_seconds", 0) > 0:
            parts.append(f"Verbal: {audio_analysis.get('feedback', '')}")
        if vision_analysis and vision_analysis.get("processed_frames", 0) > 0:
            parts.append(f"Visual: {vision_analysis.get('feedback', '')}")

        return " ".join([p.strip() for p in parts if p.strip()])


multimodal_fusion_engine = MultimodalFusionEngine()
