"""
Interview Final Report & Analytics Engine for Intervio.Ai.
Aggregates complete interview performance from existing Answer and Evaluation data,
deriving overall, technical, text, audio, and visual analytics, progression curves,
strengths, improvement areas, and deterministic summaries.
"""

import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.db.models.question import Question

# Performance Thresholds
WEAK_THRESHOLD = 50.0
STRONG_THRESHOLD = 75.0


class InterviewReportService:
    """
    Generates comprehensive, deterministic performance reports for completed
    or in-progress interview sessions.
    """

    @staticmethod
    def _score_to_performance_level(score: Optional[float]) -> Optional[str]:
        if score is None:
            return None
        if score >= STRONG_THRESHOLD:
            return "strong"
        elif score >= WEAK_THRESHOLD:
            return "average"
        return "weak"

    def generate_report(self, db: Session, interview_id: uuid.UUID) -> Dict[str, Any]:
        interview = db.execute(
            select(Interview).where(Interview.id == interview_id)
        ).scalar_one_or_none()
        if not interview:
            raise KeyError("Interview not found")

        candidate = interview.candidate
        if not candidate:
            candidate = db.execute(
                select(Candidate).where(Candidate.id == interview.candidate_id)
            ).scalar_one_or_none()
        if not candidate:
            raise KeyError("Candidate not found for this interview")

        # Retrieve questions in sequential order
        questions = list(
            db.execute(
                select(Question)
                .where(Question.interview_id == interview_id)
                .order_by(Question.sequence_number)
            )
            .scalars()
            .all()
        )

        total_questions = len(questions)
        answered_questions = [q for q in questions if q.answer is not None]
        unanswered_questions = [q for q in questions if q.answer is None]

        total_answered = len(answered_questions)
        total_unanswered = len(unanswered_questions)
        completion_pct = (
            round((total_answered / total_questions) * 100.0, 1)
            if total_questions > 0
            else 0.0
        )
        is_completed = (
            (total_questions > 0 and total_unanswered == 0)
            or interview.status == "completed"
        )

        # Collect evaluations for answered questions
        evaluations = [
            q.answer.evaluation
            for q in answered_questions
            if q.answer and q.answer.evaluation is not None
        ]

        # 1. Overall Performance
        overall_scores = [
            e.overall_score for e in evaluations if e.overall_score is not None
        ]
        if overall_scores:
            avg_overall_score = round(sum(overall_scores) / len(overall_scores), 1)
            overall_perf_level = self._score_to_performance_level(avg_overall_score)
        else:
            avg_overall_score = None
            overall_perf_level = None

        strong_count = sum(1 for s in overall_scores if s >= STRONG_THRESHOLD)
        average_count = sum(
            1 for s in overall_scores if WEAK_THRESHOLD <= s < STRONG_THRESHOLD
        )
        weak_count = sum(1 for s in overall_scores if s < WEAK_THRESHOLD)

        # 2. Technical Performance
        tech_scores = [
            e.technical_score for e in evaluations if e.technical_score is not None
        ]
        if tech_scores:
            avg_tech_score = round(sum(tech_scores) / len(tech_scores), 1)
            tech_perf_level = self._score_to_performance_level(avg_tech_score)
        else:
            avg_tech_score = None
            tech_perf_level = None

        tech_strengths: List[str] = []
        tech_improvements: List[str] = []
        if avg_tech_score is not None:
            if avg_tech_score >= 75.0:
                tech_strengths.append(
                    "High technical proficiency with sound domain concept mastery."
                )
            elif avg_tech_score >= 50.0:
                tech_strengths.append(
                    "Satisfactory baseline understanding of target technical domain concepts."
                )

            if avg_tech_score < 50.0:
                tech_improvements.append(
                    "Strengthen core technical foundations and role-specific architecture knowledge."
                )
            elif avg_tech_score < 70.0:
                tech_improvements.append(
                    "Provide deeper technical explanations with specific engineering trade-offs."
                )

        # 3. Text Performance
        rel_scores = [
            e.relevance_score for e in evaluations if e.relevance_score is not None
        ]
        comp_scores = [
            e.completeness_score
            for e in evaluations
            if e.completeness_score is not None
        ]
        comm_scores = [
            e.communication_score
            for e in evaluations
            if e.communication_score is not None
        ]

        avg_relevance = (
            round(sum(rel_scores) / len(rel_scores), 1) if rel_scores else None
        )
        avg_completeness = (
            round(sum(comp_scores) / len(comp_scores), 1) if comp_scores else None
        )
        avg_communication = (
            round(sum(comm_scores) / len(comm_scores), 1) if comm_scores else None
        )
        semantic_performance = (
            "Evaluated via Transformer semantic embeddings blended into relevance assessment."
            if rel_scores
            else None
        )

        # 4. Audio Performance
        audio_count = sum(
            1 for q in answered_questions if q.answer and q.answer.audio_path
        )
        audio_perf = {
            "aggregate_audio_communication_score": None,
            "audio_answered_count": audio_count,
            "speaking_rate_wpm": None,
            "pause_filler_statistics": None,
            "note": (
                f"{audio_count} answer(s) submitted with audio. Acoustic metrics (WPM, pause/filler stats) "
                "were computed during multimodal evaluation and are not persisted as dedicated database columns."
                if audio_count > 0
                else "No audio recordings submitted for this interview."
            ),
        }

        # 5. Vision Performance
        video_count = sum(
            1 for q in answered_questions if q.answer and q.answer.video_path
        )
        vision_perf = {
            "aggregate_visual_communication_score": None,
            "video_answered_count": video_count,
            "visual_engagement_statistics": None,
            "note": (
                f"{video_count} answer(s) submitted with video. Visual engagement metrics "
                "were computed during multimodal evaluation and are not persisted as dedicated database columns."
                if video_count > 0
                else "No video recordings submitted for this interview."
            ),
            "disclaimer": (
                "Visual metrics represent geometric engagement approximations (head/face orientation and presence) "
                "and do not infer emotion, honesty, confidence, personality, or mental state."
            ),
        }

        # 6. Question-wise Analytics
        question_analytics_list = []
        for q in questions:
            has_ans = q.answer is not None
            ev = q.answer.evaluation if (has_ans and q.answer.evaluation) else None
            score = ev.overall_score if ev else None
            p_level = self._score_to_performance_level(score)

            q_data = {
                "question_id": q.id,
                "sequence_number": q.sequence_number,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "difficulty": interview.difficulty,
                "answer_status": "answered" if has_ans else "unanswered",
                "score": score,
                "performance_level": p_level,
                "evaluation_feedback": ev.feedback if ev else None,
                "relevance_score": ev.relevance_score if ev else None,
                "technical_score": ev.technical_score if ev else None,
                "completeness_score": ev.completeness_score if ev else None,
                "communication_score": ev.communication_score if ev else None,
                "has_audio": bool(has_ans and q.answer.audio_path),
                "has_video": bool(has_ans and q.answer.video_path),
                "duration_seconds": q.answer.duration_seconds if has_ans else None,
            }
            question_analytics_list.append(q_data)

        # 7. Progression Analytics
        score_progression = [q["score"] for q in question_analytics_list]
        difficulty_progression = [interview.difficulty for _ in questions]

        # Calculate performance transitions across answered questions
        transitions = []
        evaluated_q_list = [
            q for q in question_analytics_list if q["score"] is not None
        ]
        rank_map = {"weak": 1, "average": 2, "strong": 3}

        for i in range(len(evaluated_q_list) - 1):
            curr_q = evaluated_q_list[i]
            next_q = evaluated_q_list[i + 1]
            curr_p = curr_q["performance_level"]
            next_p = next_q["performance_level"]

            if rank_map.get(next_p, 0) > rank_map.get(curr_p, 0):
                t_type = "improved"
            elif rank_map.get(next_p, 0) < rank_map.get(curr_p, 0):
                t_type = "declined"
            else:
                t_type = "maintained"

            transitions.append(
                {
                    "from_question_seq": curr_q["sequence_number"],
                    "to_question_seq": next_q["sequence_number"],
                    "from_performance": curr_p,
                    "to_performance": next_p,
                    "transition_type": t_type,
                }
            )

        adaptive_summary = []
        for q in evaluated_q_list:
            lvl = q["performance_level"]
            if lvl == "weak":
                strat = "Reinforce fundamentals with core conceptual questions."
            elif lvl == "strong":
                strat = "Advance complexity and explore architectural depth."
            else:
                strat = "Maintain moderate depth and assess adjacent concepts."
            adaptive_summary.append(
                {
                    "question_sequence": q["sequence_number"],
                    "performance_level": lvl,
                    "adaptive_strategy": strat,
                }
            )

        # 8. Strengths and Improvement Areas
        strengths: List[str] = []
        improvement_areas: List[str] = []

        if avg_overall_score is not None:
            if avg_overall_score >= 75.0:
                strengths.append(
                    "High overall performance demonstrating readiness for the target role."
                )
            elif avg_overall_score >= 50.0:
                strengths.append(
                    "Consistent baseline competency across evaluated interview questions."
                )

            if avg_relevance and avg_relevance >= 75.0:
                strengths.append(
                    "Consistently direct, on-target answers addressing question prompts."
                )
            if avg_tech_score and avg_tech_score >= 70.0:
                strengths.append(
                    "Accurate technical terminology and clear grasp of system mechanics."
                )
            if avg_completeness and avg_completeness >= 70.0:
                strengths.append(
                    "Structured and comprehensive responses with thorough coverage."
                )
            if avg_communication and avg_communication >= 70.0:
                strengths.append(
                    "Clear written communication and articulate reasoning."
                )

            # Improvement Areas
            if avg_overall_score < 50.0:
                improvement_areas.append(
                    "Overall responses require greater depth and precision to meet expectations."
                )
            if avg_relevance and avg_relevance < 50.0:
                improvement_areas.append(
                    "Align answers more directly with the core problem statement before expanding."
                )
            if avg_tech_score and avg_tech_score < 50.0:
                improvement_areas.append(
                    "Deepen technical foundations and incorporate domain-specific frameworks/methods."
                )
            if avg_completeness and avg_completeness < 50.0:
                improvement_areas.append(
                    "Expand answers beyond high-level summaries to include concrete technical details."
                )
            if avg_communication and avg_communication < 50.0:
                improvement_areas.append(
                    "Organize answers with clearer structure and step-by-step logic."
                )

        if total_unanswered > 0:
            improvement_areas.append(
                f"Complete the remaining {total_unanswered} unanswered question(s) in this interview."
            )

        if not strengths:
            if total_answered > 0:
                strengths.append("Completed questions across scheduled interview topics.")
            else:
                strengths.append("No answers submitted yet to evaluate strengths.")

        if not improvement_areas:
            improvement_areas.append(
                "Maintain current technical depth and structured communication delivery."
            )

        # 9. Deterministic Final Summary
        if total_questions == 0:
            final_summary = f"Interview '{interview_id}' has no questions created."
        elif total_answered == 0:
            final_summary = (
                f"Interview for candidate '{candidate.name}' ({interview.role}, {interview.difficulty} difficulty) "
                f"has not been started yet. 0 of {total_questions} questions have been answered."
            )
        elif total_unanswered > 0:
            final_summary = (
                f"Interview for candidate '{candidate.name}' ({interview.role}, {interview.difficulty} difficulty) "
                f"is in progress with {total_answered}/{total_questions} questions answered ({completion_pct}%). "
                f"The candidate's current average score is {avg_overall_score} ({overall_perf_level})."
            )
        else:
            final_summary = (
                f"Interview completed for candidate '{candidate.name}' ({interview.role}, {interview.difficulty} difficulty). "
                f"Candidate completed all {total_questions} questions, achieving an overall score of {avg_overall_score} ({overall_perf_level}). "
                f"Breakdown: {strong_count} strong, {average_count} average, and {weak_count} weak responses."
            )

        return {
            "interview_summary": {
                "interview_id": interview.id,
                "candidate": {
                    "id": candidate.id,
                    "name": candidate.name,
                    "email": candidate.email,
                },
                "role": interview.role,
                "difficulty": interview.difficulty,
                "interview_type": interview.interview_type,
                "status": interview.status,
                "started_at": interview.started_at,
                "completed_at": interview.completed_at,
                "total_questions": total_questions,
                "answered_questions": total_answered,
                "unanswered_questions": total_unanswered,
                "completion_percentage": completion_pct,
                "is_completed": is_completed,
            },
            "overall_performance": {
                "overall_score": avg_overall_score,
                "performance_level": overall_perf_level,
                "strong_answers_count": strong_count,
                "average_answers_count": average_count,
                "weak_answers_count": weak_count,
            },
            "technical_performance": {
                "aggregate_technical_score": avg_tech_score,
                "performance_level": tech_perf_level,
                "technical_strengths": tech_strengths,
                "technical_improvement_areas": tech_improvements,
            },
            "text_performance": {
                "relevance_score": avg_relevance,
                "completeness_score": avg_completeness,
                "communication_score": avg_communication,
                "semantic_performance": semantic_performance,
            },
            "audio_performance": audio_perf,
            "vision_performance": vision_perf,
            "question_analytics": question_analytics_list,
            "progression": {
                "score_progression": score_progression,
                "difficulty_progression": difficulty_progression,
                "performance_transitions": transitions,
                "adaptive_strategy_summary": adaptive_summary,
            },
            "strengths": strengths,
            "improvement_areas": improvement_areas,
            "final_summary": final_summary,
        }


interview_report_service = InterviewReportService()
