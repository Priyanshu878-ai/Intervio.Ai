import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CandidateCreate(BaseModel):
    name: str
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")


class CandidateResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
