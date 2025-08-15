FROM python:3.11-slim AS base

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Default PORT for local; Elastic Beanstalk will inject PORT
    PORT=8000

WORKDIR /app

# Install system dependencies, Chromium and Chromedriver for Selenium
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    unzip \
    fonts-liberation \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome/Driver paths for Selenium
ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver

# Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App source
COPY backend/ /app/

# Expose service port
EXPOSE 8000

# Start with Gunicorn using Uvicorn workers; honor PORT/WORKERS/TIMEOUT env vars
CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000} --workers ${WORKERS:-2} --timeout ${TIMEOUT:-120}"]
