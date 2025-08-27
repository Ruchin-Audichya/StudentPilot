"""Simple backend smoke tests (no external network scraping assertions).
Run: python smoke_test.py
Exits non-zero on failure.
"""
from fastapi.testclient import TestClient
import sys
from main import app

client = TestClient(app)

failures = []

def check(name, cond, detail=""):
    if not cond:
        failures.append(f"FAIL: {name} {detail}")
        print(f"[FAIL] {name} {detail}")
    else:
        print(f"[OK ] {name}")

# 1 health
r = client.get('/health')
check('health status', r.status_code == 200 and r.json().get('status') == 'ok')

# 2 resume-status (should return structure)
r = client.get('/api/resume-status')
check('resume-status shape', r.status_code == 200 and 'has_resume' in r.json())

# 3 search fallback returns list (may be empty -> acceptable but list)
r = client.post('/api/search', json={'query':'python','filters':{'location':'India'}})
check('search status', r.status_code == 200)
if r.status_code == 200:
    data = r.json()
    check('search list type', isinstance(data, list))

# 4 chat generic prompt returns response key
r = client.post('/api/chat', json={'message':'help me with skill gap'})
check('chat basic', r.status_code == 200 and 'response' in r.json())

if failures:
    print('\n'.join(failures))
    sys.exit(1)
print('Smoke tests passed.')
