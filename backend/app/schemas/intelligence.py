from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict


class PerformanceTrendPoint(BaseModel):
    interview_id: uuid.UUID
    created_at: datetime
    role: str
    difficulty: str
    interview_type: str
    overall_score: Optional[float] = None
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    relevance_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class CommunicationTrendPoint(BaseModel):
    interview_id: uuid.UUID
    created_at: datetime
    role: str
    communication_score: Optional[float] = None
    completeness_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class RoleStat(BaseModel):
    role: str
    count: int
    average_score: Optional[float] = None


class InterviewTypeStat(BaseModel):
    interview_type: str
    count: int
    average_score: Optional[float] = None


class CandidateIntelligenceResponse(BaseModel):
    has_data: bool
    total_interviews: int
    completed_interviews: int
    overall_average_score: Optional[float] = None
    recent_score: Optional[float] = None
    previous_average_score: Optional[float] = None
    score_delta: Optional[float] = None
    technical_average: Optional[float] = None
    communication_average: Optional[float] = None
    relevance_average: Optional[float] = None
    performance_trend: List[PerformanceTrendPoint] = []
    communication_trend: List[CommunicationTrendPoint] = []
    technical_strengths: List[str] = []
    weak_areas: List[str] = []
    roles_attempted: List[RoleStat] = []
    interview_types_attempted: List[InterviewTypeStat] = []
    recent_improvements: List[str] = []
    suggested_practice_areas: List[str] = []
    overall_progress_summary: str
