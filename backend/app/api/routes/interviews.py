import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.interview import InterviewCreate, InterviewResponse
from app.schemas.question import (
    GenerateQuestionsRequest,
    NextQuestionRequest,
    NextQuestionResponse,
    QuestionResponse,
)
from app.services import interview_service, question_service

router = APIRouter(prefix="/interviews", tags=["Interviews"])


@router.post("", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
def create_interview(interview_in: InterviewCreate, db: Session = Depends(get_db)):
    try:
        return interview_service.create_interview(db, interview_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview(interview_id: uuid.UUID, db: Session = Depends(get_db)):
    interview = interview_service.get_interview_by_id(db, interview_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
    return interview


@router.post(
    "/{interview_id}/generate-questions",
    response_model=List[QuestionResponse],
    status_code=status.HTTP_201_CREATED,
)
def generate_questions(
    interview_id: uuid.UUID,
    req: GenerateQuestionsRequest,
    db: Session = Depends(get_db),
):
    try:
        return question_service.generate_and_save_questions(
            db=db,
            interview_id=interview_id,
            number_of_questions=req.number_of_questions,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post(
    "/{interview_id}/next-question",
    response_model=NextQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def get_next_adaptive_question(
    interview_id: uuid.UUID,
    req: NextQuestionRequest,
    db: Session = Depends(get_db),
):
    try:
        return question_service.generate_adaptive_next_question(
            db=db,
            interview_id=interview_id,
            performance_level=req.performance_level,
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
