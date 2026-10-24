"""
Model Management and Inference Module for Vishanti Petition ML Service.

Encapsulates model loading, persistence validation, probability estimation,
and category prediction logic.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib

# Ensure module directory is on sys.path for robust standalone and package imports
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from preprocess import combine_text, preprocess_text
    from schemas import (
        CategoryPrediction,
        PredictRequest,
        PredictResponse,
        BatchPredictResponse,
    )
except ImportError:
    from ML_service.preprocess import combine_text, preprocess_text
    from ML_service.schemas import (
        CategoryPrediction,
        PredictRequest,
        PredictResponse,
        BatchPredictResponse,
    )


class ModelNotLoadedError(Exception):
    """Raised when an inference operation is attempted but no model is loaded."""
    pass


class ModelManager:
    """
    Manages loading and executing the category classification model pipeline.
    Ensures safe thread-safe inference without retraining on requests.
    """

    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = None,
        confidence_threshold: Optional[float] = None,
    ):
        if model_path is None:
            env_path = os.getenv("MODEL_PATH")
            if env_path:
                self.model_path = Path(env_path)
            else:
                self.model_path = Path(__file__).resolve().parent / "models" / "category_classifier.joblib"
        else:
            self.model_path = Path(model_path)

        if confidence_threshold is None:
            env_thresh = os.getenv("CONFIDENCE_THRESHOLD", "0.45")
            try:
                self.confidence_threshold = float(env_thresh)
            except ValueError:
                self.confidence_threshold = 0.45
        else:
            self.confidence_threshold = float(confidence_threshold)

        self._pipeline = None
        self._classes: List[str] = []
        self._metadata: Dict[str, Any] = {}
        self._loaded: bool = False

    @property
    def is_loaded(self) -> bool:
        """Returns True if the pipeline is loaded and ready for predictions."""
        return self._loaded and self._pipeline is not None

    def load_model(self, path: Optional[Union[str, Path]] = None) -> bool:
        """
        Loads the trained serialized model artifact from disk into memory.
        Returns True if successful, False if the file is missing or corrupted.
        """
        target_path = Path(path) if path is not None else self.model_path

        if not target_path.exists():
            print(f"[MODEL_MANAGER] Model artifact not found at: {target_path}")
            self._pipeline = None
            self._classes = []
            self._metadata = {}
            self._loaded = False
            return False

        try:
            artifact = joblib.load(target_path)
            if not isinstance(artifact, dict) or "pipeline" not in artifact:
                raise ValueError("Invalid model artifact structure: missing 'pipeline' key")

            self._pipeline = artifact["pipeline"]
            self._classes = list(artifact.get("classes", getattr(self._pipeline, "classes_", [])))
            self._metadata = {
                "model_version": artifact.get("model_version", "1.0.0"),
                "algorithm": artifact.get("algorithm", "TF-IDF + LogisticRegression"),
                "trained_at": artifact.get("trained_at", datetime.now(timezone.utc).isoformat()),
                "categories": list(self._classes),
                "evaluation_metrics": artifact.get("evaluation_metrics", {}),
            }
            self._loaded = True
            print(f"[MODEL_MANAGER] Model successfully loaded ({len(self._classes)} categories)")
            return True
        except Exception as exc:
            print(f"[MODEL_MANAGER] Failed to load model artifact: {exc}")
            self._pipeline = None
            self._classes = []
            self._metadata = {}
            self._loaded = False
            return False

    def unload_model(self) -> None:
        """Unloads the model from memory. Useful for testing failure scenarios."""
        self._pipeline = None
        self._classes = []
        self._metadata = {}
        self._loaded = False

    def get_categories(self) -> List[str]:
        """Returns the list of categories supported by the loaded model."""
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model is not loaded. Train the model using 'python train.py' before requesting categories."
            )
        return list(self._classes)

    def get_metadata(self) -> Dict[str, Any]:
        """Returns model metadata and training metrics."""
        return dict(self._metadata)

    def predict(
        self,
        title: str,
        description: str,
        threshold: Optional[float] = None,
    ) -> PredictResponse:
        """
        Predicts category for a problem given title and description.
        Combines and normalizes input text, estimates probabilities,
        sorts candidate categories, and applies uncertainty flagging.
        """
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model is not trained or loaded. Please train the model using 'python train.py' before sending predictions."
            )

        active_threshold = threshold if threshold is not None else self.confidence_threshold

        # 1. Combine and preprocess
        combined_text = combine_text(title, description)
        cleaned_text = preprocess_text(combined_text)

        # 2. Probability estimation
        # If preprocessed text is empty, return uncertain default
        if not cleaned_text:
            return PredictResponse(
                predicted_category=self._classes[0] if self._classes else "Other",
                confidence=0.0,
                top_predictions=[
                    CategoryPrediction(category=c, confidence=0.0) for c in self._classes[:3]
                ],
                needs_review=True,
                message="The input text contains no discernible words for classification.",
            )

        probabilities = self._pipeline.predict_proba([cleaned_text])[0]

        # 3. Pair with categories and sort descending
        ranked_predictions = sorted(
            zip(self._classes, probabilities),
            key=lambda pair: pair[1],
            reverse=True,
        )

        top_category, top_prob = ranked_predictions[0]
        top_confidence = round(float(top_prob), 4)

        # Top 3 candidates (or fewer if model has fewer classes)
        top_k = [
            CategoryPrediction(category=cat, confidence=round(float(prob), 4))
            for cat, prob in ranked_predictions[:3]
        ]

        # 4. Check confidence threshold
        is_uncertain = top_confidence < active_threshold
        review_message = (
            "The model is uncertain about this classification." if is_uncertain else None
        )

        return PredictResponse(
            predicted_category=top_category,
            confidence=top_confidence,
            top_predictions=top_k,
            needs_review=is_uncertain,
            message=review_message,
        )

    def predict_batch(
        self,
        items: List[PredictRequest],
        threshold: Optional[float] = None,
    ) -> BatchPredictResponse:
        """
        Batch prediction endpoint logic reusing single prediction pipeline.
        """
        predictions = [
            self.predict(item.title, item.description, threshold=threshold)
            for item in items
        ]
        return BatchPredictResponse(total=len(predictions), predictions=predictions)


# Global default instance
model_manager = ModelManager()
