FROM python:3.11-slim

# Install FastAPI and Uvicorn
RUN pip install fastapi==0.112.2 uvicorn[standard]==0.30.6

# Set working directory
WORKDIR /app

# Copy application
COPY main_simple.py main.py

# Expose port
EXPOSE 8000

# Start the application
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
