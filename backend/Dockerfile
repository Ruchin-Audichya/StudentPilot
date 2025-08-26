FROM python:3.11-slim AS runtime

# Metadata
LABEL maintainer="studentpilot" \
      org.opencontainers.image.source="https://github.com/Ruchin-Audichya/StudentPilot" \
      org.opencontainers.image.description="StudentPilot FastAPI backend"

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    DISABLE_LINKEDIN=1 \
    PATH="/home/appuser/.local/bin:$PATH"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/

# Create non-root user
RUN useradd -ms /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT}/health || exit 1

EXPOSE 8000

# Start command - use shell form for variable expansion
CMD gunicorn -k uvicorn.workers.UvicornWorker main:app \
    --bind 0.0.0.0:${PORT} \
    --workers ${WORKERS:-2} \
    --timeout ${TIMEOUT:-120} \
    --access-logfile - \
    --error-logfile -
