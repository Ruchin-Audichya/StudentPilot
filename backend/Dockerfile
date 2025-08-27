FROM python:3.11-slim

# Install minimal requirements
RUN pip install fastapi uvicorn

WORKDIR /app

# Create app with dynamic port support
RUN echo 'import os\n\
from fastapi import FastAPI\n\
\n\
app = FastAPI()\n\
\n\
@app.get("/")\n\
def root():\n\
    port = os.getenv("PORT", "8000")\n\
    return {"status": "ok", "message": "Backend is live!", "port": port}\n\
\n\
@app.get("/health")\n\
def health():\n\
    return {"status": "ok", "timestamp": "2025-08-27"}\n\
\n\
if __name__ == "__main__":\n\
    import uvicorn\n\
    port = int(os.getenv("PORT", 8000))\n\
    print(f"Starting server on port {port}")\n\
    uvicorn.run(app, host="0.0.0.0", port=port)\n\
' > main.py

# Expose port 8000 (EB will map to actual port)
EXPOSE 8000

# Use python directly with PORT env var
CMD ["python", "-c", "import os; import uvicorn; port=int(os.getenv('PORT', 8000)); print(f'Starting on port {port}'); import main; uvicorn.run(main.app, host='0.0.0.0', port=port)"]
