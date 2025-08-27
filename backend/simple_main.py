from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"app": "StudentPilot API", "status": "ok", "message": "Backend is live!"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
