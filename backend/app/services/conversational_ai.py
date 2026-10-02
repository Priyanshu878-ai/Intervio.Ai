"""
Conversational AI Response & Lead-in Generator for Intervio.Ai.
Provides dynamic, candidate-aware reactions and question lead-ins based on semantic answer analysis.
"""

import random
import re
from typing import Any, Dict, List, Optional, Set

STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
    "between", "both", "but", "by", "can", "could", "did", "do", "does", "doing",
    "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more",
    "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
    "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
    "themselves", "then", "there", "these", "they", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
    "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your",
    "yours", "yourself", "yourselves", "explain", "describe", "define", "discuss",
    "like", "think", "guess", "really", "know", "mean", "use", "using", "used",
    "sure", "love", "eating", "food", "pizza", "stuff", "thing", "things", "maybe",
    "well", "good", "bad", "sort", "kind", "much", "many", "also", "even"
}

QUESTION_LEAD_INS: List[str] = [
    "Shifting focus to core architecture:",
    "Moving on to system performance:",
    "Next up, let's explore practical scenarios:",
    "Building on that technical context:",
    "Here is a key problem for your role:",
    "Next, let me ask about development trade-offs:",
]


def detect_conversational_intent(text: str) -> Optional[str]:
    """
    Detects non-technical candidate intents from speech/text prior to standard answer evaluation.
    Returns: 'repeat', 'clarify', 'wait', 'confused', or None.
    """
    if not text or not text.strip():
        return None

    cleaned = text.strip().lower()

    # 1. Repeat request (MUST be detected & take priority)
    repeat_patterns = [
        "repeat the question",
        "repeat that",
        "say that again",
        "say it again",
        "what was the question",
        "can you repeat",
        "could you repeat",
        "please repeat",
        "pardon me",
        "didn't catch that",
        "did not catch that"
    ]
    if any(pattern in cleaned for pattern in repeat_patterns):
        return "repeat"

    # 2. Clarification request
    clarify_patterns = [
        "can you clarify",
        "could you clarify",
        "what do you mean",
        "explain the question",
        "rephrase the question",
        "clarify the question",
        "what are you looking for"
    ]
    if any(pattern in cleaned for pattern in clarify_patterns):
        return "clarify"

    # 3. Request time / pause
    wait_patterns = [
        "give me a moment",
        "give me a second",
        "let me think",
        "hold on",
        "one moment",
        "wait a second",
        "just a minute",
        "need a minute"
    ]
    if any(pattern in cleaned for pattern in wait_patterns):
        return "wait"

    # 4. Express confusion
    confused_patterns = [
        "didn't understand",
        "did not understand",
        "don't understand",
        "do not understand",
        "im confused",
        "i'm confused",
        "not sure what you mean",
        "not sure what you're asking",
        "don't follow",
        "do not follow"
    ]
    if any(pattern in cleaned for pattern in confused_patterns):
        return "confused"

    # 5. Don't know / Uncertainty acknowledgment
    dont_know_patterns = [
        "i don't know",
        "i dont know",
        "i do not know",
        "i'm not sure",
        "im not sure",
        "no idea",
        "not really sure",
        "don't recall",
        "cannot recall"
    ]
    if any(pattern in cleaned for pattern in dont_know_patterns):
        return "dont_know"

    return None


def get_conversational_intro(role: str) -> str:
    """
    Generates a natural, conversational intro greeting prior to beginning technical questions.
    """
    cleaned_role = (role or "technical candidate").strip()
    intros = [
        f"Welcome to your AI interview assessment for the {cleaned_role} position. I'll be guiding you through a few technical questions today to evaluate your skills.",
        f"Hello! Thank you for joining today's session for the {cleaned_role} role. I'm excited to explore your technical experience.",
        f"Welcome! I'm your AI interviewer for the {cleaned_role} position. We'll go through a series of practical technical scenarios together.",
    ]
    return random.choice(intros)


def extract_key_phrase(text: str, fallback: str = "this topic") -> str:
    """Extracts a prominent 1-2 word noun phrase from candidate answer or question text."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text)
    filtered = [w for w in words if w.lower() not in STOP_WORDS]
    if len(filtered) >= 2:
        return f"{filtered[0].lower()} {filtered[1].lower()}"
    elif len(filtered) == 1:
        return filtered[0].lower()
    return fallback


def categorize_answer_quality(
    question_text: str,
    answer_text: str,
    analysis_res: Dict[str, Any],
) -> str:
    """
    Classifies candidate answer into: 'strong', 'partial', 'weak', 'unclear', or 'off_topic'.
    """
    relevance = analysis_res.get("relevance_score", 50.0)
    overall = analysis_res.get("overall_score", 50.0)
    perf_level = analysis_res.get("performance_level", "average")
    cleaned = answer_text.strip().lower()
    words = cleaned.split()

    # 1. Unclear / Doubtful markers (checked first)
    unclear_phrases = ["not sure", "dont know", "don't know", "no idea", "maybe", "not really clear", "forget"]
    if any(p in cleaned for p in unclear_phrases):
        return "unclear"

    # 2. Off-topic detection
    off_topic_words = {"pizza", "food", "weather", "movie", "game", "vacation", "music", "restaurant"}
    if relevance < 38.0 or any(w in words for w in off_topic_words):
        return "off_topic"

    # 3. Quality scoring breakdown
    if perf_level == "strong" or overall >= 60.0 or relevance >= 55.0:
        return "strong"
    elif perf_level == "weak" or overall < 45.0:
        return "weak"
    else:
        return "partial"


def generate_conversational_reaction(
    question_text: str,
    answer_text: str,
    analysis_res: Dict[str, Any],
    role: str = "default",
) -> str:
    """
    Generates a natural, unscripted 1-2 sentence spoken reaction tailored to the specific answer.
    """
    category = categorize_answer_quality(question_text, answer_text, analysis_res)
    question_topic = extract_key_phrase(question_text, fallback="the topic")
    extracted_concept = extract_key_phrase(answer_text, fallback=question_topic)

    if category == "off_topic":
        reactions = [
            f"It sounds like that answer pivoted away from {question_topic}. Let's re-anchor and focus on core principles.",
            f"I noticed that response touched on a different subject rather than {question_topic}. Let me reframe so we stay aligned.",
            f"That response drifted off-topic from {question_topic}. Let's bring the focus back to your core assessment.",
        ]
    elif category == "unclear":
        reactions = [
            f"I see you were uncertain about the details of {question_topic}. No worries at all—let's break down the basic mechanics step by step.",
            f"That concept of {question_topic} can definitely be tricky to recall on the spot. Let's explore a foundational question to build your momentum.",
            f"Thanks for giving it a shot on {question_topic}. Let's step back and look at a core concept together.",
        ]
    elif category == "strong":
        concept = extracted_concept if extracted_concept != "this topic" else question_topic
        reactions = [
            f"That's a solid explanation of {concept}. You clearly highlighted the key technical principles.",
            f"Spot on regarding {concept}. Your answer demonstrates practical hands-on experience.",
            f"Excellent technical breakdown of {concept}. Let's explore a deeper challenge in this next question.",
        ]
    elif category == "weak":
        concept = extracted_concept if extracted_concept != "this topic" else question_topic
        reactions = [
            f"Thank you for walking through your approach to {concept}. Let me ask a simpler scenario to reinforce the key principles.",
            f"I appreciate you sharing your thoughts on {concept}. Let's clarify a foundational concept in this next question.",
            f"Thanks for taking a stab at {concept}. Let's break down a core technical mechanic to build on your answer.",
        ]
    else:  # partial
        concept = extracted_concept if extracted_concept != "this topic" else question_topic
        reactions = [
            f"You brought up good points on {concept}, though adding a bit more detail on trade-offs would complete the picture.",
            f"Good baseline explanation of {concept}. Let's explore a follow-up question to expand on that.",
            f"You touched on important aspects of {concept}. Let's build further on your response.",
        ]

    return random.choice(reactions)


def format_conversational_question(question_text: str) -> str:
    """Adds a natural lead-in prefix to question text if not already formatted."""
    if any(question_text.startswith(prefix) for prefix in QUESTION_LEAD_INS):
        return question_text

    # 40% chance of adding a dynamic intro prefix for variety
    if random.random() < 0.4:
        lead_in = random.choice(QUESTION_LEAD_INS)
        return f"{lead_in} {question_text}"
    return question_text

