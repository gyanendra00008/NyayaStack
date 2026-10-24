"""
Pydantic Request and Response Schemas for Vishanti Petition ML Service.
"""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ServiceInfoResponse(BaseModel):
    service: str = Field(default="Vishanti Petition ML Service", description="Service name")
    status: str = Field(default="running", description="Operational status")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health state: 'healthy' or 'degraded'")
    model_loaded: bool = Field(..., description="Whether the classification model is loaded in memory")
    model_version: Optional[str] = Field(None, description="Trained model version")
    supported_categories_count: int = Field(0, description="Total number of categories supported")
    confidence_threshold: float = Field(..., description="Configured confidence threshold for certainty")


class CategoriesResponse(BaseModel):
    categories: List[str] = Field(..., description="List of problem categories supported by the service")


class PredictRequest(BaseModel):
    title: str = Field(
        ...,
        min_length=3,
        max_length=200,
        description="Short problem title (3-200 characters)",
        examples=["Frequent water shortage in residential block"]
    )
    description: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Detailed problem description (10-5000 characters)",
        examples=["Residents are experiencing a severe shortage of drinking water. Water supply is irregular."]
    )

    @field_validator("title")
    @classmethod
    def validate_title_non_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 3:
            raise ValueError("Title must contain at least 3 non-whitespace characters")
        return trimmed

    @field_validator("description")
    @classmethod
    def validate_description_non_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 10:
            raise ValueError("Description must contain at least 10 non-whitespace characters")
        return trimmed


class CategoryPrediction(BaseModel):
    category: str = Field(..., description="Problem category name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence score between 0 and 1")


class PredictResponse(BaseModel):
    predicted_category: str = Field(..., description="Highest-scoring predicted category")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score for the predicted category")
    top_predictions: List[CategoryPrediction] = Field(
        default_factory=list,
        description="Top ranked candidate categories with their respective confidences"
    )
    needs_review: bool = Field(
        default=False,
        description="Indicates whether the prediction confidence is below the configured threshold"
    )
    message: Optional[str] = Field(
        default=None,
        description="Explanatory message if confidence is low or special review is recommended"
    )


class BatchPredictRequest(BaseModel):
    items: List[PredictRequest] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of problem title-description items to classify (maximum 50 items per batch)"
    )


class BatchPredictResponse(BaseModel):
    total: int = Field(..., description="Total number of items processed")
    predictions: List[PredictResponse] = Field(..., description="List of prediction results corresponding to input items")
