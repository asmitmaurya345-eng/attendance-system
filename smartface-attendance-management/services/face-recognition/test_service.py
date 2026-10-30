"""
Unit and Contract Verification Tests for Python Face Recognition Microservice
Verifies /health, /api/v1/extract-embedding, /api/v1/compare, and /api/v1/recognize.
"""

import sys
import unittest
from main import app, compute_cosine_similarity, generate_scaffold_vector

try:
    from fastapi.testclient import TestClient
    client = TestClient(app)
except ImportError:
    client = None


class TestFaceRecognitionService(unittest.TestCase):
    def test_vector_normalization(self):
        """Vector must have exactly 512 dimensions and L2 norm close to 1.0."""
        vec = generate_scaffold_vector("test_seed_person_1001")
        self.assertEqual(len(vec), 512)
        norm = sum(x * x for x in vec) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_cosine_similarity_identity(self):
        """Identical vectors must yield cosine similarity 1.0."""
        vec = generate_scaffold_vector("test_seed_person_1001")
        sim = compute_cosine_similarity(vec, vec)
        self.assertAlmostEqual(sim, 1.0, places=4)

    def test_cosine_similarity_distinct(self):
        """Distinct seeds must yield lower cosine similarity than identical ones."""
        vec1 = generate_scaffold_vector("seed_person_a")
        vec2 = generate_scaffold_vector("seed_person_b")
        sim = compute_cosine_similarity(vec1, vec2)
        self.assertLess(sim, 0.99)

    def test_api_endpoints_if_testclient_available(self):
        if not client:
            print("Skipping TestClient endpoint tests (fastapi TestClient not installed in local environment)")
            return

        # 1. Health check
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["vector_dimension"], 512)

        # 2. Extract embedding
        extract_res = client.post("/api/v1/extract-embedding", json={
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "person_id": "SF-1001"
        })
        self.assertEqual(extract_res.status_code, 200)
        ext_data = extract_res.json()
        self.assertEqual(ext_data["dimension"], 512)
        self.assertEqual(len(ext_data["embedding"]), 512)
        self.assertGreater(ext_data["quality_score"], 80.0)

        # 3. Compare embeddings
        comp_res = client.post("/api/v1/compare", json={
            "source_embedding": ext_data["embedding"],
            "target_embedding": ext_data["embedding"],
            "confidence_threshold": 0.85
        })
        self.assertEqual(comp_res.status_code, 200)
        comp_data = comp_res.json()
        self.assertTrue(comp_data["is_match"])
        self.assertGreaterEqual(comp_data["similarity_score"], 0.85)

        # 4. Recognize face
        rec_res = client.post("/api/v1/recognize", json={
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "candidates": [
                {"person_id": "SF-1001", "embedding": ext_data["embedding"]},
                {"person_id": "SF-1002", "embedding": generate_scaffold_vector("other")}
            ],
            "confidence_threshold": 0.85
        })
        self.assertEqual(rec_res.status_code, 200)
        rec_data = rec_res.json()
        self.assertTrue(rec_data["matched"])
        self.assertEqual(rec_data["person_id"], "SF-1001")


if __name__ == "__main__":
    unittest.main()
