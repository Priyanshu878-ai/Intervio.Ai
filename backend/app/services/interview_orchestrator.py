"""
Interview Session Orchestrator for Intervio.Ai.
Coordinates session lifecycle (start, session status, answer submission,
adaptive next-question selection, and completion detection) across
Question Generator, Adaptive Interview Engine, and Multimodal Fusion.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.answer import Answer
from app.db.models.candidate import Candidate
from app.db.models.evaluation import Evaluation
from app.db.models.interview import Interview
from app.db.models.question import Question
from app.services.adaptive_interview import get_next_question_strategy
from app.services.answer_service import analyze_multimodal_answer


INTERVIEW_DIFFICULTY_LIMITS: Dict[str, Dict[str, int]] = {
    "easy": {"min_questions": 5, "max_questions": 8},
    "medium": {"min_questions": 6, "max_questions": 10},
    "hard": {"min_questions": 7, "max_questions": 12},
}


class InterviewOrchestrator:
    """
    Orchestrates candidate interview sessions, combining question flow,
    multimodal response analysis, and adaptive difficulty adjustments.
    """

    @staticmethod
    def _get_interview(db: Session, interview_id: uuid.UUID) -> Interview:
        interview = db.execute(
            select(Interview).where(Interview.id == interview_id)
        ).scalar_one_or_none()
        if not interview:
            raise KeyError("Interview not found")
        return interview

    @staticmethod
    def _get_candidate(db: Session, candidate_id: uuid.UUID) -> Candidate:
        candidate = db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        ).scalar_one_or_none()
        if not candidate:
            raise KeyError("Candidate not found for this interview")
        return candidate

    @staticmethod
    def _get_questions(db: Session, interview_id: uuid.UUID) -> List[Question]:
        return list(
            db.execute(
                select(Question)
                .where(Question.interview_id == interview_id)
                .order_by(Question.sequence_number)
            )
            .scalars()
            .all()
        )

    @staticmethod
    def evaluate_interview_completion(
        interview: Interview,
        answered_count: int,
        evaluations: List[Evaluation],
        questions: List[Question],
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Calibrates assessment evidence and determines if interview should complete.
        Considers:
        - Minimum questions reached (never ends early before min_questions)
        - Maximum questions limit (always stops at max_questions)
        - Recent performance & score consistency (low variance / decisive level)
        - Technical coverage (sufficient technical questions answered)
        - Difficulty progression stability
        """
        diff_key = (interview.difficulty or "medium").lower().strip()
        limits = INTERVIEW_DIFFICULTY_LIMITS.get(diff_key, {"min_questions": 6, "max_questions": 10})
        min_q = limits["min_questions"]
        max_q = limits["max_questions"]

        # 1. Absolute upper bound: Always stop at max_questions
        if answered_count >= max_q:
            return True, {
                "reason": f"Maximum question limit reached for {diff_key} assessment ({answered_count}/{max_q}).",
                "decision": "stop_max_reached",
                "answered_count": answered_count,
                "evidence_score": 1.0,
            }

        # 2. Minimum questions threshold: Must not complete before min_questions
        if answered_count < min_q:
            return False, {
                "reason": f"Minimum questions threshold not met ({answered_count}/{min_q}). Continuing assessment.",
                "decision": "continue_min_not_reached",
                "answered_count": answered_count,
                "evidence_score": round(answered_count / min_q, 2),
            }

        # 3. Between min_questions and max_questions:
        # Multi-factor assessment evidence calibration
        scores = [e.overall_score for e in evaluations if e.overall_score is not None]
        recent_scores = scores[-3:] if len(scores) >= 3 else scores

        if len(recent_scores) >= 2:
            mean_recent = sum(recent_scores) / len(recent_scores)
            variance = sum((s - mean_recent) ** 2 for s in recent_scores) / len(recent_scores)
            std_dev = variance ** 0.5
        else:
            mean_recent = scores[-1] if scores else 50.0
            std_dev = 20.0

        # Confidence conditions:
        is_decisively_strong = mean_recent >= 75.0 and all(s >= 65.0 for s in recent_scores)
        is_decisively_weak = mean_recent <= 35.0 and all(s <= 45.0 for s in recent_scores)
        is_highly_consistent = std_dev <= 10.0 and len(recent_scores) >= 3

        # Technical coverage:
        tech_count = sum(
            1 for q in questions if q.answer is not None and (q.question_type or "").lower() == "technical"
        )
        coverage_sufficient = tech_count >= 3

        # Stability of progression:
        stability_met = is_decisively_strong or is_decisively_weak or (is_highly_consistent and coverage_sufficient)

        evidence_score = 0.0
        if coverage_sufficient:
            evidence_score += 0.35
        if is_decisively_strong or is_decisively_weak or is_highly_consistent:
            evidence_score += 0.40
        if std_dev <= 12.0:
            evidence_score += 0.25

        if stability_met and evidence_score >= 0.75:
            return True, {
                "reason": f"Sufficient assessment evidence established ({answered_count} questions, consistency std_dev={std_dev:.1f}, mean={mean_recent:.1f}).",
                "decision": "early_completion_evidence_sufficient",
                "answered_count": answered_count,
                "evidence_score": round(evidence_score, 2),
            }

        return False, {
            "reason": f"Gathering additional evidence to calibrate candidate performance (current evidence={evidence_score:.2f}, std_dev={std_dev:.1f}).",
            "decision": "continue_gathering_evidence",
            "answered_count": answered_count,
            "evidence_score": round(evidence_score, 2),
        }

    def start_interview(self, db: Session, interview_id: uuid.UUID) -> Dict[str, Any]:
        """
        Validates interview & candidate existence, transitions status to 'in_progress',
        records start timestamp, and returns the first unanswered question.
        Ensures at least the initial question exists.
        """
        interview = self._get_interview(db, interview_id)
        if interview.status == "completed":
            raise ValueError("Interview is already completed and cannot be restarted.")
        self._get_candidate(db, interview.candidate_id)

        now_utc = datetime.now(timezone.utc)
        if interview.status == "created":
            interview.status = "in_progress"
            interview.started_at = now_utc
            db.commit()
            db.refresh(interview)
        elif not interview.started_at:
            interview.started_at = now_utc
            db.commit()
            db.refresh(interview)

        # Ensure initial question exists
        questions = self._get_questions(db, interview_id)
        if not questions:
            from app.services.question_service import generate_and_save_questions
            generate_and_save_questions(db, interview_id, number_of_questions=1)

        return self.get_session_state(db, interview_id)

    def get_session_state(self, db: Session, interview_id: uuid.UUID) -> Dict[str, Any]:
        """
        Derives current interview session state: answered questions,
        remaining questions, active question, and completion status.
        """
        interview = self._get_interview(db, interview_id)
        questions = self._get_questions(db, interview_id)

        answered_questions = [q for q in questions if q.answer is not None]
        answered_count = len(answered_questions)
        unanswered = [q for q in questions if q.answer is None]

        diff_key = (interview.difficulty or "medium").lower().strip()
        limits = INTERVIEW_DIFFICULTY_LIMITS.get(diff_key, {"min_questions": 6, "max_questions": 10})
        max_q = limits["max_questions"]

        is_completed = interview.status == "completed"

        if is_completed:
            total_questions = answered_count
            remaining_questions = 0
            current_question = None
        else:
            total_questions = max(len(questions), max_q)
            remaining_questions = max(0, total_questions - answered_count)
            current_question = unanswered[0] if unanswered else None

            # If session is in_progress but no unanswered question exists, generate next adaptively
            if not current_question and interview.status == "in_progress" and answered_count < max_q:
                from app.services.question_service import generate_adaptive_next_question
                adaptive_res = generate_adaptive_next_question(
                    db=db,
                    interview_id=interview_id,
                    performance_level="average",
                )
                current_question = adaptive_res["question"]
                questions = self._get_questions(db, interview_id)
                total_questions = max(len(questions), max_q)
                remaining_questions = max(0, total_questions - answered_count)

        return {
            "interview_id": interview.id,
            "status": interview.status,
            "role": interview.role,
            "difficulty": interview.difficulty,
            "interview_type": interview.interview_type,
            "started_at": interview.started_at,
            "completed_at": interview.completed_at,
            "total_questions": total_questions,
            "answered_questions": answered_count,
            "remaining_questions": remaining_questions,
            "current_question": current_question,
            "is_completed": is_completed,
        }

    def submit_answer(
        self,
        db: Session,
        interview_id: uuid.UUID,
        question_id: uuid.UUID,
        answer_text: Optional[str] = None,
        audio_file_path: Optional[str] = None,
        video_file_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submits candidate answer for a specific question, executes multimodal analysis,
        upserts Answer and Evaluation records, determines adaptive difficulty, evaluates
        AI-controlled interview length/evidence, and returns the next adaptive question or completes.
        """
        interview = self._get_interview(db, interview_id)
        if interview.status == "completed":
            raise ValueError("Interview is already completed. No further answers can be submitted.")

        # Validate question
        question = db.execute(
            select(Question).where(Question.id == question_id)
        ).scalar_one_or_none()
        if not question:
            raise KeyError("Question not found")
        if question.interview_id != interview_id:
            raise ValueError("Question does not belong to this interview")

        # Mark interview in_progress if still created
        if interview.status == "created":
            interview.status = "in_progress"
            interview.started_at = datetime.now(timezone.utc)
            db.commit()

        # Run multimodal analysis
        analysis_res = analyze_multimodal_answer(
            db=db,
            question_id=question_id,
            answer_text=answer_text,
            audio_file_path=audio_file_path,
            video_file_path=video_file_path,
        )

        # Upsert Answer record (ensures exactly 1 Answer per question)
        effective_text = (answer_text or "").strip()
        if not effective_text and analysis_res.get("audio_analysis"):
            effective_text = analysis_res["audio_analysis"].get("transcript", "").strip()

        duration_sec = None
        if analysis_res.get("audio_analysis"):
            duration_sec = analysis_res["audio_analysis"].get("audio_duration_seconds")
        elif analysis_res.get("vision_analysis"):
            duration_sec = analysis_res["vision_analysis"].get("video_duration_seconds")

        existing_answer = db.execute(
            select(Answer).where(Answer.question_id == question_id)
        ).scalar_one_or_none()

        if existing_answer is None:
            existing_answer = Answer(
                question_id=question_id,
                answer_text=effective_text or None,
                audio_path=audio_file_path,
                video_path=video_file_path,
                duration_seconds=duration_sec,
            )
            db.add(existing_answer)
        else:
            existing_answer.answer_text = effective_text or existing_answer.answer_text
            if duration_sec is not None:
                existing_answer.duration_seconds = duration_sec

        db.commit()
        db.refresh(existing_answer)

        # Upsert Evaluation record (ensures exactly 1 Evaluation per Answer)
        text_an = analysis_res.get("text_analysis") or {}
        existing_eval = db.execute(
            select(Evaluation).where(Evaluation.answer_id == existing_answer.id)
        ).scalar_one_or_none()

        if existing_eval is None:
            existing_eval = Evaluation(
                answer_id=existing_answer.id,
                relevance_score=text_an.get("relevance_score"),
                technical_score=text_an.get("technical_score"),
                completeness_score=text_an.get("completeness_score"),
                communication_score=text_an.get("communication_score"),
                overall_score=analysis_res["final_score"],
                feedback=analysis_res["feedback"],
            )
            db.add(existing_eval)
        else:
            existing_eval.relevance_score = text_an.get("relevance_score", existing_eval.relevance_score)
            existing_eval.technical_score = text_an.get("technical_score", existing_eval.technical_score)
            existing_eval.completeness_score = text_an.get("completeness_score", existing_eval.completeness_score)
            existing_eval.communication_score = text_an.get("communication_score", existing_eval.communication_score)
            existing_eval.overall_score = analysis_res["final_score"]
            existing_eval.feedback = analysis_res["feedback"]

        db.commit()
        db.refresh(existing_eval)

        # Calculate Adaptive Next-Question Strategy
        perf_level = analysis_res["performance_level"]
        strategy = get_next_question_strategy(
            current_difficulty=interview.difficulty,
            performance_level=perf_level,
            current_question_type=question.question_type,
            role=interview.role,
        )

        # Retrieve all questions and answered evaluations
        all_questions = self._get_questions(db, interview_id)
        answered_questions = [q for q in all_questions if q.answer is not None]
        answered_count = len(answered_questions)
        evaluations = [
            q.answer.evaluation
            for q in answered_questions
            if q.answer and q.answer.evaluation
        ]

        # Evaluate AI-controlled interview length & evidence
        is_completed, evidence_info = self.evaluate_interview_completion(
            interview=interview,
            answered_count=answered_count,
            evaluations=evaluations,
            questions=all_questions,
        )

        if is_completed:
            next_q = None
            interview.status = "completed"
            if not interview.completed_at:
                interview.completed_at = datetime.now(timezone.utc)
            # Remove any un-answered extra questions that were pre-generated
            for q in all_questions:
                if q.answer is None and q.id != question_id:
                    db.delete(q)
            db.commit()
            db.refresh(interview)
        else:
            # Check if an unanswered question already exists in the pre-generated batch
            unanswered_remaining = [
                q for q in all_questions if q.id != question_id and q.answer is None
            ]
            if unanswered_remaining:
                next_q = unanswered_remaining[0]
            else:
                # Adaptively generate the next question matching candidate performance
                from app.services.question_service import generate_adaptive_next_question
                adaptive_res = generate_adaptive_next_question(
                    db=db,
                    interview_id=interview_id,
                    performance_level=perf_level,
                )
                next_q = adaptive_res["question"]

        return {
            "interview_id": interview.id,
            "question_id": question_id,
            "analysis": analysis_res,
            "next_question": next_q,
            "adaptive_strategy": strategy,
            "is_completed": is_completed,
            "session_status": interview.status,
            "evidence_status": evidence_info,
        }


interview_orchestrator = InterviewOrchestrator()
