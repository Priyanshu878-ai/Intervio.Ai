import uuid
from typing import Any, Dict, List
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.interview import Interview
from app.db.models.question import Question
from app.schemas.question import QuestionCreate
from app.services.adaptive_interview import get_next_question_strategy
from app.services.question_generator import question_generator


def create_question(db: Session, interview_id: uuid.UUID, question_in: QuestionCreate) -> Question:
    interview = db.execute(
        select(Interview).where(Interview.id == interview_id)
    ).scalar_one_or_none()
    if not interview:
        raise KeyError("Interview not found")

    question = Question(
        interview_id=interview_id,
        question_text=question_in.question_text,
        question_type=question_in.question_type,
        sequence_number=question_in.sequence_number,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_questions_by_interview_id(db: Session, interview_id: uuid.UUID) -> List[Question]:
    interview = db.execute(
        select(Interview).where(Interview.id == interview_id)
    ).scalar_one_or_none()
    if not interview:
        raise KeyError("Interview not found")

    return list(
        db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.sequence_number)
        )
        .scalars()
        .all()
    )


def generate_and_save_questions(
    db: Session,
    interview_id: uuid.UUID,
    number_of_questions: int,
) -> List[Question]:
    interview = db.execute(
        select(Interview).where(Interview.id == interview_id)
    ).scalar_one_or_none()
    if not interview:
        raise KeyError("Interview not found")

    existing_questions = list(
        db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.sequence_number)
        )
        .scalars()
        .all()
    )

    existing_texts = {q.question_text for q in existing_questions}
    current_count = len(existing_questions)

    generated = question_generator.generate(
        role=interview.role,
        difficulty=interview.difficulty,
        interview_type=interview.interview_type,
        count=number_of_questions,
        exclude_texts=existing_texts,
    )

    if not generated:
        raise ValueError("No new unique questions could be generated for this interview")

    new_questions: List[Question] = []
    for idx, item in enumerate(generated, start=current_count + 1):
        q = Question(
            interview_id=interview_id,
            question_text=item["text"],
            question_type=item["type"],
            sequence_number=idx,
        )
        db.add(q)
        new_questions.append(q)

    db.commit()
    for q in new_questions:
        db.refresh(q)

    return new_questions


def generate_adaptive_next_question(
    db: Session,
    interview_id: uuid.UUID,
    performance_level: str,
) -> Dict[str, Any]:
    interview = db.execute(
        select(Interview).where(Interview.id == interview_id)
    ).scalar_one_or_none()
    if not interview:
        raise KeyError("Interview not found")

    existing_questions = list(
        db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.sequence_number)
        )
        .scalars()
        .all()
    )

    existing_texts = {q.question_text for q in existing_questions}
    current_count = len(existing_questions)

    # Determine current baseline difficulty
    if existing_questions:
        last_question = existing_questions[-1]
        current_difficulty = interview.difficulty
        current_type = last_question.question_type
    else:
        current_difficulty = interview.difficulty
        current_type = interview.interview_type

    # Calculate adaptive strategy
    strategy = get_next_question_strategy(
        current_difficulty=current_difficulty,
        performance_level=performance_level,
        current_question_type=current_type,
        role=interview.role,
    )

    # Generate single next question matching adaptive strategy
    generated = question_generator.generate(
        role=interview.role,
        difficulty=strategy["next_difficulty"],
        interview_type=strategy["preferred_question_type"],
        count=1,
        exclude_texts=existing_texts,
    )

    # Fallback to easy/medium/hard if target difficulty pool exhausted
    if not generated:
        for alt_diff in ["medium", "easy", "hard"]:
            generated = question_generator.generate(
                role=interview.role,
                difficulty=alt_diff,
                interview_type="mixed",
                count=1,
                exclude_texts=existing_texts,
            )
            if generated:
                break

    if not generated:
        raise ValueError("No suitable adaptive question available in the pool")

    item = generated[0]
    next_question = Question(
        interview_id=interview_id,
        question_text=item["text"],
        question_type=item["type"],
        sequence_number=current_count + 1,
    )
    db.add(next_question)
    db.commit()
    db.refresh(next_question)

    return {
        "question": next_question,
        "strategy": strategy,
    }
