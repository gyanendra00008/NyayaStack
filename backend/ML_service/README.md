# Vishanti Petition ML Classification Service

A lightweight, CPU-friendly Machine Learning microservice built with **Python**, **FastAPI**, and **scikit-learn** to automatically categorize grievances and petitions for the **Vishanti Petition** (NyayaStack) platform.

The service accepts a problem's title and description, normalizes and combines the text, and predicts the most appropriate category among the 12 official platform categories using an n-gram TF-IDF vectorizer and a multiclass Logistic Regression classifier.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Supported Categories](#supported-categories)
- [Prerequisites & Python Version](#prerequisites--python-version)
- [Installation & Virtual Environment Setup](#installation--virtual-environment-setup)
- [Dataset Format & Expansion](#dataset-format--expansion)
- [Training & Model Evaluation](#training--model-evaluation)
- [Running the FastAPI Server](#running-the-fastapi-server)
- [API Endpoints Reference](#api-endpoints-reference)
  - [GET /](#get-)
  - [GET /health](#get-health)
  - [GET /categories](#get-categories)
  - [POST /predict](#post-predict)
  - [POST /predict/batch](#post-predictbatch)
- [Interactive Swagger UI](#interactive-swagger-ui)
- [Confidence Threshold & Uncertainty Flagging](#confidence-threshold--uncertainty-flagging)
- [Running Automated Tests](#running-automated-tests)
- [Integration With Express Backend](#integration-with-express-backend)
- [Environment Variables](#environment-variables)
- [Model Limitations & Honest Calibration](#model-limitations--honest-calibration)
- [Deployment Considerations](#deployment-considerations)

---

## Features

- **End-to-End NLP Pipeline**: Combines problem title and description, normalizes text (handling HTML tags, URLs, repeated spaces, punctuation, English, and Hinglish transliterations), vectorizes with word and bigram TF-IDF, and classifies with balanced multiclass Logistic Regression.
- **Full Platform Alignment**: Trains directly on the 12 grievance categories defined in the Vishanti Petition backend schema (`src/models/complaint.models.js`).
- **Probabilistic Ranking & Uncertainty Guard**: Returns top 3 candidate categories with confidence scores and automatically sets `needs_review: true` if confidence is below a configurable threshold.
- **Fast Startup & Thread-Safe Persistence**: Loads serialized model artifact once into memory at startup via FastAPI's `lifespan` handler. No retraining on requests.
- **Degraded Mode Resilience**: If the model artifact is absent or corrupted, the service starts safely, reports degraded health on `GET /health`, and returns clean HTTP 503 errors instructing the administrator to run `python train.py`.
- **Security & Input Validation**: Validates inputs with Pydantic v2 (title 3-200 chars, description 10-5000 chars, batch limit <= 50), suppresses sensitive grievance logs, and ensures no internal filesystem paths or stack traces are leaked to API clients.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Express Backend / Client  |
                      +--------------+--------------+
                                     | HTTP POST (JSON)
                                     v
+------------------------------------------------------------------------+
|                          FastAPI ML Microservice                       |
|                                                                        |
|  +--------------------+   +-------------------+   +-----------------+  |
|  | Pydantic Schemas   |-->| Text Normalizer   |-->| Model Manager   |  |
|  | Input Validation   |   | English + Hinglish|   | Inference Engine|  |
|  +--------------------+   +-------------------+   +--------+--------+  |
|                                                            |           |
|                                                            v           |
|                                                   +-----------------+  |
|                                                   | Scikit-learn    |  |
|                                                   | Pipeline        |  |
|                                                   | (TF-IDF + LogReg|  |
|                                                   +--------+--------+  |
|                                                            |           |
|                                                            v           |
|                                                   +-----------------+  |
|                                                   | Ranked Output & |  |
|                                                   | Threshold Check |  |
|                                                   +-----------------+  |
+------------------------------------------------------------------------+
```

---

## Directory Structure

```text
backend/ML_service/
├── .gitignore                     # Git ignore rules for virtualenvs, caches, artifacts
├── README.md                      # Comprehensive service documentation (this file)
├── requirements.txt               # Pinned Python package dependencies
├── main.py                        # FastAPI application entry point and route definitions
├── model.py                       # ModelManager, artifact loading, and inference logic
├── preprocess.py                  # Text cleaning, normalization, and combination helpers
├── schemas.py                     # Pydantic request/response validation schemas
├── train.py                       # Training script, evaluation reporting, and serialization
├── data/
│   └── training_data.csv          # Labeled training dataset (title, description, category)
├── models/
│   ├── .gitkeep                   # Keeps directory structure in git
│   └── category_classifier.joblib # Serialized model artifact generated by train.py
└── tests/
    ├── __init__.py                # Test package marker
    └── test_api.py                # 21 automated pytest test cases covering all requirements
```

---

## Supported Categories

Derived strictly from the official Vishanti Petition schema (`src/models/complaint.models.js`):

1. `Academic` (Lectures, syllabus, exams, grading, lab equipment, course registration)
2. `Administration` (ID cards, bonafide letters, certificates, document verification)
3. `Discipline` (Misconduct, fighting, vandalism, exam cheating, unauthorized substances)
4. `Finance` (Tuition fees, scholarship disbursement, payment gateway issues, refunds)
5. `Harassment` (Bullying, stalking, intimidation, cyber harassment, verbal abuse)
6. `Hostel` (Rooms, geysers, fans, furniture, room allotment, hostel maintenance)
7. `Infrastructure` (Air conditioners, Wi-Fi, classroom projectors, road potholes, lighting)
8. `Medical` (Health center, ambulance, medicines, doctors, emergency first aid)
9. `Mess` (Food hygiene, cold/raw food, insects, kitchen cleanliness, mess schedule)
10. `Other` (Lost and found, gym timings, fest inquiries, general campus queries)
11. `Ragging` (Senior coercion, abusive late-night tasks, anti-ragging squad issues)
12. `Transport` (College buses, shuttle timings, bus pass renewal, driver behavior)

---

## Prerequisites & Python Version

- **Python**: Version 3.10 to 3.14 (Tested on Python 3.14)
- **Package Manager**: `pip`

---

## Installation & Virtual Environment Setup

From the `backend/ML_service/` directory:

```bash
# 1. Create a Python virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
# On Linux / macOS:
source .venv/bin/activate
# On Windows (Command Prompt):
# .venv\Scripts\activate.bat
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Dataset Format & Expansion

The training dataset is located at `backend/ML_service/data/training_data.csv`.

### CSV Columns

| Column | Type | Description |
| :--- | :--- | :--- |
| `title` | String | Short title of the problem |
| `description` | String | Detailed grievance description |
| `category` | String | One of the 12 supported platform categories |

### Synthetic Data Disclosure

> [!NOTE]
> The initial training dataset contains **synthetic representative examples** designed to model authentic college grievances in English and Hinglish. It does **not** contain real user submissions or personal identifiers.
> 
> Synthetic data provides a functional baseline for feature extraction and pipeline verification. It should **not** be considered equivalent to a large production dataset.

### Adding New Labeled Examples

To expand the dataset with verified examples:

1. Open `data/training_data.csv`.
2. Append new rows following standard CSV formatting:
   ```csv
   "Hostel geyser not heating","Water in bathroom B is freezing cold and geyser switch trips.","Hostel"
   ```
3. Ensure the category spelling matches one of the 12 supported categories exactly.
4. Retrain the model:
   ```bash
   python train.py
   ```

---

## Training & Model Evaluation

Execute the training script from `backend/ML_service/`:

```bash
python train.py
```

### What `train.py` Does:

1. **Loads and Validates**: Reads `data/training_data.csv`, strips whitespace, drops invalid/empty rows, and validates required columns.
2. **Category Distribution**: Verifies class balance across all 12 categories.
3. **Train-Test Split**: Performs a stratified 80/20 train-test split (`random_state=42`).
4. **Pipeline Fit**: Trains an n-gram TF-IDF vectorizer (`ngram_range=(1, 2)`) alongside a balanced Logistic Regression classifier.
5. **Evaluation**: Evaluates the model on the held-out test split, reporting:
   - Overall Accuracy
   - Macro & Weighted Precision, Recall, and F1-Score
   - Per-class classification report
   - Full confusion matrix
6. **Full Refit & Serialization**: Trains the pipeline on the full dataset for maximum vocabulary coverage and serializes the artifact dictionary to `models/category_classifier.joblib`.

### Example Training Output:

```text
================== Evaluation Results ==================
Accuracy:           78.12%
Macro Precision:    0.8486
Macro Recall:       0.7917
Macro F1-Score:     0.7843
Weighted F1-Score:  0.7740
========================================================
[SAVED] Trained model saved to: .../models/category_classifier.joblib (521.4 KB)
```

---

## Running the FastAPI Server

Start the server using `uvicorn`:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Or run directly with Python:

```bash
python main.py
```

Output:
```text
INFO:     Started server process
[INFO] vishanti_ml_service: Initializing Vishanti Petition ML Service...
[MODEL_MANAGER] Model successfully loaded (12 categories)
[INFO] vishanti_ml_service: Classification model ready. Categories: 12
INFO:     Uvicorn running on http://127.0.0.1:8001
```

---

## API Endpoints Reference

### Base URL: `http://127.0.0.1:8001`

### GET `/`
Returns basic service identity and running state.

**Response (`200 OK`):**
```json
{
  "service": "Vishanti Petition ML Service",
  "status": "running"
}
```

---

### GET `/health`
Returns system health, model loading status, number of supported categories, and the active confidence threshold.

**Response (`200 OK` - Healthy):**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "1.0.0",
  "supported_categories_count": 12,
  "confidence_threshold": 0.45
}
```

**Response (`200 OK` - Degraded):**
```json
{
  "status": "degraded",
  "model_loaded": false,
  "model_version": null,
  "supported_categories_count": 0,
  "confidence_threshold": 0.45
}
```

---

### GET `/categories`
Returns the list of categories supported by the active model.

**Response (`200 OK`):**
```json
{
  "categories": [
    "Academic",
    "Administration",
    "Discipline",
    "Finance",
    "Harassment",
    "Hostel",
    "Infrastructure",
    "Medical",
    "Mess",
    "Other",
    "Ragging",
    "Transport"
  ]
}
```

---

### POST `/predict`
Main classification endpoint. Classifies a single grievance problem based on its title and description.

**Request Body:**
```json
{
  "title": "Frequent water shortage in residential block",
  "description": "Residents are not receiving a regular water supply in the hostel bathroom."
}
```

**Response (`200 OK` - Confident):**
```json
{
  "predicted_category": "Hostel",
  "confidence": 0.62,
  "top_predictions": [
    {
      "category": "Hostel",
      "confidence": 0.62
    },
    {
      "category": "Infrastructure",
      "confidence": 0.14
    },
    {
      "category": "Mess",
      "confidence": 0.08
    }
  ],
  "needs_review": false,
  "message": null
}
```

**Response (`200 OK` - Uncertain):**
```json
{
  "predicted_category": "Infrastructure",
  "confidence": 0.28,
  "top_predictions": [
    {
      "category": "Infrastructure",
      "confidence": 0.28
    },
    {
      "category": "Hostel",
      "confidence": 0.19
    },
    {
      "category": "Academic",
      "confidence": 0.11
    }
  ],
  "needs_review": true,
  "message": "The model is uncertain about this classification."
}
```

---

### POST `/predict/batch`
Batch classification endpoint. Accepts up to 50 items per request.

**Request Body:**
```json
{
  "items": [
    {
      "title": "College bus arriving late every day",
      "description": "Route 5 bus consistently arrives 45 minutes late and students miss lectures."
    },
    {
      "title": "Tuition fees debited without receipt",
      "description": "Rs 45000 deducted from bank account but the portal still shows tuition fee unpaid."
    }
  ]
}
```

**Response (`200 OK`):**
```json
{
  "total": 2,
  "predictions": [
    {
      "predicted_category": "Transport",
      "confidence": 0.41,
      "top_predictions": [
        { "category": "Transport", "confidence": 0.41 },
        { "category": "Discipline", "confidence": 0.06 },
        { "category": "Ragging", "confidence": 0.06 }
      ],
      "needs_review": true,
      "message": "The model is uncertain about this classification."
    },
    {
      "predicted_category": "Finance",
      "confidence": 0.38,
      "top_predictions": [
        { "category": "Finance", "confidence": 0.38 },
        { "category": "Academic", "confidence": 0.07 },
        { "category": "Administration", "confidence": 0.06 }
      ],
      "needs_review": true,
      "message": "The model is uncertain about this classification."
    }
  ]
}
```

---

## Interactive Swagger UI

FastAPI generates automatic interactive OpenAPI documentation.

Once the service is running, navigate to:

- **Swagger UI**: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)
- **ReDoc UI**: [http://127.0.0.1:8001/redoc](http://127.0.0.1:8001/redoc)
- **OpenAPI JSON**: [http://127.0.0.1:8001/openapi.json](http://127.0.0.1:8001/openapi.json)

---

## Confidence Threshold & Uncertainty Flagging

A high model score does not guarantee correctness, especially for rare edge cases or out-of-vocabulary inputs.

- The threshold is governed by the `CONFIDENCE_THRESHOLD` environment variable (defaults to `0.45`).
- In a 12-class scenario where the random uniform baseline probability is ~`0.083` (`1/12`), a prediction with confidence `< CONFIDENCE_THRESHOLD` is flagged:
  - `needs_review: true`
  - `message: "The model is uncertain about this classification."`
- **Application Behavior**: The existing Express backend or frontend should **never reject** a user's petition due to uncertainty. Instead, present the predicted category as an optional suggestion that the user or reviewer can confirm or change.

---

## Running Automated Tests

Run the comprehensive test suite with `pytest`:

```bash
# Run tests with verbose output
pytest tests/ -v
```

All 21 test scenarios verify:
1. Root service status (`GET /`)
2. Healthy system state (`GET /health`)
3. Model categories alignment (`GET /categories`)
4. Accurate predictions for Hostel, Mess, Transport, and Finance
5. Validation: Empty or short titles (< 3 chars) -> `422`
6. Validation: Empty or short descriptions (< 10 chars) -> `422`
7. Validation: Whitespace-only fields -> `422`
8. Validation: Malformed JSON or invalid types -> `422`
9. Graceful fallback on missing model artifact -> `503 Service Unavailable`
10. Ambiguous text triggering `needs_review: true`
11. Batch prediction success, empty batch rejection, and batch limit rejection (> 50 items)
12. Preprocessing text cleaning, noise removal, and Hinglish token preservation

---

## Integration With Express Backend

The existing Vishanti Petition Node.js / Express backend can easily call this microservice.

### Node.js Integration Example (Native fetch in Node 18+)

```javascript
/**
 * Calls the Vishanti Petition ML classification service to suggest a problem category.
 * @param {string} title - Problem title
 * @param {string} description - Detailed problem description
 * @returns {Promise<{ predictedCategory: string, confidence: number, needsReview: boolean } | null>}
 */
async function predictComplaintCategory(title, description) {
  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8001";

  try {
    const response = await fetch(`${mlServiceUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!response.ok) {
      console.warn(`ML service returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      predictedCategory: data.predicted_category,
      confidence: data.confidence,
      topPredictions: data.top_predictions,
      needsReview: data.needs_review,
    };
  } catch (error) {
    console.error("Failed to reach ML classification service:", error.message);
    return null; // Graceful fallback: user selects category manually
  }
}

module.exports = { predictComplaintCategory };
```

---

## Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `HOST` | String | `127.0.0.1` | Host address to bind the Uvicorn server |
| `PORT` | Number | `8001` | Port number for the FastAPI ML service |
| `CONFIDENCE_THRESHOLD` | Float | `0.45` | Probability threshold below which `needs_review` is set to `true` |
| `MODEL_PATH` | String | `models/category_classifier.joblib` | Absolute or relative path to the serialized model file |
| `CORS_ORIGINS` | String | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed CORS origins |

---

## Model Limitations & Honest Calibration

- **Synthetic Training Data**: The initial model was trained on 156 synthetic examples across 12 categories. While synthetic data models common grievance themes well, real student inputs contain unseen vocabulary, abbreviations, regional slang, and complex grammar errors.
- **Probability Calibration**: Logistic Regression with balanced class weights provides useful comparative rankings, but absolute probabilities on small datasets should not be interpreted as exact calibrated error bounds.
- **Human-in-the-Loop**: Machine Learning is an assistant, not an arbiter. Always provide users and administrators the ability to manually adjust or override predicted categories.

---

## Deployment Considerations

1. **Model Serialization**: The model artifact `category_classifier.joblib` is ~520 KB. It can either be checked into git or generated deterministically during CI/CD builds via `python train.py`.
2. **Resource Usage**: The CPU footprint is minimal (< 60 MB RAM). No GPU or heavyweight deep-learning frameworks (e.g., PyTorch, TensorFlow) are required.
3. **Containerization**: Easily containerized with a lightweight `python:3.11-slim` or `python:3.12-slim` Docker image exposing port `8001`.
4. **Decoupled Architecture**: The service does not connect directly to MongoDB. The Node.js Express backend remains the sole custodian of the database, ensuring strict separation of concerns.
