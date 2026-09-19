import uuid
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.answer import Answer
from app.db.models.evaluation import Evaluation
from app.db.models.interview import Interview
from app.db.models.question import Question
from app.schemas.answer import AnswerCreate
from app.services.answer_analyzer import answer_analyzer


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


def analyze_and_save_answer_evaluation(
    db: Session,
    question_id: uuid.UUID,
    answer_text: str,
) -> Dict[str, Any]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    # Fetch corresponding interview to obtain target candidate role
    interview = db.execute(
        select(Interview).where(Interview.id == question.interview_id)
    ).scalar_one_or_none()
    role = interview.role if interview else "default"

    # Upsert Answer for this question (ensures exactly 1 Answer per Question)
    answer = db.execute(
        select(Answer).where(Answer.question_id == question_id)
    ).scalar_one_or_none()

    if answer is None:
        answer = Answer(
            question_id=question_id,
            answer_text=answer_text,
        )
        db.add(answer)
    else:
        answer.answer_text = answer_text

    db.commit()
    db.refresh(answer)

    # Run deterministic Answer Analyzer
    analysis_res = answer_analyzer.analyze(
        question_text=question.question_text,
        answer_text=answer_text,
        role=role,
    )

    # Upsert Evaluation for this Answer (ensures exactly 1 Evaluation per Answer)
    evaluation = db.execute(
        select(Evaluation).where(Evaluation.answer_id == answer.id)
    ).scalar_one_or_none()

    if evaluation is None:
        evaluation = Evaluation(
            answer_id=answer.id,
            relevance_score=analysis_res["relevance_score"],
            technical_score=analysis_res["technical_score"],
            completeness_score=analysis_res["completeness_score"],
            communication_score=analysis_res["communication_score"],
            overall_score=analysis_res["overall_score"],
            feedback=analysis_res["feedback"],
        )
        db.add(evaluation)
    else:
        evaluation.relevance_score = analysis_res["relevance_score"]
        evaluation.technical_score = analysis_res["technical_score"]
        evaluation.completeness_score = analysis_res["completeness_score"]
        evaluation.communication_score = analysis_res["communication_score"]
        evaluation.overall_score = analysis_res["overall_score"]
        evaluation.feedback = analysis_res["feedback"]

    db.commit()
    db.refresh(evaluation)

    return {
        "evaluation": evaluation,
        "performance_level": analysis_res["performance_level"],
    }


def analyze_audio_file(
    db: Session,
    question_id: uuid.UUID,
    audio_file_path: str,
) -> Dict[str, Any]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    from app.services.audio_analyzer import audio_analyzer

    return audio_analyzer.analyze_audio(audio_file_path)


def analyze_video_file(
    db: Session,
    question_id: uuid.UUID,
    video_file_path: str,
) -> Dict[str, Any]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    from app.services.vision_analyzer import vision_analyzer

    return vision_analyzer.analyze_video(video_file_path)


def analyze_multimodal_answer(
    db: Session,
    question_id: uuid.UUID,
    answer_text: Optional[str] = None,
    audio_file_path: Optional[str] = None,
    video_file_path: Optional[str] = None,
) -> Dict[str, Any]:
    question = db.execute(
        select(Question).where(Question.id == question_id)
    ).scalar_one_or_none()
    if not question:
        raise KeyError("Question not found")

    interview = db.execute(
        select(Interview).where(Interview.id == question.interview_id)
    ).scalar_one_or_none()
    role = interview.role if interview else "default"

    # 1. Process Audio if available
    audio_analysis = None
    if audio_file_path:
        from app.services.audio_analyzer import audio_analyzer

        audio_analysis = audio_analyzer.analyze_audio(audio_file_path)

    # 2. Process Video if available
    vision_analysis = None
    if video_file_path:
        from app.services.vision_analyzer import vision_analyzer

        vision_analysis = vision_analyzer.analyze_video(video_file_path)

    # 3. Determine effective text (use transcribed speech if answer_text is not supplied)
    effective_text = (answer_text or "").strip()
    if not effective_text and audio_analysis and audio_analysis.get("transcript"):
        effective_text = audio_analysis["transcript"].strip()

    # 4. Process Text analysis if text is available
    text_analysis = None
    if effective_text:
        text_analysis = answer_analyzer.analyze(
            question_text=question.question_text,
            answer_text=effective_text,
            role=role,
        )

    # 5. Multimodal Fusion
    from app.services.multimodal_fusion import multimodal_fusion_engine

    return multimodal_fusion_engine.fuse(
        text_analysis=text_analysis,
        audio_analysis=audio_analysis,
        vision_analysis=vision_analysis,
    )



