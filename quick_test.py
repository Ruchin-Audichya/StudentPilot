import requests
import json

# Simple test
try:
    r = requests.post('http://127.0.0.1:8000/api/search', 
                     json={'query': 'python', 'filters': {'location': 'India'}}, 
                     timeout=5)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Results: {len(data)}")
        if data:
            print(f"First: {data[0].get('title')}")
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Failed: {e}")
