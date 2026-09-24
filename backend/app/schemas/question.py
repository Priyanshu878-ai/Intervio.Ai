import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class QuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=5, max_length=2000)
    question_type: str = Field(..., min_length=2, max_length=50)
    sequence_number: int = Field(..., ge=1, le=100)


class QuestionResponse(BaseModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    question_text: str
    question_type: str
    sequence_number: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


from typing import Optional

class GenerateQuestionsRequest(BaseModel):
    number_of_questions: Optional[int] = Field(None, ge=1, le=20, description="Optional number of questions to generate (1-20). If omitted, AI calibrates question count automatically.")


class NextQuestionRequest(BaseModel):
    performance_level: str = Field(
        ...,
        pattern=r"^(weak|average|strong)$",
        description="Candidate performance level (weak, average, strong)",
    )


class AdaptiveStrategyResponse(BaseModel):
    performance_level: str
    next_difficulty: str
    preferred_question_type: str
    reason: str
    strategy: str


class NextQuestionResponse(BaseModel):
    question: QuestionResponse
    strategy: AdaptiveStrategyResponse
