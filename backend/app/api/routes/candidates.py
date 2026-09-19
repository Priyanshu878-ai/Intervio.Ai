import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from typing import List
from app.api.deps import get_current_candidate
from app.db.models.candidate import Candidate
from app.db.session import get_db
from app.schemas.candidate import (
    CandidateCreate,
    CandidateProfileUpdate,
    CandidateResponse,
)
from app.schemas.intelligence import CandidateIntelligenceResponse
from app.schemas.interview import InterviewHistoryItem
from app.services import candidate_service, interview_service
from app.services.candidate_intelligence import candidate_intelligence_service

router = APIRouter(prefix="/candidates", tags=["Candidates"])


@router.post(
    "",
    response_model=CandidateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Candidate",
    description="Registers a new candidate with unique email and name.",
)
def create_candidate(candidate_in: CandidateCreate, db: Session = Depends(get_db)):
    try:
        return candidate_service.create_candidate(db, candidate_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get(
    "/me",
    response_model=CandidateResponse,
    summary="Get Current Candidate Profile",
    description="Retrieves the authenticated candidate's full profile.",
)
def get_my_profile(
    current_candidate: Candidate = Depends(get_current_candidate),
):
    return current_candidate


@router.patch(
    "/me",
    response_model=CandidateResponse,
    summary="Update Current Candidate Profile",
    description="Updates editable profile attributes (role, experience, skills, preferred interview type).",
)
def update_my_profile(
    profile_in: CandidateProfileUpdate,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    return candidate_service.update_candidate_profile(
        db=db, candidate=current_candidate, profile_in=profile_in
    )


@router.get(
    "/me/history",
    response_model=List[InterviewHistoryItem],
    summary="Get Candidate Interview History",
    description="Retrieves the history of all interviews completed or attempted by the authenticated candidate.",
)
def get_my_interview_history(
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    return interview_service.get_candidate_interview_history(
        db=db, candidate_id=current_candidate.id
    )


@router.get(
    "/me/intelligence",
    response_model=CandidateIntelligenceResponse,
    summary="Get Candidate Intelligence and Progress Tracking",
    description="Returns deterministic multi-interview analytics, trend history, strengths, weak areas, and practice suggestions.",
)
def get_my_intelligence(
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    return candidate_intelligence_service.get_candidate_intelligence(
        db=db, candidate_id=current_candidate.id
    )


@router.get(
    "/{candidate_id}",
    response_model=CandidateResponse,
    summary="Get Candidate by ID",
    description="Retrieves a candidate profile by their UUID.",
)
def get_candidate(
    candidate_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    if candidate_id != current_candidate.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: access to other candidate profiles is denied",
        )
    return current_candidate
