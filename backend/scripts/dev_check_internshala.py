#!/usr/bin/env python3
import sys
from typing import Optional

if __name__ == "__main__":
    try:
        from scrapers.internshala import fetch_internships
    except Exception as e:
        print("IMPORT_ERROR:", e)
        sys.exit(2)
    query = sys.argv[1] if len(sys.argv) > 1 else "python"
    location: Optional[str] = sys.argv[2] if len(sys.argv) > 2 else "India"
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    try:
        items = fetch_internships(query, location, limit=limit)
    except Exception as e:
        print("RUNTIME_ERROR:", e)
        sys.exit(3)
    print(f"count={len(items)}")
    for i, it in enumerate(items[:min(5, len(items))], 1):
        print(f"{i}. {it.get('title')} @ {it.get('company')} | {it.get('location')} | score={it.get('tech_relevance_score')} | tags={it.get('tags')}")
