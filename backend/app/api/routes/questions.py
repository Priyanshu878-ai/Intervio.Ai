import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate
from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.db.session import get_db
from app.schemas.question import QuestionCreate, QuestionResponse
from app.services import interview_service, question_service

router = APIRouter(prefix="/interviews", tags=["Questions"])


def _verify_interview_ownership(
    db: Session, interview_id: uuid.UUID, candidate_id: uuid.UUID
) -> Interview:
    interview = interview_service.get_interview_by_id(db, interview_id)
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found"
        )
    if interview.candidate_id != candidate_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: you do not have permission to access this interview",
        )
    return interview


@router.post(
    "/{interview_id}/questions",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Custom Question",
    description="Manually adds a specific question to an interview session.",
)
def create_question(
    interview_id: uuid.UUID,
    question_in: QuestionCreate,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    interview = _verify_interview_ownership(db, interview_id, current_candidate.id)
    if interview.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add questions to a completed interview",
        )
    try:
        return question_service.create_question(db, interview_id, question_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.get(
    "/{interview_id}/questions",
    response_model=List[QuestionResponse],
    summary="List Interview Questions",
    description="Retrieves all questions generated or assigned to an interview in sequence.",
)
def get_questions(
    interview_id: uuid.UUID,
    current_candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    _verify_interview_ownership(db, interview_id, current_candidate.id)
    try:
        return question_service.get_questions_by_interview_id(db, interview_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
