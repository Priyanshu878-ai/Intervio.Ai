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

        # 1. No Answer Handling
        if word_count < 2:
            return {
                "relevance_score": 0.0,
                "technical_score": 0.0,
                "completeness_score": 0.0,
                "communication_score": 0.0,
                "overall_score": 0.0,
                "performance_level": "no_answer",
                "feedback": "No answer was provided for this question.",
                "correctness": 0.0,
                "relevance": 0.0,
                "completeness": 0.0,
                "confidence": 0.0,
            }

        # Extract question & answer concepts
        question_topic = list(question_keywords)[0].lower() if question_keywords else "the topic"

        # 2. Off-Topic Detection (no arbitrary positive score for off-topic answers!)
        off_topic_words = {"pizza", "food", "weather", "movie", "game", "vacation", "music", "restaurant"}
        cleaned_lower = cleaned_answer.lower()
        contains_off_topic_word = any(w in answer_tokens for w in off_topic_words)

        overlap = question_keywords & answer_keywords if question_keywords else set()
        overlap_ratio = len(overlap) / len(question_keywords) if question_keywords else 0.5

        semantic_score = semantic_analyzer.compute_semantic_score(
            question_text=question_text,
            answer_text=cleaned_answer,
        )

        is_off_topic = contains_off_topic_word or (len(overlap) == 0 and (semantic_score is None or semantic_score < 35.0))

        if is_off_topic:
            return {
                "relevance_score": 5.0,
                "technical_score": 0.0,
                "completeness_score": 10.0,
                "communication_score": 50.0,
                "overall_score": 10.0,  # Zero arbitrary positive score!
                "performance_level": "off_topic",
                "feedback": f"Response is off-topic and does not address {question_topic}.",
                "correctness": 0.0,
                "relevance": 5.0,
                "completeness": 10.0,
                "confidence": 50.0,
            }

        # 3. Unclear / Doubtful markers
        unclear_phrases = ["not sure", "dont know", "don't know", "no idea", "forget"]
        is_unclear = any(p in cleaned_lower for p in unclear_phrases)

        # 4. Standard Dimension Metrics (Correctness, Relevance, Completeness, Confidence)
        keyword_relevance = min(100.0, (overlap_ratio * 70.0) + (30.0 if len(overlap) > 0 else 0.0))

        if semantic_score is not None:
            relevance_score = round(
                (SEMANTIC_RELEVANCE_WEIGHT * semantic_score)
                + (KEYWORD_RELEVANCE_WEIGHT * keyword_relevance),
                1,
            )
        else:
            relevance_score = round(keyword_relevance, 1)

        # Completeness calculation
        unique_ratio = len(set(answer_tokens)) / float(word_count)
        if word_count < 10:
            length_score = (word_count / 10.0) * 40.0
        elif 10 <= word_count <= 100:
            length_score = 40.0 + ((word_count - 10) / 90.0) * 50.0
        else:
            length_score = 90.0

        completeness_score = min(100.0, length_score * unique_ratio)

        # Technical correctness & domain concept coverage
        normalized_role = role.lower().strip().replace("-", "_").replace(" ", "_")
        domain_keywords = ROLE_KEYWORDS.get(normalized_role, ROLE_KEYWORDS.get("full_stack", set()))
        combined_target_keywords = question_keywords | domain_keywords

        matched_tech = answer_keywords & combined_target_keywords
        if combined_target_keywords:
            tech_ratio = len(matched_tech) / min(len(combined_target_keywords), 10.0)
            technical_score = min(100.0, tech_ratio * 80.0 + (20.0 if len(matched_tech) > 0 else 0.0))
        else:
            technical_score = 50.0

        correctness_score = round((technical_score * 0.6) + (relevance_score * 0.4), 1)

        # Communication / Confidence score
        sentences = [s for s in re.split(r"[.!?]+", cleaned_answer) if s.strip()]
        sentence_count = max(1, len(sentences))
        filler_count = sum(1 for w in answer_tokens if w in FILLER_WORDS)
        filler_ratio = filler_count / float(word_count)

        comm_score = 80.0
        if sentence_count == 1 and word_count > 30:
            comm_score -= 15.0
        if filler_ratio > 0.05:
            comm_score -= min(30.0, filler_ratio * 200.0)
        if unique_ratio < 0.4:
            comm_score -= 20.0

        communication_score = max(10.0, min(100.0, comm_score))
        confidence_score = communication_score

        # Overall weighted score
        overall_score = round(
            (WEIGHTS["relevance"] * relevance_score)
            + (WEIGHTS["technical"] * technical_score)
            + (WEIGHTS["completeness"] * completeness_score)
            + (WEIGHTS["communication"] * communication_score),
            1,
        )

        # Performance Level Categorization: strong, partial, weak, incorrect, off_topic, no_answer
        if semantic_score is not None and semantic_score < 30.0 and len(matched_tech) == 0:
            performance_level = "incorrect"
            overall_score = min(25.0, overall_score)
        elif is_unclear:
            performance_level = "weak"
            overall_score = min(45.0, overall_score)
        elif overall_score >= 75.0:
            performance_level = "strong"
        elif overall_score >= 50.0:
            performance_level = "partial"
        else:
            performance_level = "weak"

        # 1-2 sentence explainable feedback
        if performance_level == "strong":
            feedback_summary = f"You provided a strong, technically accurate response explaining {question_topic} clearly."
        elif performance_level == "partial":
            feedback_summary = f"Good baseline explanation of {question_topic}, though adding key trade-offs would strengthen your response."
        elif performance_level == "incorrect":
            feedback_summary = f"Your response contained technical inaccuracies regarding {question_topic}."
        else:
            feedback_summary = f"Your response on {question_topic} was limited in technical depth. Focus on core mechanics."

        return {
            "relevance_score": round(relevance_score, 1),
            "technical_score": round(technical_score, 1),
            "completeness_score": round(completeness_score, 1),
            "communication_score": round(communication_score, 1),
            "overall_score": overall_score,
            "performance_level": performance_level,
            "feedback": feedback_summary,
            "correctness": correctness_score,
            "relevance": round(relevance_score, 1),
            "completeness": round(completeness_score, 1),
            "confidence": round(confidence_score, 1),
        }


answer_analyzer = AnswerAnalyzer()
