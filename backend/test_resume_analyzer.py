from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_resume_analyzer_basic():
    resume_text = """
    John Doe
    Skills: Python, React, SQL, FastAPI
    Experience: Built REST API with FastAPI and PostgreSQL
    """
    jobs = [
        {
            "title": "Software Engineer Intern (Backend)",
            "description": "Work with Python, FastAPI and SQL to build APIs",
            "company": "TechCorp",
            "tags": ["backend", "api"],
            "url": "https://example.com/1",
        },
        {
            "title": "Frontend Intern",
            "description": "React UI and component development",
            "company": "WebCo",
            "tags": ["frontend", "react"],
            "url": "https://example.com/2",
        },
    ]
    r = client.post("/api/analyze/resume-vs-jobs", json={"resume_text": resume_text, "jobs": jobs})
    assert r.status_code == 200
    data = r.json()
    assert "results" in data and isinstance(data["results"], list)
    assert "suggestions" in data and isinstance(data["suggestions"], list)
    assert len(data["results"]) == 2
    for item in data["results"]:
        assert 0 <= item["score"] <= 100
        assert isinstance(item.get("missing_keywords", []), list)
