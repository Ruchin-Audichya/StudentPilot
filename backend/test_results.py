#!/usr/bin/env python3
import requests
import json

try:
    response = requests.post(
        'http://127.0.0.1:8002/api/search',
        json={'query': 'python internship', 'filters': {'location': 'India'}},
        timeout=30
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success! Got {len(data)} results from search endpoint")
        print("\nResults:")
        for i, job in enumerate(data[:3], 1):
            print(f"{i}. {job.get('title')} at {job.get('company')}")
            print(f"   Source: {job.get('source')} | Location: {job.get('location')}")
            print(f"   Score: {job.get('score')} | Tags: {job.get('tags', [])[:3]}")
            if job.get('apply_url'):
                print(f"   Apply: {job.get('apply_url')[:60]}...")
            print()
    else:
        print(f"❌ Error {response.status_code}: {response.text[:200]}")
        
except Exception as e:
    print(f"❌ Request failed: {e}")
