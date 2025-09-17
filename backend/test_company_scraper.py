from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_scrape_single_smoke():
    # Use a well-known ATS board; allow empty results (network/env may block)
    body = {"url": "https://boards.greenhouse.io/stripe"}
    r = client.post("/api/internships/scrape", json=body)
    assert r.status_code in (200, 422)  # 422 if URL validation fails in env
    if r.status_code == 200:
        data = r.json()
        assert isinstance(data, list)


def test_scrape_batch_smoke():
    body = {"urls": ["https://boards.greenhouse.io/stripe", "https://jobs.lever.co/airbnb"], "limit_per_site": 3}
    r = client.post("/api/internships/scrape-batch", json=body)
    assert r.status_code in (200, 422)
    if r.status_code == 200:
        data = r.json()
        assert "results" in data and "errors" in data
        assert isinstance(data["results"], list)
        assert isinstance(data["errors"], list)
