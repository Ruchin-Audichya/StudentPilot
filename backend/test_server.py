#!/usr/bin/env python3
# Minimal test server to debug the issue
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/search")
def search(request: dict):
    # Return sample data that matches frontend expectations
    return [
        {
            "title": "Python Developer Internship",
            "company": "TechCorp",
            "location": "India",
            "stipend": "₹20,000/month",
            "apply_url": "https://example.com/apply/1",
            "source": "internshala",
            "description": "Looking for Python developers for summer internship",
            "tags": ["python", "tech", "remote"],
            "is_new": True,
            "score": 95
        },
        {
            "title": "Full Stack Developer Internship", 
            "company": "StartupXYZ",
            "location": "Bangalore",
            "stipend": "₹15,000/month",
            "apply_url": "https://example.com/apply/2",
            "source": "internshala",
            "description": "Full stack development opportunity",
            "tags": ["javascript", "react", "node"],
            "is_new": False,
            "score": 87
        }
    ]

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
