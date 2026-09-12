import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.question import QuestionCreate, QuestionResponse
from app.services import question_service

router = APIRouter(prefix="/interviews", tags=["Questions"])


@router.post("/{interview_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(interview_id: uuid.UUID, question_in: QuestionCreate, db: Session = Depends(get_db)):
    try:
        return question_service.create_question(db, interview_id, question_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))


@router.get("/{interview_id}/questions", response_model=List[QuestionResponse])
def get_questions(interview_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        return question_service.get_questions_by_interview_id(db, interview_id)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
