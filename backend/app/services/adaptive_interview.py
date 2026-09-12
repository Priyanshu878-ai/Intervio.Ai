"""
Adaptive Interview Decision Engine for Intervio.Ai.
Determines next question difficulty, type, and strategy based on previous candidate performance.
"""

from typing import Dict, Any, List


def get_next_question_strategy(
    current_difficulty: str,
    performance_level: str,
    current_question_type: str = "mixed",
    role: str = "default",
) -> Dict[str, Any]:
    """
    Determines adaptive strategy and next difficulty level based on candidate performance.
    """
    diff = current_difficulty.lower().strip()
    perf = performance_level.lower().strip()
    q_type = current_question_type.lower().strip()

    if perf == "weak":
        if diff == "hard":
            next_diff = "medium"
        else:
            next_diff = "easy"
        
        preferred_type = "technical" if q_type == "technical" else "mixed"
        reason = "Previous performance was weak; easing difficulty level to reinforce core fundamentals."
        strategy_name = "reinforce_fundamentals"

    elif perf == "strong":
        if diff == "easy":
            next_diff = "medium"
        else:
            next_diff = "hard"
        
        preferred_type = "technical"
        reason = "Previous performance was strong; increasing difficulty to evaluate deeper expertise."
        strategy_name = "increase_difficulty"

    else:  # average or default
        next_diff = diff if diff in ["easy", "medium", "hard"] else "medium"
        preferred_type = q_type if q_type in ["technical", "behavioral", "mixed"] else "mixed"
        reason = "Previous performance was average; maintaining current difficulty level for balanced evaluation."
        strategy_name = "maintain_difficulty"

    return {
        "performance_level": perf,
        "next_difficulty": next_diff,
        "preferred_question_type": preferred_type,
        "reason": reason,
        "strategy": strategy_name,
    }
