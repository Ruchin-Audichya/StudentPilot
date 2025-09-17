from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_cover_letter_fallback():
    resume = {
        "name": "Riya Patel",
        "skills": ["python", "react", "sql"],
        "location": "Ahmedabad, India",
    }
    job = {
        "title": "Software Engineer Intern",
        "company": "TechNova",
        "description": "Work on backend APIs and React frontend."
    }
    r = client.post("/api/messages/cover-letter", json={"resume": resume, "job": job, "mode": "cover_letter"})
    assert r.status_code == 200
    data = r.json()
    assert "message" in data and isinstance(data["message"], str)
    assert data["message"].strip() != ""
    assert data.get("mode") == "cover_letter"
