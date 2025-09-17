from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_hr_links_basic():
    body = {
        "skills": ["python", "react"],
        "roles": ["software engineer"],
        "location": "India",
        "limit": 3,
    }
    r = client.post("/api/linkedin/hr-links", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "links" in data and isinstance(data["links"], list)
    if data["links"]:
        first = data["links"][0]
        assert "label" in first and "url" in first
        assert first["url"].startswith("https://www.linkedin.com/search/results/people/")


def test_hr_links_with_resume_text_only():
    body = {
        "resume_text": "John Doe\nSkills: Python, React\nLooking for Software Engineer internships\nLocation: Jaipur, India",
        "limit": 2,
    }
    r = client.post("/api/linkedin/hr-links", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "links" in data
    assert isinstance(data["links"], list)
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_hr_links_basic():
    body = {"skills": ["python", "react"], "roles": ["software engineer"], "location": "India", "limit": 5}
    r = client.post("/api/linkedin/hr-links", json=body)
    assert r.status_code == 200
    data = r.json()
    assert "links" in data and isinstance(data["links"], list)
    if data["links"]:
        assert "label" in data["links"][0] and "url" in data["links"][0]


def test_hr_links_session_fallback():
    # No explicit inputs; should still return a list (may be generic)
    r = client.post("/api/linkedin/hr-links", json={})
    assert r.status_code == 200
    data = r.json()
    assert "links" in data and isinstance(data["links"], list)
