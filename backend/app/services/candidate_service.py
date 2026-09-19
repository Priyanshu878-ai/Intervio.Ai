import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateProfileUpdate


def create_candidate(db: Session, candidate_in: CandidateCreate) -> Candidate:
    existing = db.execute(
        select(Candidate).where(Candidate.email == candidate_in.email)
    ).scalar_one_or_none()
    if existing:
        raise ValueError("Candidate with this email already exists")

    hashed_pw = hash_password(candidate_in.password) if candidate_in.password else None
    candidate = Candidate(
        name=candidate_in.name,
        email=candidate_in.email,
        hashed_password=hashed_pw,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def get_candidate_by_id(db: Session, candidate_id: uuid.UUID) -> Optional[Candidate]:
    return db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    ).scalar_one_or_none()


def update_candidate_profile(
    db: Session, candidate: Candidate, profile_in: CandidateProfileUpdate
) -> Candidate:
    if profile_in.name is not None:
        candidate.name = profile_in.name.strip()
    if profile_in.target_role is not None:
        candidate.target_role = profile_in.target_role.strip()
    if profile_in.experience_level is not None:
        candidate.experience_level = profile_in.experience_level.strip()
    if profile_in.skills is not None:
        candidate.skills = profile_in.skills.strip()
    if profile_in.preferred_interview_type is not None:
        candidate.preferred_interview_type = profile_in.preferred_interview_type.strip()

    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate
