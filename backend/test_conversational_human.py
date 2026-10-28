"""
Verification Test Script for Milestone: Human-like Interview Conversation.
Tests 3 conversational cases:
1. Candidate intent: 'please repeat the question' -> verifies repeat intent, current question returned, no new question generated.
2. Candidate intent: 'can you clarify' -> verifies clarify intent, current question returned with clarification bridge.
3. Candidate strong answer -> verifies semantic understanding, 1-2 sentence contextual reaction, adaptive next question.
"""

import sys
import uuid
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.models.candidate import Candidate
from app.db.models.interview import Interview
from app.db.models.question import Question
from app.services.conversational_ai import (
    detect_conversational_intent,
    generate_conversational_reaction,
    categorize_answer_quality,
)
from app.services.interview_orchestrator import interview_orchestrator


class TestHumanLikeConversation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create in-memory SQLite DB for clean execution
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        
        # Seed test candidate and interview
        self.candidate = Candidate(
            id=uuid.uuid4(),
            name="Test Candidate",
            email=f"candidate_{uuid.uuid4().hex[:6]}@example.com",
            hashed_password="hashed_pwd_stub",
        )
        self.db.add(self.candidate)
        
        self.interview = Interview(
            id=uuid.uuid4(),
            candidate_id=self.candidate.id,
            role="Backend Engineer",
            difficulty="medium",
            interview_type="technical",
            status="in_progress",
        )
        self.db.add(self.interview)
        
        self.question1 = Question(
            id=uuid.uuid4(),
            interview_id=self.interview.id,
            sequence_number=1,
            question_text="Explain how database indexing improves SQL query performance.",
            question_type="technical",
        )
        self.db.add(self.question1)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_case_1_repeat_question_intent(self):
        """Case 1: 'please repeat the question' MUST repeat current question without generating a new question."""
        user_speech = "please repeat the question"
        
        # 1. Test unit intent detection
        intent = detect_conversational_intent(user_speech)
        self.assertEqual(intent, "repeat")

        # 2. Test orchestrator submit_answer handling
        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=user_speech,
        )

        self.assertFalse(res["is_completed"])
        self.assertIsNotNone(res["next_question"])
        # Next question MUST be the EXACT same current question
        self.assertEqual(res["next_question"].id, self.question1.id)
        self.assertEqual(res["next_question"].question_text, self.question1.question_text)
        self.assertIn("repeat", res["contextual_response"].lower())

    def test_case_2_clarify_intent(self):
        """Case 2: 'can you clarify what you mean' -> returns clarification bridge and retains current question."""
        user_speech = "can you clarify what you mean by database indexing?"
        
        intent = detect_conversational_intent(user_speech)
        self.assertEqual(intent, "clarify")

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=user_speech,
        )

        self.assertFalse(res["is_completed"])
        self.assertEqual(res["next_question"].id, self.question1.id)
        self.assertIn("clarify", res["contextual_response"].lower())

    def test_case_3_strong_technical_answer(self):
        """Case 3: Candidate gives strong technical answer -> AI understands semantically and generates reaction."""
        user_speech = (
            "Database indexes build B-tree data structures on table columns to reduce query lookup time "
            "from O(N) full table scans to O(log N) search complexity. They significantly accelerate SELECT "
            "queries, though they add minor write overhead during INSERT or UPDATE operations."
        )

        intent = detect_conversational_intent(user_speech)
        self.assertIsNone(intent)  # Should not be flagged as a conversational command

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=user_speech,
        )

        self.assertIsNotNone(res["contextual_response"])
        self.assertGreater(len(res["contextual_response"]), 10)
        # Should proceed to next adaptive question
        self.assertIsNotNone(res["next_question"])
        self.assertNotEqual(res["next_question"].id, self.question1.id)


    def test_case_4_off_topic_answer_evaluation(self):
        """Case 4: Off-topic answer MUST receive low score (<= 15.0) and performance_level 'off_topic'."""
        user_speech = "I love eating pizza and watching movies on weekends."

        from app.services.answer_analyzer import answer_analyzer
        analysis = answer_analyzer.analyze(
            question_text=self.question1.question_text,
            answer_text=user_speech,
            role=self.interview.role,
        )

        self.assertEqual(analysis["performance_level"], "off_topic")
        self.assertLessEqual(analysis["overall_score"], 15.0)
        self.assertIn("off-topic", analysis["feedback"].lower())

    def test_case_5_simplify_intent(self):
        """Case 5: 'Please explain in easier words' restates question simply without advancing or scoring."""
        user_speech = "Please explain in easier words."

        intent = detect_conversational_intent(user_speech)
        self.assertEqual(intent, "simplify")

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=user_speech,
        )

        self.assertFalse(res["is_completed"])
        self.assertEqual(res["next_question"].id, self.question1.id)
        self.assertIsNone(res["analysis"]["final_score"])
        self.assertIn("simpler", res["contextual_response"].lower())

    def test_case_6_skip_question_advances_exactly_once(self):
        """Case 6: 'Please skip this question' marks question skipped, scores 0, and advances exactly once."""
        # Add a second question to test advancement
        question2 = Question(
            id=uuid.uuid4(),
            interview_id=self.interview.id,
            sequence_number=2,
            question_text="Describe ACID properties in relational databases.",
            question_type="technical",
        )
        self.db.add(question2)
        self.db.commit()

        user_speech = "Please skip this question"
        intent = detect_conversational_intent(user_speech)
        self.assertEqual(intent, "skip")

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=user_speech,
        )

        # Must advance to question 2
        self.assertEqual(res["next_question"].id, question2.id)
        self.assertEqual(res["analysis"]["final_score"], 0.0)
        self.assertEqual(res["analysis"]["performance_level"], "skipped")

        # Session state must show question 1 answered as skipped
        session_state = interview_orchestrator.get_session_state(self.db, self.interview.id)
        self.assertEqual(session_state["answered_questions"], 1)
        self.assertEqual(session_state["current_question"].id, question2.id)

    def test_case_7_normal_answers_with_uncertainty_not_treated_as_commands(self):
        """Case 7: Answers with 'let me think' or 'I'm not sure, but...' are evaluated as normal answers."""
        phrase1 = "Let me think about this. Database indexing uses B-trees or hash tables to speed up search lookups from O(N) to O(log N)."
        phrase2 = "I'm not sure about the exact RFC number, but HTTP/2 introduces multiplexing and binary framing over a single TCP stream."

        self.assertIsNone(detect_conversational_intent(phrase1))
        self.assertIsNone(detect_conversational_intent(phrase2))

    def test_case_8_idempotent_duplicate_submit(self):
        """Case 8: Duplicate submit on the same question does NOT advance a second time."""
        question2 = Question(
            id=uuid.uuid4(),
            interview_id=self.interview.id,
            sequence_number=2,
            question_text="Explain Python GIL.",
            question_type="technical",
        )
        self.db.add(question2)
        self.db.commit()

        # First submit
        res1 = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text="[SKIPPED]",
        )
        self.assertEqual(res1["next_question"].id, question2.id)

        # Duplicate submit on question 1
        res2 = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text="[SKIPPED]",
        )
        # Should idempotently return question2, NOT advance past question2
        self.assertEqual(res2["next_question"].id, question2.id)

    def test_case_9_unanswered_timeout_submission(self):
        """Case 9: Submitting [UNANSWERED] due to silence timeout or time expiration records 0.0 and advances once."""
        intent = detect_conversational_intent("[UNANSWERED]")
        self.assertEqual(intent, "unanswered")

        question2 = Question(
            id=uuid.uuid4(),
            interview_id=self.interview.id,
            sequence_number=2,
            question_text="Describe how connection pooling works.",
            question_type="technical",
        )
        self.db.add(question2)
        self.db.commit()

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text="[UNANSWERED]",
        )

        # Must advance to question 2
        self.assertIsNotNone(res["next_question"])
        self.assertEqual(res["next_question"].id, question2.id)
        self.assertEqual(res["analysis"]["final_score"], 0.0)
        self.assertEqual(res["analysis"]["performance_level"], "unanswered")
        self.assertIn("unanswered", res["analysis"]["feedback"].lower())

        # Session state must show 1 question answered
        session_state = interview_orchestrator.get_session_state(self.db, self.interview.id)
        self.assertEqual(session_state["answered_questions"], 1)
        self.assertEqual(session_state["current_question"].id, question2.id)

    def test_case_10_adaptive_follow_up_incomplete_answer_probes_missing_concept(self):
        """Case 10: Incomplete answer probes the missing concept (e.g. write overhead in B-tree indexing)."""
        # Candidate only mentions lookup speed, omitting write performance / insert overhead
        incomplete_answer = "Indexes use B-trees to make lookups fast in O(log N) instead of full table scans."

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=incomplete_answer,
        )

        self.assertFalse(res["is_completed"])
        next_q = res["next_question"]
        self.assertIsNotNone(next_q)
        self.assertNotEqual(next_q.id, self.question1.id)

        # Must probe the missing concept (write overhead, insert/update penalty, or composite index)
        q_text_lower = next_q.question_text.lower()
        has_probe_concept = any(term in q_text_lower for term in ["write", "insert", "update", "composite", "trade-off"])
        self.assertTrue(has_probe_concept, f"Follow-up question should probe missing concept: {next_q.question_text}")
        self.assertEqual(res["adaptive_strategy"].get("follow_up_mode"), "probe_missing")
        self.assertEqual(res["adaptive_strategy"].get("follow_up_topic"), "Database Indexing")

    def test_case_11_adaptive_follow_up_correct_answer_deeper_question(self):
        """Case 11: Correct / strong answer asks a deeper question on the same topic."""
        strong_answer = (
            "Database indexes build B-tree data structures on table columns to reduce query lookup time "
            "from O(N) full table scans to O(log N) search complexity. They significantly accelerate SELECT "
            "queries, though they add minor write overhead during INSERT or UPDATE operations."
        )

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=strong_answer,
        )

        self.assertFalse(res["is_completed"])
        next_q = res["next_question"]
        self.assertIsNotNone(next_q)
        self.assertNotEqual(next_q.id, self.question1.id)

        # Must ask a deeper question on database indexing internals (clustered index, page splits, or table scan trade-offs)
        q_text_lower = next_q.question_text.lower()
        has_deeper_concept = any(term in q_text_lower for term in ["clustered", "page split", "fragmentation", "table scan", "internals", "high-concurrency"])
        self.assertTrue(has_deeper_concept, f"Follow-up should dive deeper: {next_q.question_text}")
        self.assertEqual(res["adaptive_strategy"].get("follow_up_mode"), "deeper")

    def test_case_12_irrelevant_off_topic_answer_does_not_trigger_follow_up(self):
        """Case 12: Irrelevant / off-topic answer does NOT generate an answer-aware follow-up on the off-topic subject."""
        off_topic_answer = "I really love eating pepperoni pizza with extra cheese while watching comedy movies on Friday nights."

        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text=off_topic_answer,
        )

        self.assertEqual(res["analysis"]["performance_level"], "off_topic")
        self.assertLessEqual(res["analysis"]["final_score"], 20.0)

        # Next question MUST NOT follow up on pizza or movies!
        next_q = res["next_question"]
        if next_q:
            q_text_lower = next_q.question_text.lower()
            self.assertNotIn("pizza", q_text_lower)
            self.assertNotIn("movie", q_text_lower)

        # Strategy must NOT be follow-up mode
        self.assertIsNone(res["adaptive_strategy"].get("follow_up_mode"))

    def test_case_13_empty_answer_follows_standard_flow(self):
        """Case 13: Empty or trivial answer does NOT trigger an answer-aware follow-up."""
        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text="",
        )

        self.assertFalse(res["is_completed"])
        # Should NOT be an adaptive follow-up
        self.assertIsNone(res["adaptive_strategy"].get("follow_up_mode"))

    def test_case_14_question_limit_enforcement(self):
        """Case 14: Follow-up questions adapt existing pre-generated questions in-place and respect max limits."""
        question2 = Question(
            id=uuid.uuid4(),
            interview_id=self.interview.id,
            sequence_number=2,
            question_text="Generic placeholder question.",
            question_type="technical",
        )
        self.db.add(question2)
        self.db.commit()

        initial_count = len(interview_orchestrator._get_questions(self.db, self.interview.id))
        self.assertEqual(initial_count, 2)

        # Submit answer to question 1
        res = interview_orchestrator.submit_answer(
            db=self.db,
            interview_id=self.interview.id,
            question_id=self.question1.id,
            answer_text="Indexes use B-trees for rapid search lookups.",
        )

        # Question count must remain exactly 2 (question 2 was adapted in place)
        all_q = interview_orchestrator._get_questions(self.db, self.interview.id)
        self.assertEqual(len(all_q), 2, "Question limit must be preserved without adding extra question rows")
        self.assertEqual(res["next_question"].id, question2.id)
        self.assertNotEqual(res["next_question"].question_text, "Generic placeholder question.")


if __name__ == "__main__":
    unittest.main()
