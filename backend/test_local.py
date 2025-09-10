#!/usr/bin/env python3
import requests
import time
import subprocess
import os
import sys
from threading import Thread

def test_search_endpoint():
    """Test the local search endpoint"""
    time.sleep(2)  # Wait for server to start
    
    try:
        response = requests.post(
            'http://127.0.0.1:8002/api/search',
            json={'query': 'python internship', 'filters': {'location': 'India'}},
            timeout=30
        )
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success! Got {len(data)} results")
            if data:
                print(f"First result: {data[0].get('title')} at {data[0].get('company')}")
                print(f"Source: {data[0].get('source')}")
        else:
            print(f"Error response: {response.text[:500]}")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Set environment variables
    os.environ['PORT'] = '8002'
    os.environ['ALLOW_SAMPLE_FALLBACK'] = '0'  # Disable sample fallback to see real results
    
    # Start server in background thread
    def run_server():
        os.system('python main.py')
    
    server_thread = Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Test endpoint
    test_search_endpoint()
