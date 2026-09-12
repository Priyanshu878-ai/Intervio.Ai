import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class QuestionCreate(BaseModel):
    question_text: str
    question_type: str
    sequence_number: int


class QuestionResponse(BaseModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    question_text: str
    question_type: str
    sequence_number: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GenerateQuestionsRequest(BaseModel):
    number_of_questions: int = Field(5, ge=1, le=20, description="Number of questions to generate (1-20)")


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
