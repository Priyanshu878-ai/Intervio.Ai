"""
Text Answer Analyzer for Intervio.Ai combining Hugging Face SentenceTransformer
semantic similarity with domain keyword analysis and communication metrics.
"""

import re
from typing import Any, Dict, List, Set

from app.services.semantic_analyzer import semantic_analyzer

# Common English stop words to exclude from keyword extraction
STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "could", "did", "do", "does",
    "doing", "down", "during", "each", "few", "for", "from", "further", "had",
    "has", "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
    "his", "how", "i", "if", "in", "into", "is", "isn't", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "with", "would", "you", "your", "yours", "yourself", "yourselves", "explain",
    "describe", "define", "discuss", "what's", "how's", "give", "example", "examples"
}

# Domain keyword dictionaries by role
ROLE_KEYWORDS: Dict[str, Set[str]] = {
    "backend": {
        "api", "rest", "graphql", "sql", "postgresql", "database", "orm", "sqlalchemy",
        "async", "asyncio", "http", "concurrency", "indexing", "cache", "redis",
        "post", "get", "put", "delete", "endpoint", "server", "fastapi", "python",
        "transaction", "acid", "sharding", "pool", "jwt", "auth", "middleware"
    },
    "frontend": {
        "react", "dom", "component", "css", "html", "state", "props", "next", "ssr",
        "ssg", "rendering", "virtual", "flexbox", "grid", "typescript", "javascript",
        "hooks", "context", "redux", "bundle", "webpack", "a11y", "accessibility"
    },
    "machine_learning": {
        "model", "training", "neural", "gradient", "loss", "features", "attention",
        "transformer", "overfitting", "underfitting", "classification", "regression",
        "dataset", "pytorch", "huggingface", "whisper", "mediapipe", "cv", "nlp",
        "embedding", "accuracy", "precision", "recall", "f1", "validation", "epoch"
    },
    "full_stack": {
        "api", "rest", "react", "next", "fastapi", "database", "sql", "postgres",
        "frontend", "backend", "http", "state", "component", "server", "orm", "auth"
    },
}

# Configurable dimension weights
WEIGHTS = {
    "relevance": 0.30,
    "technical": 0.35,
    "completeness": 0.20,
    "communication": 0.15,
}

# Configurable relevance fusion weights (Semantic Transformer vs Keyword Overlap)
SEMANTIC_RELEVANCE_WEIGHT = 0.60
KEYWORD_RELEVANCE_WEIGHT = 0.40

# Common filler words for communication scoring
FILLER_WORDS: Set[str] = {"um", "uh", "like", "basically", "actually", "literally", "honestly"}


class AnswerAnalyzer:
    """
    Combines Hugging Face SentenceTransformers embedding similarity
    with domain keyword coverage, completeness heuristics, and communication clarity.
    """

    @staticmethod
    def _clean_and_tokenize(text: str) -> List[str]:
        words = re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())
        return words

    @staticmethod
    def _extract_keywords(text: str) -> Set[str]:
        tokens = AnswerAnalyzer._clean_and_tokenize(text)
        return {w for w in tokens if w not in STOP_WORDS and len(w) > 2}

    def analyze(self, question_text: str, answer_text: str, role: str = "default") -> Dict[str, Any]:
        cleaned_answer = answer_text.strip()
        answer_tokens = self._clean_and_tokenize(cleaned_answer)
        answer_keywords = self._extract_keywords(cleaned_answer)
        question_keywords = self._extract_keywords(question_text)

        word_count = len(answer_tokens)
        if word_count == 0:
            return {
                "relevance_score": 0.0,
                "technical_score": 0.0,
                "completeness_score": 0.0,
                "communication_score": 0.0,
                "overall_score": 0.0,
                "performance_level": "weak",
                "feedback": "No answer provided.",
            }

        # 1. Deterministic Keyword Relevance Calculation
        if question_keywords:
            overlap = question_keywords & answer_keywords
            overlap_ratio = len(overlap) / len(question_keywords)
            keyword_relevance = min(100.0, (overlap_ratio * 70.0) + (30.0 if len(overlap) > 0 else 10.0))
        else:
            keyword_relevance = 70.0

        # 2. Transformer Semantic Relevance Calculation
        semantic_score = semantic_analyzer.compute_semantic_score(
            question_text=question_text,
            answer_text=cleaned_answer,
        )

        if semantic_score is not None:
            relevance_score = round(
                (SEMANTIC_RELEVANCE_WEIGHT * semantic_score)
                + (KEYWORD_RELEVANCE_WEIGHT * keyword_relevance),
                1,
            )
        else:
            relevance_score = round(keyword_relevance, 1)

        # 3. Completeness Score Calculation
        unique_ratio = len(set(answer_tokens)) / float(word_count)
        if word_count < 10:
            length_score = (word_count / 10.0) * 40.0
        elif 10 <= word_count <= 100:
            length_score = 40.0 + ((word_count - 10) / 90.0) * 50.0
        else:
            length_score = 90.0

        completeness_score = min(100.0, length_score * unique_ratio)

        # 4. Technical Score Calculation
        normalized_role = role.lower().strip().replace("-", "_").replace(" ", "_")
        domain_keywords = ROLE_KEYWORDS.get(normalized_role, ROLE_KEYWORDS.get("full_stack", set()))
        combined_target_keywords = question_keywords | domain_keywords

        matched_tech = answer_keywords & combined_target_keywords
        if combined_target_keywords:
            tech_ratio = len(matched_tech) / min(len(combined_target_keywords), 10.0)
            technical_score = min(100.0, tech_ratio * 80.0 + (20.0 if len(matched_tech) > 0 else 0.0))
        else:
            technical_score = 50.0

        # 5. Communication Score Calculation
        sentences = [s for s in re.split(r"[.!?]+", cleaned_answer) if s.strip()]
        sentence_count = max(1, len(sentences))

        filler_count = sum(1 for w in answer_tokens if w in FILLER_WORDS)
        filler_ratio = filler_count / float(word_count)

        comm_score = 80.0
        if sentence_count == 1 and word_count > 30:
            comm_score -= 15.0  # Run-on sentence penalty
        if filler_ratio > 0.05:
            comm_score -= min(30.0, filler_ratio * 200.0)  # Filler word penalty
        if unique_ratio < 0.4:
            comm_score -= 20.0  # Repetition penalty

        communication_score = max(10.0, min(100.0, comm_score))

        # 6. Weighted Overall Score
        overall_score = round(
            (WEIGHTS["relevance"] * relevance_score)
            + (WEIGHTS["technical"] * technical_score)
            + (WEIGHTS["completeness"] * completeness_score)
            + (WEIGHTS["communication"] * communication_score),
            1,
        )

        # 7. Performance Level Categorization
        if overall_score >= 75.0:
            performance_level = "strong"
        elif overall_score >= 50.0:
            performance_level = "average"
        else:
            performance_level = "weak"

        # 8. Explainable Feedback Generation
        feedback_points: List[str] = []
        if semantic_score is not None and semantic_score >= 75.0:
            feedback_points.append("Strong semantic relevance to the question context.")
        elif semantic_score is not None and semantic_score < 45.0:
            feedback_points.append("Low semantic similarity to the question prompt.")
        elif relevance_score >= 75.0:
            feedback_points.append("Directly addresses key concepts in the question.")
        else:
            feedback_points.append("Response lacks clear alignment with the core question keywords.")

        if technical_score >= 75.0:
            feedback_points.append(f"Demonstrates strong domain terminology ({', '.join(list(matched_tech)[:3])}).")
        elif technical_score < 50.0:
            feedback_points.append("Limited technical depth and domain keyword usage.")

        if word_count < 10:
            feedback_points.append("Answer is very short; consider providing a more detailed response.")
        elif completeness_score < 50.0:
            feedback_points.append("Answer lacks sufficient detail or structural completeness.")

        if unique_ratio < 0.4:
            feedback_points.append("High word repetition detected in text structure.")

        if filler_ratio > 0.05:
            feedback_points.append("Noticeable filler words detected in written text.")

        if not feedback_points:
            feedback_points.append("Balanced answer covering basic concepts adequately.")

        feedback_summary = " ".join(feedback_points)

        return {
            "relevance_score": round(relevance_score, 1),
            "technical_score": round(technical_score, 1),
            "completeness_score": round(completeness_score, 1),
            "communication_score": round(communication_score, 1),
            "overall_score": overall_score,
            "performance_level": performance_level,
            "feedback": feedback_summary,
        }


answer_analyzer = AnswerAnalyzer()
