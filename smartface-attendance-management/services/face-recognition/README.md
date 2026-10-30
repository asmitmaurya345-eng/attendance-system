# SmartFace Phase 2 Face Recognition Microservice

This microservice handles biometric vector extraction and facial recognition for the SmartFace enterprise platform.

## Architecture

- **Framework**: FastAPI (Asynchronous Python 3.10+)
- **Embedding Format**: 512-dimensional L2-normalized float vectors (`||v|| = 1.0`)
- **Matching Metric**: Cosine similarity ($\cos(\theta) = \frac{A \cdot B}{\|A\| \|B\|}$)
- **Default Confidence Threshold**: `0.85`

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Heartbeat & model architecture readiness probe |
| `POST` | `/api/v1/extract-embedding` | Extracts 512-d normalized face vector, bounding box & quality score |
| `POST` | `/api/v1/recognize` | Compares query face against candidate gallery vectors |
| `POST` | `/api/v1/compare` | Verifies cosine similarity between two 512-d vectors |
| `GET` | `/docs` | Interactive Swagger UI API documentation |

## Local Development & Setup

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Microservice**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **Connecting with SmartFace**:
   Once the Python service is running, update your SmartFace environment configuration:
   ```bash
   RECOGNITION_SERVICE_URL="http://localhost:8000"
   ```

## Production Deep Learning Integration

To swap the scaffold embedding generator with full deep learning inference:
- **InsightFace / ArcFace**: Install `insightface` and `onnxruntime`, load `buffalo_l` or `antelopev2` models.
- **DeepFace**: Load `Facenet512` model: `DeepFace.represent(img, model_name='Facenet512')`.
- **Triton Inference Server**: Forward vector extraction to an ONNX runtime GPU worker.
