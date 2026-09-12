import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.schemas.interview import InterviewCreate


def create_interview(db: Session, interview_in: InterviewCreate) -> Interview:
    candidate = db.execute(
        select(Candidate).where(Candidate.id == interview_in.candidate_id)
    ).scalar_one_or_none()
    if not candidate:
        raise KeyError("Candidate not found")

    interview = Interview(
        candidate_id=interview_in.candidate_id,
        role=interview_in.role,
        difficulty=interview_in.difficulty,
        interview_type=interview_in.interview_type,
        status="created",
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


def get_interview_by_id(db: Session, interview_id: uuid.UUID) -> Optional[Interview]:
    return db.execute(
        select(Interview).where(Interview.id == interview_id)
    ).scalar_one_or_none()
