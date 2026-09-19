import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict

from app.schemas.evaluation import MultimodalAnalysisResponse
from app.schemas.question import QuestionResponse


class InterviewSessionResponse(BaseModel):
    interview_id: uuid.UUID
    status: str
    role: str
    difficulty: str
    interview_type: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_questions: int
    answered_questions: int
    remaining_questions: int
    current_question: Optional[QuestionResponse] = None
    is_completed: bool

    model_config = ConfigDict(from_attributes=True)


class SubmitAnswerResponse(BaseModel):
    interview_id: uuid.UUID
    question_id: uuid.UUID
    analysis: MultimodalAnalysisResponse
    next_question: Optional[QuestionResponse] = None
    adaptive_strategy: Optional[dict[str, Any]] = None
    is_completed: bool
    session_status: str

    model_config = ConfigDict(from_attributes=True)
