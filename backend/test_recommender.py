from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_recommendations_rank_basic():
    resume = {
        "skills": ["python", "react", "sql"],
        "roles": ["software engineer", "backend"],
        "location": "india",
        "experience": [
            {"title": "Backend Project", "description": "Built REST APIs with FastAPI and SQL"}
        ],
        "preferred_tags": ["remote", "backend"],
    }
    jobs = [
        {
            "title": "Software Engineer Intern (Backend)",
            "description": "Work with Python, FastAPI, SQL to build APIs",
            "location": "India",
            "tags": ["backend", "remote"],
            "url": "https://example.com/1",
        },
        {
            "title": "Marketing Intern",
            "description": "Social media and content",
            "location": "India",
            "tags": ["marketing"],
            "url": "https://example.com/2",
        },
    ]
    r = client.post("/api/recommendations/rank", json={"resume": resume, "jobs": jobs, "k": 2})
    assert r.status_code == 200
    data = r.json()
    assert "results" in data and isinstance(data["results"], list)
    assert len(data["results"]) == 2
    # Expect the backend job to rank first
    assert data["results"][0]["title"].lower().startswith("software engineer intern")
