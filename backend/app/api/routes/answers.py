import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.answer import AnswerCreate, AnswerResponse
from app.services import answer_service

router = APIRouter(prefix="/questions", tags=["Answers"])


@router.post("/{question_id}/answer", response_model=AnswerResponse, status_code=status.HTTP_201_CREATED)
def create_answer(question_id: uuid.UUID, answer_in: AnswerCreate, db: Session = Depends(get_db)):
    try:
        return answer_service.create_answer(db, question_id, answer_in)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/{question_id}/answer", response_model=AnswerResponse)
def get_answer(question_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        answer = answer_service.get_answer_by_question_id(db, question_id)
        if not answer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found for this question")
        return answer
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).strip("'"))
