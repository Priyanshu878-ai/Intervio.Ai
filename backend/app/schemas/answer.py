import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AnswerCreate(BaseModel):
    answer_text: Optional[str] = Field(None, max_length=10000)
    audio_path: Optional[str] = Field(None, max_length=512)
    video_path: Optional[str] = Field(None, max_length=512)
    duration_seconds: Optional[float] = Field(None, ge=0.0, le=7200.0)


class AnswerResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    answer_text: Optional[str] = None
    audio_path: Optional[str] = None
    video_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
