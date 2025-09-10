#!/usr/bin/env python3
import requests
import json

def test_frontend_backend_connection():
    """Test the connection that the frontend would make"""
    
    # Test the port 8000 backend (what frontend expects)
    try:
        response = requests.post(
            'http://127.0.0.1:8000/api/search',
            json={
                'query': 'python internship',
                'filters': {'location': 'India', 'experience_level': 'internship'}
            },
            timeout=10
        )
        
        print(f"Port 8000 - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Got {len(data)} results from port 8000")
            for i, job in enumerate(data[:2], 1):
                print(f"  {i}. {job.get('title')} at {job.get('company')} ({job.get('source')})")
        else:
            print(f"❌ Error: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ Port 8000 failed: {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Also test port 8002 for comparison
    try:
        response = requests.post(
            'http://127.0.0.1:8002/api/search',
            json={
                'query': 'python internship', 
                'filters': {'location': 'India', 'experience_level': 'internship'}
            },
            timeout=10
        )
        
        print(f"Port 8002 - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Got {len(data)} results from port 8002")
            for i, job in enumerate(data[:2], 1):
                print(f"  {i}. {job.get('title')} at {job.get('company')} ({job.get('source')})")
        else:
            print(f"❌ Error: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ Port 8002 failed: {e}")

if __name__ == "__main__":
    test_frontend_backend_connection()
