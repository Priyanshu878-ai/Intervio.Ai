import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InterviewCreate(BaseModel):
    candidate_id: uuid.UUID
    role: str = Field(..., min_length=2, max_length=100)
    difficulty: str = Field(..., pattern=r"^(easy|medium|hard)$")
    interview_type: str = Field(..., min_length=2, max_length=50)


class InterviewResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    role: str
    difficulty: str
    interview_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InterviewHistoryItem(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    role: str
    difficulty: str
    interview_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    overall_score: Optional[float] = None
    performance_level: Optional[str] = None
    total_questions: int = 0
    answered_questions: int = 0

    model_config = ConfigDict(from_attributes=True)

