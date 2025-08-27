import os
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    port = os.getenv("PORT", "8000")
    return {
        "status": "ok", 
        "message": "StudentPilot Backend is live!", 
        "port": port,
        "version": "minimal-v1"
    }

@app.get("/health")
def health():
    return {
        "status": "ok", 
        "timestamp": "2025-08-27",
        "service": "studentpilot-backend"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting StudentPilot backend on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
