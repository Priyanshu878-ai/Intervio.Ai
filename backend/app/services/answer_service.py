import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.answer import Answer
from app.db.models.question import Question
from app.schemas.answer import AnswerCreate


def create_answer(db: Session, question_id: uuid.UUID, answer_in: AnswerCreate) -> Answer:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    existing_answer = db.execute(
        select(Answer).where(Answer.question_id == question_id)
    ).scalar_one_or_none()
    if existing_answer:
        raise ValueError("Answer already submitted for this question")

    answer = Answer(
        question_id=question_id,
        answer_text=answer_in.answer_text,
        audio_path=answer_in.audio_path,
        video_path=answer_in.video_path,
        duration_seconds=answer_in.duration_seconds,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


def get_answer_by_question_id(db: Session, question_id: uuid.UUID) -> Optional[Answer]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    return db.execute(
        select(Answer).where(Answer.question_id == question_id)
    ).scalar_one_or_none()
