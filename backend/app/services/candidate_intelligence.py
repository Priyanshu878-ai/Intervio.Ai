"""
Candidate Intelligence & Progress Tracking Engine for Intervio.Ai.
Provides deterministic multi-interview analytics, performance trends,
communication evolution, competency breakdowns, and actionable practice suggestions
derived directly from existing interview, question, answer, and evaluation records.
"""

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.schemas.intelligence import (
    CandidateIntelligenceResponse,
    CommunicationTrendPoint,
    InterviewTypeStat,
    PerformanceTrendPoint,
    RoleStat,
)


class CandidateIntelligenceService:
    """
    Computes deterministic multi-session intelligence and progress metrics for a candidate.
    """

    def get_candidate_intelligence(
        self, db: Session, candidate_id: uuid.UUID
    ) -> CandidateIntelligenceResponse:
        candidate = db.execute(
            select(Candidate).where(Candidate.id == candidate_id)
        ).scalar_one_or_none()
        if not candidate:
            raise KeyError("Candidate not found")

        # Query all interviews chronologically
        interviews = list(
            db.execute(
                select(Interview)
                .where(Interview.candidate_id == candidate_id)
                .order_by(Interview.created_at.asc())
            )
            .scalars()
            .all()
        )

        total_interviews = len(interviews)
        if total_interviews == 0:
            return CandidateIntelligenceResponse(
                has_data=False,
                total_interviews=0,
                completed_interviews=0,
                overall_average_score=None,
                recent_score=None,
                previous_average_score=None,
                score_delta=None,
                technical_average=None,
                communication_average=None,
                relevance_average=None,
                performance_trend=[],
                communication_trend=[],
                technical_strengths=[],
                weak_areas=[],
                roles_attempted=[],
                interview_types_attempted=[],
                recent_improvements=[],
                suggested_practice_areas=[
                    "Begin your first technical interview to establish a performance baseline.",
                    "Select a target role and choose your preferred difficulty level.",
                ],
                overall_progress_summary="No interview sessions recorded yet. Start your first practice session to build your personalized performance intelligence profile.",
            )

        # Process each interview's evaluation metrics
        performance_trend: List[PerformanceTrendPoint] = []
        communication_trend: List[CommunicationTrendPoint] = []
        role_scores_map = defaultdict(list)
        type_scores_map = defaultdict(list)
        question_type_scores = defaultdict(list)

        completed_count = 0

        for interview in interviews:
            is_completed = interview.status == "completed" or (
                interview.questions and all(q.answer is not None for q in interview.questions)
            )
            if is_completed:
                completed_count += 1

            overall_scores: List[float] = []
            tech_scores: List[float] = []
            comm_scores: List[float] = []
            rel_scores: List[float] = []
            comp_scores: List[float] = []

            for q in interview.questions:
                if q.answer and q.answer.evaluation:
                    ev = q.answer.evaluation
                    if ev.overall_score is not None:
                        overall_scores.append(ev.overall_score)
                    if ev.technical_score is not None:
                        tech_scores.append(ev.technical_score)
                        question_type_scores[q.question_type or "technical"].append(ev.technical_score)
                    if ev.communication_score is not None:
                        comm_scores.append(ev.communication_score)
                    if ev.relevance_score is not None:
                        rel_scores.append(ev.relevance_score)
                    if ev.completeness_score is not None:
                        comp_scores.append(ev.completeness_score)

            # If this interview has evaluated answers
            if overall_scores:
                int_overall = round(sum(overall_scores) / len(overall_scores), 1)
                int_tech = round(sum(tech_scores) / len(tech_scores), 1) if tech_scores else None
                int_comm = round(sum(comm_scores) / len(comm_scores), 1) if comm_scores else None
                int_rel = round(sum(rel_scores) / len(rel_scores), 1) if rel_scores else None
                int_comp = round(sum(comp_scores) / len(comp_scores), 1) if comp_scores else None

                performance_trend.append(
                    PerformanceTrendPoint(
                        interview_id=interview.id,
                        created_at=interview.created_at,
                        role=interview.role,
                        difficulty=interview.difficulty,
                        interview_type=interview.interview_type,
                        overall_score=int_overall,
                        technical_score=int_tech,
                        communication_score=int_comm,
                        relevance_score=int_rel,
                    )
                )

                communication_trend.append(
                    CommunicationTrendPoint(
                        interview_id=interview.id,
                        created_at=interview.created_at,
                        role=interview.role,
                        communication_score=int_comm,
                        completeness_score=int_comp,
                    )
                )

                role_scores_map[interview.role].append(int_overall)
                type_scores_map[interview.interview_type].append(int_overall)
            else:
                # Track attempts even if not yet fully scored
                role_scores_map[interview.role]
                type_scores_map[interview.interview_type]

        if not performance_trend:
            return CandidateIntelligenceResponse(
                has_data=False,
                total_interviews=total_interviews,
                completed_interviews=0,
                overall_average_score=None,
                recent_score=None,
                previous_average_score=None,
                score_delta=None,
                technical_average=None,
                communication_average=None,
                relevance_average=None,
                performance_trend=[],
                communication_trend=[],
                technical_strengths=[],
                weak_areas=[],
                roles_attempted=[
                    RoleStat(role=r, count=len([i for i in interviews if i.role == r]), average_score=None)
                    for r in role_scores_map
                ],
                interview_types_attempted=[
                    InterviewTypeStat(interview_type=t, count=len([i for i in interviews if i.interview_type == t]), average_score=None)
                    for t in type_scores_map
                ],
                recent_improvements=[],
                suggested_practice_areas=[
                    "Complete answers in your pending interview sessions to generate performance insights.",
                ],
                overall_progress_summary=f"{total_interviews} interview session(s) initiated, but no completed evaluations have been recorded yet.",
            )

        # Compute multi-session aggregations
        all_overalls = [p.overall_score for p in performance_trend if p.overall_score is not None]
        overall_avg = round(sum(all_overalls) / len(all_overalls), 1) if all_overalls else None
        recent_score = performance_trend[-1].overall_score

        # Comparative metrics: recent vs previous sessions
        previous_avg = None
        score_delta = None
        if len(performance_trend) >= 2:
            prev_scores = [p.overall_score for p in performance_trend[:-1] if p.overall_score is not None]
            if prev_scores:
                previous_avg = round(sum(prev_scores) / len(prev_scores), 1)
                score_delta = round(recent_score - previous_avg, 1)

        # Dimension averages across all evaluated interviews
        all_tech = [p.technical_score for p in performance_trend if p.technical_score is not None]
        all_comm = [p.communication_score for p in performance_trend if p.communication_score is not None]
        all_rel = [p.relevance_score for p in performance_trend if p.relevance_score is not None]

        tech_avg = round(sum(all_tech) / len(all_tech), 1) if all_tech else None
        comm_avg = round(sum(all_comm) / len(all_comm), 1) if all_comm else None
        rel_avg = round(sum(all_rel) / len(all_rel), 1) if all_rel else None

        # Roles attempted statistics
        roles_attempted: List[RoleStat] = []
        for r, scores in role_scores_map.items():
            r_count = sum(1 for i in interviews if i.role == r)
            r_avg = round(sum(scores) / len(scores), 1) if scores else None
            roles_attempted.append(RoleStat(role=r, count=r_count, average_score=r_avg))
        roles_attempted.sort(key=lambda x: x.count, reverse=True)

        # Interview types attempted statistics
        interview_types_attempted: List[InterviewTypeStat] = []
        for t, scores in type_scores_map.items():
            t_count = sum(1 for i in interviews if i.interview_type == t)
            t_avg = round(sum(scores) / len(scores), 1) if scores else None
            interview_types_attempted.append(InterviewTypeStat(interview_type=t, count=t_count, average_score=t_avg))
        interview_types_attempted.sort(key=lambda x: x.count, reverse=True)

        # Determine Technical Strengths (Deterministic based on >= 70 threshold)
        strengths: List[str] = []
        if tech_avg is not None and tech_avg >= 70.0:
            strengths.append(f"Domain Technical Competency (Average {tech_avg}%) — Demonstrated strong core mechanics and problem solving.")
        if rel_avg is not None and rel_avg >= 70.0:
            strengths.append(f"Prompt & Requirements Precision (Average {rel_avg}%) — High relevance adhering closely to interview questions.")
        if comm_avg is not None and comm_avg >= 70.0:
            strengths.append(f"Structured Articulation (Average {comm_avg}%) — Clear, coherent explanations and communicative delivery.")

        for q_type, q_scores in question_type_scores.items():
            if q_scores:
                avg_q = round(sum(q_scores) / len(q_scores), 1)
                if avg_q >= 75.0 and len(strengths) < 4:
                    label = q_type.replace("_", " ").title()
                    strengths.append(f"{label} Questions Mastery (Average {avg_q}%) — Strong depth across {len(q_scores)} evaluated response(s).")

        for r_stat in roles_attempted:
            if r_stat.average_score and r_stat.average_score >= 75.0 and len(strengths) < 5:
                strengths.append(f"{r_stat.role} Track (Average {r_stat.average_score}%) — Proven proficiency across multiple sessions.")

        if not strengths:
            if overall_avg and overall_avg >= 50.0:
                strengths.append(f"Solid Foundations (Average {overall_avg}%) — Consistent baseline established across practice sessions.")
            else:
                strengths.append("Baseline established — Continuing sessions will highlight emerging strengths.")

        # Determine Weak / Growth Areas (Deterministic based on < 65 threshold)
        weak_areas: List[str] = []
        if tech_avg is not None and tech_avg < 65.0:
            weak_areas.append(f"Technical Explanation Depth (Average {tech_avg}%) — Bolster specific algorithmic mechanics and architecture trade-offs.")
        if comm_avg is not None and comm_avg < 65.0:
            weak_areas.append(f"Communication Delivery Flow (Average {comm_avg}%) — Focus on structured concise summaries and reasoning frameworks.")
        if rel_avg is not None and rel_avg < 65.0:
            weak_areas.append(f"Question Scope Alignment (Average {rel_avg}%) — Address primary prompts directly before elaborating on tangential details.")

        for q_type, q_scores in question_type_scores.items():
            if q_scores:
                avg_q = round(sum(q_scores) / len(q_scores), 1)
                if avg_q < 60.0 and len(weak_areas) < 3:
                    label = q_type.replace("_", " ").title()
                    weak_areas.append(f"{label} Question Depth (Average {avg_q}%) — Review core conceptual patterns and practice scenario explanations.")

        if not weak_areas:
            weak_areas.append("Edge Case & Scalability Trade-offs — Push into Senior/Lead difficulty to test advanced system boundary conditions.")

        # Recent Improvements (Comparative insights)
        improvements: List[str] = []
        if len(performance_trend) >= 2 and score_delta is not None:
            if score_delta > 0:
                improvements.append(f"Overall score progressed by +{score_delta}% in the most recent session compared to prior average.")
            elif score_delta == 0:
                improvements.append("Performance remained consistently steady across consecutive evaluation sessions.")
            else:
                improvements.append(f"Recent session established an updated reference point ({recent_score}% vs prior average {previous_avg}%).")

            recent_tech = performance_trend[-1].technical_score
            prev_techs = [p.technical_score for p in performance_trend[:-1] if p.technical_score is not None]
            if recent_tech is not None and prev_techs:
                p_tech_avg = sum(prev_techs) / len(prev_techs)
                t_diff = round(recent_tech - p_tech_avg, 1)
                if t_diff > 0:
                    improvements.append(f"Technical scoring grew by +{t_diff}% over previous session benchmarks.")

            recent_comm = performance_trend[-1].communication_score
            prev_comms = [p.communication_score for p in performance_trend[:-1] if p.communication_score is not None]
            if recent_comm is not None and prev_comms:
                p_comm_avg = sum(prev_comms) / len(prev_comms)
                c_diff = round(recent_comm - p_comm_avg, 1)
                if c_diff > 0:
                    improvements.append(f"Communication articulation improved by +{c_diff}% in the latest session.")
        else:
            improvements.append("Initial baseline successfully established across your first evaluated session.")
            if overall_avg and overall_avg >= 70.0:
                improvements.append("Demonstrated high starting baseline competency in your initial interview.")

        # Suggested Areas to Practice (Actionable, deterministic recommendations)
        practice_areas: List[str] = []

        # Find dimension with lowest score
        dimensions = []
        if tech_avg is not None:
            dimensions.append(("technical", tech_avg, "Focus on deep technical implementation, framework internals, and architectural trade-offs."))
        if comm_avg is not None:
            dimensions.append(("communication", comm_avg, "Practice verbal/written structure: state the high-level decision before diving into code or details."))
        if rel_avg is not None:
            dimensions.append(("relevance", rel_avg, "Practice dissecting problem requirements to deliver immediate, laser-focused solutions."))

        if dimensions:
            dimensions.sort(key=lambda x: x[1])
            practice_areas.append(dimensions[0][2])

        # Recommend untried or low-frequency interview formats
        attempted_types = {s.interview_type for s in interview_types_attempted}
        if "system_design" not in attempted_types:
            practice_areas.append("Take a System Design interview to assess distributed architecture, caching, and scalability concepts.")
        elif "behavioral" not in attempted_types:
            practice_areas.append("Schedule a Behavioral & Leadership session using the STAR framework to practice communication during technical incidents.")

        # Recommend target role reinforcement
        if candidate.target_role and candidate.target_role not in {r.role for r in roles_attempted}:
            practice_areas.append(f"Run a session specifically tailored for your configured target role: '{candidate.target_role}'.")

        if len(practice_areas) < 3:
            practice_areas.append("Challenge yourself with Hard difficulty to test deeper edge-case handling under adaptive AI constraints.")

        # Deterministic Progress Summary
        if len(performance_trend) >= 2 and score_delta is not None:
            trend_descriptor = (
                f"an upward trajectory (+{score_delta}% gain)"
                if score_delta > 0
                else "consistent calibration"
                if score_delta == 0
                else "a targeted opportunity for refinement"
            )
            summary = (
                f"{candidate.name} has completed {completed_count} interview(s) across {len(roles_attempted)} role track(s) "
                f"with a cumulative average score of {overall_avg}%. Recent evaluation shows {trend_descriptor}."
            )
        else:
            summary = (
                f"{candidate.name} has completed {completed_count} interview(s) establishing an initial average score of {overall_avg}%. "
                "Complete additional sessions to unlock detailed comparative trajectory analytics."
            )

        return CandidateIntelligenceResponse(
            has_data=True,
            total_interviews=total_interviews,
            completed_interviews=completed_count,
            overall_average_score=overall_avg,
            recent_score=recent_score,
            previous_average_score=previous_avg,
            score_delta=score_delta,
            technical_average=tech_avg,
            communication_average=comm_avg,
            relevance_average=rel_avg,
            performance_trend=performance_trend,
            communication_trend=communication_trend,
            technical_strengths=strengths,
            weak_areas=weak_areas,
            roles_attempted=roles_attempted,
            interview_types_attempted=interview_types_attempted,
            recent_improvements=improvements,
            suggested_practice_areas=practice_areas,
            overall_progress_summary=summary,
        )


candidate_intelligence_service = CandidateIntelligenceService()
