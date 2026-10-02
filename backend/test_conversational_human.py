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


if __name__ == "__main__":
    unittest.main()
