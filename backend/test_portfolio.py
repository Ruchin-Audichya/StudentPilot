from fastapi.testclient import TestClient
from main import app
import zipfile, io

client = TestClient(app)


def test_portfolio_generate_zip():
    resume = {
        "name": "Ankit Sharma",
        "summary": "B.Tech student passionate about backend engineering.",
        "skills": ["python", "fastapi", "sql"],
    }
    r = client.post("/api/portfolio/generate", json={"resume": resume})
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/zip")
    data = r.content
    f = io.BytesIO(data)
    with zipfile.ZipFile(f) as z:
        names = set(z.namelist())
        assert {"index.html", "styles.css", "README.md"}.issubset(names)
        html = z.read("index.html").decode("utf-8")
        assert "Ankit Sharma" in html
        assert "B.Tech" in html
