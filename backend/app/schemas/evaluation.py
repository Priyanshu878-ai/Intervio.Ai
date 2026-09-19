import uuid
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict



class AnalyzeAnswerRequest(BaseModel):
    answer_text: str


class EvaluationResponse(BaseModel):
    id: uuid.UUID
    answer_id: uuid.UUID
    relevance_score: Optional[float] = None
    technical_score: Optional[float] = None
    completeness_score: Optional[float] = None
    communication_score: Optional[float] = None
    overall_score: Optional[float] = None
    feedback: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnswerAnalysisResponse(BaseModel):
    evaluation: EvaluationResponse
    performance_level: str


class AudioAnalysisResponse(BaseModel):
    audio_duration_seconds: float
    transcript: str
    speech_duration_seconds: float
    pause_duration_seconds: float
    pause_count: int
    silence_ratio: float
    speaking_rate_wpm: float
    total_filler_count: int
    detected_fillers: dict[str, int]
    audio_communication_score: float
    feedback: str


class VisionAnalysisResponse(BaseModel):
    video_duration_seconds: float
    total_frames: int
    processed_frames: int
    face_detected_ratio: float
    average_faces_detected: float
    face_presence_score: float
    head_movement_score: float
    gaze_engagement_score: float
    landmark_stability_score: float
    visual_communication_score: float
    feedback: str


class MultimodalAnalysisResponse(BaseModel):
    text_score: Optional[float] = None
    audio_score: Optional[float] = None
    vision_score: Optional[float] = None
    final_score: float
    performance_level: str
    modality_weights_used: dict[str, float]
    feedback: str
    strengths: List[str]
    improvement_areas: List[str]
    text_analysis: Optional[dict[str, Any]] = None
    audio_analysis: Optional[dict[str, Any]] = None
    vision_analysis: Optional[dict[str, Any]] = None



