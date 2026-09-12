import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AnswerCreate(BaseModel):
    answer_text: Optional[str] = None
    audio_path: Optional[str] = None
    video_path: Optional[str] = None
    duration_seconds: Optional[float] = None


class AnswerResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    answer_text: Optional[str] = None
    audio_path: Optional[str] = None
    video_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
