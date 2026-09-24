from typing import Optional
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$", max_length=255)
    password: Optional[str] = Field(None, min_length=6, max_length=128)


class CandidateResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[str] = None
    preferred_interview_type: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    target_role: Optional[str] = Field(None, max_length=100)
    experience_level: Optional[str] = Field(None, max_length=50)
    skills: Optional[str] = Field(None, max_length=500)
    preferred_interview_type: Optional[str] = Field(None, max_length=50)

