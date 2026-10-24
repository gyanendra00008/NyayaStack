"""
Model Training Script for Vishanti Petition Category Classification Service.

Loads the training dataset, validates input records, performs stratified
train-test split, trains a TF-IDF + Logistic Regression pipeline, evaluates
performance, and saves the trained pipeline artifact to disk.
"""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

# Ensure ML_service directory is on sys.path so local imports work from any working directory
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from preprocess import combine_text, preprocess_text

# Default paths
DEFAULT_DATA_PATH = CURRENT_DIR / "data" / "training_data.csv"
DEFAULT_MODEL_DIR = CURRENT_DIR / "models"
DEFAULT_MODEL_PATH = DEFAULT_MODEL_DIR / "category_classifier.joblib"
RANDOM_SEED = 42


def load_and_validate_data(csv_path: Path) -> pd.DataFrame:
    """Loads CSV file and validates required columns and clean records."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Training dataset not found at: {csv_path}")

    df = pd.read_csv(csv_path)

    # Validate required columns
    required_cols = {"title", "description", "category"}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {missing_cols}")

    initial_count = len(df)

    # Strip strings and remove empty/null rows
    for col in required_cols:
        df[col] = df[col].astype(str).str.strip()

    df = df[(df["title"] != "") & (df["description"] != "") & (df["category"] != "")]
    df = df.dropna(subset=list(required_cols))

    dropped = initial_count - len(df)
    if dropped > 0:
        print(f"[DATASET] Dropped {dropped} empty/invalid records. Remaining: {len(df)}")

    if len(df) < 10:
        raise ValueError(f"Insufficient training records ({len(df)} records). Need at least 10 records.")

    # Check category distribution
    cat_counts = df["category"].value_counts()
    print("\n--- Category Distribution ---")
    for cat, count in cat_counts.items():
        print(f"  • {cat:<16}: {count} samples")
    print(f"Total categories: {len(cat_counts)} | Total samples: {len(df)}\n")

    return df


def build_pipeline() -> Pipeline:
    """
    Constructs a modular, CPU-friendly NLP classification pipeline.
    Combines n-gram TF-IDF vectorization with a balanced Logistic Regression classifier.
    """
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.98,
                sublinear_tf=True,
                strip_accents=None,
            ),
        ),
        (
            "classifier",
            LogisticRegression(
                C=2.0,
                max_iter=1000,
                class_weight="balanced",
                random_state=RANDOM_SEED,
                solver="lbfgs",
            ),
        ),
    ])


def train_and_evaluate(
    data_path: Path = DEFAULT_DATA_PATH,
    model_output_path: Path = DEFAULT_MODEL_PATH,
    test_size: float = 0.2,
) -> dict:
    """Full training and evaluation pipeline."""
    print("==========================================================")
    print("   Vishanti Petition ML Service — Model Training Script   ")
    print("==========================================================")
    print(f"Dataset:    {data_path}")
    print(f"Output:     {model_output_path}")
    print(f"Seed:       {RANDOM_SEED}")

    df = load_and_validate_data(data_path)

    # Prepare input texts: combine title + description and apply preprocessing
    print("[PREPROCESSING] Normalizing and combining problem titles and descriptions...")
    raw_texts = [combine_text(t, d) for t, d in zip(df["title"], df["description"])]
    clean_texts = [preprocess_text(txt) for txt in raw_texts]
    labels = df["category"].values

    # Determine if stratified split is feasible
    cat_counts = df["category"].value_counts()
    min_samples_per_class = cat_counts.min()

    use_stratify = False
    if min_samples_per_class >= 2 and len(df) >= 20:
        use_stratify = True

    if use_stratify:
        X_train, X_test, y_train, y_test = train_test_split(
            clean_texts,
            labels,
            test_size=test_size,
            random_state=RANDOM_SEED,
            stratify=labels,
        )
    else:
        print("[WARNING] Dataset too small for stratified splitting. Using unstratified split.")
        X_train, X_test, y_train, y_test = train_test_split(
            clean_texts,
            labels,
            test_size=test_size,
            random_state=RANDOM_SEED,
        )

    print(f"[SPLIT] Training set: {len(X_train)} samples | Test set: {len(X_test)} samples")

    # Fit pipeline on training set
    print("[TRAIN] Fitting TF-IDF Vectorizer and Logistic Regression classifier...")
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    # Evaluate on held-out test set
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)

    print("\n================== Evaluation Results ==================")
    print(f"Accuracy:           {acc * 100:.2f}%")
    print(f"Macro Precision:    {prec_macro:.4f}")
    print(f"Macro Recall:       {rec_macro:.4f}")
    print(f"Macro F1-Score:     {f1_macro:.4f}")
    print(f"Weighted F1-Score:  {f1_weighted:.4f}")
    print("========================================================\n")

    print("--- Detailed Classification Report ---")
    print(classification_report(y_test, y_pred, zero_division=0))

    # Confusion matrix
    classes = pipeline.classes_
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    print("--- Confusion Matrix (rows: true, cols: predicted) ---")
    print(f"Labels: {list(classes)}")
    print(cm)
    print("\n--------------------------------------------------------")

    # Train final pipeline on 100% of data to maximize coverage across all categories for production
    print("\n[REFIT] Retraining pipeline on full dataset (156 samples) for optimal inference coverage...")
    final_pipeline = build_pipeline()
    final_pipeline.fit(clean_texts, labels)

    # Prepare artifact
    model_output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "pipeline": final_pipeline,
        "classes": list(final_pipeline.classes_),
        "categories": sorted(list(set(labels))),
        "model_version": "1.0.0",
        "algorithm": "TF-IDF (1-2 ngrams) + LogisticRegression(C=2.0, balanced)",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_metrics": {
            "accuracy": round(float(acc), 4),
            "macro_precision": round(float(prec_macro), 4),
            "macro_recall": round(float(rec_macro), 4),
            "macro_f1": round(float(f1_macro), 4),
            "weighted_f1": round(float(f1_weighted), 4),
            "test_samples": int(len(X_test)),
            "train_samples": int(len(X_train)),
            "total_samples": int(len(clean_texts)),
        },
    }

    joblib.dump(artifact, model_output_path)
    file_size_kb = os.path.getsize(model_output_path) / 1024
    print(f"[SAVED] Trained model saved to: {model_output_path} ({file_size_kb:.1f} KB)")

    print("\n> [!IMPORTANT]")
    print("> Model Limitation: The model was evaluated on a synthetic representative dataset.")
    print("> While synthetic data verifies feature extraction, pipeline functionality, and")
    print("> category separation, real student submissions with unforeseen vocabulary")
    print("> and typos may yield lower confidence. Continuous manual verification is recommended.")

    return artifact


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Vishanti Petition Category Classifier")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH, help="Path to training CSV file")
    parser.add_argument("--output", type=Path, default=DEFAULT_MODEL_PATH, help="Path to save trained joblib model")
    args = parser.parse_args()

    train_and_evaluate(data_path=args.data, model_output_path=args.output)
