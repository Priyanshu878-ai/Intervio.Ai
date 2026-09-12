import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate


def create_candidate(db: Session, candidate_in: CandidateCreate) -> Candidate:
    existing = db.execute(
        select(Candidate).where(Candidate.email == candidate_in.email)
    ).scalar_one_or_none()
    if existing:
        raise ValueError("Candidate with this email already exists")

    candidate = Candidate(
        name=candidate_in.name,
        email=candidate_in.email,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def get_candidate_by_id(db: Session, candidate_id: uuid.UUID) -> Optional[Candidate]:
    return db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    ).scalar_one_or_none()
