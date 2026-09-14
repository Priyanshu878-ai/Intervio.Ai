"""
Semantic Answer Analyzer for Intervio.Ai using Sentence Transformers.
Computes Transformer-based embedding cosine similarity between question and answer text.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Model name configuration
DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class SemanticAnalyzer:
    """
    Singleton-style Semantic Analyzer using Hugging Face SentenceTransformers.
    Loads the lightweight transformer model once into memory.
    """

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        self.model_name = model_name
        self._model = None
        self._load_attempted = False

    def _get_model(self):
        if self._model is None and not self._load_attempted:
            self._load_attempted = True
            try:
                from sentence_transformers import SentenceTransformer

                logger.info(f"Loading SentenceTransformer model: {self.model_name}")
                self._model = SentenceTransformer(self.model_name)
                logger.info("SentenceTransformer model loaded successfully!")
            except Exception as e:
                logger.warning(
                    f"Failed to load SentenceTransformer ({e}). Falling back to keyword analysis."
                )
                self._model = None
        return self._model

    def compute_similarity(self, question_text: str, answer_text: str) -> Optional[float]:
        """
        Computes cosine similarity between question and answer text.
        Returns a float between 0.0 and 1.0, or None if empty/model unavailable.
        """
        cleaned_answer = answer_text.strip()
        cleaned_question = question_text.strip()

        if not cleaned_answer or len(cleaned_answer.split()) < 2:
            return 0.0

        model = self._get_model()
        if model is None:
            return None  # Signal fallback to deterministic overlap

        try:
            embeddings = model.encode(
                [cleaned_question, cleaned_answer], convert_to_tensor=True
            )
            from sentence_transformers.util import cos_sim

            sim_tensor = cos_sim(embeddings[0], embeddings[1])
            similarity = float(sim_tensor.item())

            # Clamp cosine similarity between 0.0 and 1.0
            return max(0.0, min(1.0, similarity))
        except Exception as e:
            logger.warning(f"Error during semantic embedding computation: {e}")
            return None

    def compute_semantic_score(
        self, question_text: str, answer_text: str
    ) -> Optional[float]:
        """
        Converts cosine similarity into a 0.0 - 100.0 semantic relevance score.
        """
        similarity = self.compute_similarity(question_text, answer_text)
        if similarity is None:
            return None

        # Scaling cosine similarity (typically 0.1 - 0.85 for semantic matches) to 0-100 scale
        score = min(100.0, max(0.0, similarity * 120.0))
        return round(score, 1)


semantic_analyzer = SemanticAnalyzer()
