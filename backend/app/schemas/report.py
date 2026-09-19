import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class CandidateReportSummary(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class InterviewReportSummary(BaseModel):
    interview_id: uuid.UUID
    candidate: CandidateReportSummary
    role: str
    difficulty: str
    interview_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_questions: int
    answered_questions: int
    unanswered_questions: int
    completion_percentage: float
    is_completed: bool

    model_config = ConfigDict(from_attributes=True)


class OverallPerformance(BaseModel):
    overall_score: Optional[float] = None
    performance_level: Optional[str] = None
    strong_answers_count: int
    average_answers_count: int
    weak_answers_count: int

    model_config = ConfigDict(from_attributes=True)


class TechnicalPerformance(BaseModel):
    aggregate_technical_score: Optional[float] = None
    performance_level: Optional[str] = None
    technical_strengths: List[str]
    technical_improvement_areas: List[str]

    model_config = ConfigDict(from_attributes=True)


class TextPerformance(BaseModel):
    relevance_score: Optional[float] = None
    completeness_score: Optional[float] = None
    communication_score: Optional[float] = None
    semantic_performance: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AudioPerformance(BaseModel):
    aggregate_audio_communication_score: Optional[float] = None
    audio_answered_count: int
    speaking_rate_wpm: Optional[float] = None
    pause_filler_statistics: Optional[Dict[str, Any]] = None
    note: str

    model_config = ConfigDict(from_attributes=True)


class VisionPerformance(BaseModel):
    aggregate_visual_communication_score: Optional[float] = None
    video_answered_count: int
    visual_engagement_statistics: Optional[Dict[str, Any]] = None
    note: str
    disclaimer: str

    model_config = ConfigDict(from_attributes=True)


class QuestionAnalytics(BaseModel):
    question_id: uuid.UUID
    sequence_number: int
    question_text: str
    question_type: str
    difficulty: Optional[str] = None
    answer_status: str  # "answered" or "unanswered"
    score: Optional[float] = None
    performance_level: Optional[str] = None
    evaluation_feedback: Optional[str] = None
    relevance_score: Optional[float] = None
    technical_score: Optional[float] = None
    completeness_score: Optional[float] = None
    communication_score: Optional[float] = None
    has_audio: bool = False
    has_video: bool = False
    duration_seconds: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class PerformanceTransition(BaseModel):
    from_question_seq: int
    to_question_seq: int
    from_performance: str
    to_performance: str
    transition_type: str  # "improved", "declined", "maintained"

    model_config = ConfigDict(from_attributes=True)


class ProgressionAnalytics(BaseModel):
    score_progression: List[Optional[float]]
    difficulty_progression: List[str]
    performance_transitions: List[PerformanceTransition]
    adaptive_strategy_summary: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


class FinalInterviewReport(BaseModel):
    interview_summary: InterviewReportSummary
    overall_performance: OverallPerformance
    technical_performance: TechnicalPerformance
    text_performance: TextPerformance
    audio_performance: AudioPerformance
    vision_performance: VisionPerformance
    question_analytics: List[QuestionAnalytics]
    progression: ProgressionAnalytics
    strengths: List[str]
    improvement_areas: List[str]
    final_summary: str

    model_config = ConfigDict(from_attributes=True)
