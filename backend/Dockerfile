FROM python:3.11-slim AS base

ARG POETRY_VERSION
ARG DISABLE_LINKEDIN=0
ARG INSTALL_CHROME=1
ENV DISABLE_LINKEDIN=${DISABLE_LINKEDIN}

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Default PORT for local; Elastic Beanstalk will inject PORT
    PORT=8000

WORKDIR /app

# Base system deps always installed (lightweight)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg unzip wget fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Optional heavy Chromium + driver layer (skip with --build-arg INSTALL_CHROME=0 for Railway / low RAM)
RUN if [ "$INSTALL_CHROME" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends chromium chromium-driver && \
      rm -rf /var/lib/apt/lists/* ; \
    else echo "Skipping Chromium installation" ; fi

# Set Chrome/Driver paths for Selenium (may not exist if INSTALL_CHROME=0 -> LinkedIn scraper should be disabled)
ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver

# Create non-root user
RUN useradd -ms /bin/bash appuser

# Healthcheck for platforms (Railway / DO) hitting internal port
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD wget -q -O - http://127.0.0.1:${PORT:-8000}/health || exit 1

# Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && \
    pip install --no-cache-dir gunicorn uvicorn

# App source
COPY backend/ /app/

USER appuser

# Expose service port
EXPOSE 8000

# Hint: For Railway lightweight deploy use build args: INSTALL_CHROME=0 and env: DISABLE_LINKEDIN=1
# Start with Gunicorn using Uvicorn workers; honor PORT/WORKERS/TIMEOUT env vars
CMD ["sh", "-c", "gunicorn -c gunicorn_conf.py main:app"]
