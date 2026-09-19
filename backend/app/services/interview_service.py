import uuid
from typing import Any, Dict, List, Optional
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


def get_candidate_interview_history(db: Session, candidate_id: uuid.UUID) -> List[Dict[str, Any]]:
    interviews = list(
        db.execute(
            select(Interview)
            .where(Interview.candidate_id == candidate_id)
            .order_by(Interview.created_at.desc())
        ).scalars().all()
    )

    history = []
    for interview in interviews:
        total_q = len(interview.questions)
        scores = []
        answered_q = 0

        for q in interview.questions:
            if q.answer:
                answered_q += 1
                if q.answer.evaluation and q.answer.evaluation.overall_score is not None:
                    scores.append(q.answer.evaluation.overall_score)

        overall_score = None
        perf_level = None
        if scores:
            overall_score = round(sum(scores) / len(scores), 1)
            if overall_score >= 75.0:
                perf_level = "strong"
            elif overall_score >= 50.0:
                perf_level = "average"
            else:
                perf_level = "weak"

        history.append({
            "id": interview.id,
            "candidate_id": interview.candidate_id,
            "role": interview.role,
            "difficulty": interview.difficulty,
            "interview_type": interview.interview_type,
            "status": interview.status,
            "started_at": interview.started_at,
            "completed_at": interview.completed_at,
            "created_at": interview.created_at,
            "overall_score": overall_score,
            "performance_level": perf_level,
            "total_questions": total_q,
            "answered_questions": answered_q,
        })

    return history
