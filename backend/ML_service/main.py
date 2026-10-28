"""
FastAPI Application Entry Point for Vishanti Petition ML Service.

Exposes problem category classification, health monitoring, category querying,
and batch inference endpoints.
"""

from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import sys
from typing import List

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure ML_service directory is on sys.path so local imports work from anywhere
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Load .env file if present in service directory
env_file = CURRENT_DIR / ".env"
if env_file.is_file():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip("'\""))
    except Exception:
        pass

try:
    from model import ModelNotLoadedError, model_manager
    from schemas import (
        BatchPredictRequest,
        BatchPredictResponse,
        CategoriesResponse,
        HealthResponse,
        PredictRequest,
        PredictResponse,
        ServiceInfoResponse,
    )
except ImportError:
    from ML_service.model import ModelNotLoadedError, model_manager
    from ML_service.schemas import (
        BatchPredictRequest,
        BatchPredictResponse,
        CategoriesResponse,
        HealthResponse,
        PredictRequest,
        PredictResponse,
        ServiceInfoResponse,
    )

# Configure structured logging (suppresses sensitive user grievance payloads)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vishanti_ml_service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
    Loads the serialized classification model artifact into memory on server startup.
    """
    logger.info("Initializing Vishanti Petition ML Service...")
    loaded = model_manager.load_model()
    if loaded:
        logger.info(
            "Classification model ready. Categories: %s",
            len(model_manager.get_categories()),
        )
    else:
        logger.warning(
            "Model artifact not found at %s. Service will run in degraded mode. "
            "Please execute 'python train.py' to generate the model artifact.",
            model_manager.model_path,
        )
    yield
    logger.info("Shutting down Vishanti Petition ML Service.")


app = FastAPI(
    title="Vishanti Petition Problem Category Classification Service",
    description=(
        "Machine Learning classification microservice for Vishanti Petition / NyayaStack. "
        "Predicts the appropriate grievance category using NLP (TF-IDF + Logistic Regression) "
        "trained on project categories."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
allowed_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(ModelNotLoadedError)
async def model_not_loaded_handler(request: Request, exc: ModelNotLoadedError):
    """Returns 503 Service Unavailable when inference is attempted without a trained model."""
    logger.warning("Inference attempted while model unavailable: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": str(exc),
            "remedy": "Execute 'python train.py' in the ML_service directory to train and serialize the model.",
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Returns clean 422 validation response without internal python path exposure."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(p) for p in err.get("loc", []))
        errors.append({
            "field": loc,
            "message": err.get("msg", "Invalid field value"),
            "type": err.get("type", "value_error"),
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": errors},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Centralized safety net: blocks leak of internal file paths or stack traces."""
    logger.error("Unhandled service exception: %s", exc, exc_info=False)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal server error occurred."},
    )


# Endpoints
@app.get(
    "/",
    response_model=ServiceInfoResponse,
    summary="Service Information",
    tags=["General"],
)
async def root():
    """Returns basic service identifier and running state."""
    return ServiceInfoResponse(
        service="Vishanti Petition ML Service",
        status="running",
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    tags=["Monitoring"],
)
async def health():
    """
    Returns service health and model availability.
    Reports 'healthy' when the model is in memory, or 'degraded' if the model has not been trained.
    """
    is_ready = model_manager.is_loaded
    categories_count = len(model_manager.get_categories()) if is_ready else 0
    metadata = model_manager.get_metadata() if is_ready else {}

    return HealthResponse(
        status="healthy" if is_ready else "degraded",
        model_loaded=is_ready,
        model_version=metadata.get("model_version"),
        supported_categories_count=categories_count,
        confidence_threshold=model_manager.confidence_threshold,
    )


@app.get(
    "/categories",
    response_model=CategoriesResponse,
    summary="Supported Problem Categories",
    tags=["Classification"],
)
async def get_categories():
    """
    Returns the distinct problem categories supported by the active classification model.
    """
    if not model_manager.is_loaded:
        raise ModelNotLoadedError(
            "Model is not loaded. Train the model using 'python train.py' before querying categories."
        )
    return CategoriesResponse(categories=model_manager.get_categories())


@app.post(
    "/predict",
    response_model=PredictResponse,
    summary="Predict Problem Category",
    tags=["Classification"],
)
async def predict_category(request_data: PredictRequest):
    """
    Main classification endpoint.
    Accepts problem title and description, and predicts the category with confidence scores.
    If the predicted confidence is below the configured threshold, 'needs_review' will be True.
    """
    return model_manager.predict(
        title=request_data.title,
        description=request_data.description,
    )


@app.post(
    "/predict/batch",
    response_model=BatchPredictResponse,
    summary="Batch Problem Category Prediction",
    tags=["Classification"],
)
async def predict_categories_batch(request_data: BatchPredictRequest):
    """
    Batch classification endpoint.
    Processes up to 50 problem items in a single request.
    """
    return model_manager.predict_batch(items=request_data.items)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8001"))
    logger.info("Starting Vishanti Petition ML Service on http://%s:%s", host, port)
    uvicorn.run("main:app", host=host, port=port, reload=True)
