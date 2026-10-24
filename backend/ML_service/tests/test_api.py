"""
Automated Test Suite for Vishanti Petition ML Classification Service.

Tests cover:
1. Health endpoint (healthy & degraded states)
2. Categories endpoint (with model & without model)
3. Valid single prediction requests (Hostel, Mess, Transport, Finance)
4. Empty and short title validation (422)
5. Empty and short description validation (422)
6. Whitespace-only input validation (422)
7. Invalid request payloads and types (422)
8. Missing model artifact error handling (503)
9. Low-confidence uncertain prediction handling (needs_review flag)
10. Model loading failure and unload recovery
11. Batch prediction success, empty batch, and batch limit validation (422)
12. Preprocessing normalization and Hinglish preservation
"""

from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure ML_service is in sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from main import app
from model import model_manager, ModelNotLoadedError
from preprocess import combine_text, preprocess_text


@pytest.fixture(scope="session", autouse=True)
def ensure_model_is_trained():
    """Ensures a model artifact exists before running tests."""
    model_path = SERVICE_DIR / "models" / "category_classifier.joblib"
    if not model_path.exists():
        from train import train_and_evaluate
        train_and_evaluate(
            data_path=SERVICE_DIR / "data" / "training_data.csv",
            model_output_path=model_path,
        )
    # Ensure loaded
    model_manager.load_model(model_path)


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        # Re-ensure model is loaded in the global model_manager
        model_manager.load_model()
        yield test_client


# --- 1. Service Info & Health Endpoints ---

def test_root_endpoint(client):
    """GET / returns service identifier and operational status."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Vishanti Petition ML Service"
    assert data["status"] == "running"


def test_health_endpoint_healthy(client):
    """GET /health reports healthy status and loaded model details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["supported_categories_count"] == 12
    assert "confidence_threshold" in data


# --- 2. Categories Endpoint ---

def test_categories_endpoint(client):
    """GET /categories returns all 12 supported project categories."""
    response = client.get("/categories")
    assert response.status_code == 200
    data = response.json()
    categories = data["categories"]
    assert len(categories) == 12
    expected = [
        "Academic", "Administration", "Discipline", "Finance",
        "Harassment", "Hostel", "Infrastructure", "Medical",
        "Mess", "Other", "Ragging", "Transport"
    ]
    for cat in expected:
        assert cat in categories


# --- 3. Valid Prediction Requests ---

def test_predict_hostel_issue(client):
    """POST /predict correctly predicts 'Hostel' category for room/geyser problems."""
    payload = {
        "title": "Frequent water shortage in hostel bathroom",
        "description": "Hot water is not available in the hostel bathrooms for 3 days and the geyser is broken.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_category"] == "Hostel"
    assert data["confidence"] > 0.0
    assert len(data["top_predictions"]) >= 1
    assert data["top_predictions"][0]["category"] == "Hostel"
    assert isinstance(data["needs_review"], bool)


def test_predict_mess_issue(client):
    """POST /predict correctly predicts 'Mess' category for unhygienic food."""
    payload = {
        "title": "Dead insect found in dinner meal",
        "description": "Cockroach found in the dinner dal and rotis were completely raw and cold.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_category"] == "Mess"
    assert data["confidence"] > 0.15


def test_predict_transport_issue(client):
    """POST /predict correctly predicts 'Transport' category for bus delay."""
    payload = {
        "title": "College bus arriving late every day",
        "description": "Route 5 bus consistently arrives 45 minutes late and students miss their first morning lecture.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_category"] == "Transport"


def test_predict_finance_issue(client):
    """POST /predict correctly predicts 'Finance' category for fee deductions."""
    payload = {
        "title": "Semester fee debited without receipt",
        "description": "Rs 45000 deducted from my bank account but the college portal still shows tuition fee unpaid.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_category"] == "Finance"


# --- 4. Input Validation (Title & Description) ---

def test_predict_empty_title(client):
    """POST /predict returns 422 if title is empty."""
    payload = {
        "title": "",
        "description": "Valid description with sufficient length to pass the threshold.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_short_title(client):
    """POST /predict returns 422 if title is shorter than 3 characters."""
    payload = {
        "title": "ab",
        "description": "Valid description with sufficient length to pass the threshold.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_empty_description(client):
    """POST /predict returns 422 if description is empty."""
    payload = {
        "title": "Valid Problem Title",
        "description": "",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_short_description(client):
    """POST /predict returns 422 if description is shorter than 10 characters."""
    payload = {
        "title": "Valid Problem Title",
        "description": "Too short",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_whitespace_only_title(client):
    """POST /predict returns 422 if title is only whitespace."""
    payload = {
        "title": "     ",
        "description": "Valid description with sufficient length to pass the threshold.",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_whitespace_only_description(client):
    """POST /predict returns 422 if description is only whitespace."""
    payload = {
        "title": "Valid Problem Title",
        "description": "          ",
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_missing_payload_fields(client):
    """POST /predict returns 422 if fields are missing."""
    response = client.post("/predict", json={})
    assert response.status_code == 422


def test_predict_invalid_data_types(client):
    """POST /predict returns 422 if fields are non-string types."""
    payload = {
        "title": 12345,
        "description": ["array", "of", "strings"],
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


# --- 5. Confidence Threshold & Uncertainty ---

def test_uncertain_prediction_flag(client):
    """Predictions with ambiguous or minimal domain keywords trigger uncertainty flag."""
    # Use vague wording that doesn't strongly activate any category
    payload = {
        "title": "General matter",
        "description": "Something happened recently and I would like to note it down for future reference.",
    }
    # Set high threshold to deliberately trigger review flag
    orig_thresh = model_manager.confidence_threshold
    try:
        model_manager.confidence_threshold = 0.95
        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["needs_review"] is True
        assert data["message"] == "The model is uncertain about this classification."
    finally:
        model_manager.confidence_threshold = orig_thresh


# --- 6. Missing Model / Degraded State Handling ---

def test_missing_model_behavior(client):
    """When the model is not loaded, predict returns 503 and health returns degraded."""
    try:
        model_manager.unload_model()

        # Health should show degraded
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["status"] == "degraded"
        assert health_data["model_loaded"] is False

        # Categories should return 503
        cat_resp = client.get("/categories")
        assert cat_resp.status_code == 503
        assert "remedy" in cat_resp.json()

        # Predict should return 503
        pred_resp = client.post(
            "/predict",
            json={"title": "Test Title", "description": "Test description of adequate length."},
        )
        assert pred_resp.status_code == 503
        assert "remedy" in pred_resp.json()

    finally:
        # Restore loaded model
        model_manager.load_model()


# --- 7. Batch Predictions ---

def test_batch_prediction_success(client):
    """POST /predict/batch processes multiple grievance inputs."""
    payload = {
        "items": [
            {
                "title": "Hostel room fan not working",
                "description": "The ceiling fan in room 204 hostel 3 has stopped working completely.",
            },
            {
                "title": "Raw food served in mess",
                "description": "Mess chapatis are uncooked and cold dinner was served to all students.",
            },
            {
                "title": "Bus pass renewal counter locked",
                "description": "The college bus transport pass counter has remained locked for three days.",
            },
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["predictions"]) == 3
    assert data["predictions"][0]["predicted_category"] == "Hostel"
    assert data["predictions"][1]["predicted_category"] == "Mess"
    assert data["predictions"][2]["predicted_category"] == "Transport"


def test_batch_prediction_empty_list(client):
    """POST /predict/batch rejects an empty list with 422."""
    payload = {"items": []}
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 422


def test_batch_prediction_exceeds_max_limit(client):
    """POST /predict/batch rejects batches exceeding 50 items with 422."""
    payload = {
        "items": [
            {
                "title": f"Test problem number {i}",
                "description": f"Detailed description for problem number {i} with sufficient length.",
            }
            for i in range(51)
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 422


# --- 8. Preprocessing Unit Tests ---

def test_preprocessing_combines_and_cleans():
    """Validates combine_text and preprocess_text on noisy, Hinglish input."""
    title = "  Hostel <p>paani</p> problem!!  "
    desc = "Subah se http://test.com taps me paani nahi aa raha hai.\nBahut dikkat hai.  "

    combined = combine_text(title, desc)
    cleaned = preprocess_text(combined)

    assert "hostel" in cleaned
    assert "paani" in cleaned
    assert "nahi" in cleaned
    assert "<p>" not in cleaned
    assert "http" not in cleaned
    assert "!!" not in cleaned
    assert "\n" not in cleaned
    # Ensure no multiple consecutive spaces
    assert "  " not in cleaned
