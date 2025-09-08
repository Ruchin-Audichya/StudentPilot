#!/usr/bin/env python3
"""
Quick test script to verify the enhanced scrapers work correctly.
"""
import os
import sys
sys.path.append(os.path.dirname(__file__))

from scrapers.internshala import fetch_internships
from scrapers.linkedin import fetch_linkedin_internships

def test_internshala():
    print("=== Testing Enhanced Internshala Scraper ===")
    
    # Test with tech-focused queries
    test_queries = [
        "python developer",
        "web development", 
        "data science",
        "software engineer"
    ]
    
    for query in test_queries:
        print(f"\nTesting query: '{query}'")
        try:
            results = fetch_internships(query, "India", limit=3)
            print(f"Found {len(results)} results")
            
            for i, job in enumerate(results, 1):
                print(f"  {i}. {job['title']} at {job['company']}")
                print(f"     Tech Score: {job.get('tech_relevance_score', 'N/A')}")
                print(f"     Tags: {job.get('tags', [])}")
                if job.get('skills_required'):
                    print(f"     Skills: {job['skills_required']}")
                print()
                
        except Exception as e:
            print(f"Error testing {query}: {e}")

def test_linkedin():
    print("\n=== Testing Enhanced LinkedIn Scraper ===")
    
    # Check if LinkedIn is enabled
    if os.getenv("DISABLE_LINKEDIN", "0") in {"1", "true", "yes", "on"}:
        print("LinkedIn scraper is disabled. Enable by setting DISABLE_LINKEDIN=0")
        return
    
    try:
        results = fetch_linkedin_internships("python developer", "India", limit=2)
        print(f"Found {len(results)} results")
        
        for i, job in enumerate(results, 1):
            print(f"  {i}. {job['title']} at {job['company']}")
            print(f"     Location: {job['location']}")
            print(f"     Tags: {job.get('tags', [])}")
            print()
            
    except Exception as e:
        print(f"Error testing LinkedIn: {e}")

if __name__ == "__main__":
    # Load environment
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    
    test_internshala()
    test_linkedin()
