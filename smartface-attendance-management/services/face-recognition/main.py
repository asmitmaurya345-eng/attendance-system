"""
SmartFace Phase 2 Face Recognition Microservice
FastAPI implementation adhering to the SmartFace Recognition Gateway API contracts.
Provides:
  - /health : Microservice heartbeat and model status
  - /api/v1/extract-embedding : Extracts 512-dim L2-normalized face vector & bounding box
  - /api/v1/recognize : Vector comparison against candidate galleries
  - /api/v1/compare : Cosine similarity verification between two face vectors
"""

import hashlib
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

app = FastAPI(
    title="SmartFace Face Recognition Microservice",
    version="2.0.0-phase2-scaffold",
    description="Vector extraction and cosine similarity matching service for enterprise biometric attendance.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for internal gateway requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Data Models (OpenAPI Contracts)
# -----------------------------------------------------------------------------

class BoundingBox(BaseModel):
    x: int = Field(..., description="Top-left X coordinate of face in pixels")
    y: int = Field(..., description="Top-left Y coordinate of face in pixels")
    width: int = Field(..., description="Face width in pixels")
    height: int = Field(..., description="Face height in pixels")


class ExtractEmbeddingRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG image")
    image_url: Optional[str] = Field(None, description="Direct URL to staged image")
    person_id: Optional[str] = Field(None, description="Optional associated person badge ID")


class ExtractEmbeddingResponse(BaseModel):
    vector_id: str
    dimension: int = 512
    embedding: List[float]
    bounding_box: BoundingBox
    quality_score: float = Field(..., ge=0.0, le=100.0)
    processing_ms: float


class CandidateTemplate(BaseModel):
    person_id: str
    embedding: List[float]


class RecognizeRequest(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    candidates: List[CandidateTemplate] = Field(default_factory=list)
    confidence_threshold: float = Field(default=0.85, ge=0.0, le=1.0)


class RecognizeResponse(BaseModel):
    matched: bool
    person_id: Optional[str] = None
    confidence_score: float
    confidence_threshold: float
    bounding_box: Optional[BoundingBox] = None
    is_unknown: bool
    matches_evaluated: int
    processing_ms: float


class CompareRequest(BaseModel):
    source_embedding: List[float]
    target_embedding: List[float]
    confidence_threshold: float = Field(default=0.85, ge=0.0, le=1.0)


class CompareResponse(BaseModel):
    similarity_score: float
    is_match: bool
    confidence_threshold: float
    distance_metric: str = "cosine"


# -----------------------------------------------------------------------------
# Math & Vector Utility Functions
# -----------------------------------------------------------------------------

def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Computes cosine similarity between two 512-d float vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    similarity = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, similarity))


def generate_scaffold_vector(seed_str: str) -> List[float]:
    """
    Generates a deterministic, L2-normalized 512-dimensional embedding
    from seed string/content. Ready to be replaced by ArcFace/DeepFace model inference.
    """
    hasher = hashlib.sha512(seed_str.encode("utf-8")).digest()
    # Repeat hash bytes to populate 512 dimensions
    raw_vals = [float((hasher[i % len(hasher)] ^ ((i * 17) & 0xFF)) - 128) for i in range(512)]
    arr = np.array(raw_vals, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return [float(x) for x in arr]


# -----------------------------------------------------------------------------
# REST Endpoints
# -----------------------------------------------------------------------------

@app.get("/health", tags=["Telemetry"])
def health_check() -> Dict[str, Any]:
    """Heartbeat endpoint for gateway health verification."""
    return {
        "status": "healthy",
        "service": "smartface-face-recognition",
        "version": "2.0.0-phase2-scaffold",
        "architecture": "FaceNet-512 / ArcFace Normalized",
        "vector_dimension": 512,
        "device": "CPU",
        "ready": True,
        "note": "Scaffold ready for live deep learning model weights injection.",
    }


@app.post("/api/v1/extract-embedding", response_model=ExtractEmbeddingResponse, tags=["Biometrics"])
def extract_embedding(request: ExtractEmbeddingRequest) -> ExtractEmbeddingResponse:
    """Extracts a 512-d normalized face vector and quality score from an input image."""
    start_time = time.time()

    if not request.image_base64 and not request.image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either image_base64 or image_url must be provided.",
        )

    seed = request.image_base64[:120] if request.image_base64 else (request.image_url or "seed")
    if request.person_id:
        seed = f"{request.person_id}_{seed}"

    embedding = generate_scaffold_vector(seed)
    vector_id = f"vec_{hashlib.sha256(seed.encode()).hexdigest()[:16]}"
    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return ExtractEmbeddingResponse(
        vector_id=vector_id,
        dimension=512,
        embedding=embedding,
        bounding_box=BoundingBox(x=120, y=80, width=240, height=260),
        quality_score=94.5,
        processing_ms=elapsed_ms,
    )


@app.post("/api/v1/recognize", response_model=RecognizeResponse, tags=["Biometrics"])
def recognize_face(request: RecognizeRequest) -> RecognizeResponse:
    """Compares the query face image against registered candidate vectors and returns top match."""
    start_time = time.time()

    if not request.image_base64 and not request.image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either image_base64 or image_url must be provided.",
        )

    seed = request.image_base64[:120] if request.image_base64 else (request.image_url or "seed")
    query_vector = generate_scaffold_vector(seed)

    best_match: Optional[str] = None
    best_score = 0.0

    for cand in request.candidates:
        score = compute_cosine_similarity(query_vector, cand.embedding)
        if score > best_score:
            best_score = score
            best_match = cand.person_id

    matched = best_score >= request.confidence_threshold
    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return RecognizeResponse(
        matched=matched,
        person_id=best_match if matched else None,
        confidence_score=round(best_score, 4),
        confidence_threshold=request.confidence_threshold,
        bounding_box=BoundingBox(x=110, y=75, width=250, height=255),
        is_unknown=not matched,
        matches_evaluated=len(request.candidates),
        processing_ms=elapsed_ms,
    )


@app.post("/api/v1/compare", response_model=CompareResponse, tags=["Biometrics"])
def compare_embeddings(request: CompareRequest) -> CompareResponse:
    """Verifies similarity between two pre-extracted face vectors."""
    if len(request.source_embedding) != 512 or len(request.target_embedding) != 512:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Embeddings must have exactly 512 dimensions.",
        )

    similarity = compute_cosine_similarity(request.source_embedding, request.target_embedding)
    is_match = similarity >= request.confidence_threshold

    return CompareResponse(
        similarity_score=round(similarity, 4),
        is_match=is_match,
        confidence_threshold=request.confidence_threshold,
        distance_metric="cosine",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
